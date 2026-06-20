"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

type Result = { ok: boolean; error?: string };

// ─── Admin guard ──────────────────────────────────────────────────────────────

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

// ─── Domain pricing ────────────────────────────────────────────────────────────

/**
 * Read domain pricing from platform_settings.
 * Returns defaults only when the columns genuinely don't exist yet (migration pending).
 * Real query errors are logged and re-thrown rather than silently returning defaults.
 */
export async function getDomainPricing(): Promise<{
  extra_subdomain_paise: number;
  extra_domain_paise: number;
  migrationPending?: boolean;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("extra_subdomain_paise, extra_domain_paise")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    // Only treat a missing column/table as "migration pending"
    if (
      error.message?.toLowerCase().includes("does not exist") ||
      error.code === "42P01"
    ) {
      return { extra_subdomain_paise: 4900, extra_domain_paise: 19900, migrationPending: true };
    }
    console.error("[admin/domains] getDomainPricing error:", error.message);
    throw new Error(error.message);
  }

  if (!data) {
    // Row missing — return defaults without marking migration pending
    return { extra_subdomain_paise: 4900, extra_domain_paise: 19900 };
  }

  const d = data as { extra_subdomain_paise?: number | null; extra_domain_paise?: number | null };
  return {
    extra_subdomain_paise: d.extra_subdomain_paise ?? 4900,
    extra_domain_paise: d.extra_domain_paise ?? 19900,
  };
}

/**
 * Save domain pricing to platform_settings.
 * Input is in rupees (e.g. 49); stored as paise (×100).
 */
export async function saveDomainPricing(input: {
  extra_subdomain_rupees: number;
  extra_domain_rupees: number;
}): Promise<Result> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const subPaise = Math.round(Number(input.extra_subdomain_rupees) * 100);
  const domPaise = Math.round(Number(input.extra_domain_rupees) * 100);

  if (!Number.isFinite(subPaise) || subPaise < 0) {
    return { ok: false, error: "Enter a valid subdomain price." };
  }
  if (!Number.isFinite(domPaise) || domPaise < 0) {
    return { ok: false, error: "Enter a valid domain price." };
  }

  // Use the regular (RLS-enforced) client — the admin policy on platform_settings
  // already allows admin writes. Belt-and-suspenders guard is done above.
  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_settings")
    .update({ extra_subdomain_paise: subPaise, extra_domain_paise: domPaise })
    .eq("id", true);

  if (error) {
    if (error.message.includes("does not exist") || error.message.includes("column")) {
      return { ok: false, error: "Apply migration 20260618280000_admin_comms.sql first." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/domains");
  return { ok: true };
}

// ─── Domain cancel actions ────────────────────────────────────────────────────

/**
 * Cancel (disconnect) a custom domain for a store.
 *
 * Clears stores.custom_domain and stores.custom_domain_verified so the TLS-check
 * route stops authorising a certificate for that host. Also sets the matching row
 * in custom_domains to status 'pending' so the Domain Connect wizard reflects the
 * disconnected state. The store itself is untouched.
 *
 * After this call, GET /api/tls-check?domain=<host> returns 403 because
 * tls-check queries stores.custom_domain with custom_domain_verified = true —
 * both conditions fail once this action completes.
 */
export async function adminCancelCustomDomain(domainId: string): Promise<Result> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const sb = createAdminClient();

  // 1. Read the domain row to get the store_id and domain value for the audit log.
  const { data: domRow, error: fetchErr } = await sb
    .from("custom_domains")
    .select("id, domain, store_id, status")
    .eq("id", domainId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!domRow) return { ok: false, error: "Domain not found." };

  const d = domRow as { id: string; domain: string; store_id: string; status: string };

  // 2. Clear the domain from the store (revokes TLS allowance immediately).
  const { error: storeErr } = await sb
    .from("stores")
    .update({ custom_domain: null, custom_domain_verified: false })
    .eq("id", d.store_id);

  if (storeErr) return { ok: false, error: storeErr.message };

  // 3. Reset the custom_domains row back to 'pending' so it is visible as disconnected.
  await sb
    .from("custom_domains")
    .update({ status: "pending" })
    .eq("id", domainId);

  // 4. Audit log.
  await logAudit({
    actorUserId: guard.userId,
    actorEmail:  guard.email,
    actorRole:   "admin",
    action:      "admin_cancel_custom_domain",
    targetType:  "custom_domain",
    targetId:    domainId,
    storeId:     d.store_id,
    metadata:    { domain: d.domain, previous_status: d.status },
  });

  revalidatePath("/admin/domains");
  return { ok: true };
}

/**
 * Cancel (disconnect) an extra subdomain row from store_subdomains.
 *
 * Deletes the store_subdomains row so the subdomain is no longer associated
 * with any store. The TLS-check route queries stores.subdomain for the primary
 * subdomain and store_subdomains for extras — once the row is deleted, Caddy
 * will not receive a new TLS cert approval for that label (existing certs expire
 * naturally; no active revocation is needed).
 *
 * The primary subdomain on stores.subdomain is intentionally NOT touchable here
 * (that would break the store's main URL). Only extra store_subdomains rows can
 * be cancelled via this action.
 */
export async function adminCancelExtraSubdomain(subdomainId: string): Promise<Result> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const sb = createAdminClient();

  // 1. Read the row first for the audit log.
  const { data: subRow, error: fetchErr } = await sb
    .from("store_subdomains")
    .select("id, subdomain, store_id")
    .eq("id", subdomainId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!subRow) return { ok: false, error: "Extra subdomain not found." };

  const s = subRow as { id: string; subdomain: string; store_id: string };

  // 2. Delete the row (disconnects subdomain → store mapping).
  const { error: delErr } = await sb
    .from("store_subdomains")
    .delete()
    .eq("id", subdomainId);

  if (delErr) return { ok: false, error: delErr.message };

  // 3. Audit log.
  await logAudit({
    actorUserId: guard.userId,
    actorEmail:  guard.email,
    actorRole:   "admin",
    action:      "admin_cancel_extra_subdomain",
    targetType:  "store_subdomain",
    targetId:    subdomainId,
    storeId:     s.store_id,
    metadata:    { subdomain: s.subdomain },
  });

  revalidatePath("/admin/domains");
  return { ok: true };
}
