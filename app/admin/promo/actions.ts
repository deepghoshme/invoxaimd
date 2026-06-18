"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PromoCode = {
  id: string;
  code: string;
  discount_type: "percent" | "flat";
  discount_value: number;
  scope: string;
  usage_limit: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

export type PromoInput = {
  code: string;
  discount_type: "percent" | "flat";
  discount_value: number;
  scope: string;
  usage_limit: number | null;
  expires_at: string | null;
};

type Result = { ok: boolean; error?: string };

/**
 * List all promo codes (admin-only via RLS).
 * Returns null if table doesn't exist yet.
 */
export async function getPromoCodes(): Promise<PromoCode[] | null> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("promo_codes")
    .select("id, code, discount_type, discount_value, scope, usage_limit, used_count, expires_at, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) return null;
  return data as PromoCode[];
}

/**
 * Create a new promo code.
 * Server validates: code non-empty, discount_value > 0, percent ≤ 100.
 */
export async function createPromoCode(input: PromoInput): Promise<Result> {
  const code = input.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!code) return { ok: false, error: "Code must contain letters or numbers." };
  if (code.length < 3) return { ok: false, error: "Code must be at least 3 characters." };
  if (input.discount_value <= 0) return { ok: false, error: "Discount value must be greater than 0." };
  if (input.discount_type === "percent" && input.discount_value > 100) {
    return { ok: false, error: "Percent discount cannot exceed 100." };
  }

  const sb = await createClient();
  const { error } = await sb.from("promo_codes").insert({
    code,
    discount_type: input.discount_type,
    discount_value: input.discount_value,
    scope: input.scope || "all",
    usage_limit: input.usage_limit,
    expires_at: input.expires_at || null,
    is_active: true,
    used_count: 0,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, error: `Code "${code}" already exists.` };
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/promo");
  return { ok: true };
}

/**
 * Toggle is_active for a promo code.
 */
export async function togglePromoCode(id: string, is_active: boolean): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb.from("promo_codes").update({ is_active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/promo");
  return { ok: true };
}

/**
 * Delete a promo code permanently.
 */
export async function deletePromoCode(id: string): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb.from("promo_codes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/promo");
  return { ok: true };
}
