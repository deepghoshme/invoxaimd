-- ============================================================================
-- Seller billing/mail customization
-- ----------------------------------------------------------------------------
-- 1. Seller invoice/billing PDF branding fields on public.stores:
--      - invoice_business_name : business name printed as the SELLER party on
--                                that store's invoices (falls back to
--                                legal_name / billing.business_name).
--      - invoice_accent_color  : hex accent colour for the seller's invoice PDF
--                                (the gradient bar / section accents).
--      - invoice_footer        : per-seller footer note on the invoice PDF.
--    (logo_url, legal_name, gstin, billing address already exist and are reused.)
--
-- 2. Allow invoices.kind = 'custom' for seller-created manual bills.
--
-- Idempotent. Apply with:
--   node scripts/db-apply.mjs supabase/migrations/20260620120000_seller_billing_branding_and_custom_invoice.sql
-- ============================================================================

-- 1. Seller invoice-branding columns -----------------------------------------
alter table public.stores
  add column if not exists invoice_business_name text;
alter table public.stores
  add column if not exists invoice_accent_color text;
alter table public.stores
  add column if not exists invoice_footer text;

-- Hex colour format guard (e.g. #ff6a3d or #fff) — null allowed.
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stores_invoice_accent_color_format'
      and conrelid = 'public.stores'::regclass
  ) then
    alter table public.stores
      add constraint stores_invoice_accent_color_format
        check (
          invoice_accent_color is null
          or invoice_accent_color ~* '^#[0-9a-f]{3}([0-9a-f]{3})?$'
        );
  end if;
end $$;

comment on column public.stores.invoice_business_name is
  'Seller-set business name printed as the SELLER party on this store''s invoice PDFs. '
  'Null = fall back to legal_name / billing.business_name.';
comment on column public.stores.invoice_accent_color is
  'Seller-set hex accent colour for this store''s invoice PDF (gradient bar / accents). Null = platform default sunset gradient.';
comment on column public.stores.invoice_footer is
  'Seller-set footer note printed at the bottom of this store''s invoice PDFs. Null = platform default footer.';

-- 2. Allow kind='custom' on invoices -----------------------------------------
-- Drop the old kind CHECK (if present) and recreate it including 'custom'.
do $$ begin
  if exists (
    select 1 from pg_constraint
    where conname = 'invoices_kind_check'
      and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices drop constraint invoices_kind_check;
  end if;
end $$;

alter table public.invoices
  add constraint invoices_kind_check
    check (kind = any (array['order'::text, 'plan'::text, 'wallet'::text, 'custom'::text]));

-- 3. Notify PostgREST to reload schema
notify pgrst, 'reload schema';
