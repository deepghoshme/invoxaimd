import "server-only";

import { createHmac } from "node:crypto";

const API = "https://api.razorpay.com/v1";

export type RazorpayKeys = { keyId: string; keySecret: string };

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  status: string;
};

/** Create a Razorpay order using the SELLER's keys. Throws on API error. */
export async function createRazorpayOrder(
  keys: RazorpayKeys,
  params: { amount: number; currency: string; receipt: string; notes?: Record<string, string> },
): Promise<RazorpayOrder> {
  const auth = Buffer.from(`${keys.keyId}:${keys.keySecret}`).toString("base64");
  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amount,
      currency: params.currency,
      receipt: params.receipt,
      notes: params.notes ?? {},
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Razorpay order failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return (await res.json()) as RazorpayOrder;
}

/**
 * Verify a Razorpay checkout signature.
 * signature == HMAC_SHA256(`${order_id}|${payment_id}`, key_secret).
 */
export function verifyRazorpaySignature(
  keySecret: string,
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  const expected = createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  // constant-ish comparison
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
