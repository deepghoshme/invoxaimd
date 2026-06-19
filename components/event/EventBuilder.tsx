"use client";

import { useState, useRef, useEffect } from "react";
import { type EventContent, type EventTier, DEFAULT_EVENT } from "@/lib/event";
import { saveEventPage, setEventStatus } from "@/app/dashboard/events/actions";
import EventView from "./EventView";

// ── Tiny helpers ──────────────────────────────────────────────────────────────

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

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`switch${on ? " on" : ""}`}
      onClick={onClick}
    >
      <i />
    </button>
  );
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

// ── Accordion section ─────────────────────────────────────────────────────────

function Sec({ title, children, open: initOpen = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(initOpen);
  return (
    <div className={`sec${open ? "" : " collapsed"}`}>
      <h3 onClick={() => setOpen((o) => !o)}>{title}</h3>
      {children}
    </div>
  );
}

// ── Main EventBuilder ─────────────────────────────────────────────────────────

export default function EventBuilder({
  pageId,
  initial,
  initialStatus,
  publicUrl,
  readOnly,
  payEnabled,
}: {
  pageId: string;
  initial: EventContent;
  initialStatus: string;
  publicUrl: string | null;
  readOnly?: boolean;
  payEnabled?: boolean;
}) {
  const [c, setC] = useState<EventContent>({ ...DEFAULT_EVENT, ...initial });
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [device, setDevice] = useState<"web" | "mobile">("web");

  const set = (patch: Partial<EventContent>) => setC((p) => ({ ...p, ...patch }));

  const tiers: EventTier[] = c.tiers ?? [];
  const setTier = (i: number, patch: Partial<EventTier>) =>
    set({ tiers: tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  const addTier = () =>
    set({ tiers: [...tiers, { name: "New Tier", desc: "", price: 499, qty: 50 }] });
  const removeTier = (i: number) =>
    set({ tiers: tiers.filter((_, j) => j !== i) });

  async function save(publish?: boolean) {
    if (readOnly) return;
    setBusy(true);
    setMsg(null);
    const res = await saveEventPage(pageId, c);
    if (!res.ok) {
      setMsg(res.error ?? "Save failed");
      setBusy(false);
      return;
    }
    if (publish !== undefined) {
      const pr = await setEventStatus(pageId, publish ? "published" : "draft");
      if (!pr.ok) {
        setMsg(pr.error ?? "Publish failed");
        setBusy(false);
        return;
      }
      setStatus(publish ? "published" : "draft");
      setMsg(publish ? "Published ✓" : "Unpublished");
    } else {
      setMsg("Saved ✓");
    }
    setBusy(false);
    setTimeout(() => setMsg(null), 2000);
  }

  const Preview = () => (
    <div className="previewwrap">
      <div className={`browser${device === "mobile" ? " mob" : ""}`}>
        <div className="bchrome">
          <span className="bdot" />
          <span className="bdot" />
          <span className="bdot" />
          <span className="fav" style={{ background: "var(--primary)" }} />
          <span className="burl">
            {publicUrl ? publicUrl.replace("https://", "") + `/event/${pageId}` : "yoursite.invoxai.io/event/…"}
          </span>
          <div className="seg pvseg">
            <button className={device === "web" ? "on" : ""} onClick={() => setDevice("web")}>
              🖥
            </button>
            <button
              className={device === "mobile" ? "on" : ""}
              onClick={() => setDevice("mobile")}
            >
              📱
            </button>
          </div>
        </div>
        <div className="scr">
          {device === "web" ? (
            <ScaledFrame>
              <EventView content={c} pageId={pageId} payEnabled={payEnabled} preview />
            </ScaledFrame>
          ) : (
            <EventView content={c} pageId={pageId} payEnabled={payEnabled} preview />
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
          <a href="/dashboard/events" className="dx-muted" style={{ textDecoration: "none", fontSize: 13 }}>
            ← Events
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
          {readOnly && (
            <span
              style={{
                fontSize: 12,
                color: "var(--secondary)",
                fontWeight: 600,
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "4px 10px",
              }}
            >
              Read-only (impersonating)
            </span>
          )}
          {msg && <span className="dx-muted" style={{ fontSize: 13 }}>{msg}</span>}
          {publicUrl && status === "published" && (
            <a
              className="dx-editbtn"
              href={`${publicUrl}/event/${pageId}`}
              target="_blank"
              rel="noreferrer"
            >
              View ↗
            </a>
          )}
          <button className={status === "published" ? "btn grad" : "dx-editbtn"} onClick={() => save()} disabled={busy || !!readOnly}>
            {status === "published" ? "Update live" : "Save draft"}
          </button>
          {status === "published" ? (
            <button
              className="dx-editbtn"
              onClick={() => save(false)}
              disabled={busy || !!readOnly}
            >
              Unpublish
            </button>
          ) : (
            <button
              className="btn grad"
              onClick={() => save(true)}
              disabled={busy || !!readOnly}
            >
              Publish
            </button>
          )}
        </div>
      </div>

      {/* Full preview mode */}
      {view === "preview" && (
        <div className="web-public-view">
          <EventView content={c} pageId={pageId} payEnabled={payEnabled} preview />
        </div>
      )}

      {/* Builder */}
      <div className="webbuild" style={view === "preview" ? { display: "none" } : undefined}>
        <div className="webacc">
          {/* Event info */}
          <Sec title="Event info">
            <div className="field">
              <label>Event title</label>
              <input
                value={c.title ?? ""}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="Mix a Track, Start to Finish"
              />
            </div>
            <div className="field">
              <label>Tagline / subtitle</label>
              <input
                value={c.tagline ?? ""}
                onChange={(e) => set({ tagline: e.target.value })}
                placeholder="Join us for an unforgettable experience"
              />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea
                rows={4}
                value={c.description ?? ""}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="What will attendees get? What happens at the event?"
              />
            </div>
            <div className="ff">
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Event date</label>
                <input
                  type="date"
                  value={c.event_date ?? ""}
                  onChange={(e) => set({ event_date: e.target.value })}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Time</label>
                <input
                  type="time"
                  value={c.event_time ?? ""}
                  onChange={(e) => set({ event_time: e.target.value })}
                />
              </div>
            </div>
            <div className="field" style={{ marginTop: 11 }}>
              <label>Timezone</label>
              <select
                value={c.timezone ?? "Asia/Kolkata"}
                onChange={(e) => set({ timezone: e.target.value })}
              >
                <option value="Asia/Kolkata">IST — Asia/Kolkata</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">EST — New York</option>
                <option value="America/Los_Angeles">PST — Los Angeles</option>
                <option value="Europe/London">GMT — London</option>
                <option value="Asia/Dubai">GST — Dubai</option>
                <option value="Asia/Singapore">SGT — Singapore</option>
              </select>
            </div>
            <div
              className="swrow"
              style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 6 }}
            >
              <span className="nm" style={{ fontSize: 13 }}>
                Online event
              </span>
              <Switch
                on={c.is_online !== false}
                onClick={() => set({ is_online: !c.is_online })}
              />
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <label>{c.is_online !== false ? "Meeting link / platform" : "Venue / address"}</label>
              <input
                value={c.location ?? ""}
                onChange={(e) => set({ location: e.target.value })}
                placeholder={
                  c.is_online !== false
                    ? "Zoom, Google Meet, etc."
                    : "Venue name and address"
                }
              />
            </div>
            <Upload
              ico="🖼️"
              label="Upload event poster"
              value={c.poster_url}
              onUrl={(u) => set({ poster_url: u })}
              onRemove={() => set({ poster_url: undefined })}
            />
          </Sec>

          {/* Ticket tiers */}
          <Sec title="Ticket tiers">
            {tiers.length === 0 && (
              <p
                style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}
              >
                No tiers yet. Add at least one ticket tier.
              </p>
            )}
            {tiers.map((t, i) => (
              <div
                key={i}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 10,
                }}
              >
                <div className="ff">
                  <div className="field" style={{ marginBottom: 6 }}>
                    <label>Tier name</label>
                    <input
                      value={t.name}
                      onChange={(e) => setTier(i, { name: e.target.value })}
                      placeholder="General"
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 6 }}>
                    <label>Price (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={t.price}
                      onChange={(e) =>
                        setTier(i, { price: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="799"
                    />
                  </div>
                </div>
                <div className="ff">
                  <div className="field" style={{ marginBottom: 6 }}>
                    <label>Description</label>
                    <input
                      value={t.desc ?? ""}
                      onChange={(e) => setTier(i, { desc: e.target.value })}
                      placeholder="Live access + recording"
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 6 }}>
                    <label>Seats (0 = unlimited)</label>
                    <input
                      type="number"
                      min={0}
                      value={t.qty}
                      onChange={(e) =>
                        setTier(i, { qty: parseInt(e.target.value) || 0 })
                      }
                      placeholder="100"
                    />
                  </div>
                </div>
                <button
                  className="addrow"
                  style={{ color: "var(--secondary)", marginTop: 4 }}
                  onClick={() => removeTier(i)}
                >
                  Remove tier
                </button>
              </div>
            ))}
            <button className="addrow" onClick={addTier}>
              + Add tier
            </button>
            <div className="field" style={{ marginTop: 10 }}>
              <label>Currency</label>
              <select
                value={c.currency ?? "INR"}
                onChange={(e) => set({ currency: e.target.value })}
              >
                <option value="INR">INR — Indian Rupee</option>
                <option value="USD">USD — US Dollar</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="EUR">EUR — Euro</option>
                <option value="SGD">SGD — Singapore Dollar</option>
              </select>
            </div>
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
                    onClick={() => set({ theme: t })}
                  >
                    {t === "light" ? "Light" : "Dark"}
                  </div>
                ))}
              </div>
            </div>
          </Sec>

          {/* SEO */}
          <Sec title="SEO" open={false}>
            <div className="field">
              <label>Meta title</label>
              <input
                value={c.seo_title ?? ""}
                onChange={(e) => set({ seo_title: e.target.value })}
                placeholder={c.title ?? "Event title"}
              />
            </div>
            <div className="field">
              <label>Meta description</label>
              <textarea
                rows={2}
                value={c.seo_description ?? ""}
                onChange={(e) => set({ seo_description: e.target.value })}
                placeholder="What's this event about?"
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
              Ideas to boost ticket sales
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                {
                  icon: "🎫",
                  label: "Add an Early Bird tier",
                  hint: "Discounted price with limited seats drives urgency.",
                  action: () =>
                    set({
                      tiers: [
                        { name: "Early Bird", desc: "Limited seats at launch price", price: 499, qty: 20 },
                        ...tiers,
                      ],
                    }),
                },
                {
                  icon: "🏷️",
                  label: "Add a VIP tier",
                  hint: "Q&A, backstage access, or project files.",
                  action: () =>
                    set({
                      tiers: [
                        ...tiers,
                        { name: "VIP", desc: "+ Live Q&A and exclusive resources", price: 1999, qty: 10 },
                      ],
                    }),
                },
              ].map(({ icon, label, hint, action }) => (
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
                  <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--secondary)", marginTop: 2 }}>
                      {hint}
                    </div>
                  </div>
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
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {Preview()}
      </div>
    </>
  );
}
