"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Result<T = undefined> = T extends undefined
  ? { ok: boolean; error?: string }
  : { ok: boolean; data?: T; error?: string };

// ── Admin guard ───────────────────────────────────────────────────────────────
// All actions in this file check admin role server-side before touching any data.
// RLS policies on the stores table (is_admin()) provide a second enforcement
// layer at the database level.

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated." };

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) return { ok: false as const, error: "Admin access required." };

  return { ok: true as const };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type SellerStore = {
  id: string;
  store_name: string | null;
  subdomain: string | null;
  custom_domain: string | null;
  custom_domain_verified: boolean;
  owner_id: string;
  billing: Record<string, unknown> | null;
  created_at: string | null;
  category_id: string | null;
  suspended: boolean;
  suspended_at: string | null;
  suspended_reason: string | null;
};

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Read a single seller store by store id.
 * Returns the full row including suspension fields.
 * Gracefully omits suspension fields if the migration hasn't been applied yet.
 */
export async function getSeller(
  storeId: string,
): Promise<Result<SellerStore>> {
  const guard = await assertAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("stores")
    .select(
      "id, store_name, subdomain, custom_domain, custom_domain_verified, owner_id, billing, created_at, category_id, suspended, suspended_at, suspended_reason",
    )
    .eq("id", storeId)
    .maybeSingle();

  if (error) {
    // Gracefully handle missing suspension columns (migration unapplied).
    if (
      error.message.includes("column") &&
      (error.message.includes("suspended") ||
        error.message.includes("does not exist"))
    ) {
      // Retry without suspension columns.
      const { data: fallback, error: e2 } = await sb
        .from("stores")
        .select(
          "id, store_name, subdomain, custom_domain, custom_domain_verified, owner_id, billing, created_at, category_id",
        )
        .eq("id", storeId)
        .maybeSingle();
      if (e2) return { ok: false, error: e2.message };
      if (!fallback) return { ok: false, error: "Store not found." };
      return {
        ok: true,
        data: {
          ...(fallback as Omit<SellerStore, "suspended" | "suspended_at" | "suspended_reason">),
          suspended: false,
          suspended_at: null,
          suspended_reason: null,
        },
      };
    }
    return { ok: false, error: error.message };
  }

  if (!data) return { ok: false, error: "Store not found." };

  const row = data as Record<string, unknown>;
  return {
    ok: true,
    data: {
      id: row.id as string,
      store_name: (row.store_name as string | null) ?? null,
      subdomain: (row.subdomain as string | null) ?? null,
      custom_domain: (row.custom_domain as string | null) ?? null,
      custom_domain_verified: !!(row.custom_domain_verified as boolean | null),
      owner_id: row.owner_id as string,
      billing: (row.billing as Record<string, unknown> | null) ?? null,
      created_at: (row.created_at as string | null) ?? null,
      category_id: (row.category_id as string | null) ?? null,
      suspended: !!(row.suspended as boolean | null),
      suspended_at: (row.suspended_at as string | null) ?? null,
      suspended_reason: (row.suspended_reason as string | null) ?? null,
    },
  };
}

/**
 * Suspend a seller's store.
 *
 * Sets suspended=true, records suspended_at (now), and stores an optional
 * reason visible only to admins (never shown on the public storefront).
 *
 * Security: admin-only server action + RLS is_admin() on stores table.
 * Effect: the storefront renderer (app/sites/[domain]/[[...path]]/page.tsx)
 * checks the suspended flag and renders "This store is currently unavailable"
 * instead of any content — checkout is also blocked.
 *
 * Graceful: if the suspension columns don't exist yet (migration unapplied),
 * returns an informative error rather than a 500.
 */
export async function suspendStore(
  storeId: string,
  reason?: string,
): Promise<Result> {
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

  revalidatePath("/admin/sellers");
  return { ok: true };
}

/**
 * Unsuspend (reinstate) a seller's store.
 *
 * Clears suspended, suspended_at, and suspended_reason.
 *
 * Security: admin-only server action + RLS is_admin() on stores table.
 */
export async function unsuspendStore(storeId: string): Promise<Result> {
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

  revalidatePath("/admin/sellers");
  return { ok: true };
}
