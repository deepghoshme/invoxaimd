"use client";

import { useState, useEffect, useRef } from "react";
import { saveGateway, testGateway } from "./actions";

/* ── Gateway definitions ────────────────────────────────────────────────── */
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

type GatewayRow = {
  key_id: string;
  has_secret: boolean;
  is_enabled: boolean;
  mode: string;
};

function Toast({ msg, kind }: { msg: string; kind: "ok" | "error" }) {
  return (
    <div className={`gw-toast${kind === "error" ? " gw-toast-err" : ""}`}>
      <span className="gw-toast-dot" />
      {msg}
    </div>
  );
}

export default function GatewayForm({ gwMap }: { gwMap: Record<string, GatewayRow> }) {
  const [sel, setSel] = useState<string>("razorpay");
  const [keyId, setKeyId] = useState("");
  const [secret, setSecret] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<"test" | "live">("test");
  const [hasSecret, setHasSecret] = useState(false);
  const [connected, setConnected] = useState<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {};
    for (const g of GATEWAYS) out[g.key] = !!(gwMap[g.key]?.is_enabled);
    return out;
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "error" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function fire(msg: string, kind: "ok" | "error" = "ok") {
    setToast({ msg, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  useEffect(() => {
    const saved = gwMap[sel];
    setKeyId(saved?.key_id ?? "");
    setSecret("");
    setEnabled(saved?.is_enabled ?? false);
    setMode((saved?.mode as "test" | "live") ?? "test");
    setHasSecret(saved?.has_secret ?? false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const def = GATEWAYS.find((g) => g.key === sel) ?? GATEWAYS[0];

  async function handleSave() {
    if (saving) return;
    if (def.live && enabled && !keyId.trim()) {
      fire(`Enter your ${def.name} Key ID to enable payments.`, "error");
      return;
    }
    if (def.live && enabled && !hasSecret && !secret.trim()) {
      fire(`Enter your ${def.name} Key Secret to enable payments.`, "error");
      return;
    }
    setSaving(true);
    const res = await saveGateway({ provider: def.key, key_id: keyId, key_secret: secret, is_enabled: enabled, mode });
    setSaving(false);
    if (!res.ok) { fire(res.error ?? "Save failed", "error"); return; }
    if (secret.trim()) setHasSecret(true);
    setSecret("");
    setConnected((prev) => ({ ...prev, [def.key]: def.live && enabled }));
    fire(def.live
      ? `${def.name} saved — ${enabled ? "checkout active" : "disabled"}`
      : `${def.name} keys noted (checkout coming soon)`
    );
  }

  async function handleTest() {
    if (testing) return;
    if (!def.live) { fire(`${def.name} integration is coming soon — cannot test yet.`, "error"); return; }
    setTesting(true);
    const res = await testGateway({ provider: def.key, key_id: keyId });
    setTesting(false);
    if (!res.ok) fire(res.error ?? "Test failed", "error");
    else fire(res.message ?? "Key format valid");
  }

  return (
    <div className="gw-page">
      <div className="gw-ph">
        <h1>Connect your payment gateway</h1>
        <p>Buyers pay you directly — funds land in your own account. One gateway configuration covers your subdomain, any extra subdomains, and your custom domain.</p>
      </div>

      <div className="gw-note">
        <span className="gw-note-ic">&#x1F512;</span>
        <div>
          Your keys are stored <strong>encrypted</strong> and used only to create &amp; verify
          orders. We never hold your money or store card data.
        </div>
      </div>

      <div className="gw-grid">
        {GATEWAYS.map((g) => (
          <button
            key={g.key}
            type="button"
            className={`gw-card-sel${sel === g.key ? " on" : ""}`}
            onClick={() => setSel(g.key)}
          >
            <span className="gw-abbr" style={{ background: g.color }}>{g.abbr}</span>
            <div className="gw-meta">
              <div className="gw-name">{g.name}</div>
              <div className="gw-desc">{g.desc}</div>
            </div>
            <div className="gw-badges">
              {connected[g.key] && <span className="gw-badge-live">Live</span>}
              {!g.live && <span className="gw-badge-soon">Soon</span>}
            </div>
          </button>
        ))}
      </div>

      <div className="gw-config">
        <div className="gw-config-head">
          <span className="gw-abbr" style={{ background: def.color }}>{def.abbr}</span>
          <h3>{def.name}</h3>
          {!def.live && <span className="gw-coming-label">Coming soon</span>}
          <button
            type="button"
            className={`gw-sw${enabled ? " on" : ""}${!def.live ? " disabled" : ""}`}
            onClick={() => {
              if (!def.live) {
                fire(`${def.name} integration is coming soon. Keys can be noted but checkout cannot be activated yet.`, "error");
                return;
              }
              setEnabled((v) => !v);
            }}
            aria-label={`${enabled ? "Disable" : "Enable"} ${def.name}`}
          >
            <i />
          </button>
        </div>

        <div className="gw-seg">
          <button type="button" className={mode === "test" ? "on" : ""} onClick={() => setMode("test")}>Test mode</button>
          <button type="button" className={mode === "live" ? "on" : ""} onClick={() => setMode("live")}>Live mode</button>
        </div>

        <label className="gw-label">{def.keyLabel}</label>
        <input
          className="gw-input"
          value={keyId}
          onChange={(e) => setKeyId(e.target.value)}
          placeholder={def.keyPh}
          autoComplete="off"
          disabled={!def.live}
        />

        <label className="gw-label">
          Key secret
          {hasSecret && <span className="gw-label-hint"> (saved — leave blank to keep)</span>}
        </label>
        <input
          className="gw-input"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={hasSecret ? "············" : "················"}
          autoComplete="new-password"
          disabled={!def.live}
        />

        <div className="gw-actions">
          <button type="button" className="gw-btn" onClick={handleTest} disabled={testing}>
            {testing ? <><span className="gw-spin" />Testing…</> : "Test connection"}
          </button>
          <button type="button" className="gw-btn gw-btn-grad" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save & connect"}
          </button>
        </div>

        <p className="gw-secure">
          {def.live
            ? `Need help finding your keys? See the ${def.name} dashboard → Settings → API Keys.`
            : `${def.name} checkout integration is coming soon. You can note your keys for when it launches.`}
        </p>
      </div>

      {toast && <Toast msg={toast.msg} kind={toast.kind} />}
    </div>
  );
}
