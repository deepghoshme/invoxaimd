import { redirect } from "next/navigation";
import DxShell, { type DxNavGroup, type DxNavItem } from "@/components/dx/Shell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore } from "@/lib/auth";
import { getStoreNotifications } from "@/lib/notifications";
import { getPlatformSettings } from "@/lib/sites";
import { getSellerFeatureKeys } from "@/lib/plan-features.server";
import { type FeatureKey } from "@/lib/plan-features";
import ImpersonationBanner from "./ImpersonationBanner";
import NotificationSound from "@/components/NotificationSound";
import "./dx.css";

export const dynamic = "force-dynamic";

// Each nav item may carry a `feature` key — when set, the item is gated by the
// seller's plan feature_keys (resolved via getSellerFeatureKeys). Items WITHOUT
// a feature key are always visible (core: dashboard, orders, billing, settings,
// payments, account). See lib/plan-features.ts for the master catalog.
type GatedNavItem = DxNavItem & { feature?: FeatureKey };
type GatedNavGroup = { label: string; items: GatedNavItem[] };

const NAV: GatedNavGroup[] = [
  { label: "Main", items: [
    { label: "Dashboard", icon: "grid", href: "/dashboard", exact: true },
    { label: "Analytics", icon: "chart", href: "/dashboard/analytics", feature: "analytics" },
    { label: "A/B test", icon: "chart", href: "/dashboard/abtest", feature: "abtest" },
  ] },
  { label: "Pages", items: [
    { label: "Page builder ✨", icon: "layers", href: "/studio/v6" },
    { label: "Website", icon: "site", href: "/dashboard/website", feature: "website" },
    { label: "Bio page", icon: "link", href: "/dashboard/pages/bio", feature: "bio" },
    { label: "Store", icon: "bag", href: "/dashboard/store", feature: "store" },
    { label: "One-page product", icon: "tag", href: "/dashboard/pages/products", feature: "opp" },
    { label: "Courses", icon: "book", href: "/dashboard/courses", feature: "courses" },
    { label: "1-to-1 booking", icon: "cal", href: "/dashboard/booking", feature: "booking" },
    { label: "Events", icon: "cal", href: "/dashboard/events", feature: "events" },
    { label: "Lead form", icon: "form", href: "/dashboard/leadform", feature: "leadform" },
    { label: "VIP community", icon: "crown", href: "/dashboard/vip", feature: "vip" },
    { label: "Landing page", icon: "rocket", href: "/dashboard/landing", feature: "landing" },
    { label: "Templates", icon: "layers", href: "/dashboard/templates" },
  ] },
  { label: "Sell", items: [
    { label: "Orders", icon: "bag", href: "/dashboard/orders" },
    { label: "CRM", icon: "users", href: "/dashboard/crm", feature: "crm" },
    { label: "Coupons", icon: "tag", href: "/dashboard/coupons", feature: "coupons" },
    { label: "Abandoned cart", icon: "cart", href: "/dashboard/abandoned", feature: "abandoned_cart" },
    { label: "Upsell", icon: "up", href: "/dashboard/upsell", feature: "upsell" },
    { label: "Checkout", icon: "card", href: "/dashboard/checkout", feature: "checkout" },
    { label: "Reviews", icon: "star", href: "/dashboard/reviews", feature: "reviews" },
  ] },
  { label: "Money", items: [
    { label: "Payment gateways", icon: "card", href: "/dashboard/settings/payments" },
  ] },
  { label: "Marketing", items: [
    { label: "Email", icon: "mail", href: "/dashboard/email", feature: "email" },
    { label: "Pixels & SEO", icon: "pixel", href: "/dashboard/seo", feature: "seo" },
  ] },
  { label: "Account", items: [
    { label: "Notifications", icon: "bell", href: "/dashboard/notifications" },
    { label: "Audit log", icon: "shield", href: "/dashboard/audit" },
    { label: "Team & roles", icon: "users", href: "/dashboard/team", feature: "team" },
    { label: "Domains", icon: "globe", href: "/dashboard/domains", feature: "custom_domain" },
    { label: "Plan & billing", icon: "rupee", href: "/dashboard/billing" },
    { label: "Settings", icon: "cog", href: "/dashboard/settings" },
  ] },
];

/**
 * Lock gated nav items the seller's plan doesn't include.
 *
 * Fail-open policy: if the resolved feature set is EMPTY (no plan / plan not yet
 * configured with feature_keys by an admin), nothing is locked — existing
 * sellers keep full access until an admin actually configures plan features.
 * Once ANY feature key is set for the seller (plan or per-seller override),
 * gating activates and items whose feature isn't unlocked render locked.
 * Admins (impersonating or not) are never gated.
 */
function gateNav(nav: GatedNavGroup[], unlocked: Set<FeatureKey>, gatingActive: boolean): DxNavGroup[] {
  return nav.map((g) => ({
    label: g.label,
    items: g.items.map(({ feature, ...item }) => {
      const locked = gatingActive && feature != null && !unlocked.has(feature);
      return { ...item, locked } as DxNavItem;
    }),
  }));
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { store, impersonating } = await getCurrentStore();
  const notifItems = store ? await getStoreNotifications(store.id) : [];

  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string; avatar_url?: string; picture?: string };
  const branding = await getPlatformSettings();

  // Resolve which features this seller's plan unlocks and gate the nav.
  // Gating only activates once the resolved set is non-empty (fail-open: an
  // unconfigured plan never locks a seller out — see gateNav).
  const unlocked = store ? await getSellerFeatureKeys(store.id) : new Set<FeatureKey>();
  const gatingActive = unlocked.size > 0;
  const navGroups = gateNav(NAV, unlocked, gatingActive);

  return (
    <DxShell
      brand={branding.platform_name || "invoxai"}
      logoUrl={branding.logo_url}
      groups={navGroups}
      user={{ email: user.email, name: meta.full_name ?? meta.name, avatarUrl: meta.avatar_url ?? meta.picture }}
      notifItems={notifItems}
      headerExtra={<NotificationSound scope="seller" />}
      walletHref="/dashboard/wallet"
      profileItems={[
        { label: "Account setting", href: "/dashboard/settings" },
        { label: "Plan & billing", href: "/dashboard/billing" },
      ]}
      homeHref="/dashboard"
    >
      {impersonating && <ImpersonationBanner storeName={impersonating} />}
      {children}
    </DxShell>
  );
}
