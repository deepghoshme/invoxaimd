"use client";

import { useState, useRef } from "react";
import { Phead, Card } from "@/components/dx/ui";
import {
  saveGeneralSettings,
  addReservedSubdomain,
  removeReservedSubdomain,
} from "./actions";

interface Props {
  platformName: string;
  supportEmail: string;
  reserved: { name: string; reason: string | null }[];
}

type Toast = { msg: string; kind: "ok" | "err" };

function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fire = (msg: string, kind: Toast["kind"] = "ok") => {
    setToast({ msg, kind });
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setToast(null), 3200);
  };
  return { toast, fire };
}

export default function SettingsClient({ platformName, supportEmail, reserved }: Props) {
  const { toast, fire } = useToast();
  const [saving, setSaving] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [removingName, setRemovingName] = useState<string | null>(null);
  const [list, setList] = useState(reserved);
  const [newName, setNewName] = useState("");
  const [newReason, setNewReason] = useState("");

  async function handleSaveGeneral(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const res = await saveGeneralSettings(fd);
    setSaving(false);
    fire(res.error ?? "Settings saved.", res.ok ? "ok" : "err");
  }

  async function handleAddSubdomain(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddSaving(true);
    const fd = new FormData(e.currentTarget);
    const res = await addReservedSubdomain(fd);
    setAddSaving(false);
    if (res.ok) {
      setList((l) => [...l, { name: newName.trim().toLowerCase(), reason: newReason.trim() || "reserved" }].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      setNewReason("");
      fire("Subdomain reserved.");
    } else {
      fire(res.error ?? "Failed.", "err");
    }
  }

  async function handleRemove(name: string) {
    if (!confirm(`Remove "${name}" from reserved list?`)) return;
    setRemovingName(name);
    const res = await removeReservedSubdomain(name);
    setRemovingName(null);
    if (res.ok) {
      setList((l) => l.filter((r) => r.name !== name));
      fire(`"${name}" removed.`);
    } else {
      fire(res.error ?? "Failed.", "err");
    }
  }

  return (
    <>
      <style>{`
        .pc-srow{display:flex;align-items:flex-start;gap:12px;padding:11px 0;border-top:1px solid var(--dx-border)}
        .pc-srow:first-child{border-top:0}
        .pc-srow .tx{flex:1}
        .pc-srow .tx b{font-size:13.5px;display:block}
        .pc-srow .tx p{font-size:12px;color:var(--dx-muted);margin:3px 0 0}
        .pc-field{margin-bottom:13px}
        .pc-field label{display:block;font-size:12.5px;font-weight:600;margin-bottom:5px}
        .pc-field input{width:100%;padding:9px 12px;border:1.5px solid var(--dx-border);border-radius:10px;background:var(--dx-bg);color:var(--dx-text);font:inherit;outline:none}
        .pc-field input:focus{border-color:var(--dx-primary)}
        .pc-field small{display:block;font-size:11.5px;color:var(--dx-muted);margin-top:5px}
        .pc-ff{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .pc-btn{font:inherit;font-weight:600;font-size:13px;border:0;border-radius:10px;padding:10px 18px;cursor:pointer;color:#fff;background:var(--dx-primary);display:inline-flex;align-items:center;gap:6px}
        .pc-btn:disabled{opacity:.55;cursor:not-allowed}
        .pc-btn.ghost{background:var(--dx-surface);color:var(--dx-text);border:1px solid var(--dx-border)}
        .pc-btn.ghost:hover:not(:disabled){border-color:var(--dx-muted)}
        .pc-btn.grad{background:var(--dx-grad)}
        .pc-btn.danger{background:#e5476f;font-size:12px;padding:5px 11px;border-radius:8px}
        .pc-sub-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--dx-border)}
        .pc-sub-row:first-child{border-top:0}
        .pc-sub-name{font-size:13px;font-weight:600;font-family:ui-monospace,Menlo,monospace;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .pc-sub-reason{font-size:11.5px;color:var(--dx-muted);width:110px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .pc-info{background:color-mix(in srgb, var(--dx-accent) 10%, transparent);border:1px solid color-mix(in srgb, var(--dx-accent) 30%, transparent);border-radius:10px;padding:12px 14px;font-size:12.5px;color:var(--dx-text);margin-bottom:16px}
        .pc-info b{color:var(--dx-accent)}
        .pc-ops-box{border:1.5px dashed var(--dx-border);border-radius:12px;padding:16px 18px;margin-top:4px}
        .pc-ops-box h4{margin:0 0 8px;font-size:13.5px}
        .pc-ops-box ol{margin:8px 0 0 16px;padding:0;font-size:12.5px;color:var(--dx-muted);line-height:1.7}
        .pc-grid{display:grid;gap:16px;grid-template-columns:1.4fr 1fr;align-items:start}
        @media(max-width:700px){.pc-grid{grid-template-columns:1fr}.pc-ff{grid-template-columns:1fr}}
        .pc-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:100;padding:12px 20px;border-radius:12px;font-size:13.5px;font-weight:600;box-shadow:0 20px 50px -20px rgba(0,0,0,.5);display:flex;align-items:center;gap:9px;white-space:nowrap}
        .pc-toast.ok{background:#18121f;color:#fff}
        .pc-toast.err{background:#3a1822;color:#e5476f}
        .pc-toast .dot{width:8px;height:8px;border-radius:50%}
        .pc-toast.ok .dot{background:#36c98e}
        .pc-toast.err .dot{background:#e5476f}
      `}</style>

      <Phead title="Settings" sub="General platform configuration, reserved subdomains, and ops tasks." />

      <div className="pc-grid">
        {/* Left column: General + ops */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="General">
            <form onSubmit={handleSaveGeneral}>
              <div className="pc-field">
                <label>Platform name</label>
                <input name="platform_name" defaultValue={platformName} placeholder="invoxai" />
                <small>Shown in emails and the admin interface.</small>
              </div>
              <div className="pc-field">
                <label>Support email</label>
                <input name="support_email" type="email" defaultValue={supportEmail} placeholder="support@invoxai.io" />
                <small>Displayed in automated emails and seller help pages.</small>
              </div>
              <button className="btn grad" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save settings"}
              </button>
            </form>
          </Card>

          <Card title="Rotate service keys">
            <div className="pc-info">
              <b>Ops task — cannot be performed from the UI.</b>{" "}
              Rotating Supabase service keys and JWT secrets requires direct database access to avoid dropping live sessions.
            </div>
            <div className="pc-ops-box">
              <h4>How to rotate</h4>
              <ol>
                <li>Go to Supabase Dashboard → Project Settings → API</li>
                <li>Generate a new Service Role key</li>
                <li>Update <code>SUPABASE_SERVICE_ROLE_KEY</code> in <code>/etc/invoxai.env</code></li>
                <li>Run: <code>sudo systemctl restart invoxai-web</code></li>
                <li>Revoke the old key in Supabase Dashboard</li>
              </ol>
            </div>
          </Card>
        </div>

        {/* Right column: Reserved subdomains */}
        <Card title={`Reserved subdomains (${list.length})`}>
          <form onSubmit={handleAddSubdomain} style={{ marginBottom: 14 }}>
            <div className="pc-ff" style={{ marginBottom: 9 }}>
              <div className="pc-field" style={{ marginBottom: 0 }}>
                <label>Subdomain</label>
                <input
                  name="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="myname"
                  autoComplete="off"
                />
              </div>
              <div className="pc-field" style={{ marginBottom: 0 }}>
                <label>Reason</label>
                <input
                  name="reason"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="reserved"
                />
              </div>
            </div>
            <button className="pc-btn" type="submit" disabled={addSaving || !newName.trim()}>
              {addSaving ? "Adding…" : "+ Reserve"}
            </button>
          </form>

          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {list.map((r) => (
              <div className="pc-sub-row" key={r.name}>
                <span className="pc-sub-name">{r.name}</span>
                <span className="pc-sub-reason">{r.reason ?? "—"}</span>
                <button
                  className="pc-btn danger"
                  type="button"
                  disabled={removingName === r.name}
                  onClick={() => handleRemove(r.name)}
                >
                  {removingName === r.name ? "…" : "Remove"}
                </button>
              </div>
            ))}
            {list.length === 0 && (
              <p style={{ fontSize: 12.5, color: "var(--dx-muted)", margin: 0 }}>No reserved subdomains.</p>
            )}
          </div>
        </Card>
      </div>

      {toast && (
        <div className={`pc-toast ${toast.kind}`}>
          <span className="dot" />
          {toast.msg}
        </div>
      )}
    </>
  );
}
