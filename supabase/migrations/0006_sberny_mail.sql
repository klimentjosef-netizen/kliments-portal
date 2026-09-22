-- 0006 · Sběrný mail: evidence zpracovaných e-mailů
CREATE TABLE public.mail_messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox        text NOT NULL,                 -- firsen@email.cz
  folder         text NOT NULL,
  uidvalidity    bigint NOT NULL,
  uid            bigint NOT NULL,
  message_id     text,
  from_addr      text,
  subject        text,
  received_at    timestamptz,
  client_id      uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  assigned_by    text CHECK (assigned_by IN ('folder', 'ico', 'manual')),
  category       text,                          -- doklad | banka | urad | dotaz | marketing | ostatni
  summary        text,                          -- co to je, česky, pro upozornění
  action_needed  text,                          -- co s tím udělat (prázdné = nic)
  attachments    int NOT NULL DEFAULT 0,
  documents      int NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'processed'
                 CHECK (status IN ('processed', 'needs_review', 'ignored', 'error')),
  error          text,
  ai             jsonb,
  notified_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mailbox, folder, uidvalidity, uid)
);

CREATE INDEX mail_messages_client_idx ON public.mail_messages (client_id, received_at);
CREATE INDEX mail_messages_notify_idx ON public.mail_messages (notified_at) WHERE notified_at IS NULL;

ALTER TABLE public.documents
  ADD COLUMN mail_message_id uuid REFERENCES public.mail_messages(id) ON DELETE SET NULL,
  ADD COLUMN customer_ico text;               -- IČO odběratele z dokladu (kontrola přiřazení)

ALTER TABLE public.mail_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_all   ON public.mail_messages FOR ALL    USING (public.kl_is_staff()) WITH CHECK (public.kl_is_staff());
CREATE POLICY client_read ON public.mail_messages FOR SELECT USING (client_id IS NOT NULL AND public.kl_can_read(client_id));
