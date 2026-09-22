-- 0005 · Sběrná složka ve firsen@email.cz, ze které se berou doklady klienta
ALTER TABLE public.clients ADD COLUMN mail_folder text UNIQUE;
