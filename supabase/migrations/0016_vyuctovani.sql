-- ===========================================================================
-- 0016 · Vyúčtování služeb Kliments podle ceníku klienta
--
-- Počet účetních podkladů za měsíc = doklady, které vstupují do účetnictví
-- (faktury, účtenky, zálohy, dobropisy, mzdové a interní doklady) + bankovní
-- pohyby. Odpovídá definici ve smlouvě; až budeme účtovat do deníku, nahradí
-- se počtem zápisů v deníku.
--
-- Ceník (clients.pricing): model 'pasma' s poli pasma[{do, cena}], nebo
-- 'pausal' se zakladem a priplatkem pri registraci k DPH.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.kl_podklady_mesic(p_client uuid, p_mesic date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'dokladu', (SELECT count(*) FROM documents d
      WHERE d.client_id = p_client AND d.status <> ALL (ARRAY['duplicate', 'rejected'])
        AND d.kind <> 'contract'
        AND date_trunc('month', coalesce(d.taxable_date, d.issue_date, d.received_at::date))::date = p_mesic),
    'pohybu', (SELECT count(*) FROM bank_transactions t
      WHERE t.client_id = p_client AND date_trunc('month', t.booked_on)::date = p_mesic))
$$;

CREATE OR REPLACE FUNCTION public.kl_vyuctovani(p_client uuid, p_mesic date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  k public.clients;
  p jsonb;
  pod jsonb;
  jednotek int;
  cena numeric;
  zaklad_nazev text;
BEGIN
  SELECT * INTO k FROM public.clients WHERE id = p_client;
  IF NOT FOUND OR k.pricing IS NULL THEN RETURN NULL; END IF;
  p := k.pricing;
  pod := public.kl_podklady_mesic(p_client, p_mesic);

  IF p->>'model' = 'pausal' THEN
    jednotek := (pod->>'dokladu')::int + (pod->>'pohybu')::int;
    cena := (p->>'zaklad')::numeric + CASE WHEN k.vat_payer THEN coalesce((p->>'priplatek_dph')::numeric, 0) ELSE 0 END;
    zaklad_nazev := p->>'zaklad_nazev';
  ELSE
    -- Maliiisa se podle smlouvy počítá z bankovních pohybů, ostatní ze všech podkladů
    jednotek := CASE WHEN p->>'zaklad_nazev' ILIKE '%bankovních pohybů%'
      THEN (pod->>'pohybu')::int
      ELSE (pod->>'dokladu')::int + (pod->>'pohybu')::int END;
    SELECT (x->>'cena')::numeric INTO cena
    FROM jsonb_array_elements(p->'pasma') x
    WHERE jednotek <= (x->>'do')::int
    ORDER BY (x->>'do')::int
    LIMIT 1;
    zaklad_nazev := p->>'zaklad_nazev';
  END IF;

  RETURN jsonb_build_object(
    'klient', k.name, 'ico', k.ico, 'mesic', p_mesic,
    'zaklad_nazev', zaklad_nazev,
    'podklady', pod, 'jednotek', jednotek,
    'cena', cena,
    'nad_limit', cena IS NULL,
    'vystavit', (p_mesic + interval '1 month' + (coalesce((p->>'fakturovat_den')::int, 10) - 1) * interval '1 day')::date,
    'splatnost', (p_mesic + interval '1 month' + (coalesce((p->>'fakturovat_den')::int, 10) - 1 + coalesce((p->>'splatnost_dni')::int, 7)) * interval '1 day')::date,
    'poznamka', CASE WHEN cena IS NULL THEN coalesce(p->'nad_limit'->>'poznamka', 'nad rámec ceníku') ELSE NULL END);
END;
$$;

GRANT EXECUTE ON FUNCTION public.kl_podklady_mesic(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kl_vyuctovani(uuid, date) TO authenticated;
