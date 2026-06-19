import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card, Table, Tag, Live, Donut } from "@/components/dx/ui";
import { DEFAULT_WEBSITE, type WebsiteContent } from "@/lib/website";

export const dynamic = "force-dynamic";

export default async function WebsitePage() {
  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  const { data: site } = await sb.from("pages").select("id, content, status").eq("store_id", store.id).eq("page_type", "website").maybeSingle();
  const content: WebsiteContent = { ...DEFAULT_WEBSITE, ...((site?.content ?? {}) as WebsiteContent) };
  const published = site?.status === "published";
  const publicUrl = store.subdomain ? `https://${store.subdomain}.invoxai.io` : null;
  const enabledSections = (content.order ?? []).filter((k) => content.sections?.[k]).length;

  // Real analytics from page_events.
  let views = 0, clicks = 0;
  const dev: Record<string, number> = { mobile: 0, desktop: 0, tablet: 0 };
  const topLinks: Record<string, number> = {};
  if (site) {
    const { data: events } = await sb.from("page_events").select("kind, link_label, device").eq("page_id", site.id);
    (events ?? []).forEach((e) => {
      if (e.kind === "view") { views++; if (e.device && dev[e.device] !== undefined) dev[e.device]++; }
      else { clicks++; if (e.link_label) topLinks[e.link_label] = (topLinks[e.link_label] ?? 0) + 1; }
    });
  }
  // Contact-form leads + newsletter signups.
  const { data: messages } = await sb.from("site_messages").select("kind, name, email, created_at").eq("store_id", store.id).order("created_at", { ascending: false }).limit(8);
  const leadCount = (messages ?? []).length;
  const msgRows = (messages ?? []).map((m) => [m.name || m.email || "—", m.kind === "newsletter" ? "Newsletter" : "Contact", new Date(m.created_at).toLocaleDateString("en-IN")]);

  const ctr = views ? `${Math.min(100, (clicks / views) * 100).toFixed(1)}%` : "0%";
  const devTotal = dev.mobile + dev.desktop + dev.tablet;
  const pct = (n: number) => (devTotal ? Math.round((n / devTotal) * 100) : 0);
  const linkRows = Object.entries(topLinks).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, n]) => [label, String(n)]);

  return (
    <>
      <Phead title="Website" sub="Your multi-section homepage." action={<a className="btn grad" href="/studio/website" target="_blank" rel="noreferrer">{site ? "Open builder ↗" : "Build website ↗"}</a>} />

      <Kpis items={[
        { icon: "eye", color: "var(--primary)", label: "Total views", value: views.toLocaleString("en-IN") },
        { icon: "link", color: "var(--secondary)", label: "CTA clicks", value: clicks.toLocaleString("en-IN") },
        { icon: "spark", color: "var(--green)", label: "CTR", value: ctr },
        { icon: "chart", color: "var(--accent)", label: "Status", value: published ? "Live" : "Draft" },
      ]} />

      <div className="dx-grid dx-cols">
        <div>
          <Card title="Your website">
            <div className="dx-kv"><span className="dx-fw6">{publicUrl ? `${store.subdomain}.invoxai.io` : "—"}</span>{site ? (published ? <Live /> : <Tag kind="neu">Draft</Tag>) : <Tag kind="neu">Not created</Tag>}</div>
            <div className="dx-kv"><span>Sections enabled</span><span className="dx-fw6">{enabledSections}</span></div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <a className="btn grad" href="/studio/website" target="_blank" rel="noreferrer">{site ? "Open builder ↗" : "Build website ↗"}</a>
              {publicUrl && published && <a className="dx-editbtn" href={publicUrl} target="_blank" rel="noreferrer">View ↗</a>}
            </div>
          </Card>
          <div style={{ height: 16 }} />
          <Card title="Top CTAs" link="by clicks"><Table cols={["CTA", "Clicks"]} rows={linkRows} empty="No CTA clicks yet." /></Card>
          <div style={{ height: 16 }} />
          <Card title="Recent messages" link={leadCount ? `${leadCount} total` : undefined}><Table cols={["From", "Type", "Date"]} rows={msgRows} empty="No form submissions yet." /></Card>
        </div>
        <div>
          <Card title="Devices">
            {devTotal === 0 ? <div className="dx-empty">No traffic yet.</div> : (
              <Donut segments={[
                { label: "Mobile", pct: pct(dev.mobile), color: "var(--primary)" },
                { label: "Desktop", pct: pct(dev.desktop), color: "var(--secondary)" },
                { label: "Tablet", pct: pct(dev.tablet), color: "var(--accent)" },
              ]} />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
