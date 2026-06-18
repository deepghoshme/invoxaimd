-- ─────────────────────────────────────────────────────────────────────────────
-- Wallet: ledger table + denormalised balance column on stores
-- Migration: 20260618230000_wallet.sql
-- Apply with: node scripts/db-apply.mjs supabase/migrations/20260618230000_wallet.sql
-- Then reload PostgREST: see pending-platform-settings-migration.md for the
--   schema-reload step (POST to /rest/v1/rpc/reload_schema or restart PostgREST).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Wallet balance column on stores (denormalised for fast reads)
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS wallet_balance integer NOT NULL DEFAULT 0;
-- Balance is stored in paise (smallest unit), matches the ledger.
-- A negative balance is theoretically impossible but no CHECK added yet to
-- allow the auto-recharge flow a tiny race window; enforce at app layer.

-- 2. Wallet ledger
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  type              text        NOT NULL CHECK (type IN ('credit', 'debit')),
  amount            integer     NOT NULL CHECK (amount > 0),
  -- running balance AFTER this entry (paise); populated by the API, not a trigger,
  -- so it is consistent as long as writes go through the API (no concurrent races).
  balance_after     integer     NOT NULL,
  reason            text        NOT NULL,          -- e.g. "recharge", "commission"
  gateway_payment_id text,                         -- Razorpay payment_id for credits
  razorpay_order_id  text,                         -- Razorpay order_id (idempotency check)
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Index for store ledger queries (most-recent-first)
CREATE INDEX IF NOT EXISTS wallet_ledger_store_created
  ON wallet_ledger (store_id, created_at DESC);

-- Unique index on razorpay_order_id to prevent double-credit on duplicate webhook/verify
CREATE UNIQUE INDEX IF NOT EXISTS wallet_ledger_razorpay_order_uniq
  ON wallet_ledger (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

-- 3. RLS — owner-only access
ALTER TABLE wallet_ledger ENABLE ROW LEVEL SECURITY;

-- Sellers can read their own store's ledger
CREATE POLICY "wallet_ledger_store_owner_select"
  ON wallet_ledger FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM stores WHERE owner_id = auth.uid()
    )
  );

-- Inserts and updates are ONLY done via service-role (the API), never from the
-- client. We explicitly deny direct client inserts.
-- (No INSERT/UPDATE/DELETE policies → only service-role can write.)

-- 4. Grant service-role full access (it bypasses RLS anyway, but be explicit)
GRANT SELECT, INSERT, UPDATE ON wallet_ledger TO service_role;
GRANT SELECT, UPDATE ON stores TO service_role;

-- 5. Anon/authenticated users can only SELECT (RLS guards the rows)
GRANT SELECT ON wallet_ledger TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- BONUS SCHEDULE (documented constants — applied in application code only)
-- ₹2,000 recharge → +₹50 bonus (credited as a separate ledger row)
-- ₹5,000 recharge → +₹250 bonus
-- ₹10,000 recharge → +₹750 bonus
-- Bonuses are ONLY applied on successful Razorpay signature verification in
-- /app/api/wallet/recharge/verify/route.ts. They are never applied client-side.
-- ─────────────────────────────────────────────────────────────────────────────
