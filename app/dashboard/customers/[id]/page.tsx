import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireDashboardStore } from "@/lib/auth";
import CustomerList, { type CustomerListItem } from "./CustomerList";
import CustomerNotes, { type NoteRow } from "./CustomerNotes";

export const dynamic = "force-dynamic";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Paise → ₹ string (e.g. 149900 → "₹1,499") */
function inr(paise: number): string {
  return "₹" + Math.round(paise / 100).toLocaleString("en-IN");
}

/** Short date from ISO string → "18 Jun 2026" */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Short month+year → "Jun 2026" */
function fmtMonthYear(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

/** Initial letter for avatar — handles empty gracefully */
function initial(name: string | null | undefined, email: string | null | undefined): string {
  const src = (name || email || "?").trim();
  return src[0].toUpperCase();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderRow {
  id: string;
  product_title: string | null;
  amount: number;
  currency: string;
  status: string;
  page_type: string;
  created_at: string;
  paid_at: string | null;
}

interface CustomerSummary {
  email: string;
  name: string;
  phone: string | null;
  lifetimePaise: number;
  orderCount: number;
  firstSeen: string; // ISO
  orders: OrderRow[];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { store } = await requireDashboardStore();
  const supabase = createAdminClient();

  // ── Fetch all orders for this store (to build the customer list + detail) ───
  // Single query; we group in JS. The store is resolved via getCurrentStore()
  // which verifies admin status when impersonating.
  const { data: allOrders } = await supabase
    .from("orders")
    .select(
      "id, buyer_email, buyer_name, buyer_phone, product_title, amount, currency, status, page_type, created_at, paid_at",
    )
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });

  const rows = allOrders ?? [];

  // ── Group orders by buyer_email → build customer map ──────────────────────
  const customerMap = new Map<string, CustomerSummary>();

  for (const o of rows) {
    const email = (o.buyer_email ?? "").trim().toLowerCase();
    if (!email) continue; // skip orders with no email

    if (!customerMap.has(email)) {
      customerMap.set(email, {
        email,
        name: o.buyer_name || email,
        phone: o.buyer_phone ?? null,
        lifetimePaise: 0,
        orderCount: 0,
        firstSeen: o.created_at,
        orders: [],
      });
    }

    const cust = customerMap.get(email)!;
    cust.orderCount += 1;
    if (o.status === "paid") {
      cust.lifetimePaise += o.amount ?? 0;
    }
    // Update name/phone with latest non-null value
    if (o.buyer_name && !cust.name) cust.name = o.buyer_name;
    if (o.buyer_phone && !cust.phone) cust.phone = o.buyer_phone;
    // Track earliest order
    if (new Date(o.created_at) < new Date(cust.firstSeen)) {
      cust.firstSeen = o.created_at;
    }
    cust.orders.push({
      id: o.id,
      product_title: o.product_title,
      amount: o.amount,
      currency: o.currency,
      status: o.status,
      page_type: o.page_type,
      created_at: o.created_at,
      paid_at: o.paid_at,
    });
  }

  // Sort customers by lifetime spend desc for the list
  const allCustomers = Array.from(customerMap.values()).sort(
    (a, b) => b.lifetimePaise - a.lifetimePaise,
  );

  // ── Resolve selected customer from [id] param ─────────────────────────────
  // ID scheme: encodeURIComponent(buyer_email.toLowerCase())
  // Decode incoming param; if it fails or doesn't match a real customer → 404
  let selectedEmail: string;
  try {
    selectedEmail = decodeURIComponent(id).toLowerCase();
  } catch {
    notFound();
  }

  const customer = customerMap.get(selectedEmail!);
  if (!customer) notFound();

  // ── Fetch customer notes via session client so RLS owns_store policy applies ─
  const sessionSupabase = await createClient();
  const { data: rawNotes } = await sessionSupabase
    .from("customer_notes")
    .select("id, body, created_at, updated_at")
    .eq("store_id", store.id)
    .eq("buyer_email", selectedEmail!)
    .order("created_at", { ascending: false });

  const customerNotes: NoteRow[] = (rawNotes ?? []).map((n) => ({
    id: n.id as string,
    body: n.body as string,
    created_at: n.created_at as string,
    updated_at: n.updated_at as string | null,
  }));

  // ── Build left-pane list items ─────────────────────────────────────────────
  const listItems: CustomerListItem[] = allCustomers.map((c) => ({
    email: c.email,
    id: encodeURIComponent(c.email),
    name: c.name || c.email,
    lifetimeSpend: inr(c.lifetimePaise),
    initial: initial(c.name, c.email),
  }));

  // ── Compute KPIs ───────────────────────────────────────────────────────────
  const lifetimeSpend = inr(customer.lifetimePaise);
  const orderCount = customer.orderCount;
  const avgOrder =
    orderCount > 0 ? inr(Math.round(customer.lifetimePaise / orderCount)) : "—";
  const firstSeen = fmtMonthYear(customer.firstSeen);
  const isRepeat = orderCount > 1;
  // VIP: lifetime paid spend >= ₹2,000 (20,000 paise)
  const isVip = customer.lifetimePaise >= 200000;

  // ── Category stats ─────────────────────────────────────────────────────────
  // Use page_type as the category proxy (real category column lives on products
  // table, not denormalised onto orders yet — honest about this gap).
  const catCounts = new Map<string, number>();
  for (const o of customer.orders) {
    const cat = (o.page_type || "other").replace("_", " ");
    catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1);
  }
  const totalOrdersForCat = customer.orders.length;
  const catItems = Array.from(catCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      pct: Math.round((count / totalOrdersForCat) * 100),
    }));

  // ── Activity timeline ──────────────────────────────────────────────────────
  // One event per order: "paid" orders → "Purchased <product>", others → "Started checkout"
  const timeline = customer.orders
    .slice() // keep original sort (desc created_at)
    .map((o) => {
      const product = o.product_title || "a product";
      if (o.status === "paid") {
        return {
          title: `Purchased ${product}`,
          when: `${fmtDate(o.paid_at ?? o.created_at)} · ${inr(o.amount)}`,
        };
      }
      return {
        title: `Started checkout for ${product}`,
        when: fmtDate(o.created_at),
      };
    });

  // ── Order history rows ─────────────────────────────────────────────────────
  const historyOrders = customer.orders.slice().sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  // ── Customer avatar initial + mailto ──────────────────────────────────────
  const custInitial = initial(customer.name, customer.email);
  const displayName = customer.name || customer.email;
  const mailtoHref = `mailto:${customer.email}`;

  // ── City: not stored on orders in Phase 1 — honest empty ──────────────────
  // buyer_city is not a column on the orders table; placeholder until it is.
  const city: string | null = null;

  return (
    <div className="cr-page-wrap">
      <div className="cr-wrap">
        {/* ── Left pane: customer list with client-side search ── */}
        <CustomerList customers={listItems} selectedId={id} />

        {/* ── Right pane: customer detail ── */}
        <main className="cr-detail">
          {/* Header */}
          <div className="cr-head">
            <span className="cr-av big">{custInitial}</span>
            <div>
              <h1>{displayName}</h1>
              <div className="sub">
                <span>✉ {customer.email}</span>
                {customer.phone && <span>📞 {customer.phone}</span>}
                {city && <span>📍 {city}</span>}
              </div>
              <div style={{ display: "flex", gap: 7, marginTop: 8, flexWrap: "wrap" }}>
                {isVip && <span className="cr-tag vip">★ VIP</span>}
                {isRepeat && <span className="cr-tag repeat">Repeat buyer</span>}
              </div>
            </div>
            <div className="cr-actions">
              <a
                className="cr-btn"
                href={mailtoHref}
                title={`Email ${customer.email}`}
              >
                ✉ Email
              </a>
            </div>
          </div>

          {/* KPI row */}
          <div className="cr-kpis">
            <div className="cr-kpi">
              <div className="l">Lifetime spend</div>
              <div className="v">{lifetimeSpend}</div>
            </div>
            <div className="cr-kpi">
              <div className="l">Orders</div>
              <div className="v">{orderCount}</div>
            </div>
            <div className="cr-kpi">
              <div className="l">Avg order</div>
              <div className="v">{avgOrder}</div>
            </div>
            <div className="cr-kpi">
              <div className="l">First seen</div>
              <div className="v">{firstSeen}</div>
            </div>
          </div>

          {/* Two-column grid */}
          <div className="cr-cols">
            {/* Order history table */}
            <div className="cr-card">
              <div className="cr-ct">
                <h3>Order history</h3>
                <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 500 }}>
                  {orderCount} order{orderCount !== 1 ? "s" : ""}
                </span>
              </div>
              {historyOrders.length === 0 ? (
                <div
                  style={{
                    padding: "26px 10px",
                    textAlign: "center",
                    color: "var(--muted)",
                    fontSize: 13,
                  }}
                >
                  No orders recorded yet.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Product</th>
                      <th>Type</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyOrders.map((o) => {
                      const statusCls = o.status === "paid" ? "t-paid" : o.status === "failed" ? "t-pend" : "t-neu";
                      const statusLabel =
                        o.status === "paid"
                          ? "Paid"
                          : o.status === "failed"
                            ? "Failed"
                            : "Pending";
                      const typeLabel = (o.page_type || "product")
                        .replace("_", " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase());
                      return (
                        <tr key={o.id}>
                          <td
                            style={{
                              fontFamily: "ui-monospace, Menlo, monospace",
                              fontSize: 12,
                              color: "var(--muted)",
                            }}
                          >
                            #{o.id.slice(0, 8)}
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {o.product_title || (
                              <span style={{ color: "var(--muted)", fontWeight: 400 }}>
                                —
                              </span>
                            )}
                          </td>
                          <td>
                            <span className="cr-cat">{typeLabel}</span>
                          </td>
                          <td style={{ color: "var(--muted)" }}>
                            {fmtDate(o.paid_at ?? o.created_at)}
                          </td>
                          <td style={{ fontWeight: 700 }}>{inr(o.amount)}</td>
                          <td>
                            <span className={`cr-pill ${statusCls}`}>{statusLabel}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Right column: category bars + activity timeline */}
            <div>
              <div className="cr-card" style={{ marginBottom: 16 }}>
                <div className="cr-ct">
                  <h3>Order types</h3>
                </div>
                {catItems.length === 0 ? (
                  <div
                    style={{
                      padding: "14px 0",
                      color: "var(--muted)",
                      fontSize: 13,
                    }}
                  >
                    No data yet.
                  </div>
                ) : (
                  catItems.map((ct) => (
                    <div key={ct.name} style={{ marginBottom: 11 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12.5,
                          marginBottom: 2,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{ct.name}</span>
                        <span style={{ color: "var(--muted)" }}>{ct.pct}%</span>
                      </div>
                      <div className="cr-bar">
                        <i style={{ width: `${ct.pct}%` }} />
                      </div>
                    </div>
                  ))
                )}
                <p
                  style={{
                    marginTop: 10,
                    fontSize: 11,
                    color: "var(--muted)",
                    fontStyle: "italic",
                  }}
                >
                  Based on order type — product categories available after catalog sync.
                </p>
              </div>

              <div className="cr-card">
                <div className="cr-ct">
                  <h3>Activity</h3>
                </div>
                {timeline.length === 0 ? (
                  <div style={{ color: "var(--muted)", fontSize: 13 }}>No activity yet.</div>
                ) : (
                  timeline.map((t, i) => (
                    <div className="cr-tl" key={i}>
                      <span className="dot" />
                      <div className="tx">
                        <b>{t.title}</b>
                        <p>{t.when}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Notes section — real, persisted, seller CRUD via RLS */}
          <CustomerNotes notes={customerNotes} buyerEmail={selectedEmail!} />
        </main>
      </div>
    </div>
  );
}
