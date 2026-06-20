"use server";

import { createClient } from "@/lib/supabase/server";
import { requireDashboardStore } from "@/lib/auth";
import { assertNotImpersonating } from "@/lib/impersonation";
import { revalidatePath } from "next/cache";

// Validates a DNS-label subdomain: lowercase, alphanumeric + hyphens, 3–63 chars,
// no leading/trailing hyphen.
const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])$/;

export type SubdomainRow = {
  id: string;
  subdomain: string;
  page_id: string | null;
  label: string | null;
  created_at: string;
};

export type SubdomainActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type SubdomainAddResult =
  | { ok: true; row: SubdomainRow }
  | { ok: false; error: string };

export type SubdomainUpdateResult =
  | { ok: true; row: SubdomainRow }
  | { ok: false; error: string };

/** Validates a subdomain string; returns an error message or null if valid. */
function validateSubdomainFormat(sub: string): string | null {
  if (!sub) return "Subdomain is required.";
  if (!SUBDOMAIN_RE.test(sub)) {
    return "Invalid subdomain. Use only lowercase letters, numbers, and hyphens. Must be 3–63 characters and cannot start or end with a hyphen.";
  }
  return null;
}

/**
 * Check that a subdomain is not already in use by another store (primary or extra).
 * Returns an error string if taken, null if available.
 * Skips checking `excludeId` row (used during updates to ignore the row being updated).
 */
async function checkSubdomainUniqueness(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sub: string,
  primarySubdomain: string,
  excludeId?: string,
): Promise<string | null> {
  // Block collision with the store's own primary subdomain.
  if (sub === primarySubdomain) {
    return "This is already your primary subdomain.";
  }

  // Check stores.subdomain (primary subdomains of all stores).
  const { data: primaryMatch } = await supabase
    .from("stores")
    .select("id")
    .eq("subdomain", sub)
    .maybeSingle();
  if (primaryMatch) {
    return `The subdomain "${sub}.invoxai.io" is already taken.`;
  }

  // Check store_subdomains (extra subdomains).
  let query = supabase
    .from("store_subdomains")
    .select("id")
    .eq("subdomain", sub);
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  const { data: extraMatch } = await query.maybeSingle();
  if (extraMatch) {
    return `The subdomain "${sub}.invoxai.io" is already taken.`;
  }

  return null;
}

/**
 * Add an extra subdomain alias for the seller's store.
 * Returns the inserted row (with real id) so the UI can use it immediately
 * instead of a fake placeholder id.
 */
export async function addExtraSubdomain(
  rawSub: string,
): Promise<SubdomainAddResult> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const { store } = await requireDashboardStore();

  const sub = rawSub.trim().toLowerCase();

  const formatErr = validateSubdomainFormat(sub);
  if (formatErr) return { ok: false, error: formatErr };

  const supabase = await createClient();

  const uniquenessErr = await checkSubdomainUniqueness(supabase, sub, store.subdomain ?? "");
  if (uniquenessErr) return { ok: false, error: uniquenessErr };

  const { data, error } = await supabase
    .from("store_subdomains")
    .insert({ store_id: store.id, subdomain: sub })
    .select("id, subdomain, page_id, label, created_at")
    .single();

  if (error) {
    // PostgreSQL unique-violation code = 23505
    if (error.code === "23505" || error.message?.toLowerCase().includes("unique")) {
      return { ok: false, error: `The subdomain "${sub}.invoxai.io" is already taken.` };
    }
    // DB CHECK constraint violation = 23514
    if (error.code === "23514" || error.message?.toLowerCase().includes("check")) {
      return {
        ok: false,
        error: "Invalid subdomain format — only lowercase letters, numbers, and hyphens are allowed.",
      };
    }
    return { ok: false, error: "Could not add subdomain. Please try again." };
  }

  revalidatePath("/dashboard/domains");
  return { ok: true, row: data as SubdomainRow };
}

