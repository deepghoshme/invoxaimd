"use client";

import { useState, useEffect, useCallback } from "react";
import type { NotifItem } from "./page";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  return `${mo}mo`;
}

type Filter = "all" | "orders" | "money" | "reviews" | "system";

const TABS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "orders", label: "Orders" },
  { key: "money", label: "Money" },
  { key: "reviews", label: "Reviews" },
  { key: "system", label: "System" },
];

// Icon square colours per category
function iconStyle(cat: NotifItem["cat"], warn?: boolean): { bg: string; color: string } {
  if (warn) return { bg: "color-mix(in srgb,var(--red,#e5476f) 14%,transparent)", color: "var(--red,#e5476f)" };
  switch (cat) {
    case "money":   return { bg: "color-mix(in srgb,var(--green,#1fb57a) 14%,transparent)", color: "var(--green,#1fb57a)" };
    case "reviews": return { bg: "color-mix(in srgb,var(--gold,#ffb23e) 18%,transparent)", color: "#9a6b00" };
    case "system":  return { bg: "color-mix(in srgb,var(--accent,#7b3fe4) 14%,transparent)", color: "var(--accent,#7b3fe4)" };
    default:        return { bg: "color-mix(in srgb,var(--primary,#ff6a3d) 12%,transparent)", color: "var(--primary,#ff6a3d)" };
  }
}

/** Fallback emoji when a notification row has no icon, so the thumbnail badge
 * is never blank (e.g. the "New message" notif). */
function fallbackIcon(cat: NotifItem["cat"]): string {
  switch (cat) {
    case "money":   return "💰";
    case "reviews": return "⭐";
    case "system":  return "⚙️";
    default:        return "💬";
  }
}

const LS_KEY = "invox_notif_read";

