"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: boolean; error?: string };

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase: null, error: "Not authenticated." };
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) return { supabase: null, error: "Admin access required." };
  return { supabase, error: null };
}

/**
 * Toggle maintenance mode (platform_settings.maintenance_mode — column EXISTS).
 */
export async function setMaintenanceMode(on: boolean): Promise<Result> {
  const { supabase, error: authErr } = await assertAdmin();
  if (!supabase) return { ok: false, error: authErr! };

  const { error } = await supabase
    .from("platform_settings")
    .update({ maintenance_mode: on })
    .eq("id", true);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/maintenance");
  return { ok: true };
}

/**
 * Update maintenance ETA text (column EXISTS).
 */
export async function setMaintenanceEta(eta: string): Promise<Result> {
  const { supabase, error: authErr } = await assertAdmin();
  if (!supabase) return { ok: false, error: authErr! };

  const { error } = await supabase
    .from("platform_settings")
    .update({ maintenance_eta: eta.trim() || null })
    .eq("id", true);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/maintenance");
  return { ok: true };
}

/**
 * Toggle new-seller signups (platform_settings.allow_signups — added by migration).
 * Degrades gracefully if column doesn't exist yet.
 */
export async function setAllowSignups(on: boolean): Promise<Result> {
  const { supabase, error: authErr } = await assertAdmin();
  if (!supabase) return { ok: false, error: authErr! };

  const { error } = await supabase
    .from("platform_settings")
    .update({ allow_signups: on })
    .eq("id", true);

  if (error) {
    if (error.message.includes("column") && error.message.includes("does not exist")) {
      return {
        ok: false,
        error: "allow_signups column not yet migrated. Apply migration 20260618260000 first.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/maintenance");
  return { ok: true };
}

/**
 * Toggle force-HTTPS flag (platform_settings.force_https — added by migration).
 * Note: this flag records the INTENT. Caddy enforces HTTPS independently on the
 * infrastructure level. Flipping this here will not add/remove TLS on its own —
 * an ops restart is required for Caddy to pick up a config change.
 */
export async function setForceHttps(on: boolean): Promise<Result> {
  const { supabase, error: authErr } = await assertAdmin();
  if (!supabase) return { ok: false, error: authErr! };

  const { error } = await supabase
    .from("platform_settings")
    .update({ force_https: on })
    .eq("id", true);

  if (error) {
    if (error.message.includes("column") && error.message.includes("does not exist")) {
      return {
        ok: false,
        error: "force_https column not yet migrated. Apply migration 20260618260000 first.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/maintenance");
  return { ok: true };
}

/**
 * Save all maintenance settings in one shot (maintenance_mode + eta + allow_signups + force_https).
 */
export async function saveMaintenanceSettings(fd: FormData): Promise<Result> {
  const { supabase, error: authErr } = await assertAdmin();
  if (!supabase) return { ok: false, error: authErr! };

  const maintenanceMode = fd.get("maintenance_mode") === "true";
  const eta = (fd.get("maintenance_eta") as string | null)?.trim() ?? "";
  const allowSignups = fd.get("allow_signups") !== "false";
  const forceHttps = fd.get("force_https") !== "false";

  // Build update payload; include only the columns that are safe to update.
  // maintenance_mode and maintenance_eta always exist.
  const payload: Record<string, unknown> = {
    maintenance_mode: maintenanceMode,
    maintenance_eta: eta || null,
  };

  // Attempt to include newer columns — will fail gracefully if migration pending.
  let usedNewCols = false;
  try {
    const testPayload = { ...payload, allow_signups: allowSignups, force_https: forceHttps };
    const { error } = await supabase
      .from("platform_settings")
      .update(testPayload)
      .eq("id", true);

    if (error) {
      if (error.message.includes("column") && error.message.includes("does not exist")) {
        // Fall back to updating only existing columns.
        const { error: e2 } = await supabase
          .from("platform_settings")
          .update(payload)
          .eq("id", true);
        if (e2) return { ok: false, error: e2.message };
        revalidatePath("/admin/maintenance");
        return {
          ok: true,
          error:
            "Saved maintenance mode and ETA. allow_signups / force_https will activate after migration 20260618260000 is applied.",
        };
      }
      return { ok: false, error: error.message };
    }
    usedNewCols = true;
  } catch {
    usedNewCols = false;
  }

  if (!usedNewCols) {
    const { error } = await supabase
      .from("platform_settings")
      .update(payload)
      .eq("id", true);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin/maintenance");
  return { ok: true };
}
