-- ============================================================================
-- invoxai.io — Product & page reviews with purchase-gated buyer submit
-- ----------------------------------------------------------------------------
-- 1. SECURITY DEFINER helper: public.has_purchased(_page_id, _product_id)
--    Returns true when the calling authenticated user has a 'paid' order for
--    the given page or product (matched by buyer_id OR verified email).
--
-- 2. public.product_reviews — one review per order, star rating 1–5, optional
--    body text, seller reply, moderation status.
--
-- 3. RLS: four policies —
--    (a) buyer INSERT gated by has_purchased()
--    (b) public SELECT of approved + visible rows
--    (c) seller/admin SELECT of all own-store rows (incl. hidden/pending)
--    (d) seller/admin UPDATE (reply, hide, moderate)
--    No buyer UPDATE/DELETE for MVP — reviews are immutable once submitted.
--
-- IDEMPOTENT: CREATE … IF NOT EXISTS, DROP POLICY IF EXISTS before every
-- policy, CREATE OR REPLACE for the helper function.
--
-- Apply via: node scripts/db-apply.mjs supabase/migrations/20260619210000_product_reviews.sql
-- ============================================================================

-- ============================================================================
-- SECTION 0 — SECURITY DEFINER helper: has_purchased()
-- ----------------------------------------------------------------------------
-- WHY SECURITY DEFINER:
--   We need to read public.orders from inside an RLS policy. Calling a plain
--   SQL function would trigger the caller's own RLS on public.orders, which
--   could block the read for an unauthenticated-ish path. Declaring it
--   SECURITY DEFINER (owner = migration runner / postgres) bypasses that inner
--   RLS check and lets the function see all orders it needs to evaluate.
--   Pattern mirrors public.jwt_verified_email() in 20260619170000_buyer_side.
--
-- Returns true when EXISTS a 'paid' order in public.orders for the given
-- page_id or product_id that is attributable to the calling auth.uid() via:
--   Branch A — o.buyer_id = auth.uid()   (fast FK lookup, post-backfill)
--   Branch B — verified email match via jwt_verified_email()   (guest orders)
--
-- NULL safety:
--   • If both _page_id and _product_id are null → the product check arms are
--     false; function returns false (no false positive).
--   • jwt_verified_email() returns NULL for unverified/anon → lower(buyer_email)
--     = NULL is false (no leak).
-- ============================================================================

create or replace function public.has_purchased(
  _page_id    uuid,
  _product_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    where
      o.status = 'paid'
      and (
        (_product_id is not null and o.product_id = _product_id)
        or
        (_page_id    is not null and o.page_id    = _page_id)
      )
      and (
        -- Branch A: fast FK match (buyer has an auth account)
        o.buyer_id = auth.uid()
        or
        -- Branch B: guest order matched to a verified email
        (
          o.buyer_email is not null
          and public.jwt_verified_email() is not null
          and lower(o.buyer_email) = public.jwt_verified_email()
        )
      )
  );
$$;

comment on function public.has_purchased(uuid, uuid) is
  'Returns true when the calling authenticated user has a paid order for the '
  'given page_id (opp / course / event / booking page) or product_id (catalog '
  'product). Pass whichever identifier is relevant; the other may be NULL. '
  'Uses dual-branch buyer match: buyer_id FK (fast path) OR verified email '
  '(guest orders via jwt_verified_email()). SECURITY DEFINER so it can read '
  'public.orders without triggering the caller''s own RLS on that table. '
  'Grant execute to authenticated.';

grant execute on function public.has_purchased(uuid, uuid) to authenticated;

-- ============================================================================
-- SECTION 1 — Table: public.product_reviews
-- ============================================================================

create table if not exists public.product_reviews (
  id            uuid        primary key default gen_random_uuid(),

  -- Tenant anchor — every table must have store_id for RLS tenant isolation.
  store_id      uuid        not null references public.stores(id)   on delete cascade,

  -- Target: opp/course/event/booking page  (nullable — set when review is for a page)
  page_id       uuid        references public.pages(id)             on delete set null,

  -- Target: catalog product  (nullable — set when review is for a catalog item)
  product_id    uuid        references public.products(id)          on delete set null,

  -- Source order (optional but enables dedupe index + verified-purchase badge)
  order_id      uuid        references public.orders(id)            on delete set null,

  -- Buyer identity (mirrors orders — dual-mode: account or guest-by-email)
  buyer_id      uuid        references auth.users(id)               on delete set null,
  buyer_email   text,
  buyer_name    text,

  -- Review content
  rating        int         not null check (rating between 1 and 5),
  body          text,

  -- Moderation
  status        text        not null default 'approved'
                  check (status in ('approved', 'pending', 'hidden')),
  is_visible    boolean     not null default true,

  -- Seller response
  seller_reply  text,
  replied_at    timestamptz,

  -- Timestamps
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- A review must target at least one of page_id / product_id.
  constraint product_reviews_target_not_null
    check (page_id is not null or product_id is not null)
);

comment on table public.product_reviews is
  'Star ratings and text reviews left by buyers after a verified purchase. '
  'Each review targets either a catalog product (product_id) or a page '
  '(page_id) — at least one must be set. INSERT is gated by has_purchased() '
  'so only real buyers can submit. Seller can reply and moderate via UPDATE.';

