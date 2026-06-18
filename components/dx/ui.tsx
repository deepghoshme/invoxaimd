import Icon from "./Icon";

export function Phead({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="dx-phead">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export type Kpi = { icon: string; color: string; label: string; value: string; delta?: string; down?: boolean };
export function Kpis({ items }: { items: Kpi[] }) {
  return (
    <div className="dx-grid dx-kpis">
      {items.map((k, i) => (
        <div className="dx-card dx-kpi" key={i}>
          <div className="ic" style={{ background: `color-mix(in srgb, ${k.color} 14%, transparent)`, color: k.color }}>
            <Icon name={k.icon} size={18} />
          </div>
          <div className="lbl">{k.label}</div>
          <div className="val">{k.value}</div>
          {k.delta && <div className={`dx-delta ${k.down ? "dx-down" : "dx-up"}`}>{k.delta}</div>}
        </div>
      ))}
    </div>
  );
}

export function Card({ title, link, children }: { title?: string; link?: string; children: React.ReactNode }) {
  return (
    <div className="dx-card">
      {(title || link) && (
        <div className="dx-ctitle">
          <h3>{title}</h3>
          {link && <a>{link}</a>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Table({ cols, rows, empty = "No data yet" }: { cols: string[]; rows: React.ReactNode[][]; empty?: string }) {
  if (rows.length === 0) {
    return (
      <table>
        <thead><tr>{cols.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
        <tbody><tr><td colSpan={cols.length}><div className="dx-empty">{empty}</div></td></tr></tbody>
      </table>
    );
  }
  return (
    <table>
      <thead>
        <tr>{cols.map((c, i) => <th key={i}>{c}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

export function AreaChart() {
  return (
    <svg viewBox="0 0 600 170" width="100%">
      <defs>
        <linearGradient id="dxag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--primary)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 145 L60 128 120 134 180 100 240 108 300 70 360 82 420 50 480 60 540 32 600 38 L600 170 L0 170 Z" fill="url(#dxag)" />
      <path d="M0 145 L60 128 120 134 180 100 240 108 300 70 360 82 420 50 480 60 540 32 600 38" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Donut({
  segments,
}: {
  segments: { label: string; pct: number; color: string }[];
}) {
  let acc = 0;
  const stops = segments
    .map((s) => {
      const from = acc;
      acc += s.pct;
      return `${s.color} ${from}% ${acc}%`;
    })
    .join(", ");
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <div className="dx-donut" style={{ background: `conic-gradient(${stops})` }} />
      <div className="dx-legend">
        {segments.map((s) => (
          <span key={s.label}>
            <i className="dx-lk" style={{ background: s.color }} />
            {s.label} {s.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

export function Tag({ kind, children }: { kind: "paid" | "pend" | "neu"; children: React.ReactNode }) {
  return <span className={`dx-pilltag t-${kind}`}>{children}</span>;
}
export function Cat({ children }: { children: React.ReactNode }) {
  return <span className="dx-cat">{children}</span>;
}
export function Live({ children = "Live" }: { children?: React.ReactNode }) {
  return <span className="dx-live">{children}</span>;
}
export function Buyer({ emoji, name }: { emoji: string; name: string }) {
  return (
    <span className="dx-tg">
      <span className="dx-sq">{emoji}</span> {name}
    </span>
  );
}

export function Templates({ items }: { items: { name: string; sub: string }[] }) {
  return (
    <div className="dx-grid dx-g3" style={{ gap: 12, marginTop: 4 }}>
      {items.map((t) => (
        <div className="dx-tmpl" key={t.name}>
          <div className="thumb" />
          <div className="mt">
            <b>{t.name}</b>
            <div className="u">{t.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Bars() {
  const d: [string, number, string][] = [
    ["Subs", 92, "var(--primary)"], ["Commission", 66, "var(--secondary)"], ["Overage", 30, "var(--accent)"],
    ["Templates", 42, "var(--gold)"], ["Subdom", 22, "var(--primary)"], ["Domains", 16, "var(--secondary)"],
  ];
  return (
    <svg viewBox="0 0 600 172" width="100%">
      {d.map((x, i) => {
        const bh = (x[1] / 100) * 125, px = 18 + i * 96, py = 145 - bh;
        return (
          <g key={i}>
            <rect x={px} y={py} width="62" height={bh} rx="7" fill={x[2]} />
            <text x={px + 31} y="163" textAnchor="middle" fontSize="11" fill="var(--muted)">{x[0]}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart() {
  return (
    <svg viewBox="0 0 300 120" width="100%">
      <path d="M0 100 L50 88 100 92 150 70 200 56 250 40 300 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="300" cy="24" r="3.5" fill="var(--primary)" />
    </svg>
  );
}

/** Generic "manage page-type" view: header + KPIs + table + templates. */
export function PageType({
  title, sub, kpis, cols, rows, templates = [{ name: "Aurora", sub: "Premium template" }, { name: "Sunset", sub: "Premium template" }, { name: "Bloom", sub: "Premium template" }],
}: {
  title: string; sub: string; kpis: Kpi[]; cols: string[]; rows: React.ReactNode[][]; templates?: { name: string; sub: string }[];
}) {
  return (
    <>
      <Phead title={title} sub={sub} action={<button className="btn grad">+ Create</button>} />
      <Kpis items={kpis} />
      <Card title={`Your ${title.toLowerCase()}`} link="Manage">
        <Table cols={cols} rows={rows} />
      </Card>
      <div style={{ height: 16 }} />
      <Card title="Templates" link="Browse all">
        <Templates items={templates} />
      </Card>
    </>
  );
}

/** Placeholder page for nav items whose backend isn't built yet. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <Phead title={title} sub="This section is part of the new dashboard build — coming soon." />
      <Card>
        <p className="dx-muted">
          The <strong>{title}</strong> screen is designed and scheduled. Data wiring is in progress.
        </p>
      </Card>
    </>
  );
}
