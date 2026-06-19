"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import CourseView from "./CourseView";
import {
  type CourseContent,
  type CourseModule,
  DEFAULT_COURSE_CONTENT,
  totalDuration,
  formatCoursePrice,
} from "@/lib/course";
import { saveCourse, setCourseStatus } from "@/app/dashboard/courses/actions";

// ── Primitives shared with other builders ────────────────────────────────────

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <button type="button" className={`switch${on ? " on" : ""}`} onClick={onClick}><i /></button>;
}

function Sec({ title, children, open: openDefault = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(openDefault);
  return (
    <div className={`sec${open ? "" : " collapsed"}`}>
      <h3 onClick={() => setOpen((o) => !o)}>{title}</h3>
      {open && children}
    </div>
  );
}

async function upload(file: File): Promise<string | null> {
  const fd = new FormData(); fd.append("file", file);
  try {
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await res.json();
    return res.ok ? (j.url as string) : null;
  } catch { return null; }
}

function Upload({ label, value, onUrl, onRemove }: { label: string; value?: string; onUrl: (u: string) => void; onRemove?: () => void }) {
  const [busy, setBusy] = useState(false);
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true); const u = await upload(f); setBusy(false);
    if (u) onUrl(u);
  };
  if (value) return (
    <div className="up up-has">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="up-prev" src={value} alt="" />
      <div className="up-actions">
        <span className="t">{busy ? "Uploading…" : label}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <label className="up-btn">Change<input type="file" accept="image/*" onChange={pick} /></label>
          {onRemove && <button type="button" className="up-btn danger" onClick={onRemove}>Remove</button>}
        </div>
      </div>
    </div>
  );
  return <label className="up"><span className="ico">🖼</span><span className="t">{busy ? "Uploading…" : label}</span><input type="file" accept="image/*" onChange={pick} /></label>;
}

/** Scales a fixed-width desktop render down to fit the available preview column width. */
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
      <div style={{ width: dims.w, zoom: dims.z, transformOrigin: "top left" } as React.CSSProperties}>
        {children}
      </div>
    </div>
  );
}

// ── Module/Lesson editor helpers ─────────────────────────────────────────────

type DraftLesson = {
  id: string | null;   // null = new (not yet persisted)
  _key: string;        // stable React key
  title: string;
  video_url: string;
  duration: string;
  is_free_preview: boolean;
  sort_order: number;
  content: string;
};

type DraftModule = {
  id: string | null;
  _key: string;
  title: string;
  sort_order: number;
  lessons: DraftLesson[];
};

function makeLesson(sort_order: number): DraftLesson {
  return { id: null, _key: crypto.randomUUID(), title: "New lesson", video_url: "", duration: "", is_free_preview: false, sort_order, content: "" };
}

function makeModule(sort_order: number): DraftModule {
  return { id: null, _key: crypto.randomUUID(), title: "Module " + (sort_order + 1), sort_order, lessons: [makeLesson(0)] };
}

function draftFromDb(modules: CourseModule[]): DraftModule[] {
  return modules.map((m, mi) => ({
    id: m.id,
    _key: m.id,
    title: m.title,
    sort_order: m.sort_order ?? mi,
    lessons: m.lessons.map((l, li) => ({
      id: l.id,
      _key: l.id,
      title: l.title,
      video_url: l.video_url ?? "",
      duration: l.duration ?? "",
      is_free_preview: l.is_free_preview,
      sort_order: l.sort_order ?? li,
      content: l.content ?? "",
    })),
  }));
}

function draftToPayload(drafts: DraftModule[]) {
  return drafts.map((m, mi) => ({
    id: m.id,
    title: m.title,
    sort_order: mi,
    lessons: m.lessons.map((l, li) => ({
      id: l.id,
      title: l.title,
      video_url: l.video_url || undefined,
      duration: l.duration || undefined,
      is_free_preview: l.is_free_preview,
      sort_order: li,
      content: l.content || undefined,
    })),
  }));
}

// ── Analytics mini-card ───────────────────────────────────────────────────────

