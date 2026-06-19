import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderInvoicePdf } from "@/lib/invoicePdf";
import type { InvoiceRow } from "@/lib/invoice";

/**
 * GET /api/invoices/[id]/pdf
 *
 * Auth: seller session via the SESSION client (anon key + cookies) so RLS is
 * enforced. The `invoices_owner_read` policy gates access to rows where
 * owns_store(store_id) OR is_admin(). A seller can only download their own
 * store's invoices — fetching another store's invoice returns no row, which
 * we surface as 404 (not 403, to avoid leaking existence).
 *
 * Never uses the admin/service-role client for the invoice fetch — RLS on the
 * session client is the sole tenancy boundary.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Validate the route parameter — must be a non-empty UUID-shaped string.
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
  }

  // Build the session-bound Supabase client (enforces RLS as the logged-in user).
  const sb = await createClient();

  // Verify the caller is authenticated.
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch the invoice via the SESSION client — RLS policy `invoices_owner_read`
  // returns rows only where owns_store(store_id) OR is_admin() holds for the
  // calling user. Any other seller's invoice (or a non-existent row) returns
  // null, surfaced as 404 to avoid leaking whether the row exists.
  const { data: inv, error } = await sb
    .from("invoices")
    .select(
      "id, store_id, order_id, invoice_number, buyer_name, buyer_email, currency, subtotal_paise, tax_rate, cgst_paise, sgst_paise, igst_paise, total_paise, gstin, seller_legal_name, seller_address, kind, meta, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[invoices/pdf] DB error", error);
    return NextResponse.json({ error: "Failed to load invoice" }, { status: 500 });
  }

  if (!inv) {
    // Row not found OR RLS filtered it out — return 404 (not 403) to avoid
    // leaking the existence of invoices belonging to other stores.
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const invoice = inv as InvoiceRow;

  // Render the PDF. All monetary values come exclusively from the fetched
  // InvoiceRow columns — no client input is trusted for amounts.
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderInvoicePdf(invoice, {
      sellerLegalName: invoice.seller_legal_name,
      sellerGstin: invoice.gstin,
      sellerAddress: invoice.seller_address,
    });
  } catch (err) {
    console.error("[invoices/pdf] PDF generation failed", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }

  const filename = `Invoice-${invoice.invoice_number}.pdf`;

  // NextResponse body must be BodyInit (Uint8Array / ReadableStream / etc.).
  // Convert Node Buffer -> Uint8Array so TypeScript is satisfied.
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
      // No caching — invoices are sensitive financial documents.
      "Cache-Control": "no-store",
    },
  });
}
