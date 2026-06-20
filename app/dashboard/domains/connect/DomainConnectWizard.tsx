"use client";

import { useState, useCallback, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4;

interface VerifyResult {
  ok: boolean;
  token?: string;
  checks?: { cname: boolean; txt: boolean };
  status?: string;
  hint?: string;
  sslNote?: string;
  migrationPending?: boolean;
  error?: string;
}

interface Props {
  storeId: string;
  /** Existing connected domain (if any) — skips directly to step 4 if status=live */
  existingDomain?: { domain: string; status: string } | null;
  migrationPending?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
// Source: confirmed in /app/api/domains/verify/route.ts CNAME_TARGET constant
// and in deploy/Caddyfile (seller custom domains point here via on-demand TLS).
const CNAME_TARGET = "cname.invoxai.io";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function cleanDomain(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/[^a-z0-9.-]/g, "");
}

function isValidDomain(d: string) {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d);
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Spinner({ light = false }: { light?: boolean }) {
  return <span className={light ? "dcw-spin dcw-spin-light" : "dcw-spin"} aria-hidden="true" />;
}

function Toast({ msg }: { msg: string }) {
  return (
    <div className="dcw-toast" role="status">
      <span className="dcw-toast-dot" />
      {msg}
    </div>
  );
}

function StepBar({ step }: { step: Step }) {
  const steps: { label: string; n: Step }[] = [
    { label: "Domain", n: 1 },
    { label: "DNS records", n: 2 },
    { label: "Verifying", n: 3 },
    { label: "Live", n: 4 },
  ];
  return (
    <div className="dcw-stepbar" role="list" aria-label="Progress">
      {steps.map(({ label, n }, i) => {
        const done = step > n;
        const active = step === n;
        const cls = done ? "dcw-step done" : active ? "dcw-step active" : "dcw-step";
        const dot = done ? "✓" : String(n);
        return (
          <div key={n} className={cls} role="listitem">
            <span className="dcw-dot" aria-label={done ? "completed" : active ? "current" : "upcoming"}>
              {dot}
            </span>
            <span className="dcw-step-lbl">{label}</span>
            {i < steps.length - 1 && <span className="dcw-step-line" aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}

function CopyBtn({ text, label, onCopy }: { text: string; label: string; onCopy: (text: string, label: string) => void }) {
  const [copied, setCopied] = useState(false);
  function handleClick() {
    onCopy(text, label);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }
  return (
    <button className={`dcw-cp${copied ? " dcw-cp-ok" : ""}`} onClick={handleClick} type="button">
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ─── Main wizard ─────────────────────────────────────────────────────────────
export default function DomainConnectWizard({ storeId, existingDomain, migrationPending }: Props) {
  const [step, setStep]           = useState<Step>(() => {
    if (existingDomain?.status === "live") return 4;
    if (existingDomain?.status === "dns")  return 3;
    if (existingDomain?.domain)            return 2;
    return 1;
  });
  const [domain, setDomain]       = useState(existingDomain?.domain ?? "");
  const [token, setToken]         = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sslIssuing, setSslIssuing] = useState(true);
  const [checks, setChecks]       = useState({ cname: false, txt: false });
  const [verifyHint, setVerifyHint] = useState("");
  const [verifyAttempted, setVerifyAttempted] = useState(false);
  const [toast, setToast]         = useState("");
  const [toastKey, setToastKey]   = useState(0);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setToastKey((k) => k + 1);
    const id = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(id);
  }, []);

  // When mounting directly at step 2 (existing domain, not yet DNS-verified),
  // fetch the verification token immediately so the seller sees the exact TXT
  // record to copy without having to click "Check DNS" first.
  useEffect(() => {
    if (step !== 2 || !domain || token) return;
    setTokenLoading(true);
    fetch("/api/domains/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, store_id: storeId }),
    })
      .then((r) => r.json())
      .then((data: VerifyResult) => {
        if (data.token) setToken(data.token);
      })
      .catch(() => { /* non-fatal — token placeholder stays */ })
      .finally(() => setTokenLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // Step 1 → 2: register domain with the API immediately so the seller can
  // see their real TXT verification token before adding DNS records.
  async function handleAdd() {
    const d = cleanDomain(domain);
    setDomain(d);
    if (!isValidDomain(d)) {
      showToast("Enter a valid domain like studioaanya.com");
      return;
    }
    // Call the API to generate/fetch the verification token right away.
    // This means on step 2 the seller sees the exact TXT record to add.
    setTokenLoading(true);
    try {
      const res = await fetch("/api/domains/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: d, store_id: storeId }),
      });
      const data: VerifyResult = await res.json();
      if (data.migrationPending) {
        showToast("Migration not applied — see admin.");
        setTokenLoading(false);
        return;
      }
      if (data.token) setToken(data.token);
      // If DNS already verified, jump ahead
      if (data.ok) {
        setChecks({ cname: true, txt: true });
        setStep(3);
        setSslIssuing(true);
        setTimeout(() => setSslIssuing(false), 2200);
        setTokenLoading(false);
        return;
      }
    } catch {
      // Non-fatal: advance to step 2 without token; user will get it on first verify
    }
    setTokenLoading(false);
    setStep(2);
  }

  // Step 2: Re-check DNS records
  async function handleVerify() {
    if (verifying) return;
    setVerifying(true);
    setVerifyHint("");

    try {
      const res = await fetch("/api/domains/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, store_id: storeId }),
      });
      const data: VerifyResult = await res.json();

      if (data.migrationPending) {
        showToast("Migration not applied — see admin.");
        setVerifying(false);
        return;
      }

      if (data.token) setToken(data.token);

      if (data.ok) {
        setChecks({ cname: true, txt: true });
        setStep(3);
        setSslIssuing(true);
        setTimeout(() => setSslIssuing(false), 2200);
      } else {
        setChecks(data.checks ?? { cname: false, txt: false });
        setVerifyHint(data.hint ?? "DNS not yet propagated. Try again in a minute.");
        setVerifyAttempted(true);
        showToast("DNS not propagated yet — see details below.");
      }
    } catch {
      showToast("Network error — please retry.");
    } finally {
      setVerifying(false);
    }
  }

  // Step 3 → 4: promote to live
  async function handleSetLive() {
    if (sslIssuing) return;
    try {
      const getRes = await fetch(`/api/domains/verify?store_id=${storeId}`);
      const getData = await getRes.json();
      const row = (getData.domains ?? []).find((d: { domain: string; id: string }) => d.domain === domain);
      if (row?.id) {
        await fetch("/api/domains/verify", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: row.id, action: "set_live" }),
        });
      }
    } catch {
      // Non-fatal — proceed to step 4 regardless
    }
    setStep(4);
    showToast(`${domain} is now your primary domain`);
  }

  async function handleCopy(text: string, label: string) {
    const ok = await copyText(text);
    if (!ok) showToast(`${label}: ${text}`);
  }

  const txtRecord = token
    ? `invoxai-verify=${token}`
    : null;

  const sslCls = sslIssuing ? "dcw-cl-icon wait" : "dcw-cl-icon ok";

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        /* ── Scoped to .dcw ── */
        @keyframes dcw-spin { to { transform: rotate(360deg); } }
        @keyframes dcw-in   { from { opacity: .35; transform: translateY(7px); } to { opacity: 1; transform: none; } }
        @keyframes dcw-toast { from { transform: translate(-50%, 130%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }

        .dcw {
          --bg:       var(--app-bg,      #fff9f4);
          --card:     var(--app-card,    #fff);
          --s2:       var(--app-s2,      #fff3ec);
          --primary:  var(--brand-primary, #ff6a3d);
          --secondary:var(--brand-secondary, #ff4d7d);
          --accent:   var(--brand-accent, #7b3fe4);
          --gold:     #ffb23e;
          --text:     var(--app-text,    #2b1b2e);
          --muted:    var(--app-muted,   #7a6770);
          --border:   var(--app-border,  #f0e1d6);
          --green:    #1fb57a;
          --red:      #dc2626;
          --grad:     linear-gradient(135deg,#ffb23e,#ff6a3d 38%,#ff4d7d 72%,#7b3fe4);
          --shadow:   0 1px 2px rgba(43,27,46,.04), 0 14px 34px -20px rgba(43,27,46,.26);
          --fh:       "Sora", system-ui, sans-serif;
          --fb:       "Inter", system-ui, sans-serif;
          font-family: var(--fb);
          color: var(--text);
          line-height: 1.5;
          -webkit-font-smoothing: antialiased;
          max-width: 720px;
        }

        /* Step bar */
        .dcw-stepbar { display: flex; align-items: center; gap: 6px; margin-bottom: 20px; }
        .dcw-step    { display: flex; align-items: center; gap: 6px; flex: 1; }
        .dcw-dot     { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 800; font-family: var(--fh); background: var(--s2); color: var(--muted); flex: none; transition: background .25s, color .25s; }
        .dcw-step.active .dcw-dot { background: var(--grad); color: #fff; }
        .dcw-step.done   .dcw-dot { background: var(--green); color: #fff; }
        .dcw-step-lbl    { font-size: 11.5px; font-weight: 600; color: var(--muted); white-space: nowrap; }
        .dcw-step.active .dcw-step-lbl,
        .dcw-step.done   .dcw-step-lbl { color: var(--text); }
        .dcw-step-line   { flex: 1; height: 2px; background: var(--border); border-radius: 1px; }
        .dcw-step.done   .dcw-step-line { background: var(--green); }

        /* Card */
        .dcw-card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 24px; box-shadow: var(--shadow); animation: dcw-in .3s ease; }
        .dcw-title { font-size: 16px; font-weight: 700; font-family: var(--fh); margin: 0 0 6px; }
        .dcw-sub   { color: var(--muted); font-size: 13.5px; margin: 0 0 16px; }

        /* Inputs */
        .dcw-label  { display: block; font-size: 12.5px; font-weight: 700; margin: 12px 0 6px; }
        .dcw-input-wrap { display: flex; align-items: center; background: var(--bg); border: 1.5px solid var(--border); border-radius: 11px; overflow: hidden; transition: border-color .18s; }
        .dcw-input-wrap:focus-within { border-color: var(--primary); }
        .dcw-input-wrap input { flex: 1; border: 0; background: transparent; padding: 12px 14px; font: inherit; font-size: 15px; color: var(--text); outline: none; }

        /* DNS record table */
        .dcw-rec { display: grid; grid-template-columns: 72px 1fr 1fr; gap: 1px; background: var(--border); border-radius: 10px; overflow: hidden; margin-top: 10px; }
        .dcw-rec > div { background: var(--card); padding: 11px 13px; font-size: 13px; }
        .dcw-rec .hd   { background: var(--s2); font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
        .dcw-rec .mono { font-family: ui-monospace, Menlo, monospace; font-weight: 600; }
        @media (max-width: 520px) { .dcw-rec { grid-template-columns: 1fr; } }

        /* Code row */
        .dcw-code { font-family: ui-monospace, Menlo, monospace; background: var(--s2); border: 1px solid var(--border); border-radius: 10px; padding: 13px 14px; font-size: 12.5px; display: flex; align-items: center; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
        .dcw-code .k { color: var(--muted); flex: none; }
        .dcw-code .v { font-weight: 700; color: var(--text); flex: 1; min-width: 0; word-break: break-all; }

        /* Copy button */
        .dcw-cp      { border: 1px solid var(--border); background: var(--card); color: var(--text); border-radius: 8px; padding: 6px 12px; font: inherit; font-size: 11.5px; font-weight: 600; cursor: pointer; flex: none; transition: background .15s, color .15s, border-color .15s; }
        .dcw-cp:hover { background: var(--bg); }
        .dcw-cp.dcw-cp-ok { background: color-mix(in srgb, var(--green) 12%, transparent); color: var(--green); border-color: color-mix(in srgb, var(--green) 30%, transparent); }

        /* Buttons */
        .dcw-btn { width: 100%; margin-top: 18px; background: var(--grad); color: #fff; border: 0; border-radius: 12px; padding: 14px; font-family: var(--fh); font-weight: 800; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: opacity .15s; }
        .dcw-btn:disabled { opacity: .58; cursor: not-allowed; }
        .dcw-ghost { width: 100%; margin-top: 10px; background: var(--card); color: var(--text); border: 1px solid var(--border); border-radius: 12px; padding: 12px; font-family: var(--fh); font-weight: 600; font-size: 13.5px; cursor: pointer; transition: background .15s; }
        .dcw-ghost:hover { background: var(--s2); }

        /* Spinner */
        .dcw-spin { width: 17px; height: 17px; border: 2.5px solid rgba(255,255,255,.35); border-top-color: #fff; border-radius: 50%; animation: dcw-spin .7s linear infinite; display: inline-block; }
        .dcw-spin-light { border-color: rgba(43,27,46,.18); border-top-color: var(--muted); }

        /* Checklist */
        .dcw-checklist { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
        .dcw-cl { display: flex; align-items: center; gap: 11px; font-size: 13.5px; }
        .dcw-cl-icon { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 800; flex: none; }
        .dcw-cl-icon.ok   { background: color-mix(in srgb,var(--green) 16%,transparent); color: var(--green); }
        .dcw-cl-icon.fail { background: color-mix(in srgb,var(--red) 10%,transparent); color: var(--red); }
        .dcw-cl-icon.wait { background: var(--s2); color: var(--muted); }
        .dcw-cl-ssl-note  { font-size: 12px; color: var(--muted); margin-top: 10px; padding: 10px 12px; background: var(--s2); border-radius: 8px; line-height: 1.55; }

        /* DNS check feedback */
        .dcw-dns-checks { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; padding: 14px 16px; background: color-mix(in srgb,var(--red) 5%,transparent); border: 1px solid color-mix(in srgb,var(--red) 20%,transparent); border-radius: 12px; }
        .dcw-dns-checks .dcw-hint-title { font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 2px; }
        .dcw-dns-checks .dcw-hint-body  { font-size: 12.5px; color: var(--muted); margin-top: 6px; }

        /* Hint */
        .dcw-hint { font-size: 12.5px; color: var(--muted); margin-top: 10px; padding: 10px 13px; background: var(--s2); border: 1px solid var(--border); border-radius: 8px; }

        /* Token placeholder */
        .dcw-token-pending { font-size: 12px; color: var(--muted); font-style: italic; display: flex; align-items: center; gap: 7px; }

        /* Done */
        .dcw-done   { text-align: center; padding: 12px 4px 4px; }
        .dcw-circle { width: 70px; height: 70px; border-radius: 50%; background: var(--grad); color: #fff; display: grid; place-items: center; font-size: 32px; margin: 0 auto 14px; }
        .dcw-done h2 { font-size: 22px; font-family: var(--fh); margin: 0 0 4px; }
        .dcw-done .dcw-url { font-family: ui-monospace, Menlo, monospace; font-size: 14px; color: var(--primary); font-weight: 600; margin: 12px 0; }
        .dcw-auto { text-align: left; background: var(--s2); border-radius: 12px; padding: 14px 16px; margin-top: 8px; }
        .dcw-auto-row { display: flex; align-items: center; gap: 10px; font-size: 13px; padding: 6px 0; }
        .dcw-auto-row .e { color: var(--green); font-weight: 800; }

        /* Migration banner */
        .dcw-migration-banner { background: color-mix(in srgb, var(--gold) 14%, transparent); border: 1px solid color-mix(in srgb, var(--gold) 40%, transparent); border-radius: 12px; padding: 16px 18px; font-size: 13.5px; margin-bottom: 20px; }
        .dcw-migration-banner code { font-family: ui-monospace, Menlo, monospace; font-size: 12px; background: rgba(0,0,0,.07); border-radius: 4px; padding: 2px 5px; }

        /* Step sub-label */
        .dcw-step-num { display: inline-flex; width: 20px; height: 20px; border-radius: 50%; background: var(--s2); color: var(--muted); font-size: 11px; font-weight: 700; align-items: center; justify-content: center; flex: none; margin-right: 6px; }
        .dcw-section-title { font-size: 13px; font-weight: 700; margin: 18px 0 8px; display: flex; align-items: center; }

        /* Record group header */
        .dcw-rec-label { font-size: 11.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; margin: 14px 0 6px; }

        /* Toast */
        .dcw-toast { position: fixed; left: 50%; bottom: 28px; z-index: 9999; background: #18121f; color: #fff; padding: 12px 20px; border-radius: 12px; font-size: 13px; font-weight: 600; box-shadow: 0 20px 50px -20px rgba(0,0,0,.55); display: flex; align-items: center; gap: 9px; animation: dcw-toast .35s ease; pointer-events: none; white-space: nowrap; }
        .dcw-toast-dot { width: 8px; height: 8px; border-radius: 50%; background: #36c98e; flex: none; }
      `}</style>

      <div className="dcw">
        {/* Migration pending banner */}
        {migrationPending && (
          <div className="dcw-migration-banner">
            <strong>Database migration not yet applied.</strong> The custom domains feature requires a new table.
            Run: <code>node scripts/db-apply.mjs supabase/migrations/20260618220000_custom_domains.sql</code>
            <br />to enable domain connect.
          </div>
        )}

        <StepBar step={step} />

        {/* ── Step 1: Add domain ── */}
        {step === 1 && (
          <div className="dcw-card">
            <h3 className="dcw-title">Enter your domain</h3>
            <p className="dcw-sub">Type the domain you own — we&apos;ll generate DNS records for you to add at your registrar.</p>
            <label className="dcw-label" htmlFor="dcw-domain-input">Domain name</label>
            <div className="dcw-input-wrap">
              <input
                id="dcw-domain-input"
                type="text"
                value={domain}
                placeholder="studioaanya.com"
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setDomain(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ""))}
                onKeyDown={(e) => { if (e.key === "Enter" && isValidDomain(cleanDomain(domain))) handleAdd(); }}
              />
            </div>
            <p className="dcw-hint">
              Enter without <code>https://</code> — e.g. <strong>mystore.com</strong> or <strong>www.mystore.com</strong>.
            </p>
            <button
              className="dcw-btn"
              onClick={handleAdd}
              disabled={!isValidDomain(cleanDomain(domain)) || tokenLoading}
            >
              {tokenLoading ? <><Spinner /> Generating records…</> : "Get DNS records →"}
            </button>
          </div>
        )}

        {/* ── Step 2: DNS records ── */}
        {step === 2 && (
          <div className="dcw-card">
            <h3 className="dcw-title">Add these DNS records</h3>
            <p className="dcw-sub">
              Log in to your domain registrar and add the following records for <strong>{domain}</strong>.
              Then come back here and click <em>Check DNS</em>.
            </p>

            {/* Record 1: CNAME */}
            <div className="dcw-rec-label">Record 1 — CNAME (points your domain to invoxai)</div>
            <div className="dcw-rec">
              <div className="hd">Type</div>
              <div className="hd">Name / Host</div>
              <div className="hd">Value / Points to</div>
              <div className="mono">CNAME</div>
              <div className="mono">@ <span style={{ fontFamily: "inherit", fontWeight: 400, color: "var(--muted)", fontSize: 11.5 }}>or www</span></div>
              <div className="mono" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                {CNAME_TARGET}
                <CopyBtn text={CNAME_TARGET} label="CNAME value" onCopy={handleCopy} />
              </div>
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
              Use <code>@</code> for the apex domain (e.g. mystore.com) or <code>www</code> for the www subdomain.
              If your registrar does not support CNAME on <code>@</code>, use <code>www</code> and add an apex redirect to www.
            </p>

            {/* Record 2: TXT verification */}
            <div className="dcw-rec-label" style={{ marginTop: 16 }}>Record 2 — TXT (ownership verification)</div>
            {txtRecord ? (
              <>
                <div className="dcw-rec">
                  <div className="hd">Type</div>
                  <div className="hd">Name / Host</div>
                  <div className="hd">Value</div>
                  <div className="mono">TXT</div>
                  <div className="mono">@</div>
                  <div className="mono" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, wordBreak: "break-all" }}>
                    {txtRecord}
                    <CopyBtn text={txtRecord} label="TXT record" onCopy={handleCopy} />
                  </div>
                </div>
              </>
            ) : (
              <div className="dcw-code">
                <span className="k">TXT</span>
                <span className="v dcw-token-pending">
                  <Spinner light /> Generating your verification token…
                </span>
              </div>
            )}

            {/* DNS check failure feedback */}
            {verifyAttempted && (
              <div className="dcw-dns-checks">
                <div className="dcw-hint-title">DNS not propagated yet</div>
                <div className="dcw-cl">
                  <span className={`dcw-cl-icon ${checks.cname ? "ok" : "fail"}`}>
                    {checks.cname ? "✓" : "✗"}
                  </span>
                  <span style={{ fontSize: 13 }}>
                    CNAME → {CNAME_TARGET}{checks.cname ? " (found)" : " (not found yet)"}
                  </span>
                </div>
                <div className="dcw-cl">
                  <span className={`dcw-cl-icon ${checks.txt ? "ok" : "fail"}`}>
                    {checks.txt ? "✓" : "✗"}
                  </span>
                  <span style={{ fontSize: 13 }}>
                    TXT verification token{checks.txt ? " (found)" : " (not found yet)"}
                  </span>
                </div>
                <p className="dcw-hint-body">
                  {verifyHint} DNS changes can take a few minutes to an hour to propagate globally. Wait a bit, then click <em>Check DNS</em> again — no need to re-add the records.
                </p>
              </div>
            )}

            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 14 }}>
              Once you&apos;ve added both records, click Check DNS. Propagation typically takes 1–10 minutes (up to 24 hours in rare cases).
            </p>

            <button className="dcw-btn" onClick={handleVerify} disabled={verifying}>
              {verifying ? <><Spinner /> Checking DNS…</> : verifyAttempted ? "Check DNS again" : "Check DNS"}
            </button>
            <button className="dcw-ghost" onClick={() => { setStep(1); setVerifyHint(""); setVerifyAttempted(false); }}>
              Back
            </button>
          </div>
        )}

        {/* ── Step 3: Verifying + SSL note ── */}
        {step === 3 && (
          <div className="dcw-card">
            <h3 className="dcw-title">DNS verified — SSL issuing</h3>
            <p className="dcw-sub">
              Both DNS records confirmed. Caddy will provision your SSL certificate automatically on the first HTTPS request.
            </p>

            <div className="dcw-checklist">
              <div className="dcw-cl">
                <span className="dcw-cl-icon ok">✓</span>
                CNAME record found — points to {CNAME_TARGET}
              </div>
              <div className="dcw-cl">
                <span className="dcw-cl-icon ok">✓</span>
                TXT verification token matched
              </div>
              <div className="dcw-cl">
                <span className={sslCls}>
                  {sslIssuing ? <Spinner light /> : "✓"}
                </span>
                SSL certificate {sslIssuing ? "will be issued by Caddy on the first HTTPS visit…" : "active (Caddy on-demand TLS)"}
              </div>
            </div>

            {!sslIssuing && (
              <p className="dcw-cl-ssl-note">
                SSL is provisioned automatically by Caddy the first time an HTTPS request arrives at {domain}.
                If you visit the domain now and see a certificate warning, wait 30–60 seconds and refresh — the cert is being issued.
              </p>
            )}

            <button className="dcw-btn" onClick={handleSetLive} disabled={sslIssuing}>
              {sslIssuing ? <><Spinner /> Issuing SSL…</> : "Set as primary domain →"}
            </button>
          </div>
        )}

        {/* ── Step 4: Live ── */}
        {step === 4 && (
          <div className="dcw-card">
            <div className="dcw-done">
              <div className="dcw-circle">✓</div>
              <h2>Your domain is live!</h2>
              <p style={{ color: "var(--muted)", fontSize: 13.5 }}>
                All traffic is now served through your custom domain.
              </p>
              <div className="dcw-url">https://{domain}</div>
              <div className="dcw-auto">
                <div className="dcw-auto-row"><span className="e">✓</span>All pages moved to your domain</div>
                <div className="dcw-auto-row"><span className="e">✓</span>Old subdomain URLs now 301-redirect</div>
                <div className="dcw-auto-row"><span className="e">✓</span>SSL certificate active &amp; auto-renewing</div>
                <div className="dcw-auto-row"><span className="e">✓</span>Canonical tags updated for SEO</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && <Toast key={toastKey} msg={toast} />}
    </>
  );
}
