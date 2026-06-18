"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertNotImpersonating } from "@/lib/impersonation";

type Result = { ok: boolean; error?: string };

/** Return the current user's store_id, or an error. */
async function getOwnStoreId(): Promise<{ ok: true; storeId: string } | { ok: false; error: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data: store } = await sb.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
  if (!store) return { ok: false, error: "No store found." };
  return { ok: true, storeId: store.id };
}

export type CreateCouponInput = {
  code: string;
  discount_type: "percent" | "flat";
  discount_value: number;       // percent: 1-100; flat: rupees (we convert to paise)
  min_order_rupees: number;     // minimum order in rupees (converted to paise)
  max_uses: number | null;
  applies_to: string;
  expires_at: string | null;    // ISO date string or null
};

export async function createCoupon(input: CreateCouponInput): Promise<Result & { id?: string }> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const storeRes = await getOwnStoreId();
  if (!storeRes.ok) return storeRes;

  const code = input.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!code) return { ok: false, error: "Invalid coupon code. Use letters and numbers only." };
  if (code.length < 3 || code.length > 30) {
    return { ok: false, error: "Code must be 3–30 characters." };
  }

  if (input.discount_type === "percent") {
    if (input.discount_value < 1 || input.discount_value > 100) {
      return { ok: false, error: "Percent discount must be between 1 and 100." };
    }
  } else {
    if (input.discount_value < 1) {
      return { ok: false, error: "Flat discount must be at least ₹1." };
    }
  }

  // Convert to paise for flat discounts
  const discountValuePaise =
    input.discount_type === "flat"
      ? Math.round(input.discount_value * 100)
      : input.discount_value; // percent stored as-is

  const minOrderPaise = Math.max(0, Math.round((input.min_order_rupees ?? 0) * 100));

  const sb = await createClient();
  const { data, error } = await sb
    .from("coupons")
    .insert({
      store_id: storeRes.storeId,
      code,
      discount_type: input.discount_type,
      discount_value: discountValuePaise,
      min_order_paise: minOrderPaise,
      max_uses: input.max_uses ?? null,
      applies_to: input.applies_to || "all",
      expires_at: input.expires_at || null,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `A coupon with code "${code}" already exists.` };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/coupons");
  return { ok: true, id: data.id };
}

export async function toggleCouponActive(couponId: string, isActive: boolean): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const storeRes = await getOwnStoreId();
  if (!storeRes.ok) return storeRes;

  const sb = await createClient();
  const { error } = await sb
    .from("coupons")
    .update({ is_active: isActive })
    .eq("id", couponId)
    .eq("store_id", storeRes.storeId); // RLS + belt-and-suspenders

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/coupons");
  return { ok: true };
}

export async function deleteCoupon(couponId: string): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const storeRes = await getOwnStoreId();
  if (!storeRes.ok) return storeRes;

  const sb = await createClient();
  const { error } = await sb
    .from("coupons")
    .delete()
    .eq("id", couponId)
    .eq("store_id", storeRes.storeId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/coupons");
  return { ok: true };
}
