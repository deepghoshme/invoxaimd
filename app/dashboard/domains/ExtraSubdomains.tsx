"use client";

import { useState, useTransition } from "react";
import { addExtraSubdomain, removeExtraSubdomain } from "./subdomainActions";

type SubRow = { id: string; subdomain: string; created_at: string };

export default function ExtraSubdomains({
  initial,
}: {
  initial: SubRow[];
}) {
  const [rows, setRows] = useState<SubRow[]>(initial);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
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
      // Optimistically append; the server action revalidated the path so a
      // navigation will show the fresh DB state. We add a placeholder row so
      // the user sees feedback immediately.
      setRows((prev) => [
        ...prev,
        {
          id: "_pending_" + Date.now(),
          subdomain: sub,
          created_at: new Date().toISOString(),
        },
      ]);
      setInput("");
      setSuccess(
        `${sub}.invoxai.io is live — it uses your store's existing payment gateway automatically.`,
      );
    });
  }

  function handleRemove(id: string, sub: string) {
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
          {rows.map((row) => (
            <div
              key={row.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: "var(--surface)",
                fontSize: 13,
              }}
            >
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
              {/* Live badge — always active; extra subdomains are immediate */}
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
          ))}
        </div>
      )}

      <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
        Extra subdomains resolve to the same store as your primary subdomain
        and use your store&apos;s existing payment gateway automatically — no
        separate connection needed. They go live immediately after being added,
        with no extra DNS setup required. Available on all plans.
      </p>
    </div>
  );
}
