import React from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentStore } from "@/lib/auth";
import { Phead, Kpis, Card, Table, Tag, Live, Buyer, Templates, Donut, PageType } from "./ui";
import NewProductButton from "@/app/dashboard/pages/products/NewProductButton";

const inr = (paise?: number | null) => "₹" + Math.round((paise ?? 0) / 100).toLocaleString("en-IN");

const Search = ({ placeholder }: { placeholder: string }) => (
  <div className="dx-search">
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
    <input placeholder={placeholder} />
  </div>
);
const Switch = ({ on = true }: { on?: boolean }) => <div className={`dx-switch${on ? " on" : ""}`}><i /></div>;
const Field = ({ label, value, ph, type }: { label: string; value?: string; ph?: string; type?: string }) => (
  <div className="dx-field"><label>{label}</label><input defaultValue={value} placeholder={ph} type={type} /></div>
);

/**
 * Impersonation-aware context helper.
 *
 * Returns { sb, store } where `store` is the store the current session should
 * SEE (target seller's store when impersonating; own store otherwise).
 *
 * Data reads in this file always pass store.id explicitly as a WHERE clause,
 * so using the admin client for both paths is safe — queries are isolated by
 * store_id. The admin client is required for impersonated stores because the
 * admin's session-scoped client would fail RLS on the target seller's rows.
 */
async function ctx() {
  const { store } = await getCurrentStore();
  // Use the service-role client for all reads in this file. Every query is
  // scoped by store.id, so there is no RLS bypass risk — the store id is the
  // one we just validated (either the owner's own, or the admin-verified
  // impersonated one from getCurrentStore).
  const sb = createAdminClient();
  return { sb, store };
}

const TPL = [
  { name: "Aurora", sub: "Bio template", grad: "linear-gradient(135deg,#5eead4,#6366f1,#a855f7)" },
  { name: "Sunset", sub: "Store template", grad: "linear-gradient(135deg,#ff8a4c,#ff5a7a,#ffd56b)" },
  { name: "Bloom", sub: "Landing template", grad: "linear-gradient(135deg,#fb7185,#f472b6,#a3e635)" },
];

