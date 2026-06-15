-- ============================================================================
-- invoxai.io — Foundation migration 2/4: Business categories & reserved names
-- ----------------------------------------------------------------------------
-- business_categories carries the per-category commission rate (revenue
-- stream #2). reserved_subdomains blocks sellers from claiming system names.
-- ============================================================================

create table if not exists public.business_categories (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  slug            text not null unique,
  -- Commission charged on each sale in this category, as a fraction (0.05 = 5%).
  commission_rate numeric(5,4) not null default 0.0500 check (commission_rate >= 0 and commission_rate <= 1),
  is_active       boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on column public.business_categories.commission_rate is 'Per-sale platform commission as a fraction (0.05 = 5%). Admin-editable.';

drop trigger if exists business_categories_set_updated_at on public.business_categories;
create trigger business_categories_set_updated_at
  before update on public.business_categories
  for each row execute function public.set_updated_at();

create table if not exists public.reserved_subdomains (
  name       text primary key,
  reason     text,
  created_at timestamptz not null default now()
);

-- Seed reserved system subdomains (idempotent) ------------------------------
insert into public.reserved_subdomains (name, reason) values
  ('app', 'seller dashboard'), ('admin', 'admin panel'), ('www', 'apex redirect'),
  ('api', 'system'), ('mail', 'system'), ('smtp', 'system'), ('imap', 'system'),
  ('ftp', 'system'), ('cdn', 'system'), ('assets', 'system'), ('static', 'system'),
  ('blog', 'reserved'), ('help', 'reserved'), ('support', 'reserved'),
  ('status', 'reserved'), ('docs', 'reserved'), ('dev', 'reserved'),
  ('staging', 'reserved'), ('test', 'reserved'), ('ns1', 'dns'), ('ns2', 'dns'),
  ('billing', 'reserved'), ('pay', 'reserved'), ('checkout', 'reserved'),
  ('dashboard', 'reserved'), ('account', 'reserved'), ('auth', 'reserved'),
  ('webhook', 'reserved'), ('webhooks', 'reserved'), ('invoxai', 'brand'),
  ('invox', 'brand'), ('root', 'system'), ('me', 'reserved'), ('go', 'reserved')
on conflict (name) do nothing;

-- Seed default business categories (admin can edit rates later) ---------------
insert into public.business_categories (name, slug, commission_rate, sort_order) values
  ('Digital Products',     'digital-products',     0.0500, 10),
  ('Online Courses',       'online-courses',       0.0500, 20),
  ('Coaching & Consulting','coaching-consulting',  0.0700, 30),
  ('Events & Ticketing',   'events-ticketing',     0.0400, 40),
  ('Services',             'services',             0.0600, 50),
  ('Physical Goods',       'physical-goods',       0.0300, 60),
  ('Memberships & Community','memberships-community',0.0700, 70),
  ('Other',                'other',                0.0500, 99)
on conflict (slug) do nothing;

-- Subdomain availability check ----------------------------------------------
-- SECURITY DEFINER so the public onboarding form can call it WITHOUT exposing
-- the stores table via RLS. Returns true only if the name is free + valid.
-- Note: stores is created in migration 3; this function resolves its table
-- reference at call time, so define-order is fine.
create or replace function public.is_subdomain_available(_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n text := lower(trim(_name));
begin
  -- Format: 3-63 chars, lowercase alphanumeric + hyphen, not hyphen-bounded.
  if n is null or n !~ '^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])$' then
    return false;
  end if;
  if exists (select 1 from public.reserved_subdomains where name = n) then
    return false;
  end if;
  if exists (select 1 from public.stores where subdomain = n) then
    return false;
  end if;
  return true;
end;
$$;

-- RLS -----------------------------------------------------------------------
alter table public.business_categories enable row level security;
alter table public.reserved_subdomains enable row level security;

-- Categories are public read (needed by onboarding + public pages).
drop policy if exists categories_public_read on public.business_categories;
create policy categories_public_read on public.business_categories
  for select using (true);

drop policy if exists categories_admin_write on public.business_categories;
create policy categories_admin_write on public.business_categories
  for all using (public.is_admin()) with check (public.is_admin());

-- Reserved names: admin-only direct access. The public uses the function above.
drop policy if exists reserved_admin_all on public.reserved_subdomains;
create policy reserved_admin_all on public.reserved_subdomains
  for all using (public.is_admin()) with check (public.is_admin());
