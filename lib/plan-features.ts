// Client-SAFE module: only the FEATURE_CATALOG, the FeatureKey type, and pure
// helpers live here so client components (e.g. the admin PlansAdmin editor) can
// import them. The server-only DB resolvers live in lib/plan-features.server.ts.

/**
 * Plan feature toggles ("fetchers").
 *
 * FEATURE_CATALOG is the master list of toggleable dashboard capabilities. An
 * admin ticks which keys each plan unlocks (plans.feature_keys); the seller
 * dashboard only shows/unlocks the features their plan includes. A per-seller
 * override (stores.feature_keys) wins over the plan when set.
 *
 * The keys map 1:1 to dashboard nav hrefs (see app/dashboard/layout.tsx) so the
 * layout can gate the sidebar by feature.
 */
export type FeatureKey =
  | "analytics"
  | "abtest"
  | "website"
  | "bio"
  | "store"
  | "opp"
  | "courses"
  | "booking"
  | "events"
  | "leadform"
  | "vip"
  | "landing"
  | "orders"
  | "crm"
  | "coupons"
  | "abandoned_cart"
  | "upsell"
  | "checkout"
  | "reviews"
  | "custom_billing"
  | "email"
  | "seo"
  | "custom_domain"
  | "team";

export type FeatureDef = {
  key: FeatureKey;
  label: string;
  group: string;
};

/**
 * Master feature catalog. `group` mirrors the dashboard nav groups so the admin
 * editor can render the checkboxes in a familiar order.
 */
export const FEATURE_CATALOG: FeatureDef[] = [
  // Main
  { key: "analytics", label: "Analytics", group: "Main" },
  { key: "abtest", label: "A/B test", group: "Main" },
  // Pages
  { key: "website", label: "Website builder", group: "Pages" },
  { key: "bio", label: "Bio page", group: "Pages" },
  { key: "store", label: "Store", group: "Pages" },
  { key: "opp", label: "One-page product", group: "Pages" },
  { key: "courses", label: "Courses", group: "Pages" },
  { key: "booking", label: "1-to-1 booking", group: "Pages" },
  { key: "events", label: "Events", group: "Pages" },
  { key: "leadform", label: "Lead form", group: "Pages" },
  { key: "vip", label: "VIP community", group: "Pages" },
  { key: "landing", label: "Landing page", group: "Pages" },
  // Sell
  { key: "orders", label: "Orders", group: "Sell" },
  { key: "crm", label: "CRM", group: "Sell" },
  { key: "coupons", label: "Coupons", group: "Sell" },
  { key: "abandoned_cart", label: "Abandoned cart", group: "Sell" },
  { key: "upsell", label: "Upsell", group: "Sell" },
  { key: "checkout", label: "Checkout customisation", group: "Sell" },
  { key: "reviews", label: "Reviews", group: "Sell" },
  // Marketing
  { key: "email", label: "Email marketing", group: "Marketing" },
  { key: "seo", label: "Pixels & SEO", group: "Marketing" },
  // Account
  { key: "custom_billing", label: "Custom billing / invoices", group: "Account" },
  { key: "custom_domain", label: "Custom domain", group: "Account" },
  { key: "team", label: "Team & roles", group: "Account" },
];

export const ALL_FEATURE_KEYS: FeatureKey[] = FEATURE_CATALOG.map((f) => f.key);

const VALID_KEYS = new Set<string>(ALL_FEATURE_KEYS);

/** Keep only known feature keys (drops stale/unknown values defensively). */
export function sanitizeFeatureKeys(keys: unknown): FeatureKey[] {
  if (!Array.isArray(keys)) return [];
  const out: FeatureKey[] = [];
  for (const k of keys) {
    if (typeof k === "string" && VALID_KEYS.has(k) && !out.includes(k as FeatureKey)) {
      out.push(k as FeatureKey);
    }
  }
  return out;
}
