import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendRechargeReminderEmail, sendRechargeNudgeEmail } from "@/lib/transactional";

/**
 * Run the SMART wallet recharge reminder job.
 *
 * Every store whose wallet is at/below the floor (and past the throttle window)
 * is classified, then routed to one of two admin-configured paths:
 *
 *   QUALIFYING  = ACTIVE  AND  HIGH REVENUE
 *     • ACTIVE       — has a paid order (or an active subscription) within
 *                      `recharge_reminder_active_window_days` days
 *                      (only enforced when recharge_reminder_active_only = true).
 *     • HIGH REVENUE — all-time confirmed GMV (sum of paid order amounts)
 *                      >= recharge_reminder_min_revenue_paise.
 *     → gets the friendly recharge reminder mail.
 *
 *   NON-QUALIFYING = not active, or revenue below the threshold
 *     → follows recharge_reminder_inactive_action:
 *         'skip'  — send nothing (default).
 *         'nudge' — send a different, softer re-engagement mail.
 *
 * All thresholds/parameters live in platform_settings and are admin-editable at
 * /admin/reminders.
 *
 * Money safety: this function ONLY reads wallet_balance / orders and writes
 * last_recharge_reminder_at. No balance is moved, no charges are made.
 *
 * Non-fatal per store: a bad owner-email lookup or mail error does not abort the
 * batch. The last_recharge_reminder_at timestamp is updated AFTER a mail is sent
 * so a mail failure does not advance the throttle clock. The throttle clock is
 * advanced for BOTH friendly and nudge sends (so a nudged seller isn't re-nudged
 * within the interval).
 *
 * Returns counts: checked (below floor + past throttle), eligible (qualified for
 * friendly mail), nudged (non-qualifying, mailed via nudge path), sent (total
 * mails dispatched = friendly + nudge), skipped (non-qualifying, action=skip).
 */
