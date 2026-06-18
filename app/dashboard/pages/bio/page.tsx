import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Phead, Kpis, Card, Table, Tag, Live, Donut } from "@/components/dx/ui";
import { DEFAULT_BIO, type BioContent } from "@/lib/bio";

export const dynamic = "force-dynamic";

export default async function BioPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: store } = await sb.from("stores").select("id, subdomain, onboarding_completed").eq("owner_id", user.id).maybeSingle();
  if (!store || !store.onboarding_completed) redirect("/onboarding");

  const { data: bio } = await sb.from("pages").select("id, content, status").eq("store_id", store.id).eq("page_type", "bio").maybeSingle();
  const content: BioContent = { ...DEFAULT_BIO, ...((bio?.content ?? {}) as BioContent) };
  const published = bio?.status === "published";
  const publicUrl = store.subdomain ? `https://${store.subdomain}.invoxai.io/bio` : null;

  // Real analytics from page_events.
  let views = 0, clicks = 0;
  const dev: Record<string, number> = { mobile: 0, desktop: 0, tablet: 0 };
  const topLinks: Record<string, number> = {};
  if (bio) {
    const { data: events } = await sb.from("page_events").select("kind, link_label, device").eq("page_id", bio.id);
    (events ?? []).forEach((e) => {
      if (e.kind === "view") { views++; if (e.device && dev[e.device] !== undefined) dev[e.device]++; }
      else { clicks++; if (e.link_label) topLinks[e.link_label] = (topLinks[e.link_label] ?? 0) + 1; }
    });
  }
  const ctr = views ? `${((clicks / views) * 100).toFixed(1)}%` : "0%";
  const devTotal = dev.mobile + dev.desktop + dev.tablet;
  const pct = (n: number) => (devTotal ? Math.round((n / devTotal) * 100) : 0);
  const linkRows = Object.entries(topLinks).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, n]) => [label, String(n)]);

  return (
    <>
      <Phead title="Bio page" sub="Your link-in-bio." action={<a className="btn grad" href="/dashboard/pages/bio/edit">{bio ? "Open builder" : "Build bio page"}</a>} />

      <Kpis items={[
        { icon: "eye", color: "var(--primary)", label: "Total views", value: views.toLocaleString("en-IN") },
        { icon: "link", color: "var(--secondary)", label: "Link clicks", value: clicks.toLocaleString("en-IN") },
        { icon: "spark", color: "var(--green)", label: "CTR", value: ctr },
        { icon: "chart", color: "var(--accent)", label: "Status", value: published ? "Live" : "Draft" },
      ]} />

      <div className="dx-grid dx-cols">
        <div>
          <Card title="Your bio page">
            <div className="dx-kv"><span className="dx-fw6">{publicUrl ? `${store.subdomain}.invoxai.io/bio` : "—"}</span>{bio ? (published ? <Live /> : <Tag kind="neu">Draft</Tag>) : <Tag kind="neu">Not created</Tag>}</div>
            <div className="dx-kv"><span>Links</span><span className="dx-fw6">{(content.links ?? []).length}</span></div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <a className="btn grad" href="/dashboard/pages/bio/edit">{bio ? "Open builder" : "Build bio page"}</a>
              {publicUrl && published && <a className="dx-editbtn" href={publicUrl} target="_blank" rel="noreferrer">View ↗</a>}
            </div>
          </Card>
          <div style={{ height: 16 }} />
          <Card title="Top links" link="by clicks"><Table cols={["Link", "Clicks"]} rows={linkRows} empty="No link clicks yet." /></Card>
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
