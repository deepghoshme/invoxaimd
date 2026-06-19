import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type Subscription = {
  id: string;
  store_id: string;
  plan_id: string;
  status: "active" | "canceled" | "past_due";
  amount_paise: number;
  started_at: string;
  period_start: string | null;
  current_period_end: string;
  created_at: string;
  updated_at: string;
};

export type SubscriptionWithPlan = Subscription & {
  plan: { id: string; name: string; price: number; features: string[]; contact_limit: number | null };
};

/**
 * Get the current subscription for a store, joined with plan data.
 * Uses service-role to bypass RLS so this works in server actions and
 * server components regardless of session state.
 * Returns null if the subscriptions table doesn't exist yet (graceful
 * degradation before migration is applied).
 */
export async function getStoreSubscription(
  storeId: string
): Promise<SubscriptionWithPlan | null> {
  const sb = createAdminClient();
  try {
    const { data, error } = await sb
      .from("subscriptions")
      .select("*, plan:plans(id, name, price, features, contact_limit)")
      .eq("store_id", storeId)
      .maybeSingle();

    if (error) {
      // Graceful degradation: table doesn't exist yet
      if (error.message?.includes("subscriptions") || error.code === "PGRST205" || error.code === "42P01") {
        return null;
      }
      throw error;
    }
    return data as SubscriptionWithPlan | null;
  } catch {
    return null;
  }
}

/**
 * Upsert a subscription for a store. Creates a new active subscription or
 * updates the existing one (status → active, new plan, new period).
 * Sets period_start = now() so future proration calculations have an
 * unambiguous period start.
 * Called from server actions only — uses service-role to bypass RLS.
 * Returns the upserted row or an error message.
 */
export async function upsertSubscription(params: {
  storeId: string;
  planId: string;
  amountPaise: number;
  periodEndDate: Date;
}): Promise<{ ok: true; sub: Subscription } | { ok: false; error: string }> {
  const sb = createAdminClient();
  const now = new Date().toISOString();
  try {
    const { data, error } = await sb
      .from("subscriptions")
      .upsert(
        {
          store_id: params.storeId,
          plan_id: params.planId,
          status: "active",
          amount_paise: params.amountPaise,
          started_at: now,
          period_start: now,
          current_period_end: params.periodEndDate.toISOString(),
        },
        { onConflict: "store_id", ignoreDuplicates: false }
      )
      .select()
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, sub: data as Subscription };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

/**
 * Compute the unused-balance credit (in paise) from a current active plan,
 * to be applied as a discount when upgrading to a more expensive plan.
 *
 * Formula:
 *   remainingFraction = max(0, periodEnd - now) / (periodEnd - periodStart)
 *   credit_paise = round(currentAmountPaise * remainingFraction)
 *   clamped to [0, currentAmountPaise]
 *
 * Money-safety:
 * - All inputs come exclusively from stored DB rows — never from the client.
 * - If periodStart is null, falls back to startedAt; if neither is available,
 *   returns 0 (safe: no credit is better than an inflated credit).
 * - Pure function — no side effects, no DB calls.
 */
export function computeUpgradeCredit(params: {
  currentAmountPaise: number;
  periodStart: string | null;   // subscriptions.period_start (nullable)
  startedAt: string | null;     // subscriptions.started_at (fallback)
  periodEnd: string;            // subscriptions.current_period_end
  now: Date;
}): number {
  const { currentAmountPaise, periodStart, startedAt, periodEnd, now } = params;

  if (currentAmountPaise <= 0) return 0;

  // Resolve the start of the current billing period.
  const startIso = periodStart ?? startedAt;
  if (!startIso) return 0; // No period info available — safe: give no credit.

  const start = new Date(startIso).getTime();
  const end = new Date(periodEnd).getTime();
  const nowMs = now.getTime();

  const totalMs = end - start;
  if (totalMs <= 0) return 0; // Degenerate period — no credit.

  const remainingMs = end - nowMs;
  if (remainingMs <= 0) return 0; // Period already expired — no credit.

  const fraction = remainingMs / totalMs;
  // Clamp to [0, 1] defensively (fraction can't exceed 1 but guard anyway).
  const safeFraction = Math.min(1, Math.max(0, fraction));
  const credit = Math.round(currentAmountPaise * safeFraction);

  // Final clamp: credit can never exceed what the user originally paid.
  return Math.min(credit, currentAmountPaise);
}

/**
 * Compute plan MRR (in paise) from all active subscriptions.
 * Returns 0 and activeCount=0 gracefully if the table doesn't exist yet.
 */
export async function getPlanMrr(): Promise<{
  mrrPaise: number;
  activeCount: number;
}> {
  const sb = createAdminClient();
  try {
    const { data, error } = await sb
      .from("subscriptions")
      .select("amount_paise")
      .eq("status", "active");

    if (error) {
      // Table doesn't exist — degrade to zero
      return { mrrPaise: 0, activeCount: 0 };
    }

    const rows = data ?? [];
    const mrrPaise = rows.reduce((s, r) => s + (r.amount_paise ?? 0), 0);
    return { mrrPaise, activeCount: rows.length };
  } catch {
    return { mrrPaise: 0, activeCount: 0 };
  }
}
