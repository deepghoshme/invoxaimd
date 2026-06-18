import { requireDashboardStore } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Phead } from "@/components/dx/ui";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

type AuditRow = {
  id: string;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
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

// Human-readable labels for known actions.
const ACTION_LABELS: Record<string, string> = {
  "store.suspend":     "Store suspended",
  "store.unsuspend":   "Store unsuspended",
  "impersonate.start": "Admin viewed your store",
  "gateway.save":      "Payment gateway updated",
  "commission.update": "Commission rate changed",
  "brand.badge":       "Brand badge toggled",
};

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  "store.suspend":     { bg: "rgba(239,68,68,0.12)",  text: "#dc2626" },
  "store.unsuspend":   { bg: "rgba(34,197,94,0.12)",  text: "#16a34a" },
  "impersonate.start": { bg: "rgba(245,158,11,0.12)", text: "#b45309" },
  "gateway.save":      { bg: "rgba(59,130,246,0.12)", text: "#1d4ed8" },
};

function ActionPill({ action }: { action: string }) {
  const c = ACTION_COLORS[action] ?? { bg: "rgba(107,114,128,0.1)", text: "#6b7280" };
  const label = ACTION_LABELS[action] ?? action;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: c.bg,
        color: c.text,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SellerAuditPage() {
  // requireDashboardStore honors impersonation — returns the active store.
  const { store } = await requireDashboardStore();
  const storeId = store.id;

  const sb = createAdminClient();

  let rows: AuditRow[] = [];
  let tableMissing = false;

  try {
    const { data, error } = await sb
      .from("audit_log")
      .select(
        "id, actor_email, actor_role, action, target_type, target_id, metadata, created_at",
      )
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(100);

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
    }
  } catch {
    tableMissing = true;
  }

  return (
    <>
      <Phead
        title="Activity Log"
        sub="Admin actions on your store — newest first"
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
          Activity log is not available yet — your platform administrator needs
          to apply a pending migration. Contact support if this persists.
        </div>
      )}

      {!tableMissing && rows.length === 0 && (
        <div
          style={{
            padding: "48px 20px",
            textAlign: "center",
            color: "var(--muted)",
            fontSize: 14,
            background: "var(--card)",
            borderRadius: 12,
            border: "1px solid var(--border)",
          }}
        >
          No activity recorded for your store yet.
        </div>
      )}

      {!tableMissing && rows.length > 0 && (
        <div
          className="dx-card"
          style={{
            borderRadius: 12,
            border: "1px solid var(--border)",
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
            >
              <thead>
                <tr
                  style={{
                    background: "var(--sidebar)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <th style={TH}>Time</th>
                  <th style={TH}>Event</th>
                  <th style={TH}>Performed by</th>
                  <th style={TH}>Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td style={TD}>
                      <span
                        style={{
                          fontFamily: "ui-monospace, Menlo, monospace",
                          fontSize: 12,
                          color: "var(--muted)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {fmtDatetime(row.created_at)}
                      </span>
                    </td>
                    <td style={TD}>
                      <ActionPill action={row.action} />
                    </td>
                    <td style={TD}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {row.actor_email ?? (
                          <span style={{ color: "var(--muted)" }}>system</span>
                        )}
                      </div>
                      {row.actor_role && (
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>
                          {row.actor_role}
                        </div>
                      )}
                    </td>
                    <td style={TD}>
                      {row.metadata ? (
                        <code
                          style={{
                            fontFamily: "ui-monospace, Menlo, monospace",
                            fontSize: 11,
                            color: "var(--muted)",
                            maxWidth: 200,
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

          <div
            style={{
              padding: "8px 16px",
              fontSize: 12,
              color: "var(--muted)",
              borderTop: "1px solid var(--border)",
            }}
          >
            Showing {rows.length} most recent entries for your store
          </div>
        </div>
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
