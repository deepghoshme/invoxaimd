import { Phead, Card, Table, Tag, Live } from "@/components/dx/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDomainPricing } from "./actions";
import DomainPricingForm from "./DomainPricingForm";
import DomainCancelButton from "./DomainCancelButton";
import Pagination from "@/components/dx/Pagination";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

type DomainRow = {
  id: string;
  domain: string;
  status: string;
  created_at: string;
  stores: { id: string; store_name: string | null; subdomain: string | null } | null;
};

type ExtraSubRow = {
  id: string;
  subdomain: string;
  created_at: string;
  store_id: string;
  stores: { store_name: string | null; subdomain: string | null } | null;
};

// ── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default async function AdminDomainsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // Use admin client so the admin can see ALL custom_domains (owner-only RLS
  // would otherwise restrict to the admin's own stores).
  const sb = createAdminClient();

  const [domainsRes, extrasRes, pricing] = await Promise.all([
    sb
      .from("custom_domains")
      .select("id, domain, status, created_at, stores(id, store_name, subdomain)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),
    sb
      .from("store_subdomains")
      .select("id, subdomain, store_id, created_at, stores(store_name, subdomain)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(0, PAGE_SIZE - 1),
    getDomainPricing(),
  ]);

  const domains = (domainsRes.data ?? []) as unknown as DomainRow[];
  const domainTotal = domainsRes.count ?? 0;

  // Graceful degradation: store_subdomains table may not be applied yet.
  const subdomainsTableMissing =
    extrasRes.error != null &&
    (extrasRes.error.message?.toLowerCase().includes("does not exist") ||
      extrasRes.error.message?.includes("store_subdomains") ||
      (extrasRes.error as { code?: string }).code === "42P01" ||
      (extrasRes.error as { code?: string }).code === "PGRST205");

  const extras = subdomainsTableMissing
    ? []
    : ((extrasRes.data ?? []) as unknown as ExtraSubRow[]);
  const extrasTotal = subdomainsTableMissing ? 0 : (extrasRes.count ?? 0);

  // Status badge
  const statusBadge = (status: string) => {
    switch (status) {
      case "live":     return <Live>Live</Live>;
      case "verified": return <Tag kind="paid">Verified</Tag>;
      case "dns":      return <Tag kind="pend">DNS set</Tag>;
      default:         return <Tag kind="neu">Pending</Tag>;
    }
  };

  const domainRows = domains.map((d) => {
    const store = d.stores;
    const canCancel = d.status !== "pending";
    return [
      <span key="d" style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12.5 }}>{d.domain}</span>,
      <span key="s">{store?.store_name ?? "—"}{store?.subdomain ? <span style={{ color: "var(--muted)", fontSize: 12, marginLeft: 6 }}>{store.subdomain}.invoxai.io</span> : null}</span>,
      statusBadge(d.status),
      <span key="t" style={{ color: "var(--muted)", fontSize: 12 }}>
        {new Date(d.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
      </span>,
      canCancel ? (
        <DomainCancelButton key="c" kind="custom" domainId={d.id} domain={d.domain} />
      ) : (
        <span key="c" style={{ color: "var(--muted)", fontSize: 11.5 }}>—</span>
      ),
    ];
  });

  const extraRows = extras.map((e) => {
    const store = e.stores;
    return [
      <span key="s" style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12.5 }}>{e.subdomain}.invoxai.io</span>,
      <span key="st">{store?.store_name ?? "—"}{store?.subdomain ? <span style={{ color: "var(--muted)", fontSize: 12, marginLeft: 6 }}>({store.subdomain})</span> : null}</span>,
      <span key="t" style={{ color: "var(--muted)", fontSize: 12 }}>
        {new Date(e.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
      </span>,
      <DomainCancelButton key="c" kind="extra" subdomainId={e.id} subdomain={e.subdomain} />,
    ];
  });

  // Status summary counts (current page only — for display convenience)
  const statusCounts = domains.reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1;
    return acc;
  }, {});

  const subRupees = Math.round(pricing.extra_subdomain_paise / 100);
  const domRupees = Math.round(pricing.extra_domain_paise / 100);

  return (
    <>
      <Phead
        title="Domains & subdomains"
        sub={`${domainTotal} custom domain${domainTotal !== 1 ? "s" : ""} · ${extrasTotal} extra subdomain${extrasTotal !== 1 ? "s" : ""} across all stores.`}
      />

      <div className="dx-grid dx-cols" style={{ alignItems: "start" }}>
        {/* Left: full domains table + extra subdomains */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="All custom domains">
            {/* Status filter summary */}
            {domains.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                {(["live", "verified", "dns", "pending"] as const).map((s) => {
                  const count = statusCounts[s] ?? 0;
                  if (count === 0) return null;
                  return (
                    <span key={s} style={{
                      fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
                      background: "var(--surface2)", color: "var(--muted)",
                    }}>
                      {s}: {count}
                    </span>
                  );
                })}
              </div>
            )}
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10, marginTop: 0 }}>
              Cancel disconnects the domain from the store and revokes TLS cert approval. The store itself is unaffected. Action is logged.
            </p>
            <Table
              cols={["Domain", "Store", "Status", "Added", "Action"]}
              rows={domainRows}
              empty="No custom domains connected yet."
            />
            <Pagination page={page} pageSize={PAGE_SIZE} total={domainTotal} baseParams={sp} />
          </Card>

          {/* Extra subdomains table */}
          <Card title={`Extra subdomains${extrasTotal > 0 ? ` (${extrasTotal})` : ""}`}>
            {subdomainsTableMissing ? (
              <p style={{ fontSize: 12.5, color: "var(--muted)" }}>
                The{" "}
                <code style={{ fontFamily: "ui-monospace,monospace", fontSize: 11 }}>store_subdomains</code>{" "}
                table does not exist yet. Apply migration{" "}
                <code style={{ fontFamily: "ui-monospace,monospace", fontSize: 11 }}>
                  20260619220000_cron_plans_subdomains.sql
                </code>{" "}
                to enable this section.
              </p>
            ) : (
              <>
                <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10, marginTop: 0 }}>
                  Additional paid subdomains beyond each store{"'"}s included one. Cancel removes the subdomain mapping; TLS cert approval is revoked. The primary subdomain and store are unaffected.
                </p>
                <Table
                  cols={["Subdomain", "Store", "Added", "Action"]}
                  rows={extraRows}
                  empty="No extra subdomains registered yet."
                />
              </>
            )}
          </Card>
        </div>

        {/* Right: pricing editor */}
        <DomainPricingForm
          subRupees={subRupees}
          domRupees={domRupees}
          migrationPending={pricing.migrationPending}
        />
      </div>
    </>
  );
}
