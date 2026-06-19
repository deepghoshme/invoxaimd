-- ============================================================================
-- invoxai.io — Wallet-zero checkout gate + recharge-reminder platform settings
--              + plan_payments promo tracking
-- ----------------------------------------------------------------------------
-- AREA 1: public.stores — checkout gate flags/thresholds (owner-configurable)
-- AREA 2: public.platform_settings — admin-configurable master switches and
--          threshold parameters for the gate and reminder job
-- AREA 3: public.plan_payments — promo code + discount columns for plan
--          purchase auditing
--
-- RLS:
--   AREA 1: covered by existing stores_update_own policy
--             (using  (owner_id = auth.uid() or public.is_admin())
--              with check (owner_id = auth.uid() or public.is_admin()))
--           No new policy needed; new columns are row-scoped automatically.
--   AREA 2: covered by existing platform_settings_admin_write policy
--             (for all using (public.is_admin()) with check (public.is_admin()))
--           No new policy needed.
--   AREA 3: plan_payments has no public policies (service-role only); new
--           columns inherit the same access model — no new policy needed.
--
-- MONEY SAFETY: wallet_floor_paise and recharge_reminder_min_revenue_paise are
--   threshold/comparison values stored in paise. No money is charged, credited,
--   or moved by this migration. All financial writes go through server-side
--   service-role API routes with Razorpay signature verification.
--
-- Idempotent: all DDL uses ADD COLUMN IF NOT EXISTS.
-- Apply via: node scripts/db-apply.mjs supabase/migrations/20260619230000_wallet_gate_reminders.sql
-- ============================================================================


-- ============================================================================
-- AREA 1 — public.stores: wallet-zero checkout gate columns
-- ============================================================================
-- These three columns let the platform (and per-store override) control whether
-- checkout is disabled when the seller's wallet balance is too low.
-- The scheduled job that checks balances reads these columns; the app's checkout
-- route reads checkout_blocked to refuse new orders instantly (no live balance
-- re-query needed on every checkout hit).
-- ============================================================================

alter table public.stores
  add column if not exists checkout_blocked boolean not null default false;

comment on column public.stores.checkout_blocked is
  'When true the storefront checkout is auto-disabled. Set to true by the wallet-gate '
  'scheduled job when wallet_balance falls to or below wallet_floor_paise; cleared '
  'automatically when the seller recharges above the floor. No money is stored here — '
  'this is a derived flag maintained by the job.';

alter table public.stores
  add column if not exists wallet_floor_paise bigint not null default 0;

comment on column public.stores.wallet_floor_paise is
  'Minimum wallet balance (paise) below which checkout_blocked is set true. '
  'Default 0 means block only when balance reaches zero or goes negative. '
  'When non-zero this acts as a per-store buffer (e.g. 50000 = ₹500 safety margin). '
  'The platform-wide default lives in platform_settings.wallet_floor_paise; '
  'this per-store column overrides that default when the admin or seller sets it. '
  'Stored in paise; no money is charged by this column.';

alter table public.stores
  add column if not exists last_recharge_reminder_at timestamptz;

comment on column public.stores.last_recharge_reminder_at is
  'Timestamp of the last "recharge your wallet" reminder email sent to this store''s '
  'owner. NULL means no reminder has ever been sent. The scheduled reminder job '
  'compares now() - last_recharge_reminder_at against '
  'platform_settings.recharge_reminder_min_interval_min to throttle frequency and '
  'prevent spam. Updated by the job after each successful email dispatch.';

-- NOTE: The existing stores_update_own policy already covers updates to all new
-- columns (policy is row-scoped: owner_id = auth.uid() or public.is_admin()).
-- The job uses the service-role client which bypasses RLS for the flag writes.


-- ============================================================================
-- AREA 2 — public.platform_settings: admin-configurable gate + reminder params
-- ============================================================================
-- All new columns are public-readable (inheriting the existing public SELECT
-- policy on platform_settings) and admin-writable only (platform_settings_admin_write
-- policy: for all using (public.is_admin()) with check (public.is_admin())).
-- None of these columns store secrets.
-- ============================================================================

-- Master switch for the wallet-zero checkout gate feature.
alter table public.platform_settings
  add column if not exists wallet_gate_enabled boolean not null default false;

