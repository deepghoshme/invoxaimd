-- ============================================================================
-- Platform Fees + Plan Feature Toggles
-- ----------------------------------------------------------------------------
-- Fees model (both apply per seller sale, resolved with precedence
--   seller-override > plan > global default):
--   * commission_pct   — % of the sale amount (stored as a 0..1 fraction)
--   * flat_fee_paise   — a fixed platform fee added per sale (in paise)
-- Plan-checkout flat fee: an optional fixed platform fee added on top of the
--   plan price when a seller subscribes (platform_settings global default; the
--   plan's own flat_fee_paise overrides it).
--
-- Plan feature toggles ("fetchers"): feature_keys is the ENFORCED master list
--   of unlocked feature keys per plan (vs the existing free-text `features`
--   which is display-only). Per-seller override lives on stores.feature_keys.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ── Global defaults on the platform_settings singleton ──────────────────────
alter table if exists public.platform_settings
  add column if not exists default_commission_pct numeric(5,4) not null default 0.05
    check (default_commission_pct >= 0 and default_commission_pct <= 1);

alter table if exists public.platform_settings
  add column if not exists default_flat_fee_paise integer not null default 0
    check (default_flat_fee_paise >= 0);

-- Flat platform fee added at plan checkout (seller subscribing to a plan).
alter table if exists public.platform_settings
  add column if not exists plan_flat_fee_paise integer not null default 0
    check (plan_flat_fee_paise >= 0);

-- ── Per-plan overrides + enforced feature toggles ───────────────────────────
-- commission_pct / flat_fee_paise are nullable: null = "inherit global default".
alter table if exists public.plans
  add column if not exists commission_pct numeric(5,4)
    check (commission_pct is null or (commission_pct >= 0 and commission_pct <= 1));

alter table if exists public.plans
  add column if not exists flat_fee_paise integer
    check (flat_fee_paise is null or flat_fee_paise >= 0);

-- Enforced, toggled feature keys (master FEATURE_CATALOG keys). The legacy
-- `features text[]` is display-only marketing copy and is left untouched.
alter table if exists public.plans
  add column if not exists feature_keys text[] not null default '{}';

-- ── Per-seller overrides on stores ──────────────────────────────────────────
-- commission_rate_override already exists (fraction 0..1). Add the flat-fee
-- override alongside it, plus a per-seller feature_keys override (NULL = use
-- the plan's feature_keys; non-null = exact override list for this seller).
alter table if exists public.stores
  add column if not exists flat_fee_paise_override integer
    check (flat_fee_paise_override is null or flat_fee_paise_override >= 0);

alter table if exists public.stores
  add column if not exists feature_keys text[];

notify pgrst, 'reload schema';
