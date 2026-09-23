-- ===========================================================================
-- 0015 · DPH po měsících: co za měsíc vyšlo z dokladů, co se odvedlo z účtu
--
-- Předpis se počítá z dokladů podle data plnění (DUZP), odvod z plateb na účet
-- finančního úřadu s předčíslím 705 (DPH). Platba se přiřadí k měsíci, za který
-- se platí: DPH za měsíc M je splatná 25. dne měsíce M+1, takže platba z období
-- od 26. dne M do konce M+1 patří k měsíci M. Vratka (kladná částka) se počítá
-- jako záporný odvod.
--
-- Reverse charge zatím není v předpisu zahrnutý (samovyměření doplníme u DPH).
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.kl_dph_mesice(p_client uuid, p_rok int DEFAULT extract(year FROM current_date)::int)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
WITH mesice AS (
  SELECT generate_series(make_date(p_rok, 1, 1), make_date(p_rok, 12, 1), interval '1 month')::date AS od
), predpis AS (
  SELECT m.od,
    coalesce(sum(kl_dph_czk(d)) FILTER (WHERE d.kind = 'issued_invoice'), 0)
      - coalesce(sum(kl_dph_czk(d)) FILTER (WHERE d.kind = 'credit_note'), 0) AS na_vystupu,
    coalesce(sum(kl_dph_czk(d)) FILTER (WHERE d.kind IN ('received_invoice', 'receipt')), 0) AS na_vstupu,
    count(*) FILTER (WHERE d.id IS NOT NULL) AS dokladu
  FROM mesice m
  LEFT JOIN documents d ON d.client_id = p_client AND d.status <> ALL (ARRAY['duplicate', 'rejected'])
    AND date_trunc('month', coalesce(d.taxable_date, d.issue_date))::date = m.od
  GROUP BY m.od
), odvod AS (
  SELECT m.od,
    coalesce(-sum(t.amount), 0) AS zaplaceno,
    min(t.booked_on) FILTER (WHERE t.amount < 0) AS datum_platby
  FROM mesice m
  LEFT JOIN bank_transactions t ON t.client_id = p_client
    AND t.counterparty_account LIKE '705-%'
    AND t.booked_on > (m.od + interval '25 days')::date
    AND t.booked_on <= (m.od + interval '2 months' - interval '1 day')::date
  GROUP BY m.od
)
SELECT coalesce(jsonb_agg(jsonb_build_object(
  'mesic', p.od,
  'na_vystupu', p.na_vystupu,
  'na_vstupu', p.na_vstupu,
  'vysledek', p.na_vystupu - p.na_vstupu,
  'dokladu', p.dokladu,
  'zaplaceno', o.zaplaceno,
  'datum_platby', o.datum_platby,
  'rozdil', round((p.na_vystupu - p.na_vstupu) - o.zaplaceno, 2),
  'splatnost', (p.od + interval '1 month' + interval '24 days')::date,
  'stav', CASE
    WHEN p.dokladu = 0 AND o.zaplaceno = 0 THEN 'prazdny'
    WHEN abs((p.na_vystupu - p.na_vstupu) - o.zaplaceno) < 1 THEN 'sedi'
    WHEN o.zaplaceno = 0 AND (p.od + interval '1 month' + interval '24 days')::date >= current_date THEN 'ceka'
    WHEN o.zaplaceno = 0 THEN 'nezaplaceno'
    ELSE 'nesedi' END
) ORDER BY p.od), '[]'::jsonb)
FROM predpis p JOIN odvod o USING (od)
$$;

GRANT EXECUTE ON FUNCTION public.kl_dph_mesice(uuid, int) TO authenticated;

-- Ostatní platby finančnímu úřadu podle druhu daně (předčíslí účtu)
CREATE OR REPLACE VIEW public.v_platby_uradu WITH (security_invoker = true) AS
SELECT t.client_id, t.booked_on, t.amount, t.counterparty_account, t.var_symbol,
  split_part(t.counterparty_account, '-', 1) AS predcisli,
  CASE split_part(t.counterparty_account, '-', 1)
    WHEN '705' THEN 'DPH'
    WHEN '7704' THEN 'Daň z příjmů právnických osob'
    WHEN '7712' THEN 'Daň vybíraná srážkou'
    WHEN '7720' THEN 'Daň vybíraná srážkou'
    WHEN '713' THEN 'Záloha na daň ze závislé činnosti'
    WHEN '721' THEN 'Silniční daň'
    WHEN '35' THEN 'Příslušenství daně'
    ELSE 'Jiná platba úřadu' END AS druh
FROM public.bank_transactions t
WHERE t.counterparty_account LIKE '%/0710';
