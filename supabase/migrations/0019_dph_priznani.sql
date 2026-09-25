-- ===========================================================================
-- 0019 · Podklad k přiznání k DPH a ke kontrolnímu hlášení
--
-- Počítá se z dokladů (rozpis sazeb + režim DPH) za zdaňovací období.
-- Řádky přiznání (formulář DPHDP3):
--   1, 2   dodání zboží a služeb v tuzemsku (21 %, 12 %)
--   5, 6   přijaté služby od osoby neusazené v tuzemsku (samovyměření)
--   10, 11 režim přenesení daňové povinnosti, odběratel přiznává daň
--   20     dodání zboží do jiného členského státu
--   25     režim přenesení daňové povinnosti, dodavatel
--   40, 41 nárok na odpočet z tuzemských plnění (21 %, 12 %)
--   43, 44 nárok na odpočet z plnění podle řádků 3 až 13
--   62     daň na výstupu · 63 odpočet celkem · 64 vlastní daň · 65 nadměrný odpočet
-- Kontrolní hlášení: A1 a B1 (přenesená daňová povinnost), A4 a B2 (plnění nad
-- 10 000 Kč s DIČ), A5 a B3 (ostatní souhrnně).
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.kl_dph_priznani(p_client uuid, p_mesic date)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
WITH d AS (
  SELECT doc.*,
    coalesce(doc.amount_czk / nullif(doc.amount_total, 0), 1) AS kurz,
    (doc.kind IN ('issued_invoice', 'credit_note')) AS vydany,
    coalesce(doc.vat_regime, 'tuzemsko') AS rezim
  FROM documents doc
  WHERE doc.client_id = p_client
    AND doc.status <> ALL (ARRAY['duplicate', 'rejected'])
    AND doc.kind IN ('issued_invoice', 'credit_note', 'received_invoice', 'receipt')
    AND date_trunc('month', coalesce(doc.taxable_date, doc.issue_date))::date = p_mesic
), s AS (
  SELECT d.*, (x->>'sazba')::numeric AS sazba,
    round((x->>'zaklad')::numeric * d.kurz, 2) AS zaklad,
    round((x->>'dph')::numeric * d.kurz, 2) AS dph
  FROM d LEFT JOIN LATERAL jsonb_array_elements(coalesce(d.vat_breakdown, '[]'::jsonb)) x ON true
), r AS (
  SELECT
    -- výstup v tuzemsku
    coalesce(sum(zaklad) FILTER (WHERE vydany AND rezim = 'tuzemsko' AND sazba >= 20), 0) AS z1,
    coalesce(sum(dph)    FILTER (WHERE vydany AND rezim = 'tuzemsko' AND sazba >= 20), 0) AS d1,
    coalesce(sum(zaklad) FILTER (WHERE vydany AND rezim = 'tuzemsko' AND sazba > 0 AND sazba < 20), 0) AS z2,
    coalesce(sum(dph)    FILTER (WHERE vydany AND rezim = 'tuzemsko' AND sazba > 0 AND sazba < 20), 0) AS d2,
    -- přijaté služby ze zahraničí (samovyměření 21 %)
    coalesce(sum(zaklad) FILTER (WHERE NOT vydany AND rezim = 'reverse_charge'), 0)
      + coalesce(sum(CASE WHEN NOT vydany AND rezim = 'reverse_charge' AND sazba IS NULL THEN 0 ELSE 0 END), 0) AS z5,
    -- přenesená daňová povinnost
    coalesce(sum(zaklad) FILTER (WHERE NOT vydany AND rezim = 'pdp_stavebnictvi'), 0) AS z10,
    coalesce(sum(zaklad) FILTER (WHERE vydany AND rezim = 'pdp_stavebnictvi'), 0) AS z25,
    -- osvobozená plnění do EU
    coalesce(sum(zaklad) FILTER (WHERE vydany AND rezim = 'osvobozeno'), 0) AS z20,
    -- odpočet z tuzemských plnění
    coalesce(sum(zaklad) FILTER (WHERE NOT vydany AND rezim = 'tuzemsko' AND sazba >= 20), 0) AS z40,
    coalesce(sum(dph)    FILTER (WHERE NOT vydany AND rezim = 'tuzemsko' AND sazba >= 20), 0) AS d40,
    coalesce(sum(zaklad) FILTER (WHERE NOT vydany AND rezim = 'tuzemsko' AND sazba > 0 AND sazba < 20), 0) AS z41,
    coalesce(sum(dph)    FILTER (WHERE NOT vydany AND rezim = 'tuzemsko' AND sazba > 0 AND sazba < 20), 0) AS d41,
    count(DISTINCT id) AS dokladu
  FROM s
), rc AS ( -- základ u zahraničních služeb bez rozpisu sazeb = celá částka
  SELECT coalesce(sum(coalesce(amount_czk, amount_total)), 0) AS zaklad
  FROM d WHERE NOT vydany AND rezim = 'reverse_charge'
), pdp AS (
  SELECT coalesce(sum(coalesce(amount_czk, amount_total)), 0) AS zaklad
  FROM d WHERE NOT vydany AND rezim = 'pdp_stavebnictvi'
), kh AS (
  SELECT
    coalesce(jsonb_agg(jsonb_build_object('doklad', doc_number, 'dic', counterparty_dic, 'protistrana', counterparty_name,
      'datum', coalesce(taxable_date, issue_date), 'zaklad', round(coalesce(amount_czk, amount_total) - coalesce(amount_vat, 0) * kurz, 2),
      'dan', round(coalesce(amount_vat, 0) * kurz, 2)) ORDER BY coalesce(taxable_date, issue_date))
      FILTER (WHERE vydany AND rezim = 'tuzemsko' AND counterparty_dic IS NOT NULL AND coalesce(amount_czk, amount_total) > 10000), '[]'::jsonb) AS a4,
    coalesce(sum(coalesce(amount_czk, amount_total)) FILTER (WHERE vydany AND rezim = 'tuzemsko'
      AND (counterparty_dic IS NULL OR coalesce(amount_czk, amount_total) <= 10000)), 0) AS a5,
    coalesce(jsonb_agg(jsonb_build_object('doklad', doc_number, 'dic', counterparty_dic, 'protistrana', counterparty_name,
      'datum', coalesce(taxable_date, issue_date), 'zaklad', round(coalesce(amount_czk, amount_total) - coalesce(amount_vat, 0) * kurz, 2),
      'dan', round(coalesce(amount_vat, 0) * kurz, 2)) ORDER BY coalesce(taxable_date, issue_date))
      FILTER (WHERE NOT vydany AND rezim = 'tuzemsko' AND counterparty_dic IS NOT NULL AND coalesce(amount_czk, amount_total) > 10000), '[]'::jsonb) AS b2,
    coalesce(sum(coalesce(amount_czk, amount_total)) FILTER (WHERE NOT vydany AND rezim = 'tuzemsko'
      AND (counterparty_dic IS NULL OR coalesce(amount_czk, amount_total) <= 10000)), 0) AS b3,
    coalesce(jsonb_agg(jsonb_build_object('doklad', doc_number, 'dic', counterparty_dic, 'protistrana', counterparty_name,
      'zaklad', round(coalesce(amount_czk, amount_total), 2)) ORDER BY coalesce(taxable_date, issue_date))
      FILTER (WHERE vydany AND rezim = 'pdp_stavebnictvi'), '[]'::jsonb) AS a1,
    coalesce(jsonb_agg(jsonb_build_object('doklad', doc_number, 'dic', counterparty_dic, 'protistrana', counterparty_name,
      'zaklad', round(coalesce(amount_czk, amount_total), 2)) ORDER BY coalesce(taxable_date, issue_date))
      FILTER (WHERE NOT vydany AND rezim = 'pdp_stavebnictvi'), '[]'::jsonb) AS b1,
    count(*) FILTER (WHERE vat_breakdown IS NULL AND rezim = 'tuzemsko') AS bez_rozpisu
  FROM d
)
SELECT jsonb_build_object(
  'mesic', p_mesic,
  'radky', jsonb_build_object(
    'r1', jsonb_build_object('zaklad', r.z1, 'dan', r.d1),
    'r2', jsonb_build_object('zaklad', r.z2, 'dan', r.d2),
    'r5', jsonb_build_object('zaklad', rc.zaklad, 'dan', round(rc.zaklad * 0.21, 2)),
    'r10', jsonb_build_object('zaklad', pdp.zaklad, 'dan', round(pdp.zaklad * 0.21, 2)),
    'r20', jsonb_build_object('zaklad', r.z20),
    'r25', jsonb_build_object('zaklad', r.z25),
    'r40', jsonb_build_object('zaklad', r.z40, 'dan', r.d40),
    'r41', jsonb_build_object('zaklad', r.z41, 'dan', r.d41),
    'r43', jsonb_build_object('dan', round(rc.zaklad * 0.21 + pdp.zaklad * 0.21, 2))),
  'dan_na_vystupu', round(r.d1 + r.d2 + rc.zaklad * 0.21 + pdp.zaklad * 0.21, 2),
  'odpocet', round(r.d40 + r.d41 + rc.zaklad * 0.21 + pdp.zaklad * 0.21, 2),
  'vysledek', round(r.d1 + r.d2 - r.d40 - r.d41, 2),
  'dokladu', r.dokladu,
  'kh', jsonb_build_object('a1', kh.a1, 'a4', kh.a4, 'a5', kh.a5, 'b1', kh.b1, 'b2', kh.b2, 'b3', kh.b3),
  'upozorneni', jsonb_build_object('dokladu_bez_rozpisu_dph', kh.bez_rozpisu))
FROM r, rc, pdp, kh
$$;

GRANT EXECUTE ON FUNCTION public.kl_dph_priznani(uuid, date) TO authenticated;
