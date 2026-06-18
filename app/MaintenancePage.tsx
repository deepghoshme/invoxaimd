"use client";

/**
 * MaintenancePage
 * Design: /lcdesign/System Pages.dc.html (maintenance panel)
 *
 * Shown when platform_settings.maintenance_mode = true.
 * The server component (page.tsx / layout) fetches the flag and passes it;
 * this component handles its own theme toggle locally.
 */

import { useEffect, useState } from "react";

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const stored = localStorage.getItem("invox-theme") as "light" | "dark" | null;
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    setTheme(stored ?? prefers);
  }, []);
  const toggle = () =>
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      localStorage.setItem("invox-theme", next);
      document.documentElement.setAttribute("data-theme", next);
      return next;
    });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  return { theme, toggle };
}

export default function MaintenancePage({
  eta,
}: {
  /** Human-readable ETA, e.g. "2:30 PM IST". If omitted, the ETA line is hidden. */
  eta?: string | null;
}) {
  const { theme, toggle } = useTheme();

  return (
    <>
      <style>{MP_CSS}</style>

      <div className="mp-bg" aria-hidden="true">
        <div className="mp-blob" />
      </div>

      <button
        className="mp-tgl"
        onClick={toggle}
        aria-label="Toggle theme"
        title="Toggle theme"
      >
        {theme === "dark" ? "☀" : "☾"}
      </button>

      <div className="mp-page">
        <div className="mp-box">
          <div className="mp-art" aria-hidden="true">🛠️</div>
          <h1>We&apos;ll be right back</h1>
          <p>
            invoxai is getting a quick upgrade. Your store &amp; data are safe
            — this won&apos;t take long.
          </p>
          {eta && (
            <div className="mp-eta">
              <span className="mp-eta-dot" aria-hidden="true" />
              Estimated back by {eta}
            </div>
          )}
          <div className="mp-meta">
            Questions?{" "}
            <a
              href="https://status.invoxai.io"
              target="_blank"
              rel="noopener noreferrer"
              className="grad-text"
            >
              status.invoxai.io
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

const MP_CSS = `
@keyframes mp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes mp-a1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(7%,6%) scale(1.2)}}

.mp-bg{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none}
.mp-blob{position:absolute;width:46vmax;height:46vmax;border-radius:50%;filter:blur(95px);opacity:.3;background:var(--brand-gradient);top:-18vmax;right:-10vmax;animation:mp-a1 28s ease-in-out infinite}

.mp-tgl{position:fixed;top:16px;right:16px;z-index:10;width:38px;height:38px;border-radius:999px;border:1px solid var(--color-border);background:color-mix(in srgb,var(--color-card) 80%,transparent);backdrop-filter:blur(8px);color:var(--color-text);cursor:pointer;font-size:14px;display:grid;place-items:center}

.mp-page{position:relative;z-index:1;min-height:100dvh;display:grid;place-items:center;padding:28px 22px}

.mp-box{text-align:center;max-width:460px}
.mp-art{width:92px;height:92px;border-radius:26px;background:var(--brand-gradient);display:grid;place-items:center;font-size:44px;margin:0 auto 24px;box-shadow:0 22px 50px -16px rgba(255,77,125,.5);animation:mp-float 5s ease-in-out infinite}
.mp-box h1{font-family:var(--font-heading);font-size:28px;margin:0;letter-spacing:-.02em}
.mp-box p{color:var(--color-muted);font-size:16px;margin:12px 0 0}

.mp-eta{display:inline-flex;align-items:center;gap:8px;margin-top:20px;font-size:13px;font-weight:600;color:var(--color-muted);border:1px solid var(--color-border);padding:9px 16px;border-radius:999px}
.mp-eta-dot{width:8px;height:8px;border-radius:50%;background:var(--color-highlight);flex:none}

.mp-meta{margin-top:24px;font-size:12.5px;color:var(--color-muted)}
.mp-meta a{text-decoration:none}
`;
