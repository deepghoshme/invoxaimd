import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Phead } from "@/components/dx/ui";
import SellerActions from "./SellerActions";

export const dynamic = "force-dynamic";

// ── Formatters ────────────────────────────────────────────────────────────────

const inr = (paise: number) =>
  "₹" + Math.round(paise / 100).toLocaleString("en-IN");

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtDatetime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="dx-card"
      style={{
        marginBottom: 16,
        padding: "18px 20px",
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "var(--card)",
      }}
    >
      <h3
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: ".06em",
          marginBottom: 14,
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "7px 0",
        borderBottom: "1px solid var(--border)",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{ fontSize: 13, color: "var(--muted)", flexShrink: 0, minWidth: 140 }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text)",
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function StatusPill({
  color,
  children,
}: {
  color: "green" | "red" | "amber" | "blue" | "muted";
  children: React.ReactNode;
}) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    green: { bg: "rgba(34,197,94,0.12)", text: "#16a34a", border: "rgba(34,197,94,0.3)" },
    red: { bg: "rgba(239,68,68,0.12)", text: "#dc2626", border: "rgba(239,68,68,0.3)" },
    amber: { bg: "rgba(245,158,11,0.12)", text: "#b45309", border: "rgba(245,158,11,0.3)" },
    blue: { bg: "rgba(59,130,246,0.12)", text: "#1d4ed8", border: "rgba(59,130,246,0.3)" },
    muted: { bg: "rgba(107,114,128,0.1)", text: "var(--muted)", border: "var(--border)" },
  };
  const c = colors[color];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
      }}
    >
      {children}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SellerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: storeId } = await params;
  if (!storeId) notFound();

  const sb = createAdminClient();

  // ── 1. Store row (with graceful suspension fallback) ──────────────────────
  let store: Record<string, unknown> | null = null;
  let suspensionAvailable = true;

  {
    const { data, error } = await sb
      .from("stores")
      .select(
        "id, store_name, subdomain, custom_domain, custom_domain_verified, owner_id, billing, created_at, category_id, wallet_balance, suspended, suspended_at, suspended_reason",
      )
      .eq("id", storeId)
      .maybeSingle();

    if (error) {
      // Missing columns (migration not applied) — retry without them.
      if (
        error.message.includes("column") &&
        (error.message.includes("suspended") ||
          error.message.includes("wallet_balance") ||
          error.message.includes("does not exist"))
      ) {
        suspensionAvailable = false;
        const { data: fallback, error: e2 } = await sb
          .from("stores")
          .select(
            "id, store_name, subdomain, custom_domain, custom_domain_verified, owner_id, billing, created_at, category_id",
          )
          .eq("id", storeId)
          .maybeSingle();
        if (e2 || !fallback) notFound();
        store = {
          ...(fallback as Record<string, unknown>),
          wallet_balance: 0,
          suspended: false,
          suspended_at: null,
          suspended_reason: null,
        };
      } else {
        notFound();
      }
    } else {
      if (!data) notFound();
      store = data as Record<string, unknown>;
    }
  }

  // ── 2. Owner profile ──────────────────────────────────────────────────────
  const ownerId = store.owner_id as string;
  const { data: profile } = await sb
    .from("profiles")
    .select("id, email, full_name, created_at")
    .eq("id", ownerId)
    .maybeSingle();

  // ── 3. Orders: GMV + paid count ───────────────────────────────────────────
  const [{ data: allOrders }, { data: recentOrders }] = await Promise.all([
    sb
      .from("orders")
      .select("amount, status, created_at")
      .eq("store_id", storeId),
    sb
      .from("orders")
      .select("id, buyer_name, buyer_email, amount, status, created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const paidOrders = (allOrders ?? []).filter((o) => o.status === "paid");
  const gmv = paidOrders.reduce((s, o) => s + (o.amount ?? 0), 0);
  const totalOrders = (allOrders ?? []).length;

  // ── 4. Pages count ────────────────────────────────────────────────────────
  const { count: pageCount } = await sb
    .from("pages")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId);

  // ── 5. Wallet balance + recent ledger ─────────────────────────────────────
  const walletBalance = Number(store.wallet_balance ?? 0);

  type LedgerRow = {
    id: string;
    type: string;
    amount: number;
    reason: string;
    created_at: string;
    balance_after: number;
  };
  let ledger: LedgerRow[] = [];
  {
    const { data: rows, error: le } = await sb
      .from("wallet_ledger")
      .select("id, type, amount, reason, created_at, balance_after")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(8);
    if (!le) ledger = (rows ?? []) as LedgerRow[];
  }

  // ── 6. Custom domain record ───────────────────────────────────────────────
  const { data: cdRow } = await sb
    .from("custom_domains")
    .select("domain, status, created_at")
    .eq("store_id", storeId)
    .maybeSingle();

  // ── 7. Subscription + plan ────────────────────────────────────────────────
  type SubRow = {
    status: string;
    amount_paise: number;
    started_at: string;
    current_period_end: string;
    plans: { name: string; price: number } | null;
  };
  let sub: SubRow | null = null;
  {
    const { data: subRow, error: se } = await sb
      .from("subscriptions")
      .select("status, amount_paise, started_at, current_period_end, plans(name, price)")
      .eq("store_id", storeId)
      .maybeSingle();
    // subscriptions table may not exist yet — fail gracefully.
    if (!se) sub = subRow as SubRow | null;
  }

  // ── Derived display values ────────────────────────────────────────────────
  const storeName = (store.store_name as string | null) || "—";
  const subdomain = store.subdomain as string | null;
  const customDomain = store.custom_domain as string | null;
  const customDomainVerified = !!store.custom_domain_verified;
  const createdAt = store.created_at as string | null;
  const suspended = !!store.suspended;
  const suspendedAt = store.suspended_at as string | null;
  const suspendedReason = store.suspended_reason as string | null;

  const ownerEmail = (profile as Record<string, unknown> | null)?.email as string | null ?? "—";
  const ownerName = (profile as Record<string, unknown> | null)?.full_name as string | null ?? "";
  const ownerJoined = (profile as Record<string, unknown> | null)?.created_at as string | null;

  const billing = (store.billing as Record<string, unknown> | null) ?? {};
  const planName =
    sub?.plans?.name ??
    (billing?.plan_name as string | null) ??
    (billing?.plan as string | null) ??
    "Free";

  const storeHost = customDomain
    ? customDomain
    : subdomain
    ? `${subdomain}.invoxai.io`
    : null;

  const category =
    (billing?.category as string | null) ?? null;

  return (
    <>
      {/* Header */}
      <Phead
        title={storeName}
        sub={ownerEmail}
        action={
          storeHost ? (
            <a
              href={`https://${storeHost}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn ghost"
            >
              View store
            </a>
          ) : undefined
        }
      />

      {/* Suspension badge */}
      {suspended && (
        <div
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 10,
            padding: "10px 16px",
            marginBottom: 16,
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <StatusPill color="red">SUSPENDED</StatusPill>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            Since {fmtDatetime(suspendedAt)}
            {suspendedReason ? ` — ${suspendedReason}` : ""}
          </span>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        {/* Left column */}
        <div>
          {/* Store info */}
          <Section title="Store">
            <Row label="Store name" value={storeName} />
            <Row
              label="Subdomain"
              value={
                subdomain ? (
                  <code style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}>
                    {subdomain}.invoxai.io
                  </code>
                ) : (
                  <span style={{ color: "var(--muted)" }}>Not set</span>
                )
              }
            />
            <Row
              label="Custom domain"
              value={
                customDomain ? (
                  <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <code style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}>
                      {customDomain}
                    </code>
                    {customDomainVerified ? (
                      <StatusPill color="green">verified</StatusPill>
                    ) : (
                      <StatusPill color="amber">pending</StatusPill>
                    )}
                  </span>
                ) : cdRow ? (
                  <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <code style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}>
                      {cdRow.domain}
                    </code>
                    <StatusPill color="amber">{cdRow.status}</StatusPill>
                  </span>
                ) : (
                  <span style={{ color: "var(--muted)" }}>None</span>
                )
              }
            />
            <Row label="Category" value={category ?? <span style={{ color: "var(--muted)" }}>—</span>} />
            <Row label="Created" value={fmtDate(createdAt)} />
            <Row
              label="Status"
              value={
                suspended ? (
                  <StatusPill color="red">Suspended</StatusPill>
                ) : subdomain ? (
                  <StatusPill color="green">Active</StatusPill>
                ) : (
                  <StatusPill color="amber">Setup incomplete</StatusPill>
                )
              }
            />
          </Section>

          {/* Owner */}
          <Section title="Owner">
            <Row label="Email" value={ownerEmail} />
            <Row
              label="Name"
              value={ownerName || <span style={{ color: "var(--muted)" }}>—</span>}
            />
            <Row label="User ID" value={
              <code style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11 }}>
                {ownerId}
              </code>
            } />
            <Row label="Joined" value={fmtDate(ownerJoined ?? null)} />
          </Section>

          {/* Plan / subscription */}
          <Section title="Plan & Billing">
            <Row
              label="Plan"
              value={
                <span
                  style={{
                    fontWeight: 700,
                    background: "linear-gradient(90deg,#ff4d7d,#a855f7)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {planName}
                </span>
              }
            />
            {sub ? (
              <>
                <Row
                  label="Sub status"
                  value={
                    <StatusPill
                      color={
                        sub.status === "active"
                          ? "green"
                          : sub.status === "past_due"
                          ? "amber"
                          : "muted"
                      }
                    >
                      {sub.status}
                    </StatusPill>
                  }
                />
                <Row label="Amount" value={inr(sub.amount_paise)} />
                <Row label="Started" value={fmtDate(sub.started_at)} />
                <Row label="Renews" value={fmtDate(sub.current_period_end)} />
              </>
            ) : (
              <Row
                label="Subscription"
                value={<span style={{ color: "var(--muted)" }}>Free / not tracked</span>}
              />
            )}
          </Section>
        </div>

        {/* Right column */}
        <div>
          {/* Revenue KPIs */}
          <Section title="Revenue">
            <Row
              label="Total GMV (paid)"
              value={
                <span style={{ fontWeight: 800, fontSize: 16, color: gmv > 0 ? "var(--text)" : "var(--muted)" }}>
                  {inr(gmv)}
                </span>
              }
            />
            <Row label="Paid orders" value={paidOrders.length} />
            <Row label="Total orders" value={totalOrders} />
            <Row
              label="Avg order value"
              value={paidOrders.length > 0 ? inr(gmv / paidOrders.length) : "—"}
            />
          </Section>

          {/* Pages */}
          <Section title="Pages">
            <Row
              label="Total pages"
              value={pageCount ?? <span style={{ color: "var(--muted)" }}>—</span>}
            />
          </Section>

          {/* Wallet */}
          <Section title="Wallet">
            <Row
              label="Balance"
              value={
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: 15,
                    color: walletBalance < 50000 ? "#ef4444" : "var(--text)",
                  }}
                >
                  {inr(walletBalance)}
                  {walletBalance < 50000 && walletBalance > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, marginLeft: 6 }}>
                      (low)
                    </span>
                  )}
                </span>
              }
            />
            {ledger.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
                No ledger entries.
              </p>
            ) : (
              <div style={{ marginTop: 10 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 80px 80px",
                    gap: "4px 10px",
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: "var(--muted)", fontWeight: 700 }}>Reason</span>
                  <span style={{ color: "var(--muted)", fontWeight: 700, textAlign: "right" }}>Amount</span>
                  <span style={{ color: "var(--muted)", fontWeight: 700, textAlign: "right" }}>Balance</span>
                  {ledger.map((l) => (
                    <>
                      <span key={`r-${l.id}`} style={{ color: "var(--text)" }}>
                        {l.reason}
                      </span>
                      <span
                        key={`a-${l.id}`}
                        style={{
                          textAlign: "right",
                          color: l.type === "credit" ? "#16a34a" : "#ef4444",
                          fontWeight: 600,
                        }}
                      >
                        {l.type === "credit" ? "+" : "−"}{inr(l.amount)}
                      </span>
                      <span
                        key={`b-${l.id}`}
                        style={{ textAlign: "right", color: "var(--muted)" }}
                      >
                        {inr(l.balance_after)}
                      </span>
                    </>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* Recent orders */}
          {(recentOrders ?? []).length > 0 && (
            <Section title="Recent Orders">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(recentOrders ?? []).map((o) => {
                  const oRow = o as Record<string, unknown>;
                  return (
                    <div
                      key={oRow.id as string}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 0",
                        borderBottom: "1px solid var(--border)",
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>
                        {(oRow.buyer_name as string | null) || (oRow.buyer_email as string | null) || "—"}
                      </span>
                      <span style={{ fontWeight: 700 }}>
                        {inr((oRow.amount as number | null) ?? 0)}
                      </span>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 600,
                          background:
                            oRow.status === "paid"
                              ? "rgba(34,197,94,0.12)"
                              : "rgba(107,114,128,0.1)",
                          color:
                            oRow.status === "paid" ? "#16a34a" : "var(--muted)",
                        }}
                      >
                        {oRow.status as string}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}
        </div>
      </div>

      {/* Actions panel (client component — interactive) */}
      <div
        className="dx-card"
        style={{
          padding: "18px 20px",
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "var(--card)",
          marginTop: 4,
        }}
      >
        <h3
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: ".06em",
            marginBottom: 14,
          }}
        >
          Admin Actions
        </h3>

        {!suspensionAvailable && (
          <p
            style={{
              fontSize: 12,
              color: "#b45309",
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.3)",
              borderRadius: 7,
              padding: "8px 12px",
              marginBottom: 12,
            }}
          >
            Suspension columns not yet applied (migration 20260618300000). Suspend
            button will report an error until the migration is run.
          </p>
        )}

        <SellerActions
          storeId={storeId}
          storeName={storeName}
          suspended={suspended}
          suspendedReason={suspendedReason}
        />

        <p
          style={{
            fontSize: 11.5,
            color: "var(--muted)",
            marginTop: 14,
            lineHeight: 1.5,
          }}
        >
          &quot;Login as (view)&quot; sets a signed, httpOnly, 30-min cookie and redirects
          to /dashboard — the dashboard resolves the current store to this seller&apos;s
          store. The admin&apos;s Supabase session is verified server-side every time
          the cookie is honoured. The cookie is HMAC-SHA-256 signed; non-admins
          cannot forge or use it.
        </p>
      </div>
    </>
  );
}
