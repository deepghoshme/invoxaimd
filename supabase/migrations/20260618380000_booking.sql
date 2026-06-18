-- Migration: bookings table for 1-to-1 booking page type
-- Idempotent: uses IF NOT EXISTS throughout.
-- Availability config (duration, days/hours, timezone, price, buffer) lives in pages.content JSONB.

CREATE TABLE IF NOT EXISTS bookings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id       uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  store_id      uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  slot_start    timestamptz NOT NULL,
  slot_end      timestamptz NOT NULL,
  buyer_name    text NOT NULL,
  buyer_email   text NOT NULL,
  status        text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','pending','cancelled')),
  order_id      uuid NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_page_id_idx   ON bookings (page_id);
CREATE INDEX IF NOT EXISTS bookings_store_id_idx  ON bookings (store_id);
CREATE INDEX IF NOT EXISTS bookings_slot_start_idx ON bookings (slot_start);
CREATE INDEX IF NOT EXISTS bookings_status_idx    ON bookings (status);

-- RLS: store owner can read their own bookings.
-- Public INSERT is handled server-side via the service-role client (no anon INSERT needed).
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'store_owner_read'
  ) THEN
    CREATE POLICY store_owner_read ON bookings
      FOR SELECT
      USING (
        store_id IN (
          SELECT id FROM stores WHERE owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Notify PostgREST to reload its schema cache so the new table is visible immediately.
NOTIFY pgrst, 'reload schema';
