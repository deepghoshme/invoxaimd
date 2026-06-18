import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AuditPayload {
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  storeId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Append one row to audit_log via the service-role client.
 *
 * Contract:
 *   - Never throws; swallows all errors so the calling action is never broken.
 *   - Returns void — callers do not need to await a result.
 *   - If the audit_log table does not yet exist (migration pending), the error
 *     is logged to console.error and silently dropped.
 */
export async function logAudit(payload: AuditPayload): Promise<void> {
  try {
    const sb = createAdminClient();
    const { error } = await sb.from("audit_log").insert({
      actor_user_id: payload.actorUserId ?? null,
      actor_email:   payload.actorEmail   ?? null,
      actor_role:    payload.actorRole    ?? null,
      action:        payload.action,
      target_type:   payload.targetType   ?? null,
      target_id:     payload.targetId     ?? null,
      store_id:      payload.storeId      ?? null,
      metadata:      payload.metadata     ?? null,
    });

    if (error) {
      // Table missing (migration not yet applied) or schema mismatch — swallow.
      console.error("[audit] logAudit failed:", error.message);
    }
  } catch (err) {
    // Unexpected runtime error — never propagate.
    console.error("[audit] logAudit unexpected error:", err);
  }
}
