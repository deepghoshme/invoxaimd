import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card, Tag, Live } from "@/components/dx/ui";

export const dynamic = "force-dynamic";

export default async function SeoPage() {
  // requireDashboardStore's select includes custom_domain and custom_domain_verified.
  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  // Fetch all pages for SEO overview
  const { data: pages } = await sb
    .from("pages")
    .select("id, page_type, title, status, content")
    .eq("store_id", store.id)
    .order("updated_at", { ascending: false });

  const pageList = pages ?? [];
  const publishedCount = pageList.filter((p) => p.status === "published").length;

  // Get page_events for rough SEO traffic sense
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

  // Build domain info
  const activeBase = store.custom_domain && store.custom_domain_verified
    ? `https://${store.custom_domain}`
    : store.subdomain
      ? `https://${store.subdomain}.invoxai.io`
      : null;

  // Check SEO metadata in page content
  function getSeoMeta(p: { content?: unknown }): { title?: string; description?: string; meta_pixel?: string } {
    const c = (p.content ?? {}) as Record<string, unknown>;
    return {
      title: (c.meta_title || c.title) as string | undefined,
      description: (c.meta_description || c.description) as string | undefined,
      meta_pixel: (c.meta_pixel || c.pixel_id) as string | undefined,
    };
  }

  const pageRows = pageList.map((p) => {
    const seo = getSeoMeta(p);
    const views = viewsByPage[p.id] ?? 0;
    const pathMap: Record<string, string> = {
      website: "/",
      bio: "/bio",
      store: "/store",
    };
    const path = pathMap[p.page_type] || `/opp/${p.id.slice(0, 8)}`;
    return { ...p, seo, views, path };
  });

  return (
    <>
      <Phead
        title="Pixels & SEO"
        sub="Per-page tracking, meta tags, and search visibility."
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
            color: "var(--secondary)",
            label: "Domain",
            value: activeBase
              ? activeBase.replace("https://", "")
              : "Not set",
          },
          {
            icon: "chart",
            color: "var(--accent)",
            label: "Pages with pixel",
            value: String(pageRows.filter((p) => p.seo.meta_pixel).length),
          },
        ]}
      />

      <style>{`
        .seo-table { width: 100%; border-collapse: collapse; }
        .seo-table th {
          text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em;
          text-transform: uppercase; color: var(--muted); padding: 9px 12px;
          border-bottom: 1px solid var(--border);
        }
        .seo-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: middle; }
        .seo-table tr:last-child td { border-bottom: 0; }
        .seo-table tr:hover td { background: var(--surface2); }
        .seo-path { font-family: monospace; font-size: 12px; color: var(--muted); }
        .seo-meta { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .seo-missing { color: var(--secondary); font-size: 12px; }
        .seo-coming {
          background: color-mix(in srgb, var(--accent) 7%, var(--surface));
          border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--border));
          border-radius: 12px; padding: 14px 16px; margin-bottom: 12px;
        }
        .seo-coming b { display: block; margin-bottom: 4px; }
        .seo-coming p { margin: 0; font-size: 13px; color: var(--muted); }
        .seo-field { margin-bottom: 10px; }
        .seo-field label { display: block; font-size: 12px; font-weight: 600; color: var(--muted); margin-bottom: 4px; }
        .seo-field input {
          width: 100%; padding: 9px 12px; border: 1px solid var(--border);
          border-radius: 9px; background: var(--bg); color: var(--text);
          font: inherit; font-size: 13.5px; outline: none;
        }
        .seo-pixel-link {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 12.5px; color: var(--primary); text-decoration: none;
        }
        .seo-pixel-link:hover { text-decoration: underline; }
      `}</style>

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
                    <th>Pixel</th>
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
                      <td style={{ fontWeight: 600 }}>
                        {p.views.toLocaleString("en-IN")}
                      </td>
                      <td>
                        {p.seo.title ? (
                          <span className="seo-meta">{p.seo.title}</span>
                        ) : (
                          <span className="seo-missing">Not set</span>
                        )}
                      </td>
                      <td>
                        {p.seo.meta_pixel ? (
                          <Tag kind="paid">Set</Tag>
                        ) : (
                          <span className="seo-missing">—</span>
                        )}
                      </td>
                      <td>
                        {p.status === "published" ? (
                          <Live />
                        ) : (
                          <Tag kind="neu">Draft</Tag>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
              Set meta title, description, and pixel IDs inside each page builder (builder → SEO tab).
            </p>
          </Card>

          <div style={{ height: 14 }} />

          {/* Store-level pixel defaults */}
          <Card title="Default pixel IDs (store-wide)">
            <div className="seo-coming">
              <b>Global pixel configuration — coming soon</b>
              <p>
                Set default Meta Pixel and Google Ads tag IDs here to fire on all pages automatically.
                Per-page overrides are set inside each page builder.
              </p>
            </div>
            <div className="seo-field">
              <label>Meta Pixel ID (default)</label>
              <input
                placeholder="123456789012345"
                disabled
                style={{ opacity: 0.6, cursor: "not-allowed" }}
              />
            </div>
            <div className="seo-field">
              <label>Google Ads tag (default)</label>
              <input
                placeholder="AW-XXXXXXXXXX"
                disabled
                style={{ opacity: 0.6, cursor: "not-allowed" }}
              />
            </div>
            <div className="seo-field">
              <label>Google Analytics 4 Measurement ID</label>
              <input
                placeholder="G-XXXXXXXXXX"
                disabled
                style={{ opacity: 0.6, cursor: "not-allowed" }}
              />
            </div>
            <button
              className="btn grad"
              disabled
              style={{ opacity: 0.5, cursor: "not-allowed" }}
            >
              Save defaults (coming soon)
            </button>
          </Card>
        </div>

        <div>
          {/* Domain & indexing */}
          <Card title="Domain & indexing">
            <div className="dx-kv">
              <span>Subdomain</span>
              <span className="dx-fw6">
                {store.subdomain
                  ? `${store.subdomain}.invoxai.io`
                  : "—"}
              </span>
            </div>
            <div className="dx-kv">
              <span>Custom domain</span>
              <span className="dx-fw6">
                {store.custom_domain ?? "Not connected"}
              </span>
            </div>
            <div className="dx-kv">
              <span>SSL</span>
              {store.custom_domain
                ? store.custom_domain_verified
                  ? <Live />
                  : <Tag kind="pend">Verifying</Tag>
                : <Tag kind="neu">Subdomain only</Tag>}
            </div>
            <div className="dx-kv">
              <span>Google indexing</span>
              <Tag kind="neu">Auto (coming soon)</Tag>
            </div>
            {activeBase && (
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                Sitemap will be at{" "}
                <a href={`${activeBase}/sitemap.xml`} target="_blank" rel="noreferrer" style={{ color: "var(--primary)" }}>
                  {activeBase.replace("https://", "")}/sitemap.xml
                </a>{" "}
                (auto-generated, not yet live).
              </p>
            )}
            <a href="/dashboard/domains" className="dx-editbtn" style={{ display: "inline-block", marginTop: 10 }}>
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
                label: "Meta title set on website",
                done: pageRows.some(
                  (p) => p.page_type === "website" && p.seo.title
                ),
                link: "/studio/website",
              },
              {
                label: "Meta Pixel configured",
                done: pageRows.some((p) => p.seo.meta_pixel),
                link: pageRows.find((p) => p.seo.meta_pixel)
                  ? undefined
                  : "/studio/website",
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 0",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: item.done ? "var(--green)" : "var(--surface2)",
                    border: `1.5px solid ${item.done ? "var(--green)" : "var(--border)"}`,
                    display: "grid",
                    placeItems: "center",
                    color: item.done ? "#fff" : "var(--muted)",
                    fontSize: 10,
                    fontWeight: 800,
                    flex: "none",
                  }}
                >
                  {item.done ? "✓" : ""}
                </span>
                <span style={{ flex: 1, color: item.done ? "var(--text)" : "var(--muted)" }}>
                  {item.label}
                </span>
                {!item.done && item.link && (
                  <a href={item.link} className="seo-pixel-link">
                    Fix →
                  </a>
                )}
              </div>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}
