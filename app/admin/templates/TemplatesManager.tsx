"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Phead, Card, Table, Kpis, Tag, Live } from "@/components/dx/ui";
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  toggleTemplateStatus,
  importManifest,
  exportTemplateManifest,
  generateTemplateWithAI,
  type TemplateRow,
  type TemplateInput,
  type TemplateSalesStat,
  type TemplateManifest,
} from "./actions";

/* ── helpers ─────────────────────────────────────────────────── */

const inr = (paise: number) =>
  paise === 0 ? "Free" : "₹" + Math.round(paise / 100).toLocaleString("en-IN");

const PAGE_TYPES = [
  "bio", "store", "product", "courses", "booking",
  "event", "payment", "lead", "website", "checkout", "vip",
] as const;

const TYPE_LABELS: Record<string, string> = {
  bio: "Link-in-bio", store: "Store", product: "Product", courses: "Courses",
  booking: "Booking", event: "Event", payment: "Payment", lead: "Lead form",
  website: "Website", checkout: "Checkout", vip: "VIP channel",
};

const LICENSE_LABELS: Record<string, string> = {
  per_store: "Per store (once per store)",
  per_page: "Per page (each apply charged)",
  all_access: "All-access (plan feature)",
};

function tryParseJson(s: string): { ok: true; val: unknown } | { ok: false; err: string } {
  if (!s.trim()) return { ok: false, err: "JSON is empty." };
  try {
    return { ok: true, val: JSON.parse(s) };
  } catch (e) {
    return { ok: false, err: String(e) };
  }
}

/* ── inline styles ───────────────────────────────────────────── */
const css = `
  .tm-badge-free  { background: #e5f7ef; color: #1fb57a; }
  .tm-badge-prem  { background: linear-gradient(135deg,#ffb23e,#ff6a3d 38%,#ff4d7d 68%,#7b3fe4); color: #fff; }
  .tm-badge       { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 99px; white-space: nowrap; display: inline-block; }
  .tm-thumb-pre   { width: 64px; height: 48px; border-radius: 8px; background: var(--surface2); border: 1px solid var(--border); overflow: hidden; flex: none; }
  .tm-thumb-pre img { width: 100%; height: 100%; object-fit: cover; }
  .tm-thumb-mock  { width: 100%; height: 100%; display: flex; flex-direction: column; gap: 4px; padding: 6px; }
  .tm-thumb-mock i { display: block; border-radius: 2px; background: var(--border); }

  /* grid card */
  .tm-card-grid   { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; box-shadow: var(--shadow); }
  .tm-card-thumb  { aspect-ratio: 4/3; background: var(--surface2); position: relative; overflow: hidden; display: grid; place-items: center; }
  .tm-card-thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .tm-card-thumb .tm-tier-tag { position: absolute; top: 10px; left: 10px; z-index: 3; }
  .tm-card-body   { padding: 14px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
  .tm-card-type   { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--accent); }
  .tm-card-name   { font-family: "Sora", sans-serif; font-size: 14.5px; font-weight: 700; color: var(--text); }
  .tm-card-foot   { display: flex; align-items: center; gap: 8px; margin-top: auto; padding-top: 10px; }
  .tm-card-price  { font-family: "Sora", sans-serif; font-weight: 800; font-size: 15px; color: var(--primary); }
  .tm-card-price.free { color: var(--green, #1fb57a); }
  .tm-card-acts   { margin-left: auto; display: flex; gap: 6px; }
  .tm-sales       { font-size: 12px; color: var(--muted); }

  /* edit drawer */
  .tm-scrim       { position: fixed; inset: 0; z-index: 60; background: rgba(20,12,25,.45); backdrop-filter: blur(3px); }
  .tm-drawer      { position: fixed; z-index: 61; right: 0; top: 0; bottom: 0; width: min(560px, 96vw); background: var(--surface); border-left: 1px solid var(--border); display: flex; flex-direction: column; box-shadow: -24px 0 60px rgba(0,0,0,.18); overflow: hidden; }
  .tm-dhead       { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px 14px; border-bottom: 1px solid var(--border); flex: none; }
  .tm-dhead h3    { font-family: "Sora", sans-serif; font-size: 16px; font-weight: 700; margin: 0; }
  .tm-dbody       { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
  .tm-dfoot       { flex: none; padding: 14px 20px; border-top: 1px solid var(--border); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .tm-msg         { font-size: 12px; color: var(--muted); margin-left: auto; }
  .tm-msg.err     { color: var(--red, #e5476f); }

  .tm-filter-bar  { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }

  /* notice banner */
  .tm-notice      { border: 1px dashed var(--border); border-radius: 12px; padding: 20px; background: var(--surface); display: flex; gap: 14px; align-items: flex-start; }
  .tm-notice-icon { font-size: 22px; flex: none; }
  .tm-notice h3   { font-size: 15px; margin: 0 0 4px; }
  .tm-notice p    { font-size: 13px; color: var(--muted); margin: 0; }

  /* mono textarea */
  .tm-mono        { font-family: "JetBrains Mono", "Fira Code", ui-monospace, monospace; font-size: 12px; line-height: 1.6; }

  /* tabs */
  .tm-tabs        { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 14px; }
  .tm-tab         { padding: 8px 14px; font-size: 13px; font-weight: 600; border-radius: 8px 8px 0 0; cursor: pointer; background: none; border: none; color: var(--muted); }
  .tm-tab.on      { background: var(--surface2); color: var(--text); border-bottom: 2px solid var(--primary); }

  /* import panel */
  .tm-import-panel { display: flex; flex-direction: column; gap: 12px; }
  .tm-errs        { background: #fff5f5; border: 1px solid #fecaca; border-radius: 10px; padding: 12px; font-size: 12.5px; color: #991b1b; }
  .tm-errs ul     { margin: 6px 0 0; padding-left: 20px; }
  .tm-errs ul li  { margin-bottom: 3px; }
  .tm-success-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px; font-size: 13px; color: #166534; }

  /* generate-with-ai panel */
  .tm-ai-panel     { display: flex; flex-direction: column; gap: 14px; }
  .tm-ai-badge     { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; padding: 3px 10px; border-radius: 99px; background: linear-gradient(135deg,#7b3fe4,#ff4d7d); color: #fff; width: fit-content; }
  .tm-ai-notice    { background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; font-size: 12.5px; color: var(--muted); line-height: 1.55; }
  .tm-ai-stub-warn { background: #fff8e6; border: 1px solid #f5d97a; border-radius: 10px; padding: 10px 14px; font-size: 12.5px; color: #7a5c00; }
  .tm-ai-result    { display: flex; flex-direction: column; gap: 12px; }
  .tm-ai-raw-label { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }

  /* content preview summary */
  .tm-preview-card { background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
  .tm-preview-row  { display: flex; gap: 8px; flex-wrap: wrap; font-size: 12px; }
  .tm-preview-kv   { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 3px 8px; }
  .tm-preview-kv b { font-weight: 600; }
  .tm-json-err    { font-size: 12px; color: var(--red, #e5476f); margin-top: 4px; }
`;

