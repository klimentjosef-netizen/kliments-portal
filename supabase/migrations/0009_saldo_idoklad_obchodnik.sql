-- 0009 · Saldo bere v úvahu úhradu evidovanou ve fakturačním programu (iDoklad:
-- extracted.uhrazeno) a kartové platby Fio dostanou protistranu z textu "Nákup: X,".
CREATE OR REPLACE VIEW public.v_document_balance WITH (security_invoker = true) AS
SELECT
  d.id AS document_id, d.client_id, d.kind, d.counterparty_name, d.doc_number, d.var_symbol,
  d.issue_date, d.due_date,
  coalesce(d.amount_czk, d.amount_total) AS amount,
  greatest(coalesce(sum(m.amount), 0), coalesce((d.extracted->>'uhrazeno')::numeric, 0)) AS paid,
  coalesce(d.amount_czk, d.amount_total) - greatest(coalesce(sum(m.amount), 0), coalesce((d.extracted->>'uhrazeno')::numeric, 0)) AS open_amount,
  CASE
    WHEN coalesce(d.amount_czk, d.amount_total) IS NULL THEN 'unverified'
    WHEN greatest(coalesce(sum(m.amount), 0), coalesce((d.extracted->>'uhrazeno')::numeric, 0)) >= coalesce(d.amount_czk, d.amount_total) THEN 'paid'
    WHEN d.due_date < current_date THEN 'overdue'
    ELSE 'open'
  END AS state
FROM public.documents d
LEFT JOIN public.payment_matches m ON m.document_id = d.id
WHERE d.kind IN ('received_invoice', 'issued_invoice', 'advance', 'credit_note')
  AND d.status <> 'duplicate' AND d.status <> 'rejected'
GROUP BY d.id;

UPDATE public.bank_transactions
SET counterparty_name = trim(substring(message FROM 'Nákup: ([^,]+)'))
WHERE counterparty_name IS NULL AND message ~ 'Nákup: ';
