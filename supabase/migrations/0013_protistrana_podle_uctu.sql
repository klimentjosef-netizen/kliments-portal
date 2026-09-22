-- 0013 · Protistrana podle účtu: když jsou jiné platby na stejný účet spárované
-- s doklady jedné protistrany, nespárovaná platba dostane její název
-- (např. "GERYLA SRO" na účet Marcela Milička = platba Miličkovi).
CREATE OR REPLACE FUNCTION public.kl_doplnit_protistrany(p_client uuid)
RETURNS int LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH znamy AS (
    SELECT t.counterparty_account, min(d.counterparty_name) AS jmeno
    FROM bank_transactions t
    JOIN payment_matches m ON m.bank_transaction_id = t.id
    JOIN documents d ON d.id = m.document_id
    WHERE t.client_id = p_client AND t.counterparty_account IS NOT NULL AND d.counterparty_name IS NOT NULL
      AND d.kind <> 'contract'
    GROUP BY t.counterparty_account
    HAVING count(DISTINCT lower(left(d.counterparty_name, 8))) = 1
  ), u AS (
    UPDATE bank_transactions t SET counterparty_name = z.jmeno
    FROM znamy z
    WHERE t.client_id = p_client AND t.counterparty_account = z.counterparty_account
      AND coalesce(t.counterparty_name, '') <> z.jmeno
      AND NOT EXISTS (SELECT 1 FROM payment_matches m WHERE m.bank_transaction_id = t.id)
    RETURNING 1)
  SELECT count(*)::int FROM u
$$;
