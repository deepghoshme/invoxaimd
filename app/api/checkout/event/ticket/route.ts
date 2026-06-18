import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrderById } from "@/lib/sites";
import { type EventContent } from "@/lib/event";

/**
 * Issue an event ticket after a confirmed order (paid or free).
 * Called by EventView after either payment verification (paid) or
 * directly after order creation (free tickets).
 *
 * Body: { order_id, buyer_name, buyer_email }
 *
 * Security:
 *  - For paid orders: status must be 'paid' (set by /api/checkout/verify).
 *  - For free orders (amount = 0): status may be 'created' — we issue the ticket
 *    and mark the order paid atomically here.
 *  - Idempotent: if a ticket already exists for this order_id, we return it.
 *  - Ticket code is server-generated (crypto-random), never client-supplied.
 */
export async function POST(req: Request) {
  let body: { order_id?: string; buyer_name?: string; buyer_email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { order_id, buyer_name = "", buyer_email = "" } = body;
  if (!order_id) return NextResponse.json({ error: "Missing order_id" }, { status: 400 });

  const sb = createAdminClient();

  // Idempotency: return existing ticket if already issued
  const { data: existing } = await sb
    .from("event_tickets")
    .select("code, tier_name, qty")
    .eq("order_id", order_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ code: existing.code, tier: existing.tier_name, qty: existing.qty });
  }

  // Fetch and validate the order
  const order = await getOrderById(order_id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.page_type !== "event") {
    return NextResponse.json({ error: "Not an event order" }, { status: 400 });
  }

  // Allow paid orders OR free orders (amount = 0, any status)
  const isFree = order.amount === 0;
  if (!isFree && order.status !== "paid") {
    return NextResponse.json({ error: "Payment not yet confirmed" }, { status: 402 });
  }

  // Resolve the event page
  if (!order.page_id) return NextResponse.json({ error: "No page linked to order" }, { status: 400 });

  const { data: page } = await sb
    .from("pages")
    .select("id, content, store_id")
    .eq("id", order.page_id)
    .maybeSingle();

  if (!page) return NextResponse.json({ error: "Event page not found" }, { status: 404 });

  const content = (page.content ?? {}) as EventContent;

  // Extract tier from product_title: "Event Name — TierName ×N" or "Event Name — TierName"
  let tierName = "General";
  let qty = 1;
  if (order.product_title) {
    const match = order.product_title.match(/— (.+?)( ×(\d+))?$/);
    if (match) {
      tierName = match[1].trim();
      qty = match[3] ? parseInt(match[3]) : 1;
    }
  }

  // Verify tier still exists in content (graceful fallback)
  const tiers = content.tiers ?? [];
  const tier = tiers.find((t) => t.name === tierName) ?? tiers[0];
  if (tier) tierName = tier.name;

  // Generate a server-side crypto-random ticket code (no client input)
  const code = generateServerCode();

  // Update buyer info on order if not already set
  const updateFields: Record<string, string> = {};
  if (buyer_email && !order.buyer_email) updateFields.buyer_email = buyer_email;
  if (buyer_name && !order.buyer_name) updateFields.buyer_name = buyer_name;
  if (isFree) updateFields.status = "paid";
  if (Object.keys(updateFields).length > 0) {
    await sb.from("orders").update(updateFields).eq("id", order_id);
  }

  // Insert the ticket row (service role — no RLS write grants for public)
  const { data: ticket, error } = await sb
    .from("event_tickets")
    .insert({
      page_id: order.page_id,
      store_id: order.store_id,
      tier_name: tierName,
      buyer_name: buyer_name || order.buyer_name || "",
      buyer_email: buyer_email || order.buyer_email || "",
      qty,
      code,
      order_id,
      status: "issued",
    })
    .select("code, tier_name, qty")
    .single();

  if (error || !ticket) {
    // One more idempotency guard: race condition where two requests hit simultaneously
    const { data: retry } = await sb
      .from("event_tickets")
      .select("code, tier_name, qty")
      .eq("order_id", order_id)
      .maybeSingle();
    if (retry) return NextResponse.json({ code: retry.code, tier: retry.tier_name, qty: retry.qty });
    return NextResponse.json({ error: error?.message ?? "Ticket creation failed" }, { status: 500 });
  }

  return NextResponse.json({ code: ticket.code, tier: ticket.tier_name, qty: ticket.qty });
}

/** Server-side crypto-random ticket code. Never trust client-supplied codes. */
function generateServerCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const { randomBytes } = require("node:crypto") as typeof import("node:crypto");
  function seg(n: number): string {
    const buf = randomBytes(n);
    let out = "";
    for (let i = 0; i < n; i++) out += chars[buf[i] % chars.length];
    return out;
  }
  return `INVX-${seg(4)}-${seg(4)}`;
}
