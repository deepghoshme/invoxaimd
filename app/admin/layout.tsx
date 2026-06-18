import { redirect } from "next/navigation";
import DxShell, { type DxNavGroup } from "@/components/dx/Shell";
import { createClient } from "@/lib/supabase/server";
import { getPlatformNotifications } from "@/lib/notifications";
import "../dashboard/dx.css";

export const dynamic = "force-dynamic";

const ADMIN_NAV: DxNavGroup[] = [
  { label: "Main", items: [
    { label: "Overview", icon: "grid", href: "/admin", exact: true },
    { label: "Revenue", icon: "chart", href: "/admin/revenue" },
    { label: "Notifications", icon: "bell", href: "/admin/notifications" },
  ] },
  { label: "Users", items: [
    { label: "Sellers", icon: "users", href: "/admin/sellers" },
    { label: "Buyers", icon: "bag", href: "/admin/buyers" },
  ] },
  { label: "Monetization", items: [
    { label: "Plans & Features", icon: "tag", href: "/admin/plans" },
    { label: "Commission", icon: "rupee", href: "/admin/commission" },
    { label: "Contact limits", icon: "users", href: "/admin/limits" },
    { label: "Premium templates", icon: "layers", href: "/admin/templates" },
    { label: "Promo codes", icon: "tag", href: "/admin/promo" },
  ] },
  { label: "Content", items: [
    { label: "Domains & subdomains", icon: "globe", href: "/admin/domains" },
  ] },
  { label: "Comms", items: [
    { label: "Emails", icon: "mail", href: "/admin/emails" },
  ] },
  { label: "Platform", items: [
    { label: "Team & roles", icon: "users", href: "/admin/team" },
    { label: "Audit log", icon: "shield", href: "/admin/audit" },
    { label: "Branding", icon: "img", href: "/admin/branding" },
    { label: "Payment gateways", icon: "card", href: "/admin/gateways" },
    { label: "Maintenance", icon: "shield", href: "/admin/maintenance" },
    { label: "Settings", icon: "cog", href: "/admin/settings" },
  ] },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const isAdmin = (roles ?? []).some((r) => r.role === "admin");

  if (!isAdmin) {
    return (
      <main style={{ display: "grid", placeItems: "center", minHeight: "100dvh", padding: 24, textAlign: "center" }}>
        <div>
          <h1>Admins only</h1>
          <p style={{ color: "#7a6770" }}>Your account doesn’t have admin access.</p>
          <p style={{ marginTop: 12 }}><a href="https://app.invoxai.io">Go to dashboard →</a></p>
        </div>
      </main>
    );
  }

  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string; avatar_url?: string; picture?: string };
  const notifItems = await getPlatformNotifications();

  return (
    <DxShell
      brand="invoxai"
      badge="admin"
      groups={ADMIN_NAV}
      notifItems={notifItems}
      user={{ email: user.email, name: meta.full_name ?? meta.name, avatarUrl: meta.avatar_url ?? meta.picture }}
      profileItems={[
        { label: "Account setting", href: "/admin/settings" },
        { label: "Plan & billing", href: "/admin/billing" },
      ]}
      homeHref="/admin"
    >
      {children}
    </DxShell>
  );
}
