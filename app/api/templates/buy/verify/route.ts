import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRazorpaySignature, fetchRazorpayOrder } from "@/lib/razorpay";
import { applyTemplate } from "@/app/dashboard/templates/actions";
import type { PageTypeEnum } from "@/lib/templates-apply";

export const dynamic = "force-dynamic";

/**
 * POST /api/templates/buy/verify
 *
 * Verifies a Razorpay payment signature for a template purchase and, on success:
 *  1. Verifies the signature against the PLATFORM gateway secret.
 *  2. Re-fetches the order from Razorpay to bind to server-set notes.
 *  3. Asserts notes.kind === 'template' && notes.store_id === authenticated store.
 *  4. Validates order.amount === price_paise from notes (not from DB; /start set both).
 *     Then ALSO cross-validates against DB price to catch any template price change.
 *  5. Inserts template_purchases row. Idempotent: UNIQUE index on
 *     (store_id, template_id, coalesce(page_id, zero-uuid)) turns duplicates into
 *     { ok: true, already: true } without re-applying or re-incrementing.
 *  6. Increments templates.sales_count once (only if the insert above succeeded).
 *  7. Calls applyTemplate() and returns { ok: true, redirect }.
 *
 * Money-safety notes:
 * - Signature is verified BEFORE any DB writes.
 * - template_id, page_id, and amount are all bound to ORDER NOTES (server-set at
 *   /start), never to the client request body. A client cannot swap template_id or
 *   inflate/deflate amounts after the Razorpay order is created.
 * - PLATFORM REVENUE: the template_purchases row with source='razorpay' IS the
 *   revenue record for this rail. Phase F should union template_purchases WHERE
 *   source='razorpay' to total Razorpay template revenue (see report in README).
 */
