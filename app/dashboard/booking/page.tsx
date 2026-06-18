import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card, Tag, Live } from "@/components/dx/ui";
import { getUpcomingBookingsForStore } from "@/lib/booking";
import { createBookingPage } from "./actions";
import type { BookingContent } from "@/lib/booking";

export const dynamic = "force-dynamic";

// Server action for the "New booking page" button (form action must be void).
async function handleCreate() {
  "use server";
  const res = await createBookingPage();
  if (res.ok && res.id) redirect(`/studio/booking/${res.id}`);
}

export default async function BookingDashboardPage() {
  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  // Fetch all booking pages for this store.
  const { data: bookingPages } = await sb
    .from("pages")
    .select("id, title, status, content, created_at, public_id")
    .eq("store_id", store.id)
    .eq("page_type", "booking")
    .order("created_at", { ascending: false });

  const pages = bookingPages ?? [];
  const pageIds = pages.map((p) => p.id);

  // Revenue from paid booking orders.
  let revenue = 0;
  if (pageIds.length > 0) {
    const { data: orderRows } = await sb
      .from("orders")
      .select("amount")
      .in("page_id", pageIds)
      .eq("status", "paid");
    revenue = (orderRows ?? []).reduce((s, o) => s + (o.amount ?? 0), 0);
  }

  // Upcoming confirmed bookings from the bookings table (graceful if table missing).
  const upcomingBookings = await getUpcomingBookingsForStore(store.id, 20);

  const inr = (p: number) => "₹" + Math.round(p / 100).toLocaleString("en-IN");

  const getPublicUrl = (page: { public_id: string | null }) =>
    store.subdomain && page.public_id
      ? `https://${store.subdomain}.invoxai.io/book/${page.public_id}`
      : null;

  return (
    <>
      <Phead
        title="1-to-1 Booking"
        sub="Sell consulting slots, coaching sessions, and paid calls."
        action={
          <form action={handleCreate}>
            <button type="submit" className="btn grad">+ New booking page</button>
          </form>
        }
      />
      <Kpis items={[
        { icon: "cal", color: "var(--primary)", label: "Booking pages", value: String(pages.length) },
        { icon: "bag", color: "var(--secondary)", label: "Upcoming sessions", value: String(upcomingBookings.length) },
        { icon: "rupee", color: "var(--green)", label: "Revenue", value: inr(revenue) },
        { icon: "chart", color: "var(--accent)", label: "Published", value: String(pages.filter((p) => p.status === "published").length) },
      ]} />

      <style>{`
        .pt-table { width: 100%; border-collapse: collapse; }
        .pt-table th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); padding: 9px 12px; border-bottom: 1px solid var(--border); }
        .pt-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 13px; }
        .pt-table tr:last-child td { border-bottom: 0; }
        .pt-table tr:hover td { background: var(--surface2); }
        .pt-empty { text-align: center; padding: 48px 24px; color: var(--muted); font-size: 13.5px; }
      `}</style>

      <div className="dx-grid dx-cols">
        {/* Booking pages list */}
        <div>
          <Card title={`Booking pages (${pages.length})`}>
            {pages.length === 0 ? (
              <div className="pt-empty">
                <div style={{ fontSize: 36, marginBottom: 10 }}>📅</div>
                <p style={{ marginBottom: 16 }}>
                  No booking pages yet. Create your first to start accepting sessions.
                </p>
                <form action={handleCreate}>
                  <button type="submit" className="btn grad" style={{ display: "inline-flex" }}>
                    + Create booking page
                  </button>
                </form>
              </div>
            ) : (
              <table className="pt-table">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Duration</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p) => {
                    const c = (p.content ?? {}) as BookingContent;
                    const pUrl = getPublicUrl(p);
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{c.title || p.title || "Untitled"}</td>
                        <td style={{ color: "var(--muted)" }}>{c.duration ? `${c.duration} min` : "—"}</td>
                        <td>
                          {c.is_free || !c.price
                            ? <span style={{ color: "var(--green)", fontWeight: 600 }}>Free</span>
                            : <span style={{ fontWeight: 700, color: "var(--primary)" }}>
                                {"₹" + Math.round(c.price / 100).toLocaleString("en-IN")}
                              </span>}
                        </td>
                        <td>{p.status === "published" ? <Live /> : <Tag kind="neu">Draft</Tag>}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <a
                              href={`/studio/booking/${p.id}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)", textDecoration: "none", border: "1px solid var(--border)", padding: "4px 10px", borderRadius: 7, background: "var(--surface)" }}
                            >
                              Edit
                            </a>
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
        </div>

        {/* Upcoming bookings */}
        <div>
          <Card title={`Upcoming sessions (${upcomingBookings.length})`}>
            {upcomingBookings.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
                No upcoming bookings yet.
              </div>
            ) : (
              <table className="pt-table">
                <thead>
                  <tr>
                    <th>Buyer</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingBookings.map((b) => {
                    const start = new Date(b.slot_start);
                    return (
                      <tr key={b.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{b.buyer_name}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{b.buyer_email}</div>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          {" "}
                          {start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td>
                          {b.status === "confirmed"
                            ? <Tag kind="paid">Confirmed</Tag>
                            : <Tag kind="pend">Pending</Tag>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
