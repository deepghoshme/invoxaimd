import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrderById } from "@/lib/sites";

/**
 * Called client-side after a successful Razorpay payment is verified.
 * Creates a vip_members row (or returns the existing one for idempotency)
 * and returns the invite_link from pages.content.
 *
 * Security model:
 *  - We look up the order by order_id and verify it is `status = "paid"`.
 *  - We read page content server-side to get the invite link — the client
 *    never knows it until payment is confirmed.
 *  - We use the admin client (service role) so no auth session is required
 *    on the buyer's side.
 */
export async function POST(req: Request) {
  let body: {
    order_id?: string;
    page_id?: string;
    buyer_email?: string;
    buyer_name?: string;
    plan?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { order_id, page_id, buyer_email, buyer_name, plan } = body;
  if (!order_id || !page_id || !buyer_email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify the order is paid
  const order = await getOrderById(order_id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status !== "paid") {
    return NextResponse.json({ error: "Payment not confirmed" }, { status: 402 });
  }
  if (order.page_id !== page_id) {
    return NextResponse.json({ error: "Order does not match this page" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch page to get invite_link and store_id
  const { data: page } = await admin
    .from("pages")
    .select("id, store_id, page_type, content, status")
    .eq("id", page_id)
    .maybeSingle();

  if (!page || page.page_type !== "vip") {
    return NextResponse.json({ error: "VIP page not found" }, { status: 404 });
  }

  const content = (page.content ?? {}) as { inviteLink?: string };
  const inviteLink = content.inviteLink ?? null;

  // Determine expiry for non-lifetime plans
  const planId = (plan ?? "monthly").toLowerCase();
  let expiresAt: string | null = null;
  if (planId === "monthly") {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    expiresAt = d.toISOString();
  } else if (planId === "yearly") {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    expiresAt = d.toISOString();
  }
  // lifetime → expiresAt stays null

  // Idempotency: check if member row already exists for this order
  try {
    const { data: existing } = await admin
      .from("vip_members")
      .select("id, invite_link")
      .eq("order_id", order_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, invite_link: existing.invite_link ?? inviteLink });
    }
  } catch {
    // vip_members table may not exist yet — graceful fallback
    return NextResponse.json({ ok: true, invite_link: inviteLink });
  }

  // Insert member row
  try {
    await admin.from("vip_members").insert({
      page_id,
      store_id: page.store_id,
      buyer_email: buyer_email.toLowerCase().trim(),
      buyer_name: buyer_name ?? null,
      plan: planId,
      status: "active",
      invite_link: inviteLink,
      order_id,
      expires_at: expiresAt,
    });
  } catch {
    // Table may not exist yet — still return invite link so the buyer isn't stuck
    return NextResponse.json({ ok: true, invite_link: inviteLink });
  }

  return NextResponse.json({ ok: true, invite_link: inviteLink });
}
