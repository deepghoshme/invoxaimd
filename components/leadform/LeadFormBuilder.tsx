"use client";

import { useState, useRef, useEffect } from "react";
import {
  type LeadFormContent,
  type LeadFormField,
  DEFAULT_LEADFORM,
  DEFAULT_FIELDS,
} from "@/lib/leadform";
import { saveLeadFormPage, setLeadFormStatus } from "@/app/dashboard/leadform/actions";
import LeadFormView from "./LeadFormView";

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`switch${on ? " on" : ""}`} onClick={onClick}>
      <i />
    </button>
  );
}

async function upload(file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append("file", file);
  try {
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await res.json();
    return res.ok ? (j.url as string) : null;
  } catch {
    return null;
  }
}

function Upload({
  ico,
  label,
  value,
  onUrl,
  onRemove,
}: {
  ico: string;
  label: string;
  value?: string;
  onUrl: (u: string) => void;
  onRemove?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    const u = await upload(f);
    setBusy(false);
    if (u) onUrl(u);
  };
  if (value)
    return (
      <div className="up up-has">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="up-prev" src={value} alt="" />
        <div className="up-actions">
          <span className="t">{busy ? "Uploading…" : label.replace(/^Upload /, "")}</span>
          <div style={{ display: "flex", gap: 6 }}>
            <label className="up-btn">
              Change
              <input type="file" accept="image/*" onChange={pick} />
            </label>
            {onRemove && (
              <button type="button" className="up-btn danger" onClick={onRemove}>
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    );
  return (
    <label className="up">
      <span className="ico">{busy ? "…" : ico}</span>
      <span className="t">{label}</span>
      <input type="file" accept="image/*" onChange={pick} />
    </label>
  );
}

function ScaledFrame({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [z, setZ] = useState(1);
  const W = 520;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const cw = el.clientWidth;
      setZ(Math.min(1, cw / W));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ width: "100%", overflow: "hidden" }}>
      <div style={{ width: W, zoom: z, transformOrigin: "top left" } as React.CSSProperties}>
        {children}
      </div>
    </div>
  );
}

