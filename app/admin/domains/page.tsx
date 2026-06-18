import { Phead, Card, Table, Tag, Live } from "@/components/dx/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDomainPricing } from "./actions";
import DomainPricingForm from "./DomainPricingForm";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

type DomainRow = {
  id: string;
  domain: string;
  status: string;
  created_at: string;
  stores: { store_name: string | null; subdomain: string | null } | null;
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminDomainsPage() {
  // Use admin client so the admin can see ALL custom_domains (owner-only RLS
  // would otherwise restrict to the admin's own stores).
  const sb = createAdminClient();

  const [domainsRes, pricing] = await Promise.all([
    sb
      .from("custom_domains")
      .select("id, domain, status, created_at, stores(store_name, subdomain)")
      .order("created_at", { ascending: false }),
    getDomainPricing(),
  ]);

  const domains = (domainsRes.data ?? []) as unknown as DomainRow[];

  // Status badge
  const statusBadge = (status: string) => {
    switch (status) {
      case "live":     return <Live>Live</Live>;
      case "verified": return <Tag kind="paid">Verified</Tag>;
      case "dns":      return <Tag kind="pend">DNS set</Tag>;
      default:         return <Tag kind="neu">Pending</Tag>;
    }
  };

  const rows = domains.map((d) => {
    const store = d.stores;
    return [
      <span key="d" style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12.5 }}>{d.domain}</span>,
      <span key="s">{store?.store_name ?? "—"}{store?.subdomain ? <span style={{ color: "var(--muted)", fontSize: 12, marginLeft: 6 }}>{store.subdomain}.invoxai.io</span> : null}</span>,
      statusBadge(d.status),
      <span key="t" style={{ color: "var(--muted)", fontSize: 12 }}>
        {new Date(d.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
      </span>,
    ];
  });

  // Status summary counts
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
        sub={`${domains.length} custom domain${domains.length !== 1 ? "s" : ""} connected across all stores.`}
      />

      <div className="dx-grid dx-cols" style={{ alignItems: "start" }}>
        {/* Left: full domains table */}
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
          <Table
            cols={["Domain", "Store", "Status", "Added"]}
            rows={rows}
            empty="No custom domains connected yet."
          />
        </Card>

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
