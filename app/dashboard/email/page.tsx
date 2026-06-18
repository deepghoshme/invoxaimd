import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card, Tag } from "@/components/dx/ui";

export const dynamic = "force-dynamic";

export default async function EmailPage() {
  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  // Real data: newsletter subscribers and contact form leads from site_messages
  const { data: msgRows } = await sb
    .from("site_messages")
    .select("kind, email, name, created_at")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });

  const messages = msgRows ?? [];
  const newsletter = messages.filter((m) => m.kind === "newsletter");
  const contacts = messages.filter((m) => m.kind === "contact");
  const withEmail = messages.filter((m) => m.email);

  // Real data: buyers (unique emails from paid orders)
  const { data: orderRows } = await sb
    .from("orders")
    .select("buyer_email, buyer_name, status")
    .eq("store_id", store.id)
    .eq("status", "paid");

  const buyerEmails = new Set<string>();
  for (const o of orderRows ?? []) {
    if (o.buyer_email) buyerEmails.add(o.buyer_email.toLowerCase());
  }

  // Total reachable contacts
  const totalReachable = new Set([
    ...withEmail.map((m) => m.email.toLowerCase()),
    ...buyerEmails,
  ]).size;

  // Check if email_settings table exists
  let emailConfigured = false;
  try {
    const { data, error } = await sb
      .from("email_settings")
      .select("id")
      .eq("store_id", store.id)
      .maybeSingle();
    if (!error) emailConfigured = !!data;
  } catch {}

  return (
    <>
      <Phead
        title="Email marketing"
        sub="Your subscriber list, brand email, and campaign templates."
      />

      <Kpis
        items={[
          {
            icon: "users",
            color: "var(--primary)",
            label: "Newsletter subs",
            value: newsletter.length.toLocaleString("en-IN"),
          },
          {
            icon: "mail",
            color: "var(--green)",
            label: "Buyers (emailable)",
            value: buyerEmails.size.toLocaleString("en-IN"),
          },
          {
            icon: "spark",
            color: "var(--secondary)",
            label: "Total reachable",
            value: totalReachable.toLocaleString("en-IN"),
          },
          {
            icon: "form",
            color: "var(--accent)",
            label: "Form leads",
            value: contacts.length.toLocaleString("en-IN"),
          },
        ]}
      />

      <style>{`
        .em-table { width: 100%; border-collapse: collapse; }
        .em-table th {
          text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em;
          text-transform: uppercase; color: var(--muted); padding: 9px 12px;
          border-bottom: 1px solid var(--border);
        }
        .em-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 13px; }
        .em-table tr:last-child td { border-bottom: 0; }
        .em-empty { text-align: center; padding: 36px; color: var(--muted); font-size: 13.5px; }
        .em-coming {
          background: color-mix(in srgb, var(--secondary) 7%, var(--surface));
          border: 1px solid color-mix(in srgb, var(--secondary) 18%, var(--border));
          border-radius: 12px; padding: 16px 18px; margin-bottom: 14px;
        }
        .em-coming b { display: block; margin-bottom: 5px; font-size: 14px; }
        .em-coming p { color: var(--muted); font-size: 13px; margin: 0; }
        .em-field { margin-bottom: 12px; }
        .em-field label {
          display: block; font-size: 12px; font-weight: 600;
          color: var(--muted); margin-bottom: 5px;
        }
        .em-field input, .em-field select {
          width: 100%; padding: 9px 12px; border: 1px solid var(--border);
          border-radius: 9px; background: var(--bg); color: var(--text);
          font: inherit; font-size: 13.5px; outline: none;
        }
        .em-tpl-list { display: flex; flex-direction: column; gap: 9px; }
        .em-tpl-row {
          display: flex; align-items: center; gap: 10px;
          padding: 11px 13px; border: 1px solid var(--border);
          border-radius: 10px; font-size: 13px;
        }
        .em-tpl-row b { flex: 1; }
      `}</style>

      <div className="dx-grid dx-cols">
        <div>
          {/* Subscriber list */}
          <Card title={`Newsletter subscribers (${newsletter.length})`}>
            {newsletter.length === 0 ? (
              <div className="em-empty">
                No subscribers yet. Add a newsletter signup section to your{" "}
                <a href="/studio/website" target="_blank" rel="noreferrer" style={{ color: "var(--primary)" }}>
                  website
                </a>{" "}
                or bio page.
              </div>
            ) : (
              <table className="em-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Subscribed</th>
                  </tr>
                </thead>
                <tbody>
                  {newsletter.slice(0, 20).map((m, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{m.email || "—"}</td>
                      <td style={{ color: "var(--muted)" }}>{m.name || "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>
                        {new Date(m.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                  {newsletter.length > 20 && (
                    <tr>
                      <td colSpan={3} style={{ color: "var(--muted)", fontSize: 12, textAlign: "center" }}>
                        +{newsletter.length - 20} more subscribers
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </Card>

          <div style={{ height: 14 }} />

          {/* Email templates */}
          <Card title="Email templates">
            <div className="em-tpl-list">
              {[
                { name: "Welcome", desc: "Sent on first subscribe", status: "coming" },
                { name: "Abandoned cart recovery", desc: "1 hour after abandoned checkout", status: "coming" },
                { name: "Order confirmation", desc: "After successful payment", status: "coming" },
                { name: "New product launch", desc: "Broadcast to subscribers", status: "coming" },
              ].map((t) => (
                <div key={t.name} className="em-tpl-row">
                  <div style={{ flex: 1 }}>
                    <b>{t.name}</b>
                    <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{t.desc}</span>
                  </div>
                  <Tag kind="neu">Coming soon</Tag>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
              Email automation will be available once the email sending infrastructure is wired up.
            </p>
          </Card>
        </div>

        <div>
          {/* Email setup */}
          <Card title="Sending configuration">
            <div className="em-coming">
              <b>Email sender setup — coming soon</b>
              <p>
                Configure a Gmail App Password or SMTP credentials to send branded emails from
                your own address. This will power order confirmations, abandoned cart recovery,
                and newsletter broadcasts.
              </p>
            </div>

            <div className="em-field">
              <label>From email address</label>
              <input
                placeholder="hello@yourstore.com"
                disabled
                style={{ opacity: 0.6, cursor: "not-allowed" }}
              />
            </div>
            <div className="em-field">
              <label>Sending method</label>
              <select disabled style={{ opacity: 0.6, cursor: "not-allowed" }}>
                <option>Gmail App Password</option>
                <option>SMTP (custom)</option>
                <option>Resend / SendGrid</option>
              </select>
            </div>
            <div className="em-field">
              <label>App password / API key</label>
              <input
                type="password"
                placeholder="•••••••••••••••"
                disabled
                style={{ opacity: 0.6, cursor: "not-allowed" }}
              />
            </div>
            <button
              className="btn grad"
              disabled
              style={{ opacity: 0.5, cursor: "not-allowed", width: "100%", justifyContent: "center" }}
            >
              Save configuration (coming soon)
            </button>
          </Card>

          <div style={{ height: 14 }} />

          {/* All reachable contacts summary */}
          <Card title="Reachable contacts">
            <div className="dx-kv">
              <span>Newsletter subscribers</span>
              <span className="dx-fw6">{newsletter.length}</span>
            </div>
            <div className="dx-kv">
              <span>Buyers with email</span>
              <span className="dx-fw6">{buyerEmails.size}</span>
            </div>
            <div className="dx-kv">
              <span>Form leads with email</span>
              <span className="dx-fw6">{contacts.filter((c) => c.email).length}</span>
            </div>
            <div
              className="dx-kv"
              style={{
                borderTop: "1px solid var(--border)",
                marginTop: 8,
                paddingTop: 8,
              }}
            >
              <span style={{ fontWeight: 700 }}>Total unique emails</span>
              <span className="dx-fw6" style={{ color: "var(--primary)" }}>
                {totalReachable}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
              Deduplicated by email address.{" "}
              <a href="/dashboard/crm" style={{ color: "var(--primary)" }}>
                View full CRM →
              </a>
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
