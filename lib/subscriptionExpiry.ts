import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSubscriptionExpiredEmail } from "@/lib/transactional";

/**
 * Find all active subscriptions whose current_period_end is in the past,
 * mark each as 'past_due', and notify the store owner via email.
 *
 * Idempotent: only rows with status='active' are touched. A sub already
 * marked past_due or canceled is untouched regardless of its period_end.
 *
 * Money safety: amount_paise is READ-ONLY here — no charges are made.
 * We only write the status column. The cron runs daily; the window where
 * a sub is overdue-but-not-yet-past_due is at most ~24 h.
 *
 * Non-fatal per store: one bad owner-email lookup or mail error does not
 * abort the batch — we still count it as expired (status was updated) but
 * notified is not incremented.
 */
export async function expireOverdueSubscriptions(): Promise<{
  checked: number;
  expired: number;
  notified: number;
}> {
  const sb = createAdminClient();

  // Step 1: Fetch all active subs whose period has ended.
  // We select the joined plan name (for the email) and store_id (to look up
  // owner email). current_period_end < now() means the billing period ended.
  const { data: overdue, error } = await sb
    .from("subscriptions")
    .select("id, store_id, current_period_end, plan:plans(name)")
    .eq("status", "active")
    .lt("current_period_end", new Date().toISOString());

  if (error) {
    // Graceful: if subscriptions table doesn't exist yet, return zeros.
    console.warn("[subscriptionExpiry] Could not query subscriptions:", error.message);
    return { checked: 0, expired: 0, notified: 0 };
  }

  const rows = overdue ?? [];
  const checked = rows.length;
  let expired = 0;
  let notified = 0;

  for (const sub of rows) {
    // Step 2: Mark this sub as past_due.
    const { error: updateErr } = await sb
      .from("subscriptions")
      .update({ status: "past_due" })
      .eq("id", sub.id)
      .eq("status", "active"); // guard: only flip if still active (race-safe)

    if (updateErr) {
      console.warn(`[subscriptionExpiry] Failed to mark sub ${sub.id} past_due:`, updateErr.message);
      continue; // don't count as expired; skip notification
    }
    expired++;

    // Step 3: Resolve the store owner's email via:
    //   subscriptions.store_id → stores.owner_id → auth.users.email
    // Non-fatal: if we can't look up the owner, we still counted it expired.
    try {
      const { data: store, error: storeErr } = await sb
        .from("stores")
        .select("owner_id, store_name")
        .eq("id", sub.store_id)
        .maybeSingle();

      if (storeErr || !store?.owner_id) {
        console.warn(`[subscriptionExpiry] Could not fetch store for sub ${sub.id}:`, storeErr?.message);
        continue;
      }

      const { data: authUser, error: authErr } = await sb.auth.admin.getUserById(store.owner_id);
      if (authErr || !authUser?.user?.email) {
        console.warn(`[subscriptionExpiry] Could not resolve owner email for store ${sub.store_id}:`, authErr?.message);
        continue;
      }

      const ownerEmail = authUser.user.email;
      const planName = (sub.plan as { name?: string } | null)?.name ?? "your plan";
      const periodEnd = new Date(sub.current_period_end).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      await sendSubscriptionExpiredEmail({
        to: ownerEmail,
        planName,
        periodEnd,
        renewUrl: "https://app.invoxai.io/dashboard/billing",
      });
      notified++;
    } catch (notifyErr) {
      console.warn(`[subscriptionExpiry] Notification failed for sub ${sub.id}:`, notifyErr);
      // non-fatal: expired is already incremented; notified is not
    }
  }

  return { checked, expired, notified };
}