export async function runRechargeReminders(): Promise<{
  checked: number;
  eligible: number;
  nudged: number;
  sent: number;
  skipped: number;
}> {
  const sb = createAdminClient();
  const empty = { checked: 0, eligible: 0, nudged: 0, sent: 0, skipped: 0 };

  // ── 1. Read platform_settings reminder config ────────────────────────────
  const { data: ps, error: psErr } = await sb
    .from("platform_settings")
    .select(
      "recharge_reminder_enabled, recharge_reminder_min_interval_min, recharge_reminder_active_only, recharge_reminder_min_revenue_paise, recharge_reminder_active_window_days, recharge_reminder_inactive_action, wallet_floor_paise"
    )
    .maybeSingle();

  if (psErr) {
    console.warn("[walletReminder] Could not read platform_settings:", psErr.message);
    return empty;
  }

  const cfg = ps as {
    recharge_reminder_enabled?: boolean | null;
    recharge_reminder_min_interval_min?: number | null;
    recharge_reminder_active_only?: boolean | null;
    recharge_reminder_min_revenue_paise?: number | null;
    recharge_reminder_active_window_days?: number | null;
    recharge_reminder_inactive_action?: string | null;
    wallet_floor_paise?: number | null;
  } | null;

  // Gate: if the feature is disabled, no-op immediately.
  if (!cfg?.recharge_reminder_enabled) {
    return empty;
  }

  const intervalMin = cfg.recharge_reminder_min_interval_min ?? 30;
  const activeOnly = cfg.recharge_reminder_active_only ?? true;
  const minRevenuePaise = Number(cfg.recharge_reminder_min_revenue_paise ?? 0);
  const activeWindowDays = Math.max(1, Number(cfg.recharge_reminder_active_window_days ?? 14));
  const inactiveAction = cfg.recharge_reminder_inactive_action === "nudge" ? "nudge" : "skip";
  const platformFloorPaise = Number(cfg.wallet_floor_paise ?? 0);

  // ── 2. Find stores whose wallet is at or below the floor ─────────────────
  // We compute the throttle cutoff timestamp: only stores whose last reminder
  // was sent before this point (or never) are candidates.
  const throttleCutoff = new Date(Date.now() - intervalMin * 60 * 1000).toISOString();

  const { data: storeRows, error: storeErr } = await sb
    .from("stores")
    .select("id, store_name, owner_id, wallet_balance, wallet_floor_paise, last_recharge_reminder_at")
    .or(`last_recharge_reminder_at.is.null,last_recharge_reminder_at.lt.${throttleCutoff}`);

  if (storeErr) {
    console.warn("[walletReminder] Could not query stores:", storeErr.message);
    return empty;
  }

  const stores = (storeRows ?? []) as {
    id: string;
    store_name: string | null;
    owner_id: string | null;
    wallet_balance: number | null;
    wallet_floor_paise: number | null;
    last_recharge_reminder_at: string | null;
  }[];

  // Apply balance check: wallet_balance <= effective floor.
  // The effective floor is the store's own wallet_floor_paise if set (> 0),
  // otherwise the platform floor.
  const belowFloor = stores.filter((s) => {
    const effectiveFloor =
      s.wallet_floor_paise != null && s.wallet_floor_paise > 0
        ? s.wallet_floor_paise
        : platformFloorPaise;
    const balance = s.wallet_balance ?? 0;
    return balance <= effectiveFloor;
  });

  const checked = belowFloor.length;
  let eligible = 0;
  let nudged = 0;
  let sent = 0;
  let skipped = 0;

  const rechargeUrl = "https://app.invoxai.io/dashboard/wallet";

  for (const store of belowFloor) {
    if (!store.owner_id) continue;

    // ── 3. Classify ACTIVE (admin-set look-back window) ──────────────────
    let isActive = true;
    if (activeOnly) {
      const windowStart = new Date(
        Date.now() - activeWindowDays * 24 * 60 * 60 * 1000
      ).toISOString();

      // Paid order within the active window?
      const { count: recentOrders } = await sb
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("store_id", store.id)
        .eq("status", "paid")
        .gte("created_at", windowStart);

      // …or an active subscription?
      const { count: activeSubs } = await sb
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("store_id", store.id)
        .eq("status", "active");

      isActive = (recentOrders ?? 0) > 0 || (activeSubs ?? 0) > 0;
    }

    // ── 4. Classify HIGH REVENUE (admin-set threshold) ───────────────────
    let hasHighRevenue = true;
    if (minRevenuePaise > 0) {
      const { data: revenueData } = await sb
        .from("orders")
        .select("amount")
        .eq("store_id", store.id)
        .eq("status", "paid");

      const gmvPaise = (revenueData ?? []).reduce(
        (sum: number, o: { amount?: number | null }) => sum + (o.amount ?? 0),
        0
      );
      hasHighRevenue = gmvPaise >= minRevenuePaise;
    }

    const qualifies = isActive && hasHighRevenue;

    // Non-qualifying + skip action → no mail at all (and don't burn the throttle).
    if (!qualifies && inactiveAction === "skip") {
      skipped++;
      continue;
    }

    // ── 5. Resolve owner email ────────────────────────────────────────────
    try {
      const { data: authUser, error: authErr } = await sb.auth.admin.getUserById(store.owner_id);
      if (authErr || !authUser?.user?.email) {
        console.warn(
          `[walletReminder] Could not resolve owner email for store ${store.id}:`,
          authErr?.message
        );
        continue;
      }

      const ownerEmail = authUser.user.email;
      const storeName = store.store_name ?? "your store";
      const walletBalancePaise = store.wallet_balance ?? 0;

      // ── 6. Route to the correct mail ──────────────────────────────────────
      if (qualifies) {
        // ACTIVE + HIGH REVENUE → friendly recharge reminder.
        await sendRechargeReminderEmail({
          to: ownerEmail,
          storeName,
          walletBalancePaise,
          rechargeUrl,
        });
        eligible++;
      } else {
        // Non-qualifying + action 'nudge' → softer re-engagement mail.
        await sendRechargeNudgeEmail({
          to: ownerEmail,
          storeName,
          rechargeUrl,
        });
        nudged++;
      }

      // ── 7. Advance throttle clock (only after a mail was dispatched) ──────
      const { error: stampErr } = await sb
        .from("stores")
        .update({ last_recharge_reminder_at: new Date().toISOString() })
        .eq("id", store.id);

      if (stampErr) {
        console.warn(
          `[walletReminder] Could not update last_recharge_reminder_at for store ${store.id}:`,
          stampErr.message
        );
        // Non-fatal: the next run will re-send sooner than intended but that is
        // safer than losing the count.
      }

      sent++;
    } catch (err) {
      console.warn(`[walletReminder] Failed to process store ${store.id}:`, err);
      // Non-fatal: continue to next store.
    }
  }

  return { checked, eligible, nudged, sent, skipped };
}
