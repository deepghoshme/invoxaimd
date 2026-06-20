"use client";

import { ReactNode } from "react";

export default function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <>
      <style>{LEGAL_CSS}</style>

      {/* Minimal nav consistent with MarketingLanding */}
      <nav className="lg-nav">
        <div className="lg-wrap lg-nav-in">
          <a href="/" className="lg-brand">
            <span className="lg-logo" aria-hidden="true" />
            invoxai
          </a>
          <div className="lg-nav-links">
            <a href="/#pricing">Pricing</a>
            <a href="/login" className="lg-btn lg-btn-ghost">Log in</a>
            <a href="/onboarding" className="lg-btn lg-btn-grad">
              Start free
              <span className="lg-shine" aria-hidden="true" />
            </a>
          </div>
        </div>
      </nav>

      <main className="lg-main">
        <div className="lg-wrap">
          <div className="lg-doc">
            <header className="lg-doc-head">
              <div className="lg-breadcrumb">
                <a href="/">invoxai.io</a>
                <span> / </span>
                <span>{title}</span>
              </div>
              <h1 className="lg-doc-title">{title}</h1>
              <p className="lg-doc-updated">Last updated: {updated}</p>
            </header>
            <article className="lg-doc-body">{children}</article>
          </div>
        </div>
      </main>

      <footer className="lg-foot">
        <div className="lg-wrap lg-foot-in">
          <span>© 2026 invoxai.io · Made in India</span>
          <div className="lg-foot-links">
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
            <a href="/refund">Refund Policy</a>
            <a href="/contact">Contact</a>
          </div>
        </div>
      </footer>
    </>
  );
}

