import { createClient } from "@/lib/supabase/server";
import RemindersClient from "./RemindersClient";

export const dynamic = "force-dynamic";

type Row = {
  recharge_reminder_enabled?: boolean | null;
  recharge_reminder_min_interval_min?: number | null;
  recharge_reminder_active_only?: boolean | null;
  recharge_reminder_active_window_days?: number | null;
  recharge_reminder_min_revenue_paise?: number | null;
  recharge_reminder_inactive_action?: string | null;
};

export default async function AdminRemindersPage() {
  const sb = await createClient();

  const { data } = await sb
    .from("platform_settings")
    .select(
      "recharge_reminder_enabled, recharge_reminder_min_interval_min, recharge_reminder_active_only, recharge_reminder_active_window_days, recharge_reminder_min_revenue_paise, recharge_reminder_inactive_action"
    )
    .eq("id", true)
    .maybeSingle();

  const ps = (data ?? {}) as Row;

  return (
    <RemindersClient
      enabled={ps.recharge_reminder_enabled ?? false}
      intervalMin={ps.recharge_reminder_min_interval_min ?? 30}
      activeOnly={ps.recharge_reminder_active_only ?? true}
      activeWindowDays={ps.recharge_reminder_active_window_days ?? 14}
      minRevenueRupees={Math.round((ps.recharge_reminder_min_revenue_paise ?? 0) / 100)}
      inactiveAction={ps.recharge_reminder_inactive_action === "nudge" ? "nudge" : "skip"}
    />
  );
}
