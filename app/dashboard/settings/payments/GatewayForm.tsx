"use client";

import { useState } from "react";
import { saveGateway } from "./actions";

export default function GatewayForm({
  initial,
}: {
  initial: { key_id: string; is_enabled: boolean; has_secret: boolean };
}) {
  const [keyId, setKeyId] = useState(initial.key_id);
  const [secret, setSecret] = useState("");
  const [enabled, setEnabled] = useState(initial.is_enabled);
  const [hasSecret, setHasSecret] = useState(initial.has_secret);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    setErr(null);
    if (enabled && !keyId.trim()) {
      setErr("Enter your Razorpay Key ID to enable payments.");
      setSaving(false);
      return;
    }
    if (enabled && !hasSecret && !secret.trim()) {
      setErr("Enter your Razorpay Key Secret to enable payments.");
      setSaving(false);
      return;
    }
    const res = await saveGateway({ key_id: keyId, key_secret: secret, is_enabled: enabled });
    setSaving(false);
    if (!res.ok) {
      setErr(res.error ?? "Save failed");
      return;
    }
    if (secret.trim()) setHasSecret(true);
    setSecret("");
    setMsg("Saved ✓");
    setTimeout(() => setMsg(null), 1800);
  }

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
        <h2 style={{ margin: 0 }}>Razorpay</h2>
        <button
          role="switch"
          aria-checked={enabled}
          className={`switch${enabled ? " on" : ""}`}
          onClick={() => setEnabled((v) => !v)}
        >
          <span className="switch-knob" />
        </button>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Connect your own Razorpay account — buyers pay you directly. Find your keys in
        the Razorpay Dashboard → Settings → API Keys.
      </p>

      <div className="field">
        <label className="label">Key ID</label>
        <input className="input" value={keyId} onChange={(e) => setKeyId(e.target.value)} placeholder="rzp_live_XXXXXXXX" />
      </div>
      <div className="field">
        <label className="label">Key Secret {hasSecret && <span className="muted">(saved — leave blank to keep)</span>}</label>
        <input
          className="input"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={hasSecret ? "••••••••••••" : "Your Razorpay secret"}
        />
        <p className="hint">Stored server-side and never shown again. Used only to create &amp; verify payments.</p>
      </div>

      {err && <div className="alert alert-error">{err}</div>}
      {msg && <div className="alert alert-ok">{msg}</div>}

      <button className="btn btn-gradient" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
