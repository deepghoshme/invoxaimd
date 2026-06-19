"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: boolean; error?: string };

export type PlanInput = {
  name: string;
  price: number;
  page_limit: number | null;
  contact_limit: number | null;
  features: string[];
  is_popular: boolean;
  interval: "monthly" | "annual";
  is_recommended: boolean;
};

/** RLS (plans_admin_write → is_admin()) enforces admin-only writes. */
export async function createPlan(): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb
    .from("plans")
    .insert({ name: "New plan", price: 0, sort_order: 99, interval: "monthly", is_recommended: false });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/plans");
  return { ok: true };
}

export async function updatePlan(id: string, input: PlanInput): Promise<Result> {
  const sb = await createClient();
  const interval = input.interval === "annual" ? "annual" : "monthly";
  const { error } = await sb
    .from("plans")
    .update({
      name: input.name.trim() || "Plan",
      price: Number.isFinite(input.price) ? input.price : 0,
      page_limit: input.page_limit,
      contact_limit: input.contact_limit,
      features: input.features.map((f) => f.trim()).filter(Boolean),
      is_popular: input.is_popular,
      interval,
      is_recommended: input.is_recommended,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/plans");
  return { ok: true };
}

export async function deletePlan(id: string): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb.from("plans").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/plans");
  return { ok: true };
}
