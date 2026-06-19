import { NextResponse } from "next/server";
import { getOrderById, getStoreGateway, updateOrder } from "@/lib/sites";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { createAdminClient } from "@/lib/supabase/admin";
import { incrementCouponUsageByCode } from "@/lib/coupons";
import { sendOrderReceipt } from "@/lib/transactional";

/**
 * Verify a Razorpay checkout signature and mark the order paid. The signature
 * is checked server-side against the seller's key_secret — a client cannot fake
 * a paid order. Returns the amount/currency so the page can fire purchase pixels.
 */
export async function POST(req: Request) {
  let body: {
    order_id?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!order_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const order = await getOrderById(order_id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.gateway_order_id !== razorpay_order_id) {
    return NextResponse.json({ error: "Order mismatch" }, { status: 400 });
  }
  if (order.status === "paid") {
    return NextResponse.json({ ok: true, amount: order.amount, currency: order.currency });
  }

  const gateway = await getStoreGateway(order.store_id);
  if (!gateway?.key_secret) {
    return NextResponse.json({ error: "Gateway unavailable" }, { status: 503 });
  }

  const valid = verifyRazorpaySignature(
    gateway.key_secret,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  );
  if (!valid) {
    await updateOrder(order.id, { status: "failed" });
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  await updateOrder(order.id, {
    status: "paid",
    gateway_payment_id: razorpay_payment_id,
    gateway_signature: razorpay_signature,
    paid_at: new Date().toISOString(),
  });

  // Consume a coupon use only now that payment is confirmed. The "already paid"
  // early-return above makes this run exactly once per order, so repeated verify
  // calls can't double-count.
  if (order.coupon_code) {
    await incrementCouponUsageByCode(order.store_id, order.coupon_code);
  }

  // ── Platform commission ────────────────────────────────────────────────────
  // Debit the platform's commission from the seller's wallet now that the sale
  // is confirmed. Idempotent: the unique index on wallet_ledger.razorpay_order_id
  // makes a duplicate insert (e.g. a retried verify) a no-op rather than a
  // double-charge. Non-fatal — a ledger hiccup must never block the buyer.
  if (order.commission_amount && order.commission_amount > 0) {
    try {
      const admin = createAdminClient();
      const { data: storeRow } = await admin
        .from("stores")
        .select("wallet_balance")
        .eq("id", order.store_id)
        .maybeSingle();
      const currentBalance = Number(storeRow?.wallet_balance ?? 0);
      const newBalance = currentBalance - order.commission_amount;
      const { error: ledgerErr } = await admin.from("wallet_ledger").insert({
        store_id: order.store_id,
        type: "debit",
        amount: order.commission_amount,
        balance_after: newBalance,
        reason: "commission",
        gateway_payment_id: razorpay_payment_id,
        razorpay_order_id: razorpay_order_id,
      });
      // Only move the denormalised balance if the ledger row was actually written
      // (a unique-violation means commission was already taken for this order).
      if (!ledgerErr) {
        await admin.from("stores").update({ wallet_balance: newBalance }).eq("id", order.store_id);
      }
    } catch {
      // non-fatal
    }
  }

  // Buyer order receipt (from hello@, record copy to admin@). Non-fatal.
  await sendOrderReceipt({
    to: order.buyer_email,
    buyerName: order.buyer_name,
    productTitle: order.product_title,
    amountPaise: order.amount,
    currency: order.currency,
    orderId: order.id,
  });

  // ── Booking confirmation ───────────────────────────────────────────────────
  // If this order was for a paid booking session, flip the SPECIFIC matching
  // pending booking row to "confirmed" and record the order_id on it.
  //
  // Security: we NEVER run a page-wide update. buyer_email is required (the
  // booking flow always stores it on the order); without it we refuse to
  // confirm rather than risk confirming every pending booking on the page.
  // We resolve a single row id (most recent pending booking for this buyer on
  // this page) and update strictly by id.
  //
  // TODO: persist bookings.id on the order at booking-creation time and match
  // on order.booking_id directly, plus a TTL cleanup job for abandoned holds.
  if (order.page_type === "booking" && order.page_id) {
    if (!order.buyer_email) {
      console.error("[verify] booking order missing buyer_email; refusing page-wide confirmation", order.id);
    } else {
      try {
        const sb = createAdminClient();
        const { data: bk } = await sb
          .from("bookings")
          .select("id")
          .eq("page_id", order.page_id)
          .eq("buyer_email", order.buyer_email)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (bk?.id) {
          await sb.from("bookings").update({ status: "confirmed", order_id: order.id }).eq("id", bk.id);
        } else {
          console.error("[verify] no matching pending booking for order", order.id);
        }
      } catch {
        // Non-fatal: payment is already recorded; booking confirmation can be
        // retried manually or via a webhook. Log the miss for ops visibility.
        console.error("[verify] Failed to confirm booking for order", order.id);
      }
    }
  }

  return NextResponse.json({ ok: true, amount: order.amount, currency: order.currency });
}
