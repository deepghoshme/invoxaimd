"use client";

import { useState, useTransition } from "react";
import Drawer from "@/components/dx/Drawer";
import { Card } from "@/components/dx/ui";
import Pagination from "@/components/dx/Pagination";
import {
  saveRecoverySettings,
  sendRecoveryForOrder,
  sendEligibleRecovery,
} from "./actions";
import type { RecoverySettings } from "./actions";

// ── Types ──────────────────────────────────────────────────────────────────

export type AbandonedOrder = {
  id: string;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  product_title: string | null;
  amount: number;
  status: string;
  created_at: string;
  gateway?: string | null;
  recovery_sent_at?: string | null;
  recovery_count?: number | null;
};

type Props = {
  abandoned: AbandonedOrder[];
  totalAbandoned: number;
  page: number;
  pageSize: number;
  baseParams: Record<string, string | undefined>;
  recoverySettings: RecoverySettings;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function inr(paise: number) {
  return "₹" + Math.round(paise / 100).toLocaleString("en-IN");
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Recovery Settings Card ─────────────────────────────────────────────────

function RecoverySettingsCard({ settings }: { settings: RecoverySettings }) {
  const [form, setForm] = useState<RecoverySettings>(settings);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [bulking, startBulk] = useTransition();

  function handleChange(field: keyof RecoverySettings, value: string | boolean | number) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSave() {
    setSaveStatus(null);
    startSave(async () => {
      const result = await saveRecoverySettings(form);
      setSaveStatus(result.ok ? "Settings saved." : (result.error ?? "Failed to save."));
    });
  }

  function handleBulkSend() {
    setBulkStatus(null);
    startBulk(async () => {
      const result = await sendEligibleRecovery();
      if (!result.ok) {
        setBulkStatus(result.error ?? "Failed");
      } else {
        setBulkStatus(
          result.sent === 0
            ? "No eligible orders to send to right now."
            : `Sent ${result.sent} recovery email${result.sent !== 1 ? "s" : ""}.${result.skipped ? ` (${result.skipped} skipped — no email)` : ""}`,
        );
      }
    });
  }

  return (
    <Card title="Recovery settings">
      <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 13 }}>
        {/* Enable toggle */}
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={form.recovery_enabled}
            onChange={(e) => handleChange("recovery_enabled", e.target.checked)}
            style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
          />
          <span>
            <b>Recovery emails enabled</b>
            <span style={{ color: "var(--muted)", marginLeft: 6, fontWeight: 400 }}>
              (controls the manual bulk-send button below)
            </span>
          </span>
        </label>

        {/* Delay */}
        <div>
          <label style={{ display: "block", color: "var(--muted)", marginBottom: 4, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>
            Min. delay before sending (minutes)
          </label>
          <input
            type="number"
            min={1}
            max={10080}
            value={form.recovery_delay_minutes}
            onChange={(e) => handleChange("recovery_delay_minutes", Number(e.target.value) || 60)}
            style={{
              width: "100%", padding: "8px 10px", borderRadius: 8, fontSize: 13,
              border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)",
            }}
          />
          <p style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 4 }}>
            Orders older than this are eligible. Default: 60 min.
          </p>
        </div>

        {/* Custom subject */}
        <div>
          <label style={{ display: "block", color: "var(--muted)", marginBottom: 4, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>
            Custom email subject (optional)
          </label>
          <input
            type="text"
            maxLength={200}
            placeholder='You left something behind — your item is waiting'
            value={form.recovery_subject}
            onChange={(e) => handleChange("recovery_subject", e.target.value)}
            style={{
              width: "100%", padding: "8px 10px", borderRadius: 8, fontSize: 13,
              border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)",
            }}
          />
        </div>

        {/* Custom message */}
        <div>
          <label style={{ display: "block", color: "var(--muted)", marginBottom: 4, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>
            Custom message body (optional)
          </label>
          <textarea
            maxLength={2000}
            rows={3}
            placeholder="We noticed you started a checkout but didn't complete it. Your item is still available — tap below to finish."
            value={form.recovery_message}
            onChange={(e) => handleChange("recovery_message", e.target.value)}
            style={{
              width: "100%", padding: "8px 10px", borderRadius: 8, fontSize: 13,
              border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)",
              resize: "vertical",
            }}
          />
        </div>

        {/* Save button */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "8px 20px", borderRadius: 8, fontWeight: 700, fontSize: 13,
              background: "var(--primary)", color: "#fff", border: "none",
              cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
          {saveStatus && (
            <span style={{ fontSize: 12.5, color: saveStatus.startsWith("Settings") ? "var(--green)" : "var(--red)" }}>
              {saveStatus}
            </span>
          )}
        </div>

        {/* Bulk send */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 4 }}>
          <p style={{ color: "var(--muted)", fontSize: 12.5, marginBottom: 10 }}>
            <b style={{ color: "var(--text)" }}>Manual bulk send</b> — sends recovery emails to all
            abandoned orders older than the delay above that have not been emailed in the last 24 h.
            Orders without an email address are skipped.
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={handleBulkSend}
              disabled={bulking || !form.recovery_enabled}
              style={{
                padding: "8px 18px", borderRadius: 8, fontWeight: 700, fontSize: 13,
                background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)",
                cursor: (bulking || !form.recovery_enabled) ? "default" : "pointer",
                opacity: (bulking || !form.recovery_enabled) ? 0.6 : 1,
              }}
            >
              {bulking ? "Sending…" : "Send to all eligible"}
            </button>
            {!form.recovery_enabled && (
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Enable recovery above to unlock.</span>
            )}
            {bulkStatus && (
              <span style={{ fontSize: 12.5, color: "var(--green)" }}>{bulkStatus}</span>
            )}
          </div>
          <p style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 10 }}>
            Note: Automatic scheduled sending requires a background scheduler (not yet deployed).
            Use the manual buttons above to trigger recovery emails on demand.
          </p>
        </div>
      </div>
    </Card>
  );
}

