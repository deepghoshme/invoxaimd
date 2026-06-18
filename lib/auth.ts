import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyImpCookie, IMP_COOKIE } from "@/lib/impersonation";

export type Store = {
  id: string;
  owner_id: string;
  store_name: string | null;
  subdomain: string | null;
  category_id: string | null;
  onboarding_step: "otp" | "store_name" | "subdomain" | "category" | "billing" | "done";
  onboarding_completed: boolean;
  billing: Record<string, unknown>;
  // Additional columns some pages select (present when fetched, optional here)
  custom_domain?: string | null;
  custom_domain_verified?: boolean | null;
  primary_domain?: string | null;
  wallet_balance?: number | null;
};

/** Current authenticated user (or null). Verified against the auth server. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Require a logged-in user; redirect to /login otherwise. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/** The signed-in user's store (RLS-scoped to the owner). Null if none yet. */
export async function getStore(): Promise<Store | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("stores")
    .select(
      "id, owner_id, store_name, subdomain, category_id, onboarding_step, onboarding_completed, billing, custom_domain, custom_domain_verified, primary_domain",
    )
    .eq("owner_id", user.id)
    .maybeSingle();

  return (data as Store | null) ?? null;
}

/**
 * Impersonation-aware store resolver.
 *
 * Returns the store the dashboard should display for this request. The rule:
 *
 *   1. If the caller has an admin Supabase role AND a valid `imp_store` cookie:
 *      → return the impersonated store (fetched via service-role client to
 *        bypass RLS; the admin check prevents non-admin abuse).
 *
 *   2. Otherwise: fall back to getStore() (normal seller flow).
 *
 * Security chokepoint: impersonation is only honoured when:
 *   (a) the caller's Supabase session has the "admin" role in user_roles, AND
 *   (b) the imp_store cookie passes HMAC-SHA-256 verification AND is not expired.
 *
 * This function is called from the dashboard layout (which wraps every dashboard
 * route). It returns { store, impersonating: string | null } so the layout can
 * show the "Viewing as" banner.
 */
export async function getCurrentStore(): Promise<{
  store: Store | null;
  impersonating: string | null; // store_name of the impersonated store, or null
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { store: null, impersonating: null };

  // Check for an active impersonation cookie.
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(IMP_COOKIE)?.value;
  const impStoreId = verifyImpCookie(rawCookie);

  if (impStoreId) {
    // Verify the current user is actually an admin (double-check — don't trust
    // just the cookie; the cookie grants "which store" not "admin privilege").
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");

    if (isAdmin) {
      // Fetch the impersonated store via admin client (bypasses RLS — the store
      // belongs to a different user, so the user's RLS policy won't match).
      const sb = createAdminClient();
      const { data } = await sb
        .from("stores")
        .select(
          "id, owner_id, store_name, subdomain, category_id, onboarding_step, onboarding_completed, billing, custom_domain, custom_domain_verified, primary_domain",
        )
        .eq("id", impStoreId)
        .maybeSingle();

      if (data) {
        return {
          store: data as Store,
          impersonating: (data as Store).store_name ?? impStoreId,
        };
      }
    }
    // Cookie was valid but store not found, or user lost admin — fall through.
  }

  // Normal path: seller's own store.
  const { data } = await supabase
    .from("stores")
    .select(
      "id, owner_id, store_name, subdomain, category_id, onboarding_step, onboarding_completed, billing, custom_domain, custom_domain_verified, primary_domain",
    )
    .eq("owner_id", user.id)
    .maybeSingle();

  return { store: (data as Store | null) ?? null, impersonating: null };
}

/**
 * Convenience wrapper for dashboard pages.
 *
 * Calls getCurrentStore(), redirects to /login if there is no session, and
 * redirects to /onboarding if the store is missing or onboarding is incomplete.
 * Returns { store, impersonating } for the happy path.
 *
 * Impersonation note: when an admin is impersonating, `store` is the TARGET
 * seller's store (fetched via the admin client, bypassing RLS). The
 * `impersonating` field is the store name string when active. Callers must NOT
 * use `store.owner_id` to derive the "current user" — they should continue to
 * use getUser() separately when they genuinely need the logged-in user's
 * identity (e.g. to build display name from user_metadata).
 */
export async function requireDashboardStore(): Promise<{
  store: Store;
  impersonating: string | null;
}> {
  const { store, impersonating } = await getCurrentStore();
  if (!store) redirect("/login");
  if (!store.onboarding_completed) redirect("/onboarding");
  return { store, impersonating };
}
