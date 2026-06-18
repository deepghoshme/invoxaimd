-- ============================================================================
-- invoxai.io — Orders & seller payment gateways (Phase 1: one-page product)
-- ----------------------------------------------------------------------------
-- Seller payments layer (kept separate from platform billing): the seller
-- connects their OWN Razorpay keys; our checkout creates a Razorpay order with
-- those keys, records the order here, and fires pixels. Commission is snapshot
-- on the order now; the wallet deduction + daily invoice come in Phase 2.
-- ============================================================================

-- Per-store connected gateway (seller receives buyer payments via own account).
create table if not exists public.payment_gateways (
  store_id    uuid primary key references public.stores (id) on delete cascade,
  provider    text not null default 'razorpay',
  key_id      text,            -- Razorpay key_id (publishable; sent to checkout)
  key_secret  text,            -- Razorpay key_secret (server-only; TODO encrypt — Phase 2 security)
  is_enabled  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on column public.payment_gateways.key_secret is 'Razorpay secret — server-only, never sent to a client. TODO: encrypt at rest (pgcrypto) in Phase 2.';

drop trigger if exists payment_gateways_set_updated_at on public.payment_gateways;
create trigger payment_gateways_set_updated_at
  before update on public.payment_gateways
  for each row execute function public.set_updated_at();

-- Orders — one row per checkout attempt. Created/updated server-side with the
-- service role (public guest checkout has no session), so no public RLS write.
create table if not exists public.orders (
  id                 uuid primary key default gen_random_uuid(),
  store_id           uuid not null references public.stores (id) on delete cascade,
  page_id            uuid references public.pages (id) on delete set null,
  page_type          public.page_type not null,

  -- Buyer (guest checkout in Phase 1; links to buyer account by email later).
  buyer_email        text,
  buyer_name         text,
  buyer_phone        text,

  -- Product snapshot at order time (price can change later on the page).
  product_title      text,
  amount             integer not null check (amount >= 0),   -- smallest unit (paise)
  currency           text not null default 'INR',

  -- Gateway
  gateway            text not null default 'razorpay',
  gateway_order_id   text,
  gateway_payment_id text,
  gateway_signature  text,
  status             text not null default 'created'         -- created | paid | failed
                       check (status in ('created', 'paid', 'failed')),

  -- Commission snapshot (deduction from wallet is Phase 2).
  commission_rate    numeric(5,4),
  commission_amount  integer,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  paid_at            timestamptz
);
comment on column public.orders.amount is 'Order amount in the currency''s smallest unit (paise for INR).';

create index if not exists orders_store_idx    on public.orders (store_id, created_at desc);
create index if not exists orders_gateway_idx  on public.orders (gateway_order_id) where gateway_order_id is not null;
create index if not exists orders_buyer_idx    on public.orders (buyer_email) where buyer_email is not null;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- RLS -----------------------------------------------------------------------
alter table public.payment_gateways enable row level security;
alter table public.orders            enable row level security;

-- Gateways: only the owning seller (or admin) manages. Service role (checkout)
-- bypasses RLS to read the secret server-side.
drop policy if exists gateways_owner_all on public.payment_gateways;
create policy gateways_owner_all on public.payment_gateways
  for all
  using (public.owns_store(store_id) or public.is_admin())
  with check (public.owns_store(store_id) or public.is_admin());

-- Orders: seller/admin can READ their store's orders (dashboard history).
-- Inserts/updates are done with the service role during checkout.
drop policy if exists orders_owner_read on public.orders;
create policy orders_owner_read on public.orders
  for select
  using (public.owns_store(store_id) or public.is_admin());

-- Make PostgREST pick up the new tables immediately (avoids "table not found
-- in schema cache" on the first call right after applying this migration).
notify pgrst, 'reload schema';
