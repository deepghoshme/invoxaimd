import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Platform fees applied to a seller's sales. There are TWO components, both of
 * which apply per confirmed sale:
 *   * commission_pct  — fraction (0..1) of the sale amount
 *   * flat_fee_paise  — fixed fee (in paise) added per sale
 *
 * Resolution precedence (each component independently):
 *   seller override > plan > global default (platform_settings)
 *
 * Notes:
 *  - Per-seller override lives on stores: commission_rate_override (existing,
 *    Wave 1) and flat_fee_paise_override (added with the platform-fees migration).
 *  - Per-plan override lives on plans: commission_pct / flat_fee_paise (nullable;
 *    null = inherit global). The seller's plan is read via their active
 *    subscription.
 *  - Global defaults live on the platform_settings singleton.
 *
 * Money-safety: this is the single source of truth for fee resolution. Callers
 * compute amounts server-side from these values — never from the client.
 */

export type ResolvedFees = {
  commission_pct: number; // 0..1 fraction
  flat_fee_paise: number; // >= 0
  source: {
    commission: "seller" | "plan" | "category" | "default";
    flat_fee: "seller" | "plan" | "default";
  };
};

// Hard fallbacks if platform_settings is unreadable (matches the historical
// getStoreCommissionRate default of 5%).
const FALLBACK_COMMISSION_PCT = 0.05;
const FALLBACK_FLAT_FEE_PAISE = 0;

type PlatformDefaults = { default_commission_pct: number; default_flat_fee_paise: number };

async function getPlatformFeeDefaults(): Promise<PlatformDefaults> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_settings")
      .select("default_commission_pct, default_flat_fee_paise")
      .maybeSingle();
    if (!data) return { default_commission_pct: FALLBACK_COMMISSION_PCT, default_flat_fee_paise: FALLBACK_FLAT_FEE_PAISE };
    const pct = Number((data as Record<string, unknown>).default_commission_pct);
    const flat = Number((data as Record<string, unknown>).default_flat_fee_paise);
    return {
      default_commission_pct: Number.isFinite(pct) ? pct : FALLBACK_COMMISSION_PCT,
      default_flat_fee_paise: Number.isFinite(flat) ? Math.max(0, Math.round(flat)) : FALLBACK_FLAT_FEE_PAISE,
    };
  } catch {
    return { default_commission_pct: FALLBACK_COMMISSION_PCT, default_flat_fee_paise: FALLBACK_FLAT_FEE_PAISE };
  }
}

/**
 * Resolve the commission % and flat fee that apply to a store's sales.
 *
 * Backwards compatible with the legacy commission resolution: the per-category
 * commission_rate (via stores.category_id → business_categories) is consulted
 * for the commission % between the seller override and the global default, so
 * existing per-category rates keep working. The flat fee has no category tier.
 */
export async function resolveFees(storeId: string): Promise<ResolvedFees> {
  const defaults = await getPlatformFeeDefaults();

  const result: ResolvedFees = {
    commission_pct: defaults.default_commission_pct,
    flat_fee_paise: defaults.default_flat_fee_paise,
    source: { commission: "default", flat_fee: "default" },
  };

  if (!storeId) return result;

  try {
    const admin = createAdminClient();

    const { data: store } = await admin
      .from("stores")
      .select("commission_rate_override, flat_fee_paise_override, category_id")
      .eq("id", storeId)
      .maybeSingle();

    const sellerCommission = (store as { commission_rate_override?: number | null } | null)?.commission_rate_override;
    const sellerFlat = (store as { flat_fee_paise_override?: number | null } | null)?.flat_fee_paise_override;
    const categoryId = (store as { category_id?: string | null } | null)?.category_id ?? null;

    // Plan-level overrides via the active subscription.
    let planCommission: number | null = null;
    let planFlat: number | null = null;
    const { data: sub } = await admin
      .from("subscriptions")
      .select("plan:plans(commission_pct, flat_fee_paise)")
      .eq("store_id", storeId)
      .maybeSingle();
    const plan = (sub as { plan?: { commission_pct?: number | null; flat_fee_paise?: number | null } | null } | null)?.plan;
    if (plan) {
      planCommission = plan.commission_pct ?? null;
      planFlat = plan.flat_fee_paise ?? null;
    }

    // ── Commission %: seller > plan > category > default ──────────────────────
    if (sellerCommission != null) {
      result.commission_pct = Number(sellerCommission);
      result.source.commission = "seller";
    } else if (planCommission != null) {
      result.commission_pct = Number(planCommission);
      result.source.commission = "plan";
    } else if (categoryId) {
      const { data: cat } = await admin
        .from("business_categories")
        .select("commission_rate")
        .eq("id", categoryId)
        .maybeSingle();
      const catRate = (cat as { commission_rate?: number | null } | null)?.commission_rate;
      if (catRate != null) {
        result.commission_pct = Number(catRate);
        result.source.commission = "category";
      }
    }

    // ── Flat fee: seller > plan > default ─────────────────────────────────────
    if (sellerFlat != null) {
      result.flat_fee_paise = Math.max(0, Math.round(Number(sellerFlat)));
      result.source.flat_fee = "seller";
    } else if (planFlat != null) {
      result.flat_fee_paise = Math.max(0, Math.round(Number(planFlat)));
      result.source.flat_fee = "plan";
    }
  } catch {
    // Fall back to whatever defaults we resolved above.
  }

  // Defensive clamps.
  if (!Number.isFinite(result.commission_pct) || result.commission_pct < 0) result.commission_pct = 0;
  if (result.commission_pct > 1) result.commission_pct = 1;
  if (!Number.isFinite(result.flat_fee_paise) || result.flat_fee_paise < 0) result.flat_fee_paise = 0;

  return result;
}

/**
 * Compute the total platform fee (in paise) for a sale of `saleAmountPaise`.
 * fee = round(saleAmount * commission_pct) + flat_fee_paise, never exceeding
 * the sale amount (so a seller is never charged more than they collected).
 */
export function computeSaleFeePaise(saleAmountPaise: number, fees: ResolvedFees): number {
  const amount = Math.max(0, Math.round(saleAmountPaise));
  const fee = Math.round(amount * fees.commission_pct) + Math.max(0, Math.round(fees.flat_fee_paise));
  return Math.min(fee, amount);
}

/**
 * The flat platform fee added at PLAN checkout (when a seller subscribes).
 * Precedence: plan.flat_fee_paise > platform_settings.plan_flat_fee_paise.
 * Returns 0 on any error / when unset.
 */
export async function resolvePlanCheckoutFlatFee(planId: string): Promise<number> {
  try {
    const admin = createAdminClient();

    if (planId) {
      const { data: plan } = await admin
        .from("plans")
        .select("flat_fee_paise")
        .eq("id", planId)
        .maybeSingle();
      const planFlat = (plan as { flat_fee_paise?: number | null } | null)?.flat_fee_paise;
      if (planFlat != null) return Math.max(0, Math.round(Number(planFlat)));
    }

    const { data: ps } = await admin
      .from("platform_settings")
      .select("plan_flat_fee_paise")
      .maybeSingle();
    const globalFlat = (ps as { plan_flat_fee_paise?: number | null } | null)?.plan_flat_fee_paise;
    return globalFlat != null ? Math.max(0, Math.round(Number(globalFlat))) : 0;
  } catch {
    return 0;
  }
}
