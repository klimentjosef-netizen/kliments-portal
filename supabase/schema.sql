-- ===========================================================================
-- Supabase production schema snapshot
-- Project: kliments-portal (ref: zvrxkvglvidifbrbruem)
-- Snapshot taken: 2026-05-19
--
-- Source: PostgREST OpenAPI introspection via service-role key
-- Method: GET <project>/rest/v1/  (Accept: application/openapi+json)
--          GET <project>/storage/v1/bucket
--
-- *** SCOPE LIMITATIONS — READ THIS BEFORE USING THIS FILE ***
--
-- PostgREST OpenAPI gives us: tables, columns, types, defaults, PKs, FKs.
-- It does NOT give us: RLS policies, triggers, indexes, constraints beyond
-- PK/FK, function bodies, sequences, or extensions.
--
-- For a full pg_dump-grade snapshot, run:
--   supabase login
--   supabase link --project-ref zvrxkvglvidifbrbruem
--   supabase db dump --schema public --file supabase/schema.sql
--
-- That requires the database password from Supabase Dashboard →
-- Project Settings → Database → Connection string.
--
-- Until then, this file is a STRUCTURAL baseline only. Policies and triggers
-- must be re-exported via Supabase Studio (Database → Backups, or manually
-- copy from the Policies UI).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- TABLE: public.profiles
-- Master user table. Mirrors auth.users for app-level role/state.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid                          NOT NULL PRIMARY KEY,
  email       text                          NULL,
  name        text                          NULL,
  role        text                          NULL DEFAULT 'client',  -- 'admin' | 'client'
  service     text                          NULL,                    -- comma-separated services
  active      boolean                       NULL DEFAULT true,
  created_at  timestamp without time zone   NULL DEFAULT now()
);

-- FK to auth.users(id) is documented but lives in Supabase Auth schema;
-- expected: profiles.id REFERENCES auth.users(id) ON DELETE CASCADE
-- (not visible from PostgREST OpenAPI — verify in Supabase Studio).


-- ---------------------------------------------------------------------------
-- TABLE: public.reports
-- Content store. Each row = one tab/screen per client.
-- All business data is in `data` (jsonb).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id          uuid                          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid                          NULL REFERENCES public.profiles(id),
  type        text                          NULL,   -- 'diagnoza' | 'cfo' | 'valuace' | 'investor' | 'mentoring'
  title       text                          NULL,
  data        jsonb                         NULL,
  created_at  timestamp without time zone   NULL DEFAULT now()
);

-- Expected (verify in Studio): ON DELETE CASCADE on client_id FK,
-- index on (client_id, type).


-- ---------------------------------------------------------------------------
-- TABLE: public.messages
-- 1:1 chat between admin and client.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id           uuid                         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id    uuid                         NULL REFERENCES public.profiles(id),
  receiver_id  uuid                         NULL REFERENCES public.profiles(id),
  content      text                         NULL,
  read         boolean                      NULL DEFAULT false,
  created_at   timestamp without time zone  NULL DEFAULT now()
);

-- Expected (verify in Studio): index on (receiver_id, read) for unread count
-- query; Supabase Realtime publication on INSERT.


-- ---------------------------------------------------------------------------
-- TABLES THAT DO NOT EXIST IN PRODUCTION (but are referenced in app code)
-- ---------------------------------------------------------------------------
-- NOTIFICATIONS: src/app/api/notify/route.ts writes to a `notifications`
-- table that DOES NOT EXIST. The endpoint catches the error and returns 200
-- silently. No emails or push notifications are being delivered.
--
-- To create it (proposed):
--
-- CREATE TABLE public.notifications (
--   id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
--   type         text NOT NULL,         -- 'new_message' | 'new_report' | 'report_updated'
--   title        text NOT NULL,
--   body         text,
--   email        text,
--   read         boolean NOT NULL DEFAULT false,
--   created_at   timestamptz NOT NULL DEFAULT now()
-- );


-- ---------------------------------------------------------------------------
-- FUNCTIONS (RPCs exposed via PostgREST)
-- ---------------------------------------------------------------------------
-- Two functions are visible via /rest/v1/rpc/* but their bodies are not
-- accessible without DB-level access. Re-export via:
--   pg_dump --schema-only --schema=public --no-owner --no-privileges
-- Or copy from Supabase Studio → Database → Functions.

-- FUNCTION: public.is_admin()
--   Returns: boolean
--   Purpose: helper used in RLS policies to check if auth.uid() is admin.
--   Verified call (with service-role key, no JWT): returned false.

-- FUNCTION: public.rls_auto_enable()
--   Returns: ?
--   Purpose: likely a setup helper run once to enable RLS across tables.
--   Verified exists, not called from app code.


-- ---------------------------------------------------------------------------
-- STORAGE BUCKETS
-- ---------------------------------------------------------------------------
-- Bucket: documents
--   public:     false
--   created_at: 2026-04-03T15:15:29.405Z
--   Layout: {user_id}/{folder_slug}/{filename}
--   Default folders (lazy-created via .emptyFolderPlaceholder upload):
--     ucetni-podklady, faktury, smlouvy, danove-priznani, ostatni


-- ---------------------------------------------------------------------------
-- WHAT'S MISSING FROM THIS DUMP
-- ---------------------------------------------------------------------------
-- 1. RLS policies on all 3 tables — must export via Supabase Studio
--    → Authentication → Policies, copy SQL for each policy.
-- 2. Function bodies of is_admin() and rls_auto_enable() — pg_dump required.
-- 3. Triggers (e.g. auto-create profile row on auth.users insert) — pg_dump.
-- 4. Indexes beyond PK — pg_dump.
-- 5. Supabase Auth schema (auth.*) — managed by Supabase, do not modify.
-- 6. Realtime publication config (which tables broadcast) — Studio UI.
-- 7. Storage RLS policies — Storage → Policies in Studio.
-- 8. Database extensions — pg_dump.
