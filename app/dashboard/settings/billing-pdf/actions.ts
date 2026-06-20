"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertNotImpersonating } from "@/lib/impersonation";

export type Result = { ok: boolean; error?: string };

function isValidEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

/** #rgb or #rrggbb */
function isValidHex(val: string): boolean {
  return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(val);
}

/**
 * Save the seller's invoice/billing-PDF branding for THEIR store:
 *   - logo_url               (reused store column — the seller logo)
 *   - invoice_business_name  (printed as the Seller party on invoices)
 *   - legal_name             (reused)
 *   - gstin                  (reused)
 *   - gst_rate               (reused — default tax rate on invoices)
 *   - invoice_accent_color   (new column — accent on the PDF)
 *   - invoice_footer         (new column — footer note on the PDF)
 *   - billing.address/city/state/postal_code (merge-safe billing jsonb)
 *
 * RLS scopes the update to the seller's own store (owner_id = auth.uid()).
 */
export async function saveBillingPdfBranding(input: {
  logo_url?: string | null;
  invoice_business_name?: string | null;
  legal_name?: string | null;
  gstin?: string | null;
  gst_rate?: number | string | null;
  invoice_accent_color?: string | null;
  invoice_footer?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
}): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const rawGstin = (input.gstin ?? "").trim().toUpperCase();
  const gstin: string | null = rawGstin === "" ? null : rawGstin;
  if (gstin !== null && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) {
    return { ok: false, error: "GSTIN format is invalid. Must be 15 characters (e.g. 29ABCDE1234F1Z5)." };
  }

  const rawAccent = (input.invoice_accent_color ?? "").trim();
  const accent: string | null = rawAccent === "" ? null : rawAccent.toLowerCase();
  if (accent !== null && !isValidHex(accent)) {
    return { ok: false, error: "Accent colour must be a hex value like #ff6a3d." };
  }

  const footerRaw = (input.invoice_footer ?? "").trim();
  if (footerRaw.length > 200) {
    return { ok: false, error: "Invoice footer must be 200 characters or fewer." };
  }

  const bizName = (input.invoice_business_name ?? "").trim();
  if (bizName.length > 200) {
    return { ok: false, error: "Business name must be 200 characters or fewer." };
  }

  let gstRate: number | null = null;
  if (input.gst_rate !== undefined && input.gst_rate !== null && input.gst_rate !== "") {
    const n = Number(input.gst_rate);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return { ok: false, error: "GST rate must be a number between 0 and 100." };
    }
    gstRate = n;
  }

  // Merge billing jsonb so we never clobber other onboarding keys.
  const { data: storeRow } = await sb
    .from("stores")
    .select("billing")
    .eq("owner_id", user.id)
    .maybeSingle();
  const existingBilling: Record<string, unknown> =
    (storeRow?.billing as Record<string, unknown>) ?? {};
  const billingUpdate: Record<string, unknown> = { ...existingBilling };
  if (input.address !== undefined) billingUpdate.address = (input.address ?? "").trim() || null;
  if (input.city !== undefined) billingUpdate.city = (input.city ?? "").trim() || null;
  if (input.state !== undefined) billingUpdate.state = (input.state ?? "").trim() || null;
  if (input.postal_code !== undefined) billingUpdate.postal_code = (input.postal_code ?? "").trim() || null;
  if (bizName) billingUpdate.business_name = bizName;
  // Keep billing.tax_id mirrored to gstin (same as the main settings action).
  billingUpdate.tax_id = gstin;

  const payload: Record<string, unknown> = {
    logo_url: (input.logo_url ?? "").trim() || null,
    invoice_business_name: bizName || null,
    legal_name: (input.legal_name ?? "").trim() || null,
    gstin,
    gst_rate: gstRate,
    invoice_accent_color: accent,
    invoice_footer: footerRaw || null,
    billing: billingUpdate,
  };

  const { error } = await sb.from("stores").update(payload).eq("owner_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/billing-pdf");
  return { ok: true };
}

/**
 * Save the seller's custom send-from / reply-to email on their own store:
 *   - send_from_email : From: address for this seller's transactional mail
 *                       (honoured by resolveSellerFrom; deliverability still
 *                       depends on the seller's domain DKIM/SPF — see note).
 *   - reply_to_email  : Reply-To so buyer replies reach the seller.
 *
 * RLS scopes the update to the seller's own store.
 */
export async function saveSellerSendFrom(input: {
  send_from_email?: string | null;
  reply_to_email?: string | null;
}): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const rawSend = (input.send_from_email ?? "").trim();
  const sendFrom: string | null = rawSend === "" ? null : rawSend;
  if (sendFrom !== null && !isValidEmail(sendFrom)) {
    return { ok: false, error: "Send-from email address is not valid." };
  }

  const rawReply = (input.reply_to_email ?? "").trim();
  const replyTo: string | null = rawReply === "" ? null : rawReply;
  if (replyTo !== null && !isValidEmail(replyTo)) {
    return { ok: false, error: "Reply-to email address is not valid." };
  }

  const { error } = await sb
    .from("stores")
    .update({ send_from_email: sendFrom, reply_to_email: replyTo })
    .eq("owner_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/billing-pdf");
  return { ok: true };
}
