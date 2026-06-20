"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeFeatureKeys, type FeatureKey } from "@/lib/plan-features";

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
  // Platform fee overrides (null = inherit global default).
  commission_pct: number | null; // 0..1 fraction
  flat_fee_paise: number | null;
  // Enforced, toggled feature keys (master FEATURE_CATALOG keys).
  feature_keys: FeatureKey[];
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

  // Clamp/normalise the fee overrides. null = inherit global default.
  let commissionPct: number | null = null;
  if (input.commission_pct != null && Number.isFinite(input.commission_pct)) {
    commissionPct = Math.min(1, Math.max(0, input.commission_pct));
  }
  let flatFee: number | null = null;
  if (input.flat_fee_paise != null && Number.isFinite(input.flat_fee_paise)) {
    flatFee = Math.max(0, Math.round(input.flat_fee_paise));
  }

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
      commission_pct: commissionPct,
      flat_fee_paise: flatFee,
      feature_keys: sanitizeFeatureKeys(input.feature_keys),
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

/**
 * Save the GLOBAL platform-fee defaults onto the platform_settings singleton.
 * Admin-only: gated by is_admin() before writing. Uses the service-role client
 * to bypass RLS once the admin check passes (the singleton row may not be
 * writable through anon RLS).
 */
export async function savePlatformFeeDefaults(input: {
  default_commission_pct: number; // 0..1 fraction
  default_flat_fee_paise: number;
  plan_flat_fee_paise: number;
}): Promise<Result> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user.id);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) return { ok: false, error: "Admin access required." };

  const pct = Math.min(1, Math.max(0, Number(input.default_commission_pct) || 0));
  const flat = Math.max(0, Math.round(Number(input.default_flat_fee_paise) || 0));
  const planFlat = Math.max(0, Math.round(Number(input.plan_flat_fee_paise) || 0));

  const admin = createAdminClient();

  // Upsert onto the singleton. The row is keyed by a constant boolean/identity in
  // the platform_settings table; fetch its id first so we update the existing row.
  const { data: existing } = await admin.from("platform_settings").select("id").maybeSingle();
  if (existing?.id) {
    const { error } = await admin
      .from("platform_settings")
      .update({
        default_commission_pct: pct,
        default_flat_fee_paise: flat,
        plan_flat_fee_paise: planFlat,
      })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin.from("platform_settings").insert({
      default_commission_pct: pct,
      default_flat_fee_paise: flat,
      plan_flat_fee_paise: planFlat,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin/plans");
  return { ok: true };
}
