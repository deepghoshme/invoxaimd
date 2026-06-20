"use client";

import { useState, useTransition } from "react";
import {
  addExtraSubdomain,
  removeExtraSubdomain,
  updateExtraSubdomain,
  type SubdomainRow,
} from "./subdomainActions";

type PageOption = {
  id: string;
  page_type: string;
  title: string | null;
  public_id: string | null;
};

/** Human-readable label for a page option in the dropdown. */
function pageLabel(p: PageOption): string {
  const prefix = p.page_type.toUpperCase();
  const name = p.title?.trim() || p.public_id || p.id.slice(0, 8);
  return `${prefix}: ${name}`;
}

export default function ExtraSubdomains({
  initial,
  pages,
}: {
  initial: SubdomainRow[];
  pages: PageOption[];
}) {
  const [rows, setRows] = useState<SubdomainRow[]>(initial);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  // Track which row is in edit mode (by id)
  const [editingId, setEditingId] = useState<string | null>(null);
  // Edit-mode draft state
  const [editSub, setEditSub] = useState("");
  const [editPageId, setEditPageId] = useState<string>("");
  const [editLabel, setEditLabel] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const sub = input.trim().toLowerCase();
    if (!sub) return;

    startTransition(async () => {
      const res = await addExtraSubdomain(sub);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Use the REAL row returned by the server — no fake _pending_ id.
      setRows((prev) => [...prev, res.row]);
      setInput("");
      setSuccess(
        `${res.row.subdomain}.invoxai.io is live — it uses your store's existing payment gateway automatically.`,
      );
    });
  }

  function handleRemove(id: string, sub: string) {
    // Block remove of pending/fake rows (safety guard — should never happen now).
    if (id.startsWith("_pending_")) return;
    setError(null);
    setSuccess(null);
    setRemoving(id);

    startTransition(async () => {
      const res = await removeExtraSubdomain(id);
      setRemoving(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      setSuccess(`${sub}.invoxai.io removed.`);
    });
  }

  function startEdit(row: SubdomainRow) {
    setEditingId(row.id);
    setEditSub(row.subdomain);
    setEditPageId(row.page_id ?? "");
    setEditLabel(row.label ?? "");
    setEditError(null);
    setError(null);
    setSuccess(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  function handleUpdate(id: string) {
    setEditError(null);
    const currentRow = rows.find((r) => r.id === id);
    if (!currentRow) return;

    const newSub = editSub.trim().toLowerCase();
    const newPageId: string | null = editPageId || null;
    const newLabel: string | null = editLabel.trim() || null;

    // No-op check
    if (
      newSub === currentRow.subdomain &&
      newPageId === (currentRow.page_id ?? null) &&
      newLabel === (currentRow.label ?? null)
    ) {
      cancelEdit();
      return;
    }

    const patch: { subdomain?: string; page_id?: string | null; label?: string | null } = {};
    if (newSub !== currentRow.subdomain) patch.subdomain = newSub;
    if (newPageId !== (currentRow.page_id ?? null)) patch.page_id = newPageId;
    if (newLabel !== (currentRow.label ?? null)) patch.label = newLabel;

    startTransition(async () => {
      const res = await updateExtraSubdomain(id, patch);
      if (!res.ok) {
        setEditError(res.error);
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === id ? res.row : r)));
      setEditingId(null);
      setSuccess(`${res.row.subdomain}.invoxai.io updated.`);
    });
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: "6px 9px",
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 7,
    outline: "none",
    fontSize: 12.5,
    color: "var(--text)",
    fontFamily: "ui-monospace, Menlo, monospace",
    minWidth: 0,
  };

  const selectStyle: React.CSSProperties = {
    flex: 1,
    padding: "6px 9px",
    background: "var(--surface2)",
    border: "1px solid var(--border)",
    borderRadius: 7,
    outline: "none",
    fontSize: 12.5,
    color: "var(--text)",
    minWidth: 0,
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Add form */}
      <form
        onSubmit={handleAdd}
        style={{ display: "flex", gap: 8, alignItems: "stretch" }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            border: "1px solid var(--border)",
            borderRadius: 9,
            overflow: "hidden",
            background: "var(--surface2)",
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              setError(null);
              setSuccess(null);
            }}
            placeholder="myalias"
            disabled={isPending}
            style={{
              flex: 1,
              padding: "8px 10px",
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 13,
              color: "var(--text)",
            }}
            maxLength={63}
            autoComplete="off"
            spellCheck={false}
          />
          <span
            style={{
              padding: "8px 10px",
              fontSize: 12.5,
              color: "var(--muted)",
              background: "var(--sidebar)",
              borderLeft: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              whiteSpace: "nowrap",
              userSelect: "none",
            }}
          >
            .invoxai.io
          </span>
        </div>
        <button
          type="submit"
          disabled={isPending || !input.trim()}
          className="btn grad"
          style={{ padding: "8px 16px", fontSize: 13, whiteSpace: "nowrap" }}
        >
          {isPending ? "Adding…" : "Add"}
        </button>
      </form>

      {/* Feedback */}
      {error && (
        <div
          style={{
            fontSize: 12.5,
            color: "#dc2626",
            background: "rgba(239,68,68,0.07)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 8,
            padding: "7px 11px",
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          style={{
            fontSize: 12.5,
            color: "#16a34a",
            background: "rgba(34,197,94,0.07)",
            border: "1px solid rgba(34,197,94,0.2)",
            borderRadius: 8,
            padding: "7px 11px",
          }}
        >
          {success}
        </div>
      )}

      {/* List */}
      {rows.length === 0 ? (
        <div className="dx-empty" style={{ fontSize: 13 }}>
          No extra subdomains yet. Add one above to create an alias for your
          store.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((row) => {
            const isEditing = editingId === row.id;
            const targetPage = pages.find((p) => p.id === row.page_id);

            if (isEditing) {
              // Edit mode
              return (
                <div
                  key={row.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    padding: "12px",
                    border: "1px solid var(--primary)",
                    borderRadius: 10,
                    background: "var(--surface)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "var(--primary)",
                      marginBottom: 2,
                    }}
                  >
                    Edit subdomain
                  </div>

                  {/* Subdomain rename */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="text"
                      value={editSub}
                      onChange={(e) => {
                        setEditSub(
                          e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                        );
                        setEditError(null);
                      }}
                      placeholder="subdomain"
                      maxLength={63}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={isPending}
                      style={inputStyle}
                    />
                    <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                      .invoxai.io
                    </span>
                  </div>

                  {/* Target page dropdown */}
                  <select
                    value={editPageId}
                    onChange={(e) => setEditPageId(e.target.value)}
                    disabled={isPending}
                    style={selectStyle}
                  >
                    <option value="">Store home / root (default)</option>
                    {pages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {pageLabel(p)}
                      </option>
                    ))}
                  </select>

                  {/* Friendly label */}
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    placeholder="Label (optional, e.g. Summer campaign)"
                    maxLength={80}
                    disabled={isPending}
                    style={{ ...inputStyle, fontFamily: "inherit" }}
                  />

                  {editError && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#dc2626",
                        background: "rgba(239,68,68,0.07)",
                        border: "1px solid rgba(239,68,68,0.2)",
                        borderRadius: 7,
                        padding: "6px 10px",
                      }}
                    >
                      {editError}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => handleUpdate(row.id)}
                      disabled={isPending || !editSub.trim()}
                      className="btn grad"
                      style={{ padding: "6px 14px", fontSize: 12.5 }}
                    >
                      {isPending ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={isPending}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 7,
                        border: "1px solid var(--border)",
                        background: "var(--surface2)",
                        color: "var(--muted)",
                        fontSize: 12.5,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }

            // View mode
            return (
              <div
                key={row.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  padding: "10px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  background: "var(--surface)",
                  fontSize: 13,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <a
                    href={`https://${row.subdomain}.invoxai.io`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      flex: 1,
                      color: "var(--primary)",
                      fontWeight: 600,
                      textDecoration: "none",
                      fontFamily: "ui-monospace, Menlo, monospace",
                      fontSize: 12.5,
                    }}
                  >
                    {row.subdomain}.invoxai.io ↗
                  </a>
                  {/* Live badge */}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--green)",
                      background: "rgba(31,181,122,0.1)",
                      border: "1px solid rgba(31,181,122,0.25)",
                      borderRadius: 99,
                      padding: "2px 8px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Live
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {new Date(row.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "2-digit",
                    })}
                  </span>
                  <button
                    onClick={() => startEdit(row)}
                    disabled={isPending || removing === row.id}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 7,
                      border: "1px solid var(--border)",
                      background: "var(--surface2)",
                      color: "var(--text)",
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: isPending || removing === row.id ? "not-allowed" : "pointer",
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleRemove(row.id, row.subdomain)}
                    disabled={isPending || removing === row.id}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 7,
                      border: "1px solid rgba(239,68,68,0.3)",
                      background: "rgba(239,68,68,0.07)",
                      color: "#dc2626",
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: isPending || removing === row.id ? "not-allowed" : "pointer",
                      opacity: removing === row.id ? 0.6 : 1,
                    }}
                  >
                    {removing === row.id ? "Removing…" : "Remove"}
                  </button>
                </div>

                {/* Secondary info row: label + target page */}
                {(row.label || row.page_id) && (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                      paddingTop: 2,
                    }}
                  >
                    {row.label && (
                      <span
                        style={{
                          fontSize: 11.5,
                          color: "var(--muted)",
                          fontStyle: "italic",
                        }}
                      >
                        {row.label}
                      </span>
                    )}
                    {row.page_id && (
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--accent)",
                          background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                          border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                          borderRadius: 99,
                          padding: "1px 8px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {targetPage ? pageLabel(targetPage) : "Custom page"}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
        Extra subdomains resolve to your store (or a specific published page)
        and use your store&apos;s existing payment gateway automatically — no
        separate connection needed. They go live immediately after being added,
        with no extra DNS setup required. Available on all plans.
      </p>
    </div>
  );
}
