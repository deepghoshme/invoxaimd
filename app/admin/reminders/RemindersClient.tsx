"use client";

import { useState } from "react";
import { Phead, Card } from "@/components/dx/ui";
import { saveReminderSettings } from "./actions";

interface Props {
  enabled: boolean;
  intervalMin: number;
  activeOnly: boolean;
  activeWindowDays: number;
  minRevenueRupees: number;
  inactiveAction: "skip" | "nudge";
}

type Toast = { msg: string; kind: "ok" | "err" };

export default function RemindersClient(p: Props) {
  const [enabled, setEnabled] = useState(p.enabled);
  const [activeOnly, setActiveOnly] = useState(p.activeOnly);
  const [intervalMin, setIntervalMin] = useState(String(p.intervalMin));
  const [activeWindowDays, setActiveWindowDays] = useState(String(p.activeWindowDays));
  const [minRevenueRupees, setMinRevenueRupees] = useState(String(p.minRevenueRupees));
  const [inactiveAction, setInactiveAction] = useState<"skip" | "nudge">(p.inactiveAction);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  function fire(msg: string, kind: Toast["kind"] = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3200);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData();
    fd.set("enabled", enabled ? "on" : "");
    fd.set("active_only", activeOnly ? "on" : "");
    fd.set("interval_min", intervalMin);
    fd.set("active_window_days", activeWindowDays);
    fd.set("min_revenue_rupees", minRevenueRupees);
    fd.set("inactive_action", inactiveAction);
    const res = await saveReminderSettings(fd);
    setSaving(false);
    fire(res.ok ? "Reminder settings saved." : res.error ?? "Failed to save.", res.ok ? "ok" : "err");
  }

  return (
    <>
      <style>{`
        .rm-field{margin-bottom:15px}
        .rm-field label{display:block;font-size:12.5px;font-weight:600;margin-bottom:5px}
        .rm-field input[type=number],.rm-field select{width:100%;padding:9px 12px;border:1.5px solid var(--dx-border);border-radius:10px;background:var(--dx-bg);color:var(--dx-text);font:inherit;outline:none}
        .rm-field input:focus,.rm-field select:focus{border-color:var(--dx-primary)}
        .rm-field small{display:block;font-size:11.5px;color:var(--dx-muted);margin-top:5px}
        .rm-toggle{display:flex;align-items:flex-start;gap:12px;padding:13px 0;border-top:1px solid var(--dx-border)}
        .rm-toggle:first-child{border-top:0;padding-top:0}
        .rm-toggle .tx{flex:1}
        .rm-toggle .tx b{font-size:13.5px;display:block}
        .rm-toggle .tx p{font-size:12px;color:var(--dx-muted);margin:3px 0 0;line-height:1.5}
        .rm-sw{position:relative;width:44px;height:25px;flex:none;cursor:pointer}
        .rm-sw input{opacity:0;width:0;height:0;position:absolute}
        .rm-sw .track{position:absolute;inset:0;background:var(--dx-border);border-radius:99px;transition:.18s}
        .rm-sw .knob{position:absolute;top:3px;left:3px;width:19px;height:19px;background:#fff;border-radius:50%;transition:.18s;box-shadow:0 1px 3px rgba(0,0,0,.3)}
        .rm-sw input:checked + .track{background:var(--dx-primary)}
        .rm-sw input:checked + .track + .knob{transform:translateX(19px)}
        .rm-ff{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        @media(max-width:640px){.rm-ff{grid-template-columns:1fr}}
        .rm-grid{display:grid;gap:16px;grid-template-columns:1.3fr 1fr;align-items:start}
        @media(max-width:760px){.rm-grid{grid-template-columns:1fr}}
        .rm-info{background:color-mix(in srgb, var(--dx-accent) 10%, transparent);border:1px solid color-mix(in srgb, var(--dx-accent) 30%, transparent);border-radius:10px;padding:12px 14px;font-size:12.5px;color:var(--dx-text);line-height:1.6;margin-bottom:16px}
        .rm-info b{color:var(--dx-accent)}
        .rm-btn{font:inherit;font-weight:600;font-size:13px;border:0;border-radius:10px;padding:11px 22px;cursor:pointer;color:#fff;background:var(--dx-grad,var(--dx-primary))}
        .rm-btn:disabled{opacity:.55;cursor:not-allowed}
        .rm-disabled{opacity:.5;pointer-events:none}
        .rm-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:100;padding:12px 20px;border-radius:12px;font-size:13.5px;font-weight:600;box-shadow:0 20px 50px -20px rgba(0,0,0,.5);display:flex;align-items:center;gap:9px;white-space:nowrap}
        .rm-toast.ok{background:#18121f;color:#fff}
        .rm-toast.err{background:#3a1822;color:#e5476f}
        .rm-toast .dot{width:8px;height:8px;border-radius:50%}
        .rm-toast.ok .dot{background:#36c98e}
        .rm-toast.err .dot{background:#e5476f}
      `}</style>

      <Phead
        title="Reminder mail"
        sub="Smart, throttled recharge-reminder emails for sellers whose wallet is running low."
      />

      <form onSubmit={handleSave}>
        <div className="rm-grid">
          {/* Left: thresholds */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card title="Who gets the friendly mail">
              <div className="rm-info">
                <b>Smart targeting.</b> The friendly recharge mail only goes to sellers who are{" "}
                <b>ACTIVE</b> and have <b>HIGH REVENUE</b> (both thresholds below). Everyone else
                follows the inactive behaviour on the right.
              </div>

              <div className="rm-toggle">
                <div className="tx">
                  <b>Only remind active sellers</b>
                  <p>
                    A seller counts as ACTIVE if they have a paid order (or an active subscription)
                    within the activity window. Turn off to ignore activity entirely.
                  </p>
                </div>
                <label className="rm-sw">
                  <input
                    type="checkbox"
                    checked={activeOnly}
                    onChange={(e) => setActiveOnly(e.target.checked)}
                  />
                  <span className="track" />
                  <span className="knob" />
                </label>
              </div>

              <div className={`rm-ff${activeOnly ? "" : " rm-disabled"}`} style={{ marginTop: 6 }}>
                <div className="rm-field" style={{ marginBottom: 0 }}>
                  <label>Activity window (days)</label>
                  <input
                    type="number"
                    min={1}
                    value={activeWindowDays}
                    onChange={(e) => setActiveWindowDays(e.target.value)}
                  />
                  <small>Look-back that defines an ACTIVE seller. Default 14.</small>
                </div>
              </div>

              <div className="rm-field" style={{ marginTop: 14, marginBottom: 0 }}>
                <label>Minimum revenue threshold (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={minRevenueRupees}
                  onChange={(e) => setMinRevenueRupees(e.target.value)}
                />
                <small>
                  HIGH REVENUE = all-time confirmed revenue at or above this. Set 0 for no revenue
                  filter. Stored in paise server-side.
                </small>
              </div>
            </Card>
          </div>

          {/* Right: master switch + throttle + inactive behaviour */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card title="Master switch">
              <div className="rm-toggle">
                <div className="tx">
                  <b>Reminder mail enabled</b>
                  <p>When off, no recharge or nudge emails are sent at all.</p>
                </div>
                <label className="rm-sw">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                  />
                  <span className="track" />
                  <span className="knob" />
                </label>
              </div>

              <div className="rm-field" style={{ marginTop: 8, marginBottom: 0 }}>
                <label>Throttle — min minutes between mails</label>
                <input
                  type="number"
                  min={1}
                  value={intervalMin}
                  onChange={(e) => setIntervalMin(e.target.value)}
                />
                <small>The job runs every 30 min; this caps how often one seller is mailed.</small>
              </div>
            </Card>

            <Card title="Inactive / no-revenue sellers">
              <p style={{ fontSize: 12.5, color: "var(--dx-muted)", margin: "0 0 12px", lineHeight: 1.6 }}>
                What to do with low-wallet sellers who are NOT active or fall below the revenue
                threshold:
              </p>
              <div className="rm-field" style={{ marginBottom: 0 }}>
                <label>Behaviour</label>
                <select
                  value={inactiveAction}
                  onChange={(e) => setInactiveAction(e.target.value as "skip" | "nudge")}
                >
                  <option value="skip">Skip — send nothing (don&apos;t spam dormant sellers)</option>
                  <option value="nudge">Nudge — send a different, softer re-engagement mail</option>
                </select>
                <small>
                  Qualifying sellers always get the friendly recharge mail; this only controls the
                  non-qualifying path.
                </small>
              </div>
            </Card>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <button className="rm-btn" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save reminder settings"}
          </button>
        </div>
      </form>

      {toast && (
        <div className={`rm-toast ${toast.kind}`}>
          <span className="dot" />
          {toast.msg}
        </div>
      )}
    </>
  );
}
