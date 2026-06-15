"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: boolean; error?: string };

/** Update a category's commission rate. Input is a percent (e.g. 5 → 0.05). */
export async function updateCommission(
  categoryId: string,
  percent: number,
): Promise<Result> {
  const rate = Number(percent) / 100;
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    return { ok: false, error: "Enter a percentage between 0 and 100." };
  }

  // RLS (categories_admin_write -> is_admin()) enforces admin-only writes.
  const supabase = await createClient();
  const { error } = await supabase
    .from("business_categories")
    .update({ commission_rate: rate })
    .eq("id", categoryId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}