const LEGAL_CSS = `
:root {
  --lg-bg: #fff9f4; --lg-card: #fff; --lg-s2: #fff3ec;
  --lg-primary: #ff6a3d; --lg-secondary: #ff4d7d; --lg-accent: #7b3fe4;
  --lg-text: #2b1b2e; --lg-muted: #7a6770; --lg-border: #f0e1d6; --lg-green: #1fb57a;
  --lg-grad: linear-gradient(135deg,#ffb23e,#ff6a3d 38%,#ff4d7d 72%,#7b3fe4 100%);
  --lg-fh: var(--font-heading,"Sora",system-ui,sans-serif);
}
[data-theme="dark"] {
  --lg-bg: #16101f; --lg-card: #221833; --lg-s2: #2a2040;
  --lg-primary: #ff7e55; --lg-secondary: #ff6aa0; --lg-accent: #a06bff;
  --lg-text: #f6eef2; --lg-muted: #b9a8bc; --lg-border: #34264a;
}

*, *::before, *::after { box-sizing: border-box; }
body { background: var(--lg-bg); color: var(--lg-text); margin: 0; font-family: "Inter", system-ui, sans-serif; -webkit-font-smoothing: antialiased; line-height: 1.6; }

.lg-wrap { max-width: 860px; margin: 0 auto; padding: 0 28px; }

/* Nav */
.lg-nav { position: sticky; top: 0; z-index: 60; backdrop-filter: blur(14px); background: color-mix(in srgb, var(--lg-bg) 88%, transparent); border-bottom: 1px solid var(--lg-border); }
.lg-nav-in { display: flex; align-items: center; gap: 14px; height: 64px; }
.lg-brand { display: flex; align-items: center; gap: 9px; font-family: var(--lg-fh); font-weight: 800; font-size: 18px; letter-spacing: -.03em; color: var(--lg-text); text-decoration: none; }
.lg-logo { width: 26px; height: 26px; border-radius: 8px; background: var(--lg-grad); flex: none; display: inline-block; }
.lg-nav-links { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.lg-nav-links > a:not(.lg-btn) { font-size: 14px; font-weight: 500; color: var(--lg-muted); text-decoration: none; padding: 6px 10px; border-radius: 8px; transition: color .15s; }
.lg-nav-links > a:not(.lg-btn):hover { color: var(--lg-text); }
.lg-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; font-family: var(--lg-fh); font-weight: 600; font-size: 13.5px; border-radius: 9px; border: 1.5px solid transparent; cursor: pointer; transition: filter .15s, border-color .15s; text-decoration: none; position: relative; overflow: hidden; }
.lg-btn-ghost { background: transparent; border-color: var(--lg-border); color: var(--lg-text); }
.lg-btn-ghost:hover { border-color: var(--lg-muted); }
.lg-btn-grad { background: var(--lg-grad); color: #fff; box-shadow: 0 8px 22px -8px rgba(255,77,125,.55); }
.lg-btn-grad:hover { filter: brightness(1.06); color: #fff; }
.lg-shine { position: absolute; top: 0; left: -60%; width: 34%; height: 100%; transform: skewX(-18deg); background: #fff; opacity: .4; filter: blur(3px); animation: lg-shine 3.4s ease-in-out infinite; pointer-events: none; }
@keyframes lg-shine { 0% { left: -60%; } 55%,100% { left: 130%; } }

/* Main */
.lg-main { padding: 56px 0 80px; }
.lg-doc { background: var(--lg-card); border: 1px solid var(--lg-border); border-radius: 20px; overflow: hidden; box-shadow: 0 4px 24px -8px rgba(43,27,46,.08); }
.lg-doc-head { padding: 40px 48px 32px; border-bottom: 1px solid var(--lg-border); background: var(--lg-s2); }
.lg-breadcrumb { font-size: 12.5px; color: var(--lg-muted); margin-bottom: 12px; }
.lg-breadcrumb a { color: var(--lg-primary); text-decoration: none; font-weight: 500; }
.lg-breadcrumb a:hover { text-decoration: underline; }
.lg-doc-title { font-family: var(--lg-fh); font-size: 32px; font-weight: 800; letter-spacing: -.025em; margin: 0 0 10px; color: var(--lg-text); }
.lg-doc-updated { font-size: 12.5px; color: var(--lg-muted); margin: 0; }

/* Body prose */
.lg-doc-body { padding: 40px 48px 52px; max-width: 100%; }
.lg-doc-body h2 { font-family: var(--lg-fh); font-size: 19px; font-weight: 700; margin: 36px 0 10px; color: var(--lg-text); }
.lg-doc-body h2:first-child { margin-top: 0; }
.lg-doc-body p { font-size: 15px; color: var(--lg-text); margin: 0 0 14px; }
.lg-doc-body ul, .lg-doc-body ol { margin: 0 0 14px; padding-left: 22px; }
.lg-doc-body li { font-size: 15px; color: var(--lg-text); margin-bottom: 6px; }
.lg-doc-body a { color: var(--lg-primary); }
.lg-doc-body strong { font-weight: 700; }
.lg-doc-body .notice { background: color-mix(in srgb, var(--lg-primary) 10%, transparent); border-left: 3px solid var(--lg-primary); border-radius: 0 8px 8px 0; padding: 12px 16px; margin: 18px 0; font-size: 14px; }

/* Footer */
.lg-foot { border-top: 1px solid var(--lg-border); padding: 28px 0; }
.lg-foot-in { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; font-size: 13px; color: var(--lg-muted); }
.lg-foot-links { display: flex; gap: 18px; flex-wrap: wrap; }
.lg-foot-links a { color: var(--lg-muted); text-decoration: none; font-size: 13px; transition: color .15s; }
.lg-foot-links a:hover { color: var(--lg-primary); }

@media (max-width: 640px) {
  .lg-wrap { padding: 0 16px; }
  .lg-doc-head, .lg-doc-body { padding: 24px 20px; }
  .lg-doc-title { font-size: 24px; }
  .lg-nav-links > a:not(.lg-btn) { display: none; }
  .lg-foot-in { flex-direction: column; align-items: flex-start; }
}
`;
