"use client";

/**
 * components/builder/v6/BuilderV6.tsx
 * Page Builder v6 — editor shell (Phase 2).
 * 3-pane studio: section outline · live frame (RenderEngine, editor mode) ·
 * schema-driven inspector built from REGISTRY[type].fields.
 * In-memory only (no DB / no deploy) — persistence arrives in Phase 5.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import ImageInput from "@/components/ImageInput";
import { RenderEngine } from "@/lib/builder/RenderEngine";
import { saveV6Page } from "@/app/studio/v6/actions";
import {
  REGISTRY, blocksByCategory, createSection,
} from "@/lib/builder/registry";
import { THEMES } from "@/lib/builder/themes";
import { SECTION_BGS, PAGE_BGS } from "@/lib/builder/backgrounds";
import { TEMPLATES, applyTemplate } from "@/lib/builder/templates";
import { getTheme } from "@/lib/builder/themes";
import type {
  BlockType, FieldDef, PageDoc, Section, SectionBg,
} from "@/lib/builder/types";

// ---------------------------------------------------------------------------
// small atoms
// ---------------------------------------------------------------------------

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <button type="button" className={`bx-switch${on ? " on" : ""}`} onClick={onClick} aria-pressed={on}><i /></button>;
}

function Chips<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="bx-chips">
      {options.map((o) => (
        <button key={o.value} type="button" className={`bx-chip${value === o.value ? " on" : ""}`} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/** Auto-scaling frame for the web preview (mirrors the store builder). */
function ScaledFrame({ width, children }: { width: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: width, z: 1 });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const update = () => { const cw = el.clientWidth; const W = Math.max(cw, width); setDims({ w: W, z: Math.min(1, cw / W) }); };
    update();
    const ro = new ResizeObserver(update); ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return <div ref={ref} style={{ width: "100%", overflow: "hidden" }}><div style={{ width: dims.w, zoom: dims.z, transformOrigin: "top left" } as CSSProperties}>{children}</div></div>;
}

// ---------------------------------------------------------------------------
// field renderer (schema-driven inspector)
// ---------------------------------------------------------------------------

function defaultRow(itemFields: FieldDef[]): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const f of itemFields) row[f.key] = f.kind === "repeater" ? [] : f.default ?? "";
  return row;
}

