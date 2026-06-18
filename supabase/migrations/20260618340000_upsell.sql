-- ============================================================================
-- invoxai.io — Upsell Offers
-- ----------------------------------------------------------------------------
-- Stores order-bump and post-purchase upsell configurations for a seller.
-- Each offer targets either ANY checkout or a specific product trigger, and
-- presents a chosen product as the upsell with an optional discount.
--
-- offer_kind:
--   'bump'          — checkbox shown on the checkout page before payment
--   'post_purchase' — one-click offer on the thank-you page after payment
--
-- trigger_type:
--   'any'     — fires on every checkout for this store
--   'product' — fires only when trigger_product_id is in the cart
--
-- discount_type / discount_value:
--   'percent'  + N  — N% off the offer product's listed price
--   'flat'     + N  — ₹N off (INR, not paise — matches products.price column)
--   'none'          — full price (discount_value ignored)
--
-- RLS:
--   • owner: full CRUD via owns_store()
--   • authenticated: SELECT active offers (checkout rendering needs them)
--   • service-role: unrestricted (server actions use createAdminClient)
--
-- Apply via:
--   node scripts/db-apply.mjs supabase/migrations/20260618340000_upsell.sql
-- ============================================================================

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.upsell_offers (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  store_id           uuid        NOT NULL
                                   REFERENCES public.stores (id) ON DELETE CASCADE,

  name               text        NOT NULL DEFAULT 'Untitled offer',

  -- trigger: when does this offer fire?
  trigger_type       text        NOT NULL DEFAULT 'any'
                                   CHECK (trigger_type IN ('any', 'product')),
  trigger_product_id uuid        NULL
                                   REFERENCES public.products (id) ON DELETE SET NULL,

  -- the product being offered as the upsell
  offer_product_id   uuid        NOT NULL
                                   REFERENCES public.products (id) ON DELETE CASCADE,

  -- bump = on checkout page; post_purchase = on thank-you page
  offer_kind         text        NOT NULL DEFAULT 'bump'
                                   CHECK (offer_kind IN ('bump', 'post_purchase')),

  -- discount applied to offer_product at point of upsell
  discount_type      text        NOT NULL DEFAULT 'none'
                                   CHECK (discount_type IN ('percent', 'flat', 'none')),
  discount_value     integer     NOT NULL DEFAULT 0 CHECK (discount_value >= 0),

  is_active          boolean     NOT NULL DEFAULT true,
  sort_order         integer     NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.upsell_offers                    IS 'Order-bump and post-purchase upsell configurations per store.';
COMMENT ON COLUMN public.upsell_offers.trigger_type       IS '''any'' = fires on all checkouts; ''product'' = fires when trigger_product_id is in cart.';
COMMENT ON COLUMN public.upsell_offers.offer_kind         IS '''bump'' = checkbox on checkout; ''post_purchase'' = one-click on thank-you page.';
COMMENT ON COLUMN public.upsell_offers.discount_type      IS '''percent'' | ''flat'' (INR, not paise) | ''none''.';
COMMENT ON COLUMN public.upsell_offers.discount_value     IS 'Numeric value for the discount. 0 when discount_type is ''none''.';

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS upsell_offers_store_idx
  ON public.upsell_offers (store_id, sort_order);

CREATE INDEX IF NOT EXISTS upsell_offers_active_idx
  ON public.upsell_offers (store_id, is_active)
  WHERE is_active = true;

-- ── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.upsell_offers ENABLE ROW LEVEL SECURITY;

-- Store owner: full CRUD
DROP POLICY IF EXISTS upsell_offers_owner_all ON public.upsell_offers;
CREATE POLICY upsell_offers_owner_all ON public.upsell_offers
  FOR ALL
  USING  (public.owns_store(store_id))
  WITH CHECK (public.owns_store(store_id));

-- Any authenticated user: SELECT active offers
-- (checkout renderer runs as the buyer's session and needs to read active offers)
DROP POLICY IF EXISTS upsell_offers_auth_select_active ON public.upsell_offers;
CREATE POLICY upsell_offers_auth_select_active ON public.upsell_offers
  FOR SELECT
  USING (is_active = true AND auth.role() = 'authenticated');

-- ── PostgREST schema cache reload ────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
