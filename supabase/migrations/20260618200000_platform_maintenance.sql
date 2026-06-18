-- ============================================================================
-- invoxai.io — Add maintenance_mode to platform_settings
-- ----------------------------------------------------------------------------
-- Adds maintenance_mode (bool, default false) and maintenance_eta (text,
-- optional) to the singleton platform_settings row.
-- The public marketing landing (/) checks this flag; if true, it renders
-- the MaintenancePage component instead of the normal homepage.
-- ============================================================================

alter table public.platform_settings
  add column if not exists maintenance_mode boolean not null default false,
  add column if not exists maintenance_eta  text;

comment on column public.platform_settings.maintenance_mode is
  'When true the platform is in maintenance mode; the public landing shows the maintenance page.';
comment on column public.platform_settings.maintenance_eta is
  'Human-readable ETA string displayed on the maintenance page, e.g. "2:30 PM IST".';
