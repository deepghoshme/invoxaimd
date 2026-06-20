"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformMailer } from "@/lib/email";
import { EMAIL_ALIASES } from "@/lib/emailRoutes";
import { sendAdminAuditReport, sendUserAuditReport } from "@/lib/transactional";
import { logAudit } from "@/lib/audit";

type Result = { ok: boolean; error?: string };

const ALLOWED_ALIASES = new Set(EMAIL_ALIASES.map((a) => a.address));

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Send a TEST email to verify deliverability and (optionally) that the sending
 * account can send AS a given domain alias. Admin-only. Uses the configured
 * platform mailer; returns a clear error if email isn't set up.
 */
export async function sendTestEmail(input: { from?: string; to: string }): Promise<Result> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const to = t(input.to);
  const from = t(input.from);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return { ok: false, error: "Enter a valid recipient email." };
  }
  // Only allow sending AS one of our known aliases — blocks arbitrary/forged
  // senders and any HTML injection via the from value.
  if (from && !ALLOWED_ALIASES.has(from)) {
    return { ok: false, error: "Invalid sender alias." };
  }
  const safeFrom = escapeHtml(from);

  const mailer = await getPlatformMailer();
  if (!mailer.ok) return { ok: false, error: mailer.error };

  try {
    await mailer.mailer.send({
      from: from || undefined,
      to,
      subject: `invoxai test email${safeFrom ? ` (from ${safeFrom})` : ""}`,
      html: `<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6">
        <h2 style="margin:0 0 8px">✅ Test email delivered</h2>
        <p>Platform email delivery is working${safeFrom ? ` and the sender alias <b>${safeFrom}</b> was used` : ""}.</p>
        <p style="color:#888;font-size:12px;margin-top:14px">Sent from Admin → Emails · test panel.</p>
      </div>`,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed." };
  }
}

/** Sanitise: strip leading/trailing whitespace. */
function t(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

// ─── Admin guard (belt + RLS suspenders) ─────────────────────────────────────

async function requireAdmin(): Promise<
  | { ok: true; userId: string; email: string | undefined }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) return { ok: false, error: "Admin access required." };
  return { ok: true, userId: user.id, email: user.email };
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Return the email config WITHOUT the secret password fields.
 * Instead of the raw passwords, returns `has_smtp_pass` and `has_gmail_pass`.
 * Returns null with a `migrationPending` flag when the table doesn't exist yet.
 */
export async function getEmailConfig(): Promise<{
  method: "gmail" | "smtp";
  from_name: string;
  gmail_user: string | null;
  has_gmail_pass: boolean;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  has_smtp_pass: boolean;
  otp_enabled: boolean;
  welcome_enabled: boolean;
  daily_wallet_enabled: boolean;
  weekly_report_enabled: boolean;
  migrationPending?: boolean;
} | null> {
  // Every exported "use server" function is an independently reachable
  // endpoint — it MUST enforce its own authorization. This reads via the
  // service-role client (bypasses RLS) and would otherwise leak email/SMTP
  // config to any authenticated non-admin who invokes the action directly.
  const guard = await requireAdmin();
  if (!guard.ok) return null;

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("email_config")
    .select(
      "method, from_name, gmail_user, gmail_app_password, smtp_host, smtp_port, smtp_user, smtp_pass, otp_enabled, welcome_enabled, daily_wallet_enabled, weekly_report_enabled"
    )
    .eq("id", true)
    .maybeSingle();

  if (error) {
    // Only treat a genuinely missing table as "migration pending"; surface all other errors.
    const genuinelyMissing =
      error.code === "42P01" ||
      (error.message?.toLowerCase().includes("does not exist") &&
        error.message?.toLowerCase().includes("relation"));
    if (genuinelyMissing) {
      return { method: "smtp", from_name: "invoxai", gmail_user: null, has_gmail_pass: false, smtp_host: null, smtp_port: null, smtp_user: null, has_smtp_pass: false, otp_enabled: true, welcome_enabled: true, daily_wallet_enabled: false, weekly_report_enabled: false, migrationPending: true };
    }
    console.error("[admin/emails] getEmailConfig error:", error.message, error.code);
    throw new Error(error.message);
  }
  if (!data) {
    return { method: "smtp", from_name: "invoxai", gmail_user: null, has_gmail_pass: false, smtp_host: null, smtp_port: null, smtp_user: null, has_smtp_pass: false, otp_enabled: true, welcome_enabled: true, daily_wallet_enabled: false, weekly_report_enabled: false };
  }
  const d = data as {
    method: string;
    from_name: string;
    gmail_user: string | null;
    gmail_app_password: string | null;
    smtp_host: string | null;
    smtp_port: number | null;
    smtp_user: string | null;
    smtp_pass: string | null;
    otp_enabled: boolean;
    welcome_enabled: boolean;
    daily_wallet_enabled: boolean;
    weekly_report_enabled: boolean;
  };
  return {
    method: (d.method === "gmail" ? "gmail" : "smtp") as "gmail" | "smtp",
    from_name: d.from_name ?? "invoxai",
    gmail_user: d.gmail_user,
    has_gmail_pass: !!d.gmail_app_password,
    smtp_host: d.smtp_host,
    smtp_port: d.smtp_port,
    smtp_user: d.smtp_user,
    has_smtp_pass: !!d.smtp_pass,
    otp_enabled: d.otp_enabled ?? true,
    welcome_enabled: d.welcome_enabled ?? true,
    daily_wallet_enabled: d.daily_wallet_enabled ?? false,
    weekly_report_enabled: d.weekly_report_enabled ?? false,
  };
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function saveEmailConfig(input: {
  method: "gmail" | "smtp";
  from_name: string;
  gmail_user?: string;
  gmail_app_password?: string; // blank = keep existing
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;          // blank = keep existing
  otp_enabled: boolean;
  welcome_enabled: boolean;
  daily_wallet_enabled: boolean;
  weekly_report_enabled: boolean;
}): Promise<Result> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const method = input.method === "gmail" ? "gmail" : "smtp";
  const from_name = t(input.from_name) || "invoxai";

  const row: Record<string, unknown> = {
    id: true,
    method,
    from_name,
    otp_enabled: !!input.otp_enabled,
    welcome_enabled: !!input.welcome_enabled,
    daily_wallet_enabled: !!input.daily_wallet_enabled,
    weekly_report_enabled: !!input.weekly_report_enabled,
  };

  if (method === "gmail") {
    row.gmail_user = t(input.gmail_user) || null;
    // Only overwrite the secret when a new value is explicitly supplied.
    const newPass = t(input.gmail_app_password);
    if (newPass) row.gmail_app_password = newPass;
  } else {
    row.smtp_host = t(input.smtp_host) || null;
    row.smtp_port = input.smtp_port ? Number(input.smtp_port) : null;
    row.smtp_user = t(input.smtp_user) || null;
    const newPass = t(input.smtp_pass);
    if (newPass) row.smtp_pass = newPass;
  }

  // Use admin client — RLS is still enforced via the guard above.
  const sb = createAdminClient();
  const { error } = await sb
    .from("email_config")
    .upsert(row, { onConflict: "id" });

  if (error) {
    // Friendly message when migration hasn't been applied yet.
    if (error.message.includes("does not exist")) {
      return { ok: false, error: "Apply migration 20260618280000_admin_comms.sql first." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/emails");
  return { ok: true };
}

/** Toggle a single email automation flag. */
export async function toggleEmailFlag(
  flag: "otp_enabled" | "welcome_enabled" | "daily_wallet_enabled" | "weekly_report_enabled",
  value: boolean
): Promise<Result> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const allowed = ["otp_enabled", "welcome_enabled", "daily_wallet_enabled", "weekly_report_enabled"];
  if (!allowed.includes(flag)) return { ok: false, error: "Unknown flag." };

  const sb = createAdminClient();
  const { error } = await sb
    .from("email_config")
    .upsert({ id: true, [flag]: value }, { onConflict: "id" });

  if (error) {
    if (error.message.includes("does not exist")) {
      return { ok: false, error: "Apply migration 20260618280000_admin_comms.sql first." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/emails");
  return { ok: true };
}

// ─── Audit report "Send now" actions ─────────────────────────────────────────
// NOTE: There is no cron scheduler in this repo. These actions power the manual
// "Send now" buttons in the admin UI. Automated daily delivery is a follow-up task.

/**
 * Send the admin audit report now — fetches the last 100 audit_log rows
 * (all roles) ordered by created_at desc, then emails via sendAdminAuditReport.
 * Admin-only.
 */
export async function sendAdminAuditReportNow(): Promise<Result> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const sb = createAdminClient();
  const { data: rows, error } = await sb
    .from("audit_log")
    .select("actor_email, actor_role, action, target_type, target_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return { ok: false, error: "audit_log table not found. Apply the relevant migration first." };
    }
    return { ok: false, error: error.message };
  }

  try {
    await sendAdminAuditReport(rows ?? []);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed." };
  }
}

/**
 * Send the user audit report now — fetches the last 100 audit_log rows where
 * actor_role is not 'admin', ordered by created_at desc.
 * Admin-only.
 */
export async function sendUserAuditReportNow(): Promise<Result> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const sb = createAdminClient();
  const { data: rows, error } = await sb
    .from("audit_log")
    .select("actor_email, actor_role, action, target_type, target_id, created_at")
    .neq("actor_role", "admin")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return { ok: false, error: "audit_log table not found. Apply the relevant migration first." };
    }
    return { ok: false, error: error.message };
  }

  try {
    await sendUserAuditReport(rows ?? []);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed." };
  }
}

// ─── Seller send-from email ───────────────────────────────────────────────────

export type SellerSendFromRow = {
  storeId: string;
  storeName: string | null;
  subdomain: string | null;
  ownerEmail: string | null;
  sendFromEmail: string | null;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * List all stores with owner email and current send_from_email for the admin UI.
 * Admin-only: uses service-role client (bypasses RLS).
 */
export async function listSellerSendFrom(): Promise<SellerSendFromRow[]> {
  const guard = await requireAdmin();
  if (!guard.ok) return [];

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("stores")
    .select("id, store_name, subdomain, send_from_email, owner_id")
    .order("store_name", { ascending: true });

  if (error) {
    console.error("[admin/emails] listSellerSendFrom:", error.message);
    return [];
  }

  if (!data || data.length === 0) return [];

  // Fetch owner emails from auth.users via admin API (batch).
  const ownerIds = (data as { owner_id: string }[]).map((r) => r.owner_id);
  const emailMap: Record<string, string> = {};

  // Supabase admin client supports listing users; we fetch the auth.users table
  // directly using the admin client's rpc or via the users endpoint. We use the
  // PostgREST view that Supabase exposes for admin queries — fall back gracefully.
  try {
    for (const id of ownerIds) {
      const { data: { user } } = await sb.auth.admin.getUserById(id);
      if (user?.email) emailMap[id] = user.email;
    }
  } catch {
    // Non-fatal — owner emails just show as null
  }

  return (data as {
    id: string;
    store_name: string | null;
    subdomain: string | null;
    send_from_email: string | null;
    owner_id: string;
  }[]).map((r) => ({
    storeId: r.id,
    storeName: r.store_name,
    subdomain: r.subdomain,
    ownerEmail: emailMap[r.owner_id] ?? null,
    sendFromEmail: r.send_from_email,
  }));
}

/**
 * Set or clear a seller's custom send-from email address.
 *
 * Storing this address does NOT guarantee deliverability as that address.
 * The seller must configure DKIM/SPF for their domain and the platform must
 * be able to authenticate as that address (SMTP credentials, etc.).
 * Until that is done, mail send code falls back to the platform default alias.
 * The UI must make this limitation clear — see SellerSendFromPanel.tsx.
 */
export async function setSellerSendFrom(
  storeId: string,
  sendFromEmail: string | null
): Promise<Result> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const email = sendFromEmail ? t(sendFromEmail) || null : null;

  // Validate format when setting (not clearing).
  if (email !== null && !EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const sb = createAdminClient();

  // Verify the store exists before updating.
  const { data: storeRow, error: fetchErr } = await sb
    .from("stores")
    .select("id, store_name, subdomain, send_from_email")
    .eq("id", storeId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!storeRow) return { ok: false, error: "Store not found." };

  const prev = (storeRow as { send_from_email: string | null }).send_from_email;

  const { error: updateErr } = await sb
    .from("stores")
    .update({ send_from_email: email })
    .eq("id", storeId);

  if (updateErr) {
    if (updateErr.message.includes("does not exist")) {
      return { ok: false, error: "Apply migration 20260619240000_stores_send_from_email.sql first." };
    }
    return { ok: false, error: updateErr.message };
  }

  await logAudit({
    actorUserId: guard.userId,
    actorEmail:  guard.email,
    actorRole:   "admin",
    action:      email ? "admin_set_seller_send_from" : "admin_clear_seller_send_from",
    targetType:  "store",
    targetId:    storeId,
    storeId,
    metadata:    {
      previous_send_from: prev,
      new_send_from: email,
      store_name: (storeRow as { store_name: string | null }).store_name,
    },
  });

  revalidatePath("/admin/emails");
  return { ok: true };
}
