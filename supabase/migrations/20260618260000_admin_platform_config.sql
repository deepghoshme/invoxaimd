-- ============================================================================
-- invoxai.io — Platform config columns for admin branding, settings, maintenance
-- ----------------------------------------------------------------------------
-- Adds non-secret platform configuration columns to the singleton
-- platform_settings row. All columns are public-readable (same as the table)
-- and admin-writable via the existing RLS policies.
--
-- SECURITY: None of these columns store secrets (no API keys, tokens, or
-- credentials). The public-read policy on platform_settings is intentional
-- and safe for this data. Secrets live in platform_gateways (admin-only).
-- ============================================================================

-- Branding columns ----------------------------------------------------------
alter table public.platform_settings
  add column if not exists platform_name   text,
  add column if not exists logo_url        text,
  add column if not exists favicon_url     text,
  add column if not exists invoice_footer  text;

comment on column public.platform_settings.platform_name  is 'Display name of the platform, used in emails and admin headings.';
comment on column public.platform_settings.logo_url       is 'Public URL of the platform logo image (stored in media bucket).';
comment on column public.platform_settings.favicon_url    is 'Public URL of the platform favicon (stored in media bucket).';
comment on column public.platform_settings.invoice_footer is 'Footer text appended to all seller invoice PDFs.';

-- Settings columns ----------------------------------------------------------
alter table public.platform_settings
  add column if not exists support_email   text;

comment on column public.platform_settings.support_email  is 'Platform support email shown in seller-facing help pages and automated emails.';

-- Maintenance / controls columns --------------------------------------------
alter table public.platform_settings
  add column if not exists allow_signups   boolean not null default true,
  add column if not exists force_https     boolean not null default true;

comment on column public.platform_settings.allow_signups is 'When false, new seller registrations are blocked at the onboarding route.';
comment on column public.platform_settings.force_https   is 'Records HTTPS intent. Caddy enforces TLS at the infrastructure level; this flag is read by middleware to decide redirect behaviour.';
