import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAdminAuditReport, sendUserAuditReport } from "@/lib/transactional";
import { runRecoveryForAllStores } from "@/lib/recovery";
import { expireOverdueSubscriptions } from "@/lib/subscriptionExpiry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily platform cron. Hit by a systemd timer:
 *   curl "http://127.0.0.1:3000/api/cron?token=$CRON_SECRET"
 * Runs the two scheduler-dependent jobs that otherwise are manual-only:
 *   1. Abandoned-cart recovery emails (per opted-in store, de-duped 24h).
 *   2. Daily admin + user audit-log report emails.
 * Protected by a constant-time token check against CRON_SECRET; never exposed
 * publicly (no session, no data returned beyond counts).
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

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result: { recovery?: unknown; audit?: string; subscriptions?: unknown; errors: string[] } = { errors: [] };

  // 1. Abandoned-cart recovery
  try {
    result.recovery = await runRecoveryForAllStores();
  } catch (e) {
    result.errors.push("recovery: " + (e instanceof Error ? e.message : "failed"));
  }

  // 2. Daily audit reports (admin + user)
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

  // 3. Expire overdue subscriptions (mark active→past_due, notify owner).
  //    Additive + non-fatal: a failure here never aborts recovery/audit.
  try {
    result.subscriptions = await expireOverdueSubscriptions();
  } catch (e) {
    result.errors.push("subscriptions: " + (e instanceof Error ? e.message : "failed"));
  }

  return NextResponse.json({ ok: result.errors.length === 0, ...result });
}
