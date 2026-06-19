"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

type Result = { ok: boolean; error?: string };

/** Verify the caller is a platform admin. Returns the actor profile or null. */
async function requireAdmin() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user.id);
  const isAdmin = (roles ?? []).some((r) => r.role === "admin");
  if (!isAdmin) return null;
  return { id: user.id, email: user.email ?? null };
}

/**
 * Mark an order as refunded (in-platform record + audit trail).
 *
 * NOTE: this records the refund in our system and is the operator's source of
 * truth. Triggering the actual money movement on the gateway (Razorpay refunds
 * API, per-seller keys) is a follow-up — admins currently process the gateway
 * refund in the Razorpay dashboard and mark it here. Only paid orders can be
 * refunded.
 */
export async function refundOrder(orderId: string, reason: string): Promise<Result> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: "Admin access required." };

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, status, store_id, amount, buyer_email")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { ok: false, error: "Order not found." };
  if (order.status !== "paid") return { ok: false, error: "Only paid orders can be refunded." };

  const { error } = await admin
    .from("orders")
    .update({
      status: "refunded",
      refunded_at: new Date().toISOString(),
      refund_reason: reason?.trim() || null,
    })
    .eq("id", orderId)
    .eq("status", "paid"); // guard against double-refund races

  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    actorRole: "admin",
    action: "order.refunded",
    targetType: "order",
    targetId: orderId,
    storeId: order.store_id as string,
    metadata: { amount: order.amount, buyer_email: order.buyer_email, reason: reason?.trim() || null },
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}