/* ── select style helper ──────────────────────────────────────── */
const selStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", border: "1px solid var(--border)",
  borderRadius: 10, background: "var(--bg)", color: "var(--text)", font: "inherit",
};
const taStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", border: "1px solid var(--border)",
  borderRadius: 10, background: "var(--bg)", color: "var(--text)", font: "inherit",
  resize: "vertical",
};

/* ── ContentPreview ──────────────────────────────────────────── */
//
// Preview approach: SUMMARY CARD.
//
// Rationale: The live site renderer (app/sites/[domain]/[[...path]]/page.tsx)
// requires a real `domain` + published pages row — there is no sandboxed
// /preview route that accepts arbitrary content JSON without a real domain.
// Building a new renderer just for this panel would duplicate ~10 view
// components. A compact summary card (type, theme tokens, section order,
// array counts) gives the admin all the actionable information without the
// complexity/maintenance burden of a full iframe renderer.

function ContentPreview({ type, content }: { type: string; content: Record<string, unknown> | null | undefined }) {
  if (!content || Object.keys(content).length === 0) {
    return (
      <div className="tm-preview-card" style={{ color: "var(--muted)", fontSize: 13 }}>
        No content payload yet. Fill in the Content JSON tab.
      </div>
    );
  }

  const order = Array.isArray(content.order) ? (content.order as string[]) : null;
  const sections = content.sections && typeof content.sections === "object"
    ? Object.entries(content.sections as Record<string, unknown>).filter(([, v]) => v).map(([k]) => k)
    : null;
  const theme = content.theme as string | undefined;
  const accent = content.accent !== undefined ? String(content.accent) : undefined;
  const font = content.font as string | undefined;
  const bg = content.bg as string | undefined;

  // Count data arrays
  const dataArrays: { key: string; count: number }[] = [];
  for (const [k, v] of Object.entries(content)) {
    if (Array.isArray(v) && k !== "order" && k !== "tags") {
      dataArrays.push({ key: k, count: v.length });
    }
  }

  return (
    <div className="tm-preview-card">
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)", marginBottom: 4 }}>
        Content summary — {TYPE_LABELS[type] ?? type}
      </div>

      {/* Theme tokens */}
      {(theme || accent !== undefined || font || bg) && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>Theme tokens</div>
          <div className="tm-preview-row">
            {theme && <span className="tm-preview-kv"><b>mode:</b> {theme}</span>}
            {accent !== undefined && <span className="tm-preview-kv"><b>accent:</b> {accent}</span>}
            {font && <span className="tm-preview-kv"><b>font:</b> {font}</span>}
            {bg && <span className="tm-preview-kv"><b>bg:</b> {bg}</span>}
            {content.btshape ? <span className="tm-preview-kv"><b>btshape:</b> {String(content.btshape)}</span> : null}
            {content.pageWidth ? <span className="tm-preview-kv"><b>width:</b> {String(content.pageWidth)}</span> : null}
          </div>
        </div>
      )}

      {/* Section order */}
      {order && order.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>
            Section order ({order.length})
          </div>
          <div className="tm-preview-row">
            {order.map((s, i) => (
              <span key={i} className="tm-preview-kv" style={{
                borderColor: sections?.includes(s) ? "var(--accent)" : undefined,
                color: sections?.includes(s) ? "var(--text)" : "var(--muted)",
              }}>
                {i + 1}. {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Data arrays */}
      {dataArrays.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>Data arrays</div>
          <div className="tm-preview-row">
            {dataArrays.map(({ key, count }) => (
              <span key={key} className="tm-preview-kv">
                <b>{key}:</b> {count} item{count !== 1 ? "s" : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top-level key count */}
      <div style={{ fontSize: 11, color: "var(--muted)", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
        {Object.keys(content).length} top-level key{Object.keys(content).length !== 1 ? "s" : ""} in content blob.
      </div>
    </div>
  );
}

/* ── DrawerForm ──────────────────────────────────────────────── */

type DrawerTab = "meta" | "content" | "preview";

type DrawerProps = {
  row: TemplateRow | null; // null = create
  onClose: () => void;
};

function DrawerForm({ row, onClose }: DrawerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [exportPending, startExport] = useTransition();
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);
  const [tab, setTab] = useState<DrawerTab>("meta");

  // Stringify existing content/theme for editing
  const initialContentStr = row?.content ? JSON.stringify(row.content, null, 2) : "";
  const initialThemeStr = row?.theme ? JSON.stringify(row.theme, null, 2) : "";
  const initialTagsStr = (row?.tags ?? []).join(", ");

  const blank: TemplateInput = {
    name: row?.name ?? "",
    type: row?.type ?? "bio",
    tier: row?.tier ?? "free",
    price_paise: row?.price_paise ?? 0,
    thumbnail_url: row?.thumbnail_url ?? "",
    description: row?.description ?? "",
    status: row?.status ?? "draft",
    slug: row?.slug ?? "",
    tags: row?.tags ?? [],
    license_model: row?.license_model ?? "per_store",
    content: row?.content ?? null,
    theme: row?.theme ?? null,
    demo_page_id: row?.demo_page_id ?? "",
  };

  const [f, setF] = useState<TemplateInput>(blank);

  // Raw string states for JSON fields
  const [contentStr, setContentStr] = useState(initialContentStr);
  const [themeStr, setThemeStr] = useState(initialThemeStr);
  const [tagsStr, setTagsStr] = useState(initialTagsStr);
  const [contentErr, setContentErr] = useState<string | null>(null);
  const [themeErr, setThemeErr] = useState<string | null>(null);

  function field(key: keyof TemplateInput, value: string | number | string[] | null | Record<string, unknown>) {
    setF((p) => ({ ...p, [key]: value }));
  }

  function onContentChange(s: string) {
    setContentStr(s);
    if (!s.trim()) {
      setContentErr(null);
      field("content", null);
      return;
    }
    const r = tryParseJson(s);
    if (!r.ok) {
      setContentErr(r.err);
    } else {
      setContentErr(null);
      field("content", r.val as Record<string, unknown>);
    }
  }

  function onThemeChange(s: string) {
    setThemeStr(s);
    if (!s.trim()) {
      setThemeErr(null);
      field("theme", null);
      return;
    }
    const r = tryParseJson(s);
    if (!r.ok) {
      setThemeErr(r.err);
    } else {
      setThemeErr(null);
      field("theme", r.val as Record<string, unknown>);
    }
  }

  function onTagsChange(s: string) {
    setTagsStr(s);
    const tags = s.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    field("tags", tags);
  }

  function save() {
    if (contentErr || themeErr) {
      setMsg({ text: "Fix JSON errors before saving.", err: true });
      return;
    }
    startTransition(async () => {
      setMsg(null);
      let res;
      if (row) {
        res = await updateTemplate(row.id, { ...f, tags: f.tags ?? [] });
      } else {
        const created = await createTemplate();
        if (!created.ok) { setMsg({ text: created.error, err: true }); return; }
        res = await updateTemplate(created.data!.id, { ...f, tags: f.tags ?? [] });
      }
      if (!res.ok) { setMsg({ text: (res as { ok: false; error: string }).error, err: true }); return; }
      setMsg({ text: "Saved", err: false });
      router.refresh();
      setTimeout(onClose, 600);
    });
  }

  function doExport() {
    if (!row) return;
    startExport(async () => {
      const res = await exportTemplateManifest(row.id);
      if (!res.ok) { setMsg({ text: res.error, err: true }); return; }
      // Trigger a browser download
      const blob = new Blob([JSON.stringify(res.manifest, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const contentForPreview = f.content ?? (contentStr.trim() ? (() => {
    const r = tryParseJson(contentStr);
    return r.ok ? r.val as Record<string, unknown> : null;
  })() : null);

  return (
    <>
      <div className="tm-scrim" onClick={onClose} />
      <aside className="tm-drawer">
        <div className="tm-dhead">
          <h3>{row ? "Edit template" : "New template"}</h3>
          <div style={{ display: "flex", gap: 6 }}>
            {row && (
              <button className="dx-editbtn" onClick={doExport} disabled={exportPending} title="Export manifest JSON">
                {exportPending ? "…" : "Export JSON"}
              </button>
            )}
            <button className="dx-editbtn" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="tm-dbody">
          {/* Tabs */}
          <div className="tm-tabs">
            <button className={`tm-tab${tab === "meta" ? " on" : ""}`} onClick={() => setTab("meta")}>Metadata</button>
            <button className={`tm-tab${tab === "content" ? " on" : ""}`} onClick={() => setTab("content")}>Content JSON</button>
            <button className={`tm-tab${tab === "preview" ? " on" : ""}`} onClick={() => setTab("preview")}>Preview</button>
          </div>

          {/* ── META TAB ── */}
          {tab === "meta" && (
            <>
              <div className="dx-field">
                <label>Template name</label>
                <input value={f.name} placeholder="e.g. Aurora Bio" onChange={(e) => field("name", e.target.value)} />
              </div>

              <div className="dx-ff">
                <div className="dx-field">
                  <label>Page type</label>
                  <select value={f.type} onChange={(e) => field("type", e.target.value)} style={selStyle}>
                    {PAGE_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div className="dx-field">
                  <label>Tier</label>
                  <select value={f.tier} onChange={(e) => field("tier", e.target.value)} style={selStyle}>
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
              </div>

              {f.tier === "premium" && (
                <div className="dx-field">
                  <label>Price (₹)</label>
                  <input
                    type="number" min={0} step={1}
                    value={Math.round(f.price_paise / 100) || ""}
                    placeholder="e.g. 499"
                    onChange={(e) => field("price_paise", Math.round(parseFloat(e.target.value) || 0) * 100)}
                  />
                </div>
              )}

              <div className="dx-field">
                <label>License model</label>
                <select value={f.license_model ?? "per_store"} onChange={(e) => field("license_model", e.target.value)} style={selStyle}>
                  <option value="per_store">Per store</option>
                  <option value="per_page">Per page</option>
                  <option value="all_access">All-access (plan feature)</option>
                </select>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
                  {LICENSE_LABELS[f.license_model ?? "per_store"]}
                </div>
              </div>

              <div className="dx-field">
                <label>Slug (URL-safe, optional)</label>
                <input
                  value={f.slug ?? ""}
                  placeholder="e.g. sunset-studio-website"
                  onChange={(e) => field("slug", e.target.value)}
                />
              </div>

              <div className="dx-field">
                <label>Tags (comma separated)</label>
                <input
                  value={tagsStr}
                  placeholder="e.g. agency, bold, dark"
                  onChange={(e) => onTagsChange(e.target.value)}
                />
                {(f.tags ?? []).length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                    {(f.tags ?? []).map((t, i) => (
                      <span key={i} style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "var(--surface2)", border: "1px solid var(--border)" }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="dx-field">
                <label>Thumbnail URL</label>
                <input
                  value={f.thumbnail_url}
                  placeholder="https://… (use /api/upload)"
                  onChange={(e) => field("thumbnail_url", e.target.value)}
                />
                {f.thumbnail_url && (
                  <div style={{ marginTop: 8, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)", maxWidth: 180, aspectRatio: "4/3", background: "var(--surface2)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.thumbnail_url} alt="thumb" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
              </div>

              <div className="dx-field">
                <label>Description</label>
                <textarea
                  rows={3}
                  value={f.description}
                  placeholder="What makes this template special…"
                  onChange={(e) => field("description", e.target.value)}
                  style={taStyle}
                />
              </div>

              <div className="dx-ff">
                <div className="dx-field">
                  <label>Status</label>
                  <select value={f.status} onChange={(e) => field("status", e.target.value)} style={selStyle}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
                <div className="dx-field">
                  <label>Demo page ID (optional)</label>
                  <input
                    value={f.demo_page_id ?? ""}
                    placeholder="uuid of a pages row"
                    onChange={(e) => field("demo_page_id", e.target.value || null)}
                  />
                </div>
              </div>
            </>
          )}

          {/* ── CONTENT JSON TAB ── */}
          {tab === "content" && (
            <>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>
                Paste the <strong>content</strong> JSON for this template. Must match the{" "}
                <code>{TYPE_LABELS[f.type] ?? f.type}</code> schema from{" "}
                <code>lib/{f.type === "courses" ? "course" : f.type}.ts</code>.
              </div>

              <div className="dx-field">
                <label>content (JSON)</label>
                <textarea
                  rows={16}
                  className="tm-mono"
                  value={contentStr}
                  placeholder={`{\n  "theme": "dark",\n  "accent": 0\n}`}
                  onChange={(e) => onContentChange(e.target.value)}
                  style={{ ...taStyle, fontFamily: "\"JetBrains Mono\",\"Fira Code\",ui-monospace,monospace", fontSize: 12 }}
                  spellCheck={false}
                />
                {contentErr && <div className="tm-json-err">{contentErr}</div>}
                {!contentErr && contentStr.trim() && (
                  <div style={{ fontSize: 11.5, color: "var(--green, #1fb57a)", marginTop: 4 }}>Valid JSON</div>
                )}
              </div>

              <div className="dx-field">
                <label>theme token overrides (JSON, optional)</label>
                <textarea
                  rows={4}
                  className="tm-mono"
                  value={themeStr}
                  placeholder={`{}`}
                  onChange={(e) => onThemeChange(e.target.value)}
                  style={{ ...taStyle, fontFamily: "\"JetBrains Mono\",\"Fira Code\",ui-monospace,monospace", fontSize: 12 }}
                  spellCheck={false}
                />
                {themeErr && <div className="tm-json-err">{themeErr}</div>}
              </div>
            </>
          )}

          {/* ── PREVIEW TAB ── */}
          {tab === "preview" && (
            <ContentPreview type={f.type} content={contentForPreview as Record<string, unknown> | null} />
          )}
        </div>

        <div className="tm-dfoot">
          <button className="btn grad" onClick={save} disabled={pending || !!contentErr || !!themeErr}>
            {pending ? "Saving…" : "Save template"}
          </button>
          {msg && <span className={`tm-msg${msg.err ? " err" : ""}`}>{msg.text}</span>}
        </div>
      </aside>
    </>
  );
}

/* ── ImportManifestPanel ─────────────────────────────────────── */

function ImportManifestPanel({ onDone }: { onDone: () => void }) {
  const [raw, setRaw] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    { kind: "errors"; errors: string[] } | { kind: "success"; id: string } | null
  >(null);

  function doImport() {
    if (!raw.trim()) return;
    startTransition(async () => {
      setResult(null);
      const res = await importManifest(raw);
      if (!res.ok) {
        setResult({ kind: "errors", errors: res.errors });
      } else {
        setResult({ kind: "success", id: res.id });
        setRaw("");
        onDone();
      }
    });
  }

  function loadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") setRaw(text);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <Card title="Import manifest">
      <div className="tm-import-panel">
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          Paste a Template Manifest JSON (see <code>docs/TEMPLATE-AUTHORING-FORMAT.md</code>) or upload a{" "}
          <code>.json</code> file. The manifest is validated then saved as a <strong>draft</strong>.
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label
            style={{ fontSize: 12.5, fontWeight: 600, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", background: "var(--surface2)" }}
          >
            Upload .json
            <input type="file" accept=".json,application/json" style={{ display: "none" }} onChange={loadFile} />
          </label>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>or paste below</span>
        </div>

        <textarea
          rows={10}
          className="tm-mono"
          value={raw}
          placeholder={`{\n  "name": "Sunset Studio",\n  "type": "website",\n  "tier": "premium",\n  "price_paise": 49900,\n  ...`}
          onChange={(e) => { setRaw(e.target.value); setResult(null); }}
          style={{
            width: "100%", padding: "10px 12px", border: "1px solid var(--border)",
            borderRadius: 10, background: "var(--bg)", color: "var(--text)", resize: "vertical",
            fontFamily: "\"JetBrains Mono\",\"Fira Code\",ui-monospace,monospace", fontSize: 12,
          }}
          spellCheck={false}
        />

        {result?.kind === "errors" && (
          <div className="tm-errs">
            <strong>Validation failed</strong>
            <ul>
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {result?.kind === "success" && (
          <div className="tm-success-box">
            Template imported successfully (ID: <code>{result.id}</code>). It is saved as a draft — edit it above to adjust and publish.
          </div>
        )}

        <div>
          <button
            className="btn grad"
            onClick={doImport}
            disabled={pending || !raw.trim()}
          >
            {pending ? "Validating…" : "Validate & import"}
          </button>
        </div>
      </div>
    </Card>
  );
}

/* ── GenerateWithAIPanel ─────────────────────────────────────── */
//
// ADMIN AUTHORING TOOL — never imported by seller-facing pages.
// Calls generateTemplateWithAI (server action) which is requireAdmin-guarded.
// Real Claude generation activates when ANTHROPIC_API_KEY is set server-side;
// without the key a deterministic stub runs the full validate→preview→save flow.

type AIBrief = {
  type: string;
  vibe: string;
  audience: string;
  tier: string;
  price_paise: number;
  license_model: string;
  name: string;
};

type AIResult =
  | { kind: "errors"; error: string; raw?: string }
  | { kind: "success"; manifest: TemplateManifest; raw: string; isStub: boolean };

function GenerateWithAIPanel({ onDone }: { onDone: () => void }) {
  const [brief, setBrief] = useState<AIBrief>({
    type: "website",
    vibe: "",
    audience: "",
    tier: "free",
    price_paise: 0,
    license_model: "per_store",
    name: "",
  });
  const [generating, startGen] = useTransition();
  const [saving, startSave] = useTransition();
  const [result, setResult] = useState<AIResult | null>(null);
  // Raw JSON in the editable textarea (seeded from AI output; admin can tweak)
  const [rawEdit, setRawEdit] = useState("");
  const [rawErr, setRawErr] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<{ text: string; err: boolean } | null>(null);

  function field<K extends keyof AIBrief>(k: K, v: AIBrief[K]) {
    setBrief((p) => ({ ...p, [k]: v }));
    // Reset result when brief changes
    setResult(null);
    setRawEdit("");
    setSaveMsg(null);
  }

  function onRawEditChange(s: string) {
    setRawEdit(s);
    setSaveMsg(null);
    if (!s.trim()) { setRawErr(null); return; }
    try { JSON.parse(s); setRawErr(null); } catch (e) { setRawErr(String(e)); }
  }

  function doGenerate() {
    if (!brief.vibe.trim()) return;
    startGen(async () => {
      setResult(null);
      setSaveMsg(null);
      const res = await generateTemplateWithAI({
        type: brief.type,
        vibe: brief.vibe,
        audience: brief.audience || undefined,
        tier: brief.tier,
        price_paise: brief.tier === "free" ? 0 : brief.price_paise,
        license_model: brief.license_model,
        name: brief.name || undefined,
      });
      if (!res.ok) {
        setResult({ kind: "errors", error: res.error, raw: res.raw });
        setRawEdit(res.raw ?? "");
      } else {
        setResult({ kind: "success", manifest: res.manifest, raw: res.raw, isStub: res.isStub });
        setRawEdit(res.raw);
      }
    });
  }

  function doSave() {
    const jsonToSave = rawEdit.trim();
    if (!jsonToSave || rawErr) { setSaveMsg({ text: "Fix JSON errors before saving.", err: true }); return; }
    startSave(async () => {
      setSaveMsg(null);
      const res = await importManifest(jsonToSave);
      if (!res.ok) {
        setSaveMsg({ text: `Save failed: ${res.errors.join("; ")}`, err: true });
      } else {
        setSaveMsg({ text: `Saved as draft (ID: ${res.id})`, err: false });
        onDone();
      }
    });
  }

  const previewContent =
    result?.kind === "success"
      ? result.manifest.content
      : (() => {
          if (!rawEdit.trim() || rawErr) return null;
          try { return (JSON.parse(rawEdit) as TemplateManifest).content ?? null; } catch { return null; }
        })();
  const previewType =
    result?.kind === "success" ? result.manifest.type : brief.type;

  return (
    <Card title="Generate with AI">
      <div className="tm-ai-panel">
        <div className="tm-ai-badge">Admin authoring tool</div>

        <div className="tm-ai-notice">
          This tool is <strong>admin-only</strong>. It assembles a prompt from the Template Authoring Format spec
          + the target type&apos;s content key contract + your brief, then calls Claude to produce a ready-to-save
          Template Manifest. Review the output and edit if needed before saving.
          <br /><br />
          <strong>Real generation</strong> requires <code>ANTHROPIC_API_KEY</code> set in <code>.env.local</code>.
          Without the key a deterministic stub runs the full pipeline (validate → preview → save) so the
          workflow is always testable.
        </div>

        {/* Brief form */}
        <div className="dx-ff">
          <div className="dx-field">
            <label>Page type</label>
            <select value={brief.type} onChange={(e) => field("type", e.target.value)} style={selStyle}>
              {PAGE_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div className="dx-field">
            <label>Tier</label>
            <select value={brief.tier} onChange={(e) => field("tier", e.target.value)} style={selStyle}>
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
          </div>
        </div>

        <div className="dx-field">
          <label>Vibe / brief <span style={{ color: "var(--red, #e5476f)" }}>*</span></label>
          <textarea
            rows={3}
            value={brief.vibe}
            placeholder="e.g. bold dark agency homepage for a Bangalore design studio with a 3-tier pricing section"
            onChange={(e) => field("vibe", e.target.value)}
            style={{ ...taStyle }}
          />
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
            Describe the look, feel, industry, and key sections. More detail = better output.
          </div>
        </div>

        <div className="dx-ff">
          <div className="dx-field">
            <label>Target audience (optional)</label>
            <input
              value={brief.audience}
              placeholder="e.g. fitness coaches, SaaS founders"
              onChange={(e) => field("audience", e.target.value)}
            />
          </div>
          <div className="dx-field">
            <label>Template name (optional)</label>
            <input
              value={brief.name}
              placeholder="e.g. Obsidian Studio"
              onChange={(e) => field("name", e.target.value)}
            />
          </div>
        </div>

        {brief.tier === "premium" && (
          <div className="dx-ff">
            <div className="dx-field">
              <label>Price (₹)</label>
              <input
                type="number" min={0} step={1}
                value={Math.round(brief.price_paise / 100) || ""}
                placeholder="e.g. 499"
                onChange={(e) => field("price_paise", Math.round(parseFloat(e.target.value) || 0) * 100)}
              />
            </div>
            <div className="dx-field">
              <label>License model</label>
              <select value={brief.license_model} onChange={(e) => field("license_model", e.target.value)} style={selStyle}>
                <option value="per_store">Per store</option>
                <option value="per_page">Per page</option>
                <option value="all_access">All-access (plan feature)</option>
              </select>
            </div>
          </div>
        )}

        <div>
          <button
            className="btn grad"
            onClick={doGenerate}
            disabled={generating || !brief.vibe.trim()}
          >
            {generating ? "Generating…" : "Generate with AI"}
          </button>
        </div>

        {/* Error result */}
        {result?.kind === "errors" && (
          <div className="tm-errs">
            <strong>Generation failed</strong>
            <div style={{ marginTop: 6, whiteSpace: "pre-wrap", fontSize: 12 }}>{result.error}</div>
          </div>
        )}

        {/* Stub warning */}
        {result?.kind === "success" && result.isStub && (
          <div className="tm-ai-stub-warn">
            <strong>Stub mode:</strong> <code>ANTHROPIC_API_KEY</code> is not set — this output is a
            deterministic valid-manifest stub (not a real AI generation). Set the key in{" "}
            <code>.env.local</code> and restart the server to enable real Claude generation. The stub is
            fully saveable and exercisable.
          </div>
        )}

        {/* Success result — preview + editable raw JSON */}
        {result?.kind === "success" && (
          <div className="tm-ai-result">
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--green, #1fb57a)" }}>
              Generation succeeded — review below.
            </div>

            <ContentPreview type={previewType} content={previewContent as Record<string, unknown> | null} />

            <div>
              <div className="tm-ai-raw-label" style={{ marginBottom: 6 }}>
                Raw manifest JSON (edit before saving if needed)
              </div>
              <textarea
                rows={18}
                className="tm-mono"
                value={rawEdit}
                onChange={(e) => onRawEditChange(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", border: "1px solid var(--border)",
                  borderRadius: 10, background: "var(--bg)", color: "var(--text)", resize: "vertical",
                  fontFamily: "\"JetBrains Mono\",\"Fira Code\",ui-monospace,monospace", fontSize: 12,
                }}
                spellCheck={false}
              />
              {rawErr && <div className="tm-json-err">{rawErr}</div>}
              {!rawErr && rawEdit.trim() && (
                <div style={{ fontSize: 11.5, color: "var(--green, #1fb57a)", marginTop: 4 }}>Valid JSON</div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button
                className="btn grad"
                onClick={doSave}
                disabled={saving || !!rawErr || !rawEdit.trim()}
              >
                {saving ? "Saving…" : "Save as draft"}
              </button>
              {saveMsg && (
                <span style={{ fontSize: 12.5, color: saveMsg.err ? "var(--red, #e5476f)" : "var(--green, #1fb57a)", fontWeight: 600 }}>
                  {saveMsg.text}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Show editable raw even on error, if raw was returned */}
        {result?.kind === "errors" && result.raw && (
          <div className="tm-ai-result">
            <div className="tm-ai-raw-label" style={{ marginBottom: 6 }}>
              Raw output from model (fix and save manually if valid JSON)
            </div>
            <textarea
              rows={14}
              className="tm-mono"
              value={rawEdit}
              onChange={(e) => onRawEditChange(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px", border: "1px solid var(--border)",
                borderRadius: 10, background: "var(--bg)", color: "var(--text)", resize: "vertical",
                fontFamily: "\"JetBrains Mono\",\"Fira Code\",ui-monospace,monospace", fontSize: 12,
              }}
              spellCheck={false}
            />
            {rawErr && <div className="tm-json-err">{rawErr}</div>}
            {!rawErr && rawEdit.trim() && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                <span style={{ fontSize: 11.5, color: "var(--green, #1fb57a)" }}>Valid JSON — try saving</span>
                <button className="btn grad" onClick={doSave} disabled={saving}>
                  {saving ? "Saving…" : "Save as draft"}
                </button>
                {saveMsg && (
                  <span style={{ fontSize: 12.5, color: saveMsg.err ? "var(--red, #e5476f)" : "var(--green, #1fb57a)", fontWeight: 600 }}>
                    {saveMsg.text}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ── GridCard ────────────────────────────────────────────────── */

function GridCard({ row, onEdit, stat }: { row: TemplateRow; onEdit: () => void; stat?: TemplateSalesStat }) {
  const router = useRouter();
  const [toggling, startToggle] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [exportPending, startExport] = useTransition();

  function doToggle() {
    startToggle(async () => {
      await toggleTemplateStatus(row.id, row.status);
      router.refresh();
    });
  }

  function doDelete() {
    if (!confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
    startDelete(async () => {
      await deleteTemplate(row.id);
      router.refresh();
    });
  }

  function doExport() {
    startExport(async () => {
      const res = await exportTemplateManifest(row.id);
      if (!res.ok) { alert(res.error); return; }
      const blob = new Blob([JSON.stringify(res.manifest, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="tm-card-grid">
      <div className="tm-card-thumb">
        <div className="tm-tier-tag">
          <span className={`tm-badge tm-badge-${row.tier === "premium" ? "prem" : "free"}`}>
            {row.tier === "premium" ? "Premium" : "Free"}
          </span>
        </div>
        {row.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.thumbnail_url} alt={row.name} />
        ) : (
          <div style={{ padding: "14px 10px", width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ height: 7, borderRadius: 3, background: "var(--border)", width: "60%" }} />
            <div style={{ height: 5, borderRadius: 3, background: "var(--border)", width: "85%" }} />
            <div style={{ height: 5, borderRadius: 3, background: "var(--border)", width: "70%" }} />
            <div style={{ marginTop: "auto", height: 14, borderRadius: 6, background: "var(--border)", width: "50%" }} />
          </div>
        )}
      </div>

      <div className="tm-card-body">
        <div className="tm-card-type">{TYPE_LABELS[row.type] ?? row.type}</div>
        <div className="tm-card-name">{row.name}</div>
        {row.tags && row.tags.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {row.tags.slice(0, 3).map((t, i) => (
              <span key={i} style={{ fontSize: 10.5, padding: "1px 6px", borderRadius: 99, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="tm-sales">
          {row.sales_count} sale{row.sales_count !== 1 ? "s" : ""}
          {stat && stat.revenue_paise > 0 && (
            <span style={{ marginLeft: 8, color: "var(--primary)", fontWeight: 600 }}>
              · {inr(stat.revenue_paise)}
            </span>
          )}
          {stat && stat.revenue_paise > 0 && (stat.wallet_count > 0 || stat.razorpay_count > 0) && (
            <span style={{ marginLeft: 6, color: "var(--muted)", fontSize: 11 }}>
              ({stat.wallet_count > 0 ? `${stat.wallet_count}W` : ""}
              {stat.wallet_count > 0 && stat.razorpay_count > 0 ? "+" : ""}
              {stat.razorpay_count > 0 ? `${stat.razorpay_count}R` : ""})
            </span>
          )}
        </div>

        <div className="tm-card-foot">
          <span className={`tm-card-price${row.tier === "free" ? " free" : ""}`}>
            {inr(row.price_paise)}
          </span>
          <div className="tm-card-acts">
            <button className="dx-editbtn" onClick={doToggle} disabled={toggling} title={row.status === "published" ? "Unpublish" : "Publish"}>
              {toggling ? "…" : row.status === "published" ? "Unpublish" : "Publish"}
            </button>
            <button className="dx-editbtn" onClick={onEdit}>Edit</button>
            <button className="dx-editbtn" onClick={doExport} disabled={exportPending} title="Export manifest JSON">
              {exportPending ? "…" : "Export"}
            </button>
            <button className="dx-editbtn" onClick={doDelete} disabled={deleting}>
              {deleting ? "…" : "Delete"}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 4 }}>
          {row.status === "published"
            ? <Live>Published</Live>
            : <Tag kind="neu">Draft</Tag>}
        </div>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────── */

type Props = { rows: TemplateRow[]; migrationMissing: boolean; salesStats: TemplateSalesStat[] };

export default function TemplatesManager({ rows, migrationMissing, salesStats }: Props) {
  const router = useRouter();
  const [editRow, setEditRow] = useState<TemplateRow | "new" | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [showImport, setShowImport] = useState(false);
  const [showAI, setShowAI] = useState(false);

  const filtered = filter === "all" ? rows : rows.filter((r) => r.type === filter);

  // Build a lookup map from template_id → sales stats
  const statsMap = new Map<string, TemplateSalesStat>(salesStats.map((s) => [s.template_id, s]));

  // KPI counts
  const total = rows.length;
  const published = rows.filter((r) => r.status === "published").length;
  const premium = rows.filter((r) => r.tier === "premium").length;
  const totalSales = rows.reduce((s, r) => s + r.sales_count, 0);
  const totalRevenueFromStats = salesStats.reduce((s, st) => s + st.revenue_paise, 0);

  const onImportDone = useCallback(() => {
    router.refresh();
  }, [router]);

  // Table rows
  const tableRows = filtered.map((r) => {
    const stat = statsMap.get(r.id);
    return [
      <span key="thumb" className="tm-thumb-pre">
        {r.thumbnail_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={r.thumbnail_url} alt={r.name} />
          : <div className="tm-thumb-mock"><i style={{ height: 6, width: "60%" }} /><i style={{ height: 4, width: "80%" }} /><i style={{ height: 4, width: "70%" }} /></div>
        }
      </span>,
      <strong key="name">{r.name}</strong>,
      <span key="type" style={{ fontSize: 12 }}>{TYPE_LABELS[r.type] ?? r.type}</span>,
      <span key="tier" className={`tm-badge tm-badge-${r.tier === "premium" ? "prem" : "free"}`}>{r.tier}</span>,
      <span key="price">{inr(r.price_paise)}</span>,
      r.status === "published" ? <Live key="st">Published</Live> : <Tag key="st" kind="neu">Draft</Tag>,
      <span key="sales">
        {r.sales_count}
        {stat && stat.revenue_paise > 0 && (
          <span style={{ marginLeft: 6, color: "var(--primary)", fontWeight: 600, fontSize: 12 }}>
            {inr(stat.revenue_paise)}
          </span>
        )}
        {stat && (stat.wallet_count > 0 || stat.razorpay_count > 0) && (
          <span style={{ marginLeft: 4, color: "var(--muted)", fontSize: 10.5 }}>
            {stat.wallet_count > 0 ? `${stat.wallet_count}W` : ""}
            {stat.wallet_count > 0 && stat.razorpay_count > 0 ? "+" : ""}
            {stat.razorpay_count > 0 ? `${stat.razorpay_count}R` : ""}
          </span>
        )}
      </span>,
      <span key="acts" style={{ display: "flex", gap: 6, whiteSpace: "nowrap" }}>
        <button className="dx-editbtn" onClick={() => setEditRow(r)}>Edit</button>
      </span>,
    ];
  });

  return (
    <>
      <style>{css}</style>

      <Phead
        title="Premium templates"
        sub="Manage the template catalog that sellers browse and purchase in the marketplace."
        action={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="dx-editbtn" onClick={() => { setShowAI((v) => !v); setShowImport(false); }}>
              {showAI ? "Hide AI" : "Generate with AI"}
            </button>
            <button className="dx-editbtn" onClick={() => { setShowImport((v) => !v); setShowAI(false); }}>
              {showImport ? "Hide import" : "Import manifest"}
            </button>
            <button className="btn grad" onClick={() => setEditRow("new")}>+ New template</button>
          </div>
        }
      />

      {migrationMissing ? (
        <>
          <div className="tm-notice">
            <div className="tm-notice-icon">🗄</div>
            <div>
              <h3>Migration required</h3>
              <p>
                The <code>templates</code> table doesn&apos;t exist yet. Ask the platform admin to apply{" "}
                <code>supabase/migrations/20260618290000_admin_templates.sql</code> — then reload this page.
              </p>
            </div>
          </div>
          <div style={{ height: 16 }} />
        </>
      ) : null}

      <Kpis items={[
        { icon: "layers", color: "var(--accent)", label: "Total templates", value: String(total) },
        { icon: "eye", color: "var(--green, #1fb57a)", label: "Published", value: String(published) },
        { icon: "tag", color: "var(--gold)", label: "Premium", value: String(premium) },
        { icon: "bag", color: "var(--primary)", label: "Total sales", value: String(totalSales) },
        {
          icon: "rupee",
          color: "var(--secondary)",
          label: "Template revenue",
          value: totalRevenueFromStats > 0 ? inr(totalRevenueFromStats) : "₹0",
          delta: totalSales > 0 ? `${totalSales} sale${totalSales !== 1 ? "s" : ""} · wallet + Razorpay` : "No paid sales yet",
        },
      ]} />

      {/* Generate with AI panel (admin authoring tool — never exposed to sellers) */}
      {showAI && (
        <div style={{ marginBottom: 20 }}>
          <GenerateWithAIPanel onDone={onImportDone} />
        </div>
      )}

      {/* Import manifest panel */}
      {showImport && (
        <div style={{ marginBottom: 20 }}>
          <ImportManifestPanel onDone={onImportDone} />
        </div>
      )}

      {/* filter + view toggle */}
      <div className="tm-filter-bar">
        <span className={`dx-fchip${filter === "all" ? " on" : ""}`} onClick={() => setFilter("all")}>All</span>
        {PAGE_TYPES.map((t) => (
          <span key={t} className={`dx-fchip${filter === t ? " on" : ""}`} onClick={() => setFilter(t)}>
            {TYPE_LABELS[t]}
          </span>
        ))}
        <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button className="dx-editbtn" style={{ fontWeight: viewMode === "grid" ? 700 : 400 }} onClick={() => setViewMode("grid")}>Grid</button>
          <button className="dx-editbtn" style={{ fontWeight: viewMode === "table" ? 700 : 400 }} onClick={() => setViewMode("table")}>Table</button>
        </span>
      </div>

      {/* empty state (post-migration) */}
      {!migrationMissing && rows.length === 0 && (
        <Card>
          <div className="dx-empty" style={{ padding: "32px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🧩</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>No templates yet</div>
            <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
              Add your first template — sellers will browse these in the marketplace.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button className="dx-editbtn" onClick={() => setShowImport(true)}>Import manifest</button>
              <button className="btn grad" onClick={() => setEditRow("new")}>+ New template</button>
            </div>
          </div>
        </Card>
      )}

      {/* filtered empty */}
      {!migrationMissing && rows.length > 0 && filtered.length === 0 && (
        <Card>
          <div className="dx-empty">No {TYPE_LABELS[filter]} templates yet.</div>
        </Card>
      )}

      {/* grid view */}
      {viewMode === "grid" && filtered.length > 0 && (
        <div className="dx-grid dx-g3" style={{ gap: 16 }}>
          {filtered.map((r) => (
            <GridCard key={r.id} row={r} onEdit={() => setEditRow(r)} stat={statsMap.get(r.id)} />
          ))}
        </div>
      )}

      {/* table view */}
      {viewMode === "table" && filtered.length > 0 && (
        <Card>
          <Table
            cols={["Thumb", "Name", "Type", "Tier", "Price", "Status", "Sales", "Actions"]}
            rows={tableRows}
            empty="No templates."
          />
        </Card>
      )}

      {/* follow-up callout */}
      {!migrationMissing && rows.filter((r) => r.status === "published").length > 0 && (
        <div style={{ marginTop: 20 }}>
          <Card title="Phase 6 — Seller marketplace">
            <p className="dx-muted" style={{ fontSize: 13, marginBottom: 12 }}>
              {rows.filter((r) => r.status === "published").length} template
              {rows.filter((r) => r.status === "published").length !== 1 ? "s are" : " is"} published and ready for the seller-facing Template Gallery/Marketplace pages (<code>/marketplace/templates</code>). Those pages will read this same <code>templates</code> table filtered on <code>status = &apos;published&apos;</code>.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {rows.filter((r) => r.status === "published").slice(0, 4).map((r) => (
                <span key={r.id} style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 99, background: "var(--surface2)", border: "1px solid var(--border)" }}>
                  {r.name}
                </span>
              ))}
              {rows.filter((r) => r.status === "published").length > 4 && (
                <span style={{ fontSize: 12, color: "var(--muted)", padding: "5px 12px" }}>
                  +{rows.filter((r) => r.status === "published").length - 4} more
                </span>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* edit / create drawer */}
      {editRow !== null && (
        <DrawerForm
          row={editRow === "new" ? null : editRow}
          onClose={() => setEditRow(null)}
        />
      )}
    </>
  );
}
