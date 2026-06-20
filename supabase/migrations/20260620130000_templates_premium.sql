-- ─────────────────────────────────────────────────────────────────────────────
-- Premium Templates — Phase A schema
-- Migration: 20260620130000_templates_premium.sql
-- Extends the existing `templates` table with payload/authoring columns and
-- adds the `template_purchases` ownership/licensing table.
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── A. Extend templates ──────────────────────────────────────────────────────

-- Design payload
alter table templates add column if not exists content      jsonb        not null default '{}'::jsonb;
alter table templates add column if not exists theme        jsonb        not null default '{}'::jsonb;

-- Human-readable unique identifier (nulls allowed → partial unique index below)
alter table templates add column if not exists slug         text;
create unique index if not exists templates_slug_key
  on templates (slug) where slug is not null;

-- Discoverability
alter table templates add column if not exists tags         text[]       not null default '{}';

-- Optional live-preview page (points to a pages row)
alter table templates add column if not exists demo_page_id uuid;

-- Versioning
alter table templates add column if not exists version      integer      not null default 1;
alter table templates add column if not exists updated_at   timestamptz  not null default now();

-- License model: per_store | per_page | all_access
alter table templates add column if not exists license_model text not null default 'per_store';

-- Add CHECK constraint only if it does not already exist
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'templates_license_model_check'
      and conrelid = 'public.templates'::regclass
  ) then
    alter table templates
      add constraint templates_license_model_check
      check (license_model in ('per_store', 'per_page', 'all_access'));
  end if;
end $$;

-- Future marketplace headroom (seller-authored templates + revenue share)
alter table templates add column if not exists author_store_id uuid;
alter table templates add column if not exists rev_share_pct  numeric not null default 0;

-- ── B. template_purchases ────────────────────────────────────────────────────

create table if not exists template_purchases (
  id           uuid        primary key default gen_random_uuid(),
  store_id     uuid        not null references stores(id) on delete cascade,
  template_id  uuid        not null references templates(id) on delete cascade,
  page_id      uuid,                          -- nullable; populated for per_page licenses only
  price_paise  integer     not null default 0,
  source       text        not null check (source in ('wallet', 'razorpay', 'free', 'admin_grant')),
  payment_ref  text,                          -- Razorpay payment_id / wallet ledger row id
  created_at   timestamptz not null default now()
);

-- One license per (store, template, effective-page): NULL page_id collapses to a
-- fixed sentinel UUID so per_store gets exactly one row per template per store.
create unique index if not exists template_purchases_unique
  on template_purchases (
    store_id,
    template_id,
    coalesce(page_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- Fast lookups
create index if not exists template_purchases_store_idx
  on template_purchases (store_id);

create index if not exists template_purchases_template_idx
  on template_purchases (template_id);

-- ── C. RLS on template_purchases ────────────────────────────────────────────

alter table template_purchases enable row level security;

-- Sellers can read their own purchase records.
-- Mirrors the wallet_ledger pattern: store_id must belong to auth.uid().
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'template_purchases'
      and policyname = 'template_purchases_seller_select'
  ) then
    create policy template_purchases_seller_select
      on template_purchases for select
      using (
        store_id in (
          select id from stores where owner_id = auth.uid()
        )
      );
  end if;
end $$;

-- Admins have full access.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'template_purchases'
      and policyname = 'template_purchases_admin_all'
  ) then
    create policy template_purchases_admin_all
      on template_purchases for all
      using     (is_admin())
      with check (is_admin());
  end if;
end $$;

-- No seller INSERT/UPDATE/DELETE policies — writes happen via server actions
-- using the service-role client, which bypasses RLS entirely.

-- ── PostgREST schema-cache reload ───────────────────────────────────────────
notify pgrst, 'reload schema';
