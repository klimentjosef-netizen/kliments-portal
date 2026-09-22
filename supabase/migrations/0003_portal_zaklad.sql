-- ===========================================================================
-- 0003 · Základ portálu v samostatném projektu Kliments (amvfqwyfnhktyemqmqza)
--
-- Doplňuje k 0001 (tabulky profiles / reports / messages) vše, co baseline
-- z OpenAPI nezachytil: funkce, trigger na nové uživatele, RLS, úložiště
-- dokumentů a realtime zpráv. Převzato ze starého sdíleného projektu
-- (zvrxkvglvidifbrbruem, 2026-09-22), zdvojené politiky sloučeny.
-- ===========================================================================

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS ---------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_profile   ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY admin_all     ON public.profiles FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY own_reports   ON public.reports  FOR SELECT USING (client_id = auth.uid());
CREATE POLICY own_update    ON public.reports  FOR UPDATE USING (client_id = auth.uid());
CREATE POLICY admin_all     ON public.reports  FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY own_messages  ON public.messages FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY send_messages ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY read_messages ON public.messages FOR UPDATE USING (receiver_id = auth.uid());

-- Úložiště dokumentů: {user_id}/{složka}/{soubor} ---------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, 52428800, ARRAY[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel', 'text/csv', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png', 'image/jpeg', 'application/zip', 'text/plain',
  'application/xml', 'text/xml'
]);

CREATE POLICY docs_own_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY docs_own_select ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY docs_own_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY docs_admin_all ON storage.objects FOR ALL
  USING (bucket_id = 'documents' AND public.is_admin())
  WITH CHECK (bucket_id = 'documents' AND public.is_admin());

-- Realtime pro chat a odznak nepřečtených
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
