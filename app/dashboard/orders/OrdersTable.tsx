"use client";

import { useState } from "react";
import Drawer from "@/components/dx/Drawer";
import { Tag } from "@/components/dx/ui";

function inr(paise: number) {
  return "₹" + Math.round(paise / 100).toLocaleString("en-IN");
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
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

export type OrderRow = {
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
  /** Invoice row id from public.invoices (kind="order") — null if no invoice exists yet. */
  invoice_id: string | null;
};

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

export default function OrdersTable({
  orders,
  totalCount,
  page,
  pageSize,
  filter,
  q,
}: {
  orders: OrderRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  filter: string;
  q: string;
}) {
  const [selected, setSelected] = useState<OrderRow | null>(null);

  const offset = (page - 1) * pageSize;
  const showing = Math.min(offset + orders.length, totalCount);
  const hasPrev = page > 1;
  const hasNext = showing < totalCount;

  function pageLink(p: number) {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("filter", filter);
    if (q) params.set("q", q);
    params.set("page", String(p));
    return `?${params.toString()}`;
  }

  return (
    <>
      {orders.length === 0 ? (
        <div className="ord-empty">No orders match your search or filter.</div>
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
                <th>Invoice</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => setSelected(o)}
                  style={{ cursor: "pointer" }}
                >
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
                  <td style={{ textTransform: "capitalize" }}>{o.gateway || "—"}</td>
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
                      <Tag kind="pend">
                        {o.status === "created"
                          ? "Pending"
                          : o.status === "failed"
                          ? "Failed"
                          : o.status}
                      </Tag>
                    )}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {o.invoice_id ? (
                      <a
                        href={`/api/invoices/${o.invoice_id}/pdf`}
                        download
                        title="Download customer invoice PDF"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "3px 9px",
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: "#7b3fe4",
                          border: "1px solid #c4a8f0",
                          borderRadius: 6,
                          textDecoration: "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        PDF
                      </a>
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 11.5 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ord-summary">
            <span>
              Showing <b>{offset + 1}–{showing}</b> of <b>{totalCount}</b> orders
            </span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {hasPrev && (
                <a href={pageLink(page - 1)} className="btn ghost" style={{ fontSize: 12, padding: "4px 10px" }}>
                  ← Prev
                </a>
              )}
              {hasNext && (
                <a href={pageLink(page + 1)} className="btn ghost" style={{ fontSize: 12, padding: "4px 10px" }}>
                  Next →
                </a>
              )}
            </span>
          </div>
        </>
      )}

      {selected && (
        <Drawer
          open={!!selected}
          onClose={() => setSelected(null)}
          title={`Order #${selected.id.slice(0, 8)}`}
        >
          <DrawerSection title="Buyer">
            <DrawerField label="Name" value={selected.buyer_name || "Guest"} />
            <DrawerField label="Email" value={selected.buyer_email} />
            <DrawerField label="Phone" value={selected.buyer_phone} />
          </DrawerSection>

          <DrawerSection title="Order">
            <DrawerField label="Product" value={selected.product_title} />
            <DrawerField
              label="Amount"
              value={<span style={{ fontWeight: 700 }}>{inr(selected.amount)}</span>}
            />
            <DrawerField
              label="Commission"
              value={selected.commission_amount ? inr(selected.commission_amount) : "—"}
            />
            <DrawerField
              label="Status"
              value={
                selected.status === "paid" ? (
                  <Tag kind="paid">Paid</Tag>
                ) : (
                  <Tag kind="pend">
                    {selected.status === "created"
                      ? "Pending"
                      : selected.status === "failed"
                      ? "Failed"
                      : selected.status}
                  </Tag>
                )
              }
            />
          </DrawerSection>

          <DrawerSection title="Payment">
            <DrawerField
              label="Gateway"
              value={
                selected.gateway ? (
                  <span style={{ textTransform: "capitalize" }}>{selected.gateway}</span>
                ) : null
              }
            />
            <DrawerField label="Payment ID" value={selected.gateway_payment_id} />
            {selected.invoice_id && (
              <DrawerField
                label="Billing PDF"
                value={
                  <a
                    href={`/api/invoices/${selected.invoice_id}/pdf`}
                    download
                    style={{
                      display: "inline-block",
                      padding: "4px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#7b3fe4",
                      border: "1px solid #c4a8f0",
                      borderRadius: 6,
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Download invoice PDF
                  </a>
                }
              />
            )}
          </DrawerSection>

          <DrawerSection title="Timestamps">
            <DrawerField label="Created" value={fmtDateTime(selected.created_at)} />
            <DrawerField label="Paid at" value={fmtDateTime(selected.paid_at)} />
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
