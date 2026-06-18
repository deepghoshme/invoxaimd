"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  suspendStoreAction,
  unsuspendStoreAction,
  startImpersonation,
} from "./actions";

interface Props {
  storeId: string;
  storeName: string;
  suspended: boolean;
  suspendedReason: string | null;
}

export default function SellerActions({
  storeId,
  storeName,
  suspended,
  suspendedReason,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showSuspendForm, setShowSuspendForm] = useState(false);
  const [reason, setReason] = useState(suspendedReason ?? "");

  function handleSuspend() {
    setError(null);
    startTransition(async () => {
      const res = await suspendStoreAction(storeId, reason);
      if (!res.ok) {
        setError(res.error ?? "Failed to suspend.");
      } else {
        setShowSuspendForm(false);
        router.refresh();
      }
    });
  }

  function handleUnsuspend() {
    setError(null);
    startTransition(async () => {
      const res = await unsuspendStoreAction(storeId);
      if (!res.ok) {
        setError(res.error ?? "Failed to unsuspend.");
      } else {
        router.refresh();
      }
    });
  }

  function handleLoginAs() {
    setError(null);
    startTransition(async () => {
      const res = await startImpersonation(storeId, storeName);
      if (!res.ok) {
        setError(res.error ?? "Impersonation failed.");
      } else {
        // Navigate to the seller dashboard — the imp_store cookie is now set.
        router.push("/dashboard");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#ef4444",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {/* Login-as / impersonation */}
        <button
          className="dx-editbtn"
          onClick={handleLoginAs}
          disabled={pending}
          style={{ opacity: pending ? 0.6 : 1 }}
          title="Open this seller's dashboard as a view-only admin impersonation (30 min, signed cookie)"
        >
          {pending ? "Loading…" : "Login as (view)"}
        </button>

        {/* Suspend / unsuspend */}
        {suspended ? (
          <button
            className="dx-editbtn"
            onClick={handleUnsuspend}
            disabled={pending}
            style={{
              opacity: pending ? 0.6 : 1,
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.35)",
              color: "#16a34a",
            }}
            title="Reinstate this store — removes the suspension flag"
          >
            {pending ? "Working…" : "Unsuspend"}
          </button>
        ) : (
          <button
            className="dx-editbtn"
            onClick={() => setShowSuspendForm((v) => !v)}
            disabled={pending}
            style={{
              opacity: pending ? 0.6 : 1,
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#ef4444",
            }}
            title="Suspend this store (takes it offline for buyers)"
          >
            Suspend…
          </button>
        )}
      </div>

      {/* Suspend confirmation form */}
      {showSuspendForm && !suspended && (
        <div
          style={{
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 10,
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <p
            style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, margin: 0 }}
          >
            Suspend &quot;{storeName}&quot;?
          </p>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
            The public store will show &quot;unavailable&quot; and checkout will be
            blocked. The seller can still log in but cannot accept orders.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional — admin-only, not shown to seller)"
            rows={2}
            style={{
              borderRadius: 7,
              border: "1px solid var(--border)",
              background: "var(--card)",
              color: "var(--text)",
              padding: "8px 10px",
              fontSize: 13,
              resize: "vertical",
              fontFamily: "inherit",
              width: "100%",
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="dx-editbtn"
              onClick={handleSuspend}
              disabled={pending}
              style={{
                background: "#ef4444",
                border: "none",
                color: "#fff",
                opacity: pending ? 0.6 : 1,
              }}
            >
              {pending ? "Suspending…" : "Confirm suspend"}
            </button>
            <button
              className="dx-editbtn"
              onClick={() => setShowSuspendForm(false)}
              disabled={pending}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
