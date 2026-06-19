import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Phead, Kpis, Card } from "@/components/dx/ui";
import ExportButton from "@/components/dx/ExportButton";
import AdminOrdersTable from "./OrdersTable";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const inr = (paise: number) => "₹" + Math.round((paise ?? 0) / 100).toLocaleString("en-IN");
const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "paid", label: "Paid" },
  { key: "created", label: "Pending" },
  { key: "failed", label: "Failed" },
  { key: "refunded", label: "Refunded" },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q = "", status = "all", page: pageParam = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageParam, 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const sb = createAdminClient();

  let query = sb
    .from("orders")
    .select(
      "id, buyer_name, buyer_email, product_title, page_type, amount, commission_amount, status, gateway_payment_id, coupon_code, store_id, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (status !== "all") query = query.eq("status", status);
  const term = q.trim();
  if (term) {
    const safe = term.replace(/[%,]/g, " ");
    query = query.or(
      `buyer_email.ilike.%${safe}%,buyer_name.ilike.%${safe}%,product_title.ilike.%${safe}%`
    );
  }

  const { data: orders, count } = await query.range(offset, offset + PAGE_SIZE - 1);
  const list = (orders ?? []) as import("./OrdersTable").AdminOrderRow[];
  const totalCount = count ?? 0;

  // Store names for the listed orders
  const storeIds = [...new Set(list.map((o) => o.store_id).filter(Boolean))] as string[];
  const { data: storeRows } =
    storeIds.length > 0
      ? await sb.from("stores").select("id, store_name, subdomain").in("id", storeIds)
      : { data: [] };
  const storeMap = Object.fromEntries((storeRows ?? []).map((s) => [s.id, s]));
  const storeLabel = (id: string) => {
    const s = storeMap[id];
    return s ? s.store_name || (s.subdomain ? `${s.subdomain}.invoxai.io` : "—") : "—";
  };

  // KPIs over the page slice (visible rows)
  const paidList = list.filter((o) => o.status === "paid");
  const gmv = paidList.reduce((s, o) => s + (o.amount ?? 0), 0);
  const commission = paidList.reduce((s, o) => s + (o.commission_amount ?? 0), 0);
  const refundedCount = list.filter((o) => o.status === "refunded").length;

  const exportRows = list.map((o) => [
    o.id,
    fmt(o.created_at),
    o.buyer_name || "",
    o.buyer_email || "",
    storeLabel(o.store_id),
    o.product_title || "",
    o.page_type || "",
    Math.round((o.amount ?? 0) / 100),
    o.status,
    o.gateway_payment_id || "",
  ] as (string | number | null)[]);

  const qs = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    if (term) p.set("q", term);
    if (status !== "all") p.set("status", status);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <>
      <Phead
        title="Orders"
        sub="Every transaction across the platform — search, filter, inspect, refund."
        action={
          <ExportButton
            headers={["Order ID", "Date", "Buyer", "Email", "Store", "Product", "Type", "Amount (₹)", "Status", "Payment ID"]}
            rows={exportRows}
            filename="invoxai-orders.csv"
          />
        }
      />

      <Kpis
        items={[
          { icon: "bag", color: "var(--primary)", label: "Orders (page)", value: String(list.length) },
          { icon: "rupee", color: "var(--secondary)", label: "GMV (paid)", value: gmv > 0 ? inr(gmv) : "₹0" },
          { icon: "chart", color: "var(--accent)", label: "Commission", value: commission > 0 ? inr(commission) : "₹0" },
          { icon: "shield", color: "var(--gold)", label: "Refunded", value: String(refundedCount) },
        ]}
      />

      <div className="dx-toolbar" style={{ marginBottom: 12, gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {STATUS_TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/orders${qs({ status: t.key === "all" ? "" : t.key, page: "1" })}`}
            className={`dx-fchip${status === t.key ? " on" : ""}`}
            style={{ textDecoration: "none" }}
          >
            {t.label}
          </Link>
        ))}
        <form action="/admin/orders" method="get" style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <input type="hidden" name="page" value="1" />
          <input
            name="q"
            defaultValue={term}
            placeholder="Search buyer, email, product…"
            className="input"
            style={{ minWidth: 240 }}
          />
          <button className="btn ghost" type="submit">Search</button>
        </form>
      </div>

      <Card>
        <AdminOrdersTable
          orders={list}
          storeMap={storeMap}
          totalCount={totalCount}
          page={page}
          pageSize={PAGE_SIZE}
          status={status}
          q={term}
        />
      </Card>

      <p className="dx-muted" style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.5 }}>
        Showing {PAGE_SIZE}/page · {totalCount} total for this filter. Click a row to inspect; use &quot;Refund / Full detail&quot; in the drawer to issue a refund.
      </p>
    </>
  );
}
