import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStoreCommissionRate, createOrderRecord } from "@/lib/sites";
import { type EventContent, type EventTier } from "@/lib/event";

/**
 * Create an internal order for a published event page.
 * Amount is taken from the DB (never trusted from the client).
 * Body: { page_id, tier_index, qty }
 */
export async function POST(req: Request) {
  let body: { page_id?: string; tier_index?: number; qty?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { page_id, tier_index = 0, qty = 1 } = body;
  if (!page_id) return NextResponse.json({ error: "Missing page_id" }, { status: 400 });

  const safeQty = Math.max(1, Math.min(99, Math.round(Number(qty) || 1)));
  const safeIdx = Math.max(0, Math.round(Number(tier_index) || 0));

  const sb = createAdminClient();
  const { data: page } = await sb
    .from("pages")
    .select("id, store_id, page_type, title, content, status")
    .eq("id", page_id)
    .maybeSingle();

  if (!page || page.status !== "published") {
    return NextResponse.json({ error: "Event not available" }, { status: 404 });
  }
  if (page.page_type !== "event") {
    return NextResponse.json({ error: "Not an event page" }, { status: 400 });
  }

  const content = (page.content ?? {}) as EventContent;
  const tiers: EventTier[] = content.tiers ?? [];
  const tier = tiers[safeIdx];

  if (!tier) {
    return NextResponse.json({ error: "Ticket tier not found" }, { status: 400 });
  }

  // Check seat availability if qty > 0 (unlimited = 0)
  if (tier.qty > 0) {
    // Sum qty across all non-cancelled ticket rows for this tier on this page.
    // A single order can claim multiple seats (qty > 1), so row count would undercount.
    const { data: sumRows } = await sb
      .from("event_tickets")
      .select("qty")
      .eq("page_id", page_id)
      .eq("tier_name", tier.name)
      .neq("status", "cancelled");

    const taken = (sumRows ?? []).reduce((acc, r) => acc + (Number(r.qty) || 0), 0);
    if (taken + safeQty > tier.qty) {
      return NextResponse.json({ error: `Only ${tier.qty - taken} seat(s) left for ${tier.name}` }, { status: 409 });
    }
  }

  const currency = (content.currency || "INR").toUpperCase();
  // Price is in major units (e.g. 799 for ₹799); convert to paise for the gateway
  const unitPaise = Math.round(Number(tier.price ?? 0) * 100);
  const totalPaise = unitPaise * safeQty;

  const rate = await getStoreCommissionRate(page.store_id);

  const order = await createOrderRecord({
    store_id: page.store_id,
    page_id: page.id,
    page_type: "event",
    product_title: `${content.title || page.title || "Event"} — ${tier.name}${safeQty > 1 ? ` ×${safeQty}` : ""}`,
    amount: totalPaise,
    currency,
    commission_rate: rate,
    commission_amount: Math.round(totalPaise * rate),
    // Attach tier metadata so verify + ticket creation can read it
    // We store them in a note-like field by piggybacking the unused buyer fields
    // (buyer_name will be set properly at /start time)
  });

  if (!order) return NextResponse.json({ error: "Could not create order" }, { status: 500 });

  return NextResponse.json({
    order_id: order.id,
    page_type: "event",
    tier_name: tier.name,
    qty: safeQty,
    total_paise: totalPaise,
    currency,
  });
}
