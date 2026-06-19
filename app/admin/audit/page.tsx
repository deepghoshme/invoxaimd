import { createAdminClient } from "@/lib/supabase/admin";
import { Phead } from "@/components/dx/ui";
import Pagination from "@/components/dx/Pagination";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

type AuditRow = {
  id: string;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  store_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDatetime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  "store.suspend":    { bg: "rgba(239,68,68,0.12)",   text: "#dc2626" },
  "store.unsuspend":  { bg: "rgba(34,197,94,0.12)",   text: "#16a34a" },
  "impersonate.start":{ bg: "rgba(245,158,11,0.12)",  text: "#b45309" },
  "gateway.save":     { bg: "rgba(59,130,246,0.12)",  text: "#1d4ed8" },
  "commission.update":{ bg: "rgba(168,85,247,0.12)",  text: "#7c3aed" },
  "brand.badge":      { bg: "rgba(107,114,128,0.1)",  text: "#4b5563" },
};

function ActionPill({ action }: { action: string }) {
  const c = ACTION_COLORS[action] ?? { bg: "rgba(107,114,128,0.1)", text: "#6b7280" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: c.bg,
        color: c.text,
        fontFamily: "ui-monospace, Menlo, monospace",
        whiteSpace: "nowrap",
      }}
    >
      {action}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const filterAction = sp.action;
  const filterType = sp.type;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const sb = createAdminClient();

  // Degrade gracefully if the table doesn't exist yet.
  let rows: AuditRow[] = [];
  let auditTotal = 0;
  let tableMissing = false;

  try {
    let q = sb
      .from("audit_log")
      .select(
        "id, actor_email, actor_role, action, target_type, target_id, store_id, metadata, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (filterAction) q = q.eq("action", filterAction);
    if (filterType)   q = q.eq("target_type", filterType);

    const { data, error, count } = await q;

    if (error) {
      if (
        error.message.includes("does not exist") ||
        error.message.includes("relation") ||
        error.message.includes("audit_log")
      ) {
        tableMissing = true;
      } else {
        throw error;
      }
    } else {
      rows = (data ?? []) as AuditRow[];
      auditTotal = count ?? 0;
    }
  } catch {
    tableMissing = true;
  }

  // Distinct action values for the filter dropdown (from loaded rows or a fixed list).
  const knownActions = Array.from(new Set(rows.map((r) => r.action))).sort();

  return (
    <>
      <Phead
        title="Audit Log"
        sub="All platform events — newest first"
      />

      {tableMissing && (
        <div
          style={{
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.3)",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 16,
            fontSize: 13,
            color: "#b45309",
          }}
        >
          <strong>Migration not applied.</strong> The <code>audit_log</code> table
          does not exist yet. Run:
          <br />
          <code style={{ fontFamily: "ui-monospace, Menlo, monospace", display: "block", marginTop: 6 }}>
            node scripts/db-apply.mjs supabase/migrations/20260618320000_audit_log.sql
          </code>
        </div>
      )}

      {!tableMissing && (
        <>
          {/* Filter bar */}
          <form
            method="GET"
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 16,
              alignItems: "center",
            }}
          >
            <select
              name="action"
              defaultValue={filterAction ?? ""}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--card)",
                color: "var(--text)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <option value="">All actions</option>
              {knownActions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>

            <select
              name="type"
              defaultValue={filterType ?? ""}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--card)",
                color: "var(--text)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <option value="">All target types</option>
              {Array.from(new Set(rows.map((r) => r.target_type).filter(Boolean))).sort().map((t) => (
                <option key={t!} value={t!}>
                  {t}
                </option>
              ))}
            </select>

            <button
              type="submit"
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--card)",
                color: "var(--text)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Filter
            </button>

            {(filterAction || filterType) && (
              <a
                href="/admin/audit"
                style={{ fontSize: 13, color: "var(--muted)", textDecoration: "underline" }}
              >
                Clear filters
              </a>
            )}
          </form>

          {rows.length === 0 ? (
            <div
              style={{
                padding: "40px 20px",
                textAlign: "center",
                color: "var(--muted)",
                fontSize: 14,
                background: "var(--card)",
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
            >
              No audit entries yet.
            </div>
          ) : (
            <div
              className="dx-card"
              style={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                overflow: "hidden",
              }}
            >
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr
                      style={{
                        background: "var(--sidebar)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <th style={TH}>Time</th>
                      <th style={TH}>Actor</th>
                      <th style={TH}>Action</th>
                      <th style={TH}>Target</th>
                      <th style={TH}>Store ID</th>
                      <th style={TH}>Metadata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        style={{ borderBottom: "1px solid var(--border)" }}
                      >
                        <td style={TD}>
                          <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
                            {fmtDatetime(row.created_at)}
                          </span>
                        </td>
                        <td style={TD}>
                          <div style={{ fontWeight: 600 }}>
                            {row.actor_email ?? <span style={{ color: "var(--muted)" }}>—</span>}
                          </div>
                          {row.actor_role && (
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>{row.actor_role}</div>
                          )}
                        </td>
                        <td style={TD}>
                          <ActionPill action={row.action} />
                        </td>
                        <td style={TD}>
                          {row.target_type && (
                            <span style={{ color: "var(--muted)", fontSize: 11 }}>{row.target_type} / </span>
                          )}
                          {row.target_id ? (
                            <code style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11 }}>
                              {row.target_id.length > 20 ? row.target_id.slice(0, 8) + "…" : row.target_id}
                            </code>
                          ) : (
                            <span style={{ color: "var(--muted)" }}>—</span>
                          )}
                        </td>
                        <td style={TD}>
                          {row.store_id ? (
                            <a
                              href={`/admin/sellers/${row.store_id}`}
                              style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, color: "var(--primary)" }}
                            >
                              {row.store_id.slice(0, 8)}…
                            </a>
                          ) : (
                            <span style={{ color: "var(--muted)" }}>—</span>
                          )}
                        </td>
                        <td style={TD}>
                          {row.metadata ? (
                            <code
                              style={{
                                fontFamily: "ui-monospace, Menlo, monospace",
                                fontSize: 10,
                                color: "var(--muted)",
                                maxWidth: 220,
                                display: "inline-block",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                verticalAlign: "bottom",
                              }}
                              title={JSON.stringify(row.metadata)}
                            >
                              {JSON.stringify(row.metadata)}
                            </code>
                          ) : (
                            <span style={{ color: "var(--muted)" }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination page={page} pageSize={PAGE_SIZE} total={auditTotal} baseParams={sp} />
            </div>
          )}
        </>
      )}
    </>
  );
}

const TH: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: ".06em",
  whiteSpace: "nowrap",
};

const TD: React.CSSProperties = {
  padding: "10px 14px",
  verticalAlign: "middle",
};
