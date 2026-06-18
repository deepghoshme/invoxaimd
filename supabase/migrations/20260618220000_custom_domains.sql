-- Migration: custom_domains
-- Creates the custom_domains table for the Domain Connect wizard.
-- Apply with: node scripts/db-apply.mjs supabase/migrations/20260618220000_custom_domains.sql
-- Then reload PostgREST schema cache (see memory/pending-platform-settings-migration.md).

-- ──────────────────────────────────────────────────────────────────
-- 1. Enum
-- ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE custom_domain_status AS ENUM ('pending', 'dns', 'verified', 'live');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────────────────
-- 2. Table
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_domains (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  domain      text NOT NULL,
  txt_token   text NOT NULL,
  status      custom_domain_status NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT custom_domains_domain_unique UNIQUE (domain)
);

CREATE INDEX IF NOT EXISTS custom_domains_store_id_idx ON custom_domains (store_id);
CREATE INDEX IF NOT EXISTS custom_domains_domain_idx    ON custom_domains (domain);

-- ──────────────────────────────────────────────────────────────────
-- 3. updated_at trigger
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS custom_domains_updated_at ON custom_domains;
CREATE TRIGGER custom_domains_updated_at
  BEFORE UPDATE ON custom_domains
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────────
-- 4. Row Level Security — owner-only
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE custom_domains ENABLE ROW LEVEL SECURITY;

-- Owners can read their own domains
CREATE POLICY "owner_select" ON custom_domains
  FOR SELECT USING (
    store_id IN (
      SELECT id FROM stores WHERE owner_id = auth.uid()
    )
  );

-- Owners can insert new domains for their own store
CREATE POLICY "owner_insert" ON custom_domains
  FOR INSERT WITH CHECK (
    store_id IN (
      SELECT id FROM stores WHERE owner_id = auth.uid()
    )
  );

-- Owners can update (e.g. change domain text before DNS is done)
CREATE POLICY "owner_update" ON custom_domains
  FOR UPDATE USING (
    store_id IN (
      SELECT id FROM stores WHERE owner_id = auth.uid()
    )
  );

-- Owners can delete (remove a domain)
CREATE POLICY "owner_delete" ON custom_domains
  FOR DELETE USING (
    store_id IN (
      SELECT id FROM stores WHERE owner_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────────
-- 5. Comment
-- ──────────────────────────────────────────────────────────────────
COMMENT ON TABLE custom_domains IS
  'Custom domains connected by sellers via the Domain Connect wizard. '
  'DNS verification uses txt_token; SSL is handled by Caddy on-demand TLS. '
  'tls-check API route allows certs only for rows with status=live.';
