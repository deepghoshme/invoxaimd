"use client";

/**
 * 404 — "This page wandered off"
 * Design: /lcdesign/System Pages.dc.html (404 panel)
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

export default function NotFound() {
  const { theme, toggle } = useTheme();

  return (
    <>
      <style>{SP_CSS}</style>

      {/* aurora bg */}
      <div className="sp-bg" aria-hidden="true">
        <div className="sp-blob" />
      </div>

      {/* theme toggle */}
      <button
        className="sp-tgl"
        onClick={toggle}
        aria-label="Toggle theme"
        title="Toggle theme"
      >
        {theme === "dark" ? "☀" : "☾"}
      </button>

      <div className="sp-page">
        <div className="sp-box">
          <div className="sp-404 grad-text">404</div>
          <h1>This page wandered off</h1>
          <p>
            The link may be broken, or the page was moved or unpublished.
          </p>
          <div className="sp-cta">
            <a href="/" className="sp-btn sp-btn-grad">
              ← Back home
            </a>
            <a href="/store" className="sp-btn">
              Browse the store
            </a>
          </div>
          <div className="sp-meta">
            invoxai.io · powered by{" "}
            <b className="grad-text">invoxai</b>
          </div>
        </div>
      </div>
    </>
  );
}

const SP_CSS = `
@keyframes sp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes sp-a1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(7%,6%) scale(1.2)}}

.sp-bg{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none}
.sp-blob{position:absolute;width:46vmax;height:46vmax;border-radius:50%;filter:blur(95px);opacity:.3;background:var(--brand-gradient);top:-18vmax;right:-10vmax;animation:sp-a1 28s ease-in-out infinite}

.sp-tgl{position:fixed;top:16px;right:16px;z-index:10;width:38px;height:38px;border-radius:999px;border:1px solid var(--color-border);background:color-mix(in srgb,var(--color-card) 80%,transparent);backdrop-filter:blur(8px);color:var(--color-text);cursor:pointer;font-size:14px;display:grid;place-items:center}

.sp-page{position:relative;z-index:1;min-height:100dvh;display:grid;place-items:center;padding:28px 22px}

.sp-box{text-align:center;max-width:460px}
.sp-404{font-family:var(--font-heading);font-weight:800;font-size:clamp(72px,12vw,110px);line-height:1;letter-spacing:-.04em;margin-bottom:8px}
.sp-box h1{font-family:var(--font-heading);font-size:28px;margin:0;letter-spacing:-.02em}
.sp-box p{color:var(--color-muted);font-size:16px;margin:12px 0 0}

.sp-cta{display:inline-flex;gap:10px;margin-top:26px;flex-wrap:wrap;justify-content:center}
.sp-btn{font-family:var(--font-heading);font-weight:700;font-size:14.5px;padding:13px 24px;border-radius:12px;border:1.5px solid var(--color-border);background:var(--color-card);color:var(--color-text);cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;transition:border-color .15s,background .15s}
.sp-btn:hover{border-color:var(--color-muted);color:var(--color-text)}
.sp-btn-grad{background:var(--brand-gradient);color:#fff;border-color:transparent;box-shadow:0 10px 26px -10px rgba(255,77,125,.5)}
.sp-btn-grad:hover{filter:brightness(1.05);color:#fff}

.sp-meta{margin-top:26px;font-size:12.5px;color:var(--color-muted)}
`;
