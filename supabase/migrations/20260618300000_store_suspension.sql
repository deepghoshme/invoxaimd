-- Migration: store_suspension
-- Adds suspension fields to the stores table so an admin can take a store
-- offline without deleting it.  The storefront renderer checks `suspended` at
-- render time and returns an "unavailable" page instead of any content.
--
-- Idempotent: uses ADD COLUMN IF NOT EXISTS throughout.
-- Apply via: node scripts/db-apply.mjs supabase/migrations/20260618300000_store_suspension.sql

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS suspended        boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at     timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_reason text;

-- Index for quick admin queries ("show me all suspended stores").
CREATE INDEX IF NOT EXISTS stores_suspended_idx
  ON stores (suspended)
  WHERE suspended = true;

-- Comments for documentation.
COMMENT ON COLUMN stores.suspended
  IS 'When true the public storefront renders an "unavailable" page and checkout is blocked.';
COMMENT ON COLUMN stores.suspended_at
  IS 'Timestamp when the store was last suspended (cleared on unsuspend).';
COMMENT ON COLUMN stores.suspended_reason
  IS 'Admin-only reason for suspension; never exposed to the storefront visitor.';
