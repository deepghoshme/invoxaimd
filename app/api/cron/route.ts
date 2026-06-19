import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAdminAuditReport, sendUserAuditReport, sendDailyWalletReport } from "@/lib/transactional";
import { runRecoveryForAllStores } from "@/lib/recovery";
import { expireOverdueSubscriptions } from "@/lib/subscriptionExpiry";
import { runRechargeReminders } from "@/lib/walletReminder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily platform cron. Hit by a systemd timer:
 *   curl "http://127.0.0.1:3000/api/cron?token=$CRON_SECRET"
 *
 * Supports an optional ?job= query param:
 *   - 'recovery'       — abandoned-cart recovery emails only
 *   - 'audit'          — admin + user audit-log report emails only
 *   - 'subscriptions'  — expire overdue subscriptions only
 *   - 'wallet_report'  — daily wallet activity report only (hits 12:01 timer)
 *   - 'all'            — all jobs (default when param is absent or 'all')
 *
 * Each invocation inserts a row into cron_runs (service-role) recording the
 * job name, status (running -> success|error), started_at, finished_at, and
 * a result JSON with per-job counts. Logging failure is non-fatal.
 *
 * Protected by a constant-time token check against CRON_SECRET.
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  const provided =
    url.searchParams.get("token") ??
    (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

type CronJob = "recovery" | "audit" | "subscriptions" | "wallet_report" | "wallet_reminder" | "all";

const VALID_JOBS: CronJob[] = ["recovery", "audit", "subscriptions", "wallet_report", "wallet_reminder", "all"];

/** Insert a cron_runs row and return its id (non-fatal — returns null on failure). */
async function logCronStart(
  admin: ReturnType<typeof createAdminClient>,
  job: string,
  startedAt: string,
): Promise<string | null> {
  try {
    const { data } = await admin
      .from("cron_runs")
      .insert({ job, status: "running", started_at: startedAt })
      .select("id")
      .single();
    return (data as { id: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

/** Update the cron_runs row to success or error (non-fatal). */
async function logCronFinish(
  admin: ReturnType<typeof createAdminClient>,
  runId: string | null,
  status: "success" | "error",
  finishedAt: string,
  result: Record<string, unknown>,
  error?: string | null,
): Promise<void> {
  if (!runId) return;
  try {
    await admin
      .from("cron_runs")
      .update({
        status,
        finished_at: finishedAt,
        result,
        ...(error ? { error } : {}),
      })
      .eq("id", runId);
  } catch { /* non-fatal */ }
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const jobParam = (url.searchParams.get("job") ?? "all").toLowerCase() as CronJob;
  const job: CronJob = VALID_JOBS.includes(jobParam) ? jobParam : "all";

  const startedAt = new Date().toISOString();
  const admin = createAdminClient();

  // Start a cron_runs record for this invocation (non-fatal).
  const runId = await logCronStart(admin, job, startedAt);

  const result: {
    recovery?: unknown;
    audit?: string;
    subscriptions?: unknown;
    wallet_report?: unknown;
    wallet_reminder?: unknown;
    errors: string[];
  } = { errors: [] };

  // 1. Abandoned-cart recovery
  if (job === "all" || job === "recovery") {
    try {
      result.recovery = await runRecoveryForAllStores();
    } catch (e) {
      result.errors.push("recovery: " + (e instanceof Error ? e.message : "failed"));
    }
  }

  // 2. Daily audit reports (admin + user)
  if (job === "all" || job === "audit") {
    try {
      const sb = createAdminClient();
      const { data: rows } = await sb
        .from("audit_log")
        .select("actor_email, actor_role, action, target_type, target_id, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      await sendAdminAuditReport(rows ?? []);
      await sendUserAuditReport(rows ?? []);
      result.audit = "sent";
    } catch (e) {
      result.errors.push("audit: " + (e instanceof Error ? e.message : "failed"));
    }
  }

  // 3. Expire overdue subscriptions (mark active→past_due, notify owner).
  if (job === "all" || job === "subscriptions") {
    try {
      result.subscriptions = await expireOverdueSubscriptions();
    } catch (e) {
      result.errors.push("subscriptions: " + (e instanceof Error ? e.message : "failed"));
    }
  }

  // 4. Daily wallet activity report.
  //    Gated internally on email_config.daily_wallet_enabled.
  //    Runs ONLY via its dedicated ?job=wallet_report slot (12:01) — intentionally
  //    excluded from "all" so the nightly batch doesn't double-send it.
  if (job === "wallet_report") {
    try {
      result.wallet_report = await sendDailyWalletReport();
    } catch (e) {
      result.errors.push("wallet_report: " + (e instanceof Error ? e.message : "failed"));
    }
  }

  // 5. Wallet-low recharge reminders (friendly, throttled, active+high-revenue only).
  //    Runs ONLY via its dedicated ?job=wallet_reminder slot (every 30 min) —
  //    excluded from "all" so the nightly batch doesn't trigger it.
  if (job === "wallet_reminder") {
    try {
      result.wallet_reminder = await runRechargeReminders();
    } catch (e) {
      result.errors.push("wallet_reminder: " + (e instanceof Error ? e.message : "failed"));
    }
  }

  const finishedAt = new Date().toISOString();
  const hasErrors = result.errors.length > 0;

  // Update cron_runs row with final status (non-fatal).
  await logCronFinish(
    admin,
    runId,
    hasErrors ? "error" : "success",
    finishedAt,
    result as Record<string, unknown>,
    hasErrors ? result.errors.join("; ") : null,
  );

  return NextResponse.json({ ok: !hasErrors, job, ...result });
}
