-- ===========================================================================
-- 0014 · Co potřebuje DPH a zaúčtování
--   vat_breakdown  rozpis DPH po sazbách: [{"sazba":21,"zaklad":1800,"dph":378}]
--   vat_regime     tuzemsko | reverse_charge | pdp_stavebnictvi | oss | mimo_predmet | osvobozeno
--   items          položky dokladu: [{"nazev":"...","mnozstvi":1,"mj":"ks",
--                  "cena_bez_dph":1800,"sazba_dph":21,"cena_s_dph":2178}]
--   suggested_account   návrh účtu (518, 501, 042, ...) od Clauda
--   suggested_vat_class návrh členění DPH pro Pohodu (UD, UN, PD, ...)
--   supplier_bank_account  účet dodavatele z dokladu (párování a platební příkazy)
-- ===========================================================================
ALTER TABLE public.documents
  ADD COLUMN vat_breakdown        jsonb,
  ADD COLUMN vat_regime           text,
  ADD COLUMN items                jsonb,
  ADD COLUMN suggested_account    text,
  ADD COLUMN suggested_vat_class  text,
  ADD COLUMN supplier_bank_account text;

CREATE INDEX documents_client_counterparty_idx
  ON public.documents (client_id, counterparty_ico) WHERE counterparty_ico IS NOT NULL;

-- Paměť dodavatelů: jak se stejný dodavatel u klienta účtoval minule
CREATE OR REPLACE VIEW public.v_supplier_memory WITH (security_invoker = true) AS
SELECT DISTINCT ON (client_id, counterparty_ico)
  client_id, counterparty_ico,
  max(counterparty_name) AS counterparty_name,
  mode() WITHIN GROUP (ORDER BY suggested_account)   AS ucet,
  mode() WITHIN GROUP (ORDER BY suggested_vat_class) AS cleneni_dph,
  mode() WITHIN GROUP (ORDER BY vat_regime)          AS rezim_dph,
  count(*)                                           AS dokladu,
  max(coalesce(taxable_date, issue_date))            AS posledni
FROM public.documents
WHERE counterparty_ico IS NOT NULL AND status <> 'duplicate' AND status <> 'rejected'
  AND (suggested_account IS NOT NULL OR vat_regime IS NOT NULL)
GROUP BY client_id, counterparty_ico;
