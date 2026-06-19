import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireDashboardStore } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Kpis } from "@/components/dx/ui";
import HomeCharts from "./_home/HomeCharts";

export const dynamic = "force-dynamic";

// ── helpers ──────────────────────────────────────────────────────────────────
const inr = (paise: number) =>
  "₹" + Math.round(paise / 100).toLocaleString("en-IN");

function delta(curr: number, prev: number): string {
  if (prev === 0) return curr > 0 ? "▲ 100%" : "0%";
  const d = ((curr - prev) / prev) * 100;
  return (d >= 0 ? "▲ " : "▼ ") + Math.abs(d).toFixed(1) + "%";
}

const PAGE_TYPE_LABELS: Record<string, string> = {
  opp: "Products",
  store: "Store",
  bio: "Bio",
  website: "Website",
  courses: "Courses",
  book: "Booking",
  env: "Events",
  vpc: "VIP",
  ldf: "Leads",
  led: "Landing",
  pay: "Payment",
};

const DONUT_COLORS = [
  "var(--primary)",
  "var(--accent)",
  "var(--gold)",
  "var(--secondary)",
  "#1fb57a",
  "#3b82f6",
];

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function avatarInitial(name: string): string {
  const t = name.trim();
  if (!t || t === "—") return "?";
  return t[0].toUpperCase();
}

