-- ============================================================================
-- invoxai.io — Platform PAN and contact phone for tax invoices
-- ----------------------------------------------------------------------------
-- Adds two columns to the singleton public.platform_settings table:
--
--   pan           text  — Platform operator PAN (Permanent Account Number),
--                         printed on tax invoices.
--   contact_phone text  — Platform contact phone number printed on
--                         invoices/bills.
--
-- Contact email is already covered by the existing support_email column; no
-- duplicate column is added.
--
-- RLS: No new policies are needed. The existing row-wide policies cover all
-- columns:
--   platform_settings_public_read  — SELECT for all (public renderer + editors)
--   platform_settings_admin_write  — INSERT/UPDATE/DELETE for admins only
-- The admin branding server action uses a Supabase admin/service client that
-- satisfies public.is_admin(), so writes to the new columns are unblocked.
--
-- No money/numeric columns are introduced here.
-- ============================================================================

-- ============================================================================
-- 1. ADD COLUMNS
-- ============================================================================

alter table public.platform_settings
  add column if not exists pan           text,
  add column if not exists contact_phone text;

comment on column public.platform_settings.pan
  is 'Platform operator PAN number, printed on tax invoices.';

comment on column public.platform_settings.contact_phone
  is 'Platform contact phone number printed on invoices/bills.';

-- ============================================================================
-- 2. GUARDED CHECK CONSTRAINT — PAN format
-- Uses a DO block + pg_constraint existence check so re-runs are safe.
-- ALTER TABLE ADD CONSTRAINT has no IF NOT EXISTS before PostgreSQL 17.
-- Pattern mirrors the stores_gstin_format guard in 20260619180000_invoices_gst_profile.sql.
--
-- Indian PAN shape: 5 uppercase letters, 4 digits, 1 uppercase letter.
-- Examples: ABCDE1234F, AAAPL1234C
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.platform_settings'::regclass
      and conname  = 'platform_settings_pan_format'
  ) then
    alter table public.platform_settings
      add constraint platform_settings_pan_format
        check (
          pan is null
          or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'
        );
  end if;
end;
$$;

-- ============================================================================
-- PostgREST schema cache reload
-- ============================================================================

notify pgrst, 'reload schema';
