import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOrderRecord, getProductById } from "@/lib/sites";
import { resolveFees, computeSaleFeePaise } from "@/lib/platform-fees";
import { type OppContent, toMinorUnit, DEFAULT_CURRENCY } from "@/lib/products";
import { validateCoupon } from "@/lib/coupons";
import { bumpApplies, bumpPricePaise, type BumpOffer } from "@/lib/upsell";

/**
 * Resolve and price an order-bump SERVER-SIDE. The client only sends an offer id;
 * the price is recomputed here so a tampered amount can never be charged. Returns
 * null (silently ignore) if the offer isn't a valid, active bump for this store /
 * cart, or its product is missing / sold out / unpriced.
 */
async function resolveBump(
  storeId: string,
  bumpOfferId: string | undefined,
  cartProductId: string | null,
  fallbackCurrency: string,
): Promise<{ offerId: string; bumpPaise: number; bumpTitle: string } | null> {
  if (!bumpOfferId) return null;
  const sb = createAdminClient();
  const { data: offer } = await sb
    .from("upsell_offers")
    .select("*")
    .eq("id", bumpOfferId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!offer || !bumpApplies(offer as BumpOffer, cartProductId)) return null;

  const { data: p } = await sb
    .from("products")
    .select("id, name, price, currency, stock, store_visible")
    .eq("id", (offer as BumpOffer).offer_product_id)
    .maybeSingle();
  if (!p || p.store_visible === false) return null;
  if (p.stock != null && Number(p.stock) <= 0) return null;

  const cur = (((p.currency as string) || fallbackCurrency)).toUpperCase();
  const originalPaise = toMinorUnit(Number(p.price ?? 0), cur);
  if (originalPaise <= 0) return null;

  return {
    offerId: offer.id as string,
    bumpPaise: bumpPricePaise(offer as BumpOffer, originalPaise, cur),
    bumpTitle: (p.name as string) || "Add-on",
  };
}

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
    bump_offer_id?: string;
    // Index into content.plans for multi-plan PDP pages. The price is re-read
    // server-side from the plan so the buyer is charged exactly the plan they
    // selected (the displayed price), never the base content.price.
    plan_index?: number;
    // Passed by booking flow so the order row carries the buyer's identity,
    // enabling precise booking confirmation at verify time.
    buyer_email?: string;
    buyer_name?: string;
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
    let couponError: string | null = null;

    if (rawCouponCode) {
      const couponResult = await validateCoupon(storeId, rawCouponCode, originalAmount);
      if (couponResult.ok) {
        discountPaise = couponResult.discountPaise;
        appliedCouponCode = couponResult.code;
        finalAmount = originalAmount - discountPaise;
        // Ensure final amount is always >= 1 paise (gateway minimum)
        if (finalAmount < 1) finalAmount = 1;
      } else {
        couponError = couponResult.reason;
      }
    }

    // ── Order-bump (priced server-side; adds to the charged total) ───────────
    const bump = await resolveBump(storeId, body.bump_offer_id, product.id as string, currency);
    if (bump) finalAmount += bump.bumpPaise;

    // Platform fee = commission % + flat fee (server-resolved; seller > plan >
    // category > global). commission_amount carries the TOTAL platform fee that
    // is debited from the seller's wallet at verify; commission_rate keeps the
    // %-only component for reporting/back-compat.
    const fees = await resolveFees(storeId);
    const order = await createOrderRecord({
      store_id: storeId,
      page_id: null,
      product_id: product.id as string,
      page_type: "store",
      product_title: title,
      amount: finalAmount,
      currency,
      commission_rate: fees.commission_pct,
      commission_amount: computeSaleFeePaise(finalAmount, fees),
      coupon_code: appliedCouponCode,
      discount_paise: discountPaise > 0 ? discountPaise : null,
      original_amount_paise: discountPaise > 0 ? originalAmount : null,
      bump_offer_id: bump?.offerId ?? null,
      bump_amount: bump?.bumpPaise ?? null,
      bump_title: bump?.bumpTitle ?? null,
    });
    if (!order) return NextResponse.json({ error: "Could not create order" }, { status: 500 });

    // Coupon usage is incremented at payment verification (see verify route), so
    // abandoned/cancelled checkouts don't consume a use. validateCoupon's
    // pre-check + max_uses guard still bound concurrent in-flight checkouts.

    return NextResponse.json({
      order_id: order.id,
      page_type: "store",
      ...(couponError ? { coupon_error: couponError } : {}),
      ...(discountPaise > 0 ? { discount_paise: discountPaise, original_amount_paise: originalAmount } : {}),
      ...(bump ? { bump_offer_id: bump.offerId, bump_paise: bump.bumpPaise, bump_title: bump.bumpTitle } : {}),
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
  if (page.page_type !== "opp" && page.page_type !== "course" && page.page_type !== "booking") {
    return NextResponse.json({ error: "Unsupported page type" }, { status: 400 });
  }

  // ── Read price from DB (never trust client-sent amounts) ───────────────────
  // All three supported page types store their price in content.price (major
  // currency units, e.g. rupees). BookingContent also has is_free; honour it.
  const content = (page.content ?? {}) as OppContent & { is_free?: boolean };
  const currency = ((content.currency as string | undefined) || DEFAULT_CURRENCY).toUpperCase();

  // Booking-specific: is_free flag overrides the price field.
  if (page.page_type === "booking" && content.is_free === true) {
    return NextResponse.json({ error: "This session is free — no checkout needed" }, { status: 400 });
  }

  // If the page exposes selectable plans (e.g. a subscription PDP), the buyer is
  // shown and charged the SELECTED plan's price. Re-read it server-side from the
  // validated index so a tampered amount can never be charged, and so the charged
  // total always matches what the storefront displayed.
  const plans = Array.isArray((content as Record<string, unknown>).plans)
    ? ((content as Record<string, unknown>).plans as Array<{ label?: string; price?: number }>).filter((p) => p && p.label)
    : [];
  let basePriceMajor = (content.price as number | undefined) ?? 0;
  let planTitleSuffix = "";
  if (plans.length > 0) {
    const idx = Number.isInteger(body.plan_index) ? (body.plan_index as number) : 0;
    const plan = plans[idx] ?? plans[0];
    basePriceMajor = Number(plan?.price ?? 0);
    if (plan?.label) planTitleSuffix = ` — ${plan.label}`;
  }
  const originalAmount = toMinorUnit(basePriceMajor, currency);
  if (originalAmount <= 0) {
    return NextResponse.json({ error: "This product has no price set" }, { status: 400 });
  }

  // ── Coupon validation for opp pages ──────────────────────────────────────
  let finalAmount = originalAmount;
  let discountPaise = 0;
  let appliedCouponCode: string | null = null;
  let couponError: string | null = null;

  if (rawCouponCode) {
    const couponResult = await validateCoupon(page.store_id, rawCouponCode, originalAmount);
    if (couponResult.ok) {
      discountPaise = couponResult.discountPaise;
      appliedCouponCode = couponResult.code;
      finalAmount = originalAmount - discountPaise;
      if (finalAmount < 1) finalAmount = 1;
    } else {
      couponError = couponResult.reason;
    }
  }

  // ── Order-bump (priced server-side). Pages aren't catalog products, so only
  // "any"-trigger bumps apply here. ─────────────────────────────────────────
  const bump = await resolveBump(page.store_id, body.bump_offer_id, null, currency);
  if (bump) finalAmount += bump.bumpPaise;

  const fees = await resolveFees(page.store_id);
  // Derive a human-readable product title across all supported page types.
  const productTitle =
    ((content as Record<string, unknown>).headline as string | undefined
      || (content as Record<string, unknown>).title as string | undefined
      || page.title
      || "Product") + planTitleSuffix;

  // Optional buyer identity (provided by the booking flow; ignored for opp/course).
  const buyerEmail = typeof body.buyer_email === "string" ? body.buyer_email.trim().slice(0, 300) || null : null;
  const buyerName  = typeof body.buyer_name  === "string" ? body.buyer_name.trim().slice(0, 200)  || null : null;

  const order = await createOrderRecord({
    store_id: page.store_id,
    page_id: page.id,
    page_type: page.page_type,
    product_title: productTitle,
    amount: finalAmount,
    currency,
    commission_rate: fees.commission_pct,
    commission_amount: computeSaleFeePaise(finalAmount, fees),
    coupon_code: appliedCouponCode,
    discount_paise: discountPaise > 0 ? discountPaise : null,
    original_amount_paise: discountPaise > 0 ? originalAmount : null,
    bump_offer_id: bump?.offerId ?? null,
    bump_amount: bump?.bumpPaise ?? null,
    bump_title: bump?.bumpTitle ?? null,
    ...(buyerEmail ? { buyer_email: buyerEmail } : {}),
    ...(buyerName  ? { buyer_name:  buyerName  } : {}),
  });

  if (!order) return NextResponse.json({ error: "Could not create order" }, { status: 500 });

  // Coupon usage is incremented at payment verification (see verify route).

  return NextResponse.json({
    order_id: order.id,
    page_type: page.page_type,
    ...(couponError ? { coupon_error: couponError } : {}),
    ...(discountPaise > 0 ? { discount_paise: discountPaise, original_amount_paise: originalAmount } : {}),
    ...(bump ? { bump_offer_id: bump.offerId, bump_paise: bump.bumpPaise, bump_title: bump.bumpTitle } : {}),
  });
}