function AnalyticsBar({ students, revenue, currency }: { students: number; revenue: number; currency: string }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
      {[
        { label: "Students", value: students.toLocaleString("en-IN"), color: "var(--secondary)" },
        { label: "Revenue", value: formatCoursePrice(Math.round(revenue / 100), currency), color: "var(--green)" },
      ].map(({ label, value, color }) => (
        <div key={label} style={{ flex: 1, minWidth: 110, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)", marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CourseBuilder({
  pageId,
  initial,
  initialModules,
  publicUrl,
  initialStatus,
  isImpersonating,
  students,
  revenue,
}: {
  pageId: string;
  initial: CourseContent;
  initialModules: CourseModule[];
  publicUrl: string | null;
  initialStatus: string;
  isImpersonating: boolean;
  students: number;
  revenue: number;
}) {
  const [c, setC] = useState<CourseContent>({ ...DEFAULT_COURSE_CONTENT, ...initial });
  const set = (patch: Partial<CourseContent>) => setC((p) => ({ ...p, ...patch }));

  const [modules, setModules] = useState<DraftModule[]>(() =>
    initialModules.length > 0 ? draftFromDb(initialModules) : [makeModule(0)]
  );
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<"edit" | "public">("edit");
  const [device, setDevice] = useState<"web" | "mobile">("web");

  const showMsg = useCallback((m: string, isErr = false) => {
    if (isErr) setErr(m); else setMsg(m);
    setTimeout(() => { setMsg(null); setErr(null); }, 2200);
  }, []);

  // ── Module/Lesson CRUD ──

  function addModule() {
    setModules((prev) => [...prev, makeModule(prev.length)]);
  }

  function removeModule(key: string) {
    setModules((prev) => prev.filter((m) => m._key !== key));
  }

  function moveModule(key: string, dir: -1 | 1) {
    setModules((prev) => {
      const i = prev.findIndex((m) => m._key === key);
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const a = [...prev]; [a[i], a[j]] = [a[j], a[i]]; return a;
    });
  }

  function updateModule(key: string, patch: Partial<DraftModule>) {
    setModules((prev) => prev.map((m) => m._key === key ? { ...m, ...patch } : m));
  }

  function addLesson(modKey: string) {
    setModules((prev) => prev.map((m) => {
      if (m._key !== modKey) return m;
      return { ...m, lessons: [...m.lessons, makeLesson(m.lessons.length)] };
    }));
  }

  function removeLesson(modKey: string, lesKey: string) {
    setModules((prev) => prev.map((m) => {
      if (m._key !== modKey) return m;
      return { ...m, lessons: m.lessons.filter((l) => l._key !== lesKey) };
    }));
  }

  function updateLesson(modKey: string, lesKey: string, patch: Partial<DraftLesson>) {
    setModules((prev) => prev.map((m) => {
      if (m._key !== modKey) return m;
      return { ...m, lessons: m.lessons.map((l) => l._key === lesKey ? { ...l, ...patch } : l) };
    }));
  }

  function moveLesson(modKey: string, lesKey: string, dir: -1 | 1) {
    setModules((prev) => prev.map((m) => {
      if (m._key !== modKey) return m;
      const i = m.lessons.findIndex((l) => l._key === lesKey);
      const j = i + dir;
      if (j < 0 || j >= m.lessons.length) return m;
      const a = [...m.lessons]; [a[i], a[j]] = [a[j], a[i]];
      return { ...m, lessons: a };
    }));
  }

  // ── Outcomes list ──

  function setOutcome(i: number, v: string) {
    const arr = [...(c.outcomes ?? [])];
    arr[i] = v;
    set({ outcomes: arr });
  }

  function addOutcome() { set({ outcomes: [...(c.outcomes ?? []), ""] }); }
  function removeOutcome(i: number) { set({ outcomes: (c.outcomes ?? []).filter((_, j) => j !== i) }); }

  function setInclude(i: number, v: string) {
    const arr = [...(c.includes ?? [])];
    arr[i] = v;
    set({ includes: arr });
  }
  function addInclude() { set({ includes: [...(c.includes ?? []), ""] }); }
  function removeInclude(i: number) { set({ includes: (c.includes ?? []).filter((_, j) => j !== i) }); }

  // ── Save / publish ──

  async function save(publish?: "publish" | "unpublish") {
    if (isImpersonating) { showMsg("Read-only while impersonating.", true); return; }
    setBusy(true); setMsg(null); setErr(null);

    const res = await saveCourse(pageId, { content: c, modules: draftToPayload(modules) });
    if (!res.ok) { setBusy(false); showMsg(res.error ?? "Save failed", true); return; }

    if (publish === "publish" || publish === "unpublish") {
      const newStatus = publish === "publish" ? "published" : "draft";
      const res2 = await setCourseStatus(pageId, newStatus);
      if (!res2.ok) { setBusy(false); showMsg(res2.error ?? "Status change failed", true); return; }
      setStatus(newStatus);
    }

    setBusy(false);
    showMsg(publish === "publish" ? "Published!" : publish === "unpublish" ? "Unpublished" : "Saved");
  }

  // ── Live preview data ──

  const allLessons = modules.flatMap((m) => m.lessons);
  const previewModules: CourseModule[] = modules.map((m) => ({
    id: m.id ?? m._key,
    page_id: pageId,
    title: m.title,
    sort_order: m.sort_order,
    lessons: m.lessons.map((l) => ({
      id: l.id ?? l._key,
      module_id: m.id ?? m._key,
      title: l.title,
      video_url: l.video_url || null,
      duration: l.duration || null,
      is_free_preview: l.is_free_preview,
      sort_order: l.sort_order,
      content: l.content || null,
    })),
  }));

  const totalLessons = allLessons.length;
  const dur = totalDuration(allLessons.map((l) => ({
    id: l.id ?? l._key, module_id: "", title: l.title,
    video_url: l.video_url || null, duration: l.duration || null,
    is_free_preview: l.is_free_preview, sort_order: l.sort_order, content: l.content || null,
  })));

  const Preview = () => (
    <div className="previewwrap">
      <div className={`browser${device === "mobile" ? " mob" : ""}`}>
        <div className="bchrome">
          <span className="bdot" /><span className="bdot" /><span className="bdot" />
          <span className="burl">{publicUrl ? publicUrl.replace("https://", "") + `/course/${pageId.slice(0, 8)}` : "yourstore.invoxai.io/course/…"}</span>
          <div className="seg pvseg">
            <button className={device === "web" ? "on" : ""} onClick={() => setDevice("web")}>Desktop</button>
            <button className={device === "mobile" ? "on" : ""} onClick={() => setDevice("mobile")}>Mobile</button>
          </div>
        </div>
        <div className="scr">
          {device === "web"
            ? <ScaledFrame width={1080}>
                <CourseView
                  key={`${c.theme}-${c.headline}`}
                  page={{ id: pageId, public_id: null, content: c, status }}
                  modules={previewModules}
                  pageId={pageId}
                  payEnabled={false}
                  enrolled={false}
                />
              </ScaledFrame>
            : <CourseView
                key={`${c.theme}-${c.headline}-m`}
                page={{ id: pageId, public_id: null, content: c, status }}
                modules={previewModules}
                pageId={pageId}
                payEnabled={false}
                enrolled={false}
              />
          }
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Sticky header */}
      <div className="dx-phead">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/dashboard/courses" className="dx-muted" style={{ textDecoration: "none", fontSize: 13 }}>← Courses</a>
          <div className="web-seg">
            <button className={view === "edit" ? "on" : ""} onClick={() => setView("edit")}>Builder</button>
            <button className={view === "public" ? "on" : ""} onClick={() => setView("public")}>Preview</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {isImpersonating && <span style={{ fontSize: 12, color: "var(--secondary)" }}>Read-only (impersonating)</span>}
          {msg && <span className="dx-muted" style={{ fontSize: 13 }}>{msg}</span>}
          {err && <span style={{ fontSize: 13, color: "var(--secondary)" }}>{err}</span>}
          {publicUrl && status === "published" && (
            <a className="dx-editbtn" href={`${publicUrl}/course/${pageId}`} target="_blank" rel="noreferrer">View ↗</a>
          )}
          <button className={status === "published" ? "btn grad" : "dx-editbtn"} onClick={() => save()} disabled={busy || isImpersonating}>{status === "published" ? "Update live" : "Save draft"}</button>
          {status === "published"
            ? <button className="dx-editbtn" onClick={() => save("unpublish")} disabled={busy || isImpersonating}>Unpublish</button>
            : <button className="btn grad" onClick={() => save("publish")} disabled={busy || isImpersonating}>Publish</button>
          }
        </div>
      </div>

      {/* Full public preview mode */}
      {view === "public" && (
        <div className="web-public-view">
          <CourseView
            page={{ id: pageId, public_id: null, content: c, status }}
            modules={previewModules}
            pageId={pageId}
            payEnabled={false}
            enrolled={false}
          />
        </div>
      )}

      <div className="webbuild" style={view === "public" ? { display: "none" } : undefined}>
        <div className="webacc">

          {/* Analytics */}
          <Sec title="Analytics">
            <AnalyticsBar students={students} revenue={revenue} currency={c.currency ?? "INR"} />
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {totalLessons} lesson{totalLessons !== 1 ? "s" : ""} · {modules.length} module{modules.length !== 1 ? "s" : ""}{dur ? ` · ${dur} total` : ""}
            </div>
          </Sec>

          {/* Course info */}
          <Sec title="Course info">
            <div className="field"><label>Title</label><input value={c.headline ?? ""} onChange={(e) => set({ headline: e.target.value })} placeholder="e.g. The Complete Mixing Masterclass" /></div>
            <div className="field"><label>Subtitle</label><input value={c.subheadline ?? ""} onChange={(e) => set({ subheadline: e.target.value })} placeholder="Short compelling subtitle…" /></div>
            <div className="field"><label>Category label</label><input value={c.category ?? ""} onChange={(e) => set({ category: e.target.value })} placeholder="e.g. Music Production · Beginner to Pro" /></div>
            <div className="field">
              <label>Description (HTML)</label>
              <textarea
                rows={5}
                value={c.description_html ?? ""}
                onChange={(e) => set({ description_html: e.target.value })}
                placeholder="<p>Describe your course…</p>"
              />
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>Basic HTML tags allowed. Content is sanitized before display.</div>
            </div>
            <Upload
              label="Thumbnail / preview image"
              value={c.thumbnail}
              onUrl={(u) => set({ thumbnail: u })}
              onRemove={() => set({ thumbnail: undefined })}
            />
            <div className="ff">
              <div className="field"><label>Price (₹)</label><input type="number" min={0} value={c.price ?? ""} onChange={(e) => set({ price: parseFloat(e.target.value) || 0 })} placeholder="999" /></div>
              <div className="field"><label>Compare-at price</label><input type="number" min={0} value={c.compare_at_price ?? ""} onChange={(e) => set({ compare_at_price: parseFloat(e.target.value) || undefined })} placeholder="1499" /></div>
            </div>
            <div className="field"><label>Currency</label>
              <div className="chips">
                {["INR", "USD", "GBP", "EUR"].map((cur) => (
                  <div key={cur} className={`chip${(c.currency ?? "INR") === cur ? " on" : ""}`} onClick={() => set({ currency: cur })}>{cur}</div>
                ))}
              </div>
            </div>
            <div className="field"><label>Enroll button label</label><input value={c.cta_label ?? ""} onChange={(e) => set({ cta_label: e.target.value })} placeholder="Enroll now" /></div>
          </Sec>

          {/* Instructor */}
          <Sec title="Instructor" open={false}>
            <div className="field"><label>Instructor name</label><input value={c.instructor_name ?? ""} onChange={(e) => set({ instructor_name: e.target.value })} placeholder="Your name" /></div>
            <div className="field"><label>Short bio / credentials</label><input value={c.instructor_bio ?? ""} onChange={(e) => set({ instructor_bio: e.target.value })} placeholder="Grammy-nominated engineer" /></div>
            <Upload
              label="Instructor avatar"
              value={c.instructor_avatar}
              onUrl={(u) => set({ instructor_avatar: u })}
              onRemove={() => set({ instructor_avatar: undefined })}
            />
          </Sec>

          {/* Outcomes */}
          <Sec title="What students will learn" open={false}>
            {(c.outcomes ?? []).map((o, i) => (
              <div key={i} className="frow" style={{ display: "flex", gap: 7, marginBottom: 7 }}>
                <input
                  style={{ flex: 1, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)", color: "var(--text)", font: "inherit", fontSize: 12.5 }}
                  value={o}
                  onChange={(e) => setOutcome(i, e.target.value)}
                  placeholder="What will students learn…"
                />
                <button className="del" onClick={() => removeOutcome(i)}>✕</button>
              </div>
            ))}
            <button className="addrow" onClick={addOutcome}>+ Add outcome</button>
          </Sec>

          {/* Includes */}
          <Sec title="Includes (enroll card)" open={false}>
            {(c.includes ?? []).map((item, i) => (
              <div key={i} className="frow" style={{ display: "flex", gap: 7, marginBottom: 7 }}>
                <input
                  style={{ flex: 1, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)", color: "var(--text)", font: "inherit", fontSize: 12.5 }}
                  value={item}
                  onChange={(e) => setInclude(i, e.target.value)}
                  placeholder="e.g. Lifetime access"
                />
                <button className="del" onClick={() => removeInclude(i)}>✕</button>
              </div>
            ))}
            <button className="addrow" onClick={addInclude}>+ Add item</button>
          </Sec>

          {/* Curriculum */}
          <Sec title="Curriculum">
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
              {modules.length} module{modules.length !== 1 ? "s" : ""} · {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
            </div>

            {modules.map((mod, mi) => (
              <div key={mod._key} style={{ border: "1px solid var(--border)", borderRadius: 14, marginBottom: 12, overflow: "hidden", background: "var(--surface)" }}>
                {/* Module header */}
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", background: "var(--surface2)" }}>
                  <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <button className="ord" disabled={mi === 0} onClick={() => moveModule(mod._key, -1)}>▲</button>
                    <button className="ord" disabled={mi === modules.length - 1} onClick={() => moveModule(mod._key, 1)}>▼</button>
                  </span>
                  <input
                    style={{ flex: 1, border: 0, background: "transparent", font: "inherit", fontWeight: 700, fontSize: 14, color: "var(--text)", outline: "none" }}
                    value={mod.title}
                    onChange={(e) => updateModule(mod._key, { title: e.target.value })}
                    placeholder="Module title"
                  />
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{mod.lessons.length} lesson{mod.lessons.length !== 1 ? "s" : ""}</span>
                  <button className="del" onClick={() => removeModule(mod._key)} style={{ color: "var(--secondary)" }}>✕</button>
                </div>

                {/* Lessons */}
                <div style={{ padding: "6px 14px 12px" }}>
                  {mod.lessons.map((les, li) => (
                    <div key={les._key} style={{ borderTop: li === 0 ? "none" : "1px solid var(--border)", paddingTop: li === 0 ? 0 : 8, marginTop: li === 0 ? 0 : 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <button className="ord" disabled={li === 0} onClick={() => moveLesson(mod._key, les._key, -1)}>▲</button>
                          <button className="ord" disabled={li === mod.lessons.length - 1} onClick={() => moveLesson(mod._key, les._key, 1)}>▼</button>
                        </span>
                        <span style={{ color: "var(--muted)", fontSize: 13 }}>▶</span>
                        <input
                          style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px", background: "var(--bg)", color: "var(--text)", font: "inherit", fontSize: 13, outline: "none" }}
                          value={les.title}
                          onChange={(e) => updateLesson(mod._key, les._key, { title: e.target.value })}
                          placeholder="Lesson title"
                        />
                        <button
                          style={{ fontSize: 10, fontWeight: 700, padding: "4px 8px", borderRadius: 99, cursor: "pointer", border: "1px solid var(--border)", color: les.is_free_preview ? "var(--green)" : "var(--muted)", background: les.is_free_preview ? "color-mix(in srgb, var(--green) 12%, transparent)" : "transparent" }}
                          onClick={() => updateLesson(mod._key, les._key, { is_free_preview: !les.is_free_preview })}
                        >
                          Free
                        </button>
                        <input
                          style={{ width: 60, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", background: "var(--bg)", color: "var(--text)", font: "inherit", fontSize: 12, textAlign: "right" }}
                          value={les.duration}
                          onChange={(e) => updateLesson(mod._key, les._key, { duration: e.target.value })}
                          placeholder="12:34"
                        />
                        <button className="del" onClick={() => removeLesson(mod._key, les._key)}>✕</button>
                      </div>
                      {/* Video URL row */}
                      <input
                        style={{ width: "100%", marginLeft: 30, boxSizing: "border-box", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", background: "var(--bg)", color: "var(--muted)", font: "inherit", fontSize: 12 } as React.CSSProperties}
                        value={les.video_url}
                        onChange={(e) => updateLesson(mod._key, les._key, { video_url: e.target.value })}
                        placeholder="YouTube / Vimeo URL (optional)"
                      />
                    </div>
                  ))}
                  <button className="addrow" style={{ marginTop: 10 }} onClick={() => addLesson(mod._key)}>
                    + Add lesson
                  </button>
                </div>
              </div>
            ))}

            <button className="addrow" onClick={addModule} style={{ borderStyle: "dashed", fontWeight: 700 }}>
              + Add module
            </button>
          </Sec>

          {/* Theme */}
          <Sec title="Theme" open={false}>
            <div className="field">
              <label>Color theme</label>
              <div className="chips">
                {[["light", "Light"], ["dark", "Dark"]].map(([val, label]) => (
                  <div key={val} className={`chip${(c.theme ?? "light") === val ? " on" : ""}`} onClick={() => set({ theme: val as "light" | "dark" })}>{label}</div>
                ))}
              </div>
            </div>
          </Sec>

          {/* SEO */}
          <Sec title="SEO" open={false}>
            <div className="field"><label>Page title (for search)</label><input value={c.seo_title ?? ""} onChange={(e) => set({ seo_title: e.target.value })} placeholder={c.headline ?? "Course title"} /></div>
            <div className="field"><label>Meta description</label><textarea rows={2} value={c.seo_description ?? ""} onChange={(e) => set({ seo_description: e.target.value })} placeholder="A brief description for search engines (150–160 chars)" /></div>
            <Upload
              label="OG / share image"
              value={c.og_image}
              onUrl={(u) => set({ og_image: u })}
              onRemove={() => set({ og_image: undefined })}
            />
            <div className="seo-google">
              <div className="g-url">yourstore.invoxai.io/course/…</div>
              <div className="g-title">{c.seo_title || c.headline || "Course title"}</div>
              <div className="g-desc">{c.seo_description || "Meta description will appear here."}</div>
            </div>
          </Sec>

          {/* Suggest more */}
          <div style={{ margin: "18px 0 0", padding: "14px 16px", background: "var(--surface2, rgba(255,255,255,0.06))", border: "1px solid var(--border)", borderRadius: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--primary)", marginBottom: 10 }}>Ideas to boost your course</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { icon: "🎬", label: "Add a free preview lesson", hint: "Mark the first lesson as a free preview to increase enrollment conversions.", action: () => { if (modules[0]?.lessons[0]) updateLesson(modules[0]._key, modules[0].lessons[0]._key, { is_free_preview: true }); } },
                { icon: "💰", label: "Add a compare-at price", hint: "Show a strikethrough original price to highlight your discount.", action: () => { if (!c.compare_at_price && c.price) set({ compare_at_price: Math.round(c.price * 1.5) }); } },
                { icon: "🌙", label: "Switch to dark theme", hint: "A dark course page can look premium and professional for technical courses.", action: () => set({ theme: "dark" }) },
                { icon: "🏆", label: "Add a certificate include", hint: "Let students know they will receive a certificate of completion.", action: () => set({ includes: [...(c.includes ?? []), "Certificate of completion"] }) },
                { icon: "📚", label: "Add more modules", hint: "Structure your content into clear modules to increase perceived value.", action: addModule },
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
                    style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 8, background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
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
