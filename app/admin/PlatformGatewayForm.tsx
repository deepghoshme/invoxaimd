"use client";

import { useState, useEffect, useRef } from "react";
import { savePlatformGateway } from "./actions";

/* ── Gateway definitions ─────────────────────────────────────────────────── */
type GatewayDef = {
  key: string;
  name: string;
  abbr: string;
  color: string;
  desc: string;
  keyLabel: string;
  keyPh: string;
  live: boolean;
};

const GATEWAYS: GatewayDef[] = [
  { key: "razorpay", name: "Razorpay", abbr: "Rzp", color: "#0b3c82", desc: "UPI · cards · netbanking", keyLabel: "Key ID",          keyPh: "rzp_live_xxxxxxxx", live: true  },
  { key: "cashfree", name: "Cashfree", abbr: "CF",  color: "#5b2be0", desc: "UPI · cards · EMI",        keyLabel: "App ID",          keyPh: "CF_xxxxxxxx",       live: false },
  { key: "stripe",   name: "Stripe",   abbr: "S",   color: "#635bff", desc: "International cards",      keyLabel: "Publishable key", keyPh: "pk_live_xxxxxxxx", live: false },
  { key: "payu",     name: "PayU",     abbr: "PU",  color: "#a0d911", desc: "Cards · UPI · EMI",        keyLabel: "Merchant key",    keyPh: "xxxxxxxx",          live: false },
  { key: "phonepe",  name: "PhonePe",  abbr: "Pe",  color: "#5f259f", desc: "UPI-first",                keyLabel: "Merchant ID",     keyPh: "MERCHANTxxxx",      live: false },
];

export type PlatformGatewayData = {
  provider: string;
  key_id: string | null;
  has_secret: boolean;
  mode: string;
  is_enabled: boolean;
} | null;

/* ── Toast ─────────────────────────────────────────────────────────────────── */
function Toast({ msg, kind }: { msg: string; kind: "ok" | "error" }) {
  return (
    <div className={`pgw-toast${kind === "error" ? " pgw-toast-err" : ""}`}>
      <span className="pgw-toast-dot" />
      {msg}
    </div>
  );
}

/* ── Migration pending banner ─────────────────────────────────────────────── */
function PendingBanner() {
  return (
    <div className="pgw-pending-banner">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div>
        <strong>Migration not yet applied.</strong> Run the following command to activate the platform gateway table, then reload this page.
        <code className="pgw-code">node scripts/db-apply.mjs supabase/migrations/20260618250000_platform_gateways.sql</code>
      </div>
    </div>
  );
}

