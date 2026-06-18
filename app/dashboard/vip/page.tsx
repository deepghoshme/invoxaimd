import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card, Tag, Live } from "@/components/dx/ui";

export const dynamic = "force-dynamic";

export default async function VIPPage() {
  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  const { data: vipPages } = await sb
    .from("pages")
    .select("id, title, status, content, created_at, public_id")
    .eq("store_id", store.id)
    .eq("page_type", "vip")
    .order("created_at", { ascending: false });

  const pages = vipPages ?? [];
  const pageIds = pages.map((p) => p.id);
  let revenue = 0, memberCount = 0;
  if (pageIds.length > 0) {
    const { data: orderRows } = await sb
      .from("orders").select("amount, buyer_email").in("page_id", pageIds).eq("status", "paid");
    const uniqueMembers = new Set((orderRows ?? []).map((o) => o.buyer_email).filter(Boolean));
    revenue = (orderRows ?? []).reduce((s, o) => s + (o.amount ?? 0), 0);
    memberCount = uniqueMembers.size;
  }

  const inr = (p: number) => "₹" + Math.round(p / 100).toLocaleString("en-IN");

  return (
    <>
      <Phead
        title="VIP Community"
        sub="Paid Telegram or WhatsApp group access — sell memberships."
        action={
          <button className="btn grad" disabled style={{ opacity: 0.7, cursor: "not-allowed" }}>
            + New community (coming soon)
          </button>
        }
      />
      <Kpis items={[
        { icon: "crown", color: "var(--primary)", label: "Communities", value: String(pages.length) },
        { icon: "users", color: "var(--secondary)", label: "Members", value: String(memberCount) },
        { icon: "rupee", color: "var(--green)", label: "Revenue", value: inr(revenue) },
        { icon: "chart", color: "var(--accent)", label: "Published", value: String(pages.filter((p) => p.status === "published").length) },
      ]} />

      <style>{`
        .pt-table { width: 100%; border-collapse: collapse; }
        .pt-table th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); padding: 9px 12px; border-bottom: 1px solid var(--border); }
        .pt-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 13px; }
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
                <p>No VIP communities yet. Create a paid community page to sell access to your Telegram or WhatsApp group.</p>
              </div>
            ) : (
              <table className="pt-table">
                <thead><tr><th>Community</th><th>Platform</th><th>Price</th><th>Members</th><th>Status</th></tr></thead>
                <tbody>
                  {pages.map((p) => {
                    const c = (p.content ?? {}) as { headline?: string; platform?: string; price?: number };
                    return (
                      <tr key={p.id}>
                        <td>
                          <a href={`/studio/product/${p.id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: "var(--primary)", textDecoration: "none" }}>
                            {c.headline || p.title || "Untitled"}
                          </a>
                        </td>
                        <td style={{ textTransform: "capitalize", color: "var(--muted)" }}>{c.platform || "—"}</td>
                        <td>{c.price ? inr(c.price * 100) : "—"}</td>
                        <td>—</td>
                        <td>{p.status === "published" ? <Live /> : <Tag kind="neu">Draft</Tag>}</td>
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
              { icon: "💳", title: "Buyer pays", desc: "Customer pays on your landing page" },
              { icon: "🔗", title: "Auto invite link", desc: "Unique Telegram/WhatsApp invite sent on payment" },
              { icon: "🚫", title: "Revoke on expiry", desc: "Monthly access — kick non-renewers automatically (coming soon)" },
            ].map((f) => (
              <div key={f.title} className="pt-feat">
                <span style={{ fontSize: 18 }}>{f.icon}</span>
                <div><b>{f.title}</b><p>{f.desc}</p></div>
              </div>
            ))}
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
                Until the VIP builder ships, sell community access with a one-page product and share the group link manually in the confirmation email:
              </p>
              <a href="/dashboard/pages/products" className="btn grad" style={{ display: "inline-flex" }}>
                Create one-page product →
              </a>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
