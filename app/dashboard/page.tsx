import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: store } = await supabase
    .from("stores")
    .select("store_name, subdomain, onboarding_completed, category_id")
    .eq("owner_id", user.id)
    .maybeSingle();

  // Block the dashboard until onboarding is finished (resumable).
  if (!store || !store.onboarding_completed) redirect("/onboarding");

  const { data: category } = store.category_id
    ? await supabase
        .from("business_categories")
        .select("name, commission_rate")
        .eq("id", store.category_id)
        .maybeSingle()
    : { data: null };

  const siteUrl = `https://${store.subdomain}.invoxai.io`;

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "var(--space-4) var(--space-3)" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-4)",
          flexWrap: "wrap",
          gap: "var(--space-2)",
        }}
      >
        <div>
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
            Dashboard
          </p>
          <h1 style={{ margin: "0.1rem 0 0" }}>{store.store_name}</h1>
        </div>
      </header>

      <section
        className="card"
        style={{
          background: "var(--brand-gradient)",
          color: "#fff",
          border: "none",
          marginBottom: "var(--space-3)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>🎉 You&apos;re all set</h2>
        <p style={{ marginBottom: "var(--space-2)", opacity: 0.95 }}>
          Your store is live-ready. Build your first page to start sharing.
        </p>
        <a className="btn" href="/dashboard/pages/bio" style={{ background: "#fff", color: "var(--color-primary)" }}>
          Build your bio page →
        </a>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "var(--space-2)",
        }}
      >
        <div className="card" style={{ padding: "var(--space-3)" }}>
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
            Your address
          </p>
          <a href={siteUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
            {store.subdomain}.invoxai.io
          </a>
        </div>
        <div className="card" style={{ padding: "var(--space-3)" }}>
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
            Category
          </p>
          <p style={{ margin: "0.2rem 0 0", fontWeight: 600 }}>
            {category?.name ?? "—"}
          </p>
        </div>
        <div className="card" style={{ padding: "var(--space-3)" }}>
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
            Platform fee / sale
          </p>
          <p style={{ margin: "0.2rem 0 0", fontWeight: 600 }}>
            {category ? `${(category.commission_rate * 100).toFixed(1)}%` : "—"}
          </p>
        </div>
      </div>
    </main>
  );
}
