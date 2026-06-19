"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertNotImpersonating } from "@/lib/impersonation";
import { sendAbandonedCartEmail } from "@/lib/transactional";

// ── Types ──────────────────────────────────────────────────────────────────────

type Result = { ok: boolean; error?: string };

export type RecoverySettings = {
  recovery_enabled: boolean;
  recovery_delay_minutes: number;
  recovery_subject: string;
  recovery_message: string;
};

// ── Auth helper ────────────────────────────────────────────────────────────────

/** Resolve the caller's own store (RLS-scoped). */
async function resolveStore() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { sb, user: null, store: null };

  const { data: store } = await sb
    .from("stores")
    .select(
      "id, store_name, subdomain, recovery_enabled, recovery_delay_minutes, recovery_subject, recovery_message",
    )
    .eq("owner_id", user.id)
    .maybeSingle();

  return { sb, user, store };
}

// ── Recovery URL builder ───────────────────────────────────────────────────────

/**
 * Build the best recovery URL we can from an order row.
 *
 * Priority:
 *  1. page_type=opp  → resolve page.public_id → https://{subdomain}.invoxai.io/opp/{public_id}
 *  2. page_type=store + product_id → https://{subdomain}.invoxai.io/store  (product deep-link not available without slug)
 *  3. Fallback: https://{subdomain}.invoxai.io
 */
async function buildRecoverUrl(order: {
  page_id: string | null;
  product_id?: string | null;
  page_type: string;
  store_id: string;
}, subdomain: string | null): Promise<string> {
  const ROOT = "invoxai.io";
  const base = subdomain ? `https://${subdomain}.${ROOT}` : `https://${ROOT}`;

  if (order.page_type === "opp" && order.page_id) {
    const sb = createAdminClient();
    const { data: page } = await sb
      .from("pages")
      .select("public_id")
      .eq("id", order.page_id)
      .maybeSingle();
    if (page?.public_id) return `${base}/opp/${page.public_id}`;
  }

  if (order.page_type === "store") {
    return `${base}/store`;
  }

  if (order.page_type === "course" && order.page_id) {
    const sb = createAdminClient();
    const { data: page } = await sb
      .from("pages")
      .select("public_id")
      .eq("id", order.page_id)
      .maybeSingle();
    if (page?.public_id) return `${base}/course/${page.public_id}`;
  }

  if (order.page_type === "booking" && order.page_id) {
    const sb = createAdminClient();
    const { data: page } = await sb
      .from("pages")
      .select("public_id")
      .eq("id", order.page_id)
      .maybeSingle();
    if (page?.public_id) return `${base}/booking/${page.public_id}`;
  }

  return base;
}

// ── Save recovery settings ─────────────────────────────────────────────────────

export async function saveRecoverySettings(
  settings: RecoverySettings,
): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return { ok: false, error: guard.error };

  const { sb, user, store } = await resolveStore();
  if (!user) return { ok: false, error: "Not signed in" };
  if (!store) return { ok: false, error: "No store found" };

  // Validate
  const delay = Math.max(1, Math.min(10080, Math.round(Number(settings.recovery_delay_minutes) || 60)));
  const enabled = Boolean(settings.recovery_enabled);
  const subject = (settings.recovery_subject ?? "").toString().slice(0, 200).trim();
  const message = (settings.recovery_message ?? "").toString().slice(0, 2000).trim();

  const { error } = await sb
    .from("stores")
    .update({
      recovery_enabled: enabled,
      recovery_delay_minutes: delay,
      recovery_subject: subject || null,
      recovery_message: message || null,
    })
    .eq("owner_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/abandoned");
  return { ok: true };
}

// ── Send recovery email for a single order ─────────────────────────────────────

export async function sendRecoveryForOrder(
  orderId: string,
): Promise<Result & { sent?: boolean }> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return { ok: false, error: guard.error };

  const { user, store } = await resolveStore();
  if (!user) return { ok: false, error: "Not signed in" };
  if (!store) return { ok: false, error: "No store found" };

  const sb = createAdminClient();

  // Fetch the order — must belong to this store
  const { data: order } = await sb
    .from("orders")
    .select(
      "id, store_id, page_id, product_id, page_type, buyer_email, buyer_name, product_title, amount, recovery_sent_at, recovery_count",
    )
    .eq("id", orderId)
    .eq("store_id", store.id)
    .eq("status", "created")
    .maybeSingle();

  if (!order) return { ok: false, error: "Order not found or already completed" };
  if (!order.buyer_email) return { ok: false, error: "No buyer email on this order" };

  // De-dupe: don't re-send if already sent within the last 24 h
  if (order.recovery_sent_at) {
    const sentAt = new Date(order.recovery_sent_at).getTime();
    const twentyFourH = 24 * 60 * 60 * 1000;
    if (Date.now() - sentAt < twentyFourH) {
      return { ok: true, sent: false, error: "Recovery email already sent within last 24 h" };
    }
  }

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

  // Mark sent (admin client — no RLS concern; we already verified ownership above)
  await sb
    .from("orders")
    .update({
      recovery_sent_at: new Date().toISOString(),
      recovery_count: (Number(order.recovery_count) || 0) + 1,
    })
    .eq("id", orderId);

  revalidatePath("/dashboard/abandoned");
  return { ok: true, sent: true };
}

// ── Send recovery emails to all eligible abandoned orders ─────────────────────

export async function sendEligibleRecovery(): Promise<
  Result & { sent?: number; skipped?: number }
> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return { ok: false, error: guard.error };

  const { user, store } = await resolveStore();
  if (!user) return { ok: false, error: "Not signed in" };
  if (!store) return { ok: false, error: "No store found" };

  const delayMinutes = Number(store.recovery_delay_minutes) || 60;
  const cutoff = new Date(Date.now() - delayMinutes * 60 * 1000).toISOString();
  const reSendCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const sb = createAdminClient();

  // Orders: status=created, older than delay, not sent within 24h, has an email
  const { data: orders } = await sb
    .from("orders")
    .select(
      "id, store_id, page_id, product_id, page_type, buyer_email, buyer_name, product_title, amount, recovery_sent_at, recovery_count",
    )
    .eq("store_id", store.id)
    .eq("status", "created")
    .lte("created_at", cutoff)
    .not("buyer_email", "is", null)
    .or(`recovery_sent_at.is.null,recovery_sent_at.lte.${reSendCutoff}`);

  if (!orders?.length) return { ok: true, sent: 0, skipped: 0 };

  let sent = 0;
  let skipped = 0;

  for (const order of orders) {
    if (!order.buyer_email) { skipped++; continue; }
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
      .update({
        recovery_sent_at: new Date().toISOString(),
        recovery_count: (Number(order.recovery_count) || 0) + 1,
      })
      .eq("id", order.id);
    sent++;
  }

  revalidatePath("/dashboard/abandoned");
  return { ok: true, sent, skipped };
}
