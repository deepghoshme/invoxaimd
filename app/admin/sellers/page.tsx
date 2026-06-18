import { createAdminClient } from "@/lib/supabase/admin";
import { Phead, Kpis, Card, Table, Tag, Live } from "@/components/dx/ui";

export const dynamic = "force-dynamic";

const inr = (paise: number) =>
  "₹" + Math.round(paise / 100).toLocaleString("en-IN");

/** Small avatar with gradient background showing first initial. */
function SellerAvatar({ name }: { name: string }) {
  const initial = (name ?? "?")[0].toUpperCase();
  return (
    <span
      style={{
        width: 30,
        height: 30,
        borderRadius: "50%",
        background: "var(--grad)",
        color: "#fff",
        display: "inline-grid",
        placeItems: "center",
        fontWeight: 800,
        fontSize: 11,
        fontFamily: "var(--font-sora, Sora, sans-serif)",
        flexShrink: 0,
      }}
    >
      {initial}
    </span>
  );
}

function ActionBtn({
  href,
  external,
  disabled,
  title,
  children,
}: {
  href?: string;
  external?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  if (href && !disabled) {
    return (
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="dx-editbtn"
        title={title}
        style={{ textDecoration: "none" }}
      >
        {children}
      </a>
    );
  }
  return (
    <button
      className="dx-editbtn"
      disabled={disabled}
      title={title ?? "Not yet implemented"}
      style={{ opacity: disabled ? 0.45 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
    >
      {children}
    </button>
  );
}

export default async function SellersAdminPage() {
  const sb = createAdminClient();

  // ── data fetch ────────────────────────────────────────────────────────────
  // Join stores → profiles (owner) → business_categories for plan/category.
  // Orders per store for GMV — one round-trip using .select() then grouping
  // in JS (no DB aggregation on this Supabase tier).
  const [
    { data: stores },
    { data: paidOrders },
    { count: totalSellers },
    { count: totalStores },
  ] = await Promise.all([
    sb
      .from("stores")
      .select(
        `
        id,
        store_name,
        subdomain,
        custom_domain,
        custom_domain_verified,
        owner_id,
        billing,
        created_at,
        category_id,
        business_categories ( name )
      `
      )
      .order("created_at", { ascending: false })
      .limit(200),

    // paid orders for per-store GMV
    sb
      .from("orders")
      .select("store_id, amount")
      .eq("status", "paid"),

    // seller role count
    sb
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "seller"),

    // store count
    sb.from("stores").select("*", { count: "exact", head: true }),
  ]);

  // ── owner profiles (for name/email) ──────────────────────────────────────
  const ownerIds = [...new Set((stores ?? []).map((s) => s.owner_id))];
  const { data: profileRows } =
    ownerIds.length > 0
      ? await sb
          .from("profiles")
          .select("id, email, full_name")
          .in("id", ownerIds)
      : { data: [] };

  const profileMap = Object.fromEntries(
    (profileRows ?? []).map((p) => [p.id, p])
  );

  // ── per-store GMV ─────────────────────────────────────────────────────────
  const storeGmv: Record<string, number> = {};
  (paidOrders ?? []).forEach((o) => {
    storeGmv[o.store_id] = (storeGmv[o.store_id] ?? 0) + (o.amount ?? 0);
  });

  // ── stores with GMV (sorted highest first) ────────────────────────────────
  const sorted = [...(stores ?? [])].sort(
    (a, b) => (storeGmv[b.id] ?? 0) - (storeGmv[a.id] ?? 0)
  );

  // ── table rows ────────────────────────────────────────────────────────────
  const rows = sorted.map((s) => {
    const profile = profileMap[s.owner_id];
    const displayName = s.store_name || profile?.email || s.subdomain || "—";
    const ownerEmail = profile?.email ?? "—";
    const ownerName = profile?.full_name ?? "";

    const billing = s.billing as Record<string, unknown> | null;
    const planName =
      (billing?.plan_name as string) ??
      (billing?.plan as string) ??
      "Free";

    const cat = (
      s.business_categories as { name?: string } | null
    )?.name;

    const gmv = storeGmv[s.id] ?? 0;
    const host = s.custom_domain
      ? s.custom_domain
      : s.subdomain
      ? `${s.subdomain}.invoxai.io`
      : null;

    // Status: a store with a subdomain is considered active
    const statusTag = s.subdomain ? (
      <Live>Active</Live>
    ) : (
      <Tag kind="pend">Setup</Tag>
    );

    const actions = (
      <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {/* Detail page with working suspend + login-as */}
        <ActionBtn href={`/admin/sellers/${s.id}`} title="Open full seller detail">
          Detail
        </ActionBtn>
        {host ? (
          <ActionBtn href={`https://${host}`} external title="View public store">
            View
          </ActionBtn>
        ) : (
          <ActionBtn disabled title="No domain yet">
            View
          </ActionBtn>
        )}
      </span>
    );

    return [
      /* Seller */
      <span className="dx-tg" key="seller">
        <SellerAvatar name={displayName} />
        <span>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{displayName}</div>
          <div style={{ color: "var(--muted)", fontSize: 11.5 }}>
            {ownerName || ownerEmail}
          </div>
        </span>
      </span>,
      /* Subdomain */
      <code
        key="sub"
        style={{
          fontFamily: "ui-monospace, Menlo, monospace",
          fontSize: 11.5,
        }}
      >
        {s.subdomain ? `${s.subdomain}.invoxai.io` : "—"}
      </code>,
      /* Category */
      cat ? (
        <span className="dx-cat" key="cat">
          {cat}
        </span>
      ) : (
        <span className="dx-muted" key="cat" style={{ fontSize: 12 }}>
          —
        </span>
      ),
      /* Plan */
      <span
        key="plan"
        className="dx-pilltag t-neu"
        style={{ fontWeight: 600, fontSize: 11 }}
      >
        {planName}
      </span>,
      /* GMV */
      <span
        key="gmv"
        style={{ fontWeight: 700, color: gmv > 0 ? "var(--text)" : "var(--muted)" }}
      >
        {gmv > 0 ? inr(gmv) : "₹0"}
      </span>,
      /* Status */
      statusTag,
      /* Actions */
      actions,
    ];
  });

  // ── KPI summary ───────────────────────────────────────────────────────────
  const totalGmv = Object.values(storeGmv).reduce((a, b) => a + b, 0);
  const storesWithSales = Object.keys(storeGmv).length;

  return (
    <>
      <Phead
        title="Sellers"
        sub="All stores on the platform, with GMV from paid orders."
        action={
          <button
            className="btn ghost"
            disabled
            title="Export not yet implemented"
            style={{ opacity: 0.6, cursor: "not-allowed" }}
          >
            Export
          </button>
        }
      />

      <Kpis
        items={[
          {
            icon: "users",
            color: "var(--primary)",
            label: "Total sellers",
            value: String(totalSellers ?? 0),
          },
          {
            icon: "layers",
            color: "var(--secondary)",
            label: "Stores created",
            value: String(totalStores ?? 0),
          },
          {
            icon: "rupee",
            color: "var(--accent)",
            label: "Platform GMV",
            value: totalGmv > 0 ? inr(totalGmv) : "₹0",
          },
          {
            icon: "chart",
            color: "var(--gold)",
            label: "Stores with sales",
            value: String(storesWithSales),
          },
        ]}
      />

      <div
        className="dx-toolbar"
        style={{ marginBottom: 12 }}
      >
        <span className="dx-fchip on">All</span>
        <span
          className="dx-fchip"
          title="Filter not yet implemented"
          style={{ opacity: 0.5 }}
        >
          With sales
        </span>
        <span
          className="dx-fchip"
          title="Filter not yet implemented"
          style={{ opacity: 0.5 }}
        >
          No subdomain
        </span>
      </div>

      <Card>
        <Table
          cols={[
            "Seller",
            "Subdomain",
            "Category",
            "Plan",
            "GMV",
            "Status",
            "Actions",
          ]}
          rows={rows}
          empty="No sellers yet."
        />
      </Card>

      <p
        className="dx-muted"
        style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.5 }}
      >
        GMV from paid orders only. Click &quot;Detail&quot; for full profile, working
        Suspend/Unsuspend, and the &quot;Login as&quot; admin impersonation.
      </p>
    </>
  );
}
