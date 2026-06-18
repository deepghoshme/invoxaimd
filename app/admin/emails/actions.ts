"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: boolean; error?: string };

/** Sanitise: strip leading/trailing whitespace. */
function t(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

// ─── Admin guard (belt + RLS suspenders) ─────────────────────────────────────

async function requireAdmin(): Promise<
  | { ok: true; userId: string }
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
  return { ok: true, userId: user.id };
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
