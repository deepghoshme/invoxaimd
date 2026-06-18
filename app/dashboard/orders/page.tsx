import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card, Tag } from "@/components/dx/ui";

export const dynamic = "force-dynamic";

function inr(paise: number) {
  return "₹" + Math.round(paise / 100).toLocaleString("en-IN");
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}

type Order = {
  id: string;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  product_title: string | null;
  product_id: string | null;
  page_id: string | null;
  amount: number;
  gateway: string | null;
  gateway_payment_id: string | null;
  status: string;
  created_at: string;
  paid_at: string | null;
  commission_amount: number | null;
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const filter = sp.filter ?? "all";
  const q = (sp.q ?? "").trim().toLowerCase();

  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  // Fetch all orders for this store (last 200)
  const { data: rows } = await sb
    .from("orders")
    .select(
      "id, buyer_name, buyer_email, buyer_phone, product_title, product_id, page_id, amount, gateway, gateway_payment_id, status, created_at, paid_at, commission_amount"
    )
    .eq("store_id", store.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const orders: Order[] = (rows ?? []) as Order[];

  // KPIs
  const paid = orders.filter((o) => o.status === "paid");
  const pending = orders.filter((o) => o.status !== "paid");
  const totalRevenue = paid.reduce((s, o) => s + (o.amount ?? 0), 0);
  const totalCommission = paid.reduce((s, o) => s + (o.commission_amount ?? 0), 0);
  const convRate = orders.length
    ? `${((paid.length / orders.length) * 100).toFixed(1)}%`
    : "0%";

  // Filter
  let displayed = orders;
  if (filter === "paid") displayed = paid;
  else if (filter === "pending") displayed = pending;

  // Search
  if (q) {
    displayed = displayed.filter(
      (o) =>
        (o.buyer_name ?? "").toLowerCase().includes(q) ||
        (o.buyer_email ?? "").toLowerCase().includes(q) ||
        (o.product_title ?? "").toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q)
    );
  }

  // Avg order value
  const avgOrder = paid.length ? Math.round(totalRevenue / paid.length) : 0;

  return (
    <>
      <Phead
        title="Orders"
        sub={`${orders.length} orders · ${paid.length} paid`}
        action={
          <a
            href={`/dashboard/orders?export=1`}
            className="btn ghost"
            style={{ fontSize: 13 }}
          >
            Export CSV
          </a>
        }
      />

      <Kpis
        items={[
          {
            icon: "bag",
            color: "var(--primary)",
            label: "Total orders",
            value: orders.length.toLocaleString("en-IN"),
          },
          {
            icon: "rupee",
            color: "var(--green)",
            label: "Revenue",
            value: inr(totalRevenue),
          },
          {
            icon: "chart",
            color: "var(--secondary)",
            label: "Conv. rate",
            value: convRate,
          },
          {
            icon: "tag",
            color: "var(--accent)",
            label: "Avg. order",
            value: inr(avgOrder),
          },
        ]}
      />

      <style>{`
        .ord-toolbar {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px;
        }
        .ord-search {
          display: flex; align-items: center; gap: 7px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 10px; padding: 7px 12px; margin-left: auto;
          min-width: 200px; max-width: 280px;
        }
        .ord-search svg { color: var(--muted); flex: none; }
        .ord-search input {
          border: 0; background: transparent; color: var(--text); font: inherit;
          font-size: 13px; outline: none; width: 100%;
        }
        .ord-table { width: 100%; border-collapse: collapse; }
        .ord-table th {
          text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em;
          text-transform: uppercase; color: var(--muted); padding: 10px 12px;
          border-bottom: 1px solid var(--border);
        }
        .ord-table td { padding: 11px 12px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: middle; }
        .ord-table tr:last-child td { border-bottom: 0; }
        .ord-table tr:hover td { background: var(--surface2); }
        .ord-id { font-family: monospace; font-size: 12px; color: var(--muted); }
        .ord-buyer b { display: block; font-weight: 600; font-size: 13px; }
        .ord-buyer span { font-size: 11.5px; color: var(--muted); }
        .ord-amt { font-weight: 700; font-family: var(--font-sora, "Sora", sans-serif); }
        .ord-comm { font-size: 11.5px; color: var(--muted); }
        .ord-empty { text-align: center; padding: 40px; color: var(--muted); font-size: 13.5px; }
        .ord-summary {
          display: flex; gap: 16px; font-size: 12.5px; color: var(--muted);
          padding: 10px 0 4px; border-top: 1px solid var(--border); margin-top: 8px;
        }
        .ord-summary b { color: var(--text); }
      `}</style>

      <div className="ord-toolbar">
        <Link href="?filter=all" className={`dx-fchip${filter === "all" ? " on" : ""}`}>
          All ({orders.length})
        </Link>
        <Link href="?filter=paid" className={`dx-fchip${filter === "paid" ? " on" : ""}`}>
          Paid ({paid.length})
        </Link>
        <Link href="?filter=pending" className={`dx-fchip${filter === "pending" ? " on" : ""}`}>
          Pending ({pending.length})
        </Link>
        <form method="GET" action="" className="ord-search">
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search buyer, product, order ID…"
          />
          <input type="hidden" name="filter" value={filter} />
        </form>
      </div>

      <Card>
        {displayed.length === 0 ? (
          <div className="ord-empty">
            {orders.length === 0
              ? "No orders yet — share your pages to start selling."
              : "No orders match your search or filter."}
          </div>
        ) : (
          <>
            <table className="ord-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Buyer</th>
                  <th>Product</th>
                  <th>Gateway</th>
                  <th>Amount</th>
                  <th>Commission</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <span className="ord-id">#{o.id.slice(0, 8)}</span>
                    </td>
                    <td>
                      <div className="ord-buyer">
                        <b>{o.buyer_name || "Guest"}</b>
                        <span>{o.buyer_email ?? o.buyer_phone ?? "—"}</span>
                      </div>
                    </td>
                    <td>{o.product_title || "—"}</td>
                    <td style={{ textTransform: "capitalize" }}>
                      {o.gateway || "—"}
                    </td>
                    <td>
                      <span className="ord-amt">{inr(o.amount)}</span>
                    </td>
                    <td>
                      <span className="ord-comm">
                        {o.commission_amount ? inr(o.commission_amount) : "—"}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 12 }}>
                      {fmtDate(o.created_at)}
                    </td>
                    <td>
                      {o.status === "paid" ? (
                        <Tag kind="paid">Paid</Tag>
                      ) : (
                        <Tag kind="pend">{o.status}</Tag>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ord-summary">
              <span>
                Showing <b>{displayed.length}</b> of <b>{orders.length}</b> orders
              </span>
              {filter !== "all" || q ? null : (
                <>
                  <span>
                    Revenue: <b>{inr(totalRevenue)}</b>
                  </span>
                  <span>
                    Commission paid: <b>{inr(totalCommission)}</b>
                  </span>
                </>
              )}
            </div>
          </>
        )}
      </Card>
    </>
  );
}
