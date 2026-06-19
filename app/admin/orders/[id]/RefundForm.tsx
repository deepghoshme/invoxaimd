"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { refundOrder } from "../actions";

/** Admin refund control. Confirms, calls the server action, shows the result. */
export default function RefundForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function doRefund() {
    if (!confirm("Mark this order as refunded? This records the refund in-platform and writes an audit entry.")) return;
    setBusy(true);
    setMsg(null);
    const res = await refundOrder(orderId, reason);
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: "Order marked as refunded." });
      router.refresh();
    } else {
      setMsg({ ok: false, text: res.error ?? "Could not refund." });
    }
  }

  return (
    <div>
      <label className="label" style={{ display: "block", fontSize: 13, marginBottom: 6 }}>
        Refund reason (optional)
      </label>
      <textarea
        className="input"
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Customer requested cancellation"
        style={{ width: "100%", marginBottom: 10 }}
      />
      <button className="btn grad" onClick={doRefund} disabled={busy}>
        {busy ? "Processing…" : "Mark as refunded"}
      </button>
      {msg && (
        <div className={msg.ok ? "cm-alert-ok" : "cm-alert-err"} style={{ marginTop: 10, fontSize: 13 }}>
          {msg.text}
        </div>
      )}
      <p className="dx-muted" style={{ fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>
        Records the refund in-platform and logs it to the audit trail. Process the actual gateway
        refund (Razorpay) for this payment ID separately — live gateway refunds are a follow-up.
      </p>
    </div>
  );
}
