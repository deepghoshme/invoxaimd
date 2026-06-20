import { NextRequest, NextResponse } from "next/server";
import { getCurrentStore } from "@/lib/auth";
import { assertNotImpersonating } from "@/lib/impersonation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCustomInvoice, type CustomLineItemInput } from "@/lib/invoice";
import { sendCustomInvoiceEmail } from "@/lib/transactional";

/**
 * POST /api/invoices/custom
 *
 * Seller-only. Creates a CUSTOM invoice (kind='custom') from manually-entered
 * line items, scoped to the caller's own store. Optionally emails it to the
 * customer with the PDF attached.
 *
 * Tenancy: the store is resolved from the SESSION via getCurrentStore() — the
 * body never supplies a store_id, so a seller can only issue invoices for their
 * own store. Impersonating admins are blocked (issuing an invoice is an
 * outward-facing action; we don't let an impersonation session create one).
 *
 * Money: all totals are computed server-side in createCustomInvoice. The client
 * only sends line-item descriptions + per-line amounts and a tax rate; the
 * stored subtotal/GST/total come exclusively from the server computation.
 *
 * Response: { ok: true, invoiceId, invoiceNumber, pdfUrl, emailed } so the
 * client can immediately link to /api/invoices/[id]/pdf for download.
 */
export async function POST(req: NextRequest) {
  // Block impersonation — an admin "viewing as" a seller must not mint a real
  // invoice / send a real email on the seller's behalf.
  const guard = await assertNotImpersonating();
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: 403 });
  }

  const { store } = await getCurrentStore();
  if (!store) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  }

  let body: {
    buyer_name?: string;
    buyer_email?: string;
    title?: string;
    currency?: string;
    tax_rate?: number | string;
    same_state?: boolean;
    line_items?: { description?: string; amount?: number | string }[];
    send_email?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const buyerName = (body.buyer_name ?? "").trim() || null;
  const rawBuyerEmail = (body.buyer_email ?? "").trim();
  const buyerEmail = rawBuyerEmail || null;
  if (buyerEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(buyerEmail)) {
    return NextResponse.json({ ok: false, error: "Customer email is not valid." }, { status: 400 });
  }
  const wantsEmail = body.send_email === true;
  if (wantsEmail && !buyerEmail) {
    return NextResponse.json(
      { ok: false, error: "A customer email is required to send the invoice." },
      { status: 400 },
    );
  }

  const lineItems: CustomLineItemInput[] = Array.isArray(body.line_items)
    ? body.line_items.map((li) => ({
        description: String(li?.description ?? ""),
        amount: Number(li?.amount),
      }))
    : [];

  let taxRate: number | null = null;
  if (body.tax_rate !== undefined && body.tax_rate !== null && body.tax_rate !== "") {
    const n = Number(body.tax_rate);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return NextResponse.json({ ok: false, error: "Tax rate must be 0–100." }, { status: 400 });
    }
    taxRate = n;
  }

  const admin = createAdminClient();

  // Fetch the seller's store identity for the invoice (legal/branding fields).
  const { data: storeRow } = await admin
    .from("stores")
    .select(
      "id, gst_rate, gstin, legal_name, billing, currency, invoice_business_name, send_from_email, reply_to_email",
    )
    .eq("id", store.id)
    .maybeSingle();

  const sRow = (storeRow ?? {}) as {
    id?: string;
    gst_rate?: number | null;
    gstin?: string | null;
    legal_name?: string | null;
    billing?: Record<string, unknown> | null;
    currency?: string | null;
    invoice_business_name?: string | null;
    send_from_email?: string | null;
    reply_to_email?: string | null;
  };

  const currency = (body.currency || sRow.currency || "INR").toUpperCase();

  const result = await createCustomInvoice({
    adminClient: admin,
    store: {
      id: store.id,
      gst_rate: sRow.gst_rate ?? null,
      gstin: sRow.gstin ?? null,
      legal_name: sRow.legal_name ?? null,
      billing: (sRow.billing as never) ?? null,
      invoice_business_name: sRow.invoice_business_name ?? null,
    },
    buyerName,
    buyerEmail,
    title: (body.title ?? "").trim() || null,
    currency,
    taxRate,
    sameState: body.same_state !== false,
    lineItems,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  const invoice = result.invoice;

  // Optionally email the invoice to the customer (non-fatal — the invoice is
  // already created either way). From honours the seller's send_from_email.
  let emailed = false;
  if (wantsEmail && buyerEmail) {
    try {
      await sendCustomInvoiceEmail({
        to: buyerEmail,
        invoice,
        sellerName: invoice.seller_legal_name,
        sellerSendFrom: sRow.send_from_email ?? null,
        replyTo: sRow.reply_to_email ?? null,
      });
      emailed = true;
    } catch {
      // Non-fatal — surface emailed=false so the UI can note the send failed.
      emailed = false;
    }
  }

  return NextResponse.json({
    ok: true,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    pdfUrl: `/api/invoices/${invoice.id}/pdf`,
    emailed,
  });
}
