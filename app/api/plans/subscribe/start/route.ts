import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRazorpayOrder } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

/**
 * Start a seller plan-subscription payment. Charges the PLATFORM's Razorpay
 * gateway (admin-configured), not the seller's own keys — plan revenue belongs
 * to the platform. Amount is the plan price from the DB (never client-trusted).
 * Returns the Razorpay order + platform key_id for the checkout.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { plan_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const planId = typeof body.plan_id === "string" ? body.plan_id : "";
  if (!planId) return NextResponse.json({ error: "Missing plan_id" }, { status: 400 });

  const admin = createAdminClient();
  const { data: plan } = await admin
    .from("plans")
    .select("id, name, price, is_active")
    .eq("id", planId)
    .eq("is_active", true)
    .maybeSingle();
  if (!plan) return NextResponse.json({ error: "Plan not found or inactive." }, { status: 404 });
  if (!plan.price || plan.price <= 0) {
    return NextResponse.json({ error: "This plan is free — no payment needed." }, { status: 400 });
  }

  const { data: store } = await admin.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
  if (!store) return NextResponse.json({ error: "No store found for your account." }, { status: 403 });

  // Platform gateway — admin client reads the secret server-side (RLS-bypassing).
  const { data: gw } = await admin
    .from("platform_gateways")
    .select("key_id, key_secret, is_enabled")
    .eq("id", true)
    .maybeSingle();
  if (!gw || !gw.is_enabled || !gw.key_id || !gw.key_secret) {
    return NextResponse.json({ error: "Platform payments aren’t set up yet. Ask the admin to enable the payment gateway." }, { status: 503 });
  }

  const amountPaise = plan.price * 100;
  try {
    const rp = await createRazorpayOrder(
      { keyId: gw.key_id as string, keySecret: gw.key_secret as string },
      {
        amount: amountPaise,
        currency: "INR",
        receipt: `plan_${plan.id}`.slice(0, 40),
        notes: { kind: "plan", plan_id: plan.id as string, store_id: store.id as string },
      },
    );
    return NextResponse.json({
      razorpay_order_id: rp.id,
      key_id: gw.key_id,
      amount: amountPaise,
      currency: "INR",
      plan_name: plan.name,
    });
  } catch {
    return NextResponse.json({ error: "Couldn’t start the payment. Please try again." }, { status: 502 });
  }
}
