import "server-only";

/**
 * Plan-expiry gate: determines whether a store should be stopped because its
 * paid subscription has expired (past_due).
 *
 * Design mirrors walletGate.ts — a pure function that receives the subscription
 * status value so callers can batch-load it and avoid extra DB round-trips.
 *
 * WHO GETS STOPPED (exactly):
 *   - A seller who bought a PAID plan and it entered past_due status.
 *     The cron job (expireOverdueSubscriptions) sets status=past_due when
 *     current_period_end < now() for an active subscription.
 *
 * WHO IS NEVER STOPPED:
 *   - Free-plan sellers: no subscription row at all (null) → not stopped.
 *   - Sellers who deliberately canceled (status='canceled') → not stopped here.
 *     Cancellation is a voluntary act; past_due is involuntary (payment missed).
 *   - Any case where the subscription status cannot be determined (null/error)
 *     → fail OPEN: do not stop (infrastructure hiccup must not take all stores down).
 *
 * REVERSIBILITY:
 *   When a seller renews, app/api/plans/subscribe/verify calls upsertSubscription
 *   which sets status='active' and current_period_end to a future date.
 *   The very next checkout attempt will see status='active' and pass immediately.
 *   No manual admin intervention is required.
 *
 * FAIL-OPEN:
 *   isStoreStoppedForPlan returns false (not stopped) when status is null or any
 *   unrecognised value. The caller should also wrap any DB call in try/catch and
 *   fail open on error (i.e. treat exception as "not stopped").
 */

export type PlanGateStatus = "active" | "past_due" | "canceled" | null;

export type PlanGateResult = {
  /** true only when the store should be stopped (paid plan is past_due). */
  stopped: boolean;
  /** Short machine-readable reason for logging. Never expose to buyers. */
  reason: string;
};

/**
 * Pure function — no DB calls. Receives the subscription status value (or null
 * if no subscription row exists) and returns the gate decision.
 *
 * @param status - The subscriptions.status value for the store, or null when the
 *   store has no subscription row (= free-plan seller) or the DB call failed.
 */
export function isStoreStoppedForPlan(status: PlanGateStatus): PlanGateResult {
  if (status === "past_due") {
    return { stopped: true, reason: "subscription_past_due" };
  }
  // null  → free-plan seller (no row) or DB error → fail open
  // 'active'   → healthy paid plan
  // 'canceled' → seller voluntarily canceled; do not auto-stop
  return { stopped: false, reason: status ?? "no_subscription" };
}