// ── page ─────────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  // Use getUser() for the logged-in user's display name (user_metadata),
  // and requireDashboardStore() for the store to display data from
  // (may differ from the user's own store when an admin is impersonating).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { store } = await requireDashboardStore();
  // Use admin client for data queries so impersonation works
  // (admin's session-scoped client fails RLS on the target seller's data).
  const sb = createAdminClient();

  const storeId = store.id;
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // ── queries ─────────────────────────────────────────────────────────────────
  // This-week paid orders
  const { data: thisWeekPaid } = await sb
    .from("orders")
    .select("amount, page_type, paid_at, created_at")
    .eq("store_id", storeId)
    .eq("status", "paid")
    .gte("paid_at", d7.toISOString());

  // Prior-week paid orders (for delta arrows)
  const { data: priorWeekPaid } = await sb
    .from("orders")
    .select("amount")
    .eq("store_id", storeId)
    .eq("status", "paid")
    .gte("paid_at", d14.toISOString())
    .lt("paid_at", d7.toISOString());

  // Page events this week (views = denominator for conversion)
  const { data: thisEvents } = await sb
    .from("page_events")
    .select("kind")
    .eq("store_id", storeId)
    .gte("created_at", d7.toISOString());

  const { data: priorEvents } = await sb
    .from("page_events")
    .select("kind")
    .eq("store_id", storeId)
    .gte("created_at", d14.toISOString())
    .lt("created_at", d7.toISOString());

  // Recent orders (paid + pending) for the table
  const { data: recentOrders } = await sb
    .from("orders")
    .select(
      "id, buyer_name, buyer_email, product_title, page_type, amount, status, created_at",
    )
    .eq("store_id", storeId)
    .in("status", ["paid", "created"])
    .order("created_at", { ascending: false })
    .limit(8);

  // ── compute KPIs ────────────────────────────────────────────────────────────
  const thisRevenue = (thisWeekPaid ?? []).reduce(
    (s, o) => s + (o.amount ?? 0),
    0,
  );
  const priorRevenue = (priorWeekPaid ?? []).reduce(
    (s, o) => s + (o.amount ?? 0),
    0,
  );
  const thisOrders = (thisWeekPaid ?? []).length;
  const priorOrders = (priorWeekPaid ?? []).length;

  const thisViews = (thisEvents ?? []).filter((e) => e.kind === "view").length;
  const priorViews = (priorEvents ?? []).filter(
    (e) => e.kind === "view",
  ).length;

  const thisConv = thisViews > 0 ? (thisOrders / thisViews) * 100 : 0;
  const priorConv = priorViews > 0 ? (priorOrders / priorViews) * 100 : 0;

  // ── revenue bar chart — last 7 days ─────────────────────────────────────────
  const barDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    return { label: DOW[d.getDay()], amount: 0, isToday: i === 6 };
  });
  for (const o of thisWeekPaid ?? []) {
    const dt = new Date(o.paid_at ?? o.created_at);
    const daysAgo = Math.floor(
      (now.getTime() - dt.getTime()) / (24 * 60 * 60 * 1000),
    );
    const idx = 6 - daysAgo;
    if (idx >= 0 && idx < 7) barDays[idx].amount += o.amount ?? 0;
  }

  // ── donut — sales by page_type ───────────────────────────────────────────────
  const catMap: Record<string, number> = {};
  for (const o of thisWeekPaid ?? []) {
    const cat = o.page_type ?? "other";
    catMap[cat] = (catMap[cat] ?? 0) + 1;
  }
  const rawSegments = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count], i) => ({
      label: PAGE_TYPE_LABELS[type] ?? type,
      pct:
        thisOrders > 0 ? Math.round((count / thisOrders) * 100) : 0,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
    }));
  const donutSegments =
    rawSegments.length > 0
      ? rawSegments
      : [{ label: "No orders yet", pct: 100, color: "var(--border)" }];

  // ── display name ─────────────────────────────────────────────────────────────
  const meta = (user.user_metadata ?? {}) as {
    full_name?: string;
    name?: string;
  };
  const firstName = (meta.full_name ?? meta.name ?? "")
    .split(" ")[0]
    .trim();
  const displayName = firstName || store.store_name || "there";

  // ── serialise for client component ──────────────────────────────────────────
  const chartBarDays = barDays.map((d) => ({
    label: d.label,
    amount: d.amount,
    isToday: d.isToday,
  }));

  const tableOrders = (recentOrders ?? [])
    // Drop placeholder/abandoned orders: a "created" order with no buyer info
    // is an unpaid/abandoned (or coupon-preview) row and would render as a blank
    // "?" record. Keep paid orders and pending orders that have a real buyer.
    .filter((o) => o.status === "paid" || !!o.buyer_email)
    .map((o) => ({
      id: o.id as string,
      buyerName: (o.buyer_name as string | null) ?? "—",
      buyerEmail: (o.buyer_email as string | null) ?? "",
      productTitle: (o.product_title as string | null) ?? "—",
      pageType: (o.page_type as string | null) ?? "",
      amount: (o.amount as number | null) ?? 0,
      status: o.status as "paid" | "created" | "failed",
    }));

  return (
    <>
      {/* Welcome header */}
      <div className="dx-phead">
        <div>
          <h1>Welcome back, {displayName} 👋</h1>
          <p>Here&apos;s how {store.store_name} performed this week.</p>
        </div>
        <a className="btn grad" href="/dashboard/pages/products">
          ＋ Create page
        </a>
      </div>

      {/* KPI row */}
      <Kpis
        items={[
          {
            icon: "rupee",
            color: "var(--primary)",
            label: "Revenue (7d)",
            value: inr(thisRevenue),
            delta: delta(thisRevenue, priorRevenue) + " vs last week",
            down: thisRevenue < priorRevenue,
          },
          {
            icon: "bag",
            color: "var(--accent)",
            label: "Orders",
            value: String(thisOrders),
            delta: delta(thisOrders, priorOrders),
            down: thisOrders < priorOrders,
          },
          {
            icon: "eye",
            color: "var(--secondary)",
            label: "Conversion",
            value: thisViews === 0 ? "—" : thisConv.toFixed(1) + "%",
            delta:
              thisViews > 0 && priorViews > 0
                ? delta(thisConv, priorConv)
                : undefined,
            down: thisConv < priorConv,
          },
          {
            icon: "wallet",
            color: "var(--gold)",
            label: "Wallet balance",
            value: "₹0",
            delta: "Recharge →",
            down: false,
          },
        ]}
      />

      {/* Charts — client component */}
      <HomeCharts barDays={chartBarDays} donutSegments={donutSegments} />

      {/* Recent orders table */}
      <div className="dx-card" style={{ marginTop: 16 }}>
        <div className="dx-ctitle">
          <h3>Recent orders</h3>
          <a href="/dashboard/orders">View CRM →</a>
        </div>
        {tableOrders.length === 0 ? (
          <div className="dx-empty">
            No orders yet — share your product page to start selling.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Product</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tableOrders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <div className="dx-tg">
                      <div className="dx-sq">
                        {avatarInitial(o.buyerName)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {o.buyerName}
                        </div>
                        {o.buyerEmail && (
                          <div
                            style={{
                              color: "var(--muted)",
                              fontSize: 12,
                            }}
                          >
                            {o.buyerEmail}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{o.productTitle}</td>
                  <td>
                    <span className="dx-cat">
                      {o.pageType
                        ? (PAGE_TYPE_LABELS[o.pageType] ?? o.pageType)
                        : "—"}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700 }}>{inr(o.amount)}</td>
                  <td>
                    <span
                      className={`dx-pilltag ${
                        o.status === "paid" ? "t-paid" : "t-pend"
                      }`}
                    >
                      {o.status === "paid" ? "Paid" : "Pending"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
