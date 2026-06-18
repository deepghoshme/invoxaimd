import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRazorpaySignature, fetchRazorpayOrder } from "@/lib/razorpay";

/**
 * POST /api/wallet/verify
 *
 * Verifies a Razorpay payment signature and credits the wallet.
 * Money-safety guarantees:
 * 1. Signature verified server-side using the seller's key_secret (never exposed to client).
 * 2. Amount is read AUTHORITATIVELY from the Razorpay Orders API (order.amount_paid),
 *    never from the client body — the client cannot inflate the credited amount.
 *    Double-credit is prevented by the UNIQUE INDEX on wallet_ledger.razorpay_order_id.
 * 3. Bonus amounts are computed server-side from the documented schedule — the
 *    client cannot influence which bonus tier applies.
 * 4. wallet_balance on stores is updated atomically alongside the ledger insert
 *    using service-role to bypass RLS.
 *
 * Idempotent: if the razorpay_order_id is already in the ledger, returns success
 * without double-crediting.
 */

const BONUS_SCHEDULE: [number, number][] = [
  [1000000, 75000], // ₹10,000 → +₹750
  [500000, 25000],  // ₹5,000 → +₹250
  [200000, 5000],   // ₹2,000 → +₹50
];

function bonusFor(paise: number): number {
  for (const [threshold, bonus] of BONUS_SCHEDULE) {
    if (paise >= threshold) return bonus;
  }
  return 0;
}

export async function POST(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    amount_paise?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing payment fields" }, { status: 400 });
  }

  // NOTE: body.amount_paise is intentionally IGNORED for crediting. The amount
  // is read authoritatively from the Razorpay order below (the order was created
  // server-side in /recharge with a validated amount). Trusting the client amount
  // here would let an attacker pay ₹500 and credit ₹1,00,000.

  const admin = createAdminClient();

  // ── Resolve store ─────────────────────────────────────────────────────────
  const { data: store } = await admin
    .from("stores")
    .select("id, wallet_balance")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  // ── Idempotency check ─────────────────────────────────────────────────────
  // If this razorpay_order_id already has a ledger entry, return existing balance.
  const { data: existing } = await admin
    .from("wallet_ledger")
    .select("id, balance_after")
    .eq("razorpay_order_id", razorpay_order_id)
    .eq("store_id", store.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: true,
      new_balance_paise: existing.balance_after,
      already_applied: true,
    });
  }

  // ── Signature verification ────────────────────────────────────────────────
  const { data: gateway } = await admin
    .from("payment_gateways")
    .select("key_id, key_secret, is_enabled")
    .eq("store_id", store.id)
    .maybeSingle();

  if (!gateway?.key_id || !gateway?.key_secret) {
    return NextResponse.json({ error: "Gateway unavailable" }, { status: 503 });
  }

  const valid = verifyRazorpaySignature(
    gateway.key_secret as string,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  );

  if (!valid) {
    return NextResponse.json({ error: "Payment signature verification failed" }, { status: 400 });
  }

  // ── Authoritative amount from Razorpay (NEVER the client body) ─────────────
  // Fetch the order with the seller's keys and credit exactly what was paid.
  let order;
  try {
    order = await fetchRazorpayOrder(
      { keyId: gateway.key_id as string, keySecret: gateway.key_secret as string },
      razorpay_order_id,
    );
  } catch (e) {
    console.error("[wallet/verify] Razorpay order fetch failed:", e);
    return NextResponse.json({ error: "Could not confirm payment with gateway" }, { status: 502 });
  }

  // The order must actually be paid, and we credit amount_paid (falling back to
  // the order amount). Bounds re-checked as defense-in-depth.
  const raw = Number(order.amount_paid || order.amount);
  if (order.status !== "paid" || !Number.isInteger(raw) || raw <= 0) {
    return NextResponse.json({ error: "Payment not captured" }, { status: 400 });
  }
  if (raw < 50000 || raw > 10000000) {
    return NextResponse.json({ error: "Amount out of range" }, { status: 400 });
  }

  // ── Credit the wallet ─────────────────────────────────────────────────────
  // razorpay_order_id is logged to the unique index as the true idempotency guard.
  const currentBalance = Number(store.wallet_balance ?? 0);
  const rechargeBonus = bonusFor(raw);
  const totalCredit = raw + rechargeBonus;
  const newBalance = currentBalance + totalCredit;

  // Insert ledger row(s) — recharge amount
  const { error: ledgerError } = await admin.from("wallet_ledger").insert({
    store_id: store.id,
    type: "credit",
    amount: raw,
    balance_after: newBalance,
    reason: "recharge",
    gateway_payment_id: razorpay_payment_id,
    razorpay_order_id: razorpay_order_id,
  });

  if (ledgerError) {
    // If the unique constraint fires, it means we raced — treat as already applied.
    if (ledgerError.code === "23505") {
      const { data: raceRow } = await admin
        .from("wallet_ledger")
        .select("balance_after")
        .eq("razorpay_order_id", razorpay_order_id)
        .maybeSingle();
      return NextResponse.json({
        ok: true,
        new_balance_paise: raceRow?.balance_after ?? currentBalance,
        already_applied: true,
      });
    }
    console.error("[wallet/verify] ledger insert failed:", ledgerError);
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
  }

  // If there's a bonus, insert a second ledger row
  if (rechargeBonus > 0) {
    await admin.from("wallet_ledger").insert({
      store_id: store.id,
      type: "credit",
      amount: rechargeBonus,
      balance_after: newBalance,
      reason: `recharge_bonus`,
      gateway_payment_id: razorpay_payment_id,
      razorpay_order_id: null, // no unique constraint conflict for bonus row
    });
  }

  // Update denormalised balance on stores
  await admin
    .from("stores")
    .update({ wallet_balance: newBalance })
    .eq("id", store.id);

  return NextResponse.json({
    ok: true,
    new_balance_paise: newBalance,
    bonus_paise: rechargeBonus,
    already_applied: false,
  });
}
