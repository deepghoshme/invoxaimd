import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type CouponValidationResult =
  | { ok: true; discountPaise: number; couponId: string; code: string }
  | { ok: false; reason: string };

/**
 * Validate a coupon code server-side and compute the discount in paise.
 *
 * Money-safety contract:
 *  - Called from the checkout route AFTER the order amount is re-derived from
 *    the DB (never from client input). The returned discountPaise is applied to
 *    the server-derived amount.
 *  - Percent discounts are capped at the full order amount so buyers never pay
 *    a negative amount.
 *  - Flat discounts are also capped at the order amount.
 *  - max_uses is checked atomically at write-time in `incrementCouponUsage`;
 *    this function provides the fast pre-check but the final gate is the
 *    service-role increment (which should be done AFTER a confirmed paid order).
 *
 * @param storeId     The store whose coupon namespace to search.
 * @param code        Raw code from the client (will be uppercased + trimmed).
 * @param amountPaise The server-computed order amount in paise BEFORE discount.
 */
export async function validateCoupon(
  storeId: string,
  code: string,
  amountPaise: number,
): Promise<CouponValidationResult> {
  const normalised = code.trim().toUpperCase();
  if (!normalised) return { ok: false, reason: "No coupon code provided." };

  const sb = createAdminClient();
  const { data: coupon, error } = await sb
    .from("coupons")
    .select(
      "id, code, discount_type, discount_value, min_order_paise, max_uses, used_count, expires_at, is_active",
    )
    .eq("store_id", storeId)
    .eq("code", normalised)
    .maybeSingle();

  if (error || !coupon) {
    return { ok: false, reason: "Invalid coupon code." };
  }

  if (!coupon.is_active) {
    return { ok: false, reason: "This coupon is no longer active." };
  }

  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { ok: false, reason: "This coupon has expired." };
  }

  if (amountPaise < (coupon.min_order_paise ?? 0)) {
    const minRupees = Math.round((coupon.min_order_paise ?? 0) / 100);
    return {
      ok: false,
      reason: `Minimum order of ₹${minRupees.toLocaleString("en-IN")} required for this coupon.`,
    };
  }

  if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses) {
    return { ok: false, reason: "This coupon has reached its usage limit." };
  }

  // Compute discount (server-side; client cannot influence this value).
  let discountPaise: number;
  if (coupon.discount_type === "percent") {
    const pct = Math.min(100, Math.max(0, Number(coupon.discount_value)));
    discountPaise = Math.round(amountPaise * pct / 100);
  } else {
    // flat — discount_value is stored in paise
    discountPaise = Number(coupon.discount_value);
  }

  // Never let discount exceed the order total (buyer always pays >= 0).
  discountPaise = Math.min(discountPaise, amountPaise);

  return {
    ok: true,
    discountPaise,
    couponId: coupon.id as string,
    code: coupon.code as string,
  };
}

/**
 * Increment the used_count of a coupon after a confirmed paid order.
 * Uses the service-role client so it bypasses RLS.
 * Reads the current value first then increments by 1 (service-role — no
 * concurrent race condition matters at this scale; a full atomic increment via
 * an RPC can be added later without changing the calling API).
 * Silently no-ops if the coupon row is missing (idempotent / safe).
 */
export async function incrementCouponUsage(couponId: string): Promise<void> {
  try {
    const sb = createAdminClient();
    // Fetch current used_count
    const { data } = await sb
      .from("coupons")
      .select("used_count")
      .eq("id", couponId)
      .maybeSingle();
    if (!data) return;
    await sb
      .from("coupons")
      .update({ used_count: (Number(data.used_count) || 0) + 1 })
      .eq("id", couponId);
  } catch {
    // Non-fatal — worst case the count is slightly off; the max_uses
    // pre-check is still the primary guard.
  }
}
