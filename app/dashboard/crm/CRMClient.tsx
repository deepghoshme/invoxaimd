"use client";

import { useState } from "react";
import Drawer from "@/components/dx/Drawer";
import { Tag } from "@/components/dx/ui";

// ── Types ──────────────────────────────────────────────────────────────────

export type Customer = {
  email: string;
  name: string;
  phone: string | null;
  orders: number;
  paid: number;
  spent: number;
  lastOrderAt: string;
  orderList: OrderSummary[];
};

export type OrderSummary = {
  id: string;
  product_title: string | null;
  amount: number;
  status: string;
  created_at: string;
};

export type CheckoutLead = {
  email: string;
  name: string;
  phone: string | null;
  orders: number;
  lastOrderAt: string;
};

export type FormLead = {
  id: string;
  kind: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  created_at: string;
};

type Props = {
  tab: string;
  customers: Customer[];
  checkoutLeads: CheckoutLead[];
  formLeads: FormLead[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

function inr(paise: number) {
  return "₹" + Math.round(paise / 100).toLocaleString("en-IN");
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}

// ── Customer Drawer ────────────────────────────────────────────────────────

function CustomerDrawer({
  customer,
  onClose,
}: {
  customer: Customer | null;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={!!customer}
      onClose={onClose}
      title={customer ? customer.name : "Customer"}
    >
      {customer && (
        <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Contact info */}
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
            {customer.email && (
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "var(--muted)", minWidth: 60 }}>Email</span>
                <span style={{ fontWeight: 600 }}>{customer.email}</span>
              </div>
            )}
            {customer.phone && (
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "var(--muted)", minWidth: 60 }}>Phone</span>
                <span style={{ fontWeight: 600 }}>{customer.phone}</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "var(--muted)", minWidth: 60 }}>Last seen</span>
              <span>{fmtDate(customer.lastOrderAt)}</span>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { label: "Orders", value: String(customer.paid) },
              { label: "Total spent", value: inr(customer.spent) },
              { label: "Attempts", value: String(customer.orders) },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: "var(--surface2)",
                  borderRadius: 9,
                  padding: "10px 12px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Order list */}
          {customer.orderList.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                  color: "var(--muted)",
                  marginBottom: 8,
                }}
              >
                Orders
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {customer.orderList.map((o) => (
                  <div
                    key={o.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 12px",
                      background: "var(--surface2)",
                      borderRadius: 9,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {o.product_title || "Order"}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                        {fmtDate(o.created_at)}
                      </div>
                    </div>
                    <span style={{ fontWeight: 700, flexShrink: 0 }}>{inr(o.amount)}</span>
                    <Tag kind={o.status === "paid" ? "paid" : "pend"}>
                      {o.status}
                    </Tag>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

// ── Lead Drawer (checkout leads) ───────────────────────────────────────────

function LeadDrawer({
  lead,
  onClose,
}: {
  lead: CheckoutLead | null;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={!!lead}
      onClose={onClose}
      title={lead ? lead.name : "Lead"}
    >
      {lead && (
        <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 16 }}>
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
            {lead.email && (
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "var(--muted)", minWidth: 60 }}>Email</span>
                <span style={{ fontWeight: 600 }}>{lead.email}</span>
              </div>
            )}
            {lead.phone && (
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "var(--muted)", minWidth: 60 }}>Phone</span>
                <span style={{ fontWeight: 600 }}>{lead.phone}</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "var(--muted)", minWidth: 60 }}>Last seen</span>
              <span>{fmtDate(lead.lastOrderAt)}</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "Attempts", value: String(lead.orders) },
              { label: "Paid orders", value: "0" },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: "var(--surface2)",
                  borderRadius: 9,
                  padding: "10px 12px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div
            style={{
              background: "var(--surface2)",
              borderRadius: 9,
              padding: "10px 12px",
              fontSize: 12.5,
              color: "var(--muted)",
            }}
          >
            This contact started checkout but did not complete payment. Follow up via email or WhatsApp.
          </div>
        </div>
      )}
    </Drawer>
  );
}

// ── FormLead Drawer ────────────────────────────────────────────────────────

