import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRazorpaySignature, fetchRazorpayOrder } from "@/lib/razorpay";
import { upsertSubscription } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

/**
 * Verify a plan-subscription payment against the PLATFORM gateway secret and,
 * only on a valid signature, activate the subscription. The subscription is
 * created here (post-payment) so an abandoned checkout never grants a paid plan.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: {
    plan_id?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const { plan_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!plan_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: gw } = await admin
    .from("platform_gateways")
    .select("key_id, key_secret, is_enabled")
    .eq("id", true)
    .maybeSingle();
  if (!gw?.key_id || !gw?.key_secret) return NextResponse.json({ error: "Gateway unavailable" }, { status: 503 });

  const valid = verifyRazorpaySignature(
    gw.key_secret as string,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  );
  if (!valid) return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });

  const { data: store } = await admin.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
  if (!store) return NextResponse.json({ error: "No store found for your account." }, { status: 403 });

  // The signature only proves THIS order was paid — not which plan/amount it was
  // for. Re-fetch the order from Razorpay and bind activation to its server-set
  // notes + amount (set at /start, untamperable by the client). This blocks a
  // pay-cheap-activate-expensive swap: body.plan_id is NOT trusted.
  let rpOrder;
  try {
    rpOrder = await fetchRazorpayOrder({ keyId: gw.key_id as string, keySecret: gw.key_secret as string }, razorpay_order_id);
  } catch {
    return NextResponse.json({ error: "Could not verify the order." }, { status: 502 });
  }
  const notes = rpOrder.notes ?? {};
  if (notes.kind !== "plan" || notes.store_id !== store.id) {
    return NextResponse.json({ error: "This payment does not match your account." }, { status: 400 });
  }
  const orderPlanId = notes.plan_id;
  if (!orderPlanId || (plan_id && plan_id !== orderPlanId)) {
    return NextResponse.json({ error: "Plan mismatch." }, { status: 400 });
  }

  const { data: plan } = await admin
    .from("plans")
    .select("id, price, is_active")
    .eq("id", orderPlanId)
    .eq("is_active", true)
    .maybeSingle();
  if (!plan) return NextResponse.json({ error: "Plan not found or inactive." }, { status: 404 });

  const expectedPaise = (plan.price as number) * 100;
  if (Number(rpOrder.amount) !== expectedPaise) {
    return NextResponse.json({ error: "Amount mismatch." }, { status: 400 });
  }

  // Single-use: the UNIQUE index on razorpay_order_id makes a replayed order a
  // no-op (idempotent) instead of a free renewal/extension.
  const { error: ledgerErr } = await admin.from("plan_payments").insert({
    store_id: store.id as string,
    plan_id: plan.id as string,
    razorpay_order_id,
    razorpay_payment_id,
    amount: expectedPaise,
  });
  if (ledgerErr) {
    // Duplicate (already processed) → treat as success without re-activating.
    return NextResponse.json({ ok: true, already: true });
  }

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const result = await upsertSubscription({
    storeId: store.id as string,
    planId: plan.id as string,
    amountPaise: expectedPaise,
    periodEndDate: periodEnd,
  });
  if (!result.ok) return NextResponse.json({ error: result.error ?? "Could not activate plan." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
