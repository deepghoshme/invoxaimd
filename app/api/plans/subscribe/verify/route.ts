import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRazorpaySignature } from "@/lib/razorpay";
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
    .select("key_secret, is_enabled")
    .eq("id", true)
    .maybeSingle();
  if (!gw?.key_secret) return NextResponse.json({ error: "Gateway unavailable" }, { status: 503 });

  const valid = verifyRazorpaySignature(
    gw.key_secret as string,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  );
  if (!valid) return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });

  const { data: plan } = await admin
    .from("plans")
    .select("id, price, is_active")
    .eq("id", plan_id)
    .eq("is_active", true)
    .maybeSingle();
  if (!plan) return NextResponse.json({ error: "Plan not found or inactive." }, { status: 404 });

  const { data: store } = await admin.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
  if (!store) return NextResponse.json({ error: "No store found for your account." }, { status: 403 });

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const result = await upsertSubscription({
    storeId: store.id as string,
    planId: plan.id as string,
    amountPaise: (plan.price as number) * 100,
    periodEndDate: periodEnd,
  });
  if (!result.ok) return NextResponse.json({ error: result.error ?? "Could not activate plan." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
