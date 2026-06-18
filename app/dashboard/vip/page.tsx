import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card, Tag, Live } from "@/components/dx/ui";
import CreateVipButton from "./CreateVipButton";

export const dynamic = "force-dynamic";

export default async function VIPPage() {
  const { store, impersonating } = await requireDashboardStore();
  const sb = createAdminClient();

  const { data: vipPages } = await sb
    .from("pages")
    .select("id, title, status, content, created_at, public_id")
    .eq("store_id", store.id)
    .eq("page_type", "vip")
    .order("created_at", { ascending: false });

  const pages = vipPages ?? [];
  const pageIds = pages.map((p) => p.id);

  let revenue = 0;
  let memberCount = 0;
  if (pageIds.length > 0) {
    const { data: orderRows } = await sb
      .from("orders")
      .select("amount, buyer_email")
      .in("page_id", pageIds)
      .eq("status", "paid");
    const uniqueMembers = new Set(
      (orderRows ?? []).map((o) => o.buyer_email).filter(Boolean),
    );
    revenue = (orderRows ?? []).reduce((s, o) => s + (o.amount ?? 0), 0);
    memberCount = uniqueMembers.size;
  }

  // Per-page active member counts (graceful — table may not exist yet)
  const membersByPage: Record<string, number> = {};
  if (pageIds.length > 0) {
    try {
      const { data: mRows } = await sb
        .from("vip_members")
        .select("page_id")
        .in("page_id", pageIds)
        .eq("status", "active");
      (mRows ?? []).forEach((r: { page_id: string }) => {
        membersByPage[r.page_id] = (membersByPage[r.page_id] ?? 0) + 1;
      });
    } catch {
      // table not yet created — skip
    }
  }

  const inr = (p: number) => "₹" + Math.round(p / 100).toLocaleString("en-IN");

  return (
    <>
      <Phead
        title="VIP Community"
        sub="Sell paid memberships — Telegram, Discord, or WhatsApp group access."
        action={<CreateVipButton storeId={store.id} disabled={!!impersonating} />}
      />
      <Kpis
        items={[
          { icon: "crown", color: "var(--primary)", label: "Communities", value: String(pages.length) },
          { icon: "users", color: "var(--secondary)", label: "Members", value: String(memberCount) },
          { icon: "rupee", color: "var(--green)", label: "Revenue", value: inr(revenue) },
          { icon: "chart", color: "var(--accent)", label: "Published", value: String(pages.filter((p) => p.status === "published").length) },
        ]}
      />

      <style>{`
        .pt-table { width: 100%; border-collapse: collapse; }
        .pt-table th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); padding: 9px 12px; border-bottom: 1px solid var(--border); }
        .pt-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: middle; }
        .pt-table tr:last-child td { border-bottom: 0; }
        .pt-table tr:hover td { background: var(--surface2); }
        .pt-empty { text-align: center; padding: 56px 24px; color: var(--muted); font-size: 13.5px; }
        .pt-feat { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; background: var(--surface2); border-radius: 9px; font-size: 13px; margin-bottom: 8px; }
        .pt-feat b { display: block; margin-bottom: 2px; }
        .pt-feat p { margin: 0; color: var(--muted); font-size: 12px; }
      `}</style>

      <div className="dx-grid dx-cols">
        <div>
          <Card title={`VIP communities (${pages.length})`}>
            {pages.length === 0 ? (
              <div className="pt-empty">
                <div style={{ fontSize: 36, marginBottom: 10 }}>👑</div>
                <p>No VIP communities yet.</p>
                <p style={{ marginTop: 6 }}>
                  Create your first to sell paid access to your Telegram, Discord, or WhatsApp group.
                </p>
              </div>
            ) : (
              <table className="pt-table">
                <thead>
                  <tr>
                    <th>Community</th>
                    <th>Platform</th>
                    <th>Members</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p) => {
                    const ct = (p.content ?? {}) as { title?: string; platform?: string };
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{ct.title || p.title || "Untitled"}</td>
                        <td style={{ textTransform: "capitalize", color: "var(--muted)" }}>
                          {ct.platform || "—"}
                        </td>
                        <td>{membersByPage[p.id] ?? 0}</td>
                        <td>
                          {p.status === "published" ? <Live /> : <Tag kind="neu">Draft</Tag>}
                        </td>
                        <td>
                          <a
                            href={`/studio/vip/${p.id}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--primary)",
                              textDecoration: "none",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Edit ↗
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>
        <div>
          <Card title="How VIP access works">
            {[
              { icon: "💳", title: "Buyer pays", desc: "Customer picks a plan and pays on your landing page." },
              { icon: "🔗", title: "Invite link revealed", desc: "On payment, the invite link is shown and emailed instantly." },
              { icon: "📊", title: "Track members", desc: "Every member row logged in vip_members with plan and expiry." },
            ].map((f) => (
              <div key={f.title} className="pt-feat">
                <span style={{ fontSize: 18 }}>{f.icon}</span>
                <div>
                  <b>{f.title}</b>
                  <p>{f.desc}</p>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}
