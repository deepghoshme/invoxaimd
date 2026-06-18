import { Phead, Card, Kpis } from "@/components/dx/ui";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// ── Health check helpers ──────────────────────────────────────────────────────

/** Real DB ping: runs SELECT 1. Returns true + latency on success. */
async function pingDb(): Promise<{ ok: boolean; ms: number | null }> {
  const start = Date.now();
  try {
    const sb = createAdminClient();
    // A simple count query is enough to verify connectivity + PostgREST path.
    const { error } = await sb.from("profiles").select("id", { count: "exact", head: true });
    if (error) return { ok: false, ms: null };
    return { ok: true, ms: Date.now() - start };
  } catch {
    return { ok: false, ms: null };
  }
}

/** Real counts from the DB. Returns null per field on error. */
async function getCounts(): Promise<{
  livePages: number | null;
  totalStores: number | null;
  totalOrders: number | null;
}> {
  try {
    const sb = createAdminClient();
    const [pagesRes, storesRes, ordersRes] = await Promise.all([
      // "Live pages" = rows in the `pages` table with status = 'published'
      sb.from("pages").select("id", { count: "exact", head: true }).eq("status", "published"),
      sb.from("stores").select("id", { count: "exact", head: true }),
      sb.from("orders").select("id", { count: "exact", head: true }),
    ]);
    return {
      livePages: pagesRes.count,
      totalStores: storesRes.count,
      totalOrders: ordersRes.count,
    };
  } catch {
    return { livePages: null, totalStores: null, totalOrders: null };
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminHealthPage() {
  const [db, counts] = await Promise.all([pingDb(), getCounts()]);

  const dbStatus = db.ok ? "Operational" : "Unreachable";
  const dbColor = db.ok ? "var(--green)" : "var(--red)";

  const fmt = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-IN"));

  // Services list — only DB is a real live check. Others are honest about status.
  const services: { name: string; desc: string; status: string; color: string }[] = [
    {
      name: "Web app (VPS)",
      desc: "Next.js · systemd — if this page loads, the app is up",
      status: "Operational",
      color: "var(--green)",
    },
    {
      name: "Database & auth (Supabase)",
      desc: `Postgres · RLS · PostgREST${db.ms !== null ? ` · ${db.ms} ms` : ""}`,
      status: dbStatus,
      color: dbColor,
    },
    {
      name: "SSL / domains (Caddy)",
      desc: "Auto-HTTPS · on-demand TLS — no live check from this server",
      // Cannot check Caddy from inside the app; honest about it.
      status: "Not monitored here",
      color: "var(--muted)",
    },
    {
      name: "Storage & CDN (Supabase)",
      desc: "Media bucket — no live ping; check Supabase dashboard",
      // Supabase storage has no lightweight health endpoint available to server actions.
      status: "Not monitored here",
      color: "var(--muted)",
    },
  ];

  return (
    <>
      <Phead
        title="Platform health"
        sub="Live DB connectivity and real platform counts. Uptime / error-rate require external monitoring."
        action={
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontSize: 12,
            fontWeight: 700,
            color: db.ok ? "var(--green)" : "var(--red)",
            background: db.ok ? "var(--greenbg)" : "var(--redbg)",
            padding: "5px 13px",
            borderRadius: 99,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: db.ok ? "var(--green)" : "var(--red)", display: "inline-block" }} />
            {db.ok ? "DB connected" : "DB unreachable"}
          </span>
        }
      />

      {/* KPIs: real counts + honest placeholders */}
      <Kpis
        items={[
          {
            icon: "globe",
            color: "var(--primary)",
            label: "Live pages",
            value: fmt(counts.livePages),
            delta: counts.livePages !== null ? "published" : "query failed",
          },
          {
            icon: "users",
            color: "var(--accent)",
            label: "Total stores",
            value: fmt(counts.totalStores),
          },
          {
            icon: "bag",
            color: "var(--secondary)",
            label: "Total orders",
            value: fmt(counts.totalOrders),
          },
          {
            icon: "chart",
            color: "var(--gold)",
            label: "DB latency",
            value: db.ms !== null ? `${db.ms} ms` : "—",
            delta: db.ok ? "this request" : "check connection",
            down: !db.ok,
          },
        ]}
      />

      {/* Services */}
      <Card title="Services">
        {services.map((svc, i) => (
          <div
            key={svc.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 13,
              padding: "13px 0",
              borderTop: i === 0 ? "none" : "1px solid var(--border)",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{svc.name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{svc.desc}</div>
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: svc.color, whiteSpace: "nowrap" }}>
              {svc.status === "Operational" && (
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: svc.color, marginRight: 6, verticalAlign: "middle" }} />
              )}
              {svc.status}
            </span>
          </div>
        ))}
      </Card>

      {/* Honest note about what isn't measured */}
      <div style={{
        marginTop: 16,
        padding: "12px 16px",
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        fontSize: 12.5,
        color: "var(--muted)",
        lineHeight: 1.6,
      }}>
        <strong style={{ color: "var(--text)" }}>What is real vs. placeholder</strong>
        <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
          <li><strong>Real:</strong> DB connectivity (SELECT on profiles), DB latency (wall-clock this request), live-page count (pages where status=published), store count, order count.</li>
          <li><strong>Not measured here:</strong> uptime %, error rate, avg response time across all requests, Caddy/SSL, Supabase Storage. Use an external monitor (UptimeRobot, Better Uptime, etc.) for those.</li>
        </ul>
      </div>
    </>
  );
}