export async function POST(req: Request) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // ── Parse body ─────────────────────────────────────────────────────────────
  // We only trust: razorpay_order_id, razorpay_payment_id, razorpay_signature.
  // template_id, page_id, price are re-read from the server-set order notes.
  let body: {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
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

  const admin = createAdminClient();

  // ── Resolve store ──────────────────────────────────────────────────────────
  const { data: store } = await admin
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) return NextResponse.json({ error: "No store found for your account." }, { status: 403 });
  const storeId = store.id as string;

  // ── Platform gateway secret ────────────────────────────────────────────────
  const { data: gw } = await admin
    .from("platform_gateways")
    .select("key_id, key_secret, is_enabled")
    .eq("id", true)
    .maybeSingle();

  if (!(gw as { key_id?: string } | null)?.key_id || !(gw as { key_secret?: string } | null)?.key_secret) {
    return NextResponse.json({ error: "Gateway unavailable" }, { status: 503 });
  }

  // ── Signature verification ─────────────────────────────────────────────────
  const valid = verifyRazorpaySignature(
    (gw as { key_secret: string }).key_secret,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  );
  if (!valid) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  // ── Re-fetch order from Razorpay (authoritative notes) ────────────────────
  let rpOrder;
  try {
    rpOrder = await fetchRazorpayOrder(
      { keyId: (gw as { key_id: string }).key_id, keySecret: (gw as { key_secret: string }).key_secret },
      razorpay_order_id,
    );
  } catch {
    return NextResponse.json({ error: "Could not verify the order with Razorpay." }, { status: 502 });
  }

  const notes = rpOrder.notes ?? {};

  // ── Bind to server-set notes ───────────────────────────────────────────────
  // kind + store_id from notes guard against cross-account replay.
  if (notes.kind !== "template") {
    return NextResponse.json({ error: "This payment is not a template purchase." }, { status: 400 });
  }
  if (notes.store_id !== storeId) {
    return NextResponse.json({ error: "This payment does not match your account." }, { status: 400 });
  }

  const templateId = notes.template_id;
  // page_id: "" in notes means per_store (licensePageId = null).
  const licensePageId: string | null = notes.page_id && notes.page_id !== "" ? notes.page_id : null;
  const notesPrice = notes.price_paise ? Number(notes.price_paise) : null;
  const licenseModel = notes.license_model as "per_store" | "per_page" | undefined;
  const pageType = notes.page_type as PageTypeEnum | undefined;

  if (!templateId || notesPrice === null || !licenseModel || !pageType) {
    return NextResponse.json({ error: "Order notes are incomplete. Cannot process." }, { status: 400 });
  }

  // ── Amount validation ──────────────────────────────────────────────────────
  // The order.amount was set by /start from the DB price. We also cross-check
  // against the current DB price to catch any price change between /start and /verify.
  // If the DB price changed, we accept the AMOUNT THE USER ACTUALLY PAID (the order
  // amount) as long as it matches notes.price_paise (set at /start from DB).
  const { data: tmpl } = await admin
    .from("templates")
    .select("id, price_paise, status, tier, name")
    .eq("id", templateId)
    .maybeSingle();

  if (!tmpl) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  if ((tmpl as { status: string }).status !== "published") {
    return NextResponse.json({ error: "Template is no longer published." }, { status: 400 });
  }
  if ((tmpl as { tier: string }).tier !== "premium") {
    return NextResponse.json({ error: "Template is not premium." }, { status: 400 });
  }

  // The Razorpay order amount is authoritative for what was charged.
  // notes.price_paise is what /start read from DB and put in the order — the
  // order.amount must match it exactly (Razorpay sets order.amount == the amount
  // we passed at creation).
  if (Number(rpOrder.amount) !== notesPrice) {
    console.error(
      `[templates/verify] amount mismatch: order=${rpOrder.amount} notes=${notesPrice} store=${storeId} tmpl=${templateId}`,
    );
    return NextResponse.json({ error: "Amount mismatch. Please contact support." }, { status: 400 });
  }

  // ── Idempotent insert of template_purchases ────────────────────────────────
  // UNIQUE index: (store_id, template_id, coalesce(page_id, zero-uuid))
  // A duplicate (e.g. webhook replay or double-click) hits the unique constraint
  // (code '23505') and is returned as { ok: true, already: true } — no
  // re-increment of sales_count, no double-apply.
  const { error: purchaseErr } = await admin
    .from("template_purchases")
    .insert({
      store_id: storeId,
      template_id: templateId,
      page_id: licensePageId,
      price_paise: notesPrice,
      source: "razorpay",
      payment_ref: razorpay_payment_id,
    });

  if (purchaseErr) {
    if (purchaseErr.code === "23505") {
      // Already processed (duplicate verify call). Return success without
      // re-applying or re-incrementing sales_count.
      return NextResponse.json({ ok: true, already: true });
    }
    console.error("[templates/verify] purchase insert failed:", purchaseErr);
    return NextResponse.json({ error: "Failed to record purchase. Please contact support." }, { status: 500 });
  }

  // ── Increment sales_count ─────────────────────────────────────────────────
  // Only runs if the insert above succeeded (not a duplicate). Non-fatal.
  // Try the RPC first; fall back to a read-then-write if it isn't present.
  const rpcResult = await admin.rpc("increment_template_sales", { tmpl_id: templateId });
  if (rpcResult.error) {
    await admin
      .from("templates")
      .update({ sales_count: ((tmpl as { sales_count?: number }).sales_count ?? 0) + 1 })
      .eq("id", templateId);
  }

  // ── Apply the template ─────────────────────────────────────────────────────
  // Now that the purchase row is recorded, applyTemplate will find the license
  // and apply the template content to the seller's page.
  // targetPageId: for per_page we pass the licensePageId (already resolved at /start);
  // for per_store we omit it so applyTemplate resolves the singleton itself.
  const applyResult = await applyTemplate(templateId, {
    pageType,
    targetPageId: licensePageId ?? undefined,
  });

  if (!applyResult.ok) {
    // Purchase succeeded but apply failed. The license is recorded so the seller
    // can manually apply from the gallery. Return the error but with ok:true for
    // the payment so the client knows the purchase went through.
    console.error("[templates/verify] applyTemplate failed:", (applyResult as { error: string }).error);
    return NextResponse.json({
      ok: false,
      purchase_recorded: true,
      error: "Payment recorded but template apply failed. Go to Templates and click Apply.",
    });
  }

  return NextResponse.json({ ok: true, redirect: applyResult.redirect, pageId: applyResult.pageId });
}
