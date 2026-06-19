import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card, Tag, Live } from "@/components/dx/ui";
import ProductCatalog from "@/components/store/ProductCatalog";
import { rowToProduct } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  const { data: page } = await sb.from("pages").select("id, status, content").eq("store_id", store.id).eq("page_type", "store").maybeSingle();
  const published = page?.status === "published";
  const publicUrl = store.subdomain ? `https://${store.subdomain}.invoxai.io/store` : null;

  // Store products = catalog items (separate from one-page `opp` pages).
  const { data: prodRows } = await sb.from("products").select("*").eq("store_id", store.id).order("sort", { ascending: true }).order("created_at", { ascending: false });
  const products = (prodRows ?? []).map(rowToProduct);
  const visibleCount = products.filter((p) => p.store_visible).length;

  // Store analytics from page_events.
  let views = 0, clicks = 0;
  if (page) {
    const { data: events } = await sb.from("page_events").select("kind").eq("page_id", page.id);
    (events ?? []).forEach((e) => { if (e.kind === "view") views++; else clicks++; });
  }

  return (
    <>
      <Phead title="Store" sub="Your storefront — products you add here are sold directly from your store." action={<a className="btn grad" href="/studio/store" target="_blank" rel="noreferrer">{page ? "Open builder ↗" : "Build store ↗"}</a>} />
      <Kpis items={[
        { icon: "eye", color: "var(--primary)", label: "Total views", value: views.toLocaleString("en-IN") },
        { icon: "bag", color: "var(--secondary)", label: "In store", value: String(visibleCount) },
        { icon: "link", color: "var(--green)", label: "Cart clicks", value: clicks.toLocaleString("en-IN") },
        { icon: "chart", color: "var(--accent)", label: "Status", value: published ? "Live" : "Draft" },
      ]} />
      <div className="dx-grid dx-cols">
        <div>
          <Card title="Your store">
            <div className="dx-kv"><span className="dx-fw6">{publicUrl ? `${store.subdomain}.invoxai.io/store` : "—"}</span>{page ? (published ? <Live /> : <Tag kind="neu">Draft</Tag>) : <Tag kind="neu">Not created</Tag>}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <a className="btn grad" href="/studio/store" target="_blank" rel="noreferrer">{page ? "Open builder ↗" : "Build store ↗"}</a>
              {publicUrl && published && <a className="dx-editbtn" href={publicUrl} target="_blank" rel="noreferrer">View ↗</a>}
            </div>
          </Card>
        </div>
        <div>
          <Card title="One-page products">
            <div className="dx-empty" style={{ textAlign: "left", padding: "4px 2px" }}>Need a full landing/checkout page for a product? Build a one-page product — you can start it from any store product below.</div>
            <a className="dx-editbtn" style={{ display: "inline-block", marginTop: 10 }} href="/dashboard/pages/products">Manage one-page products →</a>
          </Card>
        </div>
      </div>
      <div style={{ height: 16 }} />
      <Card title="Store products">
        <ProductCatalog initial={products} />
      </Card>
    </>
  );
}