// ── Drawer ─────────────────────────────────────────────────────────────────

function AbandonedDrawer({
  order,
  onClose,
}: {
  order: AbandonedOrder | null;
  onClose: () => void;
}) {
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [sending, startSend] = useTransition();

  function handleSendRecovery() {
    if (!order) return;
    setSendStatus(null);
    startSend(async () => {
      const result = await sendRecoveryForOrder(order.id);
      if (!result.ok) {
        setSendStatus(result.error ?? "Failed");
      } else if (!result.sent) {
        setSendStatus(result.error ?? "Already sent recently (within 24 h).");
      } else {
        setSendStatus("Recovery email sent.");
      }
    });
  }

  return (
    <Drawer
      open={!!order}
      onClose={onClose}
      title={order ? `Abandoned: ${order.buyer_name || order.buyer_email || "Guest"}` : ""}
    >
      {order && (
        <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Buyer info */}
          <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)", marginBottom: 2 }}>
              Buyer
            </div>
            {order.buyer_name && (
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "var(--muted)", minWidth: 60 }}>Name</span>
                <span style={{ fontWeight: 600 }}>{order.buyer_name}</span>
              </div>
            )}
            {order.buyer_email && (
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "var(--muted)", minWidth: 60 }}>Email</span>
                <span style={{ fontWeight: 600 }}>{order.buyer_email}</span>
              </div>
            )}
            {order.buyer_phone && (
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "var(--muted)", minWidth: 60 }}>Phone</span>
                <span style={{ fontWeight: 600 }}>{order.buyer_phone}</span>
              </div>
            )}
          </div>

          {/* Order details */}
          <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)", marginBottom: 2 }}>
              Order
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "var(--muted)", minWidth: 60 }}>Product</span>
              <span style={{ fontWeight: 600 }}>{order.product_title || "—"}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "var(--muted)", minWidth: 60 }}>Amount</span>
              <span style={{ fontWeight: 700, color: "var(--primary)" }}>{inr(order.amount)}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "var(--muted)", minWidth: 60 }}>Started</span>
              <span>{fmtDateTime(order.created_at)}</span>
            </div>
            {order.gateway && (
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "var(--muted)", minWidth: 60 }}>Gateway</span>
                <span>{order.gateway}</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "var(--muted)", minWidth: 60 }}>Status</span>
              <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "rgba(245,158,11,0.12)", color: "#b45309" }}>
                {order.status}
              </span>
            </div>
            {order.recovery_count != null && order.recovery_count > 0 && (
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "var(--muted)", minWidth: 60 }}>Recovery</span>
                <span>
                  {order.recovery_count} email{order.recovery_count !== 1 ? "s" : ""} sent
                  {order.recovery_sent_at ? ` (last: ${fmtDateTime(order.recovery_sent_at)})` : ""}
                </span>
              </div>
            )}
          </div>

          {/* Send recovery button */}
          {order.buyer_email ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={handleSendRecovery}
                disabled={sending}
                style={{
                  width: "100%", padding: "10px 0", borderRadius: 9, fontWeight: 700, fontSize: 13.5,
                  background: "linear-gradient(135deg,#ff6a3d,#ff4d7d)", color: "#fff", border: "none",
                  cursor: sending ? "default" : "pointer", opacity: sending ? 0.7 : 1,
                }}
              >
                {sending ? "Sending…" : "Send recovery email now"}
              </button>
              {sendStatus && (
                <p style={{ fontSize: 12.5, color: sendStatus.includes("sent") ? "var(--green)" : "var(--muted)", textAlign: "center", margin: 0 }}>
                  {sendStatus}
                </p>
              )}
              <p style={{ fontSize: 11.5, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
                Sends to <b>{order.buyer_email}</b>. Will not re-send if already sent within 24 h.
              </p>
            </div>
          ) : (
            <div style={{ background: "var(--surface2)", borderRadius: 9, padding: "10px 12px", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
              No email address on this order — cannot send recovery email.
              {order.buyer_phone ? ` Try WhatsApp: ${order.buyer_phone}.` : ""}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AbandonedClient({
  abandoned,
  totalAbandoned,
  page,
  pageSize,
  baseParams,
  recoverySettings,
}: Props) {
  const [selected, setSelected] = useState<AbandonedOrder | null>(null);

  return (
    <>
      <AbandonedDrawer order={selected} onClose={() => setSelected(null)} />

      <style>{`
        .ab-table { width: 100%; border-collapse: collapse; }
        .ab-table th {
          text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em;
          text-transform: uppercase; color: var(--muted); padding: 10px 12px;
          border-bottom: 1px solid var(--border);
        }
        .ab-table td { padding: 11px 12px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: middle; }
        .ab-table tr:last-child td { border-bottom: 0; }
        .ab-table tr:hover td { background: var(--surface2); }
        .ab-empty { text-align: center; padding: 48px; color: var(--muted); font-size: 13.5px; }
      `}</style>

      <div className="dx-grid dx-cols">
        {/* Left: table */}
        <div>
          <Card title={`Abandoned checkouts (${totalAbandoned})`}>
            {abandoned.length === 0 ? (
              <div className="ab-empty">
                No abandoned checkouts — all started orders were completed.
              </div>
            ) : (
              <>
                <table className="ab-table">
                  <thead>
                    <tr>
                      <th>Buyer</th>
                      <th>Product</th>
                      <th>Amount</th>
                      <th>Started</th>
                      <th>Recovery</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abandoned.map((o) => (
                      <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => setSelected(o)}>
                        <td>
                          <b style={{ display: "block", fontWeight: 600 }}>
                            {o.buyer_name || "Guest"}
                          </b>
                          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                            {o.buyer_email || o.buyer_phone || "—"}
                          </span>
                        </td>
                        <td>{o.product_title || "—"}</td>
                        <td style={{ fontWeight: 700 }}>{inr(o.amount)}</td>
                        <td style={{ fontSize: 12, color: "var(--muted)" }}>{fmtDate(o.created_at)}</td>
                        <td style={{ fontSize: 11.5 }}>
                          {o.recovery_count && o.recovery_count > 0 ? (
                            <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, background: "rgba(16,185,129,0.12)", color: "#047857", fontWeight: 700 }}>
                              {o.recovery_count} sent
                            </span>
                          ) : (
                            <span style={{ color: "var(--muted)" }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {totalAbandoned > pageSize && (
                  <Pagination page={page} pageSize={pageSize} total={totalAbandoned} baseParams={baseParams} />
                )}
              </>
            )}
          </Card>
        </div>

        {/* Right: recovery settings */}
        <div>
          <RecoverySettingsCard settings={recoverySettings} />
        </div>
      </div>
    </>
  );
}
