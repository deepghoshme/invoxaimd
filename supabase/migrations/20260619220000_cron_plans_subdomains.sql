-- ============================================================================
-- invoxai.io — Cron run tracking, plan interval/recommended, subscription
--              period_start, and extra store subdomains (paid add-on)
-- ----------------------------------------------------------------------------
-- Area 1: public.cron_runs
--   Records each scheduled cron job execution for the admin Cron Jobs page.
--   Service-role client writes (RLS bypassed); admin reads via is_admin().
--
-- Area 2: public.plans additions
--   interval         text  — 'monthly' or 'annual'; design: one row per plan
--                            carries an interval so admins create separate rows
--                            for monthly and annual pricing (simpler than a
--                            second price column; proration code picks the row
--                            matching the chosen interval).
--   is_recommended   bool  — distinct from is_popular; flags the recommended-
--                            annual badge shown on the pricing page.
--
--   public.subscriptions addition
--   period_start     timestamptz — start of the current billing period; lets
--                                  proration compute full period length without
--                                  ambiguity. Existing rows keep NULL and the
--                                  proration code falls back to started_at.
--
-- Area 3: public.store_subdomains
--   Additional {sub}.invoxai.io hostnames for one store (paid add-on). The
--   primary subdomain stays on stores.subdomain; these are extras. Public
--   SELECT so the site router can resolve any subdomain to a store without
--   needing elevated credentials. Owner/admin write via owns_store()/is_admin().
--
-- Idempotent: all DDL uses IF NOT EXISTS or DO-block guards.
-- Apply via: node scripts/db-apply.mjs supabase/migrations/20260619220000_cron_plans_subdomains.sql
-- ============================================================================


-- ============================================================================
-- AREA 1 — CRON RUN TRACKING
-- ============================================================================

