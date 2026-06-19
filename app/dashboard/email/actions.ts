"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertNotImpersonating } from "@/lib/impersonation";
import { getPlatformMailer, sendBulk } from "@/lib/email";

export type CampaignResult = {
  ok: boolean;
  error?: string;
  id?: string;
};

// ── helpers ──────────────────────────────────────────────────────────────────

function trim(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

/** Resolve the caller's store_id from session (RLS-scoped). */
async function resolveStoreId(): Promise<{ storeId: string } | { error: string }> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: store } = await sb
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!store) return { error: "No store found." };
  return { storeId: store.id };
}

// ── audience count (public — used by page and client component) ───────────────

export type AudienceCounts = {
  buyers: number;
  subscribers: number;
  all: number;
};

export async function getAudienceCounts(): Promise<AudienceCounts> {
  const storeResult = await resolveStoreId();
  if ("error" in storeResult) return { buyers: 0, subscribers: 0, all: 0 };

  const sb = createAdminClient(); // need cross-RLS read on site_messages + orders
  const { storeId } = storeResult;

  const [{ data: orderRows }, { data: msgRows }] = await Promise.all([
    sb
      .from("orders")
      .select("buyer_email")
      .eq("store_id", storeId)
      .eq("status", "paid"),
    sb
      .from("site_messages")
      .select("email, kind")
      .eq("store_id", storeId)
      .not("email", "is", null),
  ]);

  const buyerEmails = new Set<string>();
  for (const o of orderRows ?? []) {
    if (o.buyer_email) buyerEmails.add(o.buyer_email.toLowerCase());
  }

  const subscriberEmails = new Set<string>();
  for (const m of msgRows ?? []) {
    if (m.kind === "newsletter" && m.email) {
      subscriberEmails.add((m.email as string).toLowerCase());
    }
  }

  const allEmails = new Set([...buyerEmails, ...subscriberEmails]);

  return {
    buyers: buyerEmails.size,
    subscribers: subscriberEmails.size,
    all: allEmails.size,
  };
}

/** Resolve the actual recipient email addresses for an audience (store-scoped). */
async function getAudienceEmails(
  storeId: string,
  audience: "all_buyers" | "subscribers" | "all",
): Promise<string[]> {
  const sb = createAdminClient();
  const [{ data: orderRows }, { data: msgRows }] = await Promise.all([
    sb.from("orders").select("buyer_email").eq("store_id", storeId).eq("status", "paid"),
    sb.from("site_messages").select("email, kind").eq("store_id", storeId).not("email", "is", null),
  ]);

  const buyers = new Set<string>();
  for (const o of orderRows ?? []) {
    if (o.buyer_email) buyers.add((o.buyer_email as string).toLowerCase());
  }
  const subs = new Set<string>();
  for (const m of msgRows ?? []) {
    if (m.kind === "newsletter" && m.email) subs.add((m.email as string).toLowerCase());
  }

  const set =
    audience === "all_buyers" ? buyers
    : audience === "subscribers" ? subs
    : new Set([...buyers, ...subs]);
  return [...set];
}

// ── save draft ───────────────────────────────────────────────────────────────

