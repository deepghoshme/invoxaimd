import { NextResponse } from "next/server";
import { getOrderById, getStoreGateway, updateOrder } from "@/lib/sites";
import { createRazorpayOrder } from "@/lib/razorpay";

/**
 * Start payment for an existing order: save buyer details, create a Razorpay
 * order with the SELLER's keys, and return the public checkout params. The
 * key_secret never leaves the server — only key_id (publishable) is returned.
 */
export async function POST(req: Request) {
  let body: {
    order_id?: string;
    buyer_email?: string;
    buyer_name?: string;
    buyer_phone?: string;
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

  const gateway = await getStoreGateway(order.store_id);
  if (!gateway || !gateway.is_enabled || !gateway.key_id || !gateway.key_secret) {
    return NextResponse.json(
      { error: "This seller hasn’t finished setting up payments." },
      { status: 503 },
    );
  }

  // Persist buyer details (best-effort) before creating the gateway order.
  await updateOrder(order.id, {
    buyer_email: body.buyer_email?.trim() || null,
    buyer_name: body.buyer_name?.trim() || null,
    buyer_phone: body.buyer_phone?.trim() || null,
  });

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
  } catch {
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
