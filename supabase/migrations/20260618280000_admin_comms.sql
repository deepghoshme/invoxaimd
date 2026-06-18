-- ============================================================================
-- invoxai.io — Admin communications config + domain pricing columns
-- ----------------------------------------------------------------------------
-- 1. email_config  — singleton, admin-only, SMTP/Gmail credentials (secrets)
-- 2. ALTER platform_settings — add extra_subdomain_paise + extra_domain_paise
--    (non-secret pricing values, public-readable like the rest of platform_settings)
--
-- SECURITY NOTE: email_config must NEVER have a public-read policy.
-- smtp_pass and gmail_app_password are live email credentials. Exposing them
-- would allow anyone to send mail via the platform account.
-- This is intentionally separate from platform_settings (which is public-read).
--
-- Apply with:
--   node scripts/db-apply.mjs supabase/migrations/20260618280000_admin_comms.sql
-- Then reload PostgREST schema cache.
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. email_config (singleton, admin-only)
-- ──────────────────────────────────────────────────────────────────────────────

create table if not exists public.email_config (
  -- Singleton: boolean PK pinned to true means only one row can ever exist.
  id                       boolean primary key default true,

  -- Which sending method is active: 'gmail' | 'smtp'
  method                   text    not null default 'smtp'
                             check (method in ('gmail', 'smtp')),

  -- Shared display field
  from_name                text    not null default 'invoxai',

  -- Gmail App Password path
  gmail_user               text,
  gmail_app_password       text,   -- SECRET — never returned to browser

  -- Custom SMTP path
  smtp_host                text,
  smtp_port                integer,
  smtp_user                text,
  smtp_pass                text,   -- SECRET — never returned to browser

  -- Automated email toggles
  otp_enabled              boolean not null default true,
  welcome_enabled          boolean not null default true,
  daily_wallet_enabled     boolean not null default false,
  weekly_report_enabled    boolean not null default false,

  updated_at               timestamptz not null default now(),

  constraint email_config_singleton check (id)
);

comment on table  public.email_config is
  'Singleton row holding platform email-sending credentials. '
  'Admin-only: smtp_pass and gmail_app_password must never be publicly readable.';
comment on column public.email_config.smtp_pass is
  'SMTP password — never exposed to the browser. Client sees has_smtp_pass: boolean.';
comment on column public.email_config.gmail_app_password is
  'Gmail App Password — never exposed to the browser. Client sees has_gmail_pass: boolean.';

-- Seed the singleton row (idempotent).
insert into public.email_config (id)
values (true)
on conflict (id) do nothing;

-- updated_at trigger -----------------------------------------------------------
drop trigger if exists email_config_set_updated_at on public.email_config;
create trigger email_config_set_updated_at
  before update on public.email_config
  for each row execute function public.set_updated_at();

-- RLS --------------------------------------------------------------------------
alter table public.email_config enable row level security;

-- Admin-only SELECT: no public-read policy — see security note above.
drop policy if exists email_config_admin_select on public.email_config;
create policy email_config_admin_select on public.email_config
  for select using (public.is_admin());

-- Admin-only INSERT / UPDATE / DELETE.
drop policy if exists email_config_admin_write on public.email_config;
create policy email_config_admin_write on public.email_config
  for all using (public.is_admin()) with check (public.is_admin());

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. platform_settings — domain pricing columns
--    (non-secret, readable via existing public-read policy)
-- ──────────────────────────────────────────────────────────────────────────────

alter table public.platform_settings
  add column if not exists extra_subdomain_paise integer not null default 4900,
  add column if not exists extra_domain_paise    integer not null default 19900;

comment on column public.platform_settings.extra_subdomain_paise is
  'Price in paise (1/100 INR) for an extra subdomain beyond the plan allowance. Default ₹49.';
comment on column public.platform_settings.extra_domain_paise is
  'Price in paise (1/100 INR) for an extra custom domain beyond the plan allowance. Default ₹199.';

-- admin SELECT already covers new columns via the existing admin policy on custom_domains
-- but platform_settings uses a public-read policy, so admins can also read pricing.
