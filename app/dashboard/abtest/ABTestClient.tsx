"use client";

import { useState, useTransition, useEffect } from "react";
import { updateSplit, declareWinner, createTest } from "./actions";

/* ── types ──────────────────────────────────────────────── */
export type Variant = {
  id: string;
  key: "A" | "B";
  headline: string;
  visitors: number;
  conversions: number;
  revenue_paise: number;
};

export type ABTest = {
  id: string;
  name: string;
  status: "running" | "done" | "paused";
  traffic_split: number;
  winner: "A" | "B" | null;
  created_at: string;
  ended_at: string | null;
  page_id: string | null;
  variants: Variant[];
};

/* ── stats helpers ──────────────────────────────────────── */
/**
 * Two-proportion z-test.
 * Returns { uplift, confidence } as percentages (0–100), or null when data
 * is insufficient (fewer than 30 visitors or zero conversions in either arm).
 */
function computeStats(
  a: Variant,
  b: Variant
): { uplift: number; confidence: number; leader: "A" | "B" | null } | null {
  if (a.visitors < 30 || b.visitors < 30) return null;
  const pA = a.conversions / a.visitors;
  const pB = b.conversions / b.visitors;
  if (pA === 0 && pB === 0) return null;

  const leader: "A" | "B" | null =
    pA === pB ? null : pB > pA ? "B" : "A";

  const uplift =
    pA > 0 ? Math.round(((pB - pA) / pA) * 100) : pB > 0 ? 100 : 0;

  // pooled proportion z-test
  const n1 = a.visitors,
    n2 = b.visitors,
    x1 = a.conversions,
    x2 = b.conversions;
  const p = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (se === 0) return null;
  const z = Math.abs((pA - pB) / se);
  // approximate normal CDF → confidence
  const erf = (x: number) => {
    const t = 1 / (1 + 0.3275911 * x);
    return (
      1 -
      (0.254829592 * t -
        0.284496736 * t * t +
        1.421413741 * t * t * t -
        1.453152027 * t * t * t * t +
        1.061405429 * t * t * t * t * t) *
        Math.exp(-x * x)
    );
  };
  const confidence = Math.min(99, Math.round(erf(z / Math.SQRT2) * 100));

  return { uplift, confidence, leader };
}

function rpv(v: Variant) {
  if (v.visitors === 0) return 0;
  return Math.round(v.revenue_paise / v.visitors / 100); // ₹
}

/* ── gradient helpers ──────────────────────────────────── */
const GRAD_A = "linear-gradient(135deg,#ffb23e,#ff6a3d 60%,#ff4d7d)";
const GRAD_B = "linear-gradient(135deg,#2a6fdb,#7b3fe4 60%,#ff4d7d)";

/* ── sub-components ─────────────────────────────────────── */
function MockPreview({ grad, col }: { grad: string; col: string }) {
  return (
    <div className="ab-mock" style={{ background: grad }}>
      <div className="ab-mock-card">
        <div className="ab-l" style={{ width: "70%" }} />
        <div className="ab-l" style={{ width: "90%" }} />
        <div className="ab-l" style={{ width: "55%" }} />
        <div className="ab-mock-btn" style={{ background: col }} />
      </div>
    </div>
  );
}

function VariantCard({
  v,
  isWinner,
  isLeader,
}: {
  v: Variant;
  isWinner: boolean;
  isLeader: boolean;
}) {
  const pct =
    v.visitors > 0
      ? ((v.conversions / v.visitors) * 100).toFixed(1) + "%"
      : "—";
  const isA = v.key === "A";
  const col = isA ? "var(--ab-primary)" : "var(--ab-blue)";
  return (
    <div
      className={`ab-v ab-v-${v.key.toLowerCase()}${isWinner || isLeader ? " ab-win" : ""}`}
    >
      <div className="ab-vh">
        <span className="ab-tag" style={{ background: col }}>
          {v.key}
        </span>
        <span className="ab-vt">{v.headline || `Variant ${v.key}`}</span>
        {isLeader && !isWinner && (
          <span className="ab-wb">Leading</span>
        )}
        {isWinner && <span className="ab-wb">Winner</span>}
      </div>
      <MockPreview
        grad={isA ? GRAD_A : GRAD_B}
        col={isA ? "#ff6a3d" : "#2a6fdb"}
      />
      <div className="ab-stat">
        <div>
          <div
            className="ab-sv"
            style={isLeader || isWinner ? { color: "var(--ab-green)" } : {}}
          >
            {pct}
          </div>
          <div className="ab-sl">conversion</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="ab-sv">{v.visitors.toLocaleString("en-IN")}</div>
          <div className="ab-sl">visitors</div>
        </div>
      </div>
    </div>
  );
}

