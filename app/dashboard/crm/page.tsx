import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card } from "@/components/dx/ui";
import Pagination from "@/components/dx/Pagination";
import CRMClient, { type Customer, type CheckoutLead, type FormLead } from "./CRMClient";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function inr(paise: number) {
  return "₹" + Math.round(paise / 100).toLocaleString("en-IN");
}

export default async function CRMPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const tab = sp.tab ?? "customers";
  const q = (sp.q ?? "").trim().toLowerCase();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  // Fetch all orders for this store — needed for JS-side aggregation into customer profiles.
  // This is intentionally unbounded: the aggregation requires all rows so GMV/repeat stats
  // are accurate. Pagination is applied to the aggregated array output.
  const { data: orderRows } = await sb
    .from("orders")
    .select("id, buyer_email, buyer_name, buyer_phone, product_title, amount, status, created_at")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });

  // Build customer map from all orders
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
        orderList: [],
      };
    }
    byEmail[key].orders++;
    byEmail[key].orderList.push({
      id: o.id,
      product_title: o.product_title ?? null,
      amount: o.amount ?? 0,
      status: o.status ?? "",
      created_at: o.created_at,
    });
    if (o.status === "paid") {
      byEmail[key].paid++;
      byEmail[key].spent += o.amount ?? 0;
    }
    if (o.created_at > byEmail[key].lastOrderAt) {
      byEmail[key].lastOrderAt = o.created_at;
    }
  }

  // Separate paying customers from checkout-only leads
  const allContacts = Object.values(byEmail);
  const customers = allContacts.filter((c) => c.paid > 0).sort((a, b) => b.spent - a.spent);
  const checkoutLeads = allContacts.filter((c) => c.paid === 0);

  // Fetch site_messages for form/newsletter leads — paginate directly at DB level
  // when on the form-leads tab, otherwise use a head-count for KPIs.
  let formLeads: FormLead[] = [];
  let formLeadTotal = 0;

  // Always get total for KPIs
  const { count: msgCount } = await sb
    .from("site_messages")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id);
  formLeadTotal = msgCount ?? 0;

  if (tab === "form-leads") {
    const { data: msgRows } = await sb
      .from("site_messages")
      .select("id, kind, name, email, phone, message, created_at")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    formLeads = (msgRows ?? []) as FormLead[];
  }

  // KPIs
  const totalRevenue = customers.reduce((s, c) => s + c.spent, 0);
  const avgLTV = customers.length ? Math.round(totalRevenue / customers.length) : 0;
  const repeatBuyers = customers.filter((c) => c.paid >= 2).length;
  const totalLeads = formLeadTotal + checkoutLeads.length;

  // Search filtering (applied to JS-aggregated arrays)
  const filterCustomers = (list: Customer[]) =>
    q
      ? list.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            (c.phone ?? "").includes(q)
        )
      : list;

  const filterLeads = (list: FormLead[]) =>
    q
      ? list.filter(
          (l) =>
            (l.name ?? "").toLowerCase().includes(q) ||
            (l.email ?? "").toLowerCase().includes(q) ||
            (l.phone ?? "").includes(q)
        )
      : list;

  const filteredCustomers = filterCustomers(customers);
  const filteredCheckoutLeads = filterCustomers(checkoutLeads as Customer[]) as unknown as CheckoutLead[];
  const filteredFormLeads = filterLeads(formLeads);

  // Paginate the JS-aggregated customer/checkout-lead arrays by array-slice
  let displayList: Customer[] | CheckoutLead[] | FormLead[] = [];
  let displayTotal = 0;

  if (tab === "customers") {
    displayTotal = filteredCustomers.length;
    displayList = filteredCustomers.slice(offset, offset + PAGE_SIZE);
  } else if (tab === "checkout-leads") {
    displayTotal = filteredCheckoutLeads.length;
    displayList = filteredCheckoutLeads.slice(offset, offset + PAGE_SIZE);
  } else {
    // form-leads: already paginated at DB level above
    displayTotal = q ? filteredFormLeads.length : formLeadTotal;
    displayList = filteredFormLeads;
  }

  return (
    <>
      <Phead
        title="CRM"
        sub={`${customers.length} paying customers · ${totalLeads} leads`}
        action={
          <a href="/dashboard/crm?export=1" className="btn ghost" style={{ fontSize: 13 }}>
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
          Form / newsletter ({formLeadTotal})
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
        <Card title={`Paying customers (${filteredCustomers.length})`}>
          {filteredCustomers.length === 0 ? (
            <div className="crm-empty">
              {customers.length === 0
                ? "No paying customers yet — your first paid order will appear here."
                : "No customers match your search."}
            </div>
          ) : (
            <>
              <CRMClient
                tab="customers"
                customers={displayList as Customer[]}
                checkoutLeads={[]}
                formLeads={[]}
              />
              <Pagination page={page} pageSize={PAGE_SIZE} total={displayTotal} baseParams={sp} />
            </>
          )}
        </Card>
      )}

      {tab === "checkout-leads" && (
        <Card title={`Started checkout, did not pay (${filteredCheckoutLeads.length})`}>
          <div className="crm-note">
            These contacts initiated an order but did not complete payment. They are not yet customers.
          </div>
          {filteredCheckoutLeads.length === 0 ? (
            <div className="crm-empty">
              {checkoutLeads.length === 0
                ? "No abandoned checkouts yet."
                : "No leads match your search."}
            </div>
          ) : (
            <>
              <CRMClient
                tab="checkout-leads"
                customers={[]}
                checkoutLeads={displayList as CheckoutLead[]}
                formLeads={[]}
              />
              <Pagination page={page} pageSize={PAGE_SIZE} total={displayTotal} baseParams={sp} />
            </>
          )}
        </Card>
      )}

      {tab === "form-leads" && (
        <Card title={`Form submissions & newsletter signups (${formLeadTotal})`}>
          {formLeads.length === 0 && !q ? (
            <div className="crm-empty">
              {formLeadTotal === 0
                ? "No form submissions yet. Add a contact form or newsletter signup to your website."
                : "Loading…"}
            </div>
          ) : filteredFormLeads.length === 0 ? (
            <div className="crm-empty">No leads match your search.</div>
          ) : (
            <>
              <CRMClient
                tab="form-leads"
                customers={[]}
                checkoutLeads={[]}
                formLeads={displayList as FormLead[]}
              />
              <Pagination page={page} pageSize={PAGE_SIZE} total={displayTotal} baseParams={sp} />
            </>
          )}
        </Card>
      )}
    </>
  );
}
