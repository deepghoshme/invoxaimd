import { NextResponse } from "next/server";
import { getOrderById, getStoreGateway, updateOrder } from "@/lib/sites";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { createAdminClient } from "@/lib/supabase/admin";
import { incrementCouponUsageByCode } from "@/lib/coupons";
import { sendOrderReceipt, sendTaxInvoiceEmail } from "@/lib/transactional";
import { createInvoiceForOrder } from "@/lib/invoice";

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
  // Fetch the seller's reply_to_email so buyer replies reach the seller.
  // From stays the platform alias — never the seller's address.
  let sellerReplyTo: string | null = null;
  let sellerSendFrom: string | null = null;
  try {
    const sb2 = createAdminClient();
    const { data: storeRow2 } = await sb2
      .from("stores")
      .select("reply_to_email, send_from_email")
      .eq("id", order.store_id)
      .maybeSingle();
    sellerReplyTo = storeRow2?.reply_to_email ?? null;
    sellerSendFrom = storeRow2?.send_from_email ?? null;
  } catch { /* non-fatal — missing fields just means platform-default From + no Reply-To */ }

  await sendOrderReceipt({
    to: order.buyer_email,
    buyerName: order.buyer_name,
    productTitle: order.product_title,
    amountPaise: order.amount,
    currency: order.currency,
    orderId: order.id,
    sellerReplyTo,
    sellerSendFrom,
  });

  // ── GST Tax Invoice ────────────────────────────────────────────────────────
  // Generate and email a GST tax invoice for the confirmed order.
  // Additive + non-fatal: wrapped in try/catch so any failure here NEVER
  // blocks payment confirmation or the buyer receipt above. createInvoiceForOrder
  // is itself idempotent on order_id (no double-insert on retried verify calls).
  // The admin client used here is the same service-role client the commission
  // block above already uses — no new auth surface introduced.
  try {
    const adminForInvoice = createAdminClient();
    // Fetch seller store fields needed for the invoice (gst_rate, gstin,
    // legal_name, billing jsonb). Narrow select — does not alter any state.
    const { data: storeForInv } = await adminForInvoice
      .from("stores")
      .select("id, gst_rate, gstin, legal_name, billing")
      .eq("id", order.store_id)
      .maybeSingle();

    if (storeForInv) {
      const inv = await createInvoiceForOrder({
        adminClient: adminForInvoice,
        order: {
          id: order.id,
          store_id: order.store_id,
          buyer_email: order.buyer_email,
          buyer_name: order.buyer_name,
          buyer_state: order.buyer_state ?? null,
          amount: order.amount,
          currency: order.currency,
          product_title: order.product_title,
        },
        store: storeForInv as {
          id: string;
          gst_rate?: number | null;
          gstin?: string | null;
          legal_name?: string | null;
          billing?: Record<string, unknown> | null;
        },
      });

      if (inv) {
        await sendTaxInvoiceEmail({
          to: order.buyer_email,
          invoice: inv,
          productTitle: order.product_title,
          sellerName: (storeForInv as { legal_name?: string | null }).legal_name ?? null,
          replyTo: sellerReplyTo,
          sellerSendFrom,
        });
      }
    }
  } catch {
    // Non-fatal: invoice/email failure must never block payment confirmation.
    console.error("[verify] tax invoice generation failed for order", order.id);
  }

  // ── Buyer linkage ──────────────────────────────────────────────────────────
  // After a confirmed payment, try to link the order to a known verified auth
  // user so the purchase appears immediately in their /account page.
  //
  // Lookup strategy (two-step, no email filter on listUsers):
  //   1. Query public.profiles by lower(email) — service-role bypasses RLS.
  //      profiles.id is a 1:1 FK to auth.users and is populated by a trigger
  //      at signup. Case-insensitive ilike match avoids case-mismatch misses.
  //   2. Confirm email_confirmed_at IS NOT NULL via auth.admin.getUserById.
  //      This is the authoritative verified-only check (same pattern as
  //      app/auth/callback/route.ts). A user who signed up but never confirmed
  //      their email must NOT have their order pre-linked — that would allow
  //      an attacker to register with a victim's email and steal purchase
  //      history before the real owner verifies.
  //
  // Idempotent: we only SET buyer_id when it is currently null (the early-return
  // above already prevents re-running this for already-paid orders on a retry,
  // but the null-check is a belt-and-suspenders guard).
  // Non-fatal: any hiccup here must never block the 200 response to the buyer.
  //
  // We resolve buyerId for use in the course enrollment block below.
  let resolvedBuyerId: string | null = null;
  if (order.buyer_email) {
    try {
      const adminForLink = createAdminClient();
      // Step 1: find a matching profile by email (case-insensitive, LITERAL).
      // Escape LIKE wildcards (`_`/`%` are common/abusable in emails) so the
      // lookup can't match a different account, then re-confirm an exact match
      // in JS — a wrong match here would link the order to the wrong buyer (IDOR).
      const wantEmail = order.buyer_email.trim().toLowerCase();
      const safeEmail = wantEmail.replace(/([\\%_])/g, "\\$1");
      const { data: profileRow } = await adminForLink
        .from("profiles")
        .select("id, email")
        .ilike("email", safeEmail)
        .maybeSingle();

      if (profileRow?.id && (profileRow.email ?? "").trim().toLowerCase() === wantEmail) {
        // Step 2: confirm the account's email is verified.
        const { data: authData } = await adminForLink.auth.admin.getUserById(profileRow.id);
        const verified = !!authData?.user?.email_confirmed_at;

        if (verified) {
          resolvedBuyerId = profileRow.id;
          // Only patch the order when buyer_id is still null — idempotent.
          // (order.buyer_id is not on the Order type yet but the DB column
          // exists; we rely on the null-check query rather than the type field.)
          await adminForLink
            .from("orders")
            .update({ buyer_id: resolvedBuyerId })
            .eq("id", order.id)
            .is("buyer_id", null);
        }
      }
    } catch {
      // Non-fatal: buyer linkage failure must never block payment confirmation.
      console.error("[verify] buyer linkage failed for order", order.id);
    }
  }

  // ── Course enrollment ──────────────────────────────────────────────────────
  // For course purchases, create an enrollment row so the buyer immediately
  // has access. The UNIQUE partial indexes on (page_id, buyer_id) and
  // (page_id, lower(buyer_email)) make a duplicate INSERT (retried verify) a
  // unique-violation that we catch and ignore — it is never a double-enroll.
  //
  // Edge cases:
  //  - No buyer_email on the order: enrollment is skipped (no identity to tie
  //    it to); the buyer will need to contact support.
  //  - page_id null on a course order: should not happen in normal flow (course
  //    checkout always has a page_id), but we guard explicitly.
  //  - buyer_id null (unrecognised email): enrollment is still created with
  //    buyer_id = null and buyer_email set; the Wave 2 claim flow backfills
  //    buyer_id when the buyer later signs up/logs in.
  // Non-fatal.
  if (order.page_type === "course" && order.page_id) {
    if (!order.buyer_email) {
      console.error("[verify] course order missing buyer_email; enrollment skipped", order.id);
    } else {
      try {
        const adminForEnroll = createAdminClient();
        const { error: enrollErr } = await adminForEnroll
          .from("course_enrollments")
          .insert({
            buyer_id: resolvedBuyerId,
            buyer_email: order.buyer_email,
            page_id: order.page_id,
            store_id: order.store_id,
            order_id: order.id,
          });
        // Unique-violation (code "23505") means this order already has an
        // enrollment row — a retried verify call, perfectly fine. Any other
        // error is logged but still non-fatal.
        if (enrollErr && enrollErr.code !== "23505") {
          console.error("[verify] course enrollment insert error", order.id, enrollErr.code);
        }
      } catch {
        console.error("[verify] course enrollment failed for order", order.id);
      }
    }
  }

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