function FormLeadDrawer({
  lead,
  onClose,
}: {
  lead: FormLead | null;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={!!lead}
      onClose={onClose}
      title={lead ? (lead.name || lead.email || "Form submission") : ""}
    >
      {lead && (
        <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 14 }}>
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
            {lead.name && (
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "var(--muted)", minWidth: 60 }}>Name</span>
                <span style={{ fontWeight: 600 }}>{lead.name}</span>
              </div>
            )}
            {lead.email && (
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "var(--muted)", minWidth: 60 }}>Email</span>
                <span style={{ fontWeight: 600 }}>{lead.email}</span>
              </div>
            )}
            {lead.phone && (
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "var(--muted)", minWidth: 60 }}>Phone</span>
                <span style={{ fontWeight: 600 }}>{lead.phone}</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "var(--muted)", minWidth: 60 }}>Date</span>
              <span>{fmtDate(lead.created_at)}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "var(--muted)", minWidth: 60 }}>Type</span>
              <Tag kind={lead.kind === "newsletter" ? "paid" : "pend"}>
                {lead.kind === "newsletter" ? "Newsletter" : "Contact"}
              </Tag>
            </div>
          </div>
          {lead.message && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                  color: "var(--muted)",
                  marginBottom: 6,
                }}
              >
                Message
              </div>
              <div
                style={{
                  background: "var(--surface2)",
                  borderRadius: 9,
                  padding: "10px 12px",
                  fontSize: 13,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              >
                {lead.message}
              </div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

// ── Main client component ──────────────────────────────────────────────────

export default function CRMClient({ tab, customers, checkoutLeads, formLeads }: Props) {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedLead, setSelectedLead] = useState<CheckoutLead | null>(null);
  const [selectedFormLead, setSelectedFormLead] = useState<FormLead | null>(null);

  return (
    <>
      {/* Drawers */}
      <CustomerDrawer customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      <LeadDrawer lead={selectedLead} onClose={() => setSelectedLead(null)} />
      <FormLeadDrawer lead={selectedFormLead} onClose={() => setSelectedFormLead(null)} />

      {tab === "customers" && (
        <>
          {customers.length === 0 ? (
            <div className="crm-empty">No paying customers match your search.</div>
          ) : (
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Orders</th>
                  <th>Total spent</th>
                  <th>Last order</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.email}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedCustomer(c)}
                  >
                    <td>
                      <div className="crm-person">
                        <b>{c.name}</b>
                        {c.paid >= 2 && (
                          <span style={{ color: "var(--green)", fontWeight: 700 }}> Repeat</span>
                        )}
                      </div>
                    </td>
                    <td>{c.email || "—"}</td>
                    <td>{c.phone || "—"}</td>
                    <td style={{ fontWeight: 600 }}>{c.paid}</td>
                    <td>
                      <span className="crm-amt">{inr(c.spent)}</span>
                    </td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>
                      {fmtDate(c.lastOrderAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {tab === "checkout-leads" && (
        <>
          {checkoutLeads.length === 0 ? (
            <div className="crm-empty">No checkout leads match your search.</div>
          ) : (
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Attempts</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {checkoutLeads.map((c) => (
                  <tr
                    key={c.email || c.phone}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedLead(c)}
                  >
                    <td>
                      <div className="crm-person">
                        <b>{c.name}</b>
                      </div>
                    </td>
                    <td>{c.email || "—"}</td>
                    <td>{c.phone || "—"}</td>
                    <td>{c.orders}</td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>
                      {fmtDate(c.lastOrderAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {tab === "form-leads" && (
        <>
          {formLeads.length === 0 ? (
            <div className="crm-empty">No form leads match your search.</div>
          ) : (
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email / Phone</th>
                  <th>Type</th>
                  <th>Message</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {formLeads.map((l) => (
                  <tr
                    key={l.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedFormLead(l)}
                  >
                    <td>
                      <div className="crm-person">
                        <b>{l.name || "—"}</b>
                      </div>
                    </td>
                    <td>{l.email || l.phone || "—"}</td>
                    <td>
                      <Tag kind={l.kind === "newsletter" ? "paid" : "pend"}>
                        {l.kind === "newsletter" ? "Newsletter" : "Contact"}
                      </Tag>
                    </td>
                    <td
                      style={{
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: "var(--muted)",
                        fontSize: 12,
                      }}
                    >
                      {l.message || "—"}
                    </td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>
                      {fmtDate(l.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </>
  );
}
