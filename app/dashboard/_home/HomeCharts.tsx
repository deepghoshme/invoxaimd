"use client";

/**
 * HomeCharts — client component for the dashboard home's two chart cards.
 * Receives serialised data from the server component (page.tsx) to avoid
 * passing Date objects across the server/client boundary.
 *
 * Left:  Revenue bar chart (last 7 days, today highlighted with gradient bar)
 * Right: Sales-by-category donut + legend
 */

type BarDay = {
  label: string;
  amount: number;   // paise
  isToday: boolean;
};

type DonutSegment = {
  label: string;
  pct: number;      // 0-100
  color: string;
};

type Props = {
  barDays: BarDay[];
  donutSegments: DonutSegment[];
};

export default function HomeCharts({ barDays, donutSegments }: Props) {
  const maxAmount = Math.max(...barDays.map((d) => d.amount), 1);

  // Build conic-gradient stops for the donut
  let acc = 0;
  const stops = donutSegments
    .map((s) => {
      const from = acc;
      acc += s.pct;
      return `${s.color} ${from}% ${acc}%`;
    })
    .join(", ");

  const totalOrders = donutSegments.reduce((s, seg) => {
    // if placeholder (no orders), pct === 100 but label is "No orders yet"
    return seg.label === "No orders yet" ? s : s + 1;
  }, 0);

  return (
    <div className="dx-grid dx-cols">
      {/* ── Revenue bar chart ─────────────────────────────────────────── */}
      <div className="dx-card">
        <div className="dx-ctitle">
          <h3>Revenue · last 7 days</h3>
        </div>
        <div className="dx-chart">
          {barDays.map((day) => {
            const heightPct = Math.max(
              6,
              Math.round((day.amount / maxAmount) * 100)
            );
            return (
              <div className="col" key={day.label}>
                <div
                  className={`bar${day.isToday ? "" : " dim"}`}
                  style={{ height: `${heightPct}%` }}
                  title={`₹${Math.round(day.amount / 100).toLocaleString("en-IN")}`}
                />
                <span className="lab">{day.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Sales by category donut ───────────────────────────────────── */}
      <div className="dx-card">
        <div className="dx-ctitle">
          <h3>Sales by category</h3>
        </div>
        <div className="dx-donut-row">
          <div
            className="dx-donut"
            style={{ background: `conic-gradient(${stops})` }}
          >
            <div className="ctr">
              <b>{totalOrders > 0 ? totalOrders : "—"}</b>
              <span>orders</span>
            </div>
          </div>
          <div className="dx-legend">
            {donutSegments.map((s) => (
              <span key={s.label}>
                <span className="dx-lk" style={{ background: s.color }} />
                {s.label}
                {s.label !== "No orders yet" ? ` · ${s.pct}%` : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
