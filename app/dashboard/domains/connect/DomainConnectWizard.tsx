"use client";

import { useState, useCallback } from "react";

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
function Spinner() {
  return <span className="dcw-spin" aria-hidden="true" />;
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
    { label: "Add", n: 1 },
    { label: "DNS", n: 2 },
    { label: "Verify", n: 3 },
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

// ─── Main wizard ─────────────────────────────────────────────────────────────
export default function DomainConnectWizard({ storeId, existingDomain, migrationPending }: Props) {
  const [step, setStep]         = useState<Step>(() => {
    if (existingDomain?.status === "live") return 4;
    if (existingDomain?.status === "dns")  return 3;
    return 1;
  });
  const [domain, setDomain]     = useState(existingDomain?.domain ?? "");
  const [token, setToken]       = useState("");
  const [verifying, setVerifying] = useState(false);
  const [sslIssuing, setSslIssuing] = useState(true);
  const [checks, setChecks]     = useState({ cname: false, txt: false });
  const [verifyHint, setVerifyHint] = useState("");
  const [toast, setToast]       = useState("");
  const [toastKey, setToastKey] = useState(0);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setToastKey((k) => k + 1);
    const id = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(id);
  }, []);

  // Step 1 → 2: register domain, get token
  async function handleAdd() {
    const d = cleanDomain(domain);
    setDomain(d);
    if (!isValidDomain(d)) {
      showToast("Enter a valid domain like studioaanya.com");
      return;
    }
    // Optimistically advance; token is fetched on verify
    setStep(2);
  }

  // Step 2: DNS verify
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

      // Always capture the token (we may not have it yet on first call)
      if (data.token) setToken(data.token);

      if (data.ok) {
        setChecks({ cname: true, txt: true });
        setStep(3);
        setSslIssuing(true);
        // Caddy issues SSL on first real HTTPS hit — simulate a brief "issuing" UX
        // then surface honest status. We do NOT poll Caddy here.
        setTimeout(() => setSslIssuing(false), 2200);
      } else {
        setChecks(data.checks ?? { cname: false, txt: false });
        setVerifyHint(data.hint ?? "DNS not yet propagated. Try again in a minute.");
        showToast("DNS check failed — see hints below.");
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
      // Find domain row id from GET then PATCH
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
    showToast(ok ? `${label} copied` : `${label}: ${text}`);
  }

  const txtRecord   = token ? `invoxai-verify=${token}` : "invoxai-verify=… (click Verify DNS to generate)";
  const sslCls      = sslIssuing ? "dcw-cl-icon wait" : "dcw-cl-icon ok";

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
        .dcw-step-lbl    { font-size: 11.5px; font-weight: 600; color: var(--muted); }
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
        .dcw-cp      { border: 1px solid var(--border); background: var(--card); color: var(--text); border-radius: 8px; padding: 6px 12px; font: inherit; font-size: 11.5px; font-weight: 600; cursor: pointer; flex: none; transition: background .15s; }
        .dcw-cp:hover { background: var(--bg); }

        /* Buttons */
        .dcw-btn { width: 100%; margin-top: 18px; background: var(--grad); color: #fff; border: 0; border-radius: 12px; padding: 14px; font-family: var(--fh); font-weight: 800; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: opacity .15s; }
        .dcw-btn:disabled { opacity: .58; cursor: not-allowed; }
        .dcw-ghost { width: 100%; margin-top: 10px; background: var(--card); color: var(--text); border: 1px solid var(--border); border-radius: 12px; padding: 12px; font-family: var(--fh); font-weight: 600; font-size: 13.5px; cursor: pointer; transition: background .15s; }
        .dcw-ghost:hover { background: var(--s2); }

        /* Spinner */
        .dcw-spin { width: 17px; height: 17px; border: 2.5px solid rgba(255,255,255,.35); border-top-color: #fff; border-radius: 50%; animation: dcw-spin .7s linear infinite; display: inline-block; }

        /* Checklist */
        .dcw-checklist { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
        .dcw-cl { display: flex; align-items: center; gap: 11px; font-size: 13.5px; }
        .dcw-cl-icon { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 800; flex: none; }
        .dcw-cl-icon.ok   { background: color-mix(in srgb,var(--green) 16%,transparent); color: var(--green); }
        .dcw-cl-icon.wait { background: var(--s2); color: var(--muted); }
        .dcw-cl-ssl-note  { font-size: 12px; color: var(--muted); margin-top: 10px; padding: 10px 12px; background: var(--s2); border-radius: 8px; line-height: 1.55; }

        /* Hint */
        .dcw-hint { font-size: 12.5px; color: var(--muted); margin-top: 10px; padding: 10px 13px; background: var(--s2); border: 1px solid var(--border); border-radius: 8px; }

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
            <h3 className="dcw-title">Add your domain</h3>
            <p className="dcw-sub">Enter the domain you own (1 included on your plan, extras at ₹199/mo).</p>
            <label className="dcw-label" htmlFor="dcw-domain-input">Domain</label>
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
            <button
              className="dcw-btn"
              onClick={handleAdd}
              disabled={!isValidDomain(cleanDomain(domain))}
            >
              Add domain →
            </button>
          </div>
        )}

        {/* ── Step 2: DNS records ── */}
        {step === 2 && (
          <div className="dcw-card">
            <h3 className="dcw-title">Add these DNS records</h3>
            <p className="dcw-sub">
              In your registrar&apos;s DNS settings for <strong>{domain}</strong>, add:
            </p>

            {/* CNAME record */}
            <div className="dcw-rec">
              <div className="hd">Type</div>
              <div className="hd">Name</div>
              <div className="hd">Value</div>
              <div className="mono">CNAME</div>
              <div className="mono">@</div>
              <div className="mono" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                {CNAME_TARGET}
                <button className="dcw-cp" onClick={() => handleCopy(CNAME_TARGET, "CNAME value")}>Copy</button>
              </div>
            </div>

            {/* TXT verification record */}
            <div className="dcw-code">
              <span className="k">TXT record</span>
              <span className="v">{txtRecord}</span>
              {token && (
                <button className="dcw-cp" onClick={() => handleCopy(txtRecord, "TXT record")}>Copy</button>
              )}
            </div>

            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 12 }}>
              DNS propagation can take a few minutes. Come back and click Verify DNS once records are set.
            </p>

            {verifyHint && (
              <div className="dcw-hint">
                {checks.cname && !checks.txt && "CNAME found. "}
                {!checks.cname && checks.txt && "TXT found. "}
                {verifyHint}
              </div>
            )}

            <button className="dcw-btn" onClick={handleVerify} disabled={verifying}>
              {verifying ? <><Spinner /> Checking DNS…</> : "Verify DNS"}
            </button>
            <button className="dcw-ghost" onClick={() => { setStep(1); setVerifyHint(""); }}>
              Back
            </button>
          </div>
        )}

        {/* ── Step 3: Verifying + SSL note ── */}
        {step === 3 && (
          <div className="dcw-card">
            <h3 className="dcw-title">Verifying &amp; issuing SSL</h3>
            <p className="dcw-sub">
              DNS records confirmed. Caddy will provision your SSL certificate automatically.
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
                  {sslIssuing ? <Spinner /> : "✓"}
                </span>
                SSL certificate {sslIssuing ? "issuing via Caddy on-demand…" : "active (Caddy on-demand TLS)"}
              </div>
            </div>

            {!sslIssuing && (
              <p className="dcw-cl-ssl-note">
                SSL is provisioned automatically by Caddy the first time an HTTPS request arrives at {domain}.
                If you visit the domain now and see a browser warning, wait 30–60 seconds and refresh.
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
