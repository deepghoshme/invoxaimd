import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card, Tag, Live } from "@/components/dx/ui";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  // All one-page products = potential landing pages
  const { data: oppPages } = await sb
    .from("pages")
    .select("id, title, status, content, created_at, public_id")
    .eq("store_id", store.id)
    .eq("page_type", "opp")
    .order("created_at", { ascending: false });

  const pages = oppPages ?? [];

  // Also check for pages with page_type = 'landing'
  const { data: landingPages } = await sb
    .from("pages")
    .select("id, title, status, content, created_at, public_id")
    .eq("store_id", store.id)
    .eq("page_type", "landing")
    .order("created_at", { ascending: false });

  const allLanding = [...(landingPages ?? []), ...pages];
  const pageIds = allLanding.map((p) => p.id);

  // Traffic analytics
  const { data: eventRows } = await sb
    .from("page_events")
    .select("kind, page_id")
    .in("page_id", pageIds.length > 0 ? pageIds : ["none"]);

  const viewsByPage: Record<string, number> = {};
  const clicksByPage: Record<string, number> = {};
  for (const e of eventRows ?? []) {
    if (!e.page_id) continue;
    if (e.kind === "view") viewsByPage[e.page_id] = (viewsByPage[e.page_id] ?? 0) + 1;
    else clicksByPage[e.page_id] = (clicksByPage[e.page_id] ?? 0) + 1;
  }

  const totalViews = Object.values(viewsByPage).reduce((s, v) => s + v, 0);

  // Revenue
  const revenueByPage: Record<string, number> = {};
  if (pageIds.length > 0) {
    const { data: orderRows } = await sb
      .from("orders").select("amount, page_id").in("page_id", pageIds).eq("status", "paid");
    for (const o of orderRows ?? []) {
      if (o.page_id) revenueByPage[o.page_id] = (revenueByPage[o.page_id] ?? 0) + (o.amount ?? 0);
    }
  }
  const totalRevenue = Object.values(revenueByPage).reduce((s, v) => s + v, 0);
  const inr = (p: number) => "₹" + Math.round(p / 100).toLocaleString("en-IN");

  return (
    <>
      <Phead
        title="Landing pages"
        sub="Campaign pages for your ads — one-page products with full analytics."
        action={
          <a href="/dashboard/pages/products" className="btn grad">
            + New landing page
          </a>
        }
      />
      <Kpis items={[
        { icon: "rocket", color: "var(--primary)", label: "Landing pages", value: String(allLanding.length) },
        { icon: "eye", color: "var(--secondary)", label: "Total visitors", value: totalViews.toLocaleString("en-IN") },
        { icon: "rupee", color: "var(--green)", label: "Revenue", value: inr(totalRevenue) },
        { icon: "chart", color: "var(--accent)", label: "Published", value: String(allLanding.filter((p) => p.status === "published").length) },
      ]} />

      <style>{`
        .pt-table { width: 100%; border-collapse: collapse; }
        .pt-table th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); padding: 9px 12px; border-bottom: 1px solid var(--border); }
        .pt-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 13px; }
        .pt-table tr:last-child td { border-bottom: 0; }
        .pt-table tr:hover td { background: var(--surface2); }
        .pt-empty { text-align: center; padding: 56px 24px; color: var(--muted); font-size: 13.5px; }
      `}</style>

      <Card title={`Landing pages (${allLanding.length})`}>
        {allLanding.length === 0 ? (
          <div className="pt-empty">
            <div style={{ fontSize: 36, marginBottom: 10 }}>🚀</div>
            <p style={{ marginBottom: 16 }}>No landing pages yet. Create a one-page product to build your first campaign page.</p>
            <a href="/dashboard/pages/products" className="btn grad" style={{ display: "inline-flex" }}>
              + Create landing page
            </a>
          </div>
        ) : (
          <table className="pt-table">
            <thead>
              <tr>
                <th>Page</th>
                <th>URL</th>
                <th>Visitors</th>
                <th>Clicks</th>
                <th>CTR</th>
                <th>Revenue</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {allLanding.map((p) => {
                const c = (p.content ?? {}) as { headline?: string };
                const views = viewsByPage[p.id] ?? 0;
                const clicks = clicksByPage[p.id] ?? 0;
                const ctr = views > 0 ? `${Math.min(100, (clicks / views) * 100).toFixed(1)}%` : "—";
                return (
                  <tr key={p.id}>
                    <td>
                      <a href={`/studio/product/${p.id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: "var(--primary)", textDecoration: "none" }}>
                        {c.headline || p.title || "Untitled"}
                      </a>
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted)" }}>
                      {store.subdomain ? `${store.subdomain}.invoxai.io` : ""}/opp/{p.public_id ?? p.id.slice(0, 8)}
                    </td>
                    <td style={{ fontWeight: 600 }}>{views.toLocaleString("en-IN")}</td>
                    <td>{clicks}</td>
                    <td>{ctr}</td>
                    <td style={{ fontWeight: 700, color: revenueByPage[p.id] ? "var(--green)" : "inherit" }}>
                      {revenueByPage[p.id] ? inr(revenueByPage[p.id]) : "—"}
                    </td>
                    <td>{p.status === "published" ? <Live /> : <Tag kind="neu">Draft</Tag>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
