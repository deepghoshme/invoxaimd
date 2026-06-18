import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRazorpayOrder } from "@/lib/razorpay";

/**
 * POST /api/wallet/recharge
 *
 * Creates a Razorpay order for a wallet top-up. The amount is validated
 * server-side against an allowed list and minimum floor — the client cannot
 * supply a different amount and have it accepted.
 *
 * Allowed amounts (paise): 500, 1000, 2000, 5000, 10000, or any multiple of
 * 100 between 500 and 100000 for custom amounts.
 *
 * Returns: { razorpay_order_id, key_id, amount_paise, currency }
 * The key_secret NEVER leaves this server.
 */
export async function POST(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { amount_paise?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // ── Server-side amount validation ─────────────────────────────────────────
  // amount_paise must be a whole-rupee amount (multiple of 100), min ₹500,
  // max ₹1,00,000. We never trust the client to compute this correctly.
  const raw = Number(body.amount_paise);
  if (!Number.isInteger(raw) || raw % 100 !== 0 || raw < 50000 || raw > 10000000) {
    // min 500 rupees = 50000 paise; max 1,00,000 rupees = 10,000,000 paise
    return NextResponse.json(
      { error: "Amount must be a whole-rupee value between ₹500 and ₹1,00,000" },
      { status: 400 },
    );
  }

  // ── Resolve store + gateway ───────────────────────────────────────────────
  const admin = createAdminClient();

  const { data: store } = await admin
    .from("stores")
    .select("id, wallet_balance")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const { data: gateway } = await admin
    .from("payment_gateways")
    .select("key_id, key_secret, is_enabled")
    .eq("store_id", store.id)
    .maybeSingle();

  if (!gateway || !gateway.is_enabled || !gateway.key_id || !gateway.key_secret) {
    return NextResponse.json(
      { error: "Payment gateway not configured. Set up Razorpay in Settings → Payment gateways first." },
      { status: 503 },
    );
  }

  // ── Create Razorpay order ─────────────────────────────────────────────────
  let rpOrder;
  try {
    rpOrder = await createRazorpayOrder(
      { keyId: gateway.key_id as string, keySecret: gateway.key_secret as string },
      {
        amount: raw,
        currency: "INR",
        receipt: `wallet_${store.id.slice(0, 8)}_${Date.now()}`,
        notes: { store_id: store.id, purpose: "wallet_recharge" },
      },
    );
  } catch (e) {
    console.error("[wallet/recharge] Razorpay order failed:", e);
    return NextResponse.json({ error: "Payment gateway error. Try again." }, { status: 502 });
  }

  return NextResponse.json({
    razorpay_order_id: rpOrder.id,
    key_id: gateway.key_id,
    amount_paise: raw,
    currency: "INR",
  });
}
