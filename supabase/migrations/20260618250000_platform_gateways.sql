-- ============================================================================
-- invoxai.io — Platform gateways (singleton, admin-only)
-- ----------------------------------------------------------------------------
-- Stores the platform-level payment gateway credentials used to charge sellers
-- for plans, wallet recharge, and add-ons.
--
-- SECURITY NOTE: This table must NEVER have a public-read policy.
-- The key_secret column holds a live payment gateway credential. Exposing it
-- would allow anyone to forge signed requests against the platform account.
-- Only rows authenticated as is_admin() may read OR write.
--
-- This is intentionally separate from platform_settings, which carries a
-- public-read RLS policy (needed for cosmetic flags like show_brand_badge).
-- ============================================================================

create table if not exists public.platform_gateways (
  -- Singleton: boolean PK pinned to true means only one row can ever exist.
  id         boolean primary key default true,
  provider   text    not null default 'razorpay',
  key_id     text,
  key_secret text,
  mode       text    not null default 'test'
               check (mode in ('test', 'live')),
  is_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint platform_gateways_singleton check (id)
);

comment on table  public.platform_gateways is
  'Singleton row holding the platform-level payment gateway credentials. '
  'Admin-only: key_secret must never be publicly readable.';
comment on column public.platform_gateways.key_secret is
  'Gateway API secret — never exposed to the browser. Presence is signalled via has_secret: boolean.';
comment on column public.platform_gateways.mode is
  'test = Razorpay test mode; live = Razorpay live mode.';

-- Seed the singleton row (idempotent).
insert into public.platform_gateways (id)
values (true)
on conflict (id) do nothing;

-- updated_at trigger -----------------------------------------------------------
drop trigger if exists platform_gateways_set_updated_at on public.platform_gateways;
create trigger platform_gateways_set_updated_at
  before update on public.platform_gateways
  for each row execute function public.set_updated_at();

-- RLS --------------------------------------------------------------------------
alter table public.platform_gateways enable row level security;

-- Admin-only SELECT: only is_admin() may read the row (key_secret included).
-- There is deliberately NO public-read policy — see security note above.
drop policy if exists platform_gateways_admin_select on public.platform_gateways;
create policy platform_gateways_admin_select on public.platform_gateways
  for select using (public.is_admin());

-- Admin-only INSERT / UPDATE / DELETE.
drop policy if exists platform_gateways_admin_write on public.platform_gateways;
create policy platform_gateways_admin_write on public.platform_gateways
  for all using (public.is_admin()) with check (public.is_admin());