/* ── Main form ─────────────────────────────────────────────────────────────── */
export default function PlatformGatewayForm({ initial }: { initial: PlatformGatewayData }) {
  const migrationPending = initial === null;

  const [sel, setSel]           = useState<string>(initial?.provider ?? "razorpay");
  const [keyId, setKeyId]       = useState(initial?.key_id ?? "");
  const [secret, setSecret]     = useState("");
  const [enabled, setEnabled]   = useState(initial?.is_enabled ?? false);
  const [mode, setMode]         = useState<"test" | "live">((initial?.mode as "test" | "live") ?? "test");
  const [hasSecret, setHasSecret] = useState(initial?.has_secret ?? false);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState<{ msg: string; kind: "ok" | "error" } | null>(null);
  const toastTimer              = useRef<ReturnType<typeof setTimeout> | null>(null);

  function fire(msg: string, kind: "ok" | "error" = "ok") {
    setToast({ msg, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }

  const def = GATEWAYS.find((g) => g.key === sel) ?? GATEWAYS[0];

  // When a gateway card is clicked, reset the form to the current saved data
  // (for the singleton row, we only have one set of keys regardless of which
  // provider is selected — non-Razorpay gateways are "coming soon").
  useEffect(() => {
    if (sel === (initial?.provider ?? "razorpay")) {
      setKeyId(initial?.key_id ?? "");
      setEnabled(initial?.is_enabled ?? false);
      setMode((initial?.mode as "test" | "live") ?? "test");
      setHasSecret(initial?.has_secret ?? false);
    } else {
      setKeyId("");
      setEnabled(false);
      setMode("test");
      setHasSecret(false);
    }
    setSecret("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  async function handleSave() {
    if (saving || migrationPending) return;

    if (!def.live) {
      fire(`${def.name} integration is coming soon — keys cannot be saved yet.`, "error");
      return;
    }
    if (enabled && !keyId.trim()) {
      fire(`Enter a ${def.name} Key ID to enable the gateway.`, "error");
      return;
    }
    if (enabled && !hasSecret && !secret.trim()) {
      fire(`Enter the ${def.name} Key Secret to enable the gateway.`, "error");
      return;
    }

    setSaving(true);
    const res = await savePlatformGateway({
      provider: def.key,
      key_id: keyId,
      key_secret: secret,
      is_enabled: enabled,
      mode,
    });
    setSaving(false);

    if (!res.ok) { fire(res.error ?? "Save failed.", "error"); return; }
    if (secret.trim()) setHasSecret(true);
    setSecret("");
    fire(enabled
      ? `${def.name} platform gateway active — platform billing enabled.`
      : `${def.name} saved — gateway disabled.`
    );
  }

  return (
    <div className="pgw-wrap">
      <style>{`
        /* scoped to pgw- prefix — never touches shared dx- styles */
        .pgw-wrap { max-width: 780px; }

        .pgw-pending-banner {
          display: flex; gap: 12px; align-items: flex-start;
          background: color-mix(in srgb, var(--gold) 12%, transparent);
          border: 1.5px solid color-mix(in srgb, var(--gold) 35%, transparent);
          border-radius: 13px; padding: 14px 16px;
          font-size: 13px; color: var(--text); margin-bottom: 20px;
        }
        .pgw-code {
          display: block; margin-top: 8px;
          font-family: ui-monospace, Menlo, monospace; font-size: 12px;
          background: color-mix(in srgb, var(--text) 8%, transparent);
          border-radius: 7px; padding: 8px 12px; word-break: break-all;
          border: 1px solid var(--border);
        }

        .pgw-note {
          display: flex; gap: 10px; align-items: flex-start;
          background: color-mix(in srgb, var(--accent) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
          border-radius: 12px; padding: 13px 15px;
          font-size: 13px; margin-bottom: 18px;
        }
        .pgw-note-ic { font-size: 15px; flex-shrink: 0; margin-top: 1px; }

        .pgw-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 10px; margin-bottom: 20px;
        }
        .pgw-card-sel {
          display: flex; align-items: center; gap: 10px;
          border: 1.5px solid var(--border); border-radius: 13px;
          padding: 13px 14px; cursor: pointer; background: var(--surface);
          font: inherit; color: var(--text); text-align: left;
          transition: border-color .15s;
        }
        .pgw-card-sel:hover { border-color: color-mix(in srgb, var(--primary) 50%, transparent); }
        .pgw-card-sel.on {
          border-color: var(--primary);
          background: color-mix(in srgb, var(--primary) 6%, transparent);
        }
        .pgw-abbr {
          width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
          display: grid; place-items: center;
          font-weight: 800; font-size: 11px; color: #fff;
          font-family: "Sora", sans-serif;
        }
        .pgw-meta .pgw-name { font-weight: 700; font-size: 13.5px; }
        .pgw-meta .pgw-desc { font-size: 11.5px; color: var(--muted); margin-top: 1px; }
        .pgw-badges { margin-left: auto; display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
        .pgw-badge-live {
          font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 99px;
          background: color-mix(in srgb, var(--green) 16%, transparent);
          color: var(--green);
        }
        .pgw-badge-soon {
          font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 99px;
          background: var(--surface2); color: var(--muted);
        }

        .pgw-config {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 16px; padding: 22px; box-shadow: var(--shadow);
        }
        .pgw-config-head {
          display: flex; align-items: center; gap: 11px; margin-bottom: 16px;
        }
        .pgw-config-head h3 { font-size: 16px; margin: 0; }
        .pgw-coming-label {
          font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 99px;
          background: var(--surface2); color: var(--muted);
        }

        /* toggle switch */
        .pgw-sw {
          width: 46px; height: 26px; border-radius: 999px; background: var(--border);
          border: 0; cursor: pointer; position: relative; flex-shrink: 0; margin-left: auto;
          transition: background .2s;
        }
        .pgw-sw.on { background: var(--grad, linear-gradient(135deg,#ffb23e,#ff6a3d 38%,#ff4d7d 68%,#7b3fe4)); }
        .pgw-sw.disabled { opacity: .45; cursor: not-allowed; }
        .pgw-sw i {
          position: absolute; top: 3px; left: 3px;
          width: 20px; height: 20px; border-radius: 50%; background: #fff;
          transition: transform .18s; pointer-events: none;
        }
        .pgw-sw.on i { transform: translateX(20px); }

        .pgw-seg {
          display: inline-flex; background: var(--surface2);
          border: 1px solid var(--border); border-radius: 999px;
          padding: 3px; gap: 2px; margin-bottom: 16px;
        }
        .pgw-seg button {
          border: 0; background: none; font: inherit; font-weight: 600;
          font-size: 12px; color: var(--muted); padding: 7px 14px;
          border-radius: 999px; cursor: pointer;
        }
        .pgw-seg button.on {
          background: var(--surface); color: var(--text);
          box-shadow: 0 1px 3px rgba(0,0,0,.14);
        }

        .pgw-label {
          display: block; font-size: 12.5px; font-weight: 700;
          margin: 12px 0 6px; color: var(--text);
        }
        .pgw-label-hint { font-weight: 400; color: var(--muted); }
        .pgw-input {
          width: 100%; padding: 11px 13px; font: inherit; font-size: 14px;
          color: var(--text); background: var(--surface2);
          border: 1.5px solid var(--border); border-radius: 11px; outline: none;
          font-family: ui-monospace, Menlo, monospace;
        }
        .pgw-input:focus { border-color: var(--primary); }
        .pgw-input:disabled { opacity: .5; cursor: not-allowed; }

        .pgw-actions { display: flex; gap: 9px; margin-top: 18px; }
        .pgw-btn {
          font: inherit; font-weight: 700; font-size: 13.5px;
          border: 1px solid var(--border); background: var(--surface);
          color: var(--text); padding: 11px 18px; border-radius: 11px;
          cursor: pointer; display: inline-flex; align-items: center; gap: 7px;
        }
        .pgw-btn:disabled { opacity: .55; cursor: not-allowed; }
        .pgw-btn.pgw-btn-grad {
          background: var(--grad, linear-gradient(135deg,#ffb23e,#ff6a3d 38%,#ff4d7d 68%,#7b3fe4));
          color: #fff; border-color: transparent;
        }
        @keyframes pgw-spin { to { transform: rotate(360deg); } }
        .pgw-spin {
          width: 14px; height: 14px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,.3); border-top-color: #fff;
          animation: pgw-spin .7s linear infinite; display: inline-block;
        }
        .pgw-secure { font-size: 11.5px; color: var(--muted); margin-top: 12px; }

        @keyframes pgw-toast-in {
          from { transform: translate(-50%, 80%); opacity: 0; }
          to   { transform: translate(-50%, 0);   opacity: 1; }
        }
        .pgw-toast {
          position: fixed; left: 50%; bottom: 28px; z-index: 200;
          background: #18121f; color: #fff; padding: 11px 20px; border-radius: 12px;
          font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 9px;
          box-shadow: 0 20px 50px -20px rgba(0,0,0,.6);
          animation: pgw-toast-in .35s ease;
          white-space: nowrap;
        }
        .pgw-toast.pgw-toast-err { background: #3a1822; }
        .pgw-toast-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #36c98e; flex-shrink: 0;
        }
        .pgw-toast.pgw-toast-err .pgw-toast-dot { background: #e5476f; }
      `}</style>

      {migrationPending && <PendingBanner />}

      {!migrationPending && (
        <div className="pgw-note">
          <span className="pgw-note-ic">&#x1F512;</span>
          <div>
            Platform gateway credentials are <strong>admin-only</strong> — never publicly readable.
            These keys charge sellers for plans and wallet recharge. Funds from seller transactions
            flow through each seller&apos;s own gateway, not this one.
          </div>
        </div>
      )}

      <div className="pgw-grid">
        {GATEWAYS.map((g) => (
          <button
            key={g.key}
            type="button"
            className={`pgw-card-sel${sel === g.key ? " on" : ""}`}
            onClick={() => setSel(g.key)}
            disabled={migrationPending}
          >
            <span className="pgw-abbr" style={{ background: g.color }}>{g.abbr}</span>
            <div className="pgw-meta">
              <div className="pgw-name">{g.name}</div>
              <div className="pgw-desc">{g.desc}</div>
            </div>
            <div className="pgw-badges">
              {g.key === sel && enabled && g.live && <span className="pgw-badge-live">Live</span>}
              {!g.live && <span className="pgw-badge-soon">Soon</span>}
            </div>
          </button>
        ))}
      </div>

      <div className="pgw-config">
        <div className="pgw-config-head">
          <span className="pgw-abbr" style={{ background: def.color }}>{def.abbr}</span>
          <h3>{def.name}</h3>
          {!def.live && <span className="pgw-coming-label">Coming soon</span>}
          <button
            type="button"
            className={`pgw-sw${enabled ? " on" : ""}${(!def.live || migrationPending) ? " disabled" : ""}`}
            disabled={!def.live || migrationPending}
            onClick={() => {
              if (!def.live) {
                fire(`${def.name} integration is coming soon — cannot be activated yet.`, "error");
                return;
              }
              setEnabled((v) => !v);
            }}
            aria-label={`${enabled ? "Disable" : "Enable"} ${def.name}`}
          >
            <i />
          </button>
        </div>

        <div className="pgw-seg">
          <button
            type="button"
            className={mode === "test" ? "on" : ""}
            onClick={() => setMode("test")}
            disabled={migrationPending}
          >
            Test mode
          </button>
          <button
            type="button"
            className={mode === "live" ? "on" : ""}
            onClick={() => setMode("live")}
            disabled={migrationPending}
          >
            Live mode
          </button>
        </div>

        <label className="pgw-label">{def.keyLabel}</label>
        <input
          className="pgw-input"
          value={keyId}
          onChange={(e) => setKeyId(e.target.value)}
          placeholder={def.keyPh}
          autoComplete="off"
          disabled={!def.live || migrationPending}
        />

        <label className="pgw-label">
          Key secret
          {hasSecret && <span className="pgw-label-hint"> (saved — leave blank to keep)</span>}
        </label>
        <input
          className="pgw-input"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={hasSecret ? "············" : "················"}
          autoComplete="new-password"
          disabled={!def.live || migrationPending}
        />

        <div className="pgw-actions">
          <button
            type="button"
            className="pgw-btn pgw-btn-grad"
            onClick={handleSave}
            disabled={saving || migrationPending}
          >
            {saving ? <><span className="pgw-spin" />Saving…</> : "Save & connect"}
          </button>
        </div>

        <p className="pgw-secure">
          {migrationPending
            ? "Apply the migration above to unlock platform gateway configuration."
            : def.live
              ? `Need help? See the ${def.name} dashboard — Settings — API Keys. Use test-mode keys during staging; switch to live-mode for production billing.`
              : `${def.name} platform integration is coming soon. You can note your keys for when it launches.`
          }
        </p>
      </div>

      {toast && <Toast msg={toast.msg} kind={toast.kind} />}
    </div>
  );
}
