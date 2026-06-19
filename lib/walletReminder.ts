import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendRechargeReminderEmail } from "@/lib/transactional";

/**
 * Run the wallet recharge reminder job.
 *
 * Eligibility criteria (all must pass):
 *   1. wallet_balance <= effective floor (platform wallet_floor_paise, or the
 *      store's own wallet_floor_paise if set — we use the store column which the
 *      wallet-gate lib keeps in sync with the platform default on checkout).
 *   2. last_recharge_reminder_at is NULL  OR  older than recharge_reminder_min_interval_min
 *      minutes — prevents re-spam within the interval window.
 *   3. If recharge_reminder_active_only is true: the store is "active", defined
 *      as having at least one paid order in the last 30 days OR an active
 *      subscription. Low-revenue/inactive sellers with zero wallet are NOT spammed.
 *   4. If recharge_reminder_min_revenue_paise > 0: the store's all-time GMV
 *      (sum of paid order amounts) must meet or exceed the threshold.
 *
 * Money safety: this function ONLY reads wallet_balance and writes
 * last_recharge_reminder_at. No balance is moved, no charges are made.
 *
 * Non-fatal per store: a bad owner-email lookup or mail error does not abort
 * the batch — the store is counted in `checked` and `eligible` but not `sent`.
 * The last_recharge_reminder_at timestamp is updated AFTER the email is sent
 * so a mail failure does not advance the throttle clock.
 */
export async function runRechargeReminders(): Promise<{
  checked: number;
  eligible: number;
  sent: number;
}> {
  const sb = createAdminClient();
  const empty = { checked: 0, eligible: 0, sent: 0 };

  // ── 1. Read platform_settings reminder config ────────────────────────────
  const { data: ps, error: psErr } = await sb
    .from("platform_settings")
    .select(
      "recharge_reminder_enabled, recharge_reminder_min_interval_min, recharge_reminder_active_only, recharge_reminder_min_revenue_paise, wallet_floor_paise"
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
    wallet_floor_paise?: number | null;
  } | null;

  // Gate: if the feature is disabled, no-op immediately.
  if (!cfg?.recharge_reminder_enabled) {
    return empty;
  }

  const intervalMin = cfg.recharge_reminder_min_interval_min ?? 30;
  const activeOnly = cfg.recharge_reminder_active_only ?? true;
  const minRevenuePaise = Number(cfg.recharge_reminder_min_revenue_paise ?? 0);
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
  let sent = 0;

  for (const store of belowFloor) {
    if (!store.owner_id) continue;

    // ── 3. Activity filter (recharge_reminder_active_only) ───────────────
    if (activeOnly) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Check for a paid order in the last 30 days
      const { count: recentOrders } = await sb
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("store_id", store.id)
        .eq("status", "paid")
        .gte("created_at", thirtyDaysAgo);

      // Check for an active subscription
      const { count: activeSubs } = await sb
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("store_id", store.id)
        .eq("status", "active");

      const isActive = (recentOrders ?? 0) > 0 || (activeSubs ?? 0) > 0;
      if (!isActive) continue;
    }

    // ── 4. Minimum revenue filter ─────────────────────────────────────────
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
      if (gmvPaise < minRevenuePaise) continue;
    }

    eligible++;

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

      // ── 6. Send the friendly reminder email ──────────────────────────────
      await sendRechargeReminderEmail({
        to: ownerEmail,
        storeName,
        walletBalancePaise,
        rechargeUrl: "https://app.invoxai.io/dashboard/wallet",
      });

      // ── 7. Advance throttle clock (only on successful send) ──────────────
      const { error: stampErr } = await sb
        .from("stores")
        .update({ last_recharge_reminder_at: new Date().toISOString() })
        .eq("id", store.id);

      if (stampErr) {
        console.warn(
          `[walletReminder] Could not update last_recharge_reminder_at for store ${store.id}:`,
          stampErr.message
        );
        // Non-fatal: sent is still incremented; the next run will re-send sooner
        // than intended but that is safer than losing the count.
      }

      sent++;
    } catch (err) {
      console.warn(`[walletReminder] Failed to process store ${store.id}:`, err);
      // Non-fatal: continue to next store.
    }
  }

  return { checked, eligible, sent };
}
