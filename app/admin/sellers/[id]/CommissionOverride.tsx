"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCommissionOverrideAction } from "./actions";

interface Props {
  storeId: string;
  /** Current override fraction (e.g. 0.08 = 8 %) or null if not set. */
  overrideFraction: number | null;
  /** The effective rate currently applied: override if set, else category/default. */
  effectiveFraction: number;
  /** Human-readable label for where the effective rate comes from. */
  effectiveSource: string;
}

export default function CommissionOverride({
  storeId,
  overrideFraction,
  effectiveFraction,
  effectiveSource,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Display value: percentage string, empty = not set.
  const [inputValue, setInputValue] = useState<string>(
    overrideFraction !== null ? (overrideFraction * 100).toFixed(2) : "",
  );

  function handleSave() {
    const trimmed = inputValue.trim();
    const ratePercent = trimmed === "" ? null : parseFloat(trimmed);

    if (trimmed !== "" && (!Number.isFinite(ratePercent) || ratePercent! < 0 || ratePercent! > 50)) {
      setError("Enter a number between 0 and 50, or leave blank to clear the override.");
      return;
    }

    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await setCommissionOverrideAction(storeId, ratePercent);
      if (!res.ok) {
        setError(res.error ?? "Failed to save override.");
      } else {
        setSuccess(
          ratePercent === null
            ? "Override cleared — store will use category rate."
            : `Override set to ${ratePercent.toFixed(2)} %.`,
        );
        router.refresh();
        setTimeout(() => setSuccess(null), 3000);
      }
    });
  }

  function handleClear() {
    setInputValue("");
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await setCommissionOverrideAction(storeId, null);
      if (!res.ok) {
        setError(res.error ?? "Failed to clear override.");
      } else {
        setSuccess("Override cleared — store will use category rate.");
        router.refresh();
        setTimeout(() => setSuccess(null), 3000);
      }
    });
  }

  const effectivePct = (effectiveFraction * 100).toFixed(2);

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "18px 20px",
        marginTop: 16,
      }}
    >
      <h3
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: ".06em",
          marginBottom: 14,
          margin: "0 0 14px",
        }}
      >
        Commission Override
      </h3>

      {/* Effective rate display */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "7px 0",
          borderBottom: "1px solid var(--border)",
          marginBottom: 14,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 13, color: "var(--muted)" }}>Effective rate</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
          {effectivePct} %
          <span
            style={{
              marginLeft: 8,
              fontSize: 11,
              fontWeight: 500,
              color: "var(--muted)",
            }}
          >
            ({effectiveSource})
          </span>
        </span>
      </div>

      {/* Override input */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
          Override rate (%) — leave blank to use category rate
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "var(--bg)",
              border: "1.5px solid var(--border)",
              borderRadius: 9,
              padding: "5px 8px 5px 12px",
            }}
          >
            <input
              type="text"
              inputMode="decimal"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value.replace(/[^0-9.]/g, ""));
                setError(null);
              }}
              placeholder="e.g. 8.00"
              disabled={pending}
              style={{
                width: 70,
                border: 0,
                background: "transparent",
                font: "inherit",
                fontWeight: 700,
                color: "var(--text)",
                outline: "none",
                textAlign: "right",
              }}
              aria-label="Commission override percentage"
            />
            <span style={{ color: "var(--muted)", fontWeight: 700, fontSize: 13 }}>%</span>
          </div>

          <button
            className="dx-editbtn"
            onClick={handleSave}
            disabled={pending}
            style={{
              opacity: pending ? 0.6 : 1,
              background: "rgba(99,102,241,0.12)",
              border: "1px solid rgba(99,102,241,0.35)",
              color: "#4f46e5",
            }}
          >
            {pending ? "Saving…" : "Set override"}
          </button>

          {overrideFraction !== null && (
            <button
              className="dx-editbtn"
              onClick={handleClear}
              disabled={pending}
              style={{
                opacity: pending ? 0.6 : 1,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#dc2626",
              }}
            >
              Clear override
            </button>
          )}
        </div>

        {/* Feedback */}
        {error && (
          <p
            style={{
              fontSize: 12,
              color: "#ef4444",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 7,
              padding: "7px 10px",
              margin: 0,
            }}
          >
            {error}
          </p>
        )}
        {success && (
          <p
            style={{
              fontSize: 12,
              color: "#16a34a",
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.25)",
              borderRadius: 7,
              padding: "7px 10px",
              margin: 0,
            }}
          >
            {success}
          </p>
        )}

        <p style={{ fontSize: 11.5, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
          Range: 0 % – 50 %. Stored as a decimal fraction (e.g. 8 % = 0.0800).
          Overrides the category rate for this seller only. Clear to revert to
          the category rate.
        </p>
      </div>
    </div>
  );
}
