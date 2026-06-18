import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card } from "@/components/dx/ui";
import CampaignComposer from "./CampaignComposer";
import type { AudienceCounts } from "./actions";

export const dynamic = "force-dynamic";

type Campaign = {
  id: string;
  subject: string;
  body_html: string;
  audience: "all_buyers" | "subscribers" | "all";
  status: "draft" | "sent";
  recipient_count: number;
  sent_at: string | null;
  created_at: string;
};

export default async function EmailPage() {
  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  // ── Audience counts (real live data) ────────────────────────────────────────
  const [{ data: orderRows }, { data: msgRows }] = await Promise.all([
    sb
      .from("orders")
      .select("buyer_email")
      .eq("store_id", store.id)
      .eq("status", "paid"),
    sb
      .from("site_messages")
      .select("email, kind")
      .eq("store_id", store.id)
      .not("email", "is", null),
  ]);

  const buyerEmails = new Set<string>();
  for (const o of orderRows ?? []) {
    if (o.buyer_email) buyerEmails.add((o.buyer_email as string).toLowerCase());
  }

  const subscriberEmails = new Set<string>();
  const contactEmails = new Set<string>();
  for (const m of msgRows ?? []) {
    const email = (m.email as string).toLowerCase();
    if (m.kind === "newsletter") subscriberEmails.add(email);
    else if (m.kind === "contact") contactEmails.add(email);
  }

  const allReachable = new Set([...buyerEmails, ...subscriberEmails]);

  const counts: AudienceCounts = {
    buyers: buyerEmails.size,
    subscribers: subscriberEmails.size,
    all: allReachable.size,
  };

  // ── Past campaigns (graceful: table may not exist yet) ───────────────────────
  let campaigns: Campaign[] = [];
  let tableMissing = false;

  try {
    const { data, error } = await sb
      .from("email_campaigns")
      .select(
        "id, subject, body_html, audience, status, recipient_count, sent_at, created_at",
      )
      .eq("store_id", store.id)
      .order("created_at", { ascending: false });

    if (error) {
      if (
        error.code === "42P01" ||
        (error.message?.toLowerCase().includes("does not exist") &&
          error.message?.toLowerCase().includes("relation"))
      ) {
        tableMissing = true;
      }
      // Non-table errors: just log, render empty
    } else {
      campaigns = (data ?? []) as Campaign[];
    }
  } catch {
    // unexpected error — render gracefully
  }

  // ── Check if platform email service is configured (admin email_config) ────────
  let platformEmailReady = false;
  try {
    const { data: cfg } = await sb
      .from("email_config")
      .select("method, gmail_user, gmail_app_password, smtp_host, smtp_pass")
      .eq("id", true)
      .maybeSingle();

    if (cfg) {
      if (cfg.method === "gmail" && cfg.gmail_user && cfg.gmail_app_password) {
        platformEmailReady = true;
      } else if (cfg.method === "smtp" && cfg.smtp_host && cfg.smtp_pass) {
        platformEmailReady = true;
      }
    }
  } catch {
    // email_config table might not exist in all envs — that's fine
  }

  const sentCount = campaigns.filter((c) => c.status === "sent").length;
  const totalDelivered = campaigns
    .filter((c) => c.status === "sent")
    .reduce((s, c) => s + (c.recipient_count ?? 0), 0);

  return (
    <>
      <Phead
        title="Email campaigns"
        sub="Compose and send newsletters to your buyers and subscribers."
      />

      <Kpis
        items={[
          {
            icon: "spark",
            color: "var(--primary)",
            label: "Reachable",
            value: counts.all.toLocaleString("en-IN"),
          },
          {
            icon: "users",
            color: "var(--secondary)",
            label: "Buyers",
            value: counts.buyers.toLocaleString("en-IN"),
          },
          {
            icon: "mail",
            color: "var(--green)",
            label: "Subscribers",
            value: counts.subscribers.toLocaleString("en-IN"),
          },
          {
            icon: "form",
            color: "var(--accent)",
            label: "Campaigns sent",
            value: sentCount.toLocaleString("en-IN"),
          },
        ]}
      />

      {/* Migration pending banner */}
      {tableMissing && (
        <div
          style={{
            background:
              "color-mix(in srgb, var(--red, #e5476f) 8%, var(--surface))",
            border:
              "1px solid color-mix(in srgb, var(--red, #e5476f) 25%, var(--border))",
            borderRadius: 12,
            padding: "14px 18px",
            marginBottom: 18,
            fontSize: 13,
          }}
        >
          <strong style={{ display: "block", marginBottom: 4 }}>
            Migration required
          </strong>
          <span style={{ color: "var(--muted)" }}>
            The campaigns table does not exist yet. Ask your admin to apply{" "}
            <code>supabase/migrations/20260618350000_email_campaigns.sql</code>{" "}
            to enable campaign saving and history.
          </span>
        </div>
      )}

      <div className="dx-grid dx-cols">
        <div style={{ gridColumn: "1 / -1" }}>
          <CampaignComposer
            counts={counts}
            campaigns={campaigns}
            platformEmailReady={platformEmailReady}
            storeName={store.store_name ?? "Your store"}
          />
        </div>
      </div>

      {/* Audience breakdown */}
      <div style={{ marginTop: 24 }}>
        <Card title="Reachable audience breakdown">
          <div className="dx-kv">
            <span>Buyers with email (paid orders)</span>
            <span className="dx-fw6">{counts.buyers}</span>
          </div>
          <div className="dx-kv">
            <span>Newsletter subscribers</span>
            <span className="dx-fw6">{counts.subscribers}</span>
          </div>
          <div className="dx-kv">
            <span>Form leads with email</span>
            <span className="dx-fw6">{contactEmails.size}</span>
          </div>
          <div
            className="dx-kv"
            style={{
              borderTop: "1px solid var(--border)",
              marginTop: 8,
              paddingTop: 8,
            }}
          >
            <span style={{ fontWeight: 700 }}>
              Total unique reachable (buyers + subscribers)
            </span>
            <span
              className="dx-fw6"
              style={{ color: "var(--primary)", fontSize: 16 }}
            >
              {counts.all}
            </span>
          </div>
          {totalDelivered > 0 && (
            <div className="dx-kv" style={{ marginTop: 6 }}>
              <span style={{ color: "var(--muted)" }}>
                Total send-slots across all campaigns
              </span>
              <span className="dx-fw6">{totalDelivered.toLocaleString("en-IN")}</span>
            </div>
          )}
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
            Deduplicated by email address. Form leads (contact type) are not
            included in the "Everyone" audience unless they also subscribed or
            bought.{" "}
            <a href="/dashboard/crm" style={{ color: "var(--primary)" }}>
              View full CRM →
            </a>
          </p>
        </Card>
      </div>
    </>
  );
}
