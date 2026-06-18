import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card, Tag, Live } from "@/components/dx/ui";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  const { data: eventPages } = await sb
    .from("pages")
    .select("id, title, status, content, created_at, public_id")
    .eq("store_id", store.id)
    .eq("page_type", "event")
    .order("created_at", { ascending: false });

  const pages = eventPages ?? [];
  const pageIds = pages.map((p) => p.id);

  let revenue = 0, ticketsSold = 0;
  if (pageIds.length > 0) {
    const { data: orderRows } = await sb
      .from("orders").select("amount").in("page_id", pageIds).eq("status", "paid");
    revenue = (orderRows ?? []).reduce((s, o) => s + (o.amount ?? 0), 0);
    ticketsSold = (orderRows ?? []).length;
  }

  const inr = (p: number) => "₹" + Math.round(p / 100).toLocaleString("en-IN");

  return (
    <>
      <Phead
        title="Events"
        sub="Sell tickets and manage registrations for your events."
        action={
          <button className="btn grad" disabled style={{ opacity: 0.7, cursor: "not-allowed" }}>
            + New event (coming soon)
          </button>
        }
      />
      <Kpis items={[
        { icon: "cal", color: "var(--primary)", label: "Events", value: String(pages.length) },
        { icon: "tag", color: "var(--secondary)", label: "Tickets sold", value: String(ticketsSold) },
        { icon: "rupee", color: "var(--green)", label: "Revenue", value: inr(revenue) },
        { icon: "chart", color: "var(--accent)", label: "Published", value: String(pages.filter((p) => p.status === "published").length) },
      ]} />

      <style>{`
        .pt-table { width: 100%; border-collapse: collapse; }
        .pt-table th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); padding: 9px 12px; border-bottom: 1px solid var(--border); }
        .pt-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 13px; }
        .pt-table tr:last-child td { border-bottom: 0; }
        .pt-table tr:hover td { background: var(--surface2); }
        .pt-empty { text-align: center; padding: 56px 24px; color: var(--muted); font-size: 13.5px; }
        .pt-feat { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; background: var(--surface2); border-radius: 9px; font-size: 13px; margin-bottom: 8px; }
        .pt-feat b { display: block; margin-bottom: 2px; }
        .pt-feat p { margin: 0; color: var(--muted); font-size: 12px; }
      `}</style>

      <div className="dx-grid dx-cols">
        <div>
          <Card title={`Events (${pages.length})`}>
            {pages.length === 0 ? (
              <div className="pt-empty">
                <div style={{ fontSize: 36, marginBottom: 10 }}>🎟️</div>
                <p>No events yet. The event builder is coming soon — create ticketed events with seat limits, date/time, and QR code entry.</p>
              </div>
            ) : (
              <table className="pt-table">
                <thead><tr><th>Event</th><th>Date</th><th>Seats</th><th>Sold</th><th>Status</th></tr></thead>
                <tbody>
                  {pages.map((p) => {
                    const c = (p.content ?? {}) as { headline?: string; event_date?: string; seats?: number };
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{c.headline || p.title || "Untitled"}</td>
                        <td style={{ color: "var(--muted)", fontSize: 12 }}>{c.event_date ? new Date(c.event_date).toLocaleDateString("en-IN") : "—"}</td>
                        <td>{c.seats ?? "—"}</td>
                        <td>—</td>
                        <td>{p.status === "published" ? <Live /> : <Tag kind="neu">Draft</Tag>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>
        <div>
          <Card title="Event builder — coming soon">
            <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
              Sell online and offline event tickets with seat tracking.
            </div>
            {[
              { icon: "📍", title: "Online & offline", desc: "Set venue or Zoom link, auto-sent on purchase" },
              { icon: "🎫", title: "Ticket types", desc: "Early bird, VIP, general — with different prices" },
              { icon: "📊", title: "Capacity tracking", desc: "Auto-close sales when seats fill up" },
            ].map((f) => (
              <div key={f.title} className="pt-feat">
                <span style={{ fontSize: 18 }}>{f.icon}</span>
                <div><b>{f.title}</b><p>{f.desc}</p></div>
              </div>
            ))}
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>Sell event tickets now with a one-page product:</p>
              <a href="/dashboard/pages/products" className="btn grad" style={{ display: "inline-flex" }}>Create one-page product →</a>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
