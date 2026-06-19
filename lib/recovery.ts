import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAbandonedCartEmail } from "@/lib/transactional";

const ROOT = "invoxai.io";

/** Best-effort public URL a buyer can return to to finish an abandoned checkout. */
async function buildRecoverUrl(
  order: { page_id: string | null; page_type: string },
  subdomain: string | null,
): Promise<string> {
  const base = subdomain ? `https://${subdomain}.${ROOT}` : `https://${ROOT}`;
  const prefix =
    order.page_type === "opp" ? "opp" :
    order.page_type === "course" ? "course" :
    order.page_type === "booking" ? "booking" : null;
  if (prefix && order.page_id) {
    const sb = createAdminClient();
    const { data: page } = await sb.from("pages").select("public_id").eq("id", order.page_id).maybeSingle();
    if (page?.public_id) return `${base}/${prefix}/${page.public_id}`;
  }
  if (order.page_type === "store") return `${base}/store`;
  return base;
}

/**
 * Platform-wide abandoned-cart recovery (for the daily cron). For every store
 * that has opted in (`recovery_enabled`), email buyers whose order is still
 * `created`, older than the store's delay, and not emailed in the last 24h.
 * De-dupes via recovery_sent_at. Per-store failures don't stop the sweep.
 */
export async function runRecoveryForAllStores(): Promise<{ stores: number; sent: number }> {
  const sb = createAdminClient();
  const { data: stores } = await sb
    .from("stores")
    .select("id, subdomain, store_name, recovery_delay_minutes, recovery_subject, recovery_message")
    .eq("recovery_enabled", true);

  let sent = 0;
  for (const store of stores ?? []) {
    try {
      const delayMinutes = Number(store.recovery_delay_minutes) || 60;
      const cutoff = new Date(Date.now() - delayMinutes * 60 * 1000).toISOString();
      const reSendCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: orders } = await sb
        .from("orders")
        .select("id, page_id, page_type, buyer_email, buyer_name, product_title, amount, recovery_count")
        .eq("store_id", store.id)
        .eq("status", "created")
        .lte("created_at", cutoff)
        .not("buyer_email", "is", null)
        .or(`recovery_sent_at.is.null,recovery_sent_at.lte.${reSendCutoff}`);

      for (const order of orders ?? []) {
        if (!order.buyer_email) continue;
        const recoverUrl = await buildRecoverUrl(order, store.subdomain ?? null);
        await sendAbandonedCartEmail({
          to: order.buyer_email,
          buyerName: order.buyer_name,
          productTitle: order.product_title,
          amountPaise: order.amount,
          recoverUrl,
          storeName: store.store_name,
          subject: store.recovery_subject || undefined,
          message: store.recovery_message || undefined,
        });
        await sb
          .from("orders")
          .update({ recovery_sent_at: new Date().toISOString(), recovery_count: (Number(order.recovery_count) || 0) + 1 })
          .eq("id", order.id);
        sent++;
      }
    } catch {
      // per-store failure is non-fatal; continue the sweep
    }
  }
  return { stores: (stores ?? []).length, sent };
}
