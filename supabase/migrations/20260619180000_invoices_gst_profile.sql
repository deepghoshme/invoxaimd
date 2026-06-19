-- ============================================================================
-- invoxai.io — Invoices, GST profile & seller identity columns
-- ----------------------------------------------------------------------------
-- 1. public.invoices         — per-order (and per-plan/wallet) tax invoices
-- 2. public.invoice_seq      — global sequential invoice numbering
-- 3. public.next_invoice_number() — helper that formats INV-YYYY-NNNNNN
-- 4. platform_settings GST  — platform-level GSTIN + default tax rate
-- 5. stores seller profile   — logo, currency, timezone, social, GSTIN, etc.
-- ============================================================================

-- ============================================================================
-- 1. INVOICE NUMBER SEQUENCE + HELPER FUNCTION
-- ============================================================================

create sequence if not exists public.invoice_seq start 1;

comment on sequence public.invoice_seq is
  'Global monotonic counter for invoice numbers. Never reset; gaps are acceptable.';

create or replace function public.next_invoice_number()
returns text
language sql
security definer
set search_path = public
as $$
  select 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text, 6, '0');
$$;

comment on function public.next_invoice_number() is
  'Returns the next formatted invoice number, e.g. INV-2026-000001. Consumes one value from invoice_seq.';

-- Grant execute to authenticated and service_role so the app can call it.
grant execute on function public.next_invoice_number() to authenticated;
grant execute on function public.next_invoice_number() to service_role;

-- ============================================================================
-- 2. INVOICES TABLE
-- ============================================================================

create table if not exists public.invoices (
  id               uuid        primary key default gen_random_uuid(),
  store_id         uuid        not null references public.stores(id) on delete cascade,
  order_id         uuid        references public.orders(id) on delete set null,

  -- Human-readable invoice number, app-generated via next_invoice_number().
  invoice_number   text        not null,

  -- Buyer snapshot (captured at issue time so it survives account changes).
  buyer_name       text,
  buyer_email      text,

  -- Currency (ISO 4217).
  currency         text        not null default 'INR',

  -- Money — ALL values in the currency's smallest unit (paise for INR).
  -- These are server-set only via service_role; no client insert/update policy.
  subtotal_paise   bigint      not null default 0,  -- taxable value before GST
  tax_rate         numeric(5,2) not null default 0, -- e.g. 18.00 = 18%
  cgst_paise       bigint      not null default 0,  -- Central GST (intra-state)
  sgst_paise       bigint      not null default 0,  -- State GST  (intra-state)
  igst_paise       bigint      not null default 0,  -- Integrated GST (inter-state)
  total_paise      bigint      not null default 0,  -- subtotal + cgst + sgst + igst

  -- Seller identity snapshot (captured from stores row at issue time).
  gstin            text,                            -- seller GSTIN at invoice time
  seller_legal_name text,                           -- seller legal name snapshot
  seller_address   text,                            -- seller registered address snapshot

  -- Invoice kind: ties into the billing source.
  kind             text        not null default 'order'
                     check (kind in ('order', 'plan', 'wallet')),

  -- Arbitrary extra data (line items, notes, etc.).
  meta             jsonb       not null default '{}'::jsonb,

  created_at       timestamptz not null default now(),

  -- One invoice number per store (store-scoped sequential numbering is also valid;
  -- the app may choose to prefix with store slug in the number itself).
  unique (store_id, invoice_number)
);

comment on table  public.invoices                is 'Tax invoices issued per order, plan payment, or wallet top-up.';
comment on column public.invoices.subtotal_paise is 'Taxable value in paise (smallest currency unit). Server-set; never accepted from client.';
comment on column public.invoices.tax_rate       is 'GST rate applied (e.g. 18.00). Snapshot at issue time.';
comment on column public.invoices.cgst_paise     is 'Central GST portion in paise (intra-state transactions).';
comment on column public.invoices.sgst_paise     is 'State GST portion in paise (intra-state transactions).';
comment on column public.invoices.igst_paise     is 'Integrated GST in paise (inter-state transactions; cgst+sgst=0 when igst>0).';
comment on column public.invoices.total_paise    is 'Invoice total in paise. Equals subtotal + cgst + sgst + igst.';
comment on column public.invoices.gstin          is 'Seller GSTIN snapshotted at invoice issue time.';
comment on column public.invoices.kind           is 'order = product sale; plan = subscription; wallet = wallet top-up.';
comment on column public.invoices.meta           is 'Arbitrary invoice metadata: line items, notes, PDF URL, etc.';

