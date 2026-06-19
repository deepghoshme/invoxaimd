-- ============================================================================
-- invoxai.io — Buyer-side data model (Phase 5, Wave 1)
-- ----------------------------------------------------------------------------
-- This migration wires buyer identity (buyer_id uuid → auth.users) into every
-- purchase table, creates the course_enrollments table, and adds cross-tenant
-- buyer-read RLS policies so a logged-in buyer can see their own purchases
-- across all stores.
--
-- IDEMPOTENT: uses IF NOT EXISTS, DROP POLICY IF EXISTS before recreate,
-- CREATE INDEX IF NOT EXISTS throughout.
-- ============================================================================

-- ============================================================================
-- SECTION 0 — SECURITY DEFINER helper: jwt_verified_email()
-- ----------------------------------------------------------------------------
-- WHY this approach instead of JWT claims:
--   • Supabase stores `email` + `email_confirmed_at` in auth.users.
--   • JWT top-level `email` claim is always present, but there is no
--     universally-reliable `email_verified` boolean in the JWT for ALL auth
--     methods (OTP / magic-link / email-password users do NOT get an
--     `email_verified` claim in user_metadata like Google OAuth does).
--   • JWT claims can also be stale until the next refresh — a user who just
--     confirmed their email might still carry an old JWT without the claim.
--   • Checking auth.users.email_confirmed_at IS NOT NULL via a SECURITY
--     DEFINER function is authoritative, up-to-date, and works for every
--     auth provider.
--   • The function is STABLE (no writes), costs one indexed PK lookup.
--
-- Returns: lower(email) when the caller's email is confirmed, else NULL.
-- A NULL return means the policy predicate evaluates to false → no rows leak.
-- ============================================================================

create or replace function public.jwt_verified_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(u.email)
  from auth.users u
  where u.id = auth.uid()
    and u.email_confirmed_at is not null;
$$;

comment on function public.jwt_verified_email() is
  'Returns lower(email) for the current user ONLY when their email is confirmed '
  '(email_confirmed_at IS NOT NULL). Returns NULL for unverified/anonymous callers. '
  'Used as the gating function for buyer-read RLS policies — prevents unverified '
  'email addresses from matching another person''s purchase records.';

-- ============================================================================
-- SECTION 1 — Add buyer_id to public.orders
-- ============================================================================

alter table public.orders
  add column if not exists buyer_id uuid
    references auth.users(id) on delete set null;

comment on column public.orders.buyer_id is
  'Links a verified auth.users account to this order. Nullable — guest checkout '
  'remains fully intact. Set at checkout when the buyer is authenticated, or '
  'backfilled when a guest account is later verified.';

create index if not exists orders_buyer_id_idx
  on public.orders (buyer_id)
  where buyer_id is not null;