comment on column public.product_reviews.rating      is 'Star rating 1–5 (integer). Only numeric column; no money/price here.';
comment on column public.product_reviews.status      is 'Moderation state: approved (shown), pending (held), hidden (suppressed).';
comment on column public.product_reviews.is_visible  is 'Quick seller toggle to hide a review without changing its status.';
comment on column public.product_reviews.seller_reply is 'Optional public seller response. replied_at is set when this is first written.';
comment on column public.product_reviews.order_id    is 'Links review to the triggering order. Enables one-review-per-order dedupe index and future verified-purchase badge.';
comment on column public.product_reviews.buyer_id    is 'auth.users FK for the reviewing buyer. Nullable — guest buyers identified by buyer_email only.';

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- Primary listing queries: "all approved reviews for page X" / "for product Y"
create index if not exists product_reviews_page_id_idx
  on public.product_reviews (page_id)
  where page_id is not null;

create index if not exists product_reviews_product_id_idx
  on public.product_reviews (product_id)
  where product_id is not null;

-- Seller dashboard: "all reviews for my store, newest first"
create index if not exists product_reviews_store_created_idx
  on public.product_reviews (store_id, created_at desc);

-- Dedupe: one review per order (partial — allows null order_id for manual reviews)
create unique index if not exists product_reviews_order_uniq
  on public.product_reviews (order_id)
  where order_id is not null;

-- ── updated_at trigger ───────────────────────────────────────────────────────
-- Reuses the repo-wide set_updated_at() trigger function (created in foundation).
-- Pattern mirrors customer_notes in 20260619190000_recovery_notes_state.

drop trigger if exists product_reviews_set_updated_at on public.product_reviews;
create trigger product_reviews_set_updated_at
  before update on public.product_reviews
  for each row execute function public.set_updated_at();

-- ============================================================================
-- SECTION 2 — RLS
-- ============================================================================

alter table public.product_reviews enable row level security;

-- ── Policy (a): BUYER INSERT — purchase-gated ─────────────────────────────
-- A buyer can only insert a review for a product/page they actually paid for.
-- Attribution check: the new row must be attributed to the calling user
-- (via buyer_id = auth.uid() OR verified-email match on buyer_email).
-- has_purchased() verifies a 'paid' order exists for the target.
--
-- Note: no buyer UPDATE or DELETE for MVP — reviews are immutable once posted.

drop policy if exists product_reviews_buyer_insert on public.product_reviews;
create policy product_reviews_buyer_insert on public.product_reviews
  for insert
  with check (
    -- Attribution: the row must claim to belong to the submitting buyer
    (
      buyer_id = auth.uid()
      or
      (
        buyer_email is not null
        and public.jwt_verified_email() is not null
        and lower(buyer_email) = public.jwt_verified_email()
      )
    )
    and
    -- Purchase gate: caller must have a paid order for this page or product
    public.has_purchased(page_id, product_id)
  );

comment on policy product_reviews_buyer_insert on public.product_reviews is
  'Buyers may only post a review for a product/page they have a paid order for. '
  'Attribution is verified (buyer_id = auth.uid() or verified-email match). '
  'has_purchased() checks public.orders.status = ''paid'' for the target.';

-- ── Policy (b): PUBLIC READ — approved + visible rows ─────────────────────
-- Storefront: anyone (including anon) can read approved, visible reviews.
-- Two SELECT policies on the same table OR together in Postgres RLS.

drop policy if exists product_reviews_public_read on public.product_reviews;
create policy product_reviews_public_read on public.product_reviews
  for select
  using (is_visible = true and status = 'approved');

comment on policy product_reviews_public_read on public.product_reviews is
  'Public storefront read: only approved + is_visible reviews are exposed. '
  'Hidden, pending, and seller-suppressed reviews are invisible to the public.';

-- ── Policy (c): SELLER/ADMIN READ — all own-store rows ────────────────────
-- Dashboard: seller sees everything (pending/hidden/approved) for their store.
-- This is the SECOND select policy; Postgres ORs it with the public-read policy.

drop policy if exists product_reviews_seller_read on public.product_reviews;
create policy product_reviews_seller_read on public.product_reviews
  for select
  using (public.owns_store(store_id) or public.is_admin());

comment on policy product_reviews_seller_read on public.product_reviews is
  'Seller and platform admin can read all reviews for their store, including '
  'hidden and pending ones. Stacks with product_reviews_public_read via OR.';

-- ── Policy (d): SELLER/ADMIN UPDATE — reply / hide / moderate ─────────────
-- Seller can write seller_reply, toggle is_visible, change status.
-- Buyer UPDATE/DELETE intentionally omitted for MVP.

drop policy if exists product_reviews_seller_update on public.product_reviews;
create policy product_reviews_seller_update on public.product_reviews
  for update
  using  (public.owns_store(store_id) or public.is_admin())
  with check (public.owns_store(store_id) or public.is_admin());

comment on policy product_reviews_seller_update on public.product_reviews is
  'Seller and platform admin may update reviews in their store: add a reply, '
  'hide a review (is_visible=false), or change moderation status. '
  'Buyers cannot edit or delete their own reviews in this MVP.';

-- ============================================================================
-- SECTION 3 — PostgREST schema-cache reload
-- ============================================================================

notify pgrst, 'reload schema';
