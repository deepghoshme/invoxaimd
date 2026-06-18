"use client";

import { useTransition } from "react";
import { exitImpersonation } from "./impersonation-actions";

export default function ImpersonationBanner({ storeName }: { storeName: string }) {
  const [pending, startTransition] = useTransition();

  function handleExit() {
    startTransition(async () => {
      await exitImpersonation();
    });
  }

  return (
    <div
      style={{
        background: "linear-gradient(90deg,#ff4d7d,#a855f7)",
        color: "#fff",
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "var(--font-sora, Sora, sans-serif)",
        borderRadius: 10,
        marginBottom: 16,
        flexShrink: 0,
      }}
    >
      <span>
        Viewing as <strong>{storeName}</strong> — admin view-only mode
      </span>
      <button
        onClick={handleExit}
        disabled={pending}
        style={{
          background: "rgba(255,255,255,0.22)",
          border: "1px solid rgba(255,255,255,0.4)",
          color: "#fff",
          borderRadius: 7,
          padding: "5px 14px",
          fontSize: 12,
          fontWeight: 700,
          cursor: pending ? "not-allowed" : "pointer",
          opacity: pending ? 0.7 : 1,
          fontFamily: "inherit",
        }}
      >
        {pending ? "Exiting…" : "Exit"}
      </button>
    </div>
  );
}
