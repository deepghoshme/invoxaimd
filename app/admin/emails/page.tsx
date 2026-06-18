import { Phead, Card, Table } from "@/components/dx/ui";
import { getEmailConfig } from "./actions";
import EmailConfigForm from "./EmailConfigForm";

export const dynamic = "force-dynamic";

// ── Template metadata (static — template content is built-in HTML) ────────────
const TEMPLATES = [
  { key: "otp",     emoji: "🔑", name: "OTP code",           trigger: "On login / signup",      subject: "Your invoxai code" },
  { key: "welcome", emoji: "👋", name: "Welcome",            trigger: "On signup",              subject: "Welcome to invoxai — let's get you live" },
  { key: "receipt", emoji: "✓",  name: "Payment receipt",    trigger: "On payment",             subject: "Your order is confirmed ✓" },
  { key: "invoice", emoji: "🧾", name: "Plan invoice",       trigger: "On plan purchase",       subject: "Invoice — Growth plan" },
  { key: "wallet",  emoji: "👛", name: "Daily wallet invoice", trigger: "Cron · 11 PM daily",  subject: "Your daily wallet invoice" },
  { key: "report",  emoji: "📊", name: "Weekly report",      trigger: "Cron · Monday 9 AM",    subject: "Your week on invoxai 📊" },
];

export default async function AdminEmailsPage() {
  const config = await getEmailConfig();

  const rows = TEMPLATES.map((tpl) => [
    <span key="e" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span>{tpl.emoji}</span> <strong>{tpl.name}</strong>
    </span>,
    <span key="t" style={{ color: "var(--muted)", fontSize: 12.5 }}>{tpl.trigger}</span>,
    <span key="s" style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, color: "var(--muted)" }}>{tpl.subject}</span>,
    <a key="a" href={`/admin/emails/preview?tpl=${tpl.key}`}
       style={{ fontSize: 12.5, fontWeight: 600, color: "var(--primary)", cursor: "pointer" }}>
      Preview
    </a>,
  ]);

  return (
    <>
      <Phead
        title="Platform email"
        sub="Configure the sending account and automated email toggles."
      />

      {config?.migrationPending && (
        <div style={{
          background: "color-mix(in srgb, var(--gold) 14%, transparent)",
          border: "1px solid color-mix(in srgb, var(--gold) 40%, transparent)",
          borderRadius: 12,
          padding: "12px 16px",
          marginBottom: 20,
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--text)",
        }}>
          Migration pending — apply <code style={{ fontFamily: "ui-monospace,monospace", fontSize: 12 }}>20260618280000_admin_comms.sql</code> to enable saving email configuration. Showing safe defaults.
        </div>
      )}

      <div className="dx-grid dx-cols" style={{ alignItems: "start" }}>
        {/* Left: config form */}
        <EmailConfigForm config={config} />

        {/* Right: template list */}
        <Card title="Transactional templates">
          <Table
            cols={["Template", "Trigger", "Subject", ""]}
            rows={rows}
            empty="No templates found."
          />
        </Card>
      </div>
    </>
  );
}
