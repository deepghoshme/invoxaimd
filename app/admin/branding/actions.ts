"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: boolean; error?: string };

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase: null, error: "Not authenticated." };
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) return { supabase: null, error: "Admin access required." };
  return { supabase, error: null };
}

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/**
 * Save branding settings: platform_name, logo_url, favicon_url, invoice_footer,
 * plus GST/tax identity: gstin, legal_name, registered_address, default_tax_rate,
 * plus contact info: support_email, pan, contact_phone.
 * show_brand_badge reuses the existing setBrandBadge action from app/admin/actions.ts
 * via client-side BrandBadgeToggle — we intentionally keep that wiring separate.
 *
 * Columns platform_name, logo_url, favicon_url, invoice_footer are added by migration
 * 20260618260000. GST columns (gstin, legal_name, registered_address, default_tax_rate)
 * are added by the platform_settings GST migration. pan and contact_phone are added by
 * a subsequent migration. Until applied, writes to those columns will fail gracefully here.
 */
export async function saveBrandingSettings(fd: FormData): Promise<Result> {
  const { supabase, error: authErr } = await assertAdmin();
  if (!supabase) return { ok: false, error: authErr! };

  const platformName = (fd.get("platform_name") as string | null)?.trim() ?? "";
  const logoUrl = (fd.get("logo_url") as string | null)?.trim() ?? "";
  const faviconUrl = (fd.get("favicon_url") as string | null)?.trim() ?? "";
  const invoiceFooter = (fd.get("invoice_footer") as string | null)?.trim() ?? "";
  const showBrandBadge = fd.get("show_brand_badge") === "true";

  // Contact details
  const supportEmail = (fd.get("support_email") as string | null)?.trim() ?? "";
  const contactPhone = (fd.get("contact_phone") as string | null)?.trim() ?? "";

  // GST / tax identity fields
  const gstin = (fd.get("gstin") as string | null)?.trim().toUpperCase() ?? "";
  const legalName = (fd.get("legal_name") as string | null)?.trim() ?? "";
  const registeredAddress = (fd.get("registered_address") as string | null)?.trim() ?? "";
  const defaultTaxRateRaw = (fd.get("default_tax_rate") as string | null)?.trim() ?? "0";
  const defaultTaxRate = parseFloat(defaultTaxRateRaw);
  const pan = (fd.get("pan") as string | null)?.trim().toUpperCase() ?? "";

  // --- Validation ---
  if (platformName && platformName.length > 80) {
    return { ok: false, error: "Platform name must be 80 characters or fewer." };
  }
  if (invoiceFooter && invoiceFooter.length > 200) {
    return { ok: false, error: "Invoice footer must be 200 characters or fewer." };
  }
  if (gstin && !GSTIN_RE.test(gstin)) {
    return {
      ok: false,
      error:
        "GSTIN format invalid. Expected 15-character format: 2-digit state code + PAN + entity code + Z + checksum (e.g. 22AAAAA0000A1Z5).",
    };
  }
  if (pan && !PAN_RE.test(pan)) {
    return {
      ok: false,
      error: "PAN format invalid. Expected 10-character format: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F).",
    };
  }
  if (supportEmail && supportEmail.length > 254) {
    return { ok: false, error: "Contact email must be 254 characters or fewer." };
  }
  if (legalName && legalName.length > 200) {
    return { ok: false, error: "Legal name must be 200 characters or fewer." };
  }
  if (registeredAddress && registeredAddress.length > 500) {
    return { ok: false, error: "Registered address must be 500 characters or fewer." };
  }
  if (isNaN(defaultTaxRate) || defaultTaxRate < 0 || defaultTaxRate > 100) {
    return { ok: false, error: "Default tax rate must be a number between 0 and 100." };
  }

  // show_brand_badge always exists — safe to update unconditionally.
  const basePayload: Record<string, unknown> = { show_brand_badge: showBrandBadge };

  // Try full payload first (requires migrations).
  const fullPayload: Record<string, unknown> = {
    ...basePayload,
    ...(platformName ? { platform_name: platformName } : {}),
    ...(logoUrl ? { logo_url: logoUrl } : {}),
    ...(faviconUrl ? { favicon_url: faviconUrl } : {}),
    ...(invoiceFooter ? { invoice_footer: invoiceFooter } : {}),
    // GST fields — always include so clearing them (empty string → null) works.
    gstin: gstin || null,
    legal_name: legalName || null,
    registered_address: registeredAddress || null,
    default_tax_rate: defaultTaxRate,
    // Contact / identity fields — always include so clearing works.
    support_email: supportEmail || null,
    pan: pan || null,
    contact_phone: contactPhone || null,
  };

  const { error } = await supabase
    .from("platform_settings")
    .update(fullPayload)
    .eq("id", true);

  if (error) {
    if (error.message.includes("column") && error.message.includes("does not exist")) {
      // Fall back: save only show_brand_badge (always exists).
      const { error: e2 } = await supabase
        .from("platform_settings")
        .update(basePayload)
        .eq("id", true);
      if (e2) return { ok: false, error: e2.message };
      revalidatePath("/admin/branding");
      return {
        ok: true,
        error:
          "Badge toggle saved. Other fields will persist after the required migrations are applied.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/branding");
  return { ok: true };
}
