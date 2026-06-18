"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_VIP_CONTENT } from "@/lib/vip";

export default function CreateVipButton({
  storeId,
  disabled = false,
}: {
  storeId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    if (busy || disabled) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/vip/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: storeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create community");
      router.push(`/studio/vip/${data.page_id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error creating community");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        className="btn grad"
        onClick={create}
        disabled={busy || disabled}
        title={disabled ? "Read-only while impersonating" : undefined}
      >
        {busy ? "Creating…" : "+ New community"}
      </button>
      {err && <p style={{ color: "var(--secondary)", fontSize: 12, marginTop: 6 }}>{err}</p>}
    </div>
  );
}
