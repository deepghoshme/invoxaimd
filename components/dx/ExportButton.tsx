"use client";

/** Client-side CSV export. Builds a CSV from plain row data already rendered on
 * the page and triggers a download — no server round-trip needed. */
export default function ExportButton({
  rows,
  headers,
  filename,
  label = "Export CSV",
}: {
  rows: (string | number | null)[][];
  headers: string[];
  filename: string;
  label?: string;
}) {
  function download() {
    const esc = (v: string | number | null) =>
      `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [headers, ...rows]
      .map((r) => r.map(esc).join(","))
      .join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  return (
    <button className="btn ghost" onClick={download} disabled={rows.length === 0} title={rows.length === 0 ? "Nothing to export" : `Download ${rows.length} rows as CSV`}>
      {label}
    </button>
  );
}
