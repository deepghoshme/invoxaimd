"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildImpCookieValue,
  IMP_COOKIE,
  IMP_MAX_AGE_SECONDS,
} from "@/lib/impersonation";
import { logAudit } from "@/lib/audit";

// ── Admin guard ───────────────────────────────────────────────────────────────
// Shared with app/admin/sellers/actions.ts but defined here too to keep the
// file self-contained and avoid coupling action files to each other.

async function assertAdmin(): Promise<
  | { ok: true; userId: string; email: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) return { ok: false, error: "Admin access required." };

  return { ok: true, userId: user.id, email: user.email ?? "" };
}

// ── Suspend ───────────────────────────────────────────────────────────────────

export async function suspendStoreAction(
  storeId: string,
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  const guard = await assertAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!storeId?.trim()) return { ok: false, error: "storeId is required." };

  const sb = createAdminClient();
  const { error } = await sb
    .from("stores")
    .update({
      suspended: true,
      suspended_at: new Date().toISOString(),
      suspended_reason: reason?.trim() || null,
    })
    .eq("id", storeId);

  if (error) {
    if (
      error.message.includes("column") &&
      error.message.includes("does not exist")
    ) {
      return {
        ok: false,
        error:
          "Suspension columns not yet available. Apply migration 20260618300000_store_suspension.sql first.",
      };
    }
    return { ok: false, error: error.message };
  }

  console.info(
    `[admin-action] suspendStore storeId=${storeId} by adminUserId=${guard.userId} reason=${reason ?? "none"}`,
  );

  await logAudit({
    actorUserId: guard.userId,
    actorEmail:  guard.email,
    actorRole:   "admin",
    action:      "store.suspend",
    targetType:  "store",
    targetId:    storeId,
    storeId:     storeId,
    metadata:    { reason: reason?.trim() || null },
  });

  revalidatePath(`/admin/sellers/${storeId}`);
  revalidatePath("/admin/sellers");
  return { ok: true };
}

// ── Unsuspend ─────────────────────────────────────────────────────────────────

export async function unsuspendStoreAction(
  storeId: string,
): Promise<{ ok: boolean; error?: string }> {
  const guard = await assertAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!storeId?.trim()) return { ok: false, error: "storeId is required." };

  const sb = createAdminClient();
  const { error } = await sb
    .from("stores")
    .update({
      suspended: false,
      suspended_at: null,
      suspended_reason: null,
    })
    .eq("id", storeId);

  if (error) {
    if (
      error.message.includes("column") &&
      error.message.includes("does not exist")
    ) {
      return {
        ok: false,
        error:
          "Suspension columns not yet available. Apply migration 20260618300000_store_suspension.sql first.",
      };
    }
    return { ok: false, error: error.message };
  }

  console.info(
    `[admin-action] unsuspendStore storeId=${storeId} by adminUserId=${guard.userId}`,
  );

  await logAudit({
    actorUserId: guard.userId,
    actorEmail:  guard.email,
    actorRole:   "admin",
    action:      "store.unsuspend",
    targetType:  "store",
    targetId:    storeId,
    storeId:     storeId,
    metadata:    null,
  });

  revalidatePath(`/admin/sellers/${storeId}`);
  revalidatePath("/admin/sellers");
  return { ok: true };
}

// ── Commission override ───────────────────────────────────────────────────────

/**
 * Admin-only: Set or clear a per-store commission override.
 * @param storeId   The store to update.
 * @param ratePercent  Rate in percent (e.g. 8.5 = 8.5 %). Pass null to clear the override.
 */
export async function setCommissionOverrideAction(
  storeId: string,
  ratePercent: number | null,
): Promise<{ ok: boolean; error?: string }> {
  const guard = await assertAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!storeId?.trim()) return { ok: false, error: "storeId is required." };

  if (ratePercent !== null && (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 50)) {
    return { ok: false, error: "Rate must be between 0 and 50 %." };
  }

  const fraction = ratePercent !== null ? ratePercent / 100 : null;

  const sb = createAdminClient();
  const { error } = await sb
    .from("stores")
    .update({ commission_override: fraction })
    .eq("id", storeId);

  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: guard.userId,
    actorEmail:  guard.email,
    actorRole:   "admin",
    action:      "store.commission_override",
    targetType:  "store",
    targetId:    storeId,
    storeId:     storeId,
    metadata:    { ratePercent, fraction },
  });

  revalidatePath(`/admin/sellers/${storeId}`);
  return { ok: true };
}

// ── Impersonation start ───────────────────────────────────────────────────────

/**
 * Admin-only: Set a signed `imp_store` httpOnly cookie that tells the dashboard
 * to resolve the current store to the given storeId.
 *
 * Security:
 *  - assertAdmin() verifies the caller's Supabase session before touching cookies.
 *  - The cookie value is HMAC-SHA-256 signed with a server-side secret.
 *  - Max-age is 30 minutes (IMP_MAX_AGE_SECONDS).
 *  - The cookie is consumed by getCurrentStore() in lib/auth.ts which ALSO
 *    re-checks is_admin, so stealing the cookie gains nothing without admin auth.
 *  - An audit log line (console.info) records start of impersonation.
 */
export async function startImpersonation(
  storeId: string,
  storeName: string,
): Promise<{ ok: boolean; error?: string }> {
  const guard = await assertAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!storeId?.trim()) return { ok: false, error: "storeId is required." };

  const cookieValue = buildImpCookieValue(storeId);
  const cookieStore = await cookies();
  cookieStore.set(IMP_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: IMP_MAX_AGE_SECONDS,
  });

  console.info(
    `[admin-action] startImpersonation storeId=${storeId} storeName="${storeName}" by adminUserId=${guard.userId}`,
  );

  await logAudit({
    actorUserId: guard.userId,
    actorEmail:  guard.email,
    actorRole:   "admin",
    action:      "impersonate.start",
    targetType:  "store",
    targetId:    storeId,
    storeId:     storeId,
    metadata:    { storeName },
  });

  return { ok: true };
}
