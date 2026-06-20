import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeFeatureKeys, type FeatureKey } from "@/lib/plan-features";

export type { FeatureKey } from "@/lib/plan-features";

/**
 * Server-only feature-key resolvers. Separated from lib/plan-features.ts (which
 * is client-safe) so client components can import the catalog/types without
 * pulling the admin Supabase client into the browser bundle.
 */

/**
 * The set of feature keys a seller has unlocked, resolved with precedence:
 *   per-seller override (stores.feature_keys, non-null) > plan.feature_keys.
 *
 * With no subscription row and no override the result is an empty set. The
 * dashboard layout treats an empty set as "gating not configured" and fails
 * open (see app/dashboard/layout.tsx).
 *
 * Best-effort: any DB error returns an empty set so a hiccup never crashes the
 * dashboard.
 */
export async function getSellerFeatureKeys(storeId: string): Promise<Set<FeatureKey>> {
  if (!storeId) return new Set();
  try {
    const admin = createAdminClient();

    // 1) Per-seller override wins when explicitly set (non-null).
    const { data: store } = await admin
      .from("stores")
      .select("feature_keys")
      .eq("id", storeId)
      .maybeSingle();

    const override = (store as { feature_keys?: string[] | null } | null)?.feature_keys;
    if (override != null) {
      return new Set(sanitizeFeatureKeys(override));
    }

    // 2) Otherwise the active subscription's plan feature_keys.
    const { data: sub } = await admin
      .from("subscriptions")
      .select("plan:plans(feature_keys)")
      .eq("store_id", storeId)
      .maybeSingle();

    const planFeatures =
      (sub as { plan?: { feature_keys?: string[] | null } | null } | null)?.plan?.feature_keys;
    return new Set(sanitizeFeatureKeys(planFeatures ?? []));
  } catch {
    return new Set();
  }
}

/** Resolve whether a single feature is unlocked for a seller. */
export async function hasFeature(storeId: string, key: FeatureKey): Promise<boolean> {
  const keys = await getSellerFeatureKeys(storeId);
  return keys.has(key);
}
