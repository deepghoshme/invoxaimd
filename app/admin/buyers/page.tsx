import { createAdminClient } from "@/lib/supabase/admin";
import { Phead, Kpis, Card, Table, Tag } from "@/components/dx/ui";
import ExportButton from "@/components/dx/ExportButton";

export const dynamic = "force-dynamic";

const inr = (paise: number) =>
  "₹" + Math.round(paise / 100).toLocaleString("en-IN");

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default async function BuyersAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "all" } = await searchParams;
  const sb = createAdminClient();

  // ── paid orders: buyer email + name + amount + store + date ──────────────
  const { data: orders } = await sb
    .from("orders")
    .select("buyer_email, buyer_name, amount, store_id, created_at")
    .eq("status", "paid")
    .order("created_at", { ascending: true });

  // ── aggregate per buyer email ─────────────────────────────────────────────
  // Groups: email → { name, orders, spent, firstSeen, stores }
  const byEmail: Record<
    string,
    {
      name: string;
      orders: number;
      spent: number;
      firstSeen: string;
      storeIds: Set<string>;
    }
  > = {};

  (orders ?? []).forEach((o) => {
    const key = (o.buyer_email ?? "").trim().toLowerCase() || "guest";
    if (!byEmail[key]) {
      byEmail[key] = {
        name: o.buyer_name ?? "",
        orders: 0,
        spent: 0,
        firstSeen: o.created_at,
        storeIds: new Set(),
      };
    }
    const b = byEmail[key];
    b.orders++;
    b.spent += o.amount ?? 0;
    // keep earliest date
    if (o.created_at < b.firstSeen) b.firstSeen = o.created_at;
    if (o.store_id) b.storeIds.add(o.store_id);
    // keep most recent non-empty name
    if (o.buyer_name && !b.name) b.name = o.buyer_name;
  });

  // Sort by total spent descending
  const entries = Object.entries(byEmail).sort(
    ([, a], [, b]) => b.spent - a.spent
  );

  // ── KPIs (computed on the full set, not the filtered view) ─────────────────
  const totalBuyers = entries.length;
  const totalSpent = entries.reduce((s, [, v]) => s + v.spent, 0);
  const repeatBuyers = entries.filter(([, v]) => v.orders > 1).length;
  const topBuyer = entries[0];

  // ── filter tab ────────────────────────────────────────────────────────────
  const filteredEntries =
    filter === "repeat"
      ? entries.filter(([, v]) => v.orders > 1)
      : filter === "single"
      ? entries.filter(([, v]) => v.orders === 1)
      : entries;

  // ── CSV export data (reflects the current filter) ──────────────────────────
  const exportRows = filteredEntries.map(([email, v]) => [
    v.name || "—",
    email,
    v.orders,
    Math.round(v.spent / 100),
    v.storeIds.size,
    fmt(v.firstSeen),
    v.orders > 1 ? "Repeat" : "New",
  ] as (string | number | null)[]);

  // ── table rows ────────────────────────────────────────────────────────────
  const rows = filteredEntries.map(([email, v]) => {
    const displayName = v.name || email;
    const initial = displayName[0]?.toUpperCase() ?? "?";

    const repeatTag =
      v.orders > 1 ? (
        <span
          key="r"
          className="dx-pilltag t-paid"
          style={{ fontSize: 10 }}
        >
          Repeat
        </span>
      ) : (
        <Tag key="r" kind="neu">
          New
        </Tag>
      );

    return [
      /* Buyer */
      <span className="dx-tg" key="buyer">
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
        <span>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            {v.name || "—"}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 11.5 }}>{email}</div>
        </span>
      </span>,
      /* Orders */
      <span key="orders" style={{ fontWeight: 600 }}>
        {v.orders}
      </span>,
      /* Total spent */
      <span
        key="spent"
        style={{ fontWeight: 700, color: "var(--text)" }}
      >
        {inr(v.spent)}
      </span>,
      /* Stores bought from */
      <span key="stores" style={{ color: "var(--muted)", fontSize: 12 }}>
        {v.storeIds.size}
      </span>,
      /* First purchase */
      <span key="first" style={{ color: "var(--muted)", fontSize: 12 }}>
        {fmt(v.firstSeen)}
      </span>,
      /* Status */
      repeatTag,
    ];
  });

  return (
    <>
      <Phead
        title="Buyers"
        sub="All distinct buyers from paid orders, grouped by email."
        action={
          <ExportButton
            headers={["Name", "Email", "Orders", "Total spent (₹)", "Stores", "First purchase", "Type"]}
            rows={exportRows}
            filename="invoxai-buyers.csv"
          />
        }
      />

      <Kpis
        items={[
          {
            icon: "bag",
            color: "var(--primary)",
            label: "Total buyers",
            value: String(totalBuyers),
          },
          {
            icon: "rupee",
            color: "var(--secondary)",
            label: "Total buyer spend",
            value: totalSpent > 0 ? inr(totalSpent) : "₹0",
          },
          {
            icon: "users",
            color: "var(--accent)",
            label: "Repeat buyers",
            value: String(repeatBuyers),
          },
          {
            icon: "chart",
            color: "var(--gold)",
            label: "Top buyer spent",
            value: topBuyer ? inr(topBuyer[1].spent) : "—",
          },
        ]}
      />

      <div className="dx-toolbar" style={{ marginBottom: 12 }}>
        <a href="/admin/buyers" className={`dx-fchip${filter === "all" ? " on" : ""}`} style={{ textDecoration: "none" }}>All</a>
        <a href="/admin/buyers?filter=repeat" className={`dx-fchip${filter === "repeat" ? " on" : ""}`} style={{ textDecoration: "none" }}>Repeat</a>
        <a href="/admin/buyers?filter=single" className={`dx-fchip${filter === "single" ? " on" : ""}`} style={{ textDecoration: "none" }}>Single purchase</a>
      </div>

      <Card>
        <Table
          cols={["Buyer", "Orders", "Total spent", "Stores", "First purchase", "Type"]}
          rows={rows}
          empty="No paid orders yet — buyers will appear here once orders complete."
        />
      </Card>

      <p
        className="dx-muted"
        style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.5 }}
      >
        Buyers are derived from paid orders only (guest checkout). A buyer
        account system (profiles linked to orders by email) is planned — once
        wired, name/address data will be richer.
      </p>
    </>
  );
}
