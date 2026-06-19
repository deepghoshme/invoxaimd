"use client";
import { useState, useEffect, useRef } from "react";
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

/**
 * AreaChart — accepts an optional `points` array of numbers (one per x-bucket).
 * Falls back to a static demo curve when no points are provided.
 * The chart fills the full SVG width (600 × 170) with a 10px vertical pad.
 */
export function AreaChart({
  points,
  money = false,
}: { points?: number[]; money?: boolean } = {}) {
  // Y-axis tick formatter. `money` treats point values as paise → compact ₹.
  const format = (n: number): string => {
    if (money) {
      const r = n / 100;
      if (r >= 100000) return "₹" + (r / 100000).toFixed(1) + "L";
      if (r >= 1000) return "₹" + (r / 1000).toFixed(1) + "k";
      return "₹" + Math.round(r);
    }
    return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${Math.round(n)}`;
  };
  const W = 600, H = 170, PAD_T = 10, PAD_B = 20;
  const chartH = H - PAD_T - PAD_B; // usable vertical pixels

  // Static demo path used when no real data is available.
  const DEMO_LINE = "M0 145 L60 128 120 134 180 100 240 108 300 70 360 82 420 50 480 60 540 32 600 38";
  const DEMO_AREA = `${DEMO_LINE} L600 170 L0 170 Z`;

  let linePath = DEMO_LINE;
  let areaPath = DEMO_AREA;
  let maxVal = 0;
  const hasData = !!(points && points.length >= 2);

  if (hasData) {
    maxVal = Math.max(...points!, 1);
    const step = W / (points!.length - 1);
    const coords = points!.map((v, i) => {
      const x = Math.round(i * step);
      const y = Math.round(PAD_T + chartH - (v / maxVal) * chartH);
      return `${x} ${y}`;
    });
    linePath = `M${coords.join(" L")}`;
    areaPath = `${linePath} L${W} ${H} L0 ${H} Z`;
  }

  const svg = (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      <defs>
        <linearGradient id="dxag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--primary)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* faint Y gridlines at max / mid / zero — only when real data is plotted */}
      {hasData &&
        [0, 0.5, 1].map((f) => {
          const y = PAD_T + chartH * f;
          return (
            <line key={f} x1={0} y1={y} x2={W} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" opacity="0.7" />
          );
        })}
      <path d={areaPath} fill="url(#dxag)" />
      <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  // No real data → keep the bare demo curve (no axis to mislabel).
  if (!hasData) return svg;

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          textAlign: "right",
          fontSize: 10.5,
          lineHeight: 1,
          color: "var(--muted)",
          paddingTop: 2,
          paddingBottom: PAD_B,
          minWidth: 30,
        }}
      >
        <span>{format(maxVal)}</span>
        <span>{format(maxVal / 2)}</span>
        <span>{format(0)}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{svg}</div>
    </div>
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

export function Templates({ items }: { items: { name: string; sub: string; grad?: string }[] }) {
  return (
    <div className="dx-grid dx-g3" style={{ gap: 12, marginTop: 4 }}>
      {items.map((t) => (
        <div className="dx-tmpl" key={t.name}>
          <div className="thumb" style={t.grad ? { backgroundImage: t.grad } : undefined} />
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
  title: string; sub: string; kpis: Kpi[]; cols: string[]; rows: React.ReactNode[][]; templates?: { name: string; sub: string; grad?: string }[];
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

/* =================================================================
   Design System components — Sunset/Twilight spec
   ================================================================= */

/**
 * Switch — 50×28 gradient toggle (design spec).
 * Controlled: pass `on` + `onChange`.
 * Uncontrolled: pass no props (internal state).
 */
export function Switch({
  on,
  onChange,
  disabled,
  label,
}: {
  on?: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [internal, setInternal] = useState(false);
  const controlled = on !== undefined;
  const isOn = controlled ? on : internal;
  const toggle = () => {
    if (disabled) return;
    const next = !isOn;
    if (!controlled) setInternal(next);
    onChange?.(next);
  };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        disabled={disabled}
        onClick={toggle}
        className={`switch${isOn ? " on" : ""}`}
      >
        <span className="switch-knob" />
      </button>
      {label && <span style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>}
    </span>
  );
}

/**
 * Segment — pill segmented control.
 * options: array of { value, label }
 */
export function Segment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segment">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={value === o.value ? "on" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * ChipToggle — section toggle chip used in builders.
 */
export function ChipToggle({
  on,
  children,
  onChange,
}: {
  on?: boolean;
  children: React.ReactNode;
  onChange?: (v: boolean) => void;
}) {
  const [internal, setInternal] = useState(!!on);
  const controlled = on !== undefined;
  const isOn = controlled ? on : internal;
  return (
    <div
      className={`chip-toggle${isOn ? " on" : ""}`}
      onClick={() => {
        const next = !isOn;
        if (!controlled) setInternal(next);
        onChange?.(next);
      }}
    >
      {children}
    </div>
  );
}

/** Alert — ok or error inline feedback. */
export function Alert({
  kind,
  children,
}: {
  kind: "ok" | "error";
  children: React.ReactNode;
}) {
  return <div className={`alert alert-${kind}`}>{children}</div>;
}

/** BadgePill — status / transaction / category / trust badges. */
export function BadgePill({
  kind,
  children,
}: {
  kind: "live" | "draft" | "paid" | "pend" | "neu";
  children: React.ReactNode;
}) {
  const cls = kind === "live" ? "is-live" : kind === "draft" ? "is-draft" : `t-${kind}`;
  return <span className={`badge-pill ${cls}`}>{children}</span>;
}

/** KpiCard — standalone KPI card outside .dx context. */
export function KpiCard({
  icon,
  label,
  value,
  delta,
  down,
  iconBg = "var(--brand-gradient)",
}: {
  icon: string;
  label: string;
  value: string;
  delta?: string;
  down?: boolean;
  iconBg?: string;
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-ic" style={{ background: iconBg }}>
        {icon}
      </div>
      <div className="kpi-lbl">{label}</div>
      <div className="kpi-val">{value}</div>
      {delta && (
        <div className={`kpi-delta ${down ? "kpi-down" : "kpi-up"}`}>
          {down ? "▼" : "▲"} {delta}
        </div>
      )}
    </div>
  );
}

/** PlanCard — with optional ribbon and featured border/shadow. */
export function PlanCard({
  name,
  price,
  period,
  ribbon,
  featured,
  features,
  action,
}: {
  name: string;
  price: string;
  period?: string;
  ribbon?: string;
  featured?: boolean;
  features: string[];
  action: React.ReactNode;
}) {
  return (
    <div className={`plan-card${featured ? " featured" : ""}`}>
      {ribbon && <span className="plan-ribbon">{ribbon}</span>}
      <div className="plan-name">{name}</div>
      <div className="plan-price">
        {price}
        {period && <small> {period}</small>}
      </div>
      <ul>
        {features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      {action}
    </div>
  );
}

/**
 * Countdown — live countdown timer.
 * Pass `targetMs` (Date.now() + ms) or `seconds` (total seconds to count down).
 */
export function Countdown({
  seconds: initSec = 0,
  targetMs,
  label = "Offer ends in",
}: {
  seconds?: number;
  targetMs?: number;
  label?: string;
}) {
  const [t, setT] = useState(() =>
    targetMs ? Math.max(0, Math.floor((targetMs - Date.now()) / 1000)) : initSec
  );
  useEffect(() => {
    const iv = setInterval(() => {
      setT((prev) => {
        if (targetMs) return Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
        return prev > 0 ? prev - 1 : 0;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [targetMs]);
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return (
    <div className="ds-cd">
      <span className="ds-cd-title">⏳ {label}</span>
      <div className="ds-cd-row">
        {h > 0 && (
          <div className="ds-cd-box">
            <span className="ds-cd-num">{pad(h)}</span>
            <span className="ds-cd-lbl">Hrs</span>
          </div>
        )}
        <div className="ds-cd-box">
          <span className="ds-cd-num">{pad(m)}</span>
          <span className="ds-cd-lbl">Min</span>
        </div>
        <div className="ds-cd-box">
          <span className="ds-cd-num">{pad(s)}</span>
          <span className="ds-cd-lbl">Sec</span>
        </div>
      </div>
    </div>
  );
}

/** SeatBar — seat scarcity progress bar. */
export function SeatBar({
  total,
  remaining,
  label,
}: {
  total: number;
  remaining: number;
  label?: string;
}) {
  const pct = Math.round(((total - remaining) / total) * 100);
  const hint = label ?? `🔥 Only ${remaining} of ${total} seats left`;
  return (
    <div className="ds-seats">
      <span className="ds-seats-lab">{hint}</span>
      <div className="ds-seats-bar">
        <div className="ds-seats-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** LiveProof — inline social-proof widget (non-fixed variant). */
export function LiveProof({
  name,
  sub,
}: {
  name: string;
  sub?: string;
}) {
  return (
    <div className="ds-liveproof">
      <span className="ds-lp-dot" />
      <div>
        <b>{name}</b>
        {sub && <div className="ds-lp-sub">{sub}</div>}
      </div>
    </div>
  );
}

/**
 * BuyBar — sticky design-system buy bar (not fixed; wrap in your own
 * position:fixed or position:sticky container as needed).
 */
export function BuyBar({
  price,
  wasPrice,
  offLabel,
  caption,
  ctaLabel = "Buy now →",
  onBuy,
  disabled,
}: {
  price: string;
  wasPrice?: string;
  offLabel?: string;
  caption?: string;
  ctaLabel?: string;
  onBuy?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="buybar">
      <div className="buybar-price">
        <div className="bb-row">
          <span className="bb-now">{price}</span>
          {wasPrice && <span className="bb-was">{wasPrice}</span>}
          {offLabel && <span className="bb-off">{offLabel}</span>}
        </div>
        {caption && <div className="bb-cap">{caption}</div>}
      </div>
      <button
        type="button"
        className="buybar-btn"
        onClick={onBuy}
        disabled={disabled}
      >
        {ctaLabel}
      </button>
    </div>
  );
}

/** BrandBadge — "Built with invoxai" chip. */
export function BrandBadge({ href = "https://invoxai.io" }: { href?: string }) {
  return (
    <a className="brand-badge" href={href} target="_blank" rel="noopener noreferrer">
      <span className="brand-badge-mark" />
      <span className="brand-badge-prefix">Built with</span>
      <span className="brand-badge-text">invoxai</span>
    </a>
  );
}

/** ProgressSteps — dot-bar step indicator. */
export function ProgressSteps({
  total,
  current,
}: {
  total: number;
  current: number; /* 1-based */
}) {
  return (
    <div className="ds-steps">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`ds-step-dot${i < current ? " active" : ""}`}
        />
      ))}
    </div>
  );
}

/**
 * AuroraBackground — animated blob background.
 * Wrap page sections that need the aurora effect.
 * Children render above it (z-index: 1).
 */
export function AuroraBackground({
  children,
  className = "",
  style,
}: {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ position: "relative", overflow: "hidden", ...style }} className={className}>
      <div className="ds-aurora-wrap">
        <div className="ds-blob b1" />
        <div className="ds-blob b2" />
        <div className="ds-blob b3" />
        <div className="ds-blob b4" />
      </div>
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

/**
 * RevealOnScroll — wraps children in .reveal; adds .revealed when visible.
 * Requires IntersectionObserver (all modern browsers).
 */
export function RevealOnScroll({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number; /* ms */
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => el.classList.add("revealed"), delay);
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return (
    <div ref={ref} className="reveal">
      {children}
    </div>
  );
}
