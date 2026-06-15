import AppShell, { type NavItem } from "@/components/AppShell";

export const dynamic = "force-dynamic";

const SELLER_NAV: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: "🏠", exact: true },
  { label: "Bio page", href: "/dashboard/pages/bio", icon: "🔗" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell brand="invoxai" nav={SELLER_NAV}>
      {children}
    </AppShell>
  );
}