function Sec({
  title,
  children,
  open: initOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  const [open, setOpen] = useState(initOpen);
  return (
    <div className={`sec${open ? "" : " collapsed"}`}>
      <h3 onClick={() => setOpen((o) => !o)}>{title}</h3>
      {children}
    </div>
  );
}

// ── Main LeadFormBuilder ──────────────────────────────────────────────────────

export default function LeadFormBuilder({
  pageId,
  publicId,
  initial,
  initialStatus,
  publicUrl,
  storeId,
}: {
  pageId: string;
  publicId: string;
  initial: LeadFormContent;
  initialStatus: string;
  publicUrl: string | null;
  storeId: string;
}) {
  const [c, setC] = useState<LeadFormContent>({ ...DEFAULT_LEADFORM, ...initial });
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [device, setDevice] = useState<"web" | "mobile">("web");

  const patch = (p: Partial<LeadFormContent>) => setC((prev) => ({ ...prev, ...p }));

  const fields: LeadFormField[] = c.fields ?? DEFAULT_FIELDS;

  const setField = (idx: number, fp: Partial<LeadFormField>) =>
    patch({
      fields: fields.map((f, i) => (i === idx ? { ...f, ...fp } : f)),
    });

  async function save(publish?: boolean) {
    setBusy(true);
    setMsg(null);
    const res = await saveLeadFormPage(pageId, c);
    if (!res.ok) {
      setMsg(res.error ?? "Save failed");
      setBusy(false);
      return;
    }
    if (publish !== undefined) {
      const pr = await setLeadFormStatus(pageId, publish ? "published" : "draft");
      if (!pr.ok) {
        setMsg(pr.error ?? "Publish failed");
        setBusy(false);
        return;
      }
      setStatus(publish ? "published" : "draft");
      setMsg(publish ? "Published!" : "Unpublished");
    } else {
      setMsg("Saved!");
    }
    setBusy(false);
    setTimeout(() => setMsg(null), 2200);
  }

  const liveUrl = publicUrl && publicId ? `${publicUrl}/ldf/${publicId}` : null;

  const Preview = () => (
    <div className="previewwrap">
      <div className={`browser${device === "mobile" ? " mob" : ""}`}>
        <div className="bchrome">
          <span className="bdot" />
          <span className="bdot" />
          <span className="bdot" />
          <span className="fav" style={{ background: c.accent_color ?? "var(--primary)" }} />
          <span className="burl">
            {liveUrl ? liveUrl.replace("https://", "") : "yoursite.invoxai.io/ldf/…"}
          </span>
          <div className="seg pvseg">
            <button className={device === "web" ? "on" : ""} onClick={() => setDevice("web")}>
              Desktop
            </button>
            <button className={device === "mobile" ? "on" : ""} onClick={() => setDevice("mobile")}>
              Mobile
            </button>
          </div>
        </div>
        <div className="scr">
          {device === "web" ? (
            <ScaledFrame>
              <LeadFormView content={c} pageId={pageId} storeId={storeId} preview />
            </ScaledFrame>
          ) : (
            <LeadFormView content={c} pageId={pageId} storeId={storeId} preview />
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Sticky header */}
      <div className="dx-phead">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/dashboard/leadform" className="dx-muted" style={{ textDecoration: "none", fontSize: 13 }}>
            ← Lead forms
          </a>
          <div className="web-seg">
            <button className={view === "edit" ? "on" : ""} onClick={() => setView("edit")}>
              Builder
            </button>
            <button className={view === "preview" ? "on" : ""} onClick={() => setView("preview")}>
              Preview
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {msg && <span className="dx-muted" style={{ fontSize: 13 }}>{msg}</span>}
          {liveUrl && status === "published" && (
            <a className="dx-editbtn" href={liveUrl} target="_blank" rel="noreferrer">
              View live ↗
            </a>
          )}
          <button
            className={status === "published" ? "btn grad" : "dx-editbtn"}
            onClick={() => save()}
            disabled={busy}
          >
            {status === "published" ? "Update live" : "Save draft"}
          </button>
          {status === "published" ? (
            <button className="dx-editbtn" onClick={() => save(false)} disabled={busy}>
              Unpublish
            </button>
          ) : (
            <button className="btn grad" onClick={() => save(true)} disabled={busy}>
              Publish
            </button>
          )}
        </div>
      </div>

      {/* Full preview mode */}
      {view === "preview" && (
        <div className="web-public-view">
          <LeadFormView content={c} pageId={pageId} storeId={storeId} preview />
        </div>
      )}

      {/* Builder */}
      <div className="webbuild" style={view === "preview" ? { display: "none" } : undefined}>
        <div className="webacc">
          {/* Form content */}
          <Sec title="Form content">
            <div className="field">
              <label>Headline</label>
              <input
                value={c.headline ?? ""}
                onChange={(e) => patch({ headline: e.target.value })}
                placeholder="Get in touch"
              />
            </div>
            <div className="field">
              <label>Sub-headline</label>
              <input
                value={c.subheadline ?? ""}
                onChange={(e) => patch({ subheadline: e.target.value })}
                placeholder="We'd love to hear from you"
              />
            </div>
            <div className="field">
              <label>Description (optional)</label>
              <textarea
                rows={3}
                value={c.description ?? ""}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="A short intro above the form fields"
              />
            </div>
            <div className="field">
              <label>Submit button label</label>
              <input
                value={c.button_label ?? ""}
                onChange={(e) => patch({ button_label: e.target.value })}
                placeholder="Send message"
              />
            </div>
            <div className="field">
              <label>Success message (shown after submission)</label>
              <input
                value={c.success_message ?? ""}
                onChange={(e) => patch({ success_message: e.target.value })}
                placeholder="Thank you! We'll be in touch soon."
              />
            </div>
            <Upload
              ico="🖼"
              label="Upload header image (optional)"
              value={c.image_url}
              onUrl={(u) => patch({ image_url: u })}
              onRemove={() => patch({ image_url: "" })}
            />
          </Sec>

          {/* Fields */}
          <Sec title="Form fields">
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, marginTop: 0 }}>
              Toggle which fields appear and whether each is required.
            </p>
            {fields.map((f, i) => (
              <div
                key={f.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 9,
                  marginBottom: 8,
                  background: f.visible ? "var(--bg)" : "var(--surface2)",
                  opacity: f.visible ? 1 : 0.6,
                }}
              >
                <Switch on={f.visible} onClick={() => setField(i, { visible: !f.visible })} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{f.label}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{f.placeholder}</div>
                </div>
                {f.visible && (
                  <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--muted)", cursor: "pointer", whiteSpace: "nowrap" }}>
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={(e) => setField(i, { required: e.target.checked })}
                      style={{ accentColor: "var(--primary)" }}
                    />
                    Required
                  </label>
                )}
              </div>
            ))}
          </Sec>

          {/* Theme */}
          <Sec title="Theme" open={false}>
            <div className="field">
              <label>Color theme</label>
              <div className="chips">
                {(["light", "dark"] as const).map((t) => (
                  <div
                    key={t}
                    className={`chip${(c.theme ?? "light") === t ? " on" : ""}`}
                    onClick={() => patch({ theme: t })}
                  >
                    {t === "light" ? "Light" : "Dark"}
                  </div>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Accent color</label>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="color"
                  value={c.accent_color ?? "#7c3aed"}
                  onChange={(e) => patch({ accent_color: e.target.value })}
                  style={{ width: 44, height: 36, padding: 2, borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", background: "none" }}
                />
                <input
                  type="text"
                  value={c.accent_color ?? "#7c3aed"}
                  onChange={(e) => patch({ accent_color: e.target.value })}
                  style={{ flex: 1, fontFamily: "monospace" }}
                  placeholder="#7c3aed"
                />
              </div>
            </div>
          </Sec>

          {/* SEO */}
          <Sec title="SEO" open={false}>
            <div className="field">
              <label>Meta title</label>
              <input
                value={c.seo_title ?? ""}
                onChange={(e) => patch({ seo_title: e.target.value })}
                placeholder={c.headline ?? "Lead form"}
              />
            </div>
            <div className="field">
              <label>Meta description</label>
              <textarea
                rows={2}
                value={c.seo_description ?? ""}
                onChange={(e) => patch({ seo_description: e.target.value })}
                placeholder="What is this form for?"
              />
            </div>
          </Sec>

          {/* Suggestions */}
          <div
            style={{
              margin: "18px 0 0",
              padding: "14px 16px",
              background: "var(--surface2, rgba(255,255,255,0.06))",
              border: "1px solid var(--border)",
              borderRadius: 14,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".06em",
                textTransform: "uppercase",
                color: "var(--primary)",
                marginBottom: 10,
              }}
            >
              Ideas to get more leads
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                {
                  label: "Add to your bio page",
                  hint: "Link this form from your bio so every visitor sees it.",
                  action: () => window.open("/studio/bio", "_blank"),
                  actionLabel: "Open bio",
                },
                {
                  label: "Keep only 2–3 fields visible",
                  hint: "Fewer fields = higher submission rate. Hide company & website.",
                  action: () =>
                    patch({
                      fields: fields.map((f) => ({
                        ...f,
                        visible: ["name", "email", "message"].includes(f.key),
                      })),
                    }),
                  actionLabel: "Apply",
                },
                {
                  label: "Use a strong CTA headline",
                  hint: 'e.g. "Book a free 15-min call" beats "Contact us".',
                  action: () => patch({ headline: "Book a free 15-min call", button_label: "Book now" }),
                  actionLabel: "Try it",
                },
                {
                  label: "Share on social media",
                  hint: "Post the /ldf/ link directly — it opens the form in one tap.",
                  action: liveUrl
                    ? () => navigator.clipboard?.writeText(liveUrl).catch(() => {})
                    : undefined,
                  actionLabel: liveUrl ? "Copy link" : undefined,
                },
              ]
                .filter((s) => s.action)
                .map(({ label, hint, action, actionLabel }) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "8px 10px",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{label}</div>
                      <div style={{ fontSize: 11, color: "var(--secondary)", marginTop: 2 }}>{hint}</div>
                    </div>
                    {action && actionLabel && (
                      <button
                        type="button"
                        onClick={action}
                        style={{
                          flexShrink: 0,
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "4px 10px",
                          borderRadius: 8,
                          background: "var(--primary)",
                          color: "#fff",
                          border: "none",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {actionLabel}
                      </button>
                    )}
                  </div>
                ))}
            </div>

            {/* Analytics summary */}
            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 10,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em" }}>
                Form analytics
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                Submissions and conversion data appear in{" "}
                <a href="/dashboard/crm" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>CRM</a>{" "}
                and{" "}
                <a href="/dashboard/analytics" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>Analytics</a>.
              </div>
            </div>
          </div>
        </div>

        {Preview()}
      </div>
    </>
  );
}
