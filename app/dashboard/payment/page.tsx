import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card, Tag, Live } from "@/components/dx/ui";

export const dynamic = "force-dynamic";

export default async function PaymentPageDash() {
  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  // Payment pages are opp-type pages in the pages table
  const { data: oppPages } = await sb
    .from("pages")
    .select("id, title, status, content, created_at, public_id")
    .eq("store_id", store.id)
    .eq("page_type", "opp")
    .order("created_at", { ascending: false });

  const pages = oppPages ?? [];

  // Revenue per page
  const pageIds = pages.map((p) => p.id);
  const revenueByPage: Record<string, number> = {};
  const salesByPage: Record<string, number> = {};

  if (pageIds.length > 0) {
    const { data: orderRows } = await sb
      .from("orders").select("amount, page_id").in("page_id", pageIds).eq("status", "paid");
    for (const o of orderRows ?? []) {
      if (o.page_id) {
        revenueByPage[o.page_id] = (revenueByPage[o.page_id] ?? 0) + (o.amount ?? 0);
        salesByPage[o.page_id] = (salesByPage[o.page_id] ?? 0) + 1;
      }
    }
  }

  const totalRevenue = Object.values(revenueByPage).reduce((s, v) => s + v, 0);
  const totalSales = Object.values(salesByPage).reduce((s, v) => s + v, 0);
  const inr = (p: number) => "₹" + Math.round(p / 100).toLocaleString("en-IN");

  return (
    <>
      <Phead
        title="Payment pages"
        sub={'Standalone "pay me" links — one-page products with checkout.'}
        action={
          <a href="/dashboard/pages/products" className="btn grad">
            + New payment page
          </a>
        }
      />
      <Kpis items={[
        { icon: "card", color: "var(--primary)", label: "Payment pages", value: String(pages.length) },
        { icon: "bag", color: "var(--secondary)", label: "Total sales", value: String(totalSales) },
        { icon: "rupee", color: "var(--green)", label: "Revenue", value: inr(totalRevenue) },
        { icon: "chart", color: "var(--accent)", label: "Published", value: String(pages.filter((p) => p.status === "published").length) },
      ]} />

      <style>{`
        .pt-table { width: 100%; border-collapse: collapse; }
        .pt-table th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); padding: 9px 12px; border-bottom: 1px solid var(--border); }
        .pt-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 13px; }
        .pt-table tr:last-child td { border-bottom: 0; }
        .pt-table tr:hover td { background: var(--surface2); }
        .pt-empty { text-align: center; padding: 56px 24px; color: var(--muted); font-size: 13.5px; }
      `}</style>

      <Card title={`Your payment pages (${pages.length})`}>
        {pages.length === 0 ? (
          <div className="pt-empty">
            <div style={{ fontSize: 36, marginBottom: 10 }}>💳</div>
            <p style={{ marginBottom: 16 }}>No payment pages yet. Create a one-page product to generate a shareable pay link.</p>
            <a href="/dashboard/pages/products" className="btn grad" style={{ display: "inline-flex" }}>
              + Create payment page
            </a>
          </div>
        ) : (
          <table className="pt-table">
            <thead><tr><th>Page</th><th>URL</th><th>Price</th><th>Sales</th><th>Revenue</th><th>Status</th></tr></thead>
            <tbody>
              {pages.map((p) => {
                const c = (p.content ?? {}) as { headline?: string; price?: number };
                return (
                  <tr key={p.id}>
                    <td>
                      <a href={`/studio/product/${p.id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: "var(--primary)", textDecoration: "none" }}>
                        {c.headline || p.title || "Untitled"}
                      </a>
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted)" }}>
                      {store.subdomain ? `${store.subdomain}.invoxai.io/opp/${p.public_id ?? p.id.slice(0, 8)}` : `/opp/${p.public_id ?? p.id.slice(0, 8)}`}
                    </td>
                    <td>{c.price ? inr(c.price * 100) : "—"}</td>
                    <td style={{ fontWeight: 600 }}>{salesByPage[p.id] ?? 0}</td>
                    <td style={{ fontWeight: 700, color: "var(--green)" }}>
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