// ── Analytics page handler (also exported for the dedicated route) ────────────
export async function analyticsPage(pgFilter?: string): Promise<React.ReactNode> {
  const { sb, store } = await ctx();
  const pg = (pgFilter && pgFilter.length > 0) ? pgFilter : "all";

  // 1. Load all pages for this store (tab selector + top-pages lookup)
  const { data: pages } = store
    ? await sb
        .from("pages")
        .select("id, page_type, title, public_id, status")
        .eq("store_id", store.id)
        .order("created_at", { ascending: true })
    : { data: [] };
  const pageList = pages ?? [];

  // Build tab list: All + store/bio singletons + opp pages
  type PageTab = { id: string; label: string; note: string };
  const tabs: PageTab[] = [{ id: "all", label: "All pages", note: "across all pages" }];
  const storePage = pageList.find((p) => p.page_type === "store");
  if (storePage) tabs.push({ id: storePage.id as string, label: "Store", note: "/store" });
  const bioPage = pageList.find((p) => p.page_type === "bio");
  if (bioPage) tabs.push({ id: bioPage.id as string, label: "Bio", note: "/bio" });
  pageList
    .filter((p) => p.page_type === "opp")
    .forEach((p) => {
      const raw = (p.title as string) || (p.public_id as string) || "Opp page";
      tabs.push({
        id: p.id as string,
        label: raw.length > 22 ? raw.slice(0, 20) + "…" : raw,
        note: `/opp/${p.public_id ?? p.id}`,
      });
    });

  // Resolve page IDs in scope
  const scopeIds: string[] = pg === "all" ? pageList.map((p) => p.id as string) : [pg];

  // 2. Fetch page_events for scoped pages
  // Schema: kind(view|click), device, page_id, store_id, created_at
  // NOTE: no referrer/source field — traffic sources section is an honest placeholder.
  const buildEventsQ = () => {
    const q = sb
      .from("page_events")
      .select("kind, device, page_id, created_at")
      .eq("store_id", store?.id ?? "");
    return pg !== "all" && scopeIds.length > 0 ? q.in("page_id", scopeIds) : q;
  };
  const { data: events } = store ? await buildEventsQ() : { data: [] };

  // 3. Fetch orders (created + paid) for funnel stages 3 & 4
  const buildOrdersQ = () => {
    const q = sb
      .from("orders")
      .select("amount, status, page_id, created_at")
      .eq("store_id", store?.id ?? "");
    return pg !== "all" && scopeIds.length > 0 ? q.in("page_id", scopeIds) : q;
  };
  const { data: allOrders } = store ? await buildOrdersQ() : { data: [] };

  // 4. Aggregate
  let views = 0, clicks = 0;
  const dev: Record<string, number> = { mobile: 0, desktop: 0, tablet: 0 };
  const dailyViews: Record<string, number> = {};
  const viewsByPage: Record<string, number> = {};
  const now = new Date();

  (events ?? []).forEach((e) => {
    if (e.kind === "view") {
      views++;
      const d = String(e.device ?? "");
      if (d in dev) dev[d]++;
      const day = String(e.created_at ?? "").slice(0, 10);
      dailyViews[day] = (dailyViews[day] ?? 0) + 1;
      const pid = String(e.page_id ?? "");
      if (pid) viewsByPage[pid] = (viewsByPage[pid] ?? 0) + 1;
    } else {
      clicks++;
    }
  });

  const ordersCreated = (allOrders ?? []).filter(
    (o) => o.status === "created" || o.status === "paid"
  ).length;
  const ordersPaid = (allOrders ?? []).filter((o) => o.status === "paid").length;
  const revenue = (allOrders ?? [])
    .filter((o) => o.status === "paid")
    .reduce((s, o) => s + (o.amount ?? 0), 0);

  const ctr = views ? `${((clicks / views) * 100).toFixed(1)}%` : "0%";
  const convRate = views ? `${((ordersPaid / views) * 100).toFixed(1)}%` : "0%";

  // 5. 14-day daily bar chart
  const chartPoints14: number[] = [];
  const chartLabels14: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    chartPoints14.push(dailyViews[key] ?? 0);
    chartLabels14.push(i === 0 ? "Today" : String(d.getDate()));
  }
  const hasChartData = chartPoints14.some((v) => v > 0);
  const chartMax = hasChartData ? Math.max(...chartPoints14, 1) : 1;

  // 6. Funnel
  const f1 = views;
  const f2 = clicks;
  const f3 = ordersCreated;
  const f4 = ordersPaid;
  const fPct = (n: number) => (f1 > 0 ? Math.round((n / f1) * 100) : 0);
  const fDrop = (from: number, to: number) =>
    from > 0 ? Math.round(((from - to) / from) * 100) : 0;

  // 7. Top pages
  const revenueByPage: Record<string, number> = {};
  const paidByPage: Record<string, number> = {};
  (allOrders ?? [])
    .filter((o) => o.status === "paid")
    .forEach((o) => {
      const pid = String(o.page_id ?? "");
      if (pid) {
        revenueByPage[pid] = (revenueByPage[pid] ?? 0) + (o.amount ?? 0);
        paidByPage[pid] = (paidByPage[pid] ?? 0) + 1;
      }
    });

  type TopRow = { path: string; views: number; conv: string; rev: string };
  const topPageIds = Array.from(new Set([...Object.keys(viewsByPage), ...Object.keys(paidByPage)]));
  const topPages: TopRow[] = topPageIds
    .map((pid) => {
      const p = pageList.find((x) => x.id === pid);
      const path = p
        ? p.page_type === "store"
          ? "/store"
          : p.page_type === "bio"
          ? "/bio"
          : `/opp/${p.public_id ?? pid}`
        : `/${pid.slice(0, 8)}`;
      const pv = viewsByPage[pid] ?? 0;
      const paid = paidByPage[pid] ?? 0;
      const rev = revenueByPage[pid] ?? 0;
      return {
        path,
        views: pv,
        conv: pv > 0 ? `${((paid / pv) * 100).toFixed(1)}%` : "—",
        rev: rev > 0 ? inr(rev) : "—",
      };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, 8);

  // 8. Device donut
  const devTotal = dev.mobile + dev.desktop + dev.tablet;
  const devPct = (n: number) => (devTotal ? Math.round((n / devTotal) * 100) : 0);

  // 9. Active tab
  const activeTab = tabs.find((t) => t.id === pg) ?? tabs[0];

  return (
    <>
      {/* Page selector tabs */}
      <div className="dx-pageseg">
        {tabs.map((t) => (
          <a
            key={t.id}
            href={`/dashboard/analytics?pg=${t.id}`}
            className={`dx-pseg-btn${t.id === pg ? " on" : ""}`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {/* KPI row: Visitors, Page views, CTR, Revenue */}
      <Kpis
        items={[
          { icon: "eye",   color: "var(--primary)",   label: "Visitors",          value: views.toLocaleString("en-IN") },
          { icon: "link",  color: "var(--accent)",     label: "Page views",        value: views.toLocaleString("en-IN") },
          { icon: "spark", color: "var(--secondary)",  label: "CTR (click / view)", value: ctr },
          { icon: "rupee", color: "var(--gold)",       label: "Revenue",           value: inr(revenue) },
        ]}
      />

      {/* Two-column layout */}
      <div className="dx-grid dx-cols" style={{ alignItems: "start" }}>
        {/* Left column */}
        <div>
          {/* 14-day bar chart */}
          <Card title="Visitors · last 14 days">
            {!hasChartData ? (
              <div className="dx-empty">
                No event data yet — views will appear here once your pages receive traffic.
              </div>
            ) : (
              <div className="an-chart">
                {chartPoints14.map((v, i) => (
                  <div key={i} className="an-col">
                    <div
                      className={`an-bar${i < chartPoints14.length - 1 ? " dim" : ""}`}
                      style={{ height: `${Math.max(4, Math.round((v / chartMax) * 100))}%` }}
                    />
                    <span className="an-lab">{chartLabels14[i]}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Conversion funnel */}
          <Card title="Conversion funnel">
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
              {activeTab.note} · page_events (view/click) + orders (created/paid)
            </div>
            <div className="an-funnel">
              <div className="an-step">
                <div className="an-step-top"><b>Page views</b><span className="an-step-n">{f1.toLocaleString("en-IN")}</span></div>
                <div className="an-step-track"><div className="an-step-fill" style={{ width: "100%" }}>100%</div></div>
              </div>
              <div className="an-step">
                <div className="an-step-top"><b>Clicked buy / CTA</b><span className="an-step-n">{f2.toLocaleString("en-IN")}</span></div>
                <div className="an-step-track">
                  <div className="an-step-fill" style={{ width: `${Math.max(fPct(f2), f2 > 0 ? 4 : 0)}%` }}>
                    {fPct(f2)}%
                  </div>
                </div>
                {f1 > 0 && f2 < f1 && <div className="an-step-drop">▼ {fDrop(f1, f2)}% drop-off</div>}
              </div>
              <div className="an-step">
                <div className="an-step-top"><b>Started checkout</b><span className="an-step-n">{f3.toLocaleString("en-IN")}</span></div>
                <div className="an-step-track">
                  <div className="an-step-fill" style={{ width: `${Math.max(fPct(f3), f3 > 0 ? 4 : 0)}%` }}>
                    {fPct(f3)}%
                  </div>
                </div>
                {f2 > 0 && f3 < f2 && <div className="an-step-drop">▼ {fDrop(f2, f3)}% drop-off</div>}
              </div>
              <div className="an-step">
                <div className="an-step-top"><b>Purchased</b><span className="an-step-n">{f4.toLocaleString("en-IN")}</span></div>
                <div className="an-step-track">
                  <div className="an-step-fill" style={{ width: `${Math.max(fPct(f4), f4 > 0 ? 4 : 0)}%` }}>
                    {fPct(f4)}%
                  </div>
                </div>
                <div className="an-step-conv">
                  {f4 > 0 ? `✓ ${convRate} conversion` : "No paid orders yet"}
                </div>
              </div>
            </div>
          </Card>

          {/* Top pages table */}
          <Card title="Top pages" link="by views">
            {topPages.length === 0 ? (
              <div className="dx-empty">No page data yet.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Page</th>
                    <th style={{ textAlign: "right" }}>Views</th>
                    <th style={{ textAlign: "right" }}>Conv.</th>
                    <th style={{ textAlign: "right" }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topPages.map((row, i) => (
                    <tr key={i}>
                      <td><span className="dx-monopath">{row.path}</span></td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{row.views.toLocaleString("en-IN")}</td>
                      <td style={{ textAlign: "right" }}>{row.conv}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{row.rev}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        {/* Right column */}
        <div>
          {/* Traffic sources — honest: no referrer field in page_events yet */}
          <Card title="Traffic sources">
            <div style={{ padding: "4px 0 8px" }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Source tracking coming soon</div>
              <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
                The <code className="an-code">page_events</code> table does not yet include a referrer
                or UTM source column. Add a <code className="an-code">referrer text</code> field and
                capture <code className="an-code">document.referrer</code> at view-time to unlock
                organic / paid / direct breakdown here.
              </p>
            </div>
          </Card>

          {/* Devices donut */}
          <Card title="Devices">
            {devTotal === 0 ? (
              <div className="dx-empty">No device data yet.</div>
            ) : (
              <>
                <Donut
                  segments={[
                    { label: "Mobile",  pct: devPct(dev.mobile),  color: "var(--primary)" },
                    { label: "Desktop", pct: devPct(dev.desktop), color: "var(--accent)" },
                    { label: "Tablet",  pct: devPct(dev.tablet),  color: "var(--gold)" },
                  ]}
                />
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
                  {devPct(dev.mobile)}% mobile · {devTotal.toLocaleString("en-IN")} total view events
                </div>
              </>
            )}
          </Card>

          {/* Pixel events — derived from what we actually track */}
          <Card title="Pixel events">
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--muted)" }}>PageView <span className="an-badge">kind=view</span></span>
                <b>{views.toLocaleString("en-IN")}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--muted)" }}>ViewContent <span className="an-badge">=PageView today</span></span>
                <b>{views.toLocaleString("en-IN")}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--muted)" }}>InitiateCheckout <span className="an-badge">orders created</span></span>
                <b>{ordersCreated.toLocaleString("en-IN")}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--muted)" }}>Purchase <span className="an-badge">orders paid</span></span>
                <b style={{ color: "var(--green)" }}>{ordersPaid.toLocaleString("en-IN")}</b>
              </div>
              <p style={{ fontSize: 11.5, color: "var(--muted)", margin: 0, borderTop: "1px solid var(--border)", paddingTop: 9 }}>
                ViewContent will diverge from PageView once per-product view tracking is added (separate kind). InitiateCheckout counts all order rows (status: created OR paid).
              </p>
            </div>
          </Card>

          {/* Suggest more */}
          <Card title="Improve tracking">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="an-suggest">
                <b>Add UTM / referrer tracking</b>
                <p>Add a <code>referrer text</code> column to <code>page_events</code> + capture <code>document.referrer</code> at view-time to unlock traffic-sources breakdown.</p>
              </div>
              <div className="an-suggest">
                <b>Unique visitors</b>
                <p>Store a hashed fingerprint or short session ID per event to distinguish unique vs repeat visitors (currently views = visitors).</p>
              </div>
              <div className="an-suggest">
                <b>Connect Meta Pixel</b>
                <p>Set a Pixel ID per page in the page builder to fire real browser-side pixel events alongside these server-side counts.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

export const SELLER_PAGES: Record<string, () => Promise<React.ReactNode>> = {
  product: async () => {
    const { sb, store } = await ctx();
    const { data: prods } = store ? await sb.from("pages").select("id, public_id, title, status, content").eq("store_id", store.id).eq("page_type", "opp").order("updated_at", { ascending: false }) : { data: [] };
    const { data: paid } = store ? await sb.from("orders").select("amount, page_id").eq("store_id", store.id).eq("page_type", "opp").eq("status", "paid") : { data: [] };
    const { data: cat } = store ? await sb.from("products").select("id, name, price, image").eq("store_id", store.id).order("created_at", { ascending: false }) : { data: [] };
    const catalog = (cat ?? []).map((r) => ({ id: r.id as string, name: (r.name as string) ?? "Untitled", price: r.price != null ? Number(r.price) : null, image: (r.image as string) ?? null }));
    const revenue = (paid ?? []).reduce((s, o) => s + (o.amount ?? 0), 0);
    const soldBy: Record<string, number> = {};
    (paid ?? []).forEach((o) => { if (o.page_id) soldBy[o.page_id] = (soldBy[o.page_id] ?? 0) + 1; });
    const rows = (prods ?? []).map((p) => {
      const c = (p.content ?? {}) as { headline?: string; price?: number };
      return [<a key="n" href={`/studio/product/${p.id}`} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>{c.headline || p.title || "Untitled"}</a>, `/opp/${p.public_id}`, c.price ? `₹${c.price}` : "—", String(soldBy[p.id] ?? 0), p.status === "published" ? <Live key="l" /> : <Tag key="t" kind="neu">Draft</Tag>];
    });
    return (
      <>
        <Phead title="One-page products" sub="Full landing / checkout pages — create one from scratch or from a store product." action={<NewProductButton catalog={catalog} />} />
        <Kpis items={[{ icon: "bag", color: "var(--primary)", label: "Products", value: String(prods?.length ?? 0) }, { icon: "rupee", color: "var(--green)", label: "Revenue", value: inr(revenue) }, { icon: "up", color: "var(--secondary)", label: "Sold", value: String((paid ?? []).length) }]} />
        <Card title="Your products" link="Manage"><Table cols={["Product", "URL", "Price", "Sold", "Status"]} rows={rows} empty="No one-page products yet — create your first." /></Card>
        <div style={{ height: 16 }} />
        <Card title="Templates" link="Browse all"><Templates items={TPL} /></Card>
      </>
    );
  },

  bio: async () => {
    const { sb, store } = await ctx();
    const { data: bio } = store ? await sb.from("pages").select("status, content").eq("store_id", store.id).eq("page_type", "bio").maybeSingle() : { data: null };
    const c = (bio?.content ?? {}) as { links?: unknown[]; socials?: unknown[] };
    return (
      <>
        <Phead title="Bio page" sub="Link-in-bio with all your links." action={<a className="btn grad" href="/dashboard/pages/bio/edit">Edit</a>} />
        <Kpis items={[{ icon: "link", color: "var(--primary)", label: "Links", value: String((c.links ?? []).length) }, { icon: "spark", color: "var(--secondary)", label: "Socials", value: String((c.socials ?? []).length) }, { icon: "eye", color: "var(--accent)", label: "Status", value: bio?.status === "published" ? "Live" : "Draft" }]} />
        <Card title="Your bio page">{bio ? <div className="dx-kv"><span className="dx-fw6">{store?.subdomain}.invoxai.io/bio</span>{bio.status === "published" ? <Live /> : <Tag kind="neu">Draft</Tag>}</div> : <div className="dx-empty">No bio page yet.</div>}</Card>
      </>
    );
  },

  orders: async () => {
    const { sb, store } = await ctx();
    const { data: orders } = store ? await sb.from("orders").select("id, product_title, buyer_name, buyer_email, gateway, amount, status").eq("store_id", store.id).order("created_at", { ascending: false }).limit(50) : { data: [] };
    const list = orders ?? [];
    const paid = list.filter((o) => o.status === "paid").length;
    const rows = list.map((o) => [<span key="i" className="dx-fw6">#{o.id.slice(0, 6)}</span>, <Buyer key="b" emoji="🛍️" name={o.buyer_name || o.buyer_email || "Guest"} />, o.product_title || "—", o.gateway || "—", inr(o.amount), o.status === "paid" ? <Tag key="t" kind="paid">Paid</Tag> : <Tag key="t" kind="pend">{o.status}</Tag>]);
    return (
      <>
        <Phead title="Orders" sub="Every order across your pages." action={<button className="btn ghost">Export CSV</button>} />
        <Kpis items={[{ icon: "bag", color: "var(--primary)", label: "Total", value: String(list.length) }, { icon: "rupee", color: "var(--green)", label: "Paid", value: String(paid) }, { icon: "tag", color: "var(--red)", label: "Pending", value: String(list.length - paid), down: list.length - paid > 0 }]} />
        <div className="dx-toolbar"><span className="dx-fchip on">All</span><span className="dx-fchip">Paid</span><span className="dx-fchip">Pending</span><Search placeholder="Search order or buyer…" /></div>
        <Card><Table cols={["Order", "Buyer", "Product", "Gateway", "Amount", "Status"]} rows={rows} empty="No orders yet." /></Card>
      </>
    );
  },

  crm: async () => {
    const { sb, store } = await ctx();
    const { data: orders } = store ? await sb.from("orders").select("buyer_email, buyer_name, amount").eq("store_id", store.id).eq("status", "paid") : { data: [] };
    const by: Record<string, { name: string; orders: number; spent: number }> = {};
    (orders ?? []).forEach((o) => { const e = o.buyer_email || "guest"; by[e] = by[e] || { name: o.buyer_name || e, orders: 0, spent: 0 }; by[e].orders++; by[e].spent += o.amount ?? 0; });
    const rows = Object.entries(by).map(([email, v]) => [<Buyer key="b" emoji="🧑" name={v.name} />, email, String(v.orders), inr(v.spent)]);
    return (
      <>
        <Phead title="CRM" sub="Your customers and leads." action={<button className="btn ghost">Export</button>} />
        <Kpis items={[{ icon: "users", color: "var(--primary)", label: "Customers", value: String(Object.keys(by).length) }]} />
        <div className="dx-toolbar"><span className="dx-fchip on">All</span><span className="dx-fchip">Repeat</span><Search placeholder="Search customers…" /></div>
        <Card><Table cols={["Customer", "Email", "Orders", "Total spent"]} rows={rows} empty="No customers yet." /></Card>
      </>
    );
  },

  settings: async () => {
    const { sb, store } = await ctx();
    const { data: cat } = store?.category_id ? await sb.from("business_categories").select("name").eq("id", store.category_id).maybeSingle() : { data: null };
    return (
      <>
        <Phead title="Settings" sub="Store, profile, and account." />
        <div className="dx-grid dx-cols">
          <div><Card title="Store details"><Field label="Store name" value={store?.store_name ?? ""} /><div className="dx-ff"><Field label="Subdomain" value={store?.subdomain ?? ""} /><div className="dx-field"><label>Category</label><input defaultValue={cat?.name ?? ""} /></div></div><button className="btn grad">Save</button></Card></div>
          <div><Card title="Custom domain"><div className="dx-kv"><span className="dx-fw6">{store?.custom_domain || "Not connected"}</span>{store?.custom_domain ? (store.custom_domain_verified ? <Live /> : <Tag kind="pend">Pending</Tag>) : <Tag kind="neu">—</Tag>}</div></Card></div>
        </div>
      </>
    );
  },

  domains: async () => {
    const { store } = await ctx();
    return (
      <>
        <Phead title="Domains" sub="Subdomain and custom domains." />
        <div className="dx-grid dx-g2">
          <Card title="Subdomain"><div className="dx-kv"><span className="dx-fw6">{store?.subdomain ? `${store.subdomain}.invoxai.io` : "—"}</span>{store?.subdomain ? <Live>Active</Live> : null}</div><p className="dx-muted" style={{ fontSize: 12.5, marginTop: 8 }}>1 included · extra ₹199 each.</p></Card>
          <Card title="Custom domain"><Field label="Your domain" value={store?.custom_domain ?? ""} ph="yourbrand.com" /><div className="dx-codebox">CNAME @ → cname.invoxai.io</div><button className="btn grad" style={{ width: "100%", marginTop: 10, justifyContent: "center" }}>Connect</button></Card>
        </div>
      </>
    );
  },

  // wallet is handled by the dedicated app/dashboard/wallet/page.tsx route.
  // This stub is intentionally removed — the [...slug] catch-all is never
  // reached for /dashboard/wallet because the static segment wins in Next.js
  // route resolution. Keeping a stub here was misleading (hardcoded ₹0).

  coupons: async () => (
    <>
      <Phead title="Coupons" sub="Codes and auto-apply discount links." action={<button className="btn grad">+ New coupon</button>} />
      <div className="dx-grid dx-cols">
        <div><Card title="Your coupons"><Table cols={["Code", "Type", "Scope", "Used", "Status"]} rows={[]} empty="No coupons yet." /></Card></div>
        <div><Card title="Auto-apply link"><p className="dx-muted" style={{ fontSize: 12.5, marginBottom: 9 }}>Applies automatically at checkout.</p><div className="dx-codebox">yourstore.invoxai.io/store?coupon=CODE</div></Card></div>
      </div>
    </>
  ),

  abandoned: async () => (
    <>
      <Phead title="Abandoned cart" sub="Recover unfinished checkouts." />
      <div className="dx-grid dx-cols">
        <div><Card title="Recent abandoned"><Table cols={["Buyer", "Product", "Amount", "Stage"]} rows={[]} empty="No abandoned carts." /></Card></div>
        <div><Card title="Recovery email"><div className="dx-mrow"><Switch /><div className="tx"><b>Auto recovery</b><p>Send 1 hour after abandonment.</p></div></div><div className="dx-field" style={{ marginTop: 10 }}><label>Delay</label><select><option>1 hour</option><option>3 hours</option></select></div></Card></div>
      </div>
    </>
  ),

  checkout: async () => (
    <>
      <Phead title="Checkout" sub="Page-type-aware checkout settings." />
      <div className="dx-grid dx-cols">
        <div><Card title="Checkout preview"><div className="dx-card" style={{ background: "var(--surface2)" }}><div className="dx-fw6" style={{ marginBottom: 8 }}>Product</div><div className="dx-kv"><span>Subtotal</span><span>₹0</span></div><div className="dx-kv"><span className="dx-fw6">Total</span><span className="dx-fw6">₹0</span></div><button className="btn grad" style={{ width: "100%", marginTop: 10, justifyContent: "center" }}>Pay</button></div><p className="dx-muted" style={{ fontSize: 12, marginTop: 9 }}>URL: /opp/checkout/{"{order_id}"}</p></Card></div>
        <div><Card title="Settings"><div className="dx-mrow"><Switch /><div className="tx"><b>Coupon field</b></div></div><div className="dx-mrow"><Switch /><div className="tx"><b>Order bump / upsell</b></div></div><div className="dx-mrow"><Switch /><div className="tx"><b>Ad pixels</b></div></div></Card></div>
      </div>
    </>
  ),

  email: async () => (
    <>
      <Phead title="Email marketing" sub="Brand email, templates, automations." />
      <div className="dx-grid dx-cols">
        <div><Card title="Templates" link="Browse"><Templates items={[{ name: "Welcome", sub: "Email" }, { name: "Abandoned cart", sub: "Email" }, { name: "New product", sub: "Email" }]} /></Card></div>
        <div><Card title="Sending setup"><div className="dx-toolbar" style={{ marginBottom: 12 }}><span className="dx-fchip on">Google Mail</span><span className="dx-fchip">SMTP</span></div><Field label="Gmail address" ph="hello@yourstore.com" /><Field label="App password" ph="••••••••" type="password" /><button className="btn grad" style={{ width: "100%", justifyContent: "center" }}>Save</button></Card></div>
      </div>
    </>
  ),

  seo: async () => (
    <>
      <Phead title="Pixels & SEO" sub="Per-page tracking and search settings." />
      <div className="dx-grid dx-cols">
        <div><Card title="Defaults"><Field label="Default meta title" ph="Your store" /><Field label="Default meta description" ph="Describe your store" /><div className="dx-mrow"><Switch /><div className="tx"><b>Index on Google</b></div></div></Card></div>
        <div><Card title="Ad pixels"><Field label="Meta Pixel ID" ph="123456789012345" /><Field label="Google Ads tag" ph="AW-XXXXXXXX" /><p className="dx-muted" style={{ fontSize: 12, marginTop: 8 }}>Per-page pixels are set inside each builder.</p></Card></div>
      </div>
    </>
  ),

  billing: async () => (
    <>
      <Phead title="Plan & billing" sub="Your subscription and invoices." />
      <div className="dx-grid dx-cols">
        <div><Card title="Invoices"><Table cols={["Invoice", "Date", "Amount", "Status"]} rows={[]} empty="No invoices yet." /></Card></div>
        <div><div className="dx-plan feat"><span className="dx-ribbon">Current</span><div className="dx-fw6">Free</div><div className="pr">₹0 <small>/mo</small></div><ul className="dx-flist"><li>1 page</li><li>100 contacts</li></ul><button className="btn grad" style={{ width: "100%", justifyContent: "center" }}>Upgrade</button></div></div>
      </div>
    </>
  ),

  analytics: async () => analyticsPage("all"),

  // page-type management views (no backend yet)
  // NOTE: `website` has a dedicated route at app/dashboard/website/ (static
  // segment wins over this catch-all), so no stub is needed here.
  // NOTE: `store` has a dedicated route at app/dashboard/store/ (overrides this).
  courses: async () => <PageType title="Courses" sub="Sell and host courses." kpis={[{ icon: "book", color: "var(--primary)", label: "Courses", value: "0" }, { icon: "users", color: "var(--secondary)", label: "Students", value: "0" }]} cols={["Course", "Lessons", "Students", "Price"]} rows={[]} templates={TPL} />,
  booking: async () => <PageType title="1-to-1 booking" sub="Sell consulting slots." kpis={[{ icon: "cal", color: "var(--primary)", label: "Bookings", value: "0" }]} cols={["Service", "Duration", "Price", "Booked"]} rows={[]} templates={TPL} />,
  events: async () => <PageType title="Events" sub="Sell tickets and seats." kpis={[{ icon: "cal", color: "var(--primary)", label: "Events", value: "0" }]} cols={["Event", "Date", "Seats", "Sold"]} rows={[]} templates={TPL} />,
  payment: async () => <PageType title="Payment pages" sub={'Standalone "pay me" links.'} kpis={[{ icon: "card", color: "var(--primary)", label: "Pages", value: "0" }]} cols={["Page", "URL", "Amount", "Paid"]} rows={[]} templates={TPL} />,
  leadform: async () => <PageType title="Lead forms" sub="Capture leads (no payment)." kpis={[{ icon: "form", color: "var(--primary)", label: "Forms", value: "0" }, { icon: "users", color: "var(--secondary)", label: "Leads", value: "0" }]} cols={["Form", "Fields", "Leads"]} rows={[]} templates={TPL} />,
  vip: async () => <PageType title="VIP community" sub="Paid Telegram / WhatsApp access." kpis={[{ icon: "crown", color: "var(--primary)", label: "Communities", value: "0" }]} cols={["Community", "Platform", "Price", "Members"]} rows={[]} templates={TPL} />,
  landing: async () => <PageType title="Landing pages" sub="Campaign pages for your ads." kpis={[{ icon: "rocket", color: "var(--primary)", label: "Pages", value: "0" }]} cols={["Page", "URL", "Visitors", "Conversion"]} rows={[]} templates={TPL} />,
  upsell: async () => (<><Phead title="Upsell" sub="Offer add-ons at checkout." action={<button className="btn grad">+ New offer</button>} /><Card title="Upsell offers"><Table cols={["Trigger product", "Offer", "Discount", "Conversion"]} rows={[]} empty="No upsell offers yet." /></Card></>),
};
