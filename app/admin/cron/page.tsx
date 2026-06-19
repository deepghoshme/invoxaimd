import { createAdminClient } from "@/lib/supabase/admin";
import { Phead, Kpis } from "@/components/dx/ui";
import Pagination from "@/components/dx/Pagination";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

type CronRun = {
  id: string;
  job: string;
  status: "success" | "error" | "running";
  started_at: string;
  finished_at: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
};

// ── Known jobs catalogue ───────────────────────────────────────────────────────

const KNOWN_JOBS: {
  key: string;
  label: string;
  schedule: string;
  description: string;
}[] = [
  {
    key: "recovery",
    label: "Abandoned-cart recovery",
    schedule: "Daily",
    description:
      "Sends follow-up emails to buyers who started checkout but did not complete payment.",
  },
  {
    key: "audit",
    label: "Daily audit report",
    schedule: "Daily",
    description:
      "Aggregates platform activity and sends a daily summary report to admins.",
  },
  {
    key: "subscriptions",
    label: "Subscription expiry",
    schedule: "Daily",
    description:
      "Checks for expiring or expired subscriptions and updates their status accordingly.",
  },
  {
    key: "wallet_report",
    label: "Wallet daily report",
    schedule: "Daily at 12:01",
    description:
      "Generates a wallet-balance report for all sellers and logs a summary at 12:01 each day.",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function durationStr(started: string, finished: string | null): string {
  if (!finished) return "—";
  const ms = new Date(finished).getTime() - new Date(started).getTime();
  if (ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    success: { bg: "rgba(34,197,94,0.12)", text: "#16a34a", label: "Success" },
    error: { bg: "rgba(239,68,68,0.12)", text: "#dc2626", label: "Error" },
    running: { bg: "rgba(59,130,246,0.12)", text: "#1d4ed8", label: "Running" },
  };
  const c = map[status] ?? { bg: "rgba(107,114,128,0.1)", text: "#6b7280", label: status };
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
      {c.label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default async function AdminCronPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const sb = createAdminClient();

  let runs: CronRun[] = [];
  let total = 0;
  let tableMissing = false;

  try {
    const { data, error, count } = await sb
      .from("cron_runs")
      .select("id, job, status, started_at, finished_at, result, error", {
        count: "exact",
      })
      .order("started_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      if (
        error.message.includes("does not exist") ||
        error.message.includes("relation") ||
        error.message.includes("cron_runs")
      ) {
        tableMissing = true;
      } else {
        throw error;
      }
    } else {
      runs = (data ?? []) as CronRun[];
      total = count ?? 0;
    }
  } catch {
    tableMissing = true;
  }

  // KPI computation
  const now = Date.now();
  const last24hMs = 24 * 60 * 60 * 1000;
  const failures24h = runs.filter(
    (r) =>
      r.status === "error" &&
      new Date(r.started_at).getTime() > now - last24hMs,
  ).length;
  const lastRun = runs[0] ?? null;

  // Per-job last run lookup
  const lastByJob: Record<string, CronRun> = {};
  for (const r of [...runs].reverse()) {
    lastByJob[r.job] = r;
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

  return (
    <>
      <Phead
        title="Cron Jobs"
        sub="Scheduled platform jobs — last runs and status."
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
          <strong>Migration not applied.</strong> The{" "}
          <code>cron_runs</code> table does not exist yet. Run:
          <br />
          <code
            style={{
              fontFamily: "ui-monospace, Menlo, monospace",
              display: "block",
              marginTop: 6,
            }}
          >
            node scripts/db-apply.mjs supabase/migrations/&lt;timestamp&gt;_cron_runs.sql
          </code>
        </div>
      )}

      {!tableMissing && (
        <Kpis
          items={[
            {
              icon: "cal",
              color: "var(--primary)",
              label: "Total runs",
              value: String(total),
            },
            {
              icon: "chart",
              color: "var(--green)",
              label: "Last run",
              value: lastRun ? fmtDt(lastRun.started_at) : "Never",
            },
            {
              icon: "shield",
              color: failures24h > 0 ? "var(--red, #dc2626)" : "var(--green)",
              label: "Failures (24h)",
              value: failures24h > 0 ? String(failures24h) : "None",
            },
            {
              icon: "spark",
              color: "var(--accent)",
              label: "Currently running",
              value: runs.filter((r) => r.status === "running").length > 0
                ? "Yes"
                : "Idle",
            },
          ]}
        />
      )}

      {/* ── Known jobs section ─────────────────────────────────────────── */}
      <div style={{ marginTop: 20, marginBottom: 20 }}>
        <h2
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: ".06em",
            marginBottom: 12,
          }}
        >
          Registered Jobs
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
            gap: 12,
          }}
        >
          {KNOWN_JOBS.map((job) => {
            const last = !tableMissing ? lastByJob[job.key] : null;
            return (
              <div
                key={job.key}
                className="dx-card"
                style={{ padding: "14px 16px" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{ fontWeight: 700, fontSize: 13 }}
                  >
                    {job.label}
                  </span>
                  {last ? (
                    <StatusPill status={last.status} />
                  ) : (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--muted)",
                        fontStyle: "italic",
                      }}
                    >
                      No runs yet
                    </span>
                  )}
                </div>
                <div
                  style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}
                >
                  {job.description}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    fontSize: 11.5,
                    color: "var(--muted)",
                  }}
                >
                  <span>
                    <strong>Schedule:</strong> {job.schedule}
                  </span>
                  {last && (
                    <span>
                      <strong>Last:</strong>{" "}
                      {new Date(last.started_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  )}
                </div>
                {last?.error && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: "6px 9px",
                      background: "rgba(239,68,68,0.08)",
                      borderRadius: 6,
                      fontSize: 11,
                      color: "#dc2626",
                      fontFamily: "ui-monospace, Menlo, monospace",
                      wordBreak: "break-all",
                    }}
                  >
                    {last.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Recent runs table ──────────────────────────────────────────── */}
      <h2
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: ".06em",
          marginBottom: 12,
        }}
      >
        Recent Runs
      </h2>

      {!tableMissing && runs.length === 0 ? (
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
          <strong>No cron runs recorded yet.</strong>
          <br />
          <span style={{ fontSize: 12.5, marginTop: 6, display: "block" }}>
            The scheduler may not be installed. Jobs run when{" "}
            <code
              style={{ fontFamily: "ui-monospace, Menlo, monospace" }}
            >
              /api/cron
            </code>{" "}
            is triggered (e.g. via a cron daemon or external scheduler). The
            known jobs above will appear here once they have run at least once.
          </span>
        </div>
      ) : !tableMissing ? (
        <div
          className="dx-card"
          style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}
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
                  <th style={TH}>Job</th>
                  <th style={TH}>Status</th>
                  <th style={TH}>Started</th>
                  <th style={TH}>Finished</th>
                  <th style={TH}>Duration</th>
                  <th style={TH}>Result</th>
                  <th style={TH}>Error</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td style={TD}>
                      <code
                        style={{
                          fontFamily: "ui-monospace, Menlo, monospace",
                          fontSize: 12,
                          background: "var(--surface2)",
                          padding: "2px 6px",
                          borderRadius: 5,
                        }}
                      >
                        {run.job}
                      </code>
                    </td>
                    <td style={TD}>
                      <StatusPill status={run.status} />
                    </td>
                    <td style={TD}>
                      <span
                        style={{
                          fontFamily: "ui-monospace, Menlo, monospace",
                          fontSize: 11,
                          color: "var(--muted)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {fmtDt(run.started_at)}
                      </span>
                    </td>
                    <td style={TD}>
                      <span
                        style={{
                          fontFamily: "ui-monospace, Menlo, monospace",
                          fontSize: 11,
                          color: "var(--muted)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {fmtDt(run.finished_at)}
                      </span>
                    </td>
                    <td style={TD}>
                      <span
                        style={{ fontSize: 12, color: "var(--muted)" }}
                      >
                        {durationStr(run.started_at, run.finished_at)}
                      </span>
                    </td>
                    <td style={TD}>
                      {run.result ? (
                        <code
                          style={{
                            fontFamily: "ui-monospace, Menlo, monospace",
                            fontSize: 10,
                            color: "var(--muted)",
                            maxWidth: 200,
                            display: "inline-block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            verticalAlign: "bottom",
                          }}
                          title={JSON.stringify(run.result)}
                        >
                          {JSON.stringify(run.result)}
                        </code>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                    <td style={TD}>
                      {run.error ? (
                        <span
                          style={{
                            color: "#dc2626",
                            fontSize: 11,
                            fontFamily: "ui-monospace, Menlo, monospace",
                            maxWidth: 200,
                            display: "inline-block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            verticalAlign: "bottom",
                          }}
                          title={run.error}
                        >
                          {run.error}
                        </span>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} pageSize={PAGE_SIZE} total={total} baseParams={sp} />
        </div>
      ) : null}
    </>
  );
}