export async function saveDraft(input: {
  id?: string;
  subject: string;
  body_html: string;
  audience: "all_buyers" | "subscribers" | "all";
}): Promise<CampaignResult> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return { ok: false, error: guard.error };

  const storeResult = await resolveStoreId();
  if ("error" in storeResult) return { ok: false, error: storeResult.error };
  const { storeId } = storeResult;

  const subject = trim(input.subject);
  const body_html = trim(input.body_html);
  const validAudiences = ["all_buyers", "subscribers", "all"] as const;
  const audience = validAudiences.includes(input.audience as (typeof validAudiences)[number])
    ? input.audience
    : "all";

  if (!subject) return { ok: false, error: "Subject is required." };
  if (subject.length > 250) return { ok: false, error: "Subject too long (max 250 chars)." };
  if (!body_html) return { ok: false, error: "Email body is required." };

  const sb = await createClient();

  if (input.id) {
    // Update existing draft — ensure it's a draft and owned by this store
    const { data: existing } = await sb
      .from("email_campaigns")
      .select("id, status")
      .eq("id", input.id)
      .eq("store_id", storeId)
      .maybeSingle();

    if (!existing) return { ok: false, error: "Campaign not found." };
    if (existing.status === "sent")
      return { ok: false, error: "Cannot edit a campaign that has already been sent." };

    const { error } = await sb
      .from("email_campaigns")
      .update({ subject, body_html, audience, status: "draft" })
      .eq("id", input.id)
      .eq("store_id", storeId);

    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/email");
    return { ok: true, id: input.id };
  }

  // Insert new draft
  const { data, error } = await sb
    .from("email_campaigns")
    .insert({ store_id: storeId, subject, body_html, audience, status: "draft" })
    .select("id")
    .single();

  if (error) {
    // Graceful: table not yet migrated
    if (
      error.code === "42P01" ||
      (error.message?.toLowerCase().includes("does not exist") &&
        error.message?.toLowerCase().includes("relation"))
    ) {
      return {
        ok: false,
        error: "Migration pending — apply 20260618350000_email_campaigns.sql first.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/email");
  return { ok: true, id: data.id };
}

// ── send (or mark sent) ───────────────────────────────────────────────────────
//
// Real email delivery requires the platform's email_config to be set up by the
// admin. Until that's wired, this action marks the campaign as sent and records
// the recipient count. The UI is honest about this.

export async function sendCampaign(input: {
  id?: string;
  subject: string;
  body_html: string;
  audience: "all_buyers" | "subscribers" | "all";
}): Promise<CampaignResult> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return { ok: false, error: guard.error };

  const storeResult = await resolveStoreId();
  if ("error" in storeResult) return { ok: false, error: storeResult.error };
  const { storeId } = storeResult;

  const subject = trim(input.subject);
  const body_html = trim(input.body_html);
  const validAudiences = ["all_buyers", "subscribers", "all"] as const;
  const audience = validAudiences.includes(input.audience as (typeof validAudiences)[number])
    ? input.audience
    : "all";

  if (!subject) return { ok: false, error: "Subject is required." };
  if (subject.length > 250) return { ok: false, error: "Subject too long (max 250 chars)." };
  if (!body_html) return { ok: false, error: "Email body is required." };

  const sb = await createClient();

  let campaignId = input.id;

  // If updating an existing campaign, verify ownership + not-already-sent BEFORE
  // sending, so we never double-send or email on someone else's behalf.
  if (campaignId) {
    const { data: existing } = await sb
      .from("email_campaigns")
      .select("id, status")
      .eq("id", campaignId)
      .eq("store_id", storeId)
      .maybeSingle();

    if (!existing) return { ok: false, error: "Campaign not found." };
    if (existing.status === "sent")
      return { ok: false, error: "This campaign has already been sent." };
  }

  // Resolve the real recipients and actually deliver via the platform mailer.
  // The campaign is only marked "sent" once delivery has been attempted.
  const recipients = await getAudienceEmails(storeId, audience);
  if (recipients.length === 0) {
    return { ok: false, error: "No recipients in this audience yet." };
  }
  const mailerResult = await getPlatformMailer();
  if (!mailerResult.ok) return { ok: false, error: mailerResult.error };
  const recipientCount = await sendBulk(mailerResult.mailer, recipients, subject, body_html);
  if (recipientCount === 0) {
    return { ok: false, error: "Couldn’t deliver to any recipient — check the platform email settings." };
  }

  if (campaignId) {
    const { error } = await sb
      .from("email_campaigns")
      .update({
        subject,
        body_html,
        audience,
        status: "sent",
        recipient_count: recipientCount,
        sent_at: new Date().toISOString(),
      })
      .eq("id", campaignId)
      .eq("store_id", storeId);

    if (error) return { ok: false, error: error.message };
  } else {
    // Insert + mark sent
    const { data, error } = await sb
      .from("email_campaigns")
      .insert({
        store_id: storeId,
        subject,
        body_html,
        audience,
        status: "sent",
        recipient_count: recipientCount,
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      if (
        error.code === "42P01" ||
        (error.message?.toLowerCase().includes("does not exist") &&
          error.message?.toLowerCase().includes("relation"))
      ) {
        return {
          ok: false,
          error: "Migration pending — apply 20260618350000_email_campaigns.sql first.",
        };
      }
      return { ok: false, error: error.message };
    }
    campaignId = data.id;
  }

  revalidatePath("/dashboard/email");
  return { ok: true, id: campaignId };
}

// ── delete draft ─────────────────────────────────────────────────────────────

export async function deleteCampaign(id: string): Promise<CampaignResult> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return { ok: false, error: guard.error };

  const storeResult = await resolveStoreId();
  if ("error" in storeResult) return { ok: false, error: storeResult.error };
  const { storeId } = storeResult;

  if (!id) return { ok: false, error: "Campaign ID required." };

  const sb = await createClient();

  // Only allow deleting drafts (not sent campaigns — they're a record)
  const { data: existing } = await sb
    .from("email_campaigns")
    .select("id, status")
    .eq("id", id)
    .eq("store_id", storeId)
    .maybeSingle();

  if (!existing) return { ok: false, error: "Campaign not found." };
  if (existing.status === "sent")
    return { ok: false, error: "Sent campaigns cannot be deleted — they serve as delivery records." };

  const { error } = await sb
    .from("email_campaigns")
    .delete()
    .eq("id", id)
    .eq("store_id", storeId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/email");
  return { ok: true };
}
