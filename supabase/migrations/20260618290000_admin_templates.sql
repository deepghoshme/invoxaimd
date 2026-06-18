-- Migration: admin_templates
-- Creates the `templates` table used by the admin "Premium templates" management page.
-- Sellers will browse published templates in the Template Gallery/Marketplace (Phase 6).
-- Idempotent — safe to re-run.

create table if not exists templates (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null default '',
  type          text        not null default 'bio'
                  check (type in ('bio','store','product','courses','booking','event','payment','lead','website','checkout','vip')),
  tier          text        not null default 'free'
                  check (tier in ('free','premium')),
  price_paise   integer     not null default 0 check (price_paise >= 0),
  thumbnail_url text,
  description   text,
  status        text        not null default 'draft'
                  check (status in ('published','draft')),
  sales_count   integer     not null default 0,
  created_at    timestamptz not null default now()
);

-- Index for browsing: seller marketplace will filter by type + status
create index if not exists templates_status_type_idx on templates (status, type);

-- RLS ----------------------------------------------------------
alter table templates enable row level security;

-- Public (anonymous + authenticated): read published templates only
-- (sellers browse the marketplace without needing to be logged in)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'templates'
      and policyname = 'templates_public_read_published'
  ) then
    create policy templates_public_read_published
      on templates for select
      using (status = 'published');
  end if;
end $$;

-- Admins: full write access (INSERT / UPDATE / DELETE)
-- Relies on the existing is_admin() helper that checks user_roles.role = 'admin'
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'templates'
      and policyname = 'templates_admin_write'
  ) then
    create policy templates_admin_write
      on templates for all
      using     (is_admin())
      with check (is_admin());
  end if;
end $$;
