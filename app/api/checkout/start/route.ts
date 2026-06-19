import { NextResponse } from "next/server";
import { getOrderById, getStoreGateway, updateOrder } from "@/lib/sites";
import { createRazorpayOrder } from "@/lib/razorpay";
import {
  getWalletGatePlatformConfig,
  isCheckoutBlockedForStore,
  syncCheckoutBlockedFlag,
} from "@/lib/walletGate";
import { isStoreStoppedForPlan } from "@/lib/planGate";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Start payment for an existing order: save buyer details, create a Razorpay
 * order with the SELLER's keys, and return the public checkout params. The
 * key_secret never leaves the server — only key_id (publishable) is returned.
 *
 * Gate checks (in order — all before any Razorpay call):
 * 1. Gateway missing/disabled → 503
 * 2. Wallet gate: if wallet_gate_enabled and balance <= floor → 503 (generic)
 * 3. Plan expiry: if the seller has a past_due subscription → 503 (generic)
 *
 * Money-safety: no prices or amounts change here. These are entry-point gates
 * that PREVENT new orders from being started; they never alter the order amount
 * or commission math. Internal state (wallet balance, plan status) is never
 * leaked to the buyer — all 503s return the same generic message.
 */
export async function POST(req: Request) {
  let body: {
    order_id?: string;
    buyer_email?: string;
    buyer_name?: string;
    buyer_phone?: string;
    /** Buyer's state/UT — optional, used for GST intra/inter-state routing on invoice. */
    buyer_state?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const order = body.order_id ? await getOrderById(body.order_id) : null;
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status === "paid") {
    return NextResponse.json({ error: "Order already paid" }, { status: 409 });
  }

  // ── Gateway check ──────────────────────────────────────────────────────────
  const gateway = await getStoreGateway(order.store_id);
  if (!gateway || !gateway.is_enabled || !gateway.key_id || !gateway.key_secret) {
    return NextResponse.json(
      { error: "This seller hasn't finished setting up payments." },
      { status: 503 },
    );
  }

  // ── Wallet gate ────────────────────────────────────────────────────────────
  // Fetch store wallet fields + platform config in parallel. Both calls are
  // best-effort: on any DB error we fail open (never block checkout due to
  // an infrastructure hiccup when the feature may be off).
  const admin = createAdminClient();
  const [storeRow, platformConfig] = await Promise.all([
    admin
      .from("stores")
      .select("wallet_balance, checkout_blocked, wallet_floor_paise")
      .eq("id", order.store_id)
      .maybeSingle()
      .then(
        (r) =>
          r.data as {
            wallet_balance: number | null;
            checkout_blocked: boolean | null;
            wallet_floor_paise: number | null;
          } | null,
      ),
    getWalletGatePlatformConfig(),
  ]);

  if (storeRow) {
    const gateResult = isCheckoutBlockedForStore(storeRow, platformConfig);

    // Sync the cached flag if it's out of date (non-fatal, fire-and-forget).
    const currentCachedFlag = storeRow.checkout_blocked ?? false;
    if (gateResult.blocked !== currentCachedFlag) {
      syncCheckoutBlockedFlag(order.store_id, gateResult.blocked).catch(() => {});
    }

    if (gateResult.blocked) {
      // Do NOT leak wallet balance or floor to the buyer response.
      console.warn(
        `[checkout/start] Wallet gate blocked store ${order.store_id}: ${gateResult.reason}`,
      );
      return NextResponse.json(
        { error: "This store is temporarily not accepting orders." },
        { status: 503 },
      );
    }
  }

  // ── Plan-expiry gate ───────────────────────────────────────────────────────
  // A seller whose PAID plan is past_due (expired) cannot accept new orders.
  // Free-plan sellers (no subscription row at all) are NOT blocked — only
  // sellers who bought a plan and let it expire are stopped.
  // "past_due" is set by the cron job (subscriptionExpiry) when
  // current_period_end passes for an active subscription.
  try {
    const { data: sub } = await admin
      .from("subscriptions")
      .select("status")
      .eq("store_id", order.store_id)
      .maybeSingle();

    // isStoreStoppedForPlan is a pure function that encodes exactly who is
    // stopped (see lib/planGate.ts). null → free-plan seller → not stopped.
    const planGate = isStoreStoppedForPlan(
      (sub?.status as "active" | "past_due" | "canceled" | null) ?? null,
    );
    if (planGate.stopped) {
      console.warn(
        `[checkout/start] Plan-expiry gate blocked store ${order.store_id}: ${planGate.reason}`,
      );
      return NextResponse.json(
        { error: "This store is temporarily not accepting orders." },
        { status: 503 },
      );
    }
  } catch (subErr) {
    // subscriptions table may not exist yet during migration — fail open.
    console.warn("[checkout/start] subscription check skipped (non-fatal):", subErr);
  }

  // ── Persist buyer details ─────────────────────────────────────────────────
  // Best-effort before creating the gateway order.
  // buyer_state is optional — a null/empty value is allowed and never blocks checkout.
  const buyerState = body.buyer_state?.trim() || null;
  await updateOrder(order.id, {
    buyer_email: body.buyer_email?.trim() || null,
    buyer_name: body.buyer_name?.trim() || null,
    buyer_phone: body.buyer_phone?.trim() || null,
    buyer_state: buyerState,
  });

  // ── Create Razorpay order ─────────────────────────────────────────────────
  let rp;
  try {
    rp = await createRazorpayOrder(
      { keyId: gateway.key_id, keySecret: gateway.key_secret },
      {
        amount: order.amount,
        currency: order.currency,
        receipt: order.id,
        notes: { order_id: order.id, store_id: order.store_id },
      },
    );
  } catch (e) {
    console.error("[checkout/start] Razorpay order creation failed:", e);
    return NextResponse.json({ error: "Payment gateway error. Try again." }, { status: 502 });
  }

  await updateOrder(order.id, { gateway_order_id: rp.id });

  return NextResponse.json({
    key_id: gateway.key_id,
    razorpay_order_id: rp.id,
    amount: order.amount,
    currency: order.currency,
    product_title: order.product_title,
  });
}
