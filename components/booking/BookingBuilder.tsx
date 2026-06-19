"use client";

/**
 * BookingBuilder — full-screen accordion builder for the booking page type.
 *
 * Accordion sections:
 *   1. Session info   — title, description, host name/bio/avatar, meeting type
 *   2. Availability   — weekly day+time-range slots, timezone, duration, buffer, max/day
 *   3. Theme          — light/dark, accent color
 *   4. SEO            — title, description
 *
 * Live preview renders BookingView in an inline scaled frame.
 * Save/Publish actions call server actions.
 */

import { useState, useRef, useEffect } from "react";
import BookingView from "./BookingView";
import type { BookingContent, DaySlot } from "@/lib/booking";
import { saveBookingPage, setBookingPageStatus } from "@/app/dashboard/booking/actions";

// ── Primitive components (matching the rest of the builder system) ────────────

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <button type="button" className={`switch${on ? " on" : ""}`} onClick={onClick}><i /></button>;
}

function Sec({ title, children, open: defaultOpen = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`sec${open ? "" : " collapsed"}`}>
      <h3 onClick={() => setOpen((o) => !o)}>{title}</h3>
      {children}
    </div>
  );
}

function ScaledFrame({ width, children }: { width: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: width, z: 1 });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const update = () => { const cw = el.clientWidth; const W = Math.max(cw, width); setDims({ w: W, z: Math.min(1, cw / W) }); };
    update(); const ro = new ResizeObserver(update); ro.observe(el); return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} style={{ width: "100%", overflow: "hidden" }}>
      <div style={{ width: dims.w, zoom: dims.z, transformOrigin: "top left" } as React.CSSProperties}>{children}</div>
    </div>
  );
}

