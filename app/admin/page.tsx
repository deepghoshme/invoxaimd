import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell, { type NavItem } from "@/components/AppShell";
import CategoriesEditor from "./CategoriesEditor";

export const dynamic = "force-dynamic";

const ADMIN_NAV: NavItem[] = [
  { label: "Overview", href: "/admin", icon: "📊", exact: true },
];

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card" style={{ padding: "var(--space-3)" }}>
      <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
        {label}
      </p>
      <p style={{ margin: "0.2rem 0 0", fontSize: "1.8rem", fontWeight: 700 }}>
        {value}
      </p>
    </div>
  );
}

function AdminsOnly() {
  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100dvh", padding: "var(--space-3)" }}>
      <div className="card" style={{ maxWidth: 420, textAlign: "center" }}>
        <h1 style={{ marginTop: 0 }}>Admins only</h1>
        <p className="muted">
          This area is restricted. Your account doesn&apos;t have admin access.
        </p>
        <a className="btn btn-ghost" href="https://app.invoxai.io">
          Go to dashboard
        </a>
      </div>
    </main>
  );
}

export default async function AdminPage() {
  const supabase = await createClient();

  // --- Authorize BEFORE fetching anything (don't leak the admin RSC payload) ---
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: myRoles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (!(myRoles ?? []).some((r) => r.role === "admin")) return <AdminsOnly />;

  // Admin reads all (RLS select policies allow is_admin()).
  const [{ count: userCount }, { count: storeCount }, categoriesRes, reservedRes, sellersRes] =
    await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("stores").select("*", { count: "exact", head: true }),
      supabase
        .from("business_categories")
        .select("id, name, commission_rate, is_active")
        .order("sort_order"),
      supabase.from("reserved_subdomains").select("name").order("name"),
      supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "seller"),
    ]);

  const categories = categoriesRes.data ?? [];
  const reserved = (reservedRes.data ?? []).map((r) => r.name);
  const sellerCount = sellersRes.count ?? 0;

  return (
    <AppShell brand="Admin" nav={ADMIN_NAV}>
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "var(--space-4) var(--space-3)" }}>
      <header style={{ marginBottom: "var(--space-4)" }}>
        <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
          Admin · invoxai.io
        </p>
        <h1 style={{ margin: "0.1rem 0 0" }}>Platform control</h1>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "var(--space-2)",
          marginBottom: "var(--space-4)",
        }}
      >
        <Stat label="Total users" value={userCount ?? 0} />
        <Stat label="Sellers" value={sellerCount} />
        <Stat label="Stores" value={storeCount ?? 0} />
        <Stat label="Categories" value={categories.length} />
      </section>

      <section className="card" style={{ marginBottom: "var(--space-3)" }}>
        <h2 style={{ marginTop: 0 }}>Per-category commission</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          The platform fee taken on each sale (revenue stream #2). Edits apply to
          future sales.
        </p>
        <CategoriesEditor categories={categories} />
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Reserved subdomains</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {reserved.length} names blocked from seller signup.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {reserved.map((n) => (
            <span
              key={n}
              style={{
                fontSize: "0.8rem",
                padding: "0.2rem 0.55rem",
                borderRadius: 999,
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                color: "var(--color-muted)",
              }}
            >
              {n}
            </span>
          ))}
        </div>
      </section>
    </main>
    </AppShell>
  );
}
