import Link from "next/link";
import { Phead, Card } from "@/components/dx/ui";
import { renderEmailTemplate, EMAIL_KEYS } from "@/lib/emailTemplates";

export const dynamic = "force-dynamic";

const NAMES: Record<string, string> = {
  otp: "OTP code",
  welcome: "Welcome",
  receipt: "Payment receipt",
  invoice: "Plan invoice",
  wallet: "Daily wallet invoice",
  report: "Weekly report",
};

export default async function EmailPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tpl?: string }>;
}) {
  const { tpl = "otp" } = await searchParams;
  const tmpl = renderEmailTemplate(tpl) ?? renderEmailTemplate("otp")!;

  return (
    <>
      <Phead
        title="Email preview"
        sub="How this transactional email renders for recipients."
        action={
          <Link href="/admin/emails" className="btn ghost" style={{ textDecoration: "none" }}>
            ← Back to email
          </Link>
        }
      />

      {/* Template switcher */}
      <div className="dx-toolbar" style={{ marginBottom: 12, flexWrap: "wrap" }}>
        {EMAIL_KEYS.map((k) => (
          <Link
            key={k}
            href={`/admin/emails/preview?tpl=${k}`}
            className={`dx-fchip${k === tpl ? " on" : ""}`}
            style={{ textDecoration: "none" }}
          >
            {NAMES[k]}
          </Link>
        ))}
      </div>

      <Card title={`Subject: ${tmpl.subject}`}>
        <div style={{ background: "#f4f1ee", borderRadius: 12, padding: 12 }}>
          <iframe
            title="Email preview"
            srcDoc={tmpl.html}
            style={{
              width: "100%",
              height: 560,
              border: "1px solid var(--dx-border, #e7ddd3)",
              borderRadius: 8,
              background: "#fff",
            }}
          />
        </div>
      </Card>
    </>
  );
}
