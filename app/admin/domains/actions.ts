"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: boolean; error?: string };

// ─── Admin guard ──────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) return { ok: false, error: "Admin access required." };
  return { ok: true };
}

// ─── Domain pricing ────────────────────────────────────────────────────────────

/**
 * Read domain pricing from platform_settings.
 * Returns defaults only when the columns genuinely don't exist yet (migration pending).
 * Real query errors are logged and re-thrown rather than silently returning defaults.
 */
export async function getDomainPricing(): Promise<{
  extra_subdomain_paise: number;
  extra_domain_paise: number;
  migrationPending?: boolean;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("extra_subdomain_paise, extra_domain_paise")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    // Only treat a missing column/table as "migration pending"
    if (
      error.message?.toLowerCase().includes("does not exist") ||
      error.code === "42P01"
    ) {
      return { extra_subdomain_paise: 4900, extra_domain_paise: 19900, migrationPending: true };
    }
    console.error("[admin/domains] getDomainPricing error:", error.message);
    throw new Error(error.message);
  }

  if (!data) {
    // Row missing — return defaults without marking migration pending
    return { extra_subdomain_paise: 4900, extra_domain_paise: 19900 };
  }

  const d = data as { extra_subdomain_paise?: number | null; extra_domain_paise?: number | null };
  return {
    extra_subdomain_paise: d.extra_subdomain_paise ?? 4900,
    extra_domain_paise: d.extra_domain_paise ?? 19900,
  };
}

/**
 * Save domain pricing to platform_settings.
 * Input is in rupees (e.g. 49); stored as paise (×100).
 */
export async function saveDomainPricing(input: {
  extra_subdomain_rupees: number;
  extra_domain_rupees: number;
}): Promise<Result> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const subPaise = Math.round(Number(input.extra_subdomain_rupees) * 100);
  const domPaise = Math.round(Number(input.extra_domain_rupees) * 100);

  if (!Number.isFinite(subPaise) || subPaise < 0) {
    return { ok: false, error: "Enter a valid subdomain price." };
  }
  if (!Number.isFinite(domPaise) || domPaise < 0) {
    return { ok: false, error: "Enter a valid domain price." };
  }

  // Use the regular (RLS-enforced) client — the admin policy on platform_settings
  // already allows admin writes. Belt-and-suspenders guard is done above.
  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_settings")
    .update({ extra_subdomain_paise: subPaise, extra_domain_paise: domPaise })
    .eq("id", true);

  if (error) {
    if (error.message.includes("does not exist") || error.message.includes("column")) {
      return { ok: false, error: "Apply migration 20260618280000_admin_comms.sql first." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/domains");
  return { ok: true };
}
