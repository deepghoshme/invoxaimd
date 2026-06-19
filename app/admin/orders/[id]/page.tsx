import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Phead, Card, Tag, Live } from "@/components/dx/ui";
import RefundForm from "./RefundForm";

export const dynamic = "force-dynamic";

const inr = (paise: number) => "₹" + Math.round((paise ?? 0) / 100).toLocaleString("en-IN");
const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "9px 0", borderBottom: "1px solid var(--dx-border, #efe9e3)" }}>
      <span style={{ color: "var(--muted)", fontSize: 13 }}>{k}</span>
      <span style={{ fontSize: 13, fontWeight: 600, textAlign: "right", wordBreak: "break-word" }}>{v}</span>
    </div>
  );
}

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = createAdminClient();

  const { data: o } = await sb.from("orders").select("*").eq("id", id).maybeSingle();
  if (!o) notFound();

  const { data: store } = o.store_id
    ? await sb.from("stores").select("id, store_name, subdomain").eq("id", o.store_id).maybeSingle()
    : { data: null };
  const storeLabel = store ? store.store_name || (store.subdomain ? `${store.subdomain}.invoxai.io` : "—") : "—";

  const statusTag =
    o.status === "paid" ? <Live>Paid</Live>
    : o.status === "refunded" ? <Tag kind="neu">Refunded</Tag>
    : o.status === "failed" ? <Tag kind="pend">Failed</Tag>
    : <Tag kind="pend">Pending</Tag>;

  const discount = (o.discount_paise as number | null) ?? 0;

  return (
    <>
      <Phead
        title="Order detail"
        sub={`Order ${String(o.id).slice(0, 8)}… · ${fmt(o.created_at)}`}
        action={
          <Link href="/admin/orders" className="btn ghost" style={{ textDecoration: "none" }}>
            ← Back to orders
          </Link>
        }
      />

      <div className="dx-grid dx-cols" style={{ alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Order">
            <Row k="Status" v={statusTag} />
            <Row k="Product" v={o.product_title || "—"} />
            <Row k="Type" v={o.page_type || "—"} />
            <Row k="Amount" v={inr(o.amount)} />
            {discount > 0 && <Row k="Discount" v={`− ${inr(discount)}`} />}
            {o.coupon_code && <Row k="Coupon" v={o.coupon_code} />}
            <Row k="Commission" v={o.commission_amount != null ? inr(o.commission_amount) : "—"} />
            <Row k="Created" v={fmt(o.created_at)} />
            <Row k="Paid at" v={fmt(o.paid_at)} />
            {o.status === "refunded" && <Row k="Refunded at" v={fmt(o.refunded_at)} />}
            {o.refund_reason && <Row k="Refund reason" v={o.refund_reason} />}
          </Card>

          <Card title="Payment">
            <Row k="Gateway order ID" v={o.gateway_order_id || "—"} />
            <Row k="Gateway payment ID" v={o.gateway_payment_id || "—"} />
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Buyer">
            <Row k="Name" v={o.buyer_name || "—"} />
            <Row k="Email" v={o.buyer_email || "—"} />
            <Row k="Phone" v={o.buyer_phone || "—"} />
          </Card>

          <Card title="Store">
            <Row k="Store" v={store ? <Link href={`/admin/sellers/${store.id}`} style={{ color: "var(--primary)" }}>{storeLabel}</Link> : "—"} />
          </Card>

          <Card title="Refund">
            {o.status === "paid" ? (
              <RefundForm orderId={String(o.id)} />
            ) : o.status === "refunded" ? (
              <p className="dx-muted" style={{ fontSize: 13 }}>This order has been refunded.</p>
            ) : (
              <p className="dx-muted" style={{ fontSize: 13 }}>Only paid orders can be refunded.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
