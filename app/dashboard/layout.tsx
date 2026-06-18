import { redirect } from "next/navigation";
import DxShell, { type DxNavGroup } from "@/components/dx/Shell";
import { createClient } from "@/lib/supabase/server";
import "./dx.css";

export const dynamic = "force-dynamic";

const NAV: DxNavGroup[] = [
  { label: "Main", items: [
    { label: "Dashboard", icon: "grid", href: "/dashboard", exact: true },
    { label: "Analytics", icon: "chart", href: "/dashboard/analytics" },
  ] },
  { label: "Pages", items: [
    { label: "Website", icon: "site", href: "/dashboard/website" },
    { label: "Bio page", icon: "link", href: "/dashboard/pages/bio" },
    { label: "Store", icon: "bag", href: "/dashboard/store" },
    { label: "One-page product", icon: "tag", href: "/dashboard/pages/products" },
    { label: "Courses", icon: "book", href: "/dashboard/courses" },
    { label: "1-to-1 booking", icon: "cal", href: "/dashboard/booking" },
    { label: "Events", icon: "cal", href: "/dashboard/events" },
    { label: "Payment page", icon: "card", href: "/dashboard/payment" },
    { label: "Lead form", icon: "form", href: "/dashboard/leadform" },
    { label: "VIP community", icon: "crown", href: "/dashboard/vip" },
    { label: "Landing page", icon: "rocket", href: "/dashboard/landing" },
  ] },
  { label: "Sell", items: [
    { label: "Orders", icon: "bag", href: "/dashboard/orders" },
    { label: "CRM", icon: "users", href: "/dashboard/crm" },
    { label: "Coupons", icon: "tag", href: "/dashboard/coupons" },
    { label: "Abandoned cart", icon: "cart", href: "/dashboard/abandoned" },
    { label: "Upsell", icon: "up", href: "/dashboard/upsell" },
    { label: "Checkout", icon: "card", href: "/dashboard/checkout" },
  ] },
  { label: "Money", items: [
    { label: "Payment gateways", icon: "card", href: "/dashboard/settings/payments" },
  ] },
  { label: "Marketing", items: [
    { label: "Email", icon: "mail", href: "/dashboard/email" },
    { label: "Pixels & SEO", icon: "pixel", href: "/dashboard/seo" },
  ] },
  { label: "Account", items: [
    { label: "Notifications", icon: "bell", href: "/dashboard/notifications" },
    { label: "Domains", icon: "globe", href: "/dashboard/domains" },
    { label: "Plan & billing", icon: "rupee", href: "/dashboard/billing" },
    { label: "Settings", icon: "cog", href: "/dashboard/settings" },
  ] },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string; avatar_url?: string; picture?: string };

  return (
    <DxShell
      brand="invoxai"
      groups={NAV}
      user={{ email: user.email, name: meta.full_name ?? meta.name, avatarUrl: meta.avatar_url ?? meta.picture }}
      walletHref="/dashboard/wallet"
      profileItems={[
        { label: "Account setting", href: "/dashboard/settings" },
        { label: "Plan & billing", href: "/dashboard/billing" },
      ]}
      homeHref="/dashboard"
    >
      {children}
    </DxShell>
  );
}