async function upload(file: File): Promise<string | null> {
  const fd = new FormData(); fd.append("file", file);
  try { const res = await fetch("/api/upload", { method: "POST", body: fd }); const j = await res.json(); return res.ok ? (j.url as string) : null; } catch { return null; }
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DURATIONS = [15, 20, 30, 45, 60, 90, 120];
const BUFFERS = [0, 5, 10, 15, 30];
const TIMEZONES = [
  "Asia/Kolkata", "America/New_York", "America/Los_Angeles", "America/Chicago",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo",
  "Asia/Singapore", "Asia/Dubai", "Australia/Sydney", "Pacific/Auckland",
];
const MEETING_TYPES = ["Google Meet", "Zoom", "Phone", "In person", "Custom"];

// ── PageData ──────────────────────────────────────────────────────────────────

type PageData = {
  id: string;
  title: string | null;
  public_id: string | null;
  content: BookingContent;
  seo: Record<string, string>;
  status: string;
};

// ── BookingBuilder ─────────────────────────────────────────────────────────────

export default function BookingBuilder({
  page,
  publicUrl,
  storeName,
  readOnly,
}: {
  page: PageData;
  publicUrl: string | null;
  storeName: string;
  readOnly?: boolean;
}) {
  const [c, setC] = useState<BookingContent>(page.content);
  const [seo, setSeo] = useState<Record<string, string>>(page.seo ?? {});
  const [status, setStatus] = useState(page.status);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState<"edit" | "public">("edit");
  const [device, setDevice] = useState<"web" | "mobile">("web");
  const [avatarBusy, setAvatarBusy] = useState(false);

  const set = (patch: Partial<BookingContent>) => setC((p) => ({ ...p, ...patch }));
  const slots = c.slots ?? [];

  // ── Day slot helpers ──────────────────────────────────────────────────────────
  const toggleDay = (dow: number) => {
    const has = slots.some((s) => s.day === dow);
    if (has) {
      set({ slots: slots.filter((s) => s.day !== dow) });
    } else {
      set({ slots: [...slots, { day: dow as DaySlot["day"], start: "09:00", end: "17:00" }] });
    }
  };
  const updateSlot = (dow: number, field: "start" | "end", val: string) => {
    set({ slots: slots.map((s) => s.day === dow ? { ...s, [field]: val } : s) });
  };

  // ── Save / Publish ────────────────────────────────────────────────────────────
  async function save(publish?: boolean) {
    if (readOnly) return;
    setBusy(true); setMsg(null);
    const payload = { content: c as Record<string, unknown>, seo };
    const res = publish === undefined
      ? await saveBookingPage(page.id, payload)
      : await setBookingPageStatus(page.id, publish ? "published" : "draft");
    setBusy(false);
    if (!res.ok) { setMsg(res.error ?? "Failed"); return; }
    if (publish !== undefined) setStatus(publish ? "published" : "draft");
    setMsg(publish === true ? "Published" : publish === false ? "Unpublished" : "Saved");
    setTimeout(() => setMsg(null), 2000);
  }

  return (
    <>
      {/* ── Sticky action bar ── */}
      <div className="dx-phead">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/dashboard/booking" className="dx-muted" style={{ textDecoration: "none", fontSize: 13 }}>
            ← Booking
          </a>
          <div className="web-seg">
            <button className={view === "edit" ? "on" : ""} onClick={() => setView("edit")}>Builder</button>
            <button className={view === "public" ? "on" : ""} onClick={() => setView("public")}>Preview</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {readOnly && <span style={{ fontSize: 12, color: "var(--muted)", background: "var(--surface2)", padding: "4px 10px", borderRadius: 99 }}>Read-only (impersonation)</span>}
          {msg && <span className="dx-muted" style={{ fontSize: 13 }}>{msg}</span>}
          {publicUrl && status === "published" && (
            <a className="dx-editbtn" href={publicUrl} target="_blank" rel="noreferrer">View ↗</a>
          )}
          {!readOnly && <button className="dx-editbtn" onClick={() => save()} disabled={busy}>Save draft</button>}
          {!readOnly && (
            status === "published"
              ? <button className="dx-editbtn" onClick={() => save(false)} disabled={busy}>Unpublish</button>
              : <button className="btn grad" onClick={() => save(true)} disabled={busy}>Publish</button>
          )}
        </div>
      </div>

      {/* ── Public preview (full-width) ── */}
      {view === "public" && (
        <div className="web-public-view">
          <BookingView content={c} pageId={page.id} storeName={storeName} />
        </div>
      )}

      {/* ── Builder: accordion + live preview ── */}
      <div className="webbuild" style={view === "public" ? { display: "none" } : undefined}>
        <div className="webacc">

          {/* 1 — Session info */}
          <Sec title="Session info">
            <div className="field">
              <label>Session title</label>
              <input value={c.title ?? ""} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. 1-on-1 strategy call" />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea rows={3} value={c.description ?? ""} onChange={(e) => set({ description: e.target.value })} placeholder="What's included in this session…" />
            </div>
            <div className="ff">
              <div className="field">
                <label>Host name</label>
                <input value={c.host_name ?? ""} onChange={(e) => set({ host_name: e.target.value })} placeholder="Your name" />
              </div>
              <div className="field">
                <label>Meeting type</label>
                <select value={c.meeting_type ?? "Google Meet"} onChange={(e) => set({ meeting_type: e.target.value })}>
                  {MEETING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Meeting detail (shown publicly)</label>
              <input value={c.meeting_detail ?? ""} onChange={(e) => set({ meeting_detail: e.target.value })} placeholder="Link sent on booking" />
            </div>
            <div className="field">
              <label>Host bio (optional)</label>
              <textarea rows={2} value={c.host_bio ?? ""} onChange={(e) => set({ host_bio: e.target.value })} placeholder="A short bio or expertise description…" />
            </div>
            {/* Host avatar upload */}
            <div style={{ marginBottom: 9 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Host avatar</label>
              {c.host_avatar ? (
                <div className="up up-has">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="up-prev" src={c.host_avatar} alt="" style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover" }} />
                  <div className="up-actions">
                    <span className="t">{avatarBusy ? "Uploading…" : "Avatar"}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <label className="up-btn">Change<input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setAvatarBusy(true); const u = await upload(f); setAvatarBusy(false); if (u) set({ host_avatar: u }); }} /></label>
                      <button type="button" className="up-btn danger" onClick={() => set({ host_avatar: undefined })}>Remove</button>
                    </div>
                  </div>
                </div>
              ) : (
                <label className="up">
                  <span className="ico">{avatarBusy ? "…" : "👤"}</span>
                  <span className="t">Upload avatar photo</span>
                  <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setAvatarBusy(true); const u = await upload(f); setAvatarBusy(false); if (u) set({ host_avatar: u }); }} />
                </label>
              )}
            </div>
          </Sec>

          {/* 2 — Pricing */}
          <Sec title="Pricing">
            <div className="swrow" style={{ borderTop: 0, paddingTop: 0 }}>
              <span className="nm">Free session (no payment)</span>
              <Switch on={c.is_free === true} onClick={() => set({ is_free: !c.is_free })} />
            </div>
            {!c.is_free && (
              <div className="ff">
                <div className="field">
                  <label>Price (in full currency, e.g. ₹999 → enter 999)</label>
                  <input type="number" min={0} value={c.price != null ? c.price / 100 : ""} onChange={(e) => set({ price: Math.round((parseFloat(e.target.value) || 0) * 100) })} placeholder="999" />
                </div>
                <div className="field">
                  <label>Currency</label>
                  <select value={c.currency ?? "INR"} onChange={(e) => set({ currency: e.target.value })}>
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>
            )}
          </Sec>

          {/* 3 — Availability */}
          <Sec title="Availability">
            <div className="ff">
              <div className="field">
                <label>Session duration (minutes)</label>
                <select value={c.duration ?? 60} onChange={(e) => set({ duration: Number(e.target.value) })}>
                  {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
              <div className="field">
                <label>Buffer between sessions (min)</label>
                <select value={c.buffer ?? 0} onChange={(e) => set({ buffer: Number(e.target.value) })}>
                  {BUFFERS.map((b) => <option key={b} value={b}>{b === 0 ? "None" : `${b} min`}</option>)}
                </select>
              </div>
            </div>
            <div className="ff">
              <div className="field">
                <label>Timezone</label>
                <select value={c.timezone ?? "Asia/Kolkata"} onChange={(e) => set({ timezone: e.target.value })}>
                  {TIMEZONES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Max bookings per day</label>
                <input type="number" min={1} max={20} value={c.max_per_day ?? ""} onChange={(e) => set({ max_per_day: parseInt(e.target.value) || undefined })} placeholder="Unlimited" />
              </div>
            </div>

            <p style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10, marginTop: 2 }}>
              Set which days and time windows you are available each week.
            </p>
            {DAYS.map((dayName, dow) => {
              const slot = slots.find((s) => s.day === dow);
              const active = !!slot;
              return (
                <div key={dow} style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginBottom: 8 }}>
                  <div className="swrow" style={{ borderTop: 0, paddingTop: 0 }}>
                    <span className="nm">{dayName}</span>
                    <Switch on={active} onClick={() => toggleDay(dow)} />
                  </div>
                  {active && slot && (
                    <div className="ff" style={{ marginTop: 6 }}>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label>Start</label>
                        <input type="time" value={slot.start} onChange={(e) => updateSlot(dow, "start", e.target.value)} />
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label>End</label>
                        <input type="time" value={slot.end} onChange={(e) => updateSlot(dow, "end", e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </Sec>

          {/* 4 — Theme */}
          <Sec title="Theme">
            <div className="field">
              <label>Color theme</label>
              <div className="chips">
                {(["light", "dark"] as const).map((t) => (
                  <div key={t} className={`chip${(c.theme ?? "light") === t ? " on" : ""}`} onClick={() => set({ theme: t })}>
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
                  value={c.accent_color ?? "#ff6a3d"}
                  onChange={(e) => set({ accent_color: e.target.value })}
                  style={{ width: 44, height: 34, padding: 2, border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)", cursor: "pointer" }}
                />
                {c.accent_color && c.accent_color !== "#ff6a3d" && (
                  <button className="dx-editbtn" onClick={() => set({ accent_color: undefined })}>Reset</button>
                )}
              </div>
            </div>
          </Sec>

          {/* 5 — SEO */}
          <Sec title="SEO" open={false}>
            <div className="field">
              <label>Meta title</label>
              <input value={seo.title ?? ""} onChange={(e) => setSeo((s) => ({ ...s, title: e.target.value }))} placeholder={c.title ?? "Book a session"} />
            </div>
            <div className="field">
              <label>Meta description</label>
              <textarea rows={2} value={seo.description ?? ""} onChange={(e) => setSeo((s) => ({ ...s, description: e.target.value }))} placeholder="Describe this booking page for search engines" />
            </div>
            {publicUrl && (
              <div className="seo-google">
                <div className="g-url">{publicUrl.replace("https://", "")}</div>
                <div className="g-title">{seo.title || c.title || "Book a session"}</div>
                <div className="g-desc">{seo.description || c.description || "Schedule a session online."}</div>
              </div>
            )}
          </Sec>

          {/* Suggest more */}
          <div style={{ margin: "18px 0 0", padding: "14px 16px", background: "var(--surface2, rgba(255,255,255,0.06))", border: "1px solid var(--border)", borderRadius: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--primary)", marginBottom: 10 }}>
              Ideas to get more bookings
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { icon: "📋", label: "Add a clear description", hint: "Tell visitors what they will learn or accomplish in the session.", action: () => set({ description: c.description || "Book a focused 1-on-1 session and get personalised advice." }) },
                { icon: "⏱", label: "Offer shorter intro sessions", hint: "A free or low-cost 15-min intro lowers the barrier to booking.", action: () => { set({ duration: 15, is_free: true }); } },
                { icon: "🌐", label: "Set buffer time", hint: "Add a 15-min buffer between sessions to avoid back-to-back fatigue.", action: () => set({ buffer: 15 }) },
                { icon: "📅", label: "Enable more available days", hint: "More open days = more bookings. Try Mon–Fri 9 AM–5 PM.", action: () => { const newSlots: DaySlot[] = [1,2,3,4,5].map((d) => ({ day: d as DaySlot["day"], start: "09:00", end: "17:00" })); set({ slots: newSlots }); } },
                { icon: "🎥", label: "Set meeting type to Google Meet", hint: "Specify how the session will happen so visitors feel confident.", action: () => set({ meeting_type: "Google Meet", meeting_detail: "Link sent on booking confirmation" }) },
              ].map(({ icon, label, hint, action }) => (
                <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10 }}>
                  <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{label}</div>
                    <div style={{ fontSize: 11, color: "var(--secondary)", marginTop: 2 }}>{hint}</div>
                  </div>
                  <button
                    type="button"
                    onClick={action}
                    disabled={readOnly}
                    style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 8, background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    Apply
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Live preview pane ── */}
        <div className="previewwrap">
          <div className={`browser${device === "mobile" ? " mob" : ""}`}>
            <div className="bchrome">
              <span className="bdot" /><span className="bdot" /><span className="bdot" />
              <span className="fav" style={{ background: "linear-gradient(135deg,#ffb23e,#ff6a3d 38%,#ff4d7d 72%,#7b3fe4)" }} />
              <span className="burl">
                {publicUrl ? publicUrl.replace("https://", "") : `yourstore.invoxai.io/book/${page.public_id ?? "…"}`}
              </span>
              <div className="seg pvseg">
                <button className={device === "web" ? "on" : ""} onClick={() => setDevice("web")}>🖥</button>
                <button className={device === "mobile" ? "on" : ""} onClick={() => setDevice("mobile")}>📱</button>
              </div>
            </div>
            <div className="scr">
              {device === "web"
                ? <ScaledFrame width={880}><BookingView content={c} pageId={page.id} storeName={storeName} /></ScaledFrame>
                : <BookingView content={c} pageId={page.id} storeName={storeName} />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
