-- ===========================================================================
-- 0002 · Účetní jádro Kliments
--
-- Evidence, nad kterou stojí celý produkt:
--   účetní jednotka (klient) → doklad (soubor) → účetní zápis → řádky deníku
--   bankovní účet → bankovní pohyb → párování s dokladem
--
-- Zásady:
--   * každý zaúčtovaný zápis má reálný doklad (CHECK na journal_entries)
--   * doklad přichází mailem, nahráním v portálu, importem nebo z banky
--   * stejný soubor u jednoho klienta nevznikne dvakrát (sha256)
--   * klient čte jen svá data, nahrávat smí jen doklady (source = 'upload')
--   * Kliments (role admin / ucetni) vidí a upravuje vše
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Role: kdo je z kanceláře Kliments
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kl_is_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'ucetni') AND coalesce(active, true)
  );
$$;

-- ---------------------------------------------------------------------------
-- Účetní jednotky (klienti)
-- ---------------------------------------------------------------------------
CREATE TABLE public.clients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  ico             text UNIQUE,
  dic             text,
  legal_form      text,                       -- 's.r.o.' | 'a.s.' | 'OSVČ' | ...
  address         text,
  vat_payer       boolean NOT NULL DEFAULT false,
  vat_period      text CHECK (vat_period IN ('month', 'quarter')),
  intake_email    text UNIQUE,                -- sběrná adresa pro doklady
  intake_cadence  text NOT NULL DEFAULT 'monthly'
                  CHECK (intake_cadence IN ('continuous', 'monthly')),
  pohoda_db       text,                       -- klíč účetní jednotky v Pohodě
  pricing         jsonb,                      -- sazebník vyúčtování (viz billing_runs)
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Kdo z portálu patří ke kterému klientovi
CREATE TABLE public.client_users (
  client_id   uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'viewer')),
  PRIMARY KEY (client_id, profile_id)
);

CREATE OR REPLACE FUNCTION public.kl_can_read(p_client uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.kl_is_staff() OR EXISTS (
    SELECT 1 FROM public.client_users
    WHERE client_id = p_client AND profile_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Doklady (reálné soubory)
-- ---------------------------------------------------------------------------
CREATE TABLE public.documents (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  kind               text NOT NULL DEFAULT 'unknown' CHECK (kind IN (
                       'received_invoice', 'issued_invoice', 'credit_note',
                       'receipt', 'advance', 'bank_statement', 'payment_report',
                       'contract', 'payroll', 'tax', 'other', 'unknown')),
  source             text NOT NULL CHECK (source IN ('email', 'upload', 'import', 'bank', 'generated')),
  status             text NOT NULL DEFAULT 'new' CHECK (status IN (
                       'new', 'extracted', 'reviewed', 'posted', 'rejected', 'duplicate')),

  -- soubor
  storage_path       text,                     -- bucket documents
  file_name          text,
  mime_type          text,
  file_sha256        text,
  email_message_id   text,
  email_from         text,
  received_at        timestamptz NOT NULL DEFAULT now(),
  uploaded_by        uuid REFERENCES public.profiles(id),

  -- vytěžené údaje
  counterparty_name  text,
  counterparty_ico   text,
  counterparty_dic   text,
  doc_number         text,                     -- číslo dokladu protistrany
  var_symbol         text,
  order_number       text,
  issue_date         date,
  taxable_date       date,                     -- DUZP
  due_date           date,
  currency           text NOT NULL DEFAULT 'CZK',
  amount_total       numeric(14, 2),           -- včetně DPH, v měně dokladu
  amount_vat         numeric(14, 2),
  amount_czk         numeric(14, 2),           -- přepočet do CZK
  description        text,                     -- co se kupovalo, pro hledání
  extracted          jsonb,                    -- surový výstup vytěžení
  extraction_method  text,                     -- 'isdoc' | 'ai' | 'manual' | 'import'
  note               text,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  UNIQUE (client_id, file_sha256)
);

CREATE INDEX documents_client_kind_idx ON public.documents (client_id, kind, issue_date);
CREATE INDEX documents_client_vs_idx   ON public.documents (client_id, var_symbol);
CREATE INDEX documents_client_status_idx ON public.documents (client_id, status);

-- ---------------------------------------------------------------------------
-- Banka
-- ---------------------------------------------------------------------------
CREATE TABLE public.bank_accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  number      text NOT NULL,                   -- 6893596004/5500
  iban        text,
  currency    text NOT NULL DEFAULT 'CZK',
  name        text,
  ledger_account text NOT NULL DEFAULT '221',  -- syntetický účet v deníku
  UNIQUE (client_id, number)
);

CREATE TABLE public.bank_transactions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  account_id            uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  booked_on             date NOT NULL,
  amount                numeric(14, 2) NOT NULL,   -- + příchozí, − odchozí, měna účtu
  original_amount       numeric(14, 2),
  original_currency     text,
  counterparty_account  text,
  counterparty_name     text,
  var_symbol            text,
  const_symbol          text,
  spec_symbol           text,
  message               text,
  tx_type               text,
  bank_tx_id            text,                      -- ID transakce z banky
  dedup_key             text NOT NULL,             -- bank_tx_id, jinak otisk řádku
  statement_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  category              text,                      -- např. 'owner_loan', 'payroll', 'gateway_payout'
  no_document_needed    boolean NOT NULL DEFAULT false,  -- poplatky banky apod. (doložené výpisem)
  note                  text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, dedup_key)
);

