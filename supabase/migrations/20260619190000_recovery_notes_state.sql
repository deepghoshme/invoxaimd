-- ============================================================================
-- invoxai.io — Recovery tracking, buyer state, store recovery settings,
--              and customer notes
-- ----------------------------------------------------------------------------
-- 1. public.orders columns:
--      buyer_state         — buyer's state for intra/inter-state GST routing
--      recovery_sent_at    — when last abandoned-cart email was sent
--      recovery_count      — how many recovery emails sent for this order
--    + partial index on (store_id, status, recovery_sent_at) for efficient
--      recovery-eligible-orders query
--
-- 2. public.stores columns:
--      recovery_enabled         — seller toggle: send recovery emails or not
--      recovery_delay_minutes   — minutes after 'created' before email eligible
--      recovery_subject         — custom email subject (app default when null)
--      recovery_message         — custom email body (app default when null)
--    Covered by existing stores_update_own policy (owner_id = auth.uid()
--    or is_admin()); no new policies needed.
--
-- 3. public.customer_notes — seller notes keyed by buyer email
--    Full seller CRUD via owns_store() / is_admin(); no service-role-only write.
--
-- Idempotent: all DDL uses IF NOT EXISTS or DO-block guards.
-- Apply via: node scripts/db-apply.mjs supabase/migrations/20260619190000_recovery_notes_state.sql
-- ============================================================================

-- ============================================================================
-- 1. ORDERS — buyer state + abandoned-cart recovery columns
-- ============================================================================

alter table public.orders
  add column if not exists buyer_state       text,
  add column if not exists recovery_sent_at  timestamptz,
  add column if not exists recovery_count    int not null default 0;

comment on column public.orders.buyer_state      is 'Buyer''s state (e.g. "MH", "KA"). Used to determine intra-state (CGST+SGST) vs inter-state (IGST) GST routing.';
comment on column public.orders.recovery_sent_at is 'Timestamp of the last abandoned-cart recovery email sent for this order. NULL means no recovery email has been sent yet.';
comment on column public.orders.recovery_count   is 'Number of abandoned-cart recovery emails sent for this order. Incremented each time a recovery email is dispatched.';

-- Partial index: makes the nightly/scheduled recovery query efficient —
-- finds all created (unpaid) orders that are due for a recovery email.
create index if not exists orders_recovery_eligible_idx
  on public.orders (store_id, status, recovery_sent_at)
  where status = 'created';

-- ============================================================================
-- 2. STORES — abandoned-cart recovery settings (seller-configured)
-- ============================================================================

alter table public.stores
  add column if not exists recovery_enabled        boolean not null default false,
  add column if not exists recovery_delay_minutes  int     not null default 60,
  add column if not exists recovery_subject        text,
  add column if not exists recovery_message        text;

comment on column public.stores.recovery_enabled       is 'When true, the platform sends abandoned-cart recovery emails to buyers who did not complete checkout. Seller must explicitly opt in.';
comment on column public.stores.recovery_delay_minutes is 'Minutes after order creation (status=''created'') before a recovery email becomes eligible. Default 60 minutes.';
comment on column public.stores.recovery_subject       is 'Custom email subject for the recovery email. When null the app uses a sensible default ("You left something behind!").';
comment on column public.stores.recovery_message       is 'Custom email body/copy for the recovery email. When null the app uses a default template referencing the product and checkout link.';

-- NOTE: The existing stores_update_own policy on public.stores already covers
-- updates to these new columns:
--   using  (owner_id = auth.uid() or public.is_admin())
--   with check (owner_id = auth.uid() or public.is_admin())
-- No new RLS policy is required.

-- ============================================================================
-- 3. CUSTOMER NOTES — seller notes on a buyer, keyed by buyer email
-- ============================================================================
-- Customers are derived from orders by email (no dedicated customers table in
-- Phase 1). Sellers can tag notes to any buyer_email they have transacted with.
-- ============================================================================

create table if not exists public.customer_notes (
  id           uuid        primary key default gen_random_uuid(),
  store_id     uuid        not null references public.stores(id) on delete cascade,

  -- Buyer identified by email (no buyer account table required).
  buyer_email  text        not null,

  -- Free-form note body (seller-authored).
  body         text        not null,

  -- Who wrote the note (team member or owner; null when account was deleted).
  created_by   uuid        references auth.users(id) on delete set null,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table  public.customer_notes            is 'Seller-authored notes on a buyer, keyed by buyer email. Buyers are derived from orders; no separate customers table exists in Phase 1.';
comment on column public.customer_notes.buyer_email is 'Email address of the buyer this note concerns. Joins to orders.buyer_email for context.';
comment on column public.customer_notes.body        is 'Free-form note text authored by a seller team member. Not shown to the buyer.';
comment on column public.customer_notes.created_by  is 'auth.users.id of the team member who created the note. SET NULL on user deletion to preserve the note history.';

-- Index: primary query pattern is "all notes for buyer X in store Y, newest first".
create index if not exists customer_notes_store_buyer_idx
  on public.customer_notes (store_id, buyer_email, created_at desc);

-- updated_at trigger
drop trigger if exists customer_notes_set_updated_at on public.customer_notes;
create trigger customer_notes_set_updated_at
  before update on public.customer_notes
  for each row execute function public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.customer_notes enable row level security;

-- SELECT: store owner and admin can read all notes for their store.
drop policy if exists customer_notes_owner_select on public.customer_notes;
create policy customer_notes_owner_select on public.customer_notes
  for select
  using (public.owns_store(store_id) or public.is_admin());

-- INSERT: store owner and admin can add notes.
drop policy if exists customer_notes_owner_insert on public.customer_notes;
create policy customer_notes_owner_insert on public.customer_notes
  for insert
  with check (public.owns_store(store_id) or public.is_admin());

-- UPDATE: store owner and admin can edit notes (e.g. correct a typo).
drop policy if exists customer_notes_owner_update on public.customer_notes;
create policy customer_notes_owner_update on public.customer_notes
  for update
  using  (public.owns_store(store_id) or public.is_admin())
  with check (public.owns_store(store_id) or public.is_admin());

-- DELETE: store owner and admin can remove notes.
drop policy if exists customer_notes_owner_delete on public.customer_notes;
create policy customer_notes_owner_delete on public.customer_notes
  for delete
  using (public.owns_store(store_id) or public.is_admin());

-- ============================================================================
-- PostgREST schema cache reload
-- ============================================================================

notify pgrst, 'reload schema';
