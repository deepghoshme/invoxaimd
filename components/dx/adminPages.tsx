import { createClient } from "@/lib/supabase/server";
import { Phead, Kpis, Card, Table, Tag, Cat, Live, Buyer, Bars, LineChart } from "./ui";

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

export const ADMIN_PAGES: Record<string, () => Promise<React.ReactNode>> = {
  overview: async () => {
    const sb = await createClient();
    const [{ count: users }, { count: stores }, { count: sellers }, { data: paid }] = await Promise.all([
      sb.from("profiles").select("*", { count: "exact", head: true }),
      sb.from("stores").select("*", { count: "exact", head: true }),
      sb.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "seller"),
      sb.from("orders").select("amount, commission_amount").eq("status", "paid"),
    ]);
    const revenue = (paid ?? []).reduce((s, o) => s + (o.amount ?? 0), 0);
    const commission = (paid ?? []).reduce((s, o) => s + (o.commission_amount ?? 0), 0);
    return (
      <>
        <Phead title="Platform overview" sub="Everything across invoxai.io." />
        <Kpis items={[{ icon: "rupee", color: "var(--primary)", label: "GMV (paid)", value: inr(revenue) }, { icon: "users", color: "var(--secondary)", label: "Sellers", value: String(sellers ?? 0) }, { icon: "user", color: "var(--accent)", label: "Users", value: String(users ?? 0) }, { icon: "wallet", color: "var(--gold)", label: "Commission", value: inr(commission) }]} />
        <div className="dx-grid dx-cols">
          <div><Card title="Revenue by stream" link="This month"><Bars /></Card></div>
          <div><Card title="Seller growth"><LineChart /></Card></div>
        </div>
      </>
    );
  },

  revenue: async () => {
    const sb = await createClient();
    const { data: paid } = await sb.from("orders").select("amount, commission_amount").eq("status", "paid");
    const revenue = (paid ?? []).reduce((s, o) => s + (o.amount ?? 0), 0);
    const commission = (paid ?? []).reduce((s, o) => s + (o.commission_amount ?? 0), 0);
    return (
      <>
        <Phead title="Revenue" sub="Income across all six streams." action={<button className="btn ghost">Export</button>} />
        <Kpis items={[{ icon: "rupee", color: "var(--primary)", label: "GMV (paid)", value: inr(revenue) }, { icon: "wallet", color: "var(--gold)", label: "Commission", value: inr(commission) }, { icon: "chart", color: "var(--secondary)", label: "Subscriptions", value: "₹0" }, { icon: "tag", color: "var(--accent)", label: "Add-ons", value: "₹0" }]} />
        <div className="dx-grid dx-cols">
          <div><Card title="By stream"><Bars /></Card></div>
          <div><Card title="Breakdown">{[["Commission", inr(commission)], ["Subscriptions", "₹0"], ["Contact overage", "₹0"], ["Premium templates", "₹0"], ["Extra subdomains", "₹0"], ["Extra domains", "₹0"]].map((x) => <div className="dx-kv" key={x[0]}><span>{x[0]}</span><span className="dx-fw6">{x[1]}</span></div>)}</Card></div>
        </div>
      </>
    );
  },

  sellers: async () => {
    const sb = await createClient();
    const { data: stores } = await sb.from("stores").select("store_name, subdomain, custom_domain, business_categories(name)").order("created_at", { ascending: false }).limit(100);
    const rows = (stores ?? []).map((s) => { const cat = (s.business_categories as { name?: string } | null)?.name; return [<Buyer key="b" emoji="🏬" name={s.store_name || "Store"} />, s.subdomain || "—", cat ? <Cat key="c">{cat}</Cat> : "—", s.custom_domain ? <Live key="l">Domain</Live> : <Tag key="t" kind="neu">Subdomain</Tag>]; });
    return (
      <>
        <Phead title="Sellers" sub="All sellers on the platform." action={<button className="btn ghost">Export</button>} />
        <Kpis items={[{ icon: "users", color: "var(--primary)", label: "Stores", value: String(stores?.length ?? 0) }]} />
        <div className="dx-toolbar"><span className="dx-fchip on">All</span><span className="dx-fchip">Paid</span><span className="dx-fchip">Trial</span><Search placeholder="Search sellers…" /></div>
        <Card><Table cols={["Seller", "Subdomain", "Category", "Domain"]} rows={rows} empty="No sellers yet." /></Card>
      </>
    );
  },

  buyers: async () => {
    const sb = await createClient();
    const { data: orders } = await sb.from("orders").select("buyer_email, amount").eq("status", "paid");
    const by: Record<string, { orders: number; spent: number }> = {};
    (orders ?? []).forEach((o) => { const e = o.buyer_email || "guest"; by[e] = by[e] || { orders: 0, spent: 0 }; by[e].orders++; by[e].spent += o.amount ?? 0; });
    const rows = Object.entries(by).map(([email, v]) => [<Buyer key="b" emoji="🛍️" name={email} />, String(v.orders), inr(v.spent)]);
    return (
      <>
        <Phead title="Buyers" sub="Everyone who purchased." action={<button className="btn ghost">Export</button>} />
        <Kpis items={[{ icon: "bag", color: "var(--primary)", label: "Buyers", value: String(Object.keys(by).length) }]} />
        <div className="dx-toolbar"><span className="dx-fchip on">All</span><span className="dx-fchip">Repeat</span><Search placeholder="Search buyers…" /></div>
        <Card><Table cols={["Buyer", "Orders", "Total spent"]} rows={rows} empty="No buyers yet." /></Card>
      </>
    );
  },

  plans: async () => (
    <>
      <Phead title="Plans & Features" sub="Pricing, limits, and access." action={<button className="btn grad">+ New plan</button>} />
      <div className="dx-grid dx-g3">
        {[["Free", "₹0", "/forever", ["1 page", "100 contacts"], false], ["Starter", "₹499", "/mo", ["10 pages", "1,000 contacts", "Custom domain"], true], ["Pro", "₹1,999", "/mo", ["Unlimited", "10,000 contacts", "3 domains"], false]].map((p) => (
          <div className={`dx-plan${p[4] ? " feat" : ""}`} key={p[0] as string}>{p[4] ? <span className="dx-ribbon">Popular</span> : null}<div className="dx-fw6">{p[0] as string}</div><div className="pr">{p[1] as string} <small>{p[2] as string}</small></div><ul className="dx-flist">{(p[3] as string[]).map((f) => <li key={f}>{f}</li>)}</ul><button className="dx-editbtn" style={{ width: "100%" }}>Edit</button></div>
        ))}
      </div>
    </>
  ),

  commission: async () => {
    const sb = await createClient();
    const { data: cats } = await sb.from("business_categories").select("name, commission_rate").order("sort_order");
    const rows = (cats ?? []).map((c) => [c.name, `${(Number(c.commission_rate) * 100).toFixed(1)}%`, <button key="e" className="dx-editbtn">Edit</button>]);
    return (<><Phead title="Commission" sub="Per-category commission rates." /><Card title="Rates by category"><Table cols={["Category", "Rate", "Action"]} rows={rows} empty="No categories." /></Card></>);
  },

  limits: async () => (<><Phead title="Contact limits & overage" sub="Plan contact limits and overage pricing." /><Card title="Limits"><Table cols={["Plan", "Contact limit", "Overage"]} rows={[["Free", "100", "—"], ["Starter", "1,000", "₹10 / extra"], ["Pro", "10,000", "₹10 / extra"]]} /></Card></>),

  templates: async () => (
    <>
      <Phead title="Templates" sub="Library and pricing." action={<button className="btn grad">+ New template</button>} />
      <div className="dx-grid dx-g3">
        {["Aurora", "Sunset Store", "Scholar", "Booklet", "Gala", "Pitch"].map((t) => (
          <div className="dx-tmpl" key={t}><div className="thumb" /><div className="mt"><b>{t}</b><div className="u">Template</div><div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span className="dx-pilltag t-neu">Draft</span><button className="dx-editbtn">Edit</button></div></div></div>
        ))}
      </div>
    </>
  ),

  promo: async () => (<><Phead title="Promo codes" sub="Discount codes for plan purchases." action={<button className="btn grad">+ New code</button>} /><Card title="Plan promo codes"><Table cols={["Code", "Discount", "Used", "Status"]} rows={[]} empty="No promo codes yet." /></Card></>),

  domains: async () => {
    const sb = await createClient();
    const { data: stores } = await sb.from("stores").select("store_name, custom_domain, custom_domain_verified").not("custom_domain", "is", null);
    const rows = (stores ?? []).map((s) => [s.custom_domain, s.store_name || "—", s.custom_domain_verified ? <Live key="l" /> : <Tag key="t" kind="pend">Pending</Tag>]);
    return (
      <>
        <Phead title="Domains & subdomains" sub="Across the platform." />
        <div className="dx-grid dx-cols">
          <div><Card title="Custom domains"><Table cols={["Domain", "Seller", "Status"]} rows={rows} empty="No custom domains connected." /></Card></div>
          <div><Card title="Pricing"><div className="dx-kv"><span>Extra subdomain</span><span className="dx-fw6">₹199</span></div><div className="dx-kv"><span>Extra domain</span><span className="dx-fw6">₹299</span></div></Card></div>
        </div>
      </>
    );
  },

  emails: async () => (
    <>
      <Phead title="Emails" sub="Transactional templates and sending." />
      <div className="dx-grid dx-cols">
        <div><Card title="Transactional emails">{[["OTP code", "On login"], ["Welcome", "New signup"], ["Payment confirmation", "On payment"], ["Daily wallet invoice", "11 PM"]].map((e) => <div className="dx-mrow" key={e[0]}><div className="tx"><b>{e[0]}</b><p>{e[1]}</p></div><Switch /></div>)}</Card></div>
        <div><Card title="Sending setup"><div className="dx-toolbar" style={{ marginBottom: 12 }}><span className="dx-fchip on">SMTP</span><span className="dx-fchip">Google Mail</span></div><Field label="From email" value="no-reply@invoxai.io" /><button className="btn grad" style={{ width: "100%", justifyContent: "center" }}>Save</button></Card></div>
      </div>
    </>
  ),

  branding: async () => (<><Phead title="Branding" sub="Logo, favicon, and invoice template." /><Card title="Brand assets"><div className="dx-ff"><div className="dx-field"><label>Logo</label><input type="file" /></div><div className="dx-field"><label>Favicon</label><input type="file" /></div></div><div className="dx-field"><label>Invoice template</label><select><option>Sunset (default)</option><option>Minimal</option></select></div><button className="btn grad">Save branding</button></Card></>),

  gateways: async () => (<><Phead title="Payment gateways" sub="Platform billing gateways." /><Card title="Platform gateways">{[["Razorpay", false], ["Cashfree", false]].map((g) => <div className="dx-kv" key={g[0] as string}><span className="dx-fw6">{g[0] as string}</span><button className="dx-editbtn">Connect</button></div>)}</Card></>),

  maintenance: async () => (<><Phead title="Maintenance & controls" sub="Platform-wide switches." /><Card title="Controls"><div className="dx-mrow"><Switch on={false} /><div className="tx"><b>Maintenance mode</b><p>Show maintenance page to everyone.</p></div></div><div className="dx-mrow"><Switch /><div className="tx"><b>New signups</b><p>Allow new sellers to register.</p></div></div></Card></>),

  settings: async () => {
    const sb = await createClient();
    const { data: reserved } = await sb.from("reserved_subdomains").select("name").order("name");
    return (
      <>
        <Phead title="Settings" sub="General platform settings." />
        <div className="dx-grid dx-cols">
          <div><Card title="General"><Field label="Platform name" value="invoxai" /><Field label="Support email" value="support@invoxai.io" /><button className="btn grad">Save</button></Card></div>
          <div><Card title="Security"><div className="dx-kv"><span>Reserved subdomains</span><span className="dx-fw6">{reserved?.length ?? 0}</span></div><p className="dx-muted" style={{ fontSize: 12.5, marginTop: 8 }}>{(reserved ?? []).map((r) => r.name).join(", ")}</p></Card></div>
        </div>
      </>
    );
  },
};
