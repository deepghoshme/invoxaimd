"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertNotImpersonating } from "@/lib/impersonation";

type Result = { ok: boolean; error?: string };

/** Resolve the current user's store_id using the session client (RLS-scoped). */
async function getOwnStoreId(): Promise<{ ok: true; storeId: string } | { ok: false; error: string }> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data: store } = await sb
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) return { ok: false, error: "No store found." };
  return { ok: true, storeId: store.id };
}

/**
 * Save a seller reply on a review.
 * Uses the session client so the RLS UPDATE policy (owns_store) enforces
 * the caller can only edit their own store's reviews.
 * Sets seller_reply + replied_at = now().
 * Validates reply length <= 2000 chars.
 */
export async function replyToReview(reviewId: string, reply: string): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  if (!reviewId || typeof reviewId !== "string") {
    return { ok: false, error: "Invalid review ID." };
  }

  const trimmed = reply.trim();
  if (!trimmed) {
    return { ok: false, error: "Reply cannot be empty." };
  }
  if (trimmed.length > 2000) {
    return { ok: false, error: "Reply must be 2000 characters or fewer." };
  }

  const storeRes = await getOwnStoreId();
  if (!storeRes.ok) return storeRes;

  const sb = await createClient();
  const { error } = await sb
    .from("product_reviews")
    .update({
      seller_reply: trimmed,
      replied_at: new Date().toISOString(),
    })
    // belt-and-suspenders: explicit store_id guard in addition to RLS
    .eq("id", reviewId)
    .eq("store_id", storeRes.storeId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/reviews");
  return { ok: true };
}

/**
 * Toggle a review's public visibility.
 * Sets both is_visible and status so that the public_read RLS policy
 * (which requires is_visible=true AND status='approved') correctly hides
 * or shows the review on the PDP.
 *
 * visible=false  → is_visible=false, status='hidden'
 * visible=true   → is_visible=true,  status='approved'
 */
export async function setReviewVisibility(reviewId: string, visible: boolean): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  if (!reviewId || typeof reviewId !== "string") {
    return { ok: false, error: "Invalid review ID." };
  }

  const storeRes = await getOwnStoreId();
  if (!storeRes.ok) return storeRes;

  const sb = await createClient();
  const { error } = await sb
    .from("product_reviews")
    .update({
      is_visible: visible,
      status: visible ? "approved" : "hidden",
    })
    .eq("id", reviewId)
    .eq("store_id", storeRes.storeId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/reviews");
  return { ok: true };
}
