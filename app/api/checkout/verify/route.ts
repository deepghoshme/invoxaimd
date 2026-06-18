import { NextResponse } from "next/server";
import { getOrderById, getStoreGateway, updateOrder } from "@/lib/sites";
import { verifyRazorpaySignature } from "@/lib/razorpay";

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

  return NextResponse.json({ ok: true, amount: order.amount, currency: order.currency });
}
