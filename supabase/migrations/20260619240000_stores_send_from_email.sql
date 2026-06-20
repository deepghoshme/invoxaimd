-- ============================================================================
-- Add send_from_email column to public.stores
-- ----------------------------------------------------------------------------
-- Admins can configure a seller's custom "send-from" address. This is the
-- From: address used for that seller's transactional/marketing mail when their
-- domain SMTP/DKIM is configured. The platform alias remains the fallback.
--
-- IMPORTANT: storing this address does NOT guarantee deliverability as that
-- address. The seller must configure DKIM/SPF for their domain and wire their
-- SMTP credentials. Until that is done the platform falls back to its own alias.
--
-- Apply with: node scripts/db-apply.mjs supabase/migrations/20260619240000_stores_send_from_email.sql
-- ============================================================================

-- 1. Add column (idempotent)
alter table public.stores
  add column if not exists send_from_email text;

-- 2. Add CHECK constraint for email format (guarded: skip if already exists)
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stores_send_from_email_format'
      and conrelid = 'public.stores'::regclass
  ) then
    alter table public.stores
      add constraint stores_send_from_email_format
        check (
          send_from_email is null
          or send_from_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
        );
  end if;
end $$;

-- 3. Column comment
comment on column public.stores.send_from_email is
  'Admin-managed custom send-from address for this seller''s transactional/marketing mail. '
  'Null = use platform default alias. Deliverability as this address requires seller-side '
  'DKIM/SPF and SMTP configuration — code falls back to platform alias until that is done.';

-- 4. Notify PostgREST to reload schema
notify pgrst, 'reload schema';
