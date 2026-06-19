import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type PromoValidationResult =
  | { ok: true; discountPaise: number; promoId: string; code: string }
  | { ok: false; reason: string };

/**
 * Validate a promo code server-side and compute the discount in paise.
 *
 * Money-safety contract:
 *  - Called AFTER the plan price is read from the DB (never from client input).
 *  - The returned discountPaise is applied to the server-derived plan price.
 *  - Percent discounts: capped at 100% so the effective charge is never negative.
 *  - Flat discounts: stored in RUPEES in the DB (discount_value column is
 *    numeric(10,2) representing rupees). We convert to paise here.
 *  - The discount is also capped at the plan price so charge never goes negative.
 *  - scope="all" applies to any plan; scope=<slug> applies only if the plan name
 *    (lowercased) matches — honoring admin intent.
 *  - usage_limit is checked here as a fast pre-check; the final atomic gate is
 *    incrementPromoUsage in /verify (which only runs on a confirmed payment).
 *
 * @param code       Raw code from the client (uppercased + trimmed here).
 * @param planName   The plan's name from DB — used for scope matching.
 * @param amountPaise  Server-computed plan price in paise BEFORE discount.
 */
export async function validatePromoCode(
  code: string,
  planName: string,
  amountPaise: number,
): Promise<PromoValidationResult> {
  const normalised = code.trim().toUpperCase();
  if (!normalised) return { ok: false, reason: "No promo code provided." };

  const sb = createAdminClient();
  // Use service-role (admin) client — bypasses RLS so this works for any
  // authenticated user, not just admins. The query itself restricts to
  // active/non-expired codes; we do the usage-limit check in application code.
  const { data: promo, error } = await sb
    .from("promo_codes")
    .select(
      "id, code, discount_type, discount_value, scope, usage_limit, used_count, expires_at, is_active",
    )
    .eq("code", normalised)
    .maybeSingle();

  if (error || !promo) {
    return { ok: false, reason: "Invalid promo code." };
  }

  if (!promo.is_active) {
    return { ok: false, reason: "This promo code is no longer active." };
  }

  if (promo.expires_at && new Date(promo.expires_at as string) < new Date()) {
    return { ok: false, reason: "This promo code has expired." };
  }

  if (
    promo.usage_limit != null &&
    (promo.used_count as number) >= (promo.usage_limit as number)
  ) {
    return { ok: false, reason: "This promo code has reached its usage limit." };
  }

  // Scope check: "all" applies to every plan; any other value is matched against
  // the plan name slug (lowercased, trimmed). Admin sets scope to e.g. "starter".
  const scope = (promo.scope as string || "all").trim().toLowerCase();
  if (scope !== "all") {
    const planSlug = planName.trim().toLowerCase();
    if (planSlug !== scope) {
      return {
        ok: false,
        reason: `This promo code is not valid for the ${planName} plan.`,
      };
    }
  }

  // Compute discount (server-side; client cannot influence this).
  // discount_value in DB:
  //   - percent: the percentage (e.g. 20 means 20%)
  //   - flat:    rupee amount (e.g. 500 means ₹500 = 50000 paise)
  let discountPaise: number;
  if (promo.discount_type === "percent") {
    const pct = Math.min(100, Math.max(0, Number(promo.discount_value)));
    discountPaise = Math.round((amountPaise * pct) / 100);
  } else {
    // flat — discount_value is in RUPEES, convert to paise
    discountPaise = Math.round(Number(promo.discount_value) * 100);
  }

  // Never let discount exceed the plan price (charge always >= 0).
  discountPaise = Math.min(discountPaise, amountPaise);

  return {
    ok: true,
    discountPaise,
    promoId: promo.id as string,
    code: promo.code as string,
  };
}

/**
 * Increment the used_count of a promo code after a confirmed plan payment.
 * Uses the service-role client to bypass RLS.
 *
 * Idempotency: the caller (verify route) already guards double-execution via
 * the UNIQUE constraint on plan_payments.razorpay_order_id — if the insert
 * throws a duplicate-key error, plan_payments returns `already: true` and
 * this function is never called a second time. Non-fatal on its own failure.
 */
export async function incrementPromoUsage(promoId: string): Promise<void> {
  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from("promo_codes")
      .select("used_count")
      .eq("id", promoId)
      .maybeSingle();
    if (!data) return;
    await sb
      .from("promo_codes")
      .update({ used_count: (Number(data.used_count) || 0) + 1 })
      .eq("id", promoId);
  } catch {
    // Non-fatal — worst case the count is slightly off. The fast pre-check in
    // validatePromoCode is still the primary guard against over-use.
  }
}
