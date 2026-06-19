import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card, Tag, Live } from "@/components/dx/ui";
import SeoForm from "./SeoForm";
import type { SeoFormData } from "./actions";

export const dynamic = "force-dynamic";

export default async function SeoPage() {
  const { store, impersonating } = await requireDashboardStore();
  const sb = createAdminClient();

  // Fetch all pages for SEO overview.
  const { data: pages } = await sb
    .from("pages")
    .select("id, page_type, title, status, content, seo, pixels")
    .eq("store_id", store.id)
    .order("updated_at", { ascending: false });

  const pageList = pages ?? [];
  const publishedCount = pageList.filter((p) => p.status === "published").length;

  // Page views from page_events.
  const { data: eventRows } = await sb
    .from("page_events")
    .select("kind, page_id")
    .eq("store_id", store.id);

  const viewsByPage: Record<string, number> = {};
  for (const e of eventRows ?? []) {
    if (e.kind === "view" && e.page_id) {
      viewsByPage[e.page_id] = (viewsByPage[e.page_id] ?? 0) + 1;
    }
  }
  const totalViews = Object.values(viewsByPage).reduce((s, v) => s + v, 0);

  // Domain info.
  const activeBase =
    store.custom_domain && store.custom_domain_verified
      ? `https://${store.custom_domain}`
      : store.subdomain
      ? `https://${store.subdomain}.invoxai.io`
      : null;

  // Load store-level SEO defaults — graceful if columns don't exist yet.
  type StoreRow = {
    default_meta_title?: string | null;
    default_meta_description?: string | null;
    og_image_url?: string | null;
    meta_pixel_id?: string | null;
    google_analytics_id?: string | null;
    google_ads_id?: string | null;
    seo_indexable?: boolean | null;
  };
  const { data: storeRow } = await sb
    .from("stores")
    .select(
      "default_meta_title, default_meta_description, og_image_url, meta_pixel_id, google_analytics_id, google_ads_id, seo_indexable",
    )
    .eq("id", store.id)
    .maybeSingle()
    .then((r) => ({ data: (r.data ?? {}) as StoreRow }));

  const seoInitial: SeoFormData = {
    default_meta_title: storeRow.default_meta_title ?? "",
    default_meta_description: storeRow.default_meta_description ?? "",
    og_image_url: storeRow.og_image_url ?? "",
    meta_pixel_id: storeRow.meta_pixel_id ?? "",
    google_analytics_id: storeRow.google_analytics_id ?? "",
    google_ads_id: storeRow.google_ads_id ?? "",
    seo_indexable: storeRow.seo_indexable ?? true,
  };

  // Pixel counts for KPIs.
  const storePixelSet = !!(
    seoInitial.meta_pixel_id ||
    seoInitial.google_analytics_id ||
    seoInitial.google_ads_id
  );

  // Build page rows for table.
  function getSeoMeta(p: { seo?: unknown; content?: unknown; pixels?: unknown }): {
    title?: string;
    description?: string;
    meta_pixel?: string;
  } {
    const s = (p.seo ?? {}) as Record<string, string>;
    const c = (p.content ?? {}) as Record<string, unknown>;
    const cs = (c.seo ?? {}) as Record<string, string>;
    const px = (p.pixels ?? {}) as Record<string, string>;
    return {
      title: s.title || cs.title || (c.meta_title as string) || undefined,
      description: s.description || cs.description || undefined,
      meta_pixel: px.meta_pixel_id || (s.meta_pixel as string) || undefined,
    };
  }

  const pageRows = pageList.map((p) => {
    const seo = getSeoMeta(p);
    const views = viewsByPage[p.id] ?? 0;
    const pathMap: Record<string, string> = { website: "/", bio: "/bio", store: "/store" };
    const path = pathMap[p.page_type] ?? `/opp/${p.id.slice(0, 8)}`;
    return { ...p, seo, views, path };
  });

  return (
    <>
      <Phead
        title="Pixels & SEO"
        sub="Store-wide defaults for tracking pixels, search metadata, and social cards."
      />

      <Kpis
        items={[
          {
            icon: "globe",
            color: "var(--primary)",
            label: "Published pages",
            value: `${publishedCount} / ${pageList.length}`,
          },
          {
            icon: "eye",
            color: "var(--green)",
            label: "Total page views",
            value: totalViews.toLocaleString("en-IN"),
          },
          {
            icon: "pixel",
            color: storePixelSet ? "var(--primary)" : "var(--muted)",
            label: "Store pixels",
            value: storePixelSet ? "Active" : "Not set",
          },
          {
            icon: "chart",
            color: "var(--accent)",
            label: "Domain",
            value: activeBase ? activeBase.replace("https://", "") : "Not set",
          },
        ]}
      />

      {/* Store-level SEO + pixel form (live Google/OG preview on the right). */}
      <SeoForm
        initial={seoInitial}
        storeName={store.store_name ?? ""}
        activeBase={activeBase}
        impersonating={!!impersonating}
      />

      <style>{`
        .seo-table { width: 100%; border-collapse: collapse; }
        .seo-table th {
          text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em;
          text-transform: uppercase; color: var(--muted); padding: 9px 12px;
          border-bottom: 1px solid var(--border);
        }
        .seo-table td {
          padding: 10px 12px; border-bottom: 1px solid var(--border);
          font-size: 13px; vertical-align: middle;
        }
        .seo-table tr:last-child td { border-bottom: 0; }
        .seo-table tr:hover td { background: var(--surface2); }
        .seo-path { font-family: monospace; font-size: 12px; color: var(--muted); }
        .seo-meta { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .seo-missing { color: var(--secondary); font-size: 12px; }
        .seo-pixel-link {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 12.5px; color: var(--primary); text-decoration: none;
        }
        .seo-pixel-link:hover { text-decoration: underline; }
      `}</style>

      <div style={{ height: 20 }} />

      <div className="dx-grid dx-cols">
        <div>
          {/* Pages SEO overview */}
          <Card title="Pages SEO overview">
            {pageList.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: 13, padding: "16px 0" }}>
                No pages yet. Create a website, bio page, or product to manage SEO.
              </div>
            ) : (
              <table className="seo-table">
                <thead>
                  <tr>
                    <th>Page</th>
                    <th>Path</th>
                    <th>Views</th>
                    <th>Meta title</th>
                    <th>Page pixel</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, textTransform: "capitalize" }}>
                        {p.page_type === "opp" ? "Product page" : p.page_type}
                      </td>
                      <td>
                        <span className="seo-path">{p.path}</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{p.views.toLocaleString("en-IN")}</td>
                      <td>
                        {p.seo.title ? (
                          <span className="seo-meta">{p.seo.title}</span>
                        ) : (
                          <span className="seo-missing">Store default</span>
                        )}
                      </td>
                      <td>
                        {p.seo.meta_pixel ? (
                          <Tag kind="paid">Override</Tag>
                        ) : storePixelSet ? (
                          <Tag kind="neu">Store default</Tag>
                        ) : (
                          <span className="seo-missing">—</span>
                        )}
                      </td>
                      <td>
                        {p.status === "published" ? <Live /> : <Tag kind="neu">Draft</Tag>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
              Set meta title, description, and pixel overrides inside each page builder (builder → SEO tab).
              Store-wide defaults above apply where no page-level value is set.
            </p>
          </Card>
        </div>

        <div>
          {/* Domain & indexing */}
          <Card title="Domain & indexing">
            <div className="dx-kv">
              <span>Subdomain</span>
              <span className="dx-fw6">
                {store.subdomain ? `${store.subdomain}.invoxai.io` : "—"}
              </span>
            </div>
            <div className="dx-kv">
              <span>Custom domain</span>
              <span className="dx-fw6">{store.custom_domain ?? "Not connected"}</span>
            </div>
            <div className="dx-kv">
              <span>SSL</span>
              {store.custom_domain ? (
                store.custom_domain_verified ? <Live /> : <Tag kind="pend">Verifying</Tag>
              ) : (
                <Tag kind="neu">Subdomain only</Tag>
              )}
            </div>
            <div className="dx-kv">
              <span>Search indexing</span>
              {seoInitial.seo_indexable ? (
                <Tag kind="paid">Allowed</Tag>
              ) : (
                <Tag kind="neu">Blocked (noindex)</Tag>
              )}
            </div>
            {activeBase && (
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                Sitemap:{" "}
                <a
                  href={`${activeBase}/sitemap.xml`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--primary)" }}
                >
                  {activeBase.replace("https://", "")}/sitemap.xml
                </a>
              </p>
            )}
            <a
              href="/dashboard/domains"
              className="dx-editbtn"
              style={{ display: "inline-block", marginTop: 10 }}
            >
              Manage domains →
            </a>
          </Card>

          <div style={{ height: 14 }} />

          {/* SEO checklist */}
          <Card title="SEO checklist">
            {[
              {
                label: "Custom domain connected",
                done: !!(store.custom_domain && store.custom_domain_verified),
                link: "/dashboard/domains",
              },
              {
                label: "Website published",
                done: pageList.some((p) => p.page_type === "website" && p.status === "published"),
                link: "/studio/website",
              },
              {
                label: "Bio page published",
                done: pageList.some((p) => p.page_type === "bio" && p.status === "published"),
                link: "/studio/bio",
              },
              {
                label: "Store published",
                done: pageList.some((p) => p.page_type === "store" && p.status === "published"),
                link: "/studio/store",
              },
              {
                label: "Default meta title set",
                done: !!seoInitial.default_meta_title,
                link: undefined,
              },
              {
                label: "OG image uploaded",
                done: !!seoInitial.og_image_url,
                link: undefined,
              },
              {
                label: "Meta Pixel or GA4 configured",
                done: !!(seoInitial.meta_pixel_id || seoInitial.google_analytics_id),
                link: undefined,
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 0", borderBottom: "1px solid var(--border)", fontSize: 13,
                }}
              >
                <span
                  style={{
                    width: 18, height: 18, borderRadius: "50%", flex: "none",
                    background: item.done ? "var(--green)" : "var(--surface2)",
                    border: `1.5px solid ${item.done ? "var(--green)" : "var(--border)"}`,
                    display: "grid", placeItems: "center",
                    color: item.done ? "#fff" : "var(--muted)",
                    fontSize: 10, fontWeight: 800,
                  }}
                >
                  {item.done ? "✓" : ""}
                </span>
                <span style={{ flex: 1, color: item.done ? "var(--text)" : "var(--muted)" }}>
                  {item.label}
                </span>
                {!item.done && item.link && (
                  <a href={item.link} className="seo-pixel-link">Fix →</a>
                )}
              </div>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}
