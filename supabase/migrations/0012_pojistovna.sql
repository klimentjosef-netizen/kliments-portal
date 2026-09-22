-- 0012 · Část faktury uhrazená přímo pojišťovnou (extracted.hrazeno_pojistovnou)
-- se nepočítá do nákladů klienta a v saldu se bere jako uhrazená (extracted.uhrazeno).
CREATE OR REPLACE FUNCTION public.kl_prehled(p_client uuid, p_rok int DEFAULT extract(year FROM current_date)::int)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  k public.clients;
  od date := make_date(p_rok, 1, 1);
  do_ date := make_date(p_rok, 12, 31);
  platne text[] := ARRAY['duplicate', 'rejected'];
  r jsonb := '{}'::jsonb;
  v_vynosy numeric; v_naklady numeric; v_mzdy numeric; v_zaklad numeric; v_sazba numeric;
  v_obdobi_od date; v_obdobi_do date;
BEGIN
  SELECT * INTO k FROM public.clients WHERE id = p_client;
  IF NOT FOUND THEN RETURN NULL; END IF;

  r := r || jsonb_build_object('klient', jsonb_build_object(
    'nazev', k.name, 'ico', k.ico, 'platce_dph', k.vat_payer, 'perioda_dph', k.vat_period,
    'forma', k.legal_form, 'rezim', k.intake_cadence), 'rok', p_rok);

  -- Aktuálnost dat
  r := r || jsonb_build_object('aktualnost', jsonb_build_object(
    'posledni_doklad', (SELECT max(received_at) FROM documents WHERE client_id = p_client AND source IN ('email', 'upload')),
    'posledni_pohyb_banky', (SELECT max(booked_on) FROM bank_transactions WHERE client_id = p_client),
    'ceka_na_zpracovani', (SELECT count(*) FROM documents WHERE client_id = p_client AND status = 'new'),
    'bez_kurzu', (SELECT count(*) FROM documents d WHERE client_id = p_client AND d.currency <> 'CZK' AND d.amount_czk IS NULL AND d.status <> ALL (platne))));

  -- Banka letos
  r := r || jsonb_build_object('banka', (
    SELECT jsonb_build_object(
      'prijmy', coalesce(sum(amount) FILTER (WHERE amount > 0), 0),
      'vydaje', coalesce(-sum(amount) FILTER (WHERE amount < 0), 0),
      'pohybu', count(*))
    FROM bank_transactions WHERE client_id = p_client AND booked_on BETWEEN od AND do_));

  -- Saldo faktur (bez dokladů s neznámou částkou)
  r := r || jsonb_build_object('saldo', (
    SELECT jsonb_build_object(
      'vydane_otevrene_pocet', count(*) FILTER (WHERE kind = 'issued_invoice' AND state IN ('open', 'overdue')),
      'vydane_otevrene', coalesce(sum(open_amount) FILTER (WHERE kind = 'issued_invoice' AND state IN ('open', 'overdue')), 0),
      'vydane_po_splatnosti', coalesce(sum(open_amount) FILTER (WHERE kind = 'issued_invoice' AND state = 'overdue'), 0),
      'prijate_otevrene_pocet', count(*) FILTER (WHERE kind = 'received_invoice' AND state IN ('open', 'overdue')),
      'prijate_otevrene', coalesce(sum(open_amount) FILTER (WHERE kind = 'received_invoice' AND state IN ('open', 'overdue')), 0),
      'prijate_po_splatnosti', coalesce(sum(open_amount) FILTER (WHERE kind = 'received_invoice' AND state = 'overdue'), 0),
      'neovereno', count(*) FILTER (WHERE state = 'unverified'))
    FROM v_document_balance WHERE client_id = p_client));

  -- DPH
  IF k.vat_payer THEN
    IF k.vat_period = 'quarter' THEN
      v_obdobi_od := date_trunc('quarter', current_date)::date;
      v_obdobi_do := (date_trunc('quarter', current_date) + interval '3 months - 1 day')::date;
    ELSE
      v_obdobi_od := date_trunc('month', current_date)::date;
      v_obdobi_do := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
    END IF;
    r := r || jsonb_build_object('dph', (
      SELECT jsonb_build_object(
        'platce', true, 'perioda_nastavena', k.vat_period IS NOT NULL,
        'obdobi_od', v_obdobi_od, 'obdobi_do', v_obdobi_do,
        'podat_do', (v_obdobi_do + 25),
        'na_vystupu', coalesce(sum(kl_dph_czk(d)) FILTER (WHERE kind = 'issued_invoice'), 0)
                    - coalesce(sum(kl_dph_czk(d)) FILTER (WHERE kind = 'credit_note' AND source = 'import'), 0),
        'na_vstupu', coalesce(sum(kl_dph_czk(d)) FILTER (WHERE kind IN ('received_invoice', 'receipt')), 0),
        'dokladu', count(*))
      FROM documents d
      WHERE client_id = p_client AND status <> ALL (platne)
        AND coalesce(taxable_date, issue_date) BETWEEN v_obdobi_od AND v_obdobi_do));
    r := jsonb_set(r, '{dph,vysledek}', to_jsonb((r->'dph'->>'na_vystupu')::numeric - (r->'dph'->>'na_vstupu')::numeric));
  ELSE
    -- neplátce: obrat za posledních 12 měsíců proti limitu registrace
    r := r || jsonb_build_object('dph', (
      SELECT jsonb_build_object(
        'platce', false,
        'obrat_12m', coalesce(sum(kl_czk(d)) FILTER (WHERE kind = 'issued_invoice'), 0)
                   - coalesce(sum(kl_czk(d)) FILTER (WHERE kind = 'credit_note' AND source = 'import'), 0),
        'limit', 2000000, 'limit_okamzity', 2536500,
        'od', (current_date - interval '12 months')::date)
      FROM documents d
      WHERE client_id = p_client AND status <> ALL (platne)
        AND coalesce(taxable_date, issue_date) > current_date - interval '12 months'));
  END IF;

  -- Daň z příjmu letos: výnosy z vydaných faktur, náklady z přijatých dokladů,
  -- mzdy z bankovních plateb mzdové agendy. Plátce bez DPH, neplátce včetně.
  SELECT
    coalesce(sum(kl_czk(d) - CASE WHEN k.vat_payer THEN kl_dph_czk(d) ELSE 0 END) FILTER (WHERE kind = 'issued_invoice'), 0),
    coalesce(sum(kl_czk(d) - CASE WHEN k.vat_payer THEN kl_dph_czk(d) ELSE 0 END - coalesce((d.extracted->>'hrazeno_pojistovnou')::numeric, 0)) FILTER (WHERE kind IN ('received_invoice', 'receipt')), 0)
  INTO v_vynosy, v_naklady
  FROM documents d
  WHERE client_id = p_client AND status <> ALL (platne)
    AND coalesce(taxable_date, issue_date) BETWEEN od AND do_;
  SELECT coalesce(-sum(amount), 0) INTO v_mzdy
  FROM bank_transactions WHERE client_id = p_client AND category = 'payroll' AND booked_on BETWEEN od AND do_;
  -- platby podle smluv (nájem, leasing, ...) bez měsíčních faktur: náklad = zaplacená částka
  -- (u plátce jen když smlouva nese DPH, jinak celá částka; DPH ze smluv zatím nepočítáme)
  v_naklady := v_naklady + coalesce((
    SELECT sum(m.amount) FROM payment_matches m
    JOIN documents d ON d.id = m.document_id
    JOIN bank_transactions t ON t.id = m.bank_transaction_id
    WHERE d.client_id = p_client AND d.kind = 'contract' AND coalesce((d.extracted->>'naklad')::boolean, false)
      AND t.booked_on BETWEEN od AND do_), 0);
  -- náklady a příjmy "přímo z banky" bez dokladu (na pokyn účetní): category bank_expense / bank_income
  v_naklady := v_naklady + coalesce((SELECT -sum(amount) FROM bank_transactions
    WHERE client_id = p_client AND category = 'bank_expense' AND booked_on BETWEEN od AND do_), 0);
  v_vynosy := v_vynosy + coalesce((SELECT sum(amount) FROM bank_transactions
    WHERE client_id = p_client AND category = 'bank_income' AND booked_on BETWEEN od AND do_), 0);
  v_zaklad := v_vynosy - v_naklady - v_mzdy;
  v_sazba := CASE WHEN k.legal_form IN ('s.r.o.', 'a.s.') THEN 0.21 WHEN k.legal_form = 'OSVČ' THEN 0.15 END;
  r := r || jsonb_build_object('dan', jsonb_build_object(
    'vynosy', v_vynosy, 'naklady', v_naklady, 'mzdy', v_mzdy, 'zaklad', v_zaklad,
    'sazba', v_sazba,
    'odhad_dane', CASE WHEN v_sazba IS NULL OR v_zaklad <= 0 THEN 0 ELSE round(v_zaklad * v_sazba, -2) END,
    'predbezne', true));

  -- Co chybí: platby bez dokladu podle protistrany
  r := r || jsonb_build_object('chybi', (
    SELECT jsonb_build_object(
      'pocet', count(*), 'castka', coalesce(-sum(amount), 0),
      'podle_protistrany', coalesce((
        SELECT jsonb_agg(x ORDER BY x.castka DESC) FROM (
          SELECT coalesce(counterparty_name, 'neznámá protistrana') AS protistrana, count(*) AS pocet, -sum(amount) AS castka
          FROM v_missing_documents WHERE client_id = p_client
          GROUP BY 1 ORDER BY 3 DESC LIMIT 6) x), '[]'::jsonb))
    FROM v_missing_documents WHERE client_id = p_client));

  RETURN r;
END;
$$;

