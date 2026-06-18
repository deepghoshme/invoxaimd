"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CommissionUpdate = { id: string; commission_rate: number };
type Result = { ok: boolean; error?: string };

/**
 * Fetch all business categories with commission rates.
 * Returns null only when the table is genuinely missing (pre-migration);
 * other errors are thrown so they surface in the server logs / error boundary.
 */
export async function getCategories() {
  const sb = await createClient();
  const { data, error } = await sb
    .from("business_categories")
    .select("id, name, slug, commission_rate, is_active, sort_order")
    .order("sort_order");
  if (error) {
    // 42P01 = undefined_table (migration not applied yet)
    if (
      error.code === "42P01" ||
      error.message?.toLowerCase().includes("does not exist") ||
      error.message?.toLowerCase().includes("relation")
    ) {
      return null;
    }
    console.error("[admin/commission] getCategories error:", error.message);
    throw new Error(error.message);
  }
  return data;
}

/**
 * Bulk-save commission rates. Each item must be { id, commission_rate }.
 * commission_rate must be 0–100 (percent); stored as 0–1 fraction in the DB.
 * Admin-only via RLS policy categories_admin_write.
 */
export async function saveCommissionRates(updates: CommissionUpdate[]): Promise<Result> {
  if (!updates.length) return { ok: true };

  // Validate ranges client-supplied before touching DB.
  for (const u of updates) {
    if (u.commission_rate < 0 || u.commission_rate > 100) {
      return { ok: false, error: "Rate must be between 0 and 100." };
    }
  }

  const sb = await createClient();
  // Upsert one row at a time – business_categories is a small table.
  for (const u of updates) {
    const { error } = await sb
      .from("business_categories")
      .update({ commission_rate: u.commission_rate / 100 })
      .eq("id", u.id);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin/commission");
  return { ok: true };
}
