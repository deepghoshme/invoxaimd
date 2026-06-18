import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card, Tag, Live } from "@/components/dx/ui";

export const dynamic = "force-dynamic";

export default async function BookingPage() {
  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  // Real query for booking pages
  const { data: bookingPages } = await sb
    .from("pages")
    .select("id, title, status, content, created_at, public_id")
    .eq("store_id", store.id)
    .eq("page_type", "booking")
    .order("created_at", { ascending: false });

  const pages = bookingPages ?? [];
  const pageIds = pages.map((p) => p.id);

  let revenue = 0, bookedCount = 0;
  if (pageIds.length > 0) {
    const { data: orderRows } = await sb
      .from("orders").select("amount").in("page_id", pageIds).eq("status", "paid");
    revenue = (orderRows ?? []).reduce((s, o) => s + (o.amount ?? 0), 0);
    bookedCount = (orderRows ?? []).length;
  }

  const inr = (p: number) => "₹" + Math.round(p / 100).toLocaleString("en-IN");

  return (
    <>
      <Phead
        title="1-to-1 Booking"
        sub="Sell consulting slots, coaching sessions, and paid calls."
        action={
          <button className="btn grad" disabled style={{ opacity: 0.7, cursor: "not-allowed" }}>
            + New booking page (coming soon)
          </button>
        }
      />
      <Kpis items={[
        { icon: "cal", color: "var(--primary)", label: "Booking pages", value: String(pages.length) },
        { icon: "bag", color: "var(--secondary)", label: "Bookings made", value: String(bookedCount) },
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
          <Card title={`Booking pages (${pages.length})`}>
            {pages.length === 0 ? (
              <div className="pt-empty">
                <div style={{ fontSize: 36, marginBottom: 10 }}>📅</div>
                <p>No booking pages yet. The booking builder is coming soon — you will be able to set your availability, session types, and pricing.</p>
              </div>
            ) : (
              <table className="pt-table">
                <thead><tr><th>Service</th><th>Duration</th><th>Price</th><th>Booked</th><th>Status</th></tr></thead>
                <tbody>
                  {pages.map((p) => {
                    const c = (p.content ?? {}) as { headline?: string; price?: number; duration?: string };
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{c.headline || p.title || "Untitled"}</td>
                        <td style={{ color: "var(--muted)" }}>{c.duration || "—"}</td>
                        <td>{c.price ? inr(c.price * 100) : "—"}</td>
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
          <Card title="Booking builder — coming soon">
            <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>A calendar booking builder is planned with availability slots, buffer time, and instant Razorpay payment.</div>
            {[
              { icon: "🗓️", title: "Availability calendar", desc: "Set your available days and time slots" },
              { icon: "⏱️", title: "Session types", desc: "30 min, 60 min, custom durations" },
              { icon: "📧", title: "Auto-confirmation", desc: "Send booking confirmation emails automatically" },
            ].map((f) => (
              <div key={f.title} className="pt-feat">
                <span style={{ fontSize: 18 }}>{f.icon}</span>
                <div><b>{f.title}</b><p>{f.desc}</p></div>
              </div>
            ))}
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>Until then, sell paid calls with a one-page product:</p>
              <a href="/dashboard/pages/products" className="btn grad" style={{ display: "inline-flex" }}>Create one-page product →</a>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
