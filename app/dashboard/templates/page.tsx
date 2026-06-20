/**
 * /dashboard/templates — Seller template gallery (Phase D).
 *
 * Server component: fetches published templates, resolves ownership
 * and all_access plan feature, then passes data to the TemplateGallery
 * client component.
 *
 * Auth pattern: requireDashboardStore() — same as coupons/page.tsx.
 * DB pattern: admin client for published templates (RLS allows public
 *   select on status='published'); admin client for template_purchases
 *   (seller's RLS policy allows select own rows — use admin to avoid
 *   double-auth round-trip since we already verified the session above).
 */

import { requireDashboardStore } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasFeature } from "@/lib/plan-features.server";
import { Phead, Kpis } from "@/components/dx/ui";
import TemplateGallery, { type GalleryTemplate } from "./TemplateGallery";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  // ── 1. Fetch published templates ────────────────────────────────────────────
  const { data: rawTemplates } = await sb
    .from("templates")
    .select(
      "id, name, type, tier, price_paise, thumbnail_url, description, tags, license_model, sales_count, theme",
    )
    .eq("status", "published")
    .order("sales_count", { ascending: false });

  const templates = (rawTemplates ?? []) as Array<{
    id: string;
    name: string;
    type: string;
    tier: "free" | "premium";
    price_paise: number;
    thumbnail_url: string | null;
    description: string | null;
    tags: string[] | null;
    license_model: "per_store" | "per_page" | "all_access";
    sales_count: number;
    theme: Record<string, unknown> | null;
  }>;

  // ── 2. Resolve which templates this store already owns ──────────────────────
  //   Fetch all template_purchases rows for this store in one query.
  const { data: purchases } = await sb
    .from("template_purchases")
    .select("template_id")
    .eq("store_id", store.id)
    .is("page_id", null); // per_store license: page_id IS NULL

  const ownedIds = new Set((purchases ?? []).map((p: { template_id: string }) => p.template_id));

  // ── 3. templates_all_access plan feature ────────────────────────────────────
  const hasAllAccess = await hasFeature(store.id, "templates_all_access");

  // ── 4. Build gallery rows ───────────────────────────────────────────────────
  const galleryTemplates: GalleryTemplate[] = templates.map((t) => {
    const owned = ownedIds.has(t.id);
    // included = either all_access feature OR the template itself uses all_access
    // license model and the store has the plan feature
    const included =
      hasAllAccess &&
      (t.license_model === "all_access" || t.tier === "free");

    return {
      id: t.id,
      name: t.name,
      type: t.type,
      tier: t.tier,
      price_paise: t.price_paise,
      thumbnail_url: t.thumbnail_url,
      description: t.description,
      tags: t.tags ?? [],
      license_model: t.license_model,
      sales_count: t.sales_count,
      theme: t.theme,
      owned,
      included,
    };
  });

  // ── 5. KPI counts ────────────────────────────────────────────────────────────
  const totalTemplates = galleryTemplates.length;
  const freeCount = galleryTemplates.filter((t) => t.tier === "free").length;
  const premiumCount = galleryTemplates.filter((t) => t.tier === "premium").length;
  const ownedCount = galleryTemplates.filter((t) => t.owned || t.included).length;

  // ── 6. Suggested actions (Phase D rule 5) ────────────────────────────────────
  // Surfaced as a suggestion banner when the gallery is empty or has few templates.
  const suggestUpgrade = !hasAllAccess && premiumCount > 0;

  return (
    <>
      <Phead
        title="Templates"
        sub="Browse designs, apply a free template, or unlock premium ones — all editable in your studio."
      />

      <Kpis
        items={[
          {
            icon: "layers",
            color: "var(--primary)",
            label: "Total templates",
            value: String(totalTemplates),
          },
          {
            icon: "tag",
            color: "var(--green)",
            label: "Free templates",
            value: String(freeCount),
          },
          {
            icon: "star",
            color: "var(--gold)",
            label: "Premium templates",
            value: String(premiumCount),
          },
          {
            icon: "eye",
            color: "var(--secondary)",
            label: "Available to you",
            value: String(ownedCount + freeCount),
          },
        ]}
      />

      {/* Suggest more: upgrade nudge for premium templates */}
      {suggestUpgrade && (
        <div
          style={{
            background:
              "color-mix(in srgb, var(--gold) 10%, var(--surface))",
            border:
              "1px solid color-mix(in srgb, var(--gold) 26%, var(--border))",
            borderRadius: 14,
            padding: "14px 18px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1 }}>
            <b style={{ fontSize: 14, display: "block", marginBottom: 3 }}>
              Unlock all {premiumCount} premium template{premiumCount !== 1 ? "s" : ""}
            </b>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              Upgrade your plan to get templates_all_access and apply any premium design instantly — no per-template charge.
            </span>
          </div>
          <a href="/dashboard/billing" className="btn btn-sm grad">
            Upgrade plan
          </a>
        </div>
      )}

      {/* Suggest more: all-access banner */}
      {hasAllAccess && premiumCount > 0 && (
        <div
          style={{
            background:
              "color-mix(in srgb, var(--primary) 8%, var(--surface))",
            border:
              "1px solid color-mix(in srgb, var(--primary) 20%, var(--border))",
            borderRadius: 14,
            padding: "12px 18px",
            marginBottom: 20,
            fontSize: 13,
          }}
        >
          <b style={{ color: "var(--primary)" }}>All-access included</b> — your plan includes all {premiumCount} premium template{premiumCount !== 1 ? "s" : ""}. Apply any of them for free.
        </div>
      )}

      {/* Gallery client component */}
      <TemplateGallery templates={galleryTemplates} hasAllAccess={hasAllAccess} />

      {/* Suggest more: empty state suggestions */}
      {totalTemplates === 0 && (
        <div
          style={{
            marginTop: 32,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {[
            {
              icon: "site",
              label: "Build your website",
              href: "/dashboard/website",
              sub: "Customise your homepage in the website builder",
            },
            {
              icon: "bag",
              label: "Set up your store",
              href: "/dashboard/store",
              sub: "Design your product catalog and branding",
            },
            {
              icon: "link",
              label: "Create a bio page",
              href: "/dashboard/pages/bio",
              sub: "One link for all your content and products",
            },
          ].map((s) => (
            <a
              key={s.href}
              href={s.href}
              style={{
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "16px 18px",
                textDecoration: "none",
                color: "var(--text)",
                display: "block",
              }}
            >
              <b style={{ fontSize: 14, display: "block", marginBottom: 4 }}>{s.label}</b>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{s.sub}</span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
