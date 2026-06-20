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

function toInt(v: FormDataEntryValue | null, fallback: number): number {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/**
 * Save the SMART recharge-reminder configuration into platform_settings.
 *
 * All values map directly to columns read by lib/walletReminder.ts:
 *   - recharge_reminder_enabled              (master on/off)
 *   - recharge_reminder_min_interval_min     (throttle gap, minutes)
 *   - recharge_reminder_active_only          (gate by activity)
 *   - recharge_reminder_active_window_days   (ACTIVE look-back window, days)
 *   - recharge_reminder_min_revenue_paise    (HIGH-REVENUE threshold, paise)
 *   - recharge_reminder_inactive_action      ('skip' | 'nudge')
 *
 * The min-revenue threshold is entered in RUPEES in the UI and converted to
 * paise here (server-side) so the stored value always matches the paise columns.
 */
export async function saveReminderSettings(fd: FormData): Promise<Result> {
  const { supabase, error: authErr } = await assertAdmin();
  if (!supabase) return { ok: false, error: authErr! };

  const enabled = fd.get("enabled") === "on" || fd.get("enabled") === "true";
  const activeOnly = fd.get("active_only") === "on" || fd.get("active_only") === "true";

  const intervalMin = Math.max(1, toInt(fd.get("interval_min"), 30));
  const activeWindowDays = Math.max(1, toInt(fd.get("active_window_days"), 14));

  const minRevenueRupees = Math.max(0, toInt(fd.get("min_revenue_rupees"), 0));
  const minRevenuePaise = minRevenueRupees * 100;

  const inactiveActionRaw = String(fd.get("inactive_action") ?? "skip").trim();
  const inactiveAction = inactiveActionRaw === "nudge" ? "nudge" : "skip";

  const payload: Record<string, unknown> = {
    recharge_reminder_enabled: enabled,
    recharge_reminder_min_interval_min: intervalMin,
    recharge_reminder_active_only: activeOnly,
    recharge_reminder_active_window_days: activeWindowDays,
    recharge_reminder_min_revenue_paise: minRevenuePaise,
    recharge_reminder_inactive_action: inactiveAction,
  };

  const { error } = await supabase
    .from("platform_settings")
    .update(payload)
    .eq("id", true);

  if (error) {
    if (error.message.includes("column") && error.message.includes("does not exist")) {
      return {
        ok: false,
        error:
          "Reminder settings will activate after the smart-reminder migration is applied. Contact your ops team.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/reminders");
  return { ok: true };
}
