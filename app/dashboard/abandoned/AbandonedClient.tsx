"use client";

import { useState } from "react";
import Drawer from "@/components/dx/Drawer";

// ── Types ──────────────────────────────────────────────────────────────────

export type AbandonedOrder = {
  id: string;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  product_title: string | null;
  amount: number;
  status: string;
  created_at: string;
  gateway?: string | null;
};

type Props = {
  abandoned: AbandonedOrder[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

function inr(paise: number) {
  return "₹" + Math.round(paise / 100).toLocaleString("en-IN");
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Drawer ─────────────────────────────────────────────────────────────────

function AbandonedDrawer({
  order,
  onClose,
}: {
  order: AbandonedOrder | null;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={!!order}
      onClose={onClose}
      title={order ? `Abandoned: ${order.buyer_name || order.buyer_email || "Guest"}` : ""}
    >
      {order && (
        <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Buyer info */}
          <div
            style={{
              background: "var(--surface2)",
              borderRadius: 10,
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: ".05em",
                color: "var(--muted)",
                marginBottom: 2,
              }}
            >
              Buyer
            </div>
            {order.buyer_name && (
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "var(--muted)", minWidth: 60 }}>Name</span>
                <span style={{ fontWeight: 600 }}>{order.buyer_name}</span>
              </div>
            )}
            {order.buyer_email && (
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "var(--muted)", minWidth: 60 }}>Email</span>
                <span style={{ fontWeight: 600 }}>{order.buyer_email}</span>
              </div>
            )}
            {order.buyer_phone && (
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "var(--muted)", minWidth: 60 }}>Phone</span>
                <span style={{ fontWeight: 600 }}>{order.buyer_phone}</span>
              </div>
            )}
          </div>

          {/* Order details */}
          <div
            style={{
              background: "var(--surface2)",
              borderRadius: 10,
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: ".05em",
                color: "var(--muted)",
                marginBottom: 2,
              }}
            >
              Order
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "var(--muted)", minWidth: 60 }}>Product</span>
              <span style={{ fontWeight: 600 }}>{order.product_title || "—"}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "var(--muted)", minWidth: 60 }}>Amount</span>
              <span style={{ fontWeight: 700, color: "var(--primary)" }}>{inr(order.amount)}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "var(--muted)", minWidth: 60 }}>Started</span>
              <span>{fmtDateTime(order.created_at)}</span>
            </div>
            {order.gateway && (
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "var(--muted)", minWidth: 60 }}>Gateway</span>
                <span>{order.gateway}</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "var(--muted)", minWidth: 60 }}>Status</span>
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 9px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  background: "rgba(245,158,11,0.12)",
                  color: "#b45309",
                }}
              >
                {order.status}
              </span>
            </div>
          </div>

          {/* Recovery tip */}
          <div
            style={{
              background: "var(--surface2)",
              borderRadius: 9,
              padding: "10px 12px",
              fontSize: 12.5,
              color: "var(--muted)",
              lineHeight: 1.5,
            }}
          >
            To recover this sale, send a follow-up email to{" "}
            <strong>{order.buyer_email || "this buyer"}</strong>
            {order.buyer_phone ? ` or WhatsApp ${order.buyer_phone}` : ""}.
          </div>
        </div>
      )}
    </Drawer>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AbandonedClient({ abandoned }: Props) {
  const [selected, setSelected] = useState<AbandonedOrder | null>(null);

  if (abandoned.length === 0) {
    return (
      <div className="ab-empty">
        No abandoned checkouts — all started orders were completed.
      </div>
    );
  }

  return (
    <>
      <AbandonedDrawer order={selected} onClose={() => setSelected(null)} />
      <table className="ab-table">
        <thead>
          <tr>
            <th>Buyer</th>
            <th>Product</th>
            <th>Amount</th>
            <th>Started</th>
          </tr>
        </thead>
        <tbody>
          {abandoned.map((o) => (
            <tr
              key={o.id}
              style={{ cursor: "pointer" }}
              onClick={() => setSelected(o)}
            >
              <td>
                <b style={{ display: "block", fontWeight: 600 }}>
                  {o.buyer_name || "Guest"}
                </b>
                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  {o.buyer_email || o.buyer_phone || "—"}
                </span>
              </td>
              <td>{o.product_title || "—"}</td>
              <td style={{ fontWeight: 700 }}>{inr(o.amount)}</td>
              <td style={{ fontSize: 12, color: "var(--muted)" }}>
                {fmtDate(o.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
