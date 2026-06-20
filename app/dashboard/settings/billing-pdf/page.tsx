import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead } from "@/components/dx/ui";
import BillingPdfClient from "./BillingPdfClient";

export const dynamic = "force-dynamic";

/**
 * Seller billing customization surface — mirrors the admin branding / send-from
 * panels but scoped to the seller's own store:
 *   1. Billing-PDF design (logo, business name, address, GSTIN, accent, footer)
 *   2. Custom send-from / reply-to email
 *   3. Create a custom invoice (manual bill) + download / email it
 */
export default async function BillingPdfPage() {
  const { store } = await requireDashboardStore();
  const admin = createAdminClient();

  const { data: storeExtra } = await admin
    .from("stores")
    .select(
      "logo_url, legal_name, gstin, gst_rate, billing, currency, invoice_business_name, invoice_accent_color, invoice_footer, send_from_email, reply_to_email",
    )
    .eq("id", store.id)
    .maybeSingle();

  const billing = (storeExtra?.billing as Record<string, string> | null) ?? {};

  return (
    <>
      <Phead
        title="Billing & invoices"
        sub="Design your invoice PDF, set your send-from email, and create custom bills — your own branding on every document."
      />
      <BillingPdfClient
        storeName={store.store_name ?? ""}
        currency={storeExtra?.currency ?? "INR"}
        logoUrl={storeExtra?.logo_url ?? ""}
        invoiceBusinessName={storeExtra?.invoice_business_name ?? ""}
        legalName={storeExtra?.legal_name ?? ""}
        gstin={storeExtra?.gstin ?? ""}
        gstRate={storeExtra?.gst_rate ?? null}
        invoiceAccentColor={storeExtra?.invoice_accent_color ?? ""}
        invoiceFooter={storeExtra?.invoice_footer ?? ""}
        address={billing.address ?? ""}
        city={billing.city ?? ""}
        state={billing.state ?? ""}
        postalCode={billing.postal_code ?? ""}
        sendFromEmail={storeExtra?.send_from_email ?? ""}
        replyToEmail={storeExtra?.reply_to_email ?? ""}
      />
    </>
  );
}
