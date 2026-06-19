import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card, Tag, Live } from "@/components/dx/ui";
import { createEventPage } from "./actions";
import { type EventContent, formatEventDate } from "@/lib/event";

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

  const ticketCountMap: Record<string, number> = {};
  let revenue = 0;
  let ticketsSold = 0;

  if (pageIds.length > 0) {
    try {
      const { data: orderRows } = await sb
        .from("orders")
        .select("amount, page_id")
        .in("page_id", pageIds)
        .eq("status", "paid");
      for (const o of orderRows ?? []) {
        revenue += o.amount ?? 0;
      }
    } catch {
      // graceful if orders table has issues
    }

    try {
      // Sum qty per page from event_tickets so multi-ticket orders count correctly
      const { data: ticketRows } = await sb
        .from("event_tickets")
        .select("page_id, qty")
        .in("page_id", pageIds)
        .neq("status", "cancelled");
      for (const t of ticketRows ?? []) {
        const n = Number(t.qty) || 0;
        ticketsSold += n;
        if (t.page_id) ticketCountMap[t.page_id] = (ticketCountMap[t.page_id] ?? 0) + n;
      }
    } catch {
      // graceful if event_tickets table isn't present
    }
  }

  const inr = (paise: number) => "₹" + Math.round(paise / 100).toLocaleString("en-IN");

  return (
    <>
      <Phead
        title="Events"
        sub="Sell tickets and manage registrations for your events."
        action={
          <form action={createEventPage}>
            <button type="submit" className="btn grad">
              + New event
            </button>
          </form>
        }
      />
      <Kpis
        items={[
          { icon: "cal", color: "var(--primary)", label: "Events", value: String(pages.length) },
          { icon: "tag", color: "var(--secondary)", label: "Tickets sold", value: String(ticketsSold) },
          { icon: "rupee", color: "var(--green)", label: "Revenue", value: inr(revenue) },
          {
            icon: "chart",
            color: "var(--accent)",
            label: "Published",
            value: String(pages.filter((p) => p.status === "published").length),
          },
        ]}
      />

      <style>{`
        .ev-table { width: 100%; border-collapse: collapse; }
        .ev-table th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); padding: 9px 12px; border-bottom: 1px solid var(--border); }
        .ev-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: middle; }
        .ev-table tr:last-child td { border-bottom: 0; }
        .ev-table tr:hover td { background: var(--surface2); }
        .ev-table a { color: var(--primary); font-weight: 600; text-decoration: none; font-size: 12px; }
        .ev-table a:hover { text-decoration: underline; }
        .ev-empty { text-align: center; padding: 56px 24px; color: var(--muted); font-size: 13.5px; }
      `}</style>

      <Card title={`Your events (${pages.length})`}>
        {pages.length === 0 ? (
          <div className="ev-empty">
            <div style={{ fontSize: 36, marginBottom: 10 }}>🎟️</div>
            <p style={{ marginBottom: 16 }}>
              No events yet. Create your first ticketed event.
            </p>
            <form action={createEventPage} style={{ display: "inline" }}>
              <button type="submit" className="btn grad">
                + Create your first event
              </button>
            </form>
          </div>
        ) : (
          <table className="ev-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Date</th>
                <th>Tickets sold</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => {
                const c = (p.content ?? {}) as EventContent;
                const dateStr = formatEventDate(c.event_date, c.event_time, c.timezone);
                const sold = ticketCountMap[p.id] ?? 0;
                const pUrl = store.subdomain && p.public_id
                  ? `https://${store.subdomain}.invoxai.io/event/${p.public_id}`
                  : null;
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{c.title || p.title || "Untitled"}</td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{dateStr || "—"}</td>
                    <td>{sold}</td>
                    <td>
                      {p.status === "published" ? <Live /> : <Tag kind="neu">Draft</Tag>}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <a href={`/studio/event/${p.id}`} className="pt-edit-btn" target="_blank" rel="noreferrer">Edit</a>
                        {pUrl && p.status === "published" && (
                          <a
                            href={pUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textDecoration: "none", border: "1px solid var(--border)", padding: "4px 10px", borderRadius: 7, background: "var(--surface)" }}
                          >
                            View ↗
                          </a>
                        )}
                      </div>
                    </td>
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
