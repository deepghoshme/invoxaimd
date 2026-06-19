import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card, Tag, Live } from "@/components/dx/ui";
import Pagination from "@/components/dx/Pagination";
import ExtraSubdomains from "./ExtraSubdomains";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function DomainsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // requireDashboardStore's base select includes custom_domain, custom_domain_verified,
  // primary_domain — all fields this page needs from the store row.
  const { store } = await requireDashboardStore();

  // Fetch custom_domains table if it exists (paginated)
  let customDomains: { domain: string; status: string; created_at: string }[] = [];
  let domainTotal = 0;
  try {
    const admin = createAdminClient();
    const { data, error, count } = await admin
      .from("custom_domains")
      .select("domain, status, created_at", { count: "exact" })
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (!error && data) {
      customDomains = data;
      domainTotal = count ?? 0;
    }
  } catch {}

  // Fetch extra subdomains via session client (owner-read RLS)
  let extraSubdomains: { id: string; subdomain: string; created_at: string }[] = [];
  try {
    const sessionClient = await createClient();
    const { data } = await sessionClient
      .from("store_subdomains")
      .select("id, subdomain, created_at")
      .eq("store_id", store.id)
      .order("created_at", { ascending: true });
    if (data) extraSubdomains = data;
  } catch {}

  const subdomain = store.subdomain;
  const subdomainUrl = subdomain ? `https://${subdomain}.invoxai.io` : null;
  const customVerified = store.custom_domain && store.custom_domain_verified;
  const primaryDomain = store.primary_domain ?? "subdomain";

  const activeDomain = customVerified
    ? store.custom_domain
    : subdomainUrl
      ? `${subdomain}.invoxai.io`
      : null;

  return (
    <>
      <Phead
        title="Domains"
        sub="Subdomain and custom domain for your store."
        action={
          <Link href="/dashboard/domains/connect" className="btn grad">
            + Connect custom domain
          </Link>
        }
      />

      <Kpis
        items={[
          {
            icon: "globe",
            color: "var(--primary)",
            label: "Active domain",
            value: activeDomain ? activeDomain.replace("https://", "") : "None",
          },
          {
            icon: "link",
            color: "var(--green)",
            label: "Subdomain",
            value: subdomain ? `${subdomain}.invoxai.io` : "—",
          },
          {
            icon: "globe",
            color: "var(--accent)",
            label: "Custom domain",
            value: store.custom_domain ?? "Not connected",
          },
          {
            icon: "shield",
            color: "var(--secondary)",
            label: "SSL status",
            value: customVerified ? "Active" : store.custom_domain ? "Pending" : "N/A",
          },
        ]}
      />

      <style>{`
        .dom-codebox {
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 9px; padding: 10px 14px; font-family: monospace;
          font-size: 12.5px; color: var(--text); word-break: break-all;
          margin: 8px 0;
        }
        .dom-dns { display: flex; flex-direction: column; gap: 8px; margin: 10px 0; }
        .dom-dnsrow {
          display: flex; gap: 10px; font-size: 12.5px;
          background: var(--surface2); border-radius: 8px; padding: 8px 12px;
        }
        .dom-dnsrow .lbl { color: var(--muted); width: 60px; flex: none; font-weight: 600; }
        .dom-hist { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
        .dom-histrow {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border: 1px solid var(--border);
          border-radius: 10px; background: var(--surface); font-size: 13px;
        }
        .dom-histrow b { flex: 1; }
        .dom-hint { font-size: 12px; color: var(--muted); margin-top: 6px; }
        .dom-primary-badge {
          font-size: 11px; font-weight: 700; padding: 3px 9px;
          background: color-mix(in srgb, var(--primary) 12%, transparent);
          color: var(--primary); border-radius: 99px;
        }
      `}</style>

      <div className="dx-grid dx-cols">
        <div>
          {/* Subdomain card */}
          <Card title="Subdomain">
            <div className="dx-kv">
              <span className="dx-fw6">
                {subdomain ? `${subdomain}.invoxai.io` : "Not set"}
              </span>
              {subdomain ? <Live /> : <Tag kind="neu">—</Tag>}
            </div>
            {primaryDomain === "subdomain" && (
              <div className="dx-kv">
                <span style={{ fontSize: 12, color: "var(--green)", fontWeight: 600 }}>
                  Primary domain
                </span>
                <span className="dom-primary-badge">Active</span>
              </div>
            )}
            <p className="dom-hint">
              Your store is accessible at{" "}
              {subdomain ? (
                <a href={subdomainUrl!} target="_blank" rel="noreferrer" style={{ color: "var(--primary)" }}>
                  {subdomain}.invoxai.io
                </a>
              ) : (
                "— complete onboarding to claim your subdomain"
              )}
            </p>
          </Card>

          <div style={{ height: 14 }} />

          {/* Extra subdomains card */}
          <Card title="Extra subdomains">
            <p
              style={{
                fontSize: 12.5,
                color: "var(--muted)",
                marginBottom: 12,
                marginTop: 2,
              }}
            >
              Add alias subdomains that point to the same store. Useful for
              campaign links, A/B landing pages, or branded entry points — all
              resolve to your store automatically.
            </p>
            <ExtraSubdomains initial={extraSubdomains} />
          </Card>

          <div style={{ height: 14 }} />

          {/* Custom domain card */}
          <Card title="Custom domain">
            {store.custom_domain ? (
              <>
                <div className="dx-kv">
                  <span className="dx-fw6">{store.custom_domain}</span>
                  {store.custom_domain_verified ? (
                    <Live />
                  ) : (
                    <Tag kind="pend">Verifying</Tag>
                  )}
                </div>
                {primaryDomain === "custom" && (
                  <div className="dx-kv">
                    <span style={{ fontSize: 12, color: "var(--green)", fontWeight: 600 }}>
                      Primary domain
                    </span>
                    <span className="dom-primary-badge">Active</span>
                  </div>
                )}
                {!store.custom_domain_verified && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8 }}>
                      Add these DNS records at your domain registrar:
                    </p>
                    <div className="dom-dns">
                      <div className="dom-dnsrow">
                        <span className="lbl">Type</span>
                        <span>CNAME</span>
                      </div>
                      <div className="dom-dnsrow">
                        <span className="lbl">Name</span>
                        <span>@ (or www)</span>
                      </div>
                      <div className="dom-dnsrow">
                        <span className="lbl">Value</span>
                        <span>cname.invoxai.io</span>
                      </div>
                    </div>
                    <p style={{ fontSize: 11.5, color: "var(--muted)" }}>
                      DNS propagation can take up to 24 hours. SSL is issued automatically after verification.
                    </p>
                  </div>
                )}
                <div style={{ marginTop: 12 }}>
                  <Link href="/dashboard/domains/connect" className="dx-editbtn">
                    Manage custom domain →
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
                  No custom domain connected. Point your own domain at invoxai — SSL is issued automatically.
                </p>
                <div className="dom-codebox">CNAME @ → cname.invoxai.io</div>
                <Link href="/dashboard/domains/connect" className="btn grad" style={{ display: "inline-flex", marginTop: 10 }}>
                  + Connect custom domain
                </Link>
              </>
            )}
          </Card>
        </div>

        <div>
          {/* Domain history from custom_domains table */}
          <Card title="Domain history">
            {customDomains.length === 0 ? (
              <div className="dx-empty">
                No custom domains configured yet.
              </div>
            ) : (
              <>
                <div className="dom-hist">
                  {customDomains.map((d, i) => (
                    <div key={i} className="dom-histrow">
                      <b>{d.domain}</b>
                      {d.status === "active" ? (
                        <Live />
                      ) : (
                        <Tag kind="pend">{d.status}</Tag>
                      )}
                      <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                        {new Date(d.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
                {domainTotal > PAGE_SIZE && (
                  <Pagination page={page} pageSize={PAGE_SIZE} total={domainTotal} baseParams={sp} />
                )}
              </>
            )}
          </Card>

          <div style={{ height: 14 }} />

          {/* Helpful tips */}
          <Card title="Tips">
            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
              <div>
                <b style={{ display: "block", marginBottom: 3 }}>Use www for best compatibility</b>
                <p style={{ color: "var(--muted)", fontSize: 12.5, margin: 0 }}>
                  Point <code>www.yourdomain.com</code> with a CNAME to <code>cname.invoxai.io</code>. Then redirect the apex (<code>@</code>) to www at your registrar.
                </p>
              </div>
              <div>
                <b style={{ display: "block", marginBottom: 3 }}>SSL is automatic</b>
                <p style={{ color: "var(--muted)", fontSize: 12.5, margin: 0 }}>
                  Once DNS is verified, a Let{"'"}s Encrypt certificate is issued within minutes. No manual steps needed.
                </p>
              </div>
              <div>
                <b style={{ display: "block", marginBottom: 3 }}>Supported registrars</b>
                <p style={{ color: "var(--muted)", fontSize: 12.5, margin: 0 }}>
                  Works with GoDaddy, Namecheap, Cloudflare, Google Domains, BigRock, and all other registrars that support CNAME records.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
