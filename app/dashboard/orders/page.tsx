import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card } from "@/components/dx/ui";
import OrdersTable from "./OrdersTable";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function inr(paise: number) {
  return "₹" + Math.round(paise / 100).toLocaleString("en-IN");
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const filter = sp.filter ?? "all";
  const q = (sp.q ?? "").trim().toLowerCase();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  // KPI counts: fetch lightweight status+amount for all store orders (no pagination, for accurate KPIs)
  const { data: kpiRows } = await sb
    .from("orders")
    .select("amount, commission_amount, status")
    .eq("store_id", store.id);

  const allOrders = kpiRows ?? [];
  const paidAll = allOrders.filter((o) => o.status === "paid");
  const pendingAll = allOrders.filter((o) => o.status !== "paid");
  const totalRevenue = paidAll.reduce((s, o) => s + (o.amount ?? 0), 0);
  const convRate = allOrders.length
    ? `${((paidAll.length / allOrders.length) * 100).toFixed(1)}%`
    : "0%";
  const avgOrder = paidAll.length ? Math.round(totalRevenue / paidAll.length) : 0;

  // Build paginated query with filter + search applied server-side
  let query = sb
    .from("orders")
    .select(
      "id, buyer_name, buyer_email, buyer_phone, product_title, product_id, page_id, amount, gateway, gateway_payment_id, status, created_at, paid_at, commission_amount",
      { count: "exact" }
    )
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });

  if (filter === "paid") query = query.eq("status", "paid");
  else if (filter === "pending") query = query.neq("status", "paid");

  if (q) {
    const safe = q.replace(/[%,]/g, " ");
    query = query.or(
      `buyer_name.ilike.%${safe}%,buyer_email.ilike.%${safe}%,product_title.ilike.%${safe}%,id.ilike.%${safe}%`
    );
  }

  const { data: rows, count } = await query.range(offset, offset + PAGE_SIZE - 1);

  const orders = (rows ?? []) as import("./OrdersTable").OrderRow[];
  const totalCount = count ?? 0;

  return (
    <>
      <Phead
        title="Orders"
        sub={`${allOrders.length} orders · ${paidAll.length} paid`}
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
            value: allOrders.length.toLocaleString("en-IN"),
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
          align-items: center;
        }
        .ord-summary b { color: var(--text); }
      `}</style>

      <div className="ord-toolbar">
        <Link href="?filter=all&page=1" className={`dx-fchip${filter === "all" ? " on" : ""}`}>
          All ({allOrders.length})
        </Link>
        <Link href="?filter=paid&page=1" className={`dx-fchip${filter === "paid" ? " on" : ""}`}>
          Paid ({paidAll.length})
        </Link>
        <Link href="?filter=pending&page=1" className={`dx-fchip${filter === "pending" ? " on" : ""}`}>
          Pending ({pendingAll.length})
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
          <input type="hidden" name="page" value="1" />
        </form>
      </div>

      <Card>
        {allOrders.length === 0 ? (
          <div className="ord-empty">
            No orders yet — share your pages to start selling.
          </div>
        ) : (
          <OrdersTable
            orders={orders}
            totalCount={totalCount}
            page={page}
            pageSize={PAGE_SIZE}
            filter={filter}
            q={sp.q ?? ""}
          />
        )}
      </Card>
    </>
  );
}
