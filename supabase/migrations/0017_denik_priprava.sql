-- ===========================================================================
-- 0017 · Příprava deníku
--   * zaúčtovaný zápis musí mít doklad NEBO bankovní pohyb (u bankovních zápisů
--     je dokladem výpis, ne faktura)
--   * nastavení účtů u klienta (účet výnosů, pokladna, vlastní účty)
-- ===========================================================================
ALTER TABLE public.journal_entries DROP CONSTRAINT IF EXISTS posted_needs_document;
ALTER TABLE public.journal_entries ADD CONSTRAINT posted_needs_document
  CHECK (status = 'draft' OR document_id IS NOT NULL OR bank_transaction_id IS NOT NULL);

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS settings jsonb;

COMMENT ON COLUMN public.clients.settings IS
  'Nastavení účtování: {"ucet_vynosu":"602","ucet_zbozi":"604","ucet_pokladny":"211","vlastni_ucty":["..."]}';

-- Deník po měsících pro kontrolu
CREATE OR REPLACE VIEW public.v_denik WITH (security_invoker = true) AS
SELECT e.client_id, e.id AS entry_id, e.series, e.entry_number, e.entry_date, e.description,
  e.status, e.document_id, e.bank_transaction_id,
  l.line_no, l.account_debit, l.account_credit, l.amount, l.vat_rate, l.vat_class, l.text
FROM public.journal_entries e
JOIN public.journal_lines l ON l.entry_id = e.id;
