/**
 * Template live-preview frame — loaded inside an <iframe> from the admin
 * Import Manifest panel.
 *
 * URL: /admin-tpl-preview?type=<type>&c=<base64url-encoded-content-json>
 *
 * Auth: session cookie is forwarded by the browser so createClient() works.
 * Non-admins get a plain "access denied" page — no sensitive data is exposed
 * because the content came from the admin's own paste/upload.
 *
 * CSS strategy: each view namespace (bioview, storeview, webview) is already
 * self-contained in app/bio.css / store.css / website.css. We import all three
 * here at the page level — Next.js deduplicates them in the bundle. CourseView
 * carries its own inline CSS so no extra import needed for courses.
 *
 * Layout: this route sits under app/(tplpreview)/ — a Next.js route group that
 * bypasses the app/admin/layout.tsx shell, so no nav or DxShell wraps the iframe.
 */

import { createClient } from "@/lib/supabase/server";
import "../../bio.css";
import "../../store.css";
import "../../website.css";

// View components
import BioView from "@/components/bio/BioView";
import StoreView from "@/components/store/StoreView";
import WebsiteView from "@/components/website/WebsiteView";

// Types
import type { BioContent } from "@/lib/bio";
import type { StoreContent } from "@/lib/store";
import type { WebsiteContent } from "@/lib/website";

export const dynamic = "force-dynamic";

// ── Auth check ────────────────────────────────────────────────────────────────

async function isAdmin(): Promise<boolean> {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user.id);
    return (roles ?? []).some((r: { role: string }) => r.role === "admin");
  } catch {
    return false;
  }
}

// ── Content type labels ────────────────────────────────────────────────────────

const LABELS: Record<string, string> = {
  bio: "Link-in-bio", store: "Store", product: "Product", courses: "Courses",
  booking: "Booking", event: "Event", payment: "Payment", lead: "Lead form",
  website: "Website", checkout: "Checkout", vip: "VIP channel",
};

// ── Unsupported-type fallback ──────────────────────────────────────────────────

function FallbackPreview({ type, content }: { type: string; content: Record<string, unknown> }) {
  const order = Array.isArray(content.order) ? (content.order as string[]) : null;
  const theme = (content.theme as string | undefined) ?? (content.bg as string | undefined);
  const accent = content.accent !== undefined ? String(content.accent) : undefined;
  const dataArrays = Object.entries(content)
    .filter(([k, v]) => Array.isArray(v) && k !== "order" && k !== "tags")
    .map(([k, v]) => ({ key: k, count: (v as unknown[]).length }));

  // Course-specific fields
  const headline = content.headline as string | undefined;
  const subheadline = content.subheadline as string | undefined;
  const price = content.price !== undefined ? Number(content.price) : undefined;
  const currency = (content.currency as string | undefined) ?? "INR";
  const outcomes = Array.isArray(content.outcomes) ? (content.outcomes as string[]) : null;
  const instructorName = content.instructor_name as string | undefined;

  return (
    <div style={{
      fontFamily: "system-ui, sans-serif",
      padding: 32,
      color: "#2b1b2e",
      background: "#fff9f4",
      minHeight: "100vh",
    }}>
      <div style={{
        background: "#fff",
        border: "1px solid #f0e1d6",
        borderRadius: 16,
        padding: 24,
        maxWidth: 600,
        margin: "0 auto",
        fontFamily: "system-ui, sans-serif",
      }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#7a6770", marginBottom: 4 }}>
          {LABELS[type] ?? type} — content summary
        </div>
        <div style={{ fontSize: 13, color: "#7a6770", marginBottom: 16 }}>
          {type === "courses"
            ? "Full course renderer requires enrolled status and curriculum data not present in a manifest. Key fields shown below."
            : "Full live render is not yet available for this page type. Structural summary shown below."}
        </div>

        {/* Course-specific rich preview */}
        {type === "courses" && headline && (
          <div style={{ marginBottom: 16, borderBottom: "1px solid #f0e1d6", paddingBottom: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#2b1b2e", marginBottom: 6, fontFamily: "Georgia, serif" }}>{headline}</div>
            {subheadline && <div style={{ fontSize: 14, color: "#7a6770", marginBottom: 8 }}>{subheadline}</div>}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
              {price !== undefined && (
                <span style={{ fontSize: 20, fontWeight: 800, color: "#ff6a3d" }}>
                  {currency === "INR" ? "₹" : "$"}{price.toLocaleString()}
                </span>
              )}
              {instructorName && (
                <span style={{ fontSize: 13, color: "#7a6770" }}>by {instructorName}</span>
              )}
            </div>
            {outcomes && outcomes.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7a6770", marginBottom: 6 }}>Learning outcomes</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#2b1b2e" }}>
                  {outcomes.slice(0, 5).map((o, i) => <li key={i} style={{ marginBottom: 3 }}>{o}</li>)}
                  {outcomes.length > 5 && <li style={{ color: "#7a6770" }}>+{outcomes.length - 5} more</li>}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Theme tokens */}
        {(theme || accent !== undefined) && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7a6770", marginBottom: 6 }}>Theme</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {theme && <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: "#fff3ec", border: "1px solid #f0e1d6" }}>mode: {theme}</span>}
              {accent !== undefined && <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, background: "#fff3ec", border: "1px solid #f0e1d6" }}>accent: {accent}</span>}
            </div>
          </div>
        )}

        {/* Section order */}
        {order && order.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7a6770", marginBottom: 6 }}>Section order ({order.length})</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {order.map((s, i) => (
                <span key={i} style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, background: "#fff3ec", border: "1px solid #f0e1d6" }}>
                  {i + 1}. {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Data arrays */}
        {dataArrays.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7a6770", marginBottom: 6 }}>Data arrays</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {dataArrays.map(({ key, count }) => (
                <span key={key} style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, background: "#fff3ec", border: "1px solid #f0e1d6" }}>
                  <b>{key}:</b> {count} item{count !== 1 ? "s" : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: 11, color: "#7a6770", borderTop: "1px solid #f0e1d6", paddingTop: 10 }}>
          {Object.keys(content).length} top-level key{Object.keys(content).length !== 1 ? "s" : ""} in content blob.
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type SearchParams = Promise<{ type?: string; c?: string }>;

export default async function AdminTplPreviewPage(props: { searchParams: SearchParams }) {
  const ok = await isAdmin();
  if (!ok) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif", color: "#7a6770", padding: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Access denied</div>
          <div style={{ fontSize: 13 }}>Admin session required to view template previews.</div>
        </div>
      </div>
    );
  }

  const sp = await props.searchParams;
  const type = sp.type ?? "";
  const encodedContent = sp.c ?? "";

  // Decode content
  let content: Record<string, unknown> = {};
  if (encodedContent) {
    try {
      const json = Buffer.from(encodedContent, "base64").toString("utf8");
      const parsed = JSON.parse(json);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        content = parsed as Record<string, unknown>;
      }
    } catch {
      // Fall through to empty content
    }
  }

  if (!type || Object.keys(content).length === 0) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif", color: "#7a6770", padding: 24 }}>
        <div style={{ textAlign: "center", fontSize: 13 }}>No content to preview yet.</div>
      </div>
    );
  }

  // Render the right view component
  if (type === "bio") {
    return <BioView content={content as BioContent} animate={false} stage />;
  }

  if (type === "store") {
    return <StoreView content={content as StoreContent} stage />;
  }

  if (type === "website") {
    return <WebsiteView content={content as WebsiteContent} stage />;
  }

  // Fallback for other types (including courses — CourseView requires full page+modules props)
  return <FallbackPreview type={type} content={content} />;
}