function Field({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const id = `f-${field.key}`;
  switch (field.kind) {
    case "textarea":
    case "richtext":
      return (
        <div className="bx-field">
          <label htmlFor={id}>{field.label}</label>
          <textarea id={id} value={String(value ?? "")} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case "number":
      return (
        <div className="bx-field">
          <label htmlFor={id}>{field.label}</label>
          <input id={id} type="number" min={field.min} max={field.max} step={field.step} value={value === "" || value == null ? "" : Number(value)} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
        </div>
      );
    case "toggle":
      return (
        <div className="bx-field bx-row">
          <label htmlFor={id} style={{ marginBottom: 0 }}>{field.label}</label>
          <Switch on={value === true} onClick={() => onChange(!(value === true))} />
        </div>
      );
    case "select":
      return (
        <div className="bx-field">
          <label htmlFor={id}>{field.label}</label>
          <Chips value={String(value ?? "")} options={(field.options ?? []).map((o) => ({ value: o.value, label: o.label }))} onChange={onChange} />
        </div>
      );
    case "color":
      return (
        <div className="bx-field">
          <label htmlFor={id}>{field.label}</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input id={id} className="bx-color" type="color" value={String(value || "#7C3AED")} onChange={(e) => onChange(e.target.value)} />
            {value ? <button type="button" className="bx-iconbtn" onClick={() => onChange("")}>clear</button> : null}
          </div>
        </div>
      );
    case "image":
      return (
        <div className="bx-field">
          <label>{field.label}</label>
          <ImageInput value={String(value ?? "")} onChange={(u) => onChange(u)} placeholder={field.placeholder ?? "https://… or upload"} />
        </div>
      );
    case "repeater":
      return <Repeater field={field} value={Array.isArray(value) ? value : []} onChange={onChange} />;
    case "url":
    case "icon":
    case "text":
    default:
      return (
        <div className="bx-field">
          <label htmlFor={id}>{field.label}</label>
          <input id={id} type={field.kind === "url" ? "url" : "text"} value={String(value ?? "")} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
  }
}

function Repeater({ field, value, onChange }: { field: FieldDef; value: unknown[]; onChange: (v: unknown[]) => void }) {
  const items = field.itemFields ?? [];
  const update = (i: number, key: string, v: unknown) => {
    const next = value.map((row, j) => (j === i ? { ...(row as Record<string, unknown>), [key]: v } : row));
    onChange(next);
  };
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));
  const move = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= value.length) return;
    const a = [...value]; [a[i], a[j]] = [a[j], a[i]]; onChange(a);
  };
  const add = () => onChange([...value, defaultRow(items)]);
  return (
    <div className="bx-field">
      <label>{field.label}</label>
      {value.map((row, i) => {
        const r = row as Record<string, unknown>;
        return (
          <div className="bx-rep-item" key={i}>
            <div className="bx-rep-head">
              <span>{field.itemLabel ?? "Item"} {i + 1}</span>
              <span style={{ display: "flex", gap: 2 }}>
                <button type="button" className="bx-iconbtn" disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
                <button type="button" className="bx-iconbtn" disabled={i === value.length - 1} onClick={() => move(i, 1)}>▼</button>
                <button type="button" className="bx-iconbtn danger" onClick={() => remove(i)}>✕</button>
              </span>
            </div>
            {items.map((itf) => (
              <Field key={itf.key} field={itf} value={r[itf.key]} onChange={(v) => update(i, itf.key, v)} />
            ))}
          </div>
        );
      })}
      <button type="button" className="bx-rep-add" onClick={add}>+ Add {field.itemLabel ?? "item"}</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// section-control options
// ---------------------------------------------------------------------------

const SIZE_OPTS = [{ value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }] as const;
const ALIGN_OPTS = [{ value: "", label: "Default" }, { value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }] as const;
const ANIM_OPTS = [{ value: "", label: "None" }, { value: "up", label: "Rise" }, { value: "zoom", label: "Zoom" }, { value: "float", label: "Float" }, { value: "fade", label: "Fade" }] as const;
const BTN_OPTS = [{ value: "gradient", label: "Gradient" }, { value: "solid", label: "Solid" }, { value: "outline", label: "Outline" }, { value: "metal", label: "Metal" }, { value: "glow", label: "Glow" }] as const;
const BTNCOLOR_OPTS = [{ value: "", label: "Brand" }, { value: "accent", label: "Accent" }, { value: "dark", label: "Dark" }, { value: "white", label: "White" }, { value: "success", label: "Success" }] as const;
const TEXTCOLOR_OPTS = [{ value: "", label: "Auto" }, { value: "dark", label: "Dark" }, { value: "light", label: "Light" }] as const;

// ---------------------------------------------------------------------------
// main editor
// ---------------------------------------------------------------------------

export default function BuilderV6({ initial }: { initial: PageDoc }) {
  const [doc, setDoc] = useState<PageDoc>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initial.sections[0]?.id ?? null);
  const [device, setDevice] = useState<"web" | "mobile">("web");
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [libOpen, setLibOpen] = useState(false);
  const [galOpen, setGalOpen] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(publish?: boolean) {
    setBusy(true); setMsg(null);
    const res = await saveV6Page(doc, publish);
    setBusy(false);
    if (!res.ok) { setMsg(res.error ?? "Failed"); return; }
    if (publish !== undefined) setDoc((d) => ({ ...d, status: publish ? "published" : "draft" }));
    setMsg(publish === true ? "Published ✓" : publish === false ? "Unpublished" : "Saved ✓");
    setTimeout(() => setMsg(null), 1800);
  }

  const applyTpl = (t: typeof TEMPLATES[number]) => {
    if (doc.sections.length && !window.confirm(`Apply "${t.name}"? This replaces all current sections, theme and background.`)) return;
    const next = applyTemplate(doc, t);
    setDoc(next);
    setSelectedId(next.sections[0]?.id ?? null);
    setGalOpen(false);
  };

  const sections = doc.sections;
  const selected = sections.find((s) => s.id === selectedId) ?? null;
  const selDef = selected ? REGISTRY[selected.type] : null;

  const setSections = (next: Section[]) => setDoc((d) => ({ ...d, sections: next }));
  const patchSection = (id: string, patch: Partial<Section>) =>
    setSections(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const patchProps = (id: string, key: string, v: unknown) =>
    setSections(sections.map((s) => (s.id === id ? { ...s, props: { ...s.props, [key]: v } } : s)));

  const addBlock = (type: BlockType) => {
    const sec = createSection(type);
    const idx = selectedId ? sections.findIndex((s) => s.id === selectedId) + 1 : sections.length;
    const next = [...sections.slice(0, idx), sec, ...sections.slice(idx)];
    setSections(next);
    setSelectedId(sec.id);
    setLibOpen(false);
  };
  const duplicate = (id: string) => {
    const i = sections.findIndex((s) => s.id === id); if (i < 0) return;
    const copy: Section = { ...sections[i], id: createSection(sections[i].type).id, props: structuredClone(sections[i].props) };
    setSections([...sections.slice(0, i + 1), copy, ...sections.slice(i + 1)]);
    setSelectedId(copy.id);
  };
  const remove = (id: string) => {
    const next = sections.filter((s) => s.id !== id);
    setSections(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  };
  const move = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= sections.length) return;
    const a = [...sections]; [a[i], a[j]] = [a[j], a[i]]; setSections(a);
  };
  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const a = [...sections]; const [it] = a.splice(from, 1); a.splice(to, 0, it); setSections(a);
  };

  const catalog = useMemo(() => blocksByCategory(), []);

  return (
    <div className="bx-studio">
      {/* top bar */}
      <div className="bx-top">
        <div className="grp">
          <a className="back" href="/dashboard">← Dashboard</a>
          <span className="bx-ptype">Page Builder v6 · <span style={{ textTransform: "capitalize" }}>{doc.type}</span></span>
          <div className="bx-seg">
            <button className={view === "edit" ? "on" : ""} onClick={() => setView("edit")}>Builder</button>
            <button className={view === "preview" ? "on" : ""} onClick={() => setView("preview")}>Preview</button>
          </div>
          <button className="bx-btn" onClick={() => setGalOpen(true)}>✨ Templates</button>
        </div>
        <div className="grp">
          <div className="bx-seg">
            <button className={device === "web" ? "on" : ""} onClick={() => setDevice("web")}>🖥</button>
            <button className={device === "mobile" ? "on" : ""} onClick={() => setDevice("mobile")}>📱</button>
          </div>
          {msg && <span className="bx-msg">{msg}</span>}
          <button className="bx-btn" onClick={() => save()} disabled={busy}>{doc.status === "published" ? "Update live" : "Save draft"}</button>
          {doc.status === "published"
            ? <button className="bx-btn" onClick={() => save(false)} disabled={busy}>Unpublish</button>
            : <button className="bx-btn grad" onClick={() => save(true)} disabled={busy}>Publish</button>}
        </div>
      </div>

      {/* preview-only mode */}
      {view === "preview" ? (
        <div className="bx-stage">
          <div className={`bx-browser${device === "mobile" ? " mob" : ""}`}>
            <div className="bx-chrome"><span className="bx-dot" /><span className="bx-dot" /><span className="bx-dot" /><span className="bx-url">{doc.slug || "preview"}.invoxai.io</span></div>
            <div className="bx-scr">
              {device === "web"
                ? <ScaledFrame width={1180}><RenderEngine doc={doc} device="web" /></ScaledFrame>
                : <RenderEngine doc={doc} device="mobile" />}
            </div>
          </div>
        </div>
      ) : (
        <div className="bx-body">
          {/* LEFT: outline */}
          <aside className="bx-rail">
            {/* page settings */}
            <div className="bx-pageset">
              <h4>Page</h4>
              <div className="bx-field"><label>Theme</label>
                <Chips value={doc.themeId} options={THEMES.map((t) => ({ value: t.id, label: t.name }))} onChange={(v) => setDoc((d) => ({ ...d, themeId: v }))} />
              </div>
              <div className="bx-field"><label>Page background</label>
                <Chips value={doc.pageBg} options={PAGE_BGS.map((b) => ({ value: b.id, label: b.label }))} onChange={(v) => setDoc((d) => ({ ...d, pageBg: v }))} />
              </div>
              <div className="bx-field bx-row"><label style={{ marginBottom: 0 }}>Mobile bottom CTA</label>
                <Switch on={doc.mobileCta?.enabled === true} onClick={() => setDoc((d) => ({ ...d, mobileCta: { enabled: !(d.mobileCta?.enabled === true), label: d.mobileCta?.label ?? "Get started", url: d.mobileCta?.url ?? "#" } }))} />
              </div>
              {doc.mobileCta?.enabled && (
                <>
                  <div className="bx-field"><label>CTA label</label><input type="text" value={doc.mobileCta.label} onChange={(e) => setDoc((d) => ({ ...d, mobileCta: { ...d.mobileCta!, label: e.target.value } }))} /></div>
                  <div className="bx-field" style={{ marginBottom: 0 }}><label>CTA link</label><input type="url" value={doc.mobileCta.url} onChange={(e) => setDoc((d) => ({ ...d, mobileCta: { ...d.mobileCta!, url: e.target.value } }))} /></div>
                </>
              )}
            </div>

            <div className="bx-railhead"><h4>Sections</h4><span className="bx-msg">{sections.length}</span></div>
            {sections.map((s, i) => (
              <div
                key={s.id}
                className={`bx-srow${s.id === selectedId ? " sel" : ""}${s.mobileHidden ? " hidden" : ""}${overIdx === i ? " dragover" : ""}`}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
                onDragLeave={() => setOverIdx((o) => (o === i ? null : o))}
                onDrop={() => { if (dragIdx != null) reorder(dragIdx, i); setDragIdx(null); setOverIdx(null); }}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                onClick={() => setSelectedId(s.id)}
              >
                <span className="grip" title="Drag to reorder">⠿</span>
                <span className="ico">{REGISTRY[s.type].icon}</span>
                <span className="nm">{REGISTRY[s.type].label}</span>
                <button type="button" className="bx-iconbtn" title="Move up" disabled={i === 0} onClick={(e) => { e.stopPropagation(); move(i, -1); }}>▲</button>
                <button type="button" className="bx-iconbtn" title="Move down" disabled={i === sections.length - 1} onClick={(e) => { e.stopPropagation(); move(i, 1); }}>▼</button>
                <button type="button" className="bx-iconbtn" title={s.mobileHidden ? "Show" : "Hide"} onClick={(e) => { e.stopPropagation(); patchSection(s.id, { mobileHidden: !s.mobileHidden }); }}>{s.mobileHidden ? "🙈" : "👁"}</button>
                <button type="button" className="bx-iconbtn" title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicate(s.id); }}>⧉</button>
                <button type="button" className="bx-iconbtn danger" title="Delete" onClick={(e) => { e.stopPropagation(); remove(s.id); }}>🗑</button>
              </div>
            ))}
            <button className="bx-add" onClick={() => setLibOpen(true)}>+ Add section</button>
          </aside>

          {/* CENTER: live frame */}
          <div className="bx-stage">
            <div className={`bx-browser${device === "mobile" ? " mob" : ""}`}>
              <div className="bx-chrome"><span className="bx-dot" /><span className="bx-dot" /><span className="bx-dot" /><span className="bx-url">{doc.slug || "preview"}.invoxai.io</span></div>
              <div className="bx-scr">
                {device === "web"
                  ? <ScaledFrame width={1180}><RenderEngine sections={sections} themeId={doc.themeId} pageBg={doc.pageBg} mobileCta={doc.mobileCta} device="web" editor selectedId={selectedId} onSelectSection={setSelectedId} /></ScaledFrame>
                  : <RenderEngine sections={sections} themeId={doc.themeId} pageBg={doc.pageBg} mobileCta={doc.mobileCta} device="mobile" editor selectedId={selectedId} onSelectSection={setSelectedId} />}
              </div>
            </div>
          </div>

          {/* RIGHT: inspector */}
          <aside className="bx-insp">
            {!selected || !selDef ? (
              <p className="bx-msg">Select a section to edit it, or add one from the left.</p>
            ) : (
              <>
                <h3>{selDef.icon} {selDef.label}</h3>
                {selDef.variants.length > 1 && (
                  <div className="bx-field"><label>Layout variant</label>
                    <Chips value={selected.variant} options={selDef.variants.map((v) => ({ value: v, label: v }))} onChange={(v) => patchSection(selected.id, { variant: v })} />
                  </div>
                )}

                {/* content fields */}
                {selDef.fields.map((field) => (
                  <Field key={field.key} field={field} value={selected.props[field.key]} onChange={(v) => patchProps(selected.id, field.key, v)} />
                ))}

                {/* section-level design controls */}
                <div className="bx-subhead">Design</div>
                <div className="bx-field"><label>Background</label>
                  <Chips value={selected.bg} options={SECTION_BGS.map((b) => ({ value: b.id as SectionBg, label: b.label }))} onChange={(v) => patchSection(selected.id, { bg: v })} />
                </div>
                <div className="bx-field"><label>Spacing</label><Chips value={selected.size} options={SIZE_OPTS.map((o) => ({ ...o }))} onChange={(v) => patchSection(selected.id, { size: v })} /></div>
                <div className="bx-field"><label>Align</label><Chips value={selected.align} options={ALIGN_OPTS.map((o) => ({ ...o }))} onChange={(v) => patchSection(selected.id, { align: v })} /></div>
                <div className="bx-field"><label>Animation</label><Chips value={selected.anim} options={ANIM_OPTS.map((o) => ({ ...o }))} onChange={(v) => patchSection(selected.id, { anim: v })} /></div>
                <div className="bx-field"><label>Text color</label><Chips value={selected.textColor} options={TEXTCOLOR_OPTS.map((o) => ({ ...o }))} onChange={(v) => patchSection(selected.id, { textColor: v })} /></div>

                <div className="bx-subhead">Buttons</div>
                <div className="bx-field"><label>Style</label><Chips value={selected.btn} options={BTN_OPTS.map((o) => ({ ...o }))} onChange={(v) => patchSection(selected.id, { btn: v })} /></div>
                <div className="bx-field"><label>Size</label><Chips value={selected.btnSize} options={SIZE_OPTS.map((o) => ({ ...o }))} onChange={(v) => patchSection(selected.id, { btnSize: v })} /></div>
                <div className="bx-field"><label>Color</label><Chips value={selected.btnColor} options={BTNCOLOR_OPTS.map((o) => ({ ...o }))} onChange={(v) => patchSection(selected.id, { btnColor: v })} /></div>

                <div className="bx-subhead">Visibility</div>
                <div className="bx-field bx-row"><label style={{ marginBottom: 0 }}>Hidden on mobile</label><Switch on={selected.mobileHidden} onClick={() => patchSection(selected.id, { mobileHidden: !selected.mobileHidden })} /></div>

                <button type="button" className="bx-iconbtn danger" style={{ marginTop: 8 }} onClick={() => remove(selected.id)}>Delete section</button>

                {/* suggest more (builder rule #5) */}
                <div className="bx-suggest">
                  <div className="hd">Add to boost this page</div>
                  {[
                    { icon: "💬", label: "Add testimonials", hint: "Social proof lifts conversions.", type: "testimonials" as BlockType },
                    { icon: "💲", label: "Add a pricing table", hint: "Make it easy to buy.", type: "pricing" as BlockType },
                    { icon: "❓", label: "Add an FAQ", hint: "Answer objections inline.", type: "faq" as BlockType },
                    { icon: "📣", label: "Add a CTA banner", hint: "End with a clear next step.", type: "banner" as BlockType },
                  ].map((s) => (
                    <div className="item" key={s.type}>
                      <span style={{ fontSize: 16 }}>{s.icon}</span>
                      <div className="t"><b>{s.label}</b>{s.hint}</div>
                      <button type="button" onClick={() => addBlock(s.type)}>Add</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {/* section library popup */}
      {libOpen && (
        <div className="bx-lib-overlay" onClick={() => setLibOpen(false)}>
          <div className="bx-lib" onClick={(e) => e.stopPropagation()}>
            <button className="bx-lib-close" onClick={() => setLibOpen(false)}>✕</button>
            <h3>Add a section</h3>
            <p className="sub">Pick a block — it&apos;s inserted after the selected section.</p>
            {catalog.map(({ category, blocks }) => blocks.length > 0 && (
              <div key={category.id}>
                <div className="bx-lib-cat">{category.label}</div>
                <div className="bx-lib-grid">
                  {blocks.map((b) => (
                    <button key={b.type} type="button" className="bx-lib-card" onClick={() => addBlock(b.type)}>
                      <span className="ico">{b.icon}</span><span className="nm">{b.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* template gallery popup */}
      {galOpen && (
        <div className="bx-lib-overlay" onClick={() => setGalOpen(false)}>
          <div className="bx-lib" onClick={(e) => e.stopPropagation()}>
            <button className="bx-lib-close" onClick={() => setGalOpen(false)}>✕</button>
            <h3>Start from a template</h3>
            <p className="sub">Applying a template replaces all sections, the theme and the background.</p>
            <div className="bx-tpl-grid">
              {TEMPLATES.map((t) => {
                const th = getTheme(t.themeId);
                return (
                  <button key={t.id} type="button" className="bx-tpl-card" onClick={() => applyTpl(t)}>
                    <span className="bx-tpl-bar" style={{ background: `linear-gradient(135deg, ${th.brand}, ${th.b2} 60%, ${th.acc})` }}>
                      <span className={`bx-tpl-tag${t.tag === "Pro" ? " pro" : ""}`}>{t.tag}</span>
                    </span>
                    <span className="bx-tpl-body">
                      <span className="bx-tpl-name">{t.name}</span>
                      <span className="bx-tpl-cat">{t.category} · {t.blocks.length} sections</span>
                      {t.description && <span className="bx-tpl-desc">{t.description}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
