-- ============================================================================
-- invoxai.io — Audit Log
-- ----------------------------------------------------------------------------
-- Creates the audit_log table for tracking key admin and seller actions.
-- Idempotent: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
--
-- Apply via:
--   node scripts/db-apply.mjs supabase/migrations/20260618320000_audit_log.sql
-- ============================================================================

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  actor_email   text,
  actor_role    text,
  action        text        NOT NULL,
  target_type   text,
  target_id     text,
  store_id      uuid        REFERENCES public.stores(id) ON DELETE SET NULL,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.audit_log                IS 'Immutable record of significant platform events (admin actions, seller key events).';
COMMENT ON COLUMN public.audit_log.actor_user_id  IS 'Supabase auth.users id of the actor who triggered the event.';
COMMENT ON COLUMN public.audit_log.actor_email    IS 'Email of the actor at time of event (denormalised so the record stays meaningful after user deletion).';
COMMENT ON COLUMN public.audit_log.actor_role     IS 'Role of the actor: admin | seller | system.';
COMMENT ON COLUMN public.audit_log.action         IS 'Dotted action string: store.suspend, gateway.save, impersonate.start, etc.';
COMMENT ON COLUMN public.audit_log.target_type    IS 'Kind of resource targeted: store, gateway, plan, etc.';
COMMENT ON COLUMN public.audit_log.target_id      IS 'Primary key of the targeted resource (string, so works for any type).';
COMMENT ON COLUMN public.audit_log.store_id       IS 'Store context when relevant; NULL for platform-wide actions.';
COMMENT ON COLUMN public.audit_log.metadata       IS 'Arbitrary key-value data for the action (reason, old/new values, etc.).';

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS audit_log_store_created_idx
  ON public.audit_log (store_id, created_at DESC)
  WHERE store_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_log_created_idx
  ON public.audit_log (created_at DESC);

-- ── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can read ALL rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'audit_log'
      AND policyname = 'audit_log_admin_select'
  ) THEN
    CREATE POLICY audit_log_admin_select
      ON public.audit_log
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;

-- Sellers can read only rows that belong to their own store.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'audit_log'
      AND policyname = 'audit_log_seller_select'
  ) THEN
    CREATE POLICY audit_log_seller_select
      ON public.audit_log
      FOR SELECT
      USING (
        store_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.stores
          WHERE stores.id       = audit_log.store_id
            AND stores.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- No INSERT / UPDATE / DELETE for any authenticated user.
-- All writes go through the service-role client in lib/audit.ts (bypasses RLS).

-- ── Notify PostgREST to reload schema ────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
