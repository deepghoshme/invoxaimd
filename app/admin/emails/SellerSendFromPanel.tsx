"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/dx/ui";
import { setSellerSendFrom, type SellerSendFromRow } from "./actions";

export default function SellerSendFromPanel({ sellers }: { sellers: SellerSendFromRow[] }) {
  const [editing, setEditing] = useState<string | null>(null);  // storeId being edited
  const [inputVal, setInputVal] = useState("");
  const [msgs, setMsgs] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [pending, startTransition] = useTransition();

  const showMsg = (storeId: string, ok: boolean, text: string) => {
    setMsgs((m) => ({ ...m, [storeId]: { ok, text } }));
    setTimeout(() => setMsgs((m) => { const n = { ...m }; delete n[storeId]; return n; }), 4000);
  };

  const startEdit = (storeId: string, current: string | null) => {
    setEditing(storeId);
    setInputVal(current ?? "");
  };

  const cancelEdit = () => {
    setEditing(null);
    setInputVal("");
  };

  const handleSave = (storeId: string) => {
    const val = inputVal.trim() || null;
    startTransition(async () => {
      const res = await setSellerSendFrom(storeId, val);
      if (res.ok) {
        showMsg(storeId, true, val ? `Send-from set to ${val}` : "Send-from cleared.");
        setEditing(null);
      } else {
        showMsg(storeId, false, res.error ?? "Save failed.");
      }
    });
  };

  const handleClear = (storeId: string) => {
    const confirmed = window.confirm("Clear this seller's custom send-from address? They will revert to the platform default alias.");
    if (!confirmed) return;
    startTransition(async () => {
      const res = await setSellerSendFrom(storeId, null);
      showMsg(storeId, res.ok, res.ok ? "Send-from cleared." : res.error ?? "Clear failed.");
      if (res.ok) setEditing(null);
    });
  };

  if (sellers.length === 0) {
    return (
      <Card title="Seller send-from email">
        <p style={{ fontSize: 12.5, color: "var(--muted)" }}>No sellers found.</p>
      </Card>
    );
  }

  return (
    <Card title="Seller send-from email">
      {/* Honesty note */}
      <div style={{
        background: "color-mix(in srgb, var(--gold, #f59e0b) 12%, transparent)",
        border: "1px solid color-mix(in srgb, var(--gold, #f59e0b) 35%, transparent)",
        borderRadius: 9,
        padding: "10px 13px",
        marginBottom: 14,
        fontSize: 12.5,
        lineHeight: 1.5,
      }}>
        <strong>Verify domain SMTP to send as this address.</strong> Storing an address here does not
        guarantee delivery from it. The seller must configure DKIM, SPF, and SMTP credentials for their
        domain before this address can be used as the envelope sender. Until then, mail falls back to the
        platform default alias (<code style={{ fontFamily: "ui-monospace,monospace", fontSize: 11 }}>hello@invoxai.io</code>).
        This is an intentional platform limit — do not claim otherwise.
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {sellers.map((s) => {
          const isEditingThis = editing === s.storeId;
          const msg = msgs[s.storeId];

          return (
            <div
              key={s.storeId}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "11px 13px",
                display: "flex",
                flexDirection: "column",
                gap: 7,
              }}
            >
              {/* Store header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>
                    {s.storeName ?? "(unnamed store)"}
                  </span>
                  {s.subdomain && (
                    <span style={{ color: "var(--muted)", fontSize: 11.5, marginLeft: 7 }}>
                      {s.subdomain}.invoxai.io
                    </span>
                  )}
                  {s.ownerEmail && (
                    <span style={{ color: "var(--muted)", fontSize: 11.5, marginLeft: 7 }}>
                      · {s.ownerEmail}
                    </span>
                  )}
                </div>
              </div>

              {/* Current send-from display */}
              {!isEditingThis && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    {s.sendFromEmail ? (
                      <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 12.5, color: "var(--text)" }}>
                        {s.sendFromEmail}
                      </span>
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>
                        Using platform default (hello@invoxai.io)
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: 12, padding: "3px 10px" }}
                    onClick={() => startEdit(s.storeId, s.sendFromEmail)}
                    disabled={pending}
                  >
                    {s.sendFromEmail ? "Edit" : "Set"}
                  </button>
                  {s.sendFromEmail && (
                    <button
                      type="button"
                      className="btn"
                      style={{ fontSize: 12, padding: "3px 10px", color: "var(--red, #ef4444)", borderColor: "color-mix(in srgb, var(--red, #ef4444) 35%, transparent)" }}
                      onClick={() => handleClear(s.storeId)}
                      disabled={pending}
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}

              {/* Edit form */}
              {isEditingThis && (
                <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                  <input
                    type="email"
                    className="input"
                    placeholder="seller@theirdomain.com"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    style={{ flex: 1, fontSize: 13 }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn grad"
                    style={{ fontSize: 12, padding: "4px 12px", whiteSpace: "nowrap" }}
                    onClick={() => handleSave(s.storeId)}
                    disabled={pending}
                  >
                    {pending ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: 12, padding: "4px 10px" }}
                    onClick={cancelEdit}
                    disabled={pending}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Feedback message */}
              {msg && (
                <div style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: msg.ok ? "var(--green, #16a34a)" : "var(--red, #ef4444)",
                }}>
                  {msg.text}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
