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

type Customer = {
  email: string;
  name: string;
  phone: string | null;
  orders: number;
  paid: number;
  spent: number;
  lastOrderAt: string;
};

type Lead = {
  id: string;
  kind: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  created_at: string;
};

export default async function CRMPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab ?? "customers";
  const q = (sp.q ?? "").trim().toLowerCase();

  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  // Fetch all paid orders → build customer profiles
  const { data: orderRows } = await sb
    .from("orders")
    .select("buyer_email, buyer_name, buyer_phone, amount, status, created_at")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });

  // Build customer map from ALL orders (paid = customer, unpaid = lead)
  const byEmail: Record<string, Customer> = {};
  for (const o of orderRows ?? []) {
    const key = (o.buyer_email ?? "").toLowerCase() || `phone:${o.buyer_phone}`;
    if (!key) continue;
    if (!byEmail[key]) {
      byEmail[key] = {
        email: o.buyer_email ?? "",
        name: o.buyer_name ?? o.buyer_email ?? "Guest",
        phone: o.buyer_phone ?? null,
        orders: 0,
        paid: 0,
        spent: 0,
        lastOrderAt: o.created_at,
      };
    }
    byEmail[key].orders++;
    if (o.status === "paid") {
      byEmail[key].paid++;
      byEmail[key].spent += o.amount ?? 0;
    }
    if (o.created_at > byEmail[key].lastOrderAt) {
      byEmail[key].lastOrderAt = o.created_at;
    }
  }

  // Separate paying customers from non-paying (started checkout but didn't pay)
  const allContacts = Object.values(byEmail);
  const customers = allContacts.filter((c) => c.paid > 0);
  const checkoutLeads = allContacts.filter((c) => c.paid === 0);

  // Fetch site_messages (form/newsletter leads)
  const { data: msgRows } = await sb
    .from("site_messages")
    .select("id, kind, name, email, phone, message, created_at")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const leads: Lead[] = (msgRows ?? []) as Lead[];

  // KPIs
  const totalRevenue = customers.reduce((s, c) => s + c.spent, 0);
  const avgLTV = customers.length ? Math.round(totalRevenue / customers.length) : 0;
  const repeatBuyers = customers.filter((c) => c.paid >= 2).length;

  // Search filtering
  const filterCustomers = (list: Customer[]) =>
    q
      ? list.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            (c.phone ?? "").includes(q)
        )
      : list;

  const filterLeads = (list: Lead[]) =>
    q
      ? list.filter(
          (l) =>
            (l.name ?? "").toLowerCase().includes(q) ||
            (l.email ?? "").toLowerCase().includes(q) ||
            (l.phone ?? "").includes(q)
        )
      : list;

  const displayedCustomers = filterCustomers(customers);
  const displayedCheckoutLeads = filterCustomers(checkoutLeads);
  const displayedFormLeads = filterLeads(leads);

  const totalLeads = leads.length + checkoutLeads.length;

  return (
    <>
      <Phead
        title="CRM"
        sub={`${customers.length} paying customers · ${totalLeads} leads`}
        action={
          <a
            href="/dashboard/crm?export=1"
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
            icon: "users",
            color: "var(--primary)",
            label: "Customers",
            value: customers.length.toLocaleString("en-IN"),
          },
          {
            icon: "rupee",
            color: "var(--green)",
            label: "Total revenue",
            value: inr(totalRevenue),
          },
          {
            icon: "spark",
            color: "var(--secondary)",
            label: "Avg. LTV",
            value: inr(avgLTV),
          },
          {
            icon: "tag",
            color: "var(--accent)",
            label: "Repeat buyers",
            value: String(repeatBuyers),
          },
        ]}
      />

      <style>{`
        .crm-toolbar {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px;
        }
        .crm-search {
          display: flex; align-items: center; gap: 7px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 10px; padding: 7px 12px; margin-left: auto;
          min-width: 200px; max-width: 280px;
        }
        .crm-search svg { color: var(--muted); flex: none; }
        .crm-search input {
          border: 0; background: transparent; color: var(--text); font: inherit;
          font-size: 13px; outline: none; width: 100%;
        }
        .crm-table { width: 100%; border-collapse: collapse; }
        .crm-table th {
          text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em;
          text-transform: uppercase; color: var(--muted); padding: 10px 12px;
          border-bottom: 1px solid var(--border);
        }
        .crm-table td { padding: 11px 12px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: middle; }
        .crm-table tr:last-child td { border-bottom: 0; }
        .crm-table tr:hover td { background: var(--surface2); }
        .crm-person b { display: block; font-weight: 600; }
        .crm-person span { font-size: 11.5px; color: var(--muted); }
        .crm-amt { font-weight: 700; }
        .crm-empty { text-align: center; padding: 40px; color: var(--muted); font-size: 13.5px; }
        .crm-note {
          font-size: 12px; color: var(--muted); background: var(--surface2);
          border-radius: 8px; padding: 8px 12px; margin-bottom: 10px;
        }
      `}</style>

      <div className="crm-toolbar">
        <Link href="?tab=customers" className={`dx-fchip${tab === "customers" ? " on" : ""}`}>
          Customers ({customers.length})
        </Link>
        <Link href="?tab=checkout-leads" className={`dx-fchip${tab === "checkout-leads" ? " on" : ""}`}>
          Checkout leads ({checkoutLeads.length})
        </Link>
        <Link href="?tab=form-leads" className={`dx-fchip${tab === "form-leads" ? " on" : ""}`}>
          Form / newsletter ({leads.length})
        </Link>
        <form method="GET" action="" className="crm-search">
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search name, email, phone…"
          />
          <input type="hidden" name="tab" value={tab} />
        </form>
      </div>

      {tab === "customers" && (
        <Card title={`Paying customers (${displayedCustomers.length})`}>
          {displayedCustomers.length === 0 ? (
            <div className="crm-empty">
              {customers.length === 0
                ? "No paying customers yet — your first paid order will appear here."
                : "No customers match your search."}
            </div>
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
                {displayedCustomers
                  .sort((a, b) => b.spent - a.spent)
                  .map((c) => (
                    <tr key={c.email}>
                      <td>
                        <div className="crm-person">
                          <b>{c.name}</b>
                          {c.paid >= 2 && (
                            <span style={{ color: "var(--green)", fontWeight: 700 }}>
                              {" "}Repeat
                            </span>
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
        </Card>
      )}

      {tab === "checkout-leads" && (
        <Card title={`Started checkout, did not pay (${displayedCheckoutLeads.length})`}>
          <div className="crm-note">
            These contacts initiated an order but did not complete payment. They are not yet customers.
          </div>
          {displayedCheckoutLeads.length === 0 ? (
            <div className="crm-empty">
              {checkoutLeads.length === 0
                ? "No abandoned checkouts yet."
                : "No leads match your search."}
            </div>
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
                {displayedCheckoutLeads.map((c) => (
                  <tr key={c.email || c.phone}>
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
        </Card>
      )}

      {tab === "form-leads" && (
        <Card title={`Form submissions & newsletter signups (${displayedFormLeads.length})`}>
          {displayedFormLeads.length === 0 ? (
            <div className="crm-empty">
              {leads.length === 0
                ? "No form submissions yet. Add a contact form or newsletter signup to your website."
                : "No leads match your search."}
            </div>
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
                {displayedFormLeads.map((l) => (
                  <tr key={l.id}>
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
        </Card>
      )}
    </>
  );
}