CREATE INDEX bank_tx_client_date_idx ON public.bank_transactions (client_id, booked_on);
CREATE INDEX bank_tx_client_vs_idx   ON public.bank_transactions (client_id, var_symbol);

-- ---------------------------------------------------------------------------
-- Párování platby a dokladu (N:M, částečné úhrady, souhrnné výplaty brány)
-- ---------------------------------------------------------------------------
CREATE TABLE public.payment_matches (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  bank_transaction_id  uuid NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  document_id          uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  amount               numeric(14, 2) NOT NULL,  -- kolik z platby připadá na doklad (CZK, kladně)
  method               text NOT NULL CHECK (method IN ('var_symbol', 'order_number', 'amount', 'manual', 'ai')),
  confirmed            boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bank_transaction_id, document_id)
);

CREATE INDEX payment_matches_doc_idx ON public.payment_matches (document_id);

-- ---------------------------------------------------------------------------
-- Účetní deník
-- ---------------------------------------------------------------------------
CREATE TABLE public.journal_entries (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  entry_number         text,                     -- číslo účetního dokladu (řada)
  series               text NOT NULL CHECK (series IN ('FP', 'FV', 'BV', 'PD', 'ID', 'OZ', 'MZ')),
  entry_date           date NOT NULL,
  description          text,
  document_id          uuid REFERENCES public.documents(id) ON DELETE RESTRICT,
  bank_transaction_id  uuid REFERENCES public.bank_transactions(id) ON DELETE RESTRICT,
  status               text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted')),
  pohoda_exported_at   timestamptz,
  pohoda_number        text,
  created_by           uuid REFERENCES public.profiles(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  -- zaúčtovat lze jen s reálným dokladem
  CONSTRAINT posted_needs_document CHECK (status = 'draft' OR document_id IS NOT NULL),
  UNIQUE (client_id, series, entry_number)
);

CREATE INDEX journal_entries_client_date_idx ON public.journal_entries (client_id, entry_date);

-- Řádek deníku = jeden zápis MD / D (základ pro vyúčtování)
CREATE TABLE public.journal_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id        uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  line_no         int  NOT NULL,
  account_debit   text NOT NULL,                 -- MD
  account_credit  text NOT NULL,                 -- D
  amount          numeric(14, 2) NOT NULL CHECK (amount <> 0),
  vat_rate        numeric(5, 2),
  vat_class       text,                          -- členění DPH (UD, UN, PN, ...)
  tax_deductible  boolean NOT NULL DEFAULT true, -- pro daňový základ
  text            text,
  UNIQUE (entry_id, line_no)
);

CREATE INDEX journal_lines_client_idx ON public.journal_lines (client_id);
CREATE INDEX journal_lines_accounts_idx ON public.journal_lines (client_id, account_debit, account_credit);

-- ---------------------------------------------------------------------------
-- Vyúčtování služeb Kliments
-- pricing klienta: {"basis": "bank_moves" | "journal_lines",
--                   "tiers": [{"to": 150, "price": 3000}, {"to": 300, "price": 5000}, ...],
--                   "extras": {"hpp": 350, "dpp": 200}}
-- ---------------------------------------------------------------------------
CREATE TABLE public.billing_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  period          date NOT NULL,                  -- první den měsíce
  basis           text NOT NULL,
  units           int  NOT NULL,
  amount          numeric(12, 2) NOT NULL,
  detail          jsonb,
  invoice_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, period)
);

-- ---------------------------------------------------------------------------
-- Pohledy pro portál
-- ---------------------------------------------------------------------------

