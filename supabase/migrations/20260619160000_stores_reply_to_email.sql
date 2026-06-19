-- ============================================================================
-- Add reply_to_email column to public.stores
-- ----------------------------------------------------------------------------
-- Sellers can set their own reply-to address for transactional mail.
-- Platform aliases remain the From; this is set as Reply-To so buyer replies
-- reach the seller directly. Null = use platform default.
-- ============================================================================

-- 1. Add column (idempotent)
alter table public.stores
  add column if not exists reply_to_email text;

-- 2. Add CHECK constraint (guarded: skip if already exists)
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stores_reply_to_email_format'
      and conrelid = 'public.stores'::regclass
  ) then
    alter table public.stores
      add constraint stores_reply_to_email_format
        check (
          reply_to_email is null
          or reply_to_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
        );
  end if;
end $$;

-- 3. Column comment
comment on column public.stores.reply_to_email is
  'Seller-set reply-to address for transactional mail. Platform aliases remain the From; this is set as Reply-To so a buyer reply reaches the seller. Null = use platform default.';

-- 4. Notify PostgREST to reload schema
notify pgrst, 'reload schema';
