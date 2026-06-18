"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phead, Card, Table, Kpis, Tag, Live } from "@/components/dx/ui";
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  toggleTemplateStatus,
  type TemplateRow,
  type TemplateInput,
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

/* ── inline styles (scoped to this feature) ─────────────────── */
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
  .tm-drawer      { position: fixed; z-index: 61; right: 0; top: 0; bottom: 0; width: min(440px, 96vw); background: var(--surface); border-left: 1px solid var(--border); display: flex; flex-direction: column; box-shadow: -24px 0 60px rgba(0,0,0,.18); overflow: hidden; }
  .tm-dhead       { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px 14px; border-bottom: 1px solid var(--border); flex: none; }
  .tm-dhead h3    { font-family: "Sora", sans-serif; font-size: 16px; font-weight: 700; margin: 0; }
  .tm-dbody       { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
  .tm-dfoot       { flex: none; padding: 14px 20px; border-top: 1px solid var(--border); display: flex; gap: 8px; align-items: center; }
  .tm-msg         { font-size: 12px; color: var(--muted); margin-left: auto; }
  .tm-msg.err     { color: var(--red, #e5476f); }

  .tm-filter-bar  { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }

  /* notice banner */
  .tm-notice      { border: 1px dashed var(--border); border-radius: 12px; padding: 20px; background: var(--surface); display: flex; gap: 14px; align-items: flex-start; }
  .tm-notice-icon { font-size: 22px; flex: none; }
  .tm-notice h3   { font-size: 15px; margin: 0 0 4px; }
  .tm-notice p    { font-size: 13px; color: var(--muted); margin: 0; }
`;

/* ── DrawerForm ──────────────────────────────────────────────── */

type DrawerProps = {
  row: TemplateRow | null; // null = create
  onClose: () => void;
};

function DrawerForm({ row, onClose }: DrawerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);

  const blank: TemplateInput = {
    name: row?.name ?? "",
    type: row?.type ?? "bio",
    tier: row?.tier ?? "free",
    price_paise: row?.price_paise ?? 0,
    thumbnail_url: row?.thumbnail_url ?? "",
    description: row?.description ?? "",
    status: row?.status ?? "draft",
  };
  const [f, setF] = useState<TemplateInput>(blank);

  function field(key: keyof TemplateInput, value: string | number) {
    setF((p) => ({ ...p, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      setMsg(null);
      let res;
      if (row) {
        res = await updateTemplate(row.id, f);
      } else {
        // create then immediately update with the full input
        const created = await createTemplate();
        if (!created.ok) { setMsg({ text: created.error, err: true }); return; }
        res = await updateTemplate(created.data!.id, f);
      }
      if (!res.ok) { setMsg({ text: (res as { ok: false; error: string }).error, err: true }); return; }
      setMsg({ text: "Saved", err: false });
      router.refresh();
      setTimeout(onClose, 600);
    });
  }

  return (
    <>
      <div className="tm-scrim" onClick={onClose} />
      <aside className="tm-drawer">
        <div className="tm-dhead">
          <h3>{row ? "Edit template" : "New template"}</h3>
          <button className="dx-editbtn" onClick={onClose}>Close</button>
        </div>

        <div className="tm-dbody">
          <div className="dx-field">
            <label>Template name</label>
            <input value={f.name} placeholder="e.g. Aurora Bio" onChange={(e) => field("name", e.target.value)} />
          </div>

          <div className="dx-ff">
            <div className="dx-field">
              <label>Page type</label>
              <select value={f.type} onChange={(e) => field("type", e.target.value)}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg)", color: "var(--text)", font: "inherit" }}>
                {PAGE_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="dx-field">
              <label>Tier</label>
              <select value={f.tier} onChange={(e) => field("tier", e.target.value)}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg)", color: "var(--text)", font: "inherit" }}>
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
              style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg)", color: "var(--text)", font: "inherit", resize: "vertical" }}
            />
          </div>

          <div className="dx-field">
            <label>Status</label>
            <select value={f.status} onChange={(e) => field("status", e.target.value)}
              style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg)", color: "var(--text)", font: "inherit" }}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>

        <div className="tm-dfoot">
          <button className="btn grad" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save template"}</button>
          {msg && <span className={`tm-msg${msg.err ? " err" : ""}`}>{msg.text}</span>}
        </div>
      </aside>
    </>
  );
}

/* ── GridCard ────────────────────────────────────────────────── */

function GridCard({ row, onEdit }: { row: TemplateRow; onEdit: () => void }) {
  const router = useRouter();
  const [toggling, startToggle] = useTransition();
  const [deleting, startDelete] = useTransition();

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
        <div className="tm-sales">{row.sales_count} sale{row.sales_count !== 1 ? "s" : ""}</div>

        <div className="tm-card-foot">
          <span className={`tm-card-price${row.tier === "free" ? " free" : ""}`}>
            {inr(row.price_paise)}
          </span>
          <div className="tm-card-acts">
            <button
              className="dx-editbtn"
              onClick={doToggle}
              disabled={toggling}
              title={row.status === "published" ? "Unpublish" : "Publish"}
            >
              {toggling ? "…" : row.status === "published" ? "Unpublish" : "Publish"}
            </button>
            <button className="dx-editbtn" onClick={onEdit}>Edit</button>
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

type Props = { rows: TemplateRow[]; migrationMissing: boolean };

export default function TemplatesManager({ rows, migrationMissing }: Props) {
  const [editRow, setEditRow] = useState<TemplateRow | "new" | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const filtered = filter === "all" ? rows : rows.filter((r) => r.type === filter);

  // KPI counts
  const total = rows.length;
  const published = rows.filter((r) => r.status === "published").length;
  const premium = rows.filter((r) => r.tier === "premium").length;
  const totalSales = rows.reduce((s, r) => s + r.sales_count, 0);

  // Table rows
  const tableRows = filtered.map((r) => [
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
    <span key="sales">{r.sales_count}</span>,
    <span key="acts" style={{ display: "flex", gap: 6, whiteSpace: "nowrap" }}>
      <button className="dx-editbtn" onClick={() => setEditRow(r)}>Edit</button>
    </span>,
  ]);

  return (
    <>
      <style>{css}</style>

      <Phead
        title="Premium templates"
        sub="Manage the template catalog that sellers browse and purchase in the marketplace."
        action={<button className="btn grad" onClick={() => setEditRow("new")}>+ New template</button>}
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
      ]} />

      {/* filter + view toggle */}
      <div className="tm-filter-bar">
        <span
          className={`dx-fchip${filter === "all" ? " on" : ""}`}
          onClick={() => setFilter("all")}
        >All</span>
        {PAGE_TYPES.map((t) => (
          <span
            key={t}
            className={`dx-fchip${filter === t ? " on" : ""}`}
            onClick={() => setFilter(t)}
          >{TYPE_LABELS[t]}</span>
        ))}
        <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button
            className={`dx-editbtn${viewMode === "grid" ? "" : ""}`}
            style={{ fontWeight: viewMode === "grid" ? 700 : 400 }}
            onClick={() => setViewMode("grid")}
          >Grid</button>
          <button
            className="dx-editbtn"
            style={{ fontWeight: viewMode === "table" ? 700 : 400 }}
            onClick={() => setViewMode("table")}
          >Table</button>
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
            <button className="btn grad" onClick={() => setEditRow("new")}>+ New template</button>
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
            <GridCard key={r.id} row={r} onEdit={() => setEditRow(r)} />
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