-- Saldo dokladů: kolik je uhrazeno a kolik zbývá
CREATE VIEW public.v_document_balance WITH (security_invoker = true) AS
SELECT
  d.id AS document_id,
  d.client_id,
  d.kind,
  d.counterparty_name,
  d.doc_number,
  d.var_symbol,
  d.issue_date,
  d.due_date,
  coalesce(d.amount_czk, d.amount_total) AS amount,
  coalesce(sum(m.amount), 0) AS paid,
  coalesce(d.amount_czk, d.amount_total) - coalesce(sum(m.amount), 0) AS open_amount,
  CASE
    WHEN coalesce(sum(m.amount), 0) >= coalesce(d.amount_czk, d.amount_total) THEN 'paid'
    WHEN d.due_date < current_date THEN 'overdue'
    ELSE 'open'
  END AS state
FROM public.documents d
LEFT JOIN public.payment_matches m ON m.document_id = d.id
WHERE d.kind IN ('received_invoice', 'issued_invoice', 'advance', 'credit_note')
  AND d.status <> 'duplicate' AND d.status <> 'rejected'
GROUP BY d.id;

-- Chybějící podklady: platby bez dokladu
CREATE VIEW public.v_missing_documents WITH (security_invoker = true) AS
SELECT
  t.id AS bank_transaction_id,
  t.client_id,
  t.booked_on,
  t.amount,
  t.counterparty_name,
  t.counterparty_account,
  t.var_symbol,
  t.message,
  t.category
FROM public.bank_transactions t
WHERE t.amount < 0
  AND NOT t.no_document_needed
  AND NOT EXISTS (SELECT 1 FROM public.payment_matches m WHERE m.bank_transaction_id = t.id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.clients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_matches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_runs      ENABLE ROW LEVEL SECURITY;

-- Kancelář: vše
CREATE POLICY staff_all ON public.clients           FOR ALL USING (public.kl_is_staff()) WITH CHECK (public.kl_is_staff());
CREATE POLICY staff_all ON public.client_users      FOR ALL USING (public.kl_is_staff()) WITH CHECK (public.kl_is_staff());
CREATE POLICY staff_all ON public.documents         FOR ALL USING (public.kl_is_staff()) WITH CHECK (public.kl_is_staff());
CREATE POLICY staff_all ON public.bank_accounts     FOR ALL USING (public.kl_is_staff()) WITH CHECK (public.kl_is_staff());
CREATE POLICY staff_all ON public.bank_transactions FOR ALL USING (public.kl_is_staff()) WITH CHECK (public.kl_is_staff());
CREATE POLICY staff_all ON public.payment_matches   FOR ALL USING (public.kl_is_staff()) WITH CHECK (public.kl_is_staff());
CREATE POLICY staff_all ON public.journal_entries   FOR ALL USING (public.kl_is_staff()) WITH CHECK (public.kl_is_staff());
CREATE POLICY staff_all ON public.journal_lines     FOR ALL USING (public.kl_is_staff()) WITH CHECK (public.kl_is_staff());
CREATE POLICY staff_all ON public.billing_runs      FOR ALL USING (public.kl_is_staff()) WITH CHECK (public.kl_is_staff());

-- Klient: čtení vlastních dat
CREATE POLICY client_read ON public.clients           FOR SELECT USING (public.kl_can_read(id));
CREATE POLICY client_read ON public.client_users      FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY client_read ON public.documents         FOR SELECT USING (public.kl_can_read(client_id));
CREATE POLICY client_read ON public.bank_accounts     FOR SELECT USING (public.kl_can_read(client_id));
CREATE POLICY client_read ON public.bank_transactions FOR SELECT USING (public.kl_can_read(client_id));
CREATE POLICY client_read ON public.payment_matches   FOR SELECT USING (public.kl_can_read(client_id));
CREATE POLICY client_read ON public.journal_entries   FOR SELECT USING (public.kl_can_read(client_id));
CREATE POLICY client_read ON public.journal_lines     FOR SELECT USING (public.kl_can_read(client_id));
CREATE POLICY client_read ON public.billing_runs      FOR SELECT USING (public.kl_can_read(client_id));

-- Klient: nahrání dokladu v portálu (jen jako nový, nevytěžený)
CREATE POLICY client_upload ON public.documents FOR INSERT
  WITH CHECK (
    public.kl_can_read(client_id)
    AND source = 'upload'
    AND status = 'new'
    AND uploaded_by = auth.uid()
  );
