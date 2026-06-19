"use server";

/**
 * Server action: submit a product review from the buyer's order-detail page.
 *
 * Money-safety / security model:
 * - Uses the SESSION client (buyer's own JWT) — RLS enforces:
 *   1. buyer_id = auth.uid() (self-attribution)
 *   2. public.has_purchased(page_id, product_id) must be true
 * - We also verify ownership of the order ourselves via getBuyerOrder (RLS-scoped),
 *   which returns null for any order not owned by this buyer. This means a buyer
 *   cannot forge orderId to leave a review for a product they did not buy.
 * - Admin/service-role client is NOT used; no RLS bypass.
 * - Unique index on order_id prevents duplicate reviews; we catch the unique-
 *   violation error (PostgreSQL code 23505) and return a friendly message.
 */

import { createClient } from "@/lib/supabase/server";
import { getBuyerOrder } from "@/lib/buyer";

export type ReviewResult = { ok: true } | { ok: false; error: string };

export async function submitReview({
  orderId,
  rating,
  body,
}: {
  orderId: string;
  rating: number;
  body: string;
}): Promise<ReviewResult> {
  // ── 1. Basic input validation ─────────────────────────────────────────────
  if (!orderId || typeof orderId !== "string") {
    return { ok: false, error: "Invalid order." };
  }

  const ratingInt = Math.round(rating);
  if (!Number.isFinite(ratingInt) || ratingInt < 1 || ratingInt > 5) {
    return { ok: false, error: "Rating must be between 1 and 5 stars." };
  }

  const bodyTrimmed = (body ?? "").trim();
  if (bodyTrimmed.length > 2000) {
    return { ok: false, error: "Review text must be 2000 characters or fewer." };
  }

  // ── 2. Auth check ──────────────────────────────────────────────────────────
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in to leave a review." };
  }

  // ── 3. Verify order ownership and derive metadata ─────────────────────────
  // getBuyerOrder uses the session-bound RLS client, so it returns null for any
  // order that does not belong to this buyer. A buyer cannot forge orderId to
  // get another buyer's store_id/page_id/product_id.
  const order = await getBuyerOrder(orderId);

  if (!order) {
    return { ok: false, error: "Order not found." };
  }

  if (order.status !== "paid") {
    return { ok: false, error: "You can only review paid orders." };
  }

  // ── 4. Insert the review (RLS + has_purchased() gate it server-side) ──────
  const { error: insertError } = await sb.from("product_reviews").insert({
    store_id: order.store_id,
    page_id: order.page_id,
    product_id: order.product_id ?? null,
    order_id: order.id,
    buyer_id: user.id,
    buyer_email: order.buyer_email ?? user.email ?? null,
    buyer_name: order.buyer_name ?? null,
    rating: ratingInt,
    body: bodyTrimmed || null,
    // status defaults to 'approved', is_visible defaults to true in the DB
  });

  if (insertError) {
    // PostgreSQL unique-violation code: 23505
    if (
      insertError.code === "23505" ||
      insertError.message?.toLowerCase().includes("unique")
    ) {
      return {
        ok: false,
        error: "You have already reviewed this order.",
      };
    }

    // RLS policy rejection (has_purchased check failed or self-attribution mismatch)
    if (
      insertError.code === "42501" ||
      insertError.message?.toLowerCase().includes("policy")
    ) {
      return {
        ok: false,
        error: "Review not allowed — purchase could not be verified.",
      };
    }

    console.error("[submitReview] insert error", insertError);
    return { ok: false, error: "Failed to submit review. Please try again." };
  }

  return { ok: true };
}
