-- ============================================================================
-- invoxai.io — Coupons (per-store discount codes)
-- ----------------------------------------------------------------------------
-- Each store can create coupon codes that are validated server-side at
-- checkout. The checkout route fetches the coupon via the service-role client,
-- checks validity (active, not expired, min order met, under max_uses), and
-- computes the discount server-side — the client NEVER controls the amount.
--
-- RLS:
--   • store owner (owns_store) can SELECT, INSERT, UPDATE, DELETE own coupons
--   • is_admin() can SELECT all
--   • any authenticated user (or the service-role client) can SELECT active
--     codes for server-side validation at checkout
--   • all writes are owner-only (service-role bypasses for used_count bump)
--
-- Idempotent: uses CREATE TABLE IF NOT EXISTS + IF NOT EXISTS column adds.
-- Apply via: node scripts/db-apply.mjs supabase/migrations/20260618330000_coupons.sql
-- ============================================================================

create table if not exists public.coupons (
  id               uuid        primary key default gen_random_uuid(),
  store_id         uuid        not null references public.stores (id) on delete cascade,

  -- The discount code itself (stored uppercase, unique per store).
  code             text        not null,

  -- 'percent' = percentage off; 'flat' = fixed paise off.
  discount_type    text        not null default 'percent'
                                 check (discount_type in ('percent', 'flat')),

  -- For 'percent': 1–100. For 'flat': paise (e.g. 10000 = ₹100).
  discount_value   integer     not null check (discount_value > 0),

  -- Minimum cart value (paise) required for the code to be valid.
  min_order_paise  integer     not null default 0 check (min_order_paise >= 0),

  -- NULL = unlimited. Once used_count >= max_uses the code is rejected.
  max_uses         integer     null check (max_uses is null or max_uses > 0),

  -- Incremented by the service-role client on each successful paid order.
  used_count       integer     not null default 0 check (used_count >= 0),

  -- Scope for display/future filtering; not enforced server-side in Phase 1.
  applies_to       text        not null default 'all',

  -- NULL = never expires.
  expires_at       timestamptz null,

  is_active        boolean     not null default true,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- A store cannot have two coupons with the same code (case-insensitive
  -- comparison is handled in the application layer by uppercasing on insert).
  unique (store_id, code)
);

comment on table  public.coupons                      is 'Per-store discount codes validated server-side at checkout. Amounts always recomputed on the server — client cannot override discount.';
comment on column public.coupons.discount_value       is 'percent: integer 1–100. flat: paise (e.g. 10000 = ₹100).';
comment on column public.coupons.min_order_paise      is 'Cart must be >= this value (paise) before the code is accepted.';
comment on column public.coupons.max_uses             is 'NULL = unlimited. Enforced server-side against used_count.';
comment on column public.coupons.used_count           is 'Incremented by service-role on each successfully paid order.';

create index if not exists coupons_store_idx       on public.coupons (store_id);
create index if not exists coupons_store_code_idx  on public.coupons (store_id, code);
create index if not exists coupons_active_idx      on public.coupons (store_id, is_active) where is_active = true;

drop trigger if exists coupons_set_updated_at on public.coupons;
create trigger coupons_set_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();

-- ── coupon_code column on orders (idempotent) ─────────────────────────────────
-- Records which coupon code (if any) was applied to each order. Stored as plain
-- text (snapshot) so historical orders stay correct even if the coupon is later
-- deleted. discount_paise is the paise saved; original_amount_paise is the
-- full price before discount (both for audit/reporting).

alter table public.orders
  add column if not exists coupon_code            text    null,
  add column if not exists discount_paise         integer null check (discount_paise is null or discount_paise >= 0),
  add column if not exists original_amount_paise  integer null check (original_amount_paise is null or original_amount_paise >= 0),
  add column if not exists product_id             uuid    null;

comment on column public.orders.coupon_code            is 'Snapshot of the coupon code applied at checkout (null if none).';
comment on column public.orders.discount_paise         is 'Paise discounted from original_amount_paise. amount = original_amount_paise - discount_paise.';
comment on column public.orders.original_amount_paise  is 'Full price before coupon; equals amount when no coupon applied.';

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.coupons enable row level security;

-- Store owner has full CRUD on their own coupons.
drop policy if exists coupons_owner_all on public.coupons;
create policy coupons_owner_all on public.coupons
  for all
  using  (public.owns_store(store_id) or public.is_admin())
  with check (public.owns_store(store_id) or public.is_admin());

-- Any authenticated user can SELECT active coupons (needed for server-side
-- validation inside API routes that run under the user's session). The
-- service-role client also bypasses RLS entirely.
drop policy if exists coupons_auth_read_active on public.coupons;
create policy coupons_auth_read_active on public.coupons
  for select
  using (is_active = true and auth.role() = 'authenticated');

notify pgrst, 'reload schema';
