"use client";

import { useState, useRef, useEffect } from "react";
import VipView from "./VipView";
import { type VipContent, type VipPerk, type VipPlan, DEFAULT_VIP_CONTENT } from "@/lib/vip";

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

function ScaledFrame({ width, children }: { width: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: width, z: 1 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const cw = el.clientWidth;
      const W = Math.max(cw, width);
      setDims({ w: W, z: Math.min(1, cw / W) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} style={{ width: "100%", overflow: "hidden" }}>
      <div style={{ width: dims.w, zoom: dims.z, transformOrigin: "top left" } as React.CSSProperties}>
        {children}
      </div>
    </div>
  );
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

function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="sec">
      <div
        className="sec-head"
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
      >
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span style={{ color: "var(--muted)", fontSize: 12, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▼</span>
      </div>
      {open && <div style={{ marginTop: 14 }}>{children}</div>}
    </div>
  );
}

export default function VipBuilder({
  initial,
  pageId,
  publicUrl,
  initialStatus,
  storeName,
  memberCount = 0,
  payEnabled = false,
  readOnly = false,
}: {
  initial: VipContent;
  pageId: string;
  publicUrl: string | null;
  initialStatus: string;
  storeName: string;
  memberCount?: number;
  payEnabled?: boolean;
  readOnly?: boolean;
}) {
  const [c, setC] = useState<VipContent>({ ...DEFAULT_VIP_CONTENT, ...initial });
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [device, setDevice] = useState<"web" | "mobile">("web");
  const [uploadingHost, setUploadingHost] = useState(false);

  const set = (patch: Partial<VipContent>) => setC((p) => ({ ...p, ...patch }));

  const plans: VipPlan[] = c.plans ?? DEFAULT_VIP_CONTENT.plans!;
  const perks: VipPerk[] = c.perks ?? DEFAULT_VIP_CONTENT.perks!;

  // ---------- persist ----------
  async function save(publish?: boolean) {
    if (readOnly) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/vip/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId, content: c, publish }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      if (publish !== undefined) setStatus(publish ? "published" : "draft");
      setMsg(publish === true ? "Published ✓" : publish === false ? "Unpublished" : "Saved ✓");
      setTimeout(() => setMsg(null), 1800);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error saving");
    } finally {
      setBusy(false);
    }
  }

  // ---------- perk helpers ----------
  function updatePerk(i: number, patch: Partial<VipPerk>) {
    set({ perks: perks.map((p, j) => j === i ? { ...p, ...patch } : p) });
  }
  function removePerk(i: number) { set({ perks: perks.filter((_, j) => j !== i) }); }
  function addPerk() { set({ perks: [...perks, { icon: "✨", title: "New perk", desc: "Describe this benefit." }] }); }

  // ---------- plan helpers ----------
  function updatePlan(i: number, patch: Partial<VipPlan>) {
    set({ plans: plans.map((p, j) => j === i ? { ...p, ...patch } : p) });
  }
  function removePlan(i: number) { set({ plans: plans.filter((_, j) => j !== i) }); }
  function addPlan() {
    set({ plans: [...plans, { id: `plan_${Date.now()}`, name: "New plan", price: 999, interval: "/month" }] });
  }

  const Preview = () => (
    <div className="previewwrap">
      <div className={`browser${device === "mobile" ? " mob" : ""}`}>
        <div className="bchrome">
          <span className="bdot" /><span className="bdot" /><span className="bdot" />
          <span className="fav" style={{ background: "var(--grad)" }} />
          <span className="burl">{publicUrl ? publicUrl.replace("https://", "") : "yourstore.invoxai.io/vip/..."}</span>
          <div className="seg pvseg">
            <button className={device === "web" ? "on" : ""} onClick={() => setDevice("web")}>🖥</button>
            <button className={device === "mobile" ? "on" : ""} onClick={() => setDevice("mobile")}>📱</button>
          </div>
        </div>
        <div className="scr">
          {device === "web"
            ? <ScaledFrame width={920}><VipView content={c} pageId={pageId} storeName={storeName} memberCount={memberCount} payEnabled={payEnabled} stage /></ScaledFrame>
            : <VipView content={c} pageId={pageId} storeName={storeName} memberCount={memberCount} payEnabled={payEnabled} stage />}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="dx-phead">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/dashboard/vip" className="dx-muted" style={{ textDecoration: "none", fontSize: 13 }}>← VIP Communities</a>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {readOnly && <span className="dx-muted" style={{ fontSize: 13 }}>Read-only (impersonating)</span>}
          {msg && <span className="dx-muted" style={{ fontSize: 13 }}>{msg}</span>}
          {publicUrl && status === "published" && (
            <a className="dx-editbtn" href={publicUrl} target="_blank" rel="noreferrer">View ↗</a>
          )}
          {!readOnly && (
            <>
              <button className={status === "published" ? "btn grad" : "dx-editbtn"} onClick={() => save()} disabled={busy}>{status === "published" ? "Update live" : "Save draft"}</button>
              {status === "published"
                ? <button className="dx-editbtn" onClick={() => save(false)} disabled={busy}>Unpublish</button>
                : <button className="btn grad" onClick={() => save(true)} disabled={busy}>Publish</button>
              }
            </>
          )}
        </div>
      </div>

      <div className="webbuild">
        <div className="webacc">

          {/* Channel info */}
          <Accordion title="Channel info" defaultOpen>
            <div className="field"><label>Community title</label><input value={c.title ?? ""} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. The Inner Circle" /></div>
            <div className="field"><label>Description</label><textarea rows={3} value={c.description ?? ""} onChange={(e) => set({ description: e.target.value })} placeholder="What do members get?" style={{ width: "100%", resize: "vertical" }} /></div>
            <div className="field"><label>Crest emoji</label><input value={c.crestEmoji ?? "⭐"} onChange={(e) => set({ crestEmoji: e.target.value })} placeholder="⭐" style={{ width: 80 }} /></div>
            <div className="field"><label>Host name</label><input value={c.host ?? ""} onChange={(e) => set({ host: e.target.value })} placeholder="Your name" /></div>
            <div className="field"><label>Host title / credential</label><input value={c.hostTitle ?? ""} onChange={(e) => set({ hostTitle: e.target.value })} placeholder="e.g. Grammy-nominated engineer" /></div>
            <div className="field">
              <label>Host avatar</label>
              {c.hostAvatarUrl ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.hostAvatarUrl} alt="host" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                  <label className="dx-editbtn" style={{ cursor: "pointer" }}>
                    Change
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
                      const f = e.target.files?.[0]; if (!f) return;
                      setUploadingHost(true);
                      const u = await upload(f);
                      setUploadingHost(false);
                      if (u) set({ hostAvatarUrl: u });
                    }} />
                  </label>
                  <button className="dx-editbtn" onClick={() => set({ hostAvatarUrl: undefined })}>Remove</button>
                  {uploadingHost && <span className="dx-muted" style={{ fontSize: 12 }}>Uploading…</span>}
                </div>
              ) : (
                <label className="up" style={{ cursor: "pointer" }}>
                  <span className="ico">{uploadingHost ? "…" : "👤"}</span>
                  <span className="t">Upload avatar</span>
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    setUploadingHost(true);
                    const u = await upload(f);
                    setUploadingHost(false);
                    if (u) set({ hostAvatarUrl: u });
                  }} />
                </label>
              )}
            </div>
          </Accordion>

          {/* Perks */}
          <Accordion title="Perks / benefits">
            {perks.map((perk, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10, marginBottom: 9 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={perk.icon} onChange={(e) => updatePerk(i, { icon: e.target.value })} placeholder="🎙️" style={{ width: 52 }} />
                  <input value={perk.title} onChange={(e) => updatePerk(i, { title: e.target.value })} placeholder="Perk title" style={{ flex: 1 }} />
                </div>
                <input value={perk.desc} onChange={(e) => updatePerk(i, { desc: e.target.value })} placeholder="Short description" className="rowfull" style={{ marginTop: 6 }} />
                <button className="addrow" style={{ marginTop: 6, color: "var(--secondary)" }} onClick={() => removePerk(i)}>Remove</button>
              </div>
            ))}
            <button className="addrow" onClick={addPerk}>+ Add perk</button>
          </Accordion>

          {/* Plans */}
          <Accordion title="Membership plans">
            {plans.map((plan, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10, marginBottom: 9 }}>
                <div className="ff">
                  <input value={plan.name} onChange={(e) => updatePlan(i, { name: e.target.value })} placeholder="Plan name" />
                  <input
                    type="number"
                    min={0}
                    value={plan.price}
                    onChange={(e) => updatePlan(i, { price: parseFloat(e.target.value) || 0 })}
                    placeholder="Price"
                  />
                </div>
                <div className="ff" style={{ marginTop: 6 }}>
                  <input value={plan.interval} onChange={(e) => updatePlan(i, { interval: e.target.value })} placeholder="/month" />
                  <input value={plan.saveBadge ?? ""} onChange={(e) => updatePlan(i, { saveBadge: e.target.value || undefined })} placeholder="Save badge (optional)" />
                </div>
                <div className="field" style={{ marginTop: 6 }}>
                  <label style={{ fontSize: 11 }}>Internal ID (used in DB)</label>
                  <input value={plan.id} onChange={(e) => updatePlan(i, { id: e.target.value })} placeholder="monthly" style={{ fontFamily: "monospace", fontSize: 12 }} />
                </div>
                {plans.length > 1 && (
                  <button className="addrow" style={{ marginTop: 4, color: "var(--secondary)" }} onClick={() => removePlan(i)}>Remove plan</button>
                )}
              </div>
            ))}
            <button className="addrow" onClick={addPlan}>+ Add plan</button>
            <div className="field" style={{ marginTop: 10 }}>
              <label>Currency</label>
              <div className="chips">
                {["INR", "USD", "GBP", "EUR"].map((cur) => (
                  <div
                    key={cur}
                    className={`chip${(c.currency ?? "INR") === cur ? " on" : ""}`}
                    onClick={() => set({ currency: cur })}
                  >
                    {cur}
                  </div>
                ))}
              </div>
            </div>
          </Accordion>

          {/* Locked preview content */}
          <Accordion title="Locked preview messages">
            <p className="dx-muted" style={{ fontSize: 12, marginBottom: 10 }}>These messages appear blurred to non-members to show a teaser of community activity.</p>
            {(c.previewMessages ?? []).map((msg, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input
                  value={msg.text}
                  onChange={(e) => set({
                    previewMessages: (c.previewMessages ?? []).map((m, j) => j === i ? { ...m, text: e.target.value } : m),
                  })}
                  placeholder="Message text"
                  style={{ flex: 1 }}
                />
                <button
                  className="addrow"
                  style={{ color: "var(--secondary)", flexShrink: 0 }}
                  onClick={() => set({ previewMessages: (c.previewMessages ?? []).filter((_, j) => j !== i) })}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              className="addrow"
              onClick={() => set({ previewMessages: [...(c.previewMessages ?? []), { text: "" }] })}
            >
              + Add message
            </button>
          </Accordion>

          {/* Invite link + platform */}
          <Accordion title="Invite link &amp; platform">
            <div className="field">
              <label>Platform</label>
              <div className="chips">
                {["telegram", "discord", "whatsapp", "other"].map((p) => (
                  <div
                    key={p}
                    className={`chip${(c.platform ?? "telegram") === p ? " on" : ""}`}
                    onClick={() => set({ platform: p })}
                    style={{ textTransform: "capitalize" }}
                  >
                    {p === "telegram" ? "Telegram" : p === "discord" ? "Discord" : p === "whatsapp" ? "WhatsApp" : "Other"}
                  </div>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Invite link</label>
              <input
                value={c.inviteLink ?? ""}
                onChange={(e) => set({ inviteLink: e.target.value })}
                placeholder="https://t.me/+…"
              />
              <p className="dx-muted" style={{ fontSize: 11, marginTop: 4 }}>
                This link is revealed to buyers after payment. Keep it secret — once published it goes into vip_members.invite_link per order.
              </p>
            </div>
          </Accordion>

          {/* Theme */}
          <Accordion title="Theme">
            <div className="field">
              <label>Color theme</label>
              <div className="chips">
                {(["dark", "light"] as const).map((t) => (
                  <div
                    key={t}
                    className={`chip${(c.theme ?? "dark") === t ? " on" : ""}`}
                    onClick={() => set({ theme: t })}
                  >
                    {t === "dark" ? "Dark" : "Light"}
                  </div>
                ))}
              </div>
            </div>
          </Accordion>

          {/* SEO */}
          <Accordion title="SEO">
            <div className="field"><label>Page title</label><input value={c.seoTitle ?? ""} onChange={(e) => set({ seoTitle: e.target.value })} placeholder="Join [Community Name]" /></div>
            <div className="field" style={{ marginBottom: 0 }}><label>Meta description</label><textarea rows={2} value={c.seoDescription ?? ""} onChange={(e) => set({ seoDescription: e.target.value })} placeholder="Short description for search engines…" style={{ width: "100%", resize: "vertical" }} /></div>
          </Accordion>

          {/* Suggest more */}
          <div style={{ margin: "18px 0 0", padding: "14px 16px", background: "var(--surface2,rgba(255,255,255,0.06))", border: "1px solid var(--border)", borderRadius: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--primary)", marginBottom: 10 }}>Ideas to boost your community</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { icon: "🎯", label: "Add a lifetime plan", hint: "One-time payment converts fence-sitters.", action: () => addPlan() },
                { icon: "💬", label: "Add more preview messages", hint: "More teaser messages build FOMO.", action: () => set({ previewMessages: [...(c.previewMessages ?? []), { text: "Check out the latest drop in #exclusive 🔥" }] }) },
                { icon: "🏆", label: "Add a yearly plan with savings badge", hint: "Show \"Save 17%\" to push annual sign-ups.", action: () => { const y = plans.find((p) => p.id === "yearly"); if (!y) addPlan(); } },
                { icon: "🌙", label: "Switch to dark theme", hint: "Dark theme feels more exclusive and premium.", action: () => set({ theme: "dark" }) },
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
                    style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 8, background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer" }}
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
