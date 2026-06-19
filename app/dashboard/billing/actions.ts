"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertSubscription } from "@/lib/subscriptions";
import { assertNotImpersonating } from "@/lib/impersonation";

type Result = { ok: boolean; error?: string };

/**
 * Select or change a plan for the signed-in seller.
 *
 * Money-safety:
 *  1. We fetch the plan price AND interval from the DB server-side — never
 *     trust the client.
 *  2. amount_paise is derived exclusively from plans.price (INR) * 100.
 *  3. The upsert goes through the service-role client (RLS bypassed but
 *     constrained by our own code-level auth check: must be signed-in seller
 *     with a store).
 *  4. selectPlan is only called for FREE plan selection (price = 0).
 *     Paid plans are handled entirely by the Razorpay subscribe/verify flow
 *     (BillingClient → /api/plans/subscribe/start → /api/plans/subscribe/verify)
 *     and never reach this function.
 *  5. Period end is interval-aware: monthly → +1 month, annual → +1 year.
 *     For free plans interval is always "monthly" but we branch defensively.
 */
export async function selectPlan(planId: string): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  // 1. Verify caller is a signed-in user
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // 2. Fetch the plan price and interval server-side (never trust client-sent price)
  const admin = createAdminClient();
  const { data: plan, error: planErr } = await admin
    .from("plans")
    .select("id, name, price, interval, is_active")
    .eq("id", planId)
    .eq("is_active", true)
    .maybeSingle();

  if (planErr || !plan) return { ok: false, error: "Plan not found or inactive." };

  // 3. Get the seller's store (service-role so we can look it up without RLS
  //    gymnastics — but we still verify owner_id === user.id)
  const { data: store, error: storeErr } = await admin
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (storeErr || !store) return { ok: false, error: "No store found for your account." };

  // 4. Derive amount_paise from server-side plan price (price is INR)
  const amountPaise = plan.price * 100;

  // 5. current_period_end: branch on plan interval.
  //    Monthly → +1 calendar month. Annual → +1 calendar year.
  //    Free plans are always monthly but we branch defensively.
  const planInterval: "monthly" | "annual" = plan.interval === "annual" ? "annual" : "monthly";
  const periodEnd = new Date();
  if (planInterval === "annual") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  // 6. Upsert the subscription (creates or updates the store's single sub row)
  const result = await upsertSubscription({
    storeId: store.id,
    planId: plan.id,
    amountPaise,
    periodEndDate: periodEnd,
  });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/dashboard/billing");
  return { ok: true };
}
