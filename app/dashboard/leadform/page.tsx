import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card, Tag, Live } from "@/components/dx/ui";
import { createLeadFormPage } from "./actions";
import { type LeadFormContent } from "@/lib/leadform";

export const dynamic = "force-dynamic";

export default async function LeadFormPage() {
  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  // Fix: query page_type "ldf" (the actual enum value in pages table), not "leadform"
  const { data: formPages } = await sb
    .from("pages")
    .select("id, title, status, content, created_at, public_id")
    .eq("store_id", store.id)
    .eq("page_type", "ldf")
    .order("created_at", { ascending: false });

  const pages = formPages ?? [];

  // Lead submissions from site_messages (kind = 'contact')
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

  return (
    <>
      <Phead
        title="Lead forms"
        sub="Capture leads without a payment — free opt-ins, consultations, quotes."
        action={
          <form action={createLeadFormPage}>
            <button type="submit" className="btn grad">
              + New lead form
            </button>
          </form>
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
        .pt-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: middle; }
        .pt-table tr:last-child td { border-bottom: 0; }
        .pt-table tr:hover td { background: var(--surface2); }
        .pt-empty { text-align: center; padding: 56px 24px; color: var(--muted); font-size: 13.5px; }
        .pt-act-btn { font-size: 12px; font-weight: 600; color: var(--muted); text-decoration: none; border: 1px solid var(--border); padding: 4px 10px; border-radius: 7px; background: var(--surface); }
        .lf-edit-link { color: var(--primary); font-weight: 600; text-decoration: none; font-size: 12px; }
        .lf-edit-link:hover { text-decoration: underline; }
      `}</style>

      <div className="dx-grid dx-cols">
        <div>
          <Card title={`Lead forms (${pages.length})`}>
            {pages.length === 0 ? (
              <div className="pt-empty">
                <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
                <p style={{ marginBottom: 16 }}>No lead forms yet. Create your first form to start capturing leads.</p>
                <form action={createLeadFormPage} style={{ display: "inline" }}>
                  <button type="submit" className="btn grad">
                    + Create your first lead form
                  </button>
                </form>
              </div>
            ) : (
              <table className="pt-table">
                <thead>
                  <tr>
                    <th>Form</th>
                    <th>Public URL</th>
                    <th>Leads</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p) => {
                    const c = (p.content ?? {}) as LeadFormContent;
                    const pid = p.public_id ?? p.id.slice(0, 8);
                    const pUrl = store.subdomain && p.public_id
                      ? `https://${store.subdomain}.invoxai.io/ldf/${p.public_id}`
                      : null;
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{c.headline || p.title || "Untitled"}</td>
                        <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted)" }}>
                          /ldf/{pid}
                        </td>
                        <td style={{ fontWeight: 600 }}>{leadsByPage[p.id] ?? 0}</td>
                        <td>{p.status === "published" ? <Live /> : <Tag kind="neu">Draft</Tag>}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <a href={`/studio/leadform/${p.id}`} className="lf-edit-link" target="_blank" rel="noreferrer">Edit</a>
                            {pUrl && p.status === "published" && (
                              <a href={pUrl} target="_blank" rel="noreferrer" className="pt-act-btn">
                                View ↗
                              </a>
                            )}
                          </div>
                        </td>
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
                <a href="/dashboard/crm" className="dx-editbtn" style={{ display: "inline-block", marginTop: 10 }}>
                  View all in CRM →
                </a>
              </Card>
            </>
          )}
        </div>

        <div>
          <Card title="Tips for better leads">
            <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
              Make your lead forms convert more visitors into prospects.
            </div>
            {[
              { title: "Keep it short", desc: "Ask only what you need. Name + email converts 2x better than 5 fields." },
              { title: "Clear headline", desc: "Tell visitors exactly what they get — a callback, a quote, a free session." },
              { title: "Share the link", desc: "Post your /ldf/ URL in your bio, social posts, and email signature." },
              { title: "Follow up fast", desc: "Leads who hear back within 5 minutes convert 9x more." },
            ].map((f) => (
              <div key={f.title} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", background: "var(--surface2)", borderRadius: 9, marginBottom: 8 }}>
                <div>
                  <b style={{ display: "block", marginBottom: 2, fontSize: 13 }}>{f.title}</b>
                  <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>{f.desc}</p>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 14 }}>
              <a href="/dashboard/crm" className="btn grad" style={{ display: "inline-flex" }}>View all leads in CRM →</a>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