function loadRead(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveRead(ids: Set<string>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]));
  } catch { /* storage full — ignore */ }
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────
export default function NotificationsFeed({
  items,
  storeName,
}: {
  items: NotifItem[];
  storeName: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  // Hydrate read-state from localStorage only on the client
  useEffect(() => {
    setReadIds(loadRead());
    setMounted(true);
  }, []);

  const markRead = useCallback(
    (id: string) => {
      setReadIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        saveRead(next);
        return next;
      });
    },
    [],
  );

  const markAllRead = useCallback(() => {
    const next = new Set(items.map((i) => i.id));
    setReadIds(next);
    saveRead(next);
  }, [items]);

  const shown = items.filter(
    (i) => filter === "all" || i.cat === filter,
  );

  const unreadCount = items.filter((i) => !readIds.has(i.id)).length;

  return (
    <div className="nt-page">
      {/* Page header */}
      <div className="nt-phead">
        <h1>Notifications</h1>
        {mounted && unreadCount > 0 && (
          <span className="nt-badge">{unreadCount} new</span>
        )}
        <button className="nt-read" onClick={markAllRead}>
          Mark all read
        </button>
      </div>

      {/* Filter tabs */}
      <div className="nt-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`nt-tab${filter === t.key ? " on" : ""}`}
            onClick={() => setFilter(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Notification card */}
      <div className="nt-card dx-card">
        {shown.length === 0 ? (
          <div className="nt-empty">
            <div className="nt-empty-icon">
              {filter === "all"
                ? "🔔"
                : filter === "orders"
                ? "🛒"
                : filter === "money"
                ? "💰"
                : filter === "reviews"
                ? "⭐"
                : "⚙️"}
            </div>
            <p>
              {filter === "all"
                ? "You're all caught up. No notifications yet."
                : `No ${filter} notifications yet.`}
            </p>
          </div>
        ) : (
          shown.map((n) => {
            const isUnread = mounted && !readIds.has(n.id);
            const { bg, color } = iconStyle(n.cat);
            return (
              <div
                key={n.id}
                className={`nt-item${isUnread ? " unread" : ""}`}
                onClick={() => markRead(n.id)}
              >
                {isUnread && <span className="nt-dot" />}
                <span className="nt-ic" style={{ background: bg, color }}>
                  {n.icon || fallbackIcon(n.cat)}
                </span>
                <div className="nt-bd">
                  <div className="nt-title">{n.title}</div>
                  <div className="nt-sub">{n.sub}</div>
                </div>
                <span className="nt-time">{relativeTime(n.ts)}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Suggest-more affordance */}
      <div className="nt-suggest">
        <span>Want more signals?</span>
        <a href="/dashboard/settings" className="nt-cta">
          Notification settings
        </a>
        <a href="/dashboard/analytics" className="nt-cta">
          View analytics
        </a>
      </div>

      <style>{`
        .nt-page {
          /* Full width to match every other dashboard page (was capped at 720px
             and centered, which read as inconsistent). */
          max-width: none;
          margin: 0;
          padding-bottom: 60px;
        }
        .nt-phead {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .nt-phead h1 {
          font-size: 22px;
          font-family: var(--font-sora, "Sora", sans-serif);
          font-weight: 700;
          letter-spacing: -0.02em;
          margin: 0;
        }
        .nt-badge {
          background: var(--secondary, #ff4d7d);
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          padding: 3px 9px;
          border-radius: 999px;
        }
        .nt-read {
          margin-left: auto;
          font: inherit;
          font-weight: 600;
          font-size: 13px;
          color: var(--primary, #ff6a3d);
          background: none;
          border: 0;
          cursor: pointer;
          padding: 0;
        }
        .nt-read:hover { opacity: 0.8; }

        /* tabs */
        .nt-tabs {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          margin-bottom: 14px;
          scrollbar-width: none;
        }
        .nt-tabs::-webkit-scrollbar { display: none; }
        .nt-tab {
          font: inherit;
          font-size: 12.5px;
          font-weight: 600;
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid var(--border, #f0e1d6);
          background: var(--surface, #fff);
          color: var(--muted, #7a6770);
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s, color 0.15s;
        }
        .nt-tab.on {
          background: var(--primary, #ff6a3d);
          color: #fff;
          border-color: transparent;
        }
        .nt-tab:hover:not(.on) {
          border-color: var(--muted, #7a6770);
          color: var(--text, #2b1b2e);
        }

        /* card */
        .nt-card { overflow: hidden; padding: 0; }

        /* items */
        .nt-item {
          display: flex;
          gap: 13px;
          padding: 14px 16px;
          border-top: 1px solid var(--border, #f0e1d6);
          cursor: pointer;
          position: relative;
          transition: background 0.12s;
        }
        .nt-item:first-child { border-top: 0; }
        .nt-item:hover { background: var(--surface2, #fff3ec); }
        .nt-item.unread {
          background: color-mix(in srgb, var(--primary, #ff6a3d) 5%, transparent);
        }
        .nt-item.unread:hover {
          background: color-mix(in srgb, var(--primary, #ff6a3d) 8%, transparent);
        }

        .nt-dot {
          position: absolute;
          left: 6px;
          top: 50%;
          transform: translateY(-50%);
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--primary, #ff6a3d);
        }

        .nt-ic {
          width: 40px;
          height: 40px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          font-size: 18px;
          flex: none;
        }

        .nt-bd { flex: 1; min-width: 0; }
        .nt-title {
          font-size: 13.5px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .nt-sub {
          font-size: 12px;
          color: var(--muted, #7a6770);
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .nt-time {
          font-size: 11.5px;
          color: var(--muted, #7a6770);
          flex: none;
          white-space: nowrap;
          align-self: flex-start;
          padding-top: 2px;
        }

        /* empty state */
        .nt-empty {
          text-align: center;
          color: var(--muted, #7a6770);
          padding: 50px 20px;
        }
        .nt-empty-icon { font-size: 34px; margin-bottom: 12px; }
        .nt-empty p { font-size: 13.5px; margin: 0; }

        /* suggest-more */
        .nt-suggest {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 16px;
          font-size: 12.5px;
          color: var(--muted, #7a6770);
          flex-wrap: wrap;
        }
        .nt-cta {
          font: inherit;
          font-weight: 600;
          font-size: 12px;
          border: 1px solid var(--border, #f0e1d6);
          background: var(--surface, #fff);
          color: var(--text, #2b1b2e);
          padding: 6px 11px;
          border-radius: 8px;
          cursor: pointer;
          text-decoration: none;
          transition: border-color 0.15s;
        }
        .nt-cta:hover { border-color: var(--muted, #7a6770); }

        @keyframes nt-in {
          from { opacity: 0.4; transform: translateY(6px); }
          to   { opacity: 1;   transform: none; }
        }
        .nt-item { animation: nt-in 0.3s ease; }
      `}</style>
    </div>
  );
}
