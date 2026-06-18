"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PlanWithLimits = {
  id: string;
  name: string;
  price: number;
  contact_limit: number | null;
  overage_paise: number | null;
};

export type LimitUpdate = {
  id: string;
  contact_limit: number | null;
  overage_paise: number | null;
};

type Result = { ok: boolean; error?: string };

/**
 * Fetch plans with contact_limit and overage_paise columns.
 * Returns null only when the table is genuinely missing (pre-migration);
 * other errors are thrown so they surface rather than showing a false
 * "migration pending" message.
 */
export async function getPlansWithLimits(): Promise<PlanWithLimits[] | null> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("plans")
    .select("id, name, price, contact_limit, overage_paise")
    .order("sort_order");

  if (error) {
    // 42P01 = undefined_table; also catch missing-column errors (pre-migration)
    if (
      error.code === "42P01" ||
      error.message?.toLowerCase().includes("does not exist") ||
      error.message?.toLowerCase().includes("relation")
    ) {
      return null;
    }
    console.error("[admin/limits] getPlansWithLimits error:", error.message);
    throw new Error(error.message);
  }
  return data as PlanWithLimits[];
}

/**
 * Save contact limits and overage rates per plan.
 * overage_paise is stored in paise (integer), not rupees.
 * Admin-only via RLS plans_admin_write.
 */
export async function savePlanLimits(updates: LimitUpdate[]): Promise<Result> {
  if (!updates.length) return { ok: true };

  const sb = await createClient();
  for (const u of updates) {
    const { error } = await sb
      .from("plans")
      .update({
        contact_limit: u.contact_limit,
        overage_paise: u.overage_paise,
      })
      .eq("id", u.id);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin/limits");
  return { ok: true };
}
