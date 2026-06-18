-- ============================================================================
-- invoxai.io — Platform settings (singleton)
-- ----------------------------------------------------------------------------
-- One global row of admin-controlled platform switches. First switch:
-- show_brand_badge — the global on/off for the "Built with InvoxAI" pill shown
-- on public seller pages. Public-readable (the page renderer needs it),
-- admin-writable only.
-- ============================================================================

create table if not exists public.platform_settings (
  -- Singleton: the check constraint pins id=true so only one row can ever exist.
  id               boolean primary key default true,
  show_brand_badge boolean not null default true,
  updated_at       timestamptz not null default now(),
  constraint platform_settings_singleton check (id)
);
comment on column public.platform_settings.show_brand_badge is 'Global on/off for the "Built with InvoxAI" badge on public seller pages.';

-- Seed the single row (idempotent).
insert into public.platform_settings (id) values (true)
on conflict (id) do nothing;

drop trigger if exists platform_settings_set_updated_at on public.platform_settings;
create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

-- RLS -----------------------------------------------------------------------
alter table public.platform_settings enable row level security;

-- Public read: a non-sensitive cosmetic flag the renderer + editor preview read.
drop policy if exists platform_settings_public_read on public.platform_settings;
create policy platform_settings_public_read on public.platform_settings
  for select using (true);

-- Only admins can flip switches.
drop policy if exists platform_settings_admin_write on public.platform_settings;
create policy platform_settings_admin_write on public.platform_settings
  for all using (public.is_admin()) with check (public.is_admin());