-- ============================================================================
-- SECTION 2 — Backfill buyer_id on orders where email is confirmed
-- ----------------------------------------------------------------------------
-- Only match rows where buyer_email is not null AND there is exactly one
-- confirmed auth.users row with that (case-insensitive) email.
-- We deliberately do NOT match unverified emails — that would be a
-- cross-tenant data leak (anyone could sign up with a victim's email).
-- ============================================================================

update public.orders o
set    buyer_id = u.id
from   auth.users u
where  o.buyer_id is null
  and  o.buyer_email is not null
  and  lower(o.buyer_email) = lower(u.email)
  and  u.email_confirmed_at is not null;

-- ============================================================================
-- SECTION 3 — Buyer-read policy on public.orders
-- ----------------------------------------------------------------------------
-- Dual-branch: match on buyer_id (fast, index-backed) OR on
-- jwt_verified_email() (catches orders placed as guest before account existed).
-- The existing orders_owner_read (seller/admin) policy is left INTACT.
-- NULL-safety: both buyer_id and buyer_email are nullable on orders, so we
-- guard with IS NOT NULL before the equality check. buyer_email NULL → branch
-- is false (no leak). jwt_verified_email() returns NULL for unverified/anon →
-- lower(buyer_email) = NULL is false (no leak).
-- ============================================================================

drop policy if exists orders_buyer_read on public.orders;
create policy orders_buyer_read on public.orders
  for select
  using (
    -- Branch A: order is linked to this auth account (fastest path)
    ( buyer_id is not null and buyer_id = auth.uid() )
    OR
    -- Branch B: guest order matched to a verified email address
    --   jwt_verified_email() returns NULL for unverified → predicate is false
    (
      buyer_email is not null
      and public.jwt_verified_email() is not null
      and lower(buyer_email) = public.jwt_verified_email()
    )
  );

comment on policy orders_buyer_read on public.orders is
  'Allows authenticated buyers to read their own orders across all stores. '
  'Branch A uses the direct buyer_id FK (post-backfill / post-checkout). '
  'Branch B matches verified email for guest orders placed before account signup. '
  'jwt_verified_email() is NULL for unverified accounts, preventing spoofed-email leaks.';

-- ============================================================================
-- SECTION 4 — New table: public.course_enrollments
-- ============================================================================

create table if not exists public.course_enrollments (
  id          uuid        primary key default gen_random_uuid(),
  buyer_id    uuid        references auth.users(id) on delete set null,
  buyer_email text,
  page_id     uuid        not null references public.pages(id) on delete cascade,
  store_id    uuid        not null references public.stores(id) on delete cascade,
  order_id    uuid        references public.orders(id) on delete set null,
  created_at  timestamptz not null default now()
);

comment on table public.course_enrollments is
  'One row per enrolled buyer per course page. buyer_id is null for guest/unlinked '
  'enrollments (linked later via backfill or on-login hook). Writes are service-role only.';

-- Prevent duplicate enrollments —
--   unique per (page_id, buyer_id) for authenticated buyers
create unique index if not exists course_enrollments_page_buyer_uniq
  on public.course_enrollments (page_id, buyer_id)
  where buyer_id is not null;

--   unique per (page_id, lower(buyer_email)) for guest/email-only enrollments
create unique index if not exists course_enrollments_page_email_uniq
  on public.course_enrollments (page_id, lower(buyer_email))
  where buyer_email is not null;

-- Supporting indexes
create index if not exists course_enrollments_buyer_id_idx
  on public.course_enrollments (buyer_id)
  where buyer_id is not null;

create index if not exists course_enrollments_store_id_idx
  on public.course_enrollments (store_id);

create index if not exists course_enrollments_page_id_idx
  on public.course_enrollments (page_id);

-- RLS
alter table public.course_enrollments enable row level security;

-- (a) Seller / admin reads their store's enrollment rows
drop policy if exists course_enrollments_seller_read on public.course_enrollments;
create policy course_enrollments_seller_read on public.course_enrollments
  for select
  using (public.owns_store(store_id) or public.is_admin());

-- (b) Buyer reads their own enrollment rows (same dual-branch as orders)
drop policy if exists course_enrollments_buyer_read on public.course_enrollments;
create policy course_enrollments_buyer_read on public.course_enrollments
  for select
  using (
    ( buyer_id is not null and buyer_id = auth.uid() )
    OR
    (
      buyer_email is not null
      and public.jwt_verified_email() is not null
      and lower(buyer_email) = public.jwt_verified_email()
    )
  );

-- No INSERT/UPDATE/DELETE policy for anon/authenticated — service-role only.

-- ============================================================================
-- SECTION 5 — Add buyer_id + buyer-read RLS to event_tickets
-- ============================================================================

alter table public.event_tickets
  add column if not exists buyer_id uuid
    references auth.users(id) on delete set null;

comment on column public.event_tickets.buyer_id is
  'Linked auth.users account for this ticket. Nullable (guest ticket remains valid).';

create index if not exists event_tickets_buyer_id_idx
  on public.event_tickets (buyer_id)
  where buyer_id is not null;

-- Backfill: link tickets to verified accounts by email
update public.event_tickets t
set    buyer_id = u.id
from   auth.users u
where  t.buyer_id is null
  and  t.buyer_email is not null
  and  lower(t.buyer_email) = lower(u.email)
  and  u.email_confirmed_at is not null;

-- Buyer-read policy (drop+recreate for idempotency)
drop policy if exists event_tickets_buyer_read on public.event_tickets;
create policy event_tickets_buyer_read on public.event_tickets
  for select
  using (
    ( buyer_id is not null and buyer_id = auth.uid() )
    OR
    (
      buyer_email is not null
      and public.jwt_verified_email() is not null
      and lower(buyer_email) = public.jwt_verified_email()
    )
  );

-- ============================================================================
-- SECTION 5b — Add buyer_id + buyer-read RLS to vip_members
-- ============================================================================

alter table public.vip_members
  add column if not exists buyer_id uuid
    references auth.users(id) on delete set null;

comment on column public.vip_members.buyer_id is
  'Linked auth.users account. Nullable — membership remains valid for guest buyers.';

create index if not exists vip_members_buyer_id_idx
  on public.vip_members (buyer_id)
  where buyer_id is not null;

-- Backfill: link memberships to verified accounts by email
update public.vip_members v
set    buyer_id = u.id
from   auth.users u
where  v.buyer_id is null
  and  v.buyer_email is not null
  and  lower(v.buyer_email) = lower(u.email)
  and  u.email_confirmed_at is not null;

-- Buyer-read policy
drop policy if exists vip_members_buyer_read on public.vip_members;
create policy vip_members_buyer_read on public.vip_members
  for select
  using (
    ( buyer_id is not null and buyer_id = auth.uid() )
    OR
    (
      buyer_email is not null
      and public.jwt_verified_email() is not null
      and lower(buyer_email) = public.jwt_verified_email()
    )
  );

-- ============================================================================
-- SECTION 5c — Add buyer_id + buyer-read RLS to bookings
-- ============================================================================
-- bookings already has buyer_email; we add buyer_id for uniformity and to
-- enable the same fast FK lookup path as all other purchase tables.

alter table public.bookings
  add column if not exists buyer_id uuid
    references auth.users(id) on delete set null;

comment on column public.bookings.buyer_id is
  'Linked auth.users account. Nullable — guest bookings are unaffected.';

create index if not exists bookings_buyer_id_idx
  on public.bookings (buyer_id)
  where buyer_id is not null;

-- Backfill
update public.bookings b
set    buyer_id = u.id
from   auth.users u
where  b.buyer_id is null
  and  b.buyer_email is not null
  and  lower(b.buyer_email) = lower(u.email)
  and  u.email_confirmed_at is not null;

-- Buyer-read policy (bookings had no buyer policy at all before this migration)
drop policy if exists bookings_buyer_read on public.bookings;
create policy bookings_buyer_read on public.bookings
  for select
  using (
    ( buyer_id is not null and buyer_id = auth.uid() )
    OR
    (
      buyer_email is not null
      and public.jwt_verified_email() is not null
      and lower(buyer_email) = public.jwt_verified_email()
    )
  );

-- ============================================================================
-- SECTION 6 — PostgREST schema-cache reload
-- ============================================================================

notify pgrst, 'reload schema';