comment on column public.platform_settings.wallet_gate_enabled is
  'Master switch for the wallet-zero checkout gate. When false, checkout_blocked on '
  'stores is never auto-set by the scheduled job, regardless of wallet balance. '
  'Set to true in the admin panel to activate the feature platform-wide.';

-- Platform-default floor used by the gate job when a store has wallet_floor_paise = 0.
alter table public.platform_settings
  add column if not exists wallet_floor_paise bigint not null default 0;

comment on column public.platform_settings.wallet_floor_paise is
  'Platform-wide default minimum wallet balance (paise). The wallet-gate job uses this '
  'value for any store whose own wallet_floor_paise is 0. Example: set to 10000 '
  '(= ₹100) so checkout is blocked before the balance hits zero. Stored in paise; '
  'no money is charged by this column.';

-- Master switch for the recharge-reminder email job.
alter table public.platform_settings
  add column if not exists recharge_reminder_enabled boolean not null default false;

comment on column public.platform_settings.recharge_reminder_enabled is
  'Master switch for the 30-min recharge-reminder email job. When false, no reminder '
  'emails are sent regardless of seller wallet balance or activity. Enable in the '
  'admin panel to activate the feature platform-wide.';

-- Minimum gap between consecutive reminder emails to the same store.
alter table public.platform_settings
  add column if not exists recharge_reminder_min_interval_min int not null default 30;

comment on column public.platform_settings.recharge_reminder_min_interval_min is
  'Minimum number of minutes that must elapse between successive recharge-reminder '
  'emails to the same seller. The job checks now() - stores.last_recharge_reminder_at '
  'against this value before dispatching. Default 30 (= one email per half-hour at most). '
  'Increase to reduce reminder frequency; set very high (e.g. 10080 = 1 week) to '
  'effectively silence reminders without disabling the feature.';

-- Filter: only remind "active" sellers (those with recent activity).
alter table public.platform_settings
  add column if not exists recharge_reminder_active_only boolean not null default true;

comment on column public.platform_settings.recharge_reminder_active_only is
  'When true, the reminder job only sends emails to sellers who have had recent activity '
  '(defined as at least one order in the activity window, or a store status of ''active''). '
  'Sellers with no recent activity or no orders are silently skipped. '
  'Set to false to remind ALL sellers with a low wallet balance regardless of activity. '
  'Admin-configurable: "only active sellers get the friendly mail."';

-- Filter: only remind sellers whose lifetime or recent revenue is above a threshold.
alter table public.platform_settings
  add column if not exists recharge_reminder_min_revenue_paise bigint not null default 0;

comment on column public.platform_settings.recharge_reminder_min_revenue_paise is
  'Minimum seller revenue (paise) required before the reminder job sends a recharge '
  'email. The job compares the seller''s total confirmed revenue against this value. '
  'Default 0 = no revenue filter (remind all active sellers). '
  'Example: set to 100000 (= ₹1,000) to restrict reminders to sellers who have '
  'already transacted meaningfully. Stored in paise; no money is charged by this column. '
  'Admin-configurable: "if not active or no revenue, set parameters in admin side."';


-- ============================================================================
-- AREA 3 — public.plan_payments: promo code + discount tracking
-- ============================================================================
-- plan_payments already has: id, store_id, plan_id, razorpay_order_id,
-- razorpay_payment_id, amount, created_at.
-- Adding promo_code and promo_discount_paise so each payment row records which
-- promo was applied at purchase time. Used by the admin revenue/transaction feed
-- and for auditing promo effectiveness.
-- ============================================================================

alter table public.plan_payments
  add column if not exists promo_code text;

comment on column public.plan_payments.promo_code is
  'Promo code string applied at the time of this plan purchase (e.g. "LAUNCH50"). '
  'NULL when no promo was used. Matches promo_codes.code for join/audit purposes.';

alter table public.plan_payments
  add column if not exists promo_discount_paise bigint;

comment on column public.plan_payments.promo_discount_paise is
  'Discount amount in paise applied via promo_code at the time of purchase. '
  'NULL when promo_code is NULL (no discount). '
  'Example: if plan price = ₹999 and a 10% promo was applied, this is 9990. '
  'Stored in paise to match all other monetary columns on the platform. '
  'No money is charged by this column — it is a record of the discount already '
  'applied when the Razorpay order was created.';


-- ============================================================================
-- PostgREST schema cache reload
-- ============================================================================

notify pgrst, 'reload schema';
