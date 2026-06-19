"use client";

import { useState } from "react";
import Link from "next/link";
import Drawer from "@/components/dx/Drawer";
import { Tag, Live } from "@/components/dx/ui";

function inr(paise: number) {
  return "₹" + Math.round((paise ?? 0) / 100).toLocaleString("en-IN");
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export type AdminOrderRow = {
  id: string;
  buyer_name: string | null;
  buyer_email: string | null;
  product_title: string | null;
  page_type: string | null;
  amount: number;
  commission_amount: number | null;
  status: string;
  gateway_payment_id: string | null;
  coupon_code: string | null;
  store_id: string;
  created_at: string;
};

function statusTag(s: string) {
  if (s === "paid") return <Live>Paid</Live>;
  if (s === "refunded") return <Tag kind="neu">Refunded</Tag>;
  if (s === "failed") return <Tag kind="pend">Failed</Tag>;
  return <Tag kind="pend">Pending</Tag>;
}

function DrawerField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        padding: "9px 0",
        borderBottom: "1px solid var(--border)",
        alignItems: "flex-start",
      }}
    >
      <span style={{ color: "var(--muted)", fontSize: 13, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, textAlign: "right", wordBreak: "break-all" }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: "var(--muted)",
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

export default function AdminOrdersTable({
  orders,
  storeMap,
  totalCount,
  page,
  pageSize,
  status,
  q,
}: {
  orders: AdminOrderRow[];
  storeMap: Record<string, { store_name: string | null; subdomain: string | null }>;
  totalCount: number;
  page: number;
  pageSize: number;
  status: string;
  q: string;
}) {
  const [selected, setSelected] = useState<AdminOrderRow | null>(null);

  const offset = (page - 1) * pageSize;
  const showing = offset + orders.length;
  const hasPrev = page > 1;
  const hasNext = showing < totalCount;

  function storeLabel(id: string) {
    const s = storeMap[id];
    return s ? s.store_name || (s.subdomain ? `${s.subdomain}.invoxai.io` : "—") : "—";
  }

  function pageLink(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status !== "all") params.set("status", status);
    params.set("page", String(p));
    return `/admin/orders?${params.toString()}`;
  }

  return (
    <>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Buyer", "Store", "Product", "Amount", "Status", "Date", ""].map((col) => (
              <th
                key={col}
                style={{
                  textAlign: "left",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: ".04em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  padding: "10px 12px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr
              key={o.id}
              onClick={() => setSelected(o)}
              style={{ cursor: "pointer" }}
            >
              <td style={{ padding: "11px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, verticalAlign: "middle" }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{o.buyer_name || o.buyer_email || "—"}</div>
                <div style={{ color: "var(--muted)", fontSize: 11.5 }}>{o.buyer_email || "—"}</div>
              </td>
              <td style={{ padding: "11px 12px", borderBottom: "1px solid var(--border)", fontSize: 12.5, verticalAlign: "middle" }}>
                {storeLabel(o.store_id)}
              </td>
              <td style={{ padding: "11px 12px", borderBottom: "1px solid var(--border)", fontSize: 12.5, verticalAlign: "middle" }}>
                {o.product_title || "—"}
                <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>{o.page_type}</span>
              </td>
              <td style={{ padding: "11px 12px", borderBottom: "1px solid var(--border)", fontWeight: 700, verticalAlign: "middle" }}>
                {inr(o.amount)}
              </td>
              <td style={{ padding: "11px 12px", borderBottom: "1px solid var(--border)", verticalAlign: "middle" }}>
                {statusTag(o.status)}
              </td>
              <td style={{ padding: "11px 12px", borderBottom: "1px solid var(--border)", color: "var(--muted)", fontSize: 12, verticalAlign: "middle", whiteSpace: "nowrap" }}>
                {fmtDate(o.created_at)}
              </td>
              <td
                style={{ padding: "11px 12px", borderBottom: "1px solid var(--border)", verticalAlign: "middle" }}
                onClick={(e) => e.stopPropagation()}
              >
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="dx-editbtn"
                  style={{ textDecoration: "none" }}
                >
                  Detail
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {orders.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 13.5 }}>
          {q || status !== "all" ? "No orders match this filter." : "No orders yet."}
        </div>
      )}

      {totalCount > 0 && (
        <div
          style={{
            display: "flex",
            gap: 16,
            fontSize: 12.5,
            color: "var(--muted)",
            padding: "10px 12px 4px",
            borderTop: "1px solid var(--border)",
            marginTop: 8,
            alignItems: "center",
          }}
        >
          <span>
            Showing <b style={{ color: "var(--text)" }}>{offset + 1}–{Math.min(showing, totalCount)}</b> of{" "}
            <b style={{ color: "var(--text)" }}>{totalCount}</b> orders
          </span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {hasPrev && (
              <a href={pageLink(page - 1)} className="btn ghost" style={{ fontSize: 12, padding: "4px 10px", textDecoration: "none" }}>
                ← Prev
              </a>
            )}
            {hasNext && (
              <a href={pageLink(page + 1)} className="btn ghost" style={{ fontSize: 12, padding: "4px 10px", textDecoration: "none" }}>
                Next →
              </a>
            )}
          </span>
        </div>
      )}

      {selected && (
        <Drawer
          open={!!selected}
          onClose={() => setSelected(null)}
          title={`Order #${selected.id.slice(0, 8)}`}
          footer={
            <Link
              href={`/admin/orders/${selected.id}`}
              className="btn"
              style={{ width: "100%", textAlign: "center", textDecoration: "none", display: "block", padding: "10px 0" }}
            >
              Refund / Full detail →
            </Link>
          }
        >
          <DrawerSection title="Buyer">
            <DrawerField label="Name" value={selected.buyer_name || "—"} />
            <DrawerField label="Email" value={selected.buyer_email} />
          </DrawerSection>

          <DrawerSection title="Order">
            <DrawerField label="Product" value={selected.product_title} />
            <DrawerField label="Type" value={selected.page_type} />
            <DrawerField
              label="Amount"
              value={<span style={{ fontWeight: 700 }}>{inr(selected.amount)}</span>}
            />
            <DrawerField
              label="Commission"
              value={selected.commission_amount != null ? inr(selected.commission_amount) : "—"}
            />
            <DrawerField label="Coupon" value={selected.coupon_code} />
            <DrawerField label="Status" value={statusTag(selected.status)} />
          </DrawerSection>

          <DrawerSection title="Payment">
            <DrawerField label="Payment ID" value={selected.gateway_payment_id} />
          </DrawerSection>

          <DrawerSection title="Store">
            <DrawerField label="Store" value={storeLabel(selected.store_id)} />
          </DrawerSection>

          <DrawerSection title="Timestamps">
            <DrawerField label="Created" value={fmtDateTime(selected.created_at)} />
          </DrawerSection>

          <DrawerSection title="Reference">
            <DrawerField
              label="Order ID"
              value={
                <span style={{ fontFamily: "monospace", fontSize: 11.5 }}>{selected.id}</span>
              }
            />
          </DrawerSection>
        </Drawer>
      )}
    </>
  );
}