-- Indexes for the two common query patterns.
create index if not exists invoices_store_created_idx on public.invoices (store_id, created_at desc);
create index if not exists invoices_order_idx         on public.invoices (order_id) where order_id is not null;

-- ============================================================================
-- 2a. RLS — invoices
-- ============================================================================

alter table public.invoices enable row level security;

-- Sellers (and admins) can READ their own store's invoices.
-- Mirror of orders_owner_read in 20260616130000_orders_gateways.sql.
drop policy if exists invoices_owner_read on public.invoices;
create policy invoices_owner_read on public.invoices
  for select
  using (public.owns_store(store_id) or public.is_admin());

-- NO authenticated insert/update policy — inserts and updates are performed
-- exclusively by the service role (server-side billing logic). The service role
-- bypasses RLS, so no write policy is required or desired here.

-- ============================================================================
-- 3. PLATFORM GST IDENTITY on platform_settings (singleton)
-- ============================================================================

alter table public.platform_settings
  add column if not exists gstin               text,
  add column if not exists legal_name          text,
  add column if not exists registered_address  text,
  add column if not exists default_tax_rate    numeric(5,2) not null default 0;

comment on column public.platform_settings.gstin              is 'Platform operator GSTIN. Required for valid tax invoices on plan/wallet charges.';
comment on column public.platform_settings.legal_name         is 'Platform operator legal entity name, printed on plan/wallet invoices.';
comment on column public.platform_settings.registered_address is 'Platform operator registered address for invoice compliance.';
comment on column public.platform_settings.default_tax_rate   is 'Default GST rate (%) applied when a store has no per-store rate set. E.g. 18.00 for 18%.';

-- ============================================================================
-- 4. SELLER PROFILE COLUMNS on public.stores
-- ============================================================================

alter table public.stores
  add column if not exists logo_url      text,
  add column if not exists currency      text not null default 'INR',
  add column if not exists timezone      text,
  add column if not exists support_email text,
  add column if not exists social_links  jsonb not null default '{}'::jsonb,
  add column if not exists gstin         text,
  add column if not exists gst_rate      numeric(5,2),
  add column if not exists legal_name    text;

comment on column public.stores.logo_url      is 'Public URL of the store logo (stored in media bucket). Used on invoices and storefront header.';
comment on column public.stores.currency      is 'ISO 4217 currency code for this store (default INR). Used for display and invoice generation.';
comment on column public.stores.timezone      is 'IANA timezone of the seller, e.g. Asia/Kolkata. Used for date display in the dashboard.';
comment on column public.stores.support_email is 'Store-level support email shown to buyers. Must be a valid email address.';
comment on column public.stores.social_links  is 'JSON map of social handle keys to URLs, e.g. {"instagram":"https://...","twitter":"https://..."}.';
comment on column public.stores.gstin         is 'Seller GSTIN (15-char). Required for B2B tax invoices. Snapshot-copied to invoices at issue time.';
comment on column public.stores.gst_rate      is 'Per-store GST rate override (%). When null, platform default_tax_rate applies.';
comment on column public.stores.legal_name    is 'Seller legal entity name for invoice header. Falls back to store_name when null.';

-- ============================================================================
-- 4a. Guarded CHECK constraint: stores.gstin must match GSTIN format or be NULL
-- Uses a DO block that checks pg_constraint to avoid duplicate constraint errors
-- on re-runs (ALTER TABLE ADD CONSTRAINT is not IF NOT EXISTS before PG 17).
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.stores'::regclass
      and conname  = 'stores_gstin_format'
  ) then
    alter table public.stores
      add constraint stores_gstin_format
        check (
          gstin is null
          or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
        );
  end if;
end;
$$;

-- ============================================================================
-- 4b. Guarded CHECK constraint: stores.support_email basic format
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.stores'::regclass
      and conname  = 'stores_support_email_format'
  ) then
    alter table public.stores
      add constraint stores_support_email_format
        check (
          support_email is null
          or support_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
        );
  end if;
end;
$$;

-- ============================================================================
-- PostgREST schema cache reload
-- ============================================================================

notify pgrst, 'reload schema';