create table if not exists public.cron_runs (
  id           uuid        primary key default gen_random_uuid(),
  job          text        not null,
  status       text        not null
                             check (status in ('success', 'error', 'running')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  result       jsonb       not null default '{}'::jsonb,
  error        text
);

comment on table public.cron_runs is
  'Records each daily cron job execution for the admin Cron Jobs status page.';

comment on column public.cron_runs.job         is 'Cron job identifier, e.g. ''recovery'', ''audit'', ''subscriptions'', ''wallet_report'', ''all''.';
comment on column public.cron_runs.status      is 'Execution outcome: running (in-flight), success, or error.';
comment on column public.cron_runs.started_at  is 'When the cron job started (UTC).';
comment on column public.cron_runs.finished_at is 'When the cron job completed or errored (UTC). NULL while status = ''running''.';
comment on column public.cron_runs.result      is 'Summary counts/payload returned by the job, e.g. {emails_sent: 12, skipped: 3}.';
comment on column public.cron_runs.error       is 'Error message or stack trace when status = ''error''. NULL on success.';

-- Primary query patterns:
--   • admin page loads: all runs for a specific job, newest first
--   • admin dashboard: all runs newest first (recent activity)
create index if not exists cron_runs_job_started_idx
  on public.cron_runs (job, started_at desc);

create index if not exists cron_runs_started_idx
  on public.cron_runs (started_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Service-role client (used by the cron API route) bypasses RLS entirely for
-- writes — no INSERT/UPDATE/DELETE policy needed. Admins read via is_admin().

alter table public.cron_runs enable row level security;

drop policy if exists cron_runs_admin_read on public.cron_runs;
create policy cron_runs_admin_read on public.cron_runs
  for select
  using (public.is_admin());


-- ============================================================================
-- AREA 2a — PLANS: interval + is_recommended columns
-- ============================================================================

alter table public.plans
  add column if not exists interval       text    not null default 'monthly',
  add column if not exists is_recommended boolean not null default false;

comment on column public.plans.interval       is 'Billing interval for this plan row: ''monthly'' or ''annual''. One row per plan per interval — create separate rows for monthly and annual pricing rather than adding a second price column.';
comment on column public.plans.is_recommended is 'When true, the pricing page renders a "Recommended" badge on this plan. Distinct from is_popular; intended for the featured annual plan.';

-- Guard the CHECK constraint so re-running this migration is safe.
-- pg_constraint tracks constraints by name within the table's namespace.
do $$
begin
  if not exists (
    select 1
    from   pg_constraint c
    join   pg_class      r on r.oid = c.conrelid
    join   pg_namespace  n on n.oid = r.relnamespace
    where  n.nspname = 'public'
    and    r.relname = 'plans'
    and    c.conname = 'plans_interval_check'
  ) then
    alter table public.plans
      add constraint plans_interval_check
        check (interval in ('monthly', 'annual'));
  end if;
end;
$$;


-- ============================================================================
-- AREA 2b — SUBSCRIPTIONS: period_start column
-- ============================================================================

alter table public.subscriptions
  add column if not exists period_start timestamptz;

comment on column public.subscriptions.period_start is 'Start of the current billing period (UTC). Used by proration logic to compute the full period length unambiguously. Existing rows are NULL; proration falls back to started_at when NULL.';


-- ============================================================================
-- AREA 3 — EXTRA STORE SUBDOMAINS (paid add-on)
-- ============================================================================

create table if not exists public.store_subdomains (
  id         uuid        primary key default gen_random_uuid(),
  store_id   uuid        not null references public.stores(id) on delete cascade,
  subdomain  text        not null unique,
  created_at timestamptz not null default now(),

  -- Reuse the same DNS-label format check as stores.subdomain (stores_subdomain_format).
  -- The regex enforces: starts and ends with [a-z0-9]; interior chars [a-z0-9-];
  -- total label length 3–63 chars. Here subdomain is NOT NULL so the null branch
  -- of the stores constraint is omitted.
  constraint store_subdomains_subdomain_format
    check (subdomain ~ '^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])$')
);

comment on table public.store_subdomains is
  'Additional subdomains for a store (paid add-on). The primary subdomain stays on stores.subdomain; these are extra {sub}.invoxai.io hostnames that resolve to the same store.';

comment on column public.store_subdomains.store_id  is 'The store these extra subdomains belong to.';
comment on column public.store_subdomains.subdomain is 'The extra subdomain label (e.g. "shop2"). Globally unique across all stores. Must match DNS-label format: lowercase a-z0-9 and hyphens, 3–63 chars.';

-- Index for the site router: given a subdomain, find its store_id quickly.
create index if not exists store_subdomains_store_idx
  on public.store_subdomains (store_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Public SELECT: the site router resolves {sub}.invoxai.io → store without
-- needing elevated credentials, matching how stores.subdomain is resolved.
-- Owner/admin INSERT/UPDATE/DELETE: sellers manage their own extra subdomains.

alter table public.store_subdomains enable row level security;

-- Public read — any visitor (anon or authenticated) can resolve a subdomain.
drop policy if exists store_subdomains_public_read on public.store_subdomains;
create policy store_subdomains_public_read on public.store_subdomains
  for select
  using (true);

-- Owner/admin insert.
drop policy if exists store_subdomains_owner_insert on public.store_subdomains;
create policy store_subdomains_owner_insert on public.store_subdomains
  for insert
  with check (public.owns_store(store_id) or public.is_admin());

-- Owner/admin update.
drop policy if exists store_subdomains_owner_update on public.store_subdomains;
create policy store_subdomains_owner_update on public.store_subdomains
  for update
  using  (public.owns_store(store_id) or public.is_admin())
  with check (public.owns_store(store_id) or public.is_admin());

-- Owner/admin delete.
drop policy if exists store_subdomains_owner_delete on public.store_subdomains;
create policy store_subdomains_owner_delete on public.store_subdomains
  for delete
  using (public.owns_store(store_id) or public.is_admin());


-- ============================================================================
-- PostgREST schema cache reload
-- ============================================================================

notify pgrst, 'reload schema';
