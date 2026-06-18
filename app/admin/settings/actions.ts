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
 * Save general platform settings: platform_name, support_email.
 * Columns are added by migration 20260618260000. Before that they'll be
 * ignored by the DB — the update touches only existing columns.
 */
export async function saveGeneralSettings(fd: FormData): Promise<Result> {
  const { supabase, error: authErr } = await assertAdmin();
  if (!supabase) return { ok: false, error: authErr! };

  const platformName = (fd.get("platform_name") as string | null)?.trim() ?? "";
  const supportEmail = (fd.get("support_email") as string | null)?.trim() ?? "";

  if (!platformName) return { ok: false, error: "Platform name is required." };
  if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
    return { ok: false, error: "Enter a valid support email." };
  }

  const payload: Record<string, unknown> = {};

  // Only set columns that are likely to exist (graceful degradation until
  // migration is applied). We still try; if the column is missing Supabase
  // returns an error which we surface to the admin.
  if (platformName) payload.platform_name = platformName;
  if (supportEmail) payload.support_email = supportEmail;

  const { error } = await supabase
    .from("platform_settings")
    .update(payload)
    .eq("id", true);

  if (error) {
    // If the column doesn't exist yet, give an honest message.
    if (error.message.includes("column") && error.message.includes("does not exist")) {
      return {
        ok: false,
        error:
          "Save will activate after the platform config migration is applied. Contact your ops team.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/settings");
  return { ok: true };
}

/**
 * Add a reserved subdomain.
 * Uses the admin Supabase client from server — RLS enforces admin-only writes.
 */
export async function addReservedSubdomain(fd: FormData): Promise<Result> {
  const { supabase, error: authErr } = await assertAdmin();
  if (!supabase) return { ok: false, error: authErr! };

  const name = (fd.get("name") as string | null)?.trim().toLowerCase() ?? "";
  const reason = (fd.get("reason") as string | null)?.trim() ?? "reserved";

  if (!name) return { ok: false, error: "Enter a subdomain name." };
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(name)) {
    return { ok: false, error: "Subdomain must be lowercase alphanumeric (hyphens allowed, no leading/trailing)." };
  }

  const { error } = await supabase
    .from("reserved_subdomains")
    .insert({ name, reason });

  if (error) {
    if (error.message.includes("duplicate") || error.message.includes("unique")) {
      return { ok: false, error: `"${name}" is already reserved.` };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/settings");
  return { ok: true };
}

/**
 * Remove a reserved subdomain.
 */
export async function removeReservedSubdomain(name: string): Promise<Result> {
  const { supabase, error: authErr } = await assertAdmin();
  if (!supabase) return { ok: false, error: authErr! };

  const safe = name.trim().toLowerCase();
  if (!safe) return { ok: false, error: "No name supplied." };

  const { error } = await supabase
    .from("reserved_subdomains")
    .delete()
    .eq("name", safe);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/settings");
  return { ok: true };
}
