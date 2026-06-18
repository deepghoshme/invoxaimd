import { createClient } from "@/lib/supabase/server";
import { Phead, Kpis, Card, Table, Tag, Live, Buyer, Templates, AreaChart, PageType } from "./ui";
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

async function ctx() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: store } = user
    ? await sb.from("stores").select("id, store_name, subdomain, custom_domain, custom_domain_verified, category_id").eq("owner_id", user.id).maybeSingle()
    : { data: null };
  return { sb, store };
}

const TPL = [{ name: "Aurora", sub: "Bio template" }, { name: "Sunset", sub: "Store template" }, { name: "Bloom", sub: "Landing template" }];

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

  wallet: async () => {
    const { sb } = await ctx();
    const { data: cats } = await sb.from("business_categories").select("name, commission_rate").order("sort_order");
    return (
      <>
        <Phead title="Wallet" sub="Recharge and track commission." action={<button className="btn grad">Recharge</button>} />
        <div className="dx-grid dx-cols">
          <div><Card title="Commission ledger" link="Daily invoices"><Table cols={["Date", "Description", "Type", "Amount"]} rows={[]} empty="No wallet activity yet." /></Card></div>
          <div>
            <div className="dx-card" style={{ background: "var(--grad)", color: "#fff", border: 0, marginBottom: 16 }}><div style={{ fontSize: 12.5, opacity: 0.85 }}>Balance</div><div style={{ fontFamily: "var(--font-sora), sans-serif", fontSize: 28, fontWeight: 700, marginTop: 3 }}>₹0</div><div style={{ fontSize: 11.5, opacity: 0.9, marginTop: 8 }}>Sales pause at ₹0.</div><button className="btn" style={{ marginTop: 12, width: "100%", justifyContent: "center", background: "rgba(255,255,255,.95)", color: "#7a2f1c" }}>Recharge</button></div>
            <Card title="Commission by category">{(cats ?? []).map((c) => <div className="dx-kv" key={c.name}><span>{c.name}</span><span className="dx-fw6">{(Number(c.commission_rate) * 100).toFixed(1)}%</span></div>)}</Card>
          </div>
        </div>
      </>
    );
  },

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

  analytics: async () => (
    <>
      <Phead title="Analytics" sub="Visitors, conversions, devices." />
      <Kpis items={[{ icon: "eye", color: "var(--primary)", label: "Visitors", value: "0" }, { icon: "chart", color: "var(--secondary)", label: "Page views", value: "0" }, { icon: "bag", color: "var(--green)", label: "Conversion", value: "0%" }, { icon: "spark", color: "var(--accent)", label: "Avg time", value: "—" }]} />
      <div className="dx-grid dx-cols">
        <div><Card title="Traffic" link="30 days"><AreaChart /></Card></div>
        <div><Card title="Devices"><div className="dx-empty">No device data yet.</div></Card></div>
      </div>
    </>
  ),

  // page-type management views (no backend yet)
  // NOTE: `website` has a dedicated route at app/dashboard/website/ (static
  // segment wins over this catch-all), so no stub is needed here.
  // NOTE: `store` has a dedicated route at app/dashboard/store/ (overrides this).
  courses: async () => PageType({ title: "Courses", sub: "Sell and host courses.", kpis: [{ icon: "book", color: "var(--primary)", label: "Courses", value: "0" }, { icon: "users", color: "var(--secondary)", label: "Students", value: "0" }], cols: ["Course", "Lessons", "Students", "Price"], rows: [], templates: TPL }),
  booking: async () => PageType({ title: "1-to-1 booking", sub: "Sell consulting slots.", kpis: [{ icon: "cal", color: "var(--primary)", label: "Bookings", value: "0" }], cols: ["Service", "Duration", "Price", "Booked"], rows: [], templates: TPL }),
  events: async () => PageType({ title: "Events", sub: "Sell tickets and seats.", kpis: [{ icon: "cal", color: "var(--primary)", label: "Events", value: "0" }], cols: ["Event", "Date", "Seats", "Sold"], rows: [], templates: TPL }),
  payment: async () => PageType({ title: "Payment pages", sub: "Standalone “pay me” links.", kpis: [{ icon: "card", color: "var(--primary)", label: "Pages", value: "0" }], cols: ["Page", "URL", "Amount", "Paid"], rows: [], templates: TPL }),
  leadform: async () => PageType({ title: "Lead forms", sub: "Capture leads (no payment).", kpis: [{ icon: "form", color: "var(--primary)", label: "Forms", value: "0" }, { icon: "users", color: "var(--secondary)", label: "Leads", value: "0" }], cols: ["Form", "Fields", "Leads"], rows: [], templates: TPL }),
  vip: async () => PageType({ title: "VIP community", sub: "Paid Telegram / WhatsApp access.", kpis: [{ icon: "crown", color: "var(--primary)", label: "Communities", value: "0" }], cols: ["Community", "Platform", "Price", "Members"], rows: [], templates: TPL }),
  landing: async () => PageType({ title: "Landing pages", sub: "Campaign pages for your ads.", kpis: [{ icon: "rocket", color: "var(--primary)", label: "Pages", value: "0" }], cols: ["Page", "URL", "Visitors", "Conversion"], rows: [], templates: TPL }),
  upsell: async () => (<><Phead title="Upsell" sub="Offer add-ons at checkout." action={<button className="btn grad">+ New offer</button>} /><Card title="Upsell offers"><Table cols={["Trigger product", "Offer", "Discount", "Conversion"]} rows={[]} empty="No upsell offers yet." /></Card></>),
};
