"use server";

import { createClient } from "@/lib/supabase/server";
import { requireDashboardStore } from "@/lib/auth";
import { assertNotImpersonating } from "@/lib/impersonation";
import { revalidatePath } from "next/cache";

// Validates a DNS-label subdomain: lowercase, alphanumeric + hyphens, 3–63 chars,
// no leading/trailing hyphen.
const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])$/;

export type SubdomainActionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Add an extra subdomain alias for the seller's store.
 * Uses the SESSION client so store_subdomains owner-write RLS enforces ownership.
 */
export async function addExtraSubdomain(
  rawSub: string,
): Promise<SubdomainActionResult> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const { store } = await requireDashboardStore();

  const sub = rawSub.trim().toLowerCase();

  if (!sub) return { ok: false, error: "Subdomain is required." };
  if (!SUBDOMAIN_RE.test(sub)) {
    return {
      ok: false,
      error:
        "Invalid subdomain. Use only lowercase letters, numbers, and hyphens. Must be 3–63 characters and cannot start or end with a hyphen.",
    };
  }

  // Block squatting on the primary subdomain itself.
  if (sub === store.subdomain) {
    return {
      ok: false,
      error: "This is already your primary subdomain.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("store_subdomains").insert({
    store_id: store.id,
    subdomain: sub,
  });

  if (error) {
    // PostgreSQL unique-violation code = 23505
    if (
      error.code === "23505" ||
      error.message?.toLowerCase().includes("unique")
    ) {
      return {
        ok: false,
        error: `The subdomain "${sub}.invoxai.io" is already taken.`,
      };
    }
    // DB CHECK constraint violation = 23514
    if (
      error.code === "23514" ||
      error.message?.toLowerCase().includes("check")
    ) {
      return {
        ok: false,
        error: "Invalid subdomain format — only lowercase letters, numbers, and hyphens are allowed.",
      };
    }
    return { ok: false, error: "Could not add subdomain. Please try again." };
  }

  revalidatePath("/dashboard/domains");
  return { ok: true };
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
