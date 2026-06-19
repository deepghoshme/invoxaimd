import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Phead, Kpis, Card, Table, Tag, Live } from "@/components/dx/ui";
import ExportButton from "@/components/dx/ExportButton";

export const dynamic = "force-dynamic";

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

function statusTag(s: string) {
  if (s === "paid") return <Live>Paid</Live>;
  if (s === "refunded") return <Tag kind="neu">Refunded</Tag>;
  if (s === "failed") return <Tag kind="pend">Failed</Tag>;
  return <Tag kind="pend">Pending</Tag>;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status = "all" } = await searchParams;
  const sb = createAdminClient();

  let query = sb
    .from("orders")
    .select(
      "id, buyer_name, buyer_email, product_title, page_type, amount, commission_amount, status, gateway_payment_id, coupon_code, store_id, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (status !== "all") query = query.eq("status", status);
  const term = q.trim();
  if (term) {
    const safe = term.replace(/[%,]/g, " ");
    query = query.or(
      `buyer_email.ilike.%${safe}%,buyer_name.ilike.%${safe}%,product_title.ilike.%${safe}%`,
    );
  }

  const { data: orders } = await query;
  const list = orders ?? [];

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

  // KPIs (over the current filtered/searched view)
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

  const rows = list.map((o) => [
    <span className="dx-tg" key="buyer">
      <span>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{o.buyer_name || o.buyer_email || "—"}</div>
        <div style={{ color: "var(--muted)", fontSize: 11.5 }}>{o.buyer_email || "—"}</div>
      </span>
    </span>,
    <span key="store" style={{ fontSize: 12.5 }}>{storeLabel(o.store_id)}</span>,
    <span key="prod" style={{ fontSize: 12.5 }}>
      {o.product_title || "—"}
      <span className="dx-muted" style={{ display: "block", fontSize: 11 }}>{o.page_type}</span>
    </span>,
    <span key="amt" style={{ fontWeight: 700 }}>{inr(o.amount)}</span>,
    statusTag(o.status),
    <span key="date" style={{ color: "var(--muted)", fontSize: 12 }}>{fmt(o.created_at)}</span>,
    <Link key="act" href={`/admin/orders/${o.id}`} className="dx-editbtn" style={{ textDecoration: "none" }}>
      Detail
    </Link>,
  ]);

  const qs = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    if (term) p.set("q", term);
    if (status !== "all") p.set("status", status);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v); else p.delete(k);
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
          { icon: "bag", color: "var(--primary)", label: "Orders (shown)", value: String(list.length) },
          { icon: "rupee", color: "var(--secondary)", label: "GMV (paid)", value: gmv > 0 ? inr(gmv) : "₹0" },
          { icon: "chart", color: "var(--accent)", label: "Commission", value: commission > 0 ? inr(commission) : "₹0" },
          { icon: "shield", color: "var(--gold)", label: "Refunded", value: String(refundedCount) },
        ]}
      />

      <div className="dx-toolbar" style={{ marginBottom: 12, gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {STATUS_TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/orders${qs({ status: t.key === "all" ? "" : t.key })}`}
            className={`dx-fchip${status === t.key ? " on" : ""}`}
            style={{ textDecoration: "none" }}
          >
            {t.label}
          </Link>
        ))}
        <form action="/admin/orders" method="get" style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {status !== "all" && <input type="hidden" name="status" value={status} />}
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
        <Table
          cols={["Buyer", "Store", "Product", "Amount", "Status", "Date", ""]}
          rows={rows}
          empty={term || status !== "all" ? "No orders match this filter." : "No orders yet."}
        />
      </Card>

      <p className="dx-muted" style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.5 }}>
        Showing up to 500 most-recent orders for the current filter. GMV and commission are summed over
        paid orders in the shown set. Click &quot;Detail&quot; to inspect an order and issue a refund.
      </p>
    </>
  );
}
