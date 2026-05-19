# Supabase schema management

Project ref: **`zvrxkvglvidifbrbruem`** → `https://zvrxkvglvidifbrbruem.supabase.co`

## Baseline (2026-05-19)

- **[`schema.sql`](schema.sql)** — current production snapshot. Regenerable via `supabase db dump`.
- **[`migrations/0001_baseline_schema.sql`](migrations/0001_baseline_schema.sql)** — frozen baseline, **never edit**.

> **Heads up:** this baseline was generated from PostgREST OpenAPI (no DB password was available at the time). It captures **tables, columns, types, defaults, primary keys, and foreign keys**, but does NOT include:
> - RLS policies
> - Function bodies (`is_admin()`, `rls_auto_enable()`)
> - Triggers
> - Indexes beyond PK
> - Realtime publication config
> - Storage RLS policies
>
> See [the full list of gaps](schema.sql#L107) at the bottom of `schema.sql`.

To regenerate as a true pg_dump:

```bash
supabase login
supabase link --project-ref zvrxkvglvidifbrbruem
supabase db dump --schema public --file supabase/schema.sql
```

Database password lives at: Supabase Dashboard → Project Settings → Database → Connection string.

## Adding a new migration

1. Create new file: `migrations/000X_<short_description>.sql`
2. Write SQL (CREATE, ALTER, DROP).
3. Apply locally first: `supabase db push` (against local stack or branch).
4. Once verified, apply to production via `supabase db push --linked` and commit to repo.

Naming: zero-padded sequence, snake_case description. Examples:

- `0002_add_notifications_table.sql`
- `0003_add_profile_phone_and_goals.sql`
- `0004_create_monthly_commentary_struct.sql`

## Re-sync `schema.sql` from production

Run:

```bash
supabase db dump --schema public --file supabase/schema.sql
```

This overwrites `schema.sql` but does NOT touch `migrations/`.

## Recommended next migrations (planned for AI-augmented CFO)

Tracked in [`portal-data-inventory.md`](../portal-data-inventory.md), Sekce 8. Short list:

- `0002_add_notifications_table.sql` — create the table that `/api/notify` currently writes to with no-op fallback.
- `0003_add_profile_phone_and_goals.sql` — wire up onboarding wizard fields that today get discarded.
- `0004_add_monthly_commentary.sql` — JSONB array on `reports.data` for AI-generated monthly commentary history.
- `0005_add_bank_balance_history.sql` — month-end snapshots of `ledger.bank_balance`.
- `0006_add_tier_cogs.sql` — COGS per tier so margin per product can be calculated.

## Local development

This repo does NOT use Supabase local stack (Docker). All development hits the production project directly. If we ever set up a staging Supabase project, we'd:

1. Create new project in dashboard.
2. Apply `migrations/*.sql` in order via `supabase db push`.
3. Wire the staging URL + keys into `.env.local.staging`.