function ResultCol({ v, max, col }: { v: Variant; max: number; col: string }) {
  const convPct =
    v.visitors > 0 ? (v.conversions / v.visitors) * 100 : 0;
  const revVisitor = rpv(v);
  const barConv = max > 0 ? (convPct / max) * 100 : 0;
  return (
    <div className="ab-rcol">
      <div className="ab-rh">
        <span className="ab-rd" style={{ background: col }} />
        Variant {v.key}
      </div>
      <div className="ab-metric">
        <div className="ab-mtop">
          <span>Conversion</span>
          <span className="ab-mv">{convPct.toFixed(1)}%</span>
        </div>
        <div className="ab-track">
          <div
            className="ab-fill"
            style={{ width: `${barConv}%`, background: col }}
          />
        </div>
      </div>
      <div className="ab-metric">
        <div className="ab-mtop">
          <span>Revenue / visitor</span>
          <span className="ab-mv">₹{revVisitor}</span>
        </div>
        <div className="ab-track">
          <div
            className="ab-fill"
            style={{
              width: `${max > 0 ? Math.min(100, (revVisitor / (max * 2)) * 100) : 0}%`,
              background: col,
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Create modal ───────────────────────────────────────── */
function CreateModal({
  storeId,
  onClose,
  onCreated,
}: {
  storeId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [hlA, setHlA] = useState("");
  const [hlB, setHlB] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !hlA.trim() || !hlB.trim()) {
      setErr("All fields are required.");
      return;
    }
    start(async () => {
      const res = await createTest(storeId, name, hlA, hlB);
      if (res.error) {
        setErr(res.error);
      } else {
        onCreated();
        onClose();
      }
    });
  }

  return (
    <div className="ab-overlay">
      <div className="ab-modal">
        <div className="ab-modal-head">
          <b>New A/B test</b>
          <button className="ab-x" onClick={onClose}>
            ✕
          </button>
        </div>
        <form onSubmit={submit}>
          <label className="ab-lbl">Test name</label>
          <input
            className="ab-inp"
            placeholder="e.g. Mixing Masterclass headlines"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="ab-lbl">Variant A headline</label>
          <input
            className="ab-inp"
            placeholder="e.g. Mix like a pro in 12 lessons"
            value={hlA}
            onChange={(e) => setHlA(e.target.value)}
          />
          <label className="ab-lbl">Variant B headline</label>
          <input
            className="ab-inp"
            placeholder="e.g. Finish release-ready mixes this weekend"
            value={hlB}
            onChange={(e) => setHlB(e.target.value)}
          />
          {err && <div className="ab-ferr">{err}</div>}
          <div className="ab-modal-foot">
            <button
              type="button"
              className="ab-btn-ghost"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="ab-btn-primary"
              disabled={pending}
            >
              {pending ? "Creating…" : "Create test"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Detail view ────────────────────────────────────────── */
function TestDetail({
  test,
  onBack,
  onRefresh,
}: {
  test: ABTest;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const [split, setSplit] = useState(test.traffic_split);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const varA = test.variants.find((v) => v.key === "A");
  const varB = test.variants.find((v) => v.key === "B");

  const stats =
    varA && varB ? computeStats(varA, varB) : null;

  const leaderKey = stats?.leader ?? null;
  const winnerKey = test.winner;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  function handleSplitChange(v: number) {
    setSplit(v);
  }

  function handleSplitCommit(v: number) {
    start(async () => {
      await updateSplit(test.id, v);
    });
  }

  function handleDeclare(key: "A" | "B") {
    start(async () => {
      await declareWinner(test.id, key);
      showToast(`Variant ${key} is now live for 100% of traffic`);
      setTimeout(() => onRefresh(), 300);
    });
  }

  const maxConvPct =
    varA && varB
      ? Math.max(
          varA.visitors > 0 ? (varA.conversions / varA.visitors) * 100 : 0,
          varB.visitors > 0 ? (varB.conversions / varB.visitors) * 100 : 0
        )
      : 0;

  const daysSince = Math.floor(
    (Date.now() - new Date(test.created_at).getTime()) / 86_400_000
  );

  return (
    <div className="ab-detail">
      {/* page header */}
      <div className="ab-phead">
        <div>
          <div className="ab-back" onClick={onBack}>
            ← All tests
          </div>
          <h1 className="ab-h1">A/B test · {test.name}</h1>
          <p className="ab-sub">
            Day {daysSince} of test
            {test.page_id ? ` · page attached` : ""}
          </p>
        </div>
        <span
          className={`ab-run ${test.status === "running" ? "ab-live" : test.status === "done" ? "ab-done" : "ab-paused"}`}
        >
          {test.status === "running"
            ? "Running"
            : test.status === "done"
              ? "Done"
              : "Paused"}
        </span>
      </div>

      {/* variants */}
      <div className="ab-card">
        <h3 className="ab-ct">Variants</h3>
        <div className="ab-variants">
          {varA && (
            <VariantCard
              v={varA}
              isWinner={winnerKey === "A"}
              isLeader={leaderKey === "A"}
            />
          )}
          {varB && (
            <VariantCard
              v={varB}
              isWinner={winnerKey === "B"}
              isLeader={leaderKey === "B"}
            />
          )}
        </div>
      </div>

      {/* traffic split */}
      <div className="ab-card">
        <h3 className="ab-ct">Traffic split</h3>
        <div className="ab-split">
          <div className="ab-split-top">
            <b style={{ color: "var(--ab-primary)" }}>
              Variant A · {split}%
            </b>
            <b style={{ color: "var(--ab-blue)" }}>
              Variant B · {100 - split}%
            </b>
          </div>
          <div className="ab-bar">
            <div
              className="ab-pa"
              style={{ width: `${split}%` }}
            >
              A
            </div>
            <div
              className="ab-pb"
              style={{ width: `${100 - split}%` }}
            >
              B
            </div>
          </div>
          {test.status === "running" && (
            <input
              className="ab-range"
              type="range"
              min={10}
              max={90}
              value={split}
              onChange={(e) => handleSplitChange(Number(e.target.value))}
              onMouseUp={(e) =>
                handleSplitCommit(Number((e.target as HTMLInputElement).value))
              }
              onTouchEnd={(e) =>
                handleSplitCommit(Number((e.target as HTMLInputElement).value))
              }
            />
          )}
        </div>
      </div>

      {/* results */}
      {varA && varB && (varA.visitors > 0 || varB.visitors > 0) ? (
        <div className="ab-card">
          <h3 className="ab-ct">Results</h3>
          <div className="ab-res">
            <ResultCol
              v={varA}
              max={maxConvPct}
              col="var(--ab-primary)"
            />
            <ResultCol
              v={varB}
              max={maxConvPct}
              col="var(--ab-blue)"
            />
          </div>
        </div>
      ) : (
        <div className="ab-card ab-no-data">
          <span style={{ fontSize: 28 }}>📊</span>
          <p>No visitor data yet — results will appear once traffic flows to this test.</p>
        </div>
      )}

      {/* verdict + declare winner */}
      {stats && leaderKey && test.status === "running" && (
        <div className="ab-verdict">
          <span className="ab-e">🏆</span>
          <div>
            <b>
              Variant {leaderKey} is winning by {Math.abs(stats.uplift)}%
            </b>
            <p>
              {stats.confidence}% statistical confidence
              {varA && varB
                ? ` · est. +₹${Math.abs(rpv(varB) - rpv(varA))} RPV`
                : ""}
            </p>
          </div>
          {!winnerKey && (
            <button
              className="ab-win-btn"
              disabled={pending}
              onClick={() => handleDeclare(leaderKey)}
            >
              Make {leaderKey} the winner
            </button>
          )}
        </div>
      )}
      {stats && !leaderKey && (
        <div className="ab-verdict ab-verdict-tie">
          <span className="ab-e">⚖️</span>
          <div>
            <b>Too close to call</b>
            <p>
              {stats.confidence}% confidence — keep running for more data.
            </p>
          </div>
        </div>
      )}
      {!stats && varA && varB && (varA.visitors + varB.visitors >= 1) && (
        <div className="ab-verdict ab-verdict-insuf">
          <span className="ab-e">⏳</span>
          <div>
            <b>Not enough data yet</b>
            <p>Need at least 30 visitors per variant for a valid result.</p>
          </div>
        </div>
      )}

      {/* toast */}
      {toast && (
        <div className="ab-toastbox">
          <span className="ab-tdot" />
          {toast}
        </div>
      )}
    </div>
  );
}

/* ── List view ──────────────────────────────────────────── */
function TestList({
  tests,
  onSelect,
  onNew,
}: {
  tests: ABTest[];
  onSelect: (t: ABTest) => void;
  onNew: () => void;
}) {
  return (
    <div>
      <div className="ab-phead">
        {/* Title/subtitle come from the page-level header (Phead); this bar
            only carries the primary action to avoid a duplicate heading. */}
        <div />
        <button className="ab-btn-primary" onClick={onNew}>
          + New test
        </button>
      </div>

      {tests.length === 0 ? (
        <div className="ab-empty-state">
          <div className="ab-empty-icon">🧪</div>
          <h3>No A/B tests yet</h3>
          <p>Create your first test to start optimising conversions.</p>
          <button className="ab-btn-primary" onClick={onNew}>
            Create test
          </button>
        </div>
      ) : (
        <div className="ab-test-list">
          {tests.map((t) => {
            const a = t.variants.find((v) => v.key === "A");
            const b = t.variants.find((v) => v.key === "B");
            const stats = a && b ? computeStats(a, b) : null;
            const totalVisitors = (a?.visitors ?? 0) + (b?.visitors ?? 0);
            return (
              <div
                key={t.id}
                className="ab-test-row"
                onClick={() => onSelect(t)}
              >
                <div className="ab-tr-left">
                  <div className="ab-tr-name">{t.name}</div>
                  <div className="ab-tr-sub">
                    {totalVisitors.toLocaleString("en-IN")} visitors ·{" "}
                    {new Date(t.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                </div>
                <div className="ab-tr-right">
                  {stats?.leader && (
                    <span className="ab-tr-leader">
                      Variant {stats.leader} leading
                    </span>
                  )}
                  <span
                    className={`ab-run ${t.status === "running" ? "ab-live" : t.status === "done" ? "ab-done" : "ab-paused"}`}
                  >
                    {t.status}
                  </span>
                  <span className="ab-tr-arrow">→</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* suggest more */}
      <div className="ab-suggest">
        <div className="ab-suggest-icon">💡</div>
        <div>
          <b>Ideas to test next</b>
          <ul className="ab-suggest-list">
            <li>Headline urgency vs benefit-led</li>
            <li>Price anchor with strikethrough vs plain price</li>
            <li>CTA "Buy now" vs "Start learning today"</li>
            <li>Social proof above vs below the fold</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ── Root client component ──────────────────────────────── */
export default function ABTestClient({
  storeId,
  initial,
  migrationPending,
}: {
  storeId: string;
  initial: ABTest[];
  migrationPending: boolean;
}) {
  const [tests, setTests] = useState<ABTest[]>(initial);
  const [selected, setSelected] = useState<ABTest | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [, start] = useTransition();

  // keep detail view in sync when list refreshes
  useEffect(() => {
    if (selected) {
      const updated = tests.find((t) => t.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [tests]);

  async function refresh() {
    const res = await fetch(`/dashboard/abtest/api?storeId=${storeId}`);
    if (res.ok) {
      const data = await res.json();
      setTests(data);
    }
  }

  if (migrationPending) {
    return (
      <div className="ab-wrap">
        <div className="ab-pending-card">
          <div style={{ fontSize: 32 }}>🔧</div>
          <h3>Migration required</h3>
          <p>
            The A/B test tables do not exist yet. Apply the migration to enable
            this feature:
          </p>
          <code className="ab-code">
            node scripts/db-apply.mjs
            supabase/migrations/20260618240000_ab_tests.sql
          </code>
          <p className="ab-muted">
            After applying, reload this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ab-wrap">
      <style>{`
        .ab-wrap {
          --ab-primary: #ff6a3d;
          --ab-blue: #2a6fdb;
          --ab-green: #1fb57a;
          --ab-green-bg: rgba(31,181,122,.12);
          --ab-green-border: rgba(31,181,122,.3);
          --ab-gold: #ffb23e;
          --ab-accent: #7b3fe4;
          .dx.dark & {
            --ab-primary: #ff7e55;
            --ab-blue: #5b8def;
            --ab-green: #36c98e;
            --ab-green-bg: rgba(54,201,142,.10);
            --ab-green-border: rgba(54,201,142,.28);
          }
        }
        /* cards */
        .ab-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 20px;
          box-shadow: var(--shadow);
          margin-bottom: 16px;
        }
        .ab-ct {
          font-size: 15px;
          font-family: var(--font-sora, "Sora", sans-serif);
          letter-spacing: -.01em;
          margin: 0 0 14px;
        }
        /* page header */
        .ab-phead {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }
        .ab-h1 {
          font-size: 22px;
          font-family: var(--font-sora, "Sora", sans-serif);
          letter-spacing: -.02em;
          margin: 0 0 3px;
        }
        .ab-sub { color: var(--muted); font-size: 13.5px; margin: 0; }
        .ab-back {
          font-size: 13px;
          color: var(--muted);
          cursor: pointer;
          margin-bottom: 6px;
        }
        .ab-back:hover { color: var(--text); }
        /* status badges */
        .ab-run {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 12.5px;
          font-weight: 700;
          padding: 8px 14px;
          border-radius: 999px;
          white-space: nowrap;
        }
        .ab-live { background: var(--ab-green-bg); color: var(--ab-green); }
        .ab-live::before {
          content: "";
          width: 8px; height: 8px;
          border-radius: 50%;
          background: var(--ab-green);
        }
        .ab-done { background: rgba(122,103,112,.12); color: var(--muted); }
        .ab-paused { background: rgba(255,106,61,.12); color: var(--ab-primary); }
        /* variants */
        .ab-variants {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        @media (max-width: 640px) {
          .ab-variants, .ab-res { grid-template-columns: 1fr; }
        }
        .ab-v {
          border: 1.5px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
        }
        .ab-win { border-color: var(--ab-green); }
        .ab-vh {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 14px;
          border-bottom: 1px solid var(--border);
        }
        .ab-tag {
          font-family: var(--font-sora, "Sora", sans-serif);
          font-weight: 800;
          font-size: 13px;
          width: 26px; height: 26px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          color: #fff;
          flex: none;
        }
        .ab-vt { font-weight: 600; font-size: 13px; flex: 1; min-width: 0; }
        .ab-wb {
          font-size: 10px;
          font-weight: 800;
          color: var(--ab-green);
          background: var(--ab-green-bg);
          padding: 3px 8px;
          border-radius: 99px;
          white-space: nowrap;
        }
        /* mock preview */
        .ab-mock {
          aspect-ratio: 16/10;
          position: relative;
          display: grid;
          place-items: center;
        }
        .ab-mock-card {
          position: absolute;
          inset: 14px;
          background: rgba(255,255,255,.94);
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 14px;
        }
        .ab-l {
          height: 5px;
          border-radius: 3px;
          background: rgba(43,27,46,.16);
        }
        .ab-mock-btn {
          margin-top: auto;
          height: 14px;
          width: 50%;
          border-radius: 5px;
        }
        .ab-stat {
          display: flex;
          justify-content: space-between;
          padding: 12px 14px;
          border-top: 1px solid var(--border);
        }
        .ab-sv {
          font-family: var(--font-sora, "Sora", sans-serif);
          font-weight: 800;
          font-size: 20px;
        }
        .ab-sl { font-size: 11px; color: var(--muted); }
        /* traffic split */
        .ab-split-top {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          margin-bottom: 8px;
        }
        .ab-split-top b { font-weight: 700; }
        .ab-bar {
          height: 30px;
          border-radius: 9px;
          overflow: hidden;
          display: flex;
        }
        .ab-pa, .ab-pb {
          display: grid;
          place-items: center;
          color: #fff;
          font-size: 12px;
          font-weight: 700;
          transition: width .25s ease;
        }
        .ab-pa { background: var(--ab-primary); }
        .ab-pb { background: var(--ab-blue); }
        .ab-range {
          width: 100%;
          margin-top: 14px;
          accent-color: var(--ab-primary);
          cursor: pointer;
        }
        /* results */
        .ab-res {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .ab-rh {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 10px;
        }
        .ab-rd { width: 12px; height: 12px; border-radius: 4px; flex: none; }
        .ab-metric { margin-bottom: 11px; }
        .ab-mtop {
          display: flex;
          justify-content: space-between;
          font-size: 12.5px;
          margin-bottom: 5px;
        }
        .ab-mv { font-weight: 700; }
        .ab-track {
          height: 8px;
          border-radius: 999px;
          background: var(--surface2);
          overflow: hidden;
        }
        .ab-fill {
          height: 100%;
          border-radius: 999px;
          transition: width .5s ease;
        }
        /* verdict */
        .ab-verdict {
          display: flex;
          align-items: center;
          gap: 12px;
          background: var(--ab-green-bg);
          border: 1px solid var(--ab-green-border);
          border-radius: 14px;
          padding: 16px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        .ab-verdict-tie {
          background: rgba(255,178,62,.10);
          border-color: rgba(255,178,62,.30);
        }
        .ab-verdict-insuf {
          background: rgba(122,103,112,.08);
          border-color: var(--border);
        }
        .ab-e { font-size: 26px; }
        .ab-verdict b { font-size: 14.5px; }
        .ab-verdict p { font-size: 12.5px; color: var(--muted); margin: 2px 0 0; }
        .ab-win-btn {
          margin-left: auto;
          background: var(--ab-green);
          color: #fff;
          border: 0;
          border-radius: 11px;
          padding: 11px 18px;
          font-family: var(--font-sora, "Sora", sans-serif);
          font-weight: 700;
          font-size: 13.5px;
          cursor: pointer;
          white-space: nowrap;
        }
        .ab-win-btn:disabled { opacity: .6; cursor: not-allowed; }
        /* toast */
        .ab-toastbox {
          position: fixed;
          left: 50%;
          bottom: 24px;
          z-index: 60;
          transform: translateX(-50%);
          background: #18121f;
          color: #fff;
          padding: 12px 20px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          box-shadow: 0 20px 50px -20px rgba(0,0,0,.6);
          display: flex;
          align-items: center;
          gap: 9px;
          animation: ab-toast .4s ease;
        }
        .ab-tdot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #36c98e;
        }
        @keyframes ab-toast {
          from { transform: translate(-50%,150%); opacity: 0; }
          to { transform: translate(-50%,0); opacity: 1; }
        }
        /* list */
        .ab-test-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
        .ab-test-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 13px;
          cursor: pointer;
          transition: border-color .15s;
        }
        .ab-test-row:hover { border-color: color-mix(in srgb, var(--ab-primary) 45%, var(--border)); }
        .ab-tr-left { flex: 1; min-width: 0; }
        .ab-tr-name { font-weight: 600; font-size: 14px; }
        .ab-tr-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .ab-tr-right { display: flex; align-items: center; gap: 8px; }
        .ab-tr-leader {
          font-size: 11px;
          font-weight: 700;
          color: var(--ab-green);
          background: var(--ab-green-bg);
          padding: 3px 9px;
          border-radius: 99px;
        }
        .ab-tr-arrow { color: var(--muted); font-size: 14px; }
        /* empty state */
        .ab-empty-state {
          text-align: center;
          padding: 64px 24px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          margin-bottom: 16px;
        }
        .ab-empty-icon { font-size: 40px; margin-bottom: 12px; }
        .ab-empty-state h3 {
          font-family: var(--font-sora, "Sora", sans-serif);
          font-size: 18px;
          margin: 0 0 8px;
        }
        .ab-empty-state p { color: var(--muted); font-size: 13.5px; margin: 0 0 20px; }
        /* no data */
        .ab-no-data {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          text-align: center;
          color: var(--muted);
          font-size: 13.5px;
          padding: 32px 20px;
        }
        /* suggest */
        .ab-suggest {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          padding: 16px 18px;
          background: color-mix(in srgb, var(--ab-accent) 7%, var(--surface));
          border: 1px solid color-mix(in srgb, var(--ab-accent) 20%, var(--border));
          border-radius: 14px;
          margin-top: 8px;
        }
        .ab-suggest-icon { font-size: 22px; flex: none; }
        .ab-suggest b { font-size: 13.5px; display: block; margin-bottom: 6px; }
        .ab-suggest-list {
          margin: 0;
          padding-left: 18px;
          font-size: 12.5px;
          color: var(--muted);
          line-height: 1.8;
        }
        /* migration pending */
        .ab-pending-card {
          text-align: center;
          padding: 64px 24px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          max-width: 560px;
          margin: 0 auto;
        }
        .ab-pending-card h3 {
          font-family: var(--font-sora, "Sora", sans-serif);
          font-size: 18px;
          margin: 12px 0 8px;
        }
        .ab-pending-card p { color: var(--muted); font-size: 13.5px; margin: 0 0 14px; }
        .ab-code {
          display: block;
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 12px;
          font-family: monospace;
          color: var(--text);
          word-break: break-all;
          text-align: left;
          margin-bottom: 14px;
        }
        .ab-muted { color: var(--muted); font-size: 12.5px; margin: 0; }
        /* buttons */
        .ab-btn-primary {
          background: var(--ab-primary);
          color: #fff;
          border: 0;
          border-radius: 10px;
          padding: 9px 15px;
          font: inherit;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          white-space: nowrap;
        }
        .ab-btn-primary:hover { opacity: .9; }
        .ab-btn-primary:disabled { opacity: .6; cursor: not-allowed; }
        .ab-btn-ghost {
          background: var(--surface);
          color: var(--text);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 9px 15px;
          font: inherit;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
        }
        /* modal */
        .ab-overlay {
          position: fixed;
          inset: 0;
          z-index: 80;
          background: rgba(0,0,0,.45);
          display: grid;
          place-items: center;
          padding: 20px;
        }
        .ab-modal {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 24px;
          width: 100%;
          max-width: 440px;
          box-shadow: 0 24px 60px -20px rgba(0,0,0,.45);
        }
        .ab-modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          font-size: 16px;
        }
        .ab-x {
          background: none;
          border: 1px solid var(--border);
          border-radius: 8px;
          width: 28px; height: 28px;
          cursor: pointer;
          color: var(--muted);
          font-size: 13px;
        }
        .ab-lbl {
          display: block;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--muted);
          margin-bottom: 5px;
          margin-top: 14px;
        }
        .ab-inp {
          width: 100%;
          padding: 9px 12px;
          border: 1px solid var(--border);
          border-radius: 9px;
          background: var(--bg);
          color: var(--text);
          font: inherit;
          font-size: 13.5px;
        }
        .ab-inp:focus { outline: 2px solid var(--ab-primary); outline-offset: 1px; }
        .ab-ferr {
          font-size: 12.5px;
          color: var(--red, #e5476f);
          margin-top: 10px;
        }
        .ab-modal-foot {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-top: 20px;
        }
      `}</style>

      {selected ? (
        <TestDetail
          test={selected}
          onBack={() => setSelected(null)}
          onRefresh={async () => {
            await refresh();
          }}
        />
      ) : (
        <TestList
          tests={tests}
          onSelect={setSelected}
          onNew={() => setShowCreate(true)}
        />
      )}

      {showCreate && (
        <CreateModal
          storeId={storeId}
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            await refresh();
          }}
        />
      )}
    </div>
  );
}