/**
 * Update an extra subdomain row: rename subdomain, set page_id target, or set label.
 * All fields are optional; only provided fields are changed.
 * Scoped to the owner's store via RLS (session client) + explicit store ownership check.
 * page_id, if provided, must belong to the same store (or be null for store root).
 */
export async function updateExtraSubdomain(
  id: string,
  patch: { subdomain?: string; page_id?: string | null; label?: string | null },
): Promise<SubdomainUpdateResult> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  if (!id || typeof id !== "string") {
    return { ok: false, error: "Invalid subdomain id." };
  }

  const { store } = await requireDashboardStore();
  const supabase = await createClient();

  // Verify the row belongs to this store (belt + suspenders on top of RLS).
  const { data: existing } = await supabase
    .from("store_subdomains")
    .select("id, store_id, subdomain")
    .eq("id", id)
    .maybeSingle();

  if (!existing || existing.store_id !== store.id) {
    return { ok: false, error: "Subdomain not found." };
  }

  const update: Record<string, unknown> = {};

  // Validate and check uniqueness for a new subdomain name.
  if (patch.subdomain !== undefined) {
    const sub = patch.subdomain.trim().toLowerCase();
    const formatErr = validateSubdomainFormat(sub);
    if (formatErr) return { ok: false, error: formatErr };

    const uniquenessErr = await checkSubdomainUniqueness(
      supabase,
      sub,
      store.subdomain ?? "",
      id, // exclude the current row itself
    );
    if (uniquenessErr) return { ok: false, error: uniquenessErr };

    update.subdomain = sub;
  }

  // Validate page_id: must be null or belong to the same store and be published.
  if ("page_id" in patch) {
    if (patch.page_id === null || patch.page_id === undefined) {
      update.page_id = null;
    } else {
      const { data: page } = await supabase
        .from("pages")
        .select("id, store_id, status")
        .eq("id", patch.page_id)
        .maybeSingle();

      if (!page) {
        return { ok: false, error: "Page not found." };
      }
      if (page.store_id !== store.id) {
        return { ok: false, error: "Page does not belong to your store." };
      }
      if (page.status !== "published") {
        return { ok: false, error: "Only published pages can be set as a subdomain target." };
      }
      update.page_id = patch.page_id;
    }
  }

  // Label: any non-empty string or null.
  if ("label" in patch) {
    const lbl = patch.label?.trim() ?? null;
    update.label = lbl || null;
  }

  if (Object.keys(update).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  const { data, error } = await supabase
    .from("store_subdomains")
    .update(update)
    .eq("id", id)
    .select("id, subdomain, page_id, label, created_at")
    .single();

  if (error) {
    if (error.code === "23505" || error.message?.toLowerCase().includes("unique")) {
      return {
        ok: false,
        error: `The subdomain "${update.subdomain ?? existing.subdomain}.invoxai.io" is already taken.`,
      };
    }
    if (error.code === "23514" || error.message?.toLowerCase().includes("check")) {
      return {
        ok: false,
        error: "Invalid subdomain format — only lowercase letters, numbers, and hyphens are allowed.",
      };
    }
    return { ok: false, error: "Could not update subdomain. Please try again." };
  }

  revalidatePath("/dashboard/domains");
  return { ok: true, row: data as SubdomainRow };
}

/**
 * Remove an extra subdomain by its row id.
 * RLS enforces that only the owner can delete rows belonging to their store.
 */
export async function removeExtraSubdomain(
  id: string,
): Promise<SubdomainActionResult> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  if (!id || typeof id !== "string") {
    return { ok: false, error: "Invalid subdomain id." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("store_subdomains")
    .delete()
    .eq("id", id);

  if (error) {
    return {
      ok: false,
      error: "Could not remove subdomain. Please try again.",
    };
  }

  revalidatePath("/dashboard/domains");
  return { ok: true };
}
