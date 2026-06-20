import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOrderRecord, getStoreCommissionRate } from "@/lib/sites";
import { resolveFees, computeSaleFeePaise } from "@/lib/platform-fees";
import { type VipContent, type VipPlan, planToMinorUnits } from "@/lib/vip";

/**
 * Create an order for a VIP community membership.
 *
 * Unlike the generic /api/checkout/create (which handles `opp` pages),
 * this endpoint:
 *   - Accepts a `vip_plan` id to look up the correct price from pages.content.
 *   - Sets page_type = "vip" on the order (so the checkout URL prefix works).
 *   - Does NOT trust the client for price — reads from DB content.
 *
 * The checkout flow after this is identical to opp:
 *   POST /api/checkout/start → Razorpay modal → POST /api/checkout/verify
 *   → on success → POST /api/vip/join (creates vip_members row + returns invite).
 */
export async function POST(req: Request) {
  let body: { page_id?: string; vip_plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { page_id, vip_plan } = body;
  if (!page_id) return NextResponse.json({ error: "Missing page_id" }, { status: 400 });

  const admin = createAdminClient();

  const { data: page } = await admin
    .from("pages")
    .select("id, store_id, page_type, title, content, status")
    .eq("id", page_id)
    .maybeSingle();

  if (!page || page.status !== "published") {
    return NextResponse.json({ error: "Community not available" }, { status: 404 });
  }
  if (page.page_type !== "vip") {
    return NextResponse.json({ error: "Not a VIP page" }, { status: 400 });
  }

  const content = (page.content ?? {}) as VipContent;
  const plans: VipPlan[] = content.plans ?? [];
  const currency = (content.currency || "INR").toUpperCase();

  // Resolve the requested plan
  const planId = vip_plan || plans[0]?.id || "monthly";
  const plan = plans.find((p) => p.id === planId) ?? plans[0];
  if (!plan) {
    return NextResponse.json({ error: "No plans configured for this community" }, { status: 400 });
  }

  const amount = planToMinorUnits(plan, currency);
  if (amount <= 0) {
    return NextResponse.json({ error: "Plan has no price set" }, { status: 400 });
  }

  const title = `${content.title || "VIP Community"} — ${plan.name}`;
  const fees = await resolveFees(page.store_id);

  const order = await createOrderRecord({
    store_id: page.store_id,
    page_id: page.id,
    page_type: "vip",
    product_title: title,
    amount,
    currency,
    commission_rate: fees.commission_pct,
    commission_amount: computeSaleFeePaise(amount, fees),
  });

  if (!order) return NextResponse.json({ error: "Could not create order" }, { status: 500 });

  return NextResponse.json({ order_id: order.id, page_type: "vip" });
}
