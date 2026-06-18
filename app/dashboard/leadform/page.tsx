import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card, Tag, Live } from "@/components/dx/ui";

export const dynamic = "force-dynamic";

export default async function LeadFormPage() {
  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  const { data: formPages } = await sb
    .from("pages")
    .select("id, title, status, content, created_at, public_id")
    .eq("store_id", store.id)
    .eq("page_type", "leadform")
    .order("created_at", { ascending: false });

  const pages = formPages ?? [];

  // Lead submissions from site_messages (form type)
  const { data: msgRows } = await sb
    .from("site_messages")
    .select("id, kind, name, email, phone, created_at, page_id")
    .eq("store_id", store.id)
    .eq("kind", "contact")
    .order("created_at", { ascending: false });

  const leads = msgRows ?? [];
  const leadsByPage: Record<string, number> = {};
  for (const m of leads) {
    if (m.page_id) leadsByPage[m.page_id] = (leadsByPage[m.page_id] ?? 0) + 1;
  }

  const inr = () => "";

  return (
    <>
      <Phead
        title="Lead forms"
        sub="Capture leads without a payment — free opt-ins, consultations, quotes."
        action={
          <button className="btn grad" disabled style={{ opacity: 0.7, cursor: "not-allowed" }}>
            + New lead form (coming soon)
          </button>
        }
      />
      <Kpis items={[
        { icon: "form", color: "var(--primary)", label: "Lead forms", value: String(pages.length) },
        { icon: "users", color: "var(--secondary)", label: "Total leads", value: String(leads.length) },
        { icon: "mail", color: "var(--green)", label: "With email", value: String(leads.filter((l) => l.email).length) },
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
          <Card title={`Lead forms (${pages.length})`}>
            {pages.length === 0 ? (
              <div className="pt-empty">
                <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
                <p>No lead forms yet. The lead form builder is coming soon. Until then, use the website contact section to collect leads.</p>
              </div>
            ) : (
              <table className="pt-table">
                <thead><tr><th>Form</th><th>URL</th><th>Leads</th><th>Status</th></tr></thead>
                <tbody>
                  {pages.map((p) => {
                    const c = (p.content ?? {}) as { headline?: string };
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{c.headline || p.title || "Untitled"}</td>
                        <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted)" }}>/form/{p.public_id ?? p.id.slice(0, 8)}</td>
                        <td style={{ fontWeight: 600 }}>{leadsByPage[p.id] ?? 0}</td>
                        <td>{p.status === "published" ? <Live /> : <Tag kind="neu">Draft</Tag>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>

          {leads.length > 0 && (
            <>
              <div style={{ height: 14 }} />
              <Card title={`Recent leads (${leads.length})`}>
                <table className="pt-table">
                  <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Date</th></tr></thead>
                  <tbody>
                    {leads.slice(0, 10).map((l) => (
                      <tr key={l.id}>
                        <td style={{ fontWeight: 600 }}>{l.name || "—"}</td>
                        <td>{l.email || "—"}</td>
                        <td>{l.phone || "—"}</td>
                        <td style={{ fontSize: 12, color: "var(--muted)" }}>
                          {new Date(l.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <a href="/dashboard/crm?tab=form-leads" className="dx-editbtn" style={{ display: "inline-block", marginTop: 10 }}>
                  View all in CRM →
                </a>
              </Card>
            </>
          )}
        </div>

        <div>
          <Card title="Lead form builder — coming soon">
            <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
              Create standalone form pages for free opt-ins, quote requests, and consultation enquiries.
            </div>
            {[
              { icon: "✏️", title: "Custom fields", desc: "Name, email, phone, dropdowns, file upload" },
              { icon: "🔗", title: "Shareable link", desc: "Direct link you can share on social or in bio" },
              { icon: "📧", title: "Instant email alert", desc: "Get notified by email on every submission" },
              { icon: "📊", title: "Lead tracking", desc: "All submissions saved here and in CRM" },
            ].map((f) => (
              <div key={f.title} className="pt-feat">
                <span style={{ fontSize: 18 }}>{f.icon}</span>
                <div><b>{f.title}</b><p>{f.desc}</p></div>
              </div>
            ))}
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>Collect leads now via the website contact section:</p>
              <a href="/studio/website" target="_blank" rel="noreferrer" className="btn grad" style={{ display: "inline-flex" }}>Open website builder →</a>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
