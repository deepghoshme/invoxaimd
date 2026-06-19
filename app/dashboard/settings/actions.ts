"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertNotImpersonating } from "@/lib/impersonation";

export type Result = { ok: boolean; error?: string };

/** Basic email format check. */
function isValidEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

/** GSTIN: 15-char format ^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$ */
function isValidGstin(val: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(val);
}

const ALLOWED_CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const;

// ── Store Settings ─────────────────────────────────────────────────────────────

export async function saveStoreSettings(input: {
  store_name: string;
  category_id: string | null;
  logo_url?: string | null;
  reply_to_email?: string | null;
  support_email?: string | null;
  currency?: string | null;
  timezone?: string | null;
  legal_name?: string | null;
  gstin?: string | null;
  gst_rate?: number | null;
  billing_patch?: {
    business_name?: string;
    address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    phone?: string;
  };
  social_links?: {
    instagram?: string;
    twitter?: string;
    youtube?: string;
    website?: string;
  } | null;
}): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const name = input.store_name.trim();
  if (!name) return { ok: false, error: "Store name is required." };

  const rawReplyTo = (input.reply_to_email ?? "").trim();
  const replyToEmail: string | null = rawReplyTo === "" ? null : rawReplyTo;
  if (replyToEmail !== null && !isValidEmail(replyToEmail)) {
    return { ok: false, error: "Reply-to email address is not valid." };
  }

  const rawSupportEmail = (input.support_email ?? "").trim();
  const supportEmail: string | null = rawSupportEmail === "" ? null : rawSupportEmail;
  if (supportEmail !== null && !isValidEmail(supportEmail)) {
    return { ok: false, error: "Support email address is not valid." };
  }

  const currency = (input.currency ?? "INR").toUpperCase();
  if (!ALLOWED_CURRENCIES.includes(currency as (typeof ALLOWED_CURRENCIES)[number])) {
    return { ok: false, error: "Invalid currency. Allowed: INR, USD, EUR, GBP." };
  }

  const rawGstin = (input.gstin ?? "").trim().toUpperCase();
  const gstin: string | null = rawGstin === "" ? null : rawGstin;
  if (gstin !== null && !isValidGstin(gstin)) {
    return {
      ok: false,
      error: "GSTIN format is invalid. Must be 15 characters (e.g. 29ABCDE1234F1Z5).",
    };
  }

  const gstRate = input.gst_rate != null ? Number(input.gst_rate) : null;
  if (gstRate !== null && (isNaN(gstRate) || gstRate < 0 || gstRate > 100)) {
    return { ok: false, error: "GST rate must be a number between 0 and 100." };
  }

  // Build billing jsonb by merging patch onto existing — never clobber other keys
  // (full_name, country, tax_id etc. written by billing / onboarding flows).
  let billingUpdate: Record<string, unknown> | undefined;
  if (input.billing_patch || gstin !== undefined) {
    const admin = createAdminClient();
    const { data: storeRow } = await admin
      .from("stores")
      .select("billing")
      .eq("owner_id", user.id)
      .maybeSingle();

    const existingBilling: Record<string, unknown> =
      (storeRow?.billing as Record<string, unknown>) ?? {};

    billingUpdate = { ...existingBilling };

    if (input.billing_patch) {
      const p = input.billing_patch;
      if (p.business_name !== undefined) billingUpdate.business_name = p.business_name;
      if (p.address !== undefined) billingUpdate.address = p.address;
      if (p.city !== undefined) billingUpdate.city = p.city;
      if (p.state !== undefined) billingUpdate.state = p.state;
      if (p.postal_code !== undefined) billingUpdate.postal_code = p.postal_code;
      if (p.phone !== undefined) billingUpdate.phone = p.phone;
    }

    // Keep billing.tax_id in sync with gstin field
    billingUpdate.tax_id = gstin;
  }

  const storePayload: Record<string, unknown> = {
    store_name: name,
    category_id: input.category_id || null,
    reply_to_email: replyToEmail,
    support_email: supportEmail,
    currency,
    timezone: (input.timezone ?? "").trim() || null,
    logo_url: (input.logo_url ?? "").trim() || null,
    legal_name: (input.legal_name ?? "").trim() || null,
    gstin,
    gst_rate: gstRate,
    social_links: input.social_links ?? null,
  };

  if (billingUpdate !== undefined) {
    storePayload.billing = billingUpdate;
  }

  const { error } = await sb
    .from("stores")
    .update(storePayload)
    .eq("owner_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ── Profile Settings ───────────────────────────────────────────────────────────

export async function saveProfileSettings(input: {
  full_name: string;
  avatar_url: string;
  mobile_number?: string;
}): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await sb
    .from("profiles")
    .update({
      full_name: input.full_name.trim() || null,
      avatar_url: input.avatar_url.trim() || null,
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  // Persist mobile number to billing.phone (merge-safe — never clobbers other billing keys).
  const rawMobile = (input.mobile_number ?? "").trim();
  if (rawMobile !== undefined) {
    const admin = createAdminClient();
    const { data: storeRow } = await admin
      .from("stores")
      .select("billing")
      .eq("owner_id", user.id)
      .maybeSingle();

    const existingBilling: Record<string, unknown> =
      (storeRow?.billing as Record<string, unknown>) ?? {};

    const billingUpdate = { ...existingBilling, phone: rawMobile || null };

    await admin
      .from("stores")
      .update({ billing: billingUpdate })
      .eq("owner_id", user.id);
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}
