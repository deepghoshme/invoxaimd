"use client";

import { useRef, useState } from "react";

/**
 * Shared image field used EVERYWHERE an image can be set across invoxai.io.
 * Offers both: (1) upload from the local device, and (2) paste an image URL.
 * Uploads go to the `media` bucket via /api/upload and return a public URL.
 */
export default function ImageInput({
  value,
  onChange,
  placeholder = "https://…/image.jpg",
}: {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed.");
      onChange(json.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="img-input">
      <div className="input-suffix">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode="url"
        />
        <label className="suffix upload-btn">
          {busy ? "Uploading…" : "⤴ Upload"}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onPick}
            disabled={busy}
          />
        </label>
      </div>
      {err && <span className="hint" style={{ color: "#b3214e" }}>{err}</span>}
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="img-preview" src={value} alt="" />
      )}
    </div>
  );
}
