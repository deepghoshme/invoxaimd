import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStoreCommissionRate, createOrderRecord, getProductById } from "@/lib/sites";
import { type OppContent, toMinorUnit, DEFAULT_CURRENCY } from "@/lib/products";
import { validateCoupon, incrementCouponUsage } from "@/lib/coupons";

/**
 * Create an internal order for either a published one-page (`opp`) page OR a
 * store catalog product (`product_id`). Amount is taken from the DB (never
 * trusted from the client). Returns the order id for the checkout flow.
 *
 * Optional coupon support:
 *  - Client may pass `coupon_code` in the request body.
 *  - The code is validated SERVER-SIDE via lib/coupons.ts against the DB.
 *  - Discount is computed server-side; client-sent discounted amounts are
 *    NEVER trusted.
 *  - If validation fails the order is still created at the full price
 *    (so checkout can proceed), but the response includes `coupon_error`
 *    to let the UI surface the issue.
 *  - If validation passes, `discount_paise` and `original_amount_paise` are
 *    stored on the order row and `discountPaise` is returned to the client.
 */
export async function POST(req: Request) {
  let body: {
    page_id?: string;
    product_id?: string;
    qty?: number;
    variant?: string;
    coupon_code?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const rawCouponCode = typeof body.coupon_code === "string" ? body.coupon_code.trim() : "";

  // ── Store catalog product checkout ────────────────────────────────────────
  if (body.product_id) {
    const product = await getProductById(body.product_id);
    if (!product || product.store_visible === false) {
      return NextResponse.json({ error: "Product not available" }, { status: 404 });
    }
    if (product.stock != null && Number(product.stock) <= 0) {
      return NextResponse.json({ error: "This product is sold out" }, { status: 409 });
    }
    const currency = ((product.currency as string) || DEFAULT_CURRENCY).toUpperCase();
    const qty = Math.max(1, Math.min(99, Math.round(Number(body.qty) || 1)));
    const unit = toMinorUnit(Number(product.price ?? 0), currency);
    const originalAmount = unit * qty;
    if (originalAmount <= 0) {
      return NextResponse.json({ error: "This product has no price set" }, { status: 400 });
    }
    const variant = typeof body.variant === "string" ? body.variant.slice(0, 120).trim() : "";
    const baseTitle = (product.name as string) || "Product";
    const title = `${baseTitle}${variant ? ` (${variant})` : ""}${qty > 1 ? ` ×${qty}` : ""}`;
    const storeId = product.store_id as string;

    // ── Coupon validation (server-side) ──────────────────────────────────────
    let finalAmount = originalAmount;
    let discountPaise = 0;
    let appliedCouponCode: string | null = null;
    let appliedCouponId: string | null = null;
    let couponError: string | null = null;

    if (rawCouponCode) {
      const couponResult = await validateCoupon(storeId, rawCouponCode, originalAmount);
      if (couponResult.ok) {
        discountPaise = couponResult.discountPaise;
        appliedCouponCode = couponResult.code;
        appliedCouponId = couponResult.couponId;
        finalAmount = originalAmount - discountPaise;
        // Ensure final amount is always >= 1 paise (gateway minimum)
        if (finalAmount < 1) finalAmount = 1;
      } else {
        couponError = couponResult.reason;
      }
    }

    const rate = await getStoreCommissionRate(storeId);
    const order = await createOrderRecord({
      store_id: storeId,
      page_id: null,
      product_id: product.id as string,
      page_type: "store",
      product_title: title,
      amount: finalAmount,
      currency,
      commission_rate: rate,
      commission_amount: Math.round(finalAmount * rate),
      coupon_code: appliedCouponCode,
      discount_paise: discountPaise > 0 ? discountPaise : null,
      original_amount_paise: discountPaise > 0 ? originalAmount : null,
    });
    if (!order) return NextResponse.json({ error: "Could not create order" }, { status: 500 });

    // Increment coupon usage in the background (non-blocking, non-fatal).
    // NOTE: used_count is bumped here at order creation. Ideally this should
    // happen only on confirmed payment (verify route). Follow-up task: move
    // incrementCouponUsage to the verify route so cancelled payments don't
    // consume coupon uses. For now the pre-check in validateCoupon + the
    // max_uses guard provide adequate protection.
    if (appliedCouponId) {
      incrementCouponUsage(appliedCouponId).catch(() => {});
    }

    return NextResponse.json({
      order_id: order.id,
      page_type: "store",
      ...(couponError ? { coupon_error: couponError } : {}),
      ...(discountPaise > 0 ? { discount_paise: discountPaise, original_amount_paise: originalAmount } : {}),
    });
  }

  // ── One-page product checkout ─────────────────────────────────────────────
  const pageId = body.page_id;
  if (!pageId) return NextResponse.json({ error: "Missing page_id" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: page } = await supabase
    .from("pages")
    .select("id, store_id, page_type, title, content, status")
    .eq("id", pageId)
    .maybeSingle();

  if (!page || page.status !== "published") {
    return NextResponse.json({ error: "Product not available" }, { status: 404 });
  }
  if (page.page_type !== "opp") {
    return NextResponse.json({ error: "Unsupported page type" }, { status: 400 });
  }

  const content = (page.content ?? {}) as OppContent;
  const currency = (content.currency || DEFAULT_CURRENCY).toUpperCase();
  const originalAmount = toMinorUnit(content.price ?? 0, currency);
  if (originalAmount <= 0) {
    return NextResponse.json({ error: "This product has no price set" }, { status: 400 });
  }

  // ── Coupon validation for opp pages ──────────────────────────────────────
  let finalAmount = originalAmount;
  let discountPaise = 0;
  let appliedCouponCode: string | null = null;
  let appliedCouponId: string | null = null;
  let couponError: string | null = null;

  if (rawCouponCode) {
    const couponResult = await validateCoupon(page.store_id, rawCouponCode, originalAmount);
    if (couponResult.ok) {
      discountPaise = couponResult.discountPaise;
      appliedCouponCode = couponResult.code;
      appliedCouponId = couponResult.couponId;
      finalAmount = originalAmount - discountPaise;
      if (finalAmount < 1) finalAmount = 1;
    } else {
      couponError = couponResult.reason;
    }
  }

  const rate = await getStoreCommissionRate(page.store_id);
  const order = await createOrderRecord({
    store_id: page.store_id,
    page_id: page.id,
    page_type: page.page_type,
    product_title: content.headline || page.title || "Product",
    amount: finalAmount,
    currency,
    commission_rate: rate,
    commission_amount: Math.round(finalAmount * rate),
    coupon_code: appliedCouponCode,
    discount_paise: discountPaise > 0 ? discountPaise : null,
    original_amount_paise: discountPaise > 0 ? originalAmount : null,
  });

  if (!order) return NextResponse.json({ error: "Could not create order" }, { status: 500 });

  if (appliedCouponId) {
    incrementCouponUsage(appliedCouponId).catch(() => {});
  }

  return NextResponse.json({
    order_id: order.id,
    page_type: page.page_type,
    ...(couponError ? { coupon_error: couponError } : {}),
    ...(discountPaise > 0 ? { discount_paise: discountPaise, original_amount_paise: originalAmount } : {}),
  });
}
