-- ===========================================================================
-- 0020 · Fronta úloh pro Pohoda agenta
--
-- Agent běží na počítači s Pohodou (vzdálená plocha iPodnik), úlohy si bere přes
-- internet a výsledek (responsePack) vrací zpět. K databázi nemá jiný přístup než
-- přes tyto dvě funkce a ověřuje se tokenem, v databázi je jen jeho SHA-256 otisk.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.pohoda_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  last_host text
);

CREATE TABLE IF NOT EXISTS public.pohoda_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id),
  ico text NOT NULL,
  database text NOT NULL,
  description text,
  xml_b64 text NOT NULL,
  doc_ids uuid[] NOT NULL DEFAULT '{}',
  check_duplicity boolean NOT NULL DEFAULT true,
  timeout_sec integer NOT NULL DEFAULT 600,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  agent_id uuid REFERENCES public.pohoda_agents(id),
  response_b64 text,
  summary jsonb,
  error text
);
CREATE INDEX IF NOT EXISTS pohoda_jobs_fronta ON public.pohoda_jobs (status, created_at);

ALTER TABLE public.pohoda_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pohoda_jobs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.kl_agent_over(p_token text, p_host text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  UPDATE pohoda_agents
     SET last_seen_at = now(), last_host = coalesce(p_host, last_host)
   WHERE token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'neplatný token agenta' USING ERRCODE = '28000'; END IF;
  RETURN v_id;
END $$;

-- Další úloha ve frontě. Úloha, která visí ve stavu running déle než dvojnásobek
-- svého limitu (agent spadl), se vrátí do fronty.
CREATE OR REPLACE FUNCTION public.kl_agent_dalsi(p_token text, p_host text DEFAULT NULL)
RETURNS TABLE (id uuid, ico text, database text, description text, xml_b64 text, check_duplicity boolean, timeout_sec integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_agent uuid := kl_agent_over(p_token, p_host);
BEGIN
  UPDATE pohoda_jobs j SET status = 'queued', started_at = NULL, agent_id = NULL
   WHERE j.status = 'running' AND j.started_at < now() - make_interval(secs => j.timeout_sec * 2);

  RETURN QUERY
  UPDATE pohoda_jobs j SET status = 'running', started_at = now(), agent_id = v_agent
   WHERE j.id = (SELECT q.id FROM pohoda_jobs q WHERE q.status = 'queued' ORDER BY q.created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
  RETURNING j.id, j.ico, j.database, j.description, j.xml_b64, j.check_duplicity, j.timeout_sec;
END $$;

CREATE OR REPLACE FUNCTION public.kl_agent_vysledek(p_token text, p_job uuid, p_ok boolean, p_response_b64 text, p_summary jsonb, p_error text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_agent uuid := kl_agent_over(p_token, NULL);
BEGIN
  UPDATE pohoda_jobs
     SET status = CASE WHEN p_ok THEN 'done' ELSE 'error' END,
         finished_at = now(), response_b64 = p_response_b64, summary = p_summary, error = p_error
   WHERE id = p_job AND agent_id = v_agent AND status = 'running';
  IF NOT FOUND THEN RAISE EXCEPTION 'úloha % neběží u tohoto agenta', p_job; END IF;
END $$;

REVOKE ALL ON FUNCTION public.kl_agent_over(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kl_agent_dalsi(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kl_agent_vysledek(text, uuid, boolean, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kl_agent_dalsi(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.kl_agent_vysledek(text, uuid, boolean, text, jsonb, text) TO anon;
