"use client";

import { useState, useRef } from "react";
import { Phead, Card, Switch } from "@/components/dx/ui";
import { saveMaintenanceSettings } from "./actions";

interface Props {
  maintenanceMode: boolean;
  maintenanceEta: string;
  allowSignups: boolean;
  forceHttps: boolean;
  /** True once migration 20260618260000 has been applied. */
  newColsExist: boolean;
}

type Toast = { msg: string; kind: "ok" | "err" | "warn" };

function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fire = (msg: string, kind: Toast["kind"] = "ok") => {
    setToast({ msg, kind });
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setToast(null), 4000);
  };
  return { toast, fire };
}

export default function MaintenanceClient({
  maintenanceMode: initMaint,
  maintenanceEta: initEta,
  allowSignups: initSignups,
  forceHttps: initHttps,
  newColsExist,
}: Props) {
  const { toast, fire } = useToast();
  const [saving, setSaving] = useState(false);

  const [maintMode, setMaintMode] = useState(initMaint);
  const [eta, setEta] = useState(initEta);
  const [allowSignups, setAllowSignups] = useState(initSignups);
  const [forceHttps, setForceHttps] = useState(initHttps);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData();
    fd.set("maintenance_mode", String(maintMode));
    fd.set("maintenance_eta", eta);
    fd.set("allow_signups", String(allowSignups));
    fd.set("force_https", String(forceHttps));
    const res = await saveMaintenanceSettings(fd);
    setSaving(false);
    if (res.ok) {
      fire(res.error ?? "Maintenance settings saved.", res.error ? "warn" : "ok");
    } else {
      fire(res.error ?? "Failed.", "err");
    }
  }

  return (
    <>
      <style>{`
        .mc-srow{display:flex;align-items:center;gap:14px;padding:13px 0;border-top:1px solid var(--dx-border)}
        .mc-srow:first-child{border-top:0}
        .mc-tx{flex:1}
        .mc-tx b{font-size:13.5px;display:block}
        .mc-tx p{font-size:12px;color:var(--dx-muted);margin:3px 0 0}
        .mc-field{margin:12px 0}
        .mc-field label{display:block;font-size:12.5px;font-weight:600;margin-bottom:5px}
        .mc-field input{width:100%;padding:9px 12px;border:1.5px solid var(--dx-border);border-radius:10px;background:var(--dx-bg);color:var(--dx-text);font:inherit;outline:none}
        .mc-field input:focus{border-color:var(--dx-primary)}
        .mc-field small{font-size:11.5px;color:var(--dx-muted);display:block;margin-top:4px}
        .mc-btn{font:inherit;font-weight:600;font-size:13px;border:0;border-radius:10px;padding:10px 18px;cursor:pointer;color:#fff;background:var(--dx-grad);display:inline-flex;align-items:center;gap:6px}
        .mc-btn:disabled{opacity:.55;cursor:not-allowed}
        .mc-warn{background:color-mix(in srgb, var(--dx-gold, #ffb23e) 14%, transparent);border:1px solid color-mix(in srgb, var(--dx-gold, #ffb23e) 35%, transparent);border-radius:10px;padding:11px 14px;font-size:12.5px;margin-bottom:14px}
        .mc-warn b{color:var(--dx-gold, #ffb23e)}
        .mc-maint-on{background:color-mix(in srgb, #e5476f 10%, transparent);border:1px solid color-mix(in srgb, #e5476f 30%, transparent);border-radius:12px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;color:#e5476f}
        .mc-maint-on span{flex:1}
        .mc-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:100;padding:12px 20px;border-radius:12px;font-size:13.5px;font-weight:600;box-shadow:0 20px 50px -20px rgba(0,0,0,.5);display:flex;align-items:center;gap:9px;white-space:nowrap;max-width:90vw}
        .mc-toast.ok{background:#18121f;color:#fff}
        .mc-toast.err{background:#3a1822;color:#e5476f}
        .mc-toast.warn{background:#2a1f10;color:#ffb23e}
        .mc-toast .dot{width:8px;height:8px;border-radius:50%;flex:none}
        .mc-toast.ok .dot{background:#36c98e}
        .mc-toast.err .dot{background:#e5476f}
        .mc-toast.warn .dot{background:#ffb23e}
        .mc-note{font-size:11.5px;color:var(--dx-muted);font-style:italic;margin-top:4px}
      `}</style>

      <Phead
        title="Maintenance & controls"
        sub="Platform-wide switches — changes take effect immediately."
        action={
          <button className="mc-btn" type="submit" form="maint-form" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        }
      />

      {maintMode && (
        <div className="mc-maint-on">
          <span>Maintenance mode is ACTIVE — public pages are showing the maintenance screen.</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
      )}

      {!newColsExist && (
        <div className="mc-warn">
          <b>Migration pending:</b> allow_signups and force_https columns do not exist yet. Those toggles will be saved once migration 20260618260000 is applied. Maintenance mode and ETA save normally now.
        </div>
      )}

      <form id="maint-form" onSubmit={handleSave}>
        <Card title="Controls">
          <div className="mc-srow">
            <div className="mc-tx">
              <b>Maintenance mode</b>
              <p>Show the maintenance page to all public visitors. Seller dashboard and admin remain accessible.</p>
            </div>
            <Switch on={maintMode} onChange={setMaintMode} />
          </div>

          {maintMode && (
            <div className="mc-field">
              <label>ETA / message</label>
              <input
                value={eta}
                onChange={(e) => setEta(e.target.value)}
                placeholder="Back at 2:30 PM IST — routine database maintenance."
              />
              <small>Shown on the public maintenance page. Leave blank to hide.</small>
            </div>
          )}

          <div className="mc-srow">
            <div className="mc-tx">
              <b>New seller signups</b>
              <p>Allow new sellers to register and complete onboarding.</p>
              {!newColsExist && <span className="mc-note">Requires migration 20260618260000.</span>}
            </div>
            <Switch on={allowSignups} onChange={setAllowSignups} disabled={!newColsExist} />
          </div>

          <div className="mc-srow">
            <div className="mc-tx">
              <b>Force HTTPS</b>
              <p>
                Records the HTTPS intent. Caddy enforces TLS on the infrastructure level — toggling
                this alone does not add/remove SSL. A Caddy config reload is required for
                infrastructure changes.
              </p>
              {!newColsExist && <span className="mc-note">Requires migration 20260618260000.</span>}
            </div>
            <Switch on={forceHttps} onChange={setForceHttps} disabled={!newColsExist} />
          </div>
        </Card>
      </form>

      {toast && (
        <div className={`mc-toast ${toast.kind}`}>
          <span className="dot" />
          {toast.msg}
        </div>
      )}
    </>
  );
}
