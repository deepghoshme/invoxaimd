"use client";

import { useState } from "react";
import { type LeadFormContent, type LeadFormField, DEFAULT_FIELDS } from "@/lib/leadform";

function resolveFields(fields?: LeadFormField[]): LeadFormField[] {
  return (fields ?? DEFAULT_FIELDS).filter((f) => f.visible);
}

export default function LeadFormView({
  content,
  pageId,
  storeId,
  preview,
}: {
  content: LeadFormContent;
  pageId: string;
  storeId: string;
  preview?: boolean;
}) {
  const theme = content.theme ?? "light";
  const accent = content.accent_color ?? "#7c3aed";
  const fields = resolveFields(content.fields);

  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isDark = theme === "dark";

  const bg = isDark ? "#0f0f13" : "#ffffff";
  const text = isDark ? "#f3f3f7" : "#111827";
  const muted = isDark ? "#9ca3af" : "#6b7280";
  const border = isDark ? "#2a2a35" : "#e5e7eb";
  const inputBg = isDark ? "#1a1a24" : "#f9fafb";
  const cardBg = isDark ? "#1a1a24" : "#f9fafb";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (preview) return; // No real submission in preview mode

    // Validate required fields
    for (const f of fields) {
      if (f.required && !values[f.key]?.trim()) {
        setError(`${f.label} is required.`);
        return;
      }
    }
    if (values.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/site/leadform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: storeId,
          page_id: pageId,
          name: values.name ?? null,
          email: values.email ?? null,
          phone: values.phone ?? null,
          message: values.message ?? null,
          company: values.company ?? null,
          website: values.website ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Submission failed. Please try again.");
      } else {
        setDone(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      data-theme={theme}
      style={{
        minHeight: preview ? undefined : "100dvh",
        background: bg,
        color: text,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: preview ? undefined : "center",
        padding: "32px 20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
        }}
      >
        {/* Header image */}
        {content.image_url && (
          <div style={{ marginBottom: 24, borderRadius: 16, overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={content.image_url}
              alt=""
              style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }}
            />
          </div>
        )}

        {/* Brand accent bar */}
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 99,
            background: accent,
            marginBottom: 20,
          }}
        />

        {/* Headline */}
        {content.headline && (
          <h1
            style={{
              margin: "0 0 8px",
              fontSize: "clamp(1.4rem, 4vw, 2rem)",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              color: text,
              lineHeight: 1.2,
            }}
          >
            {content.headline}
          </h1>
        )}

        {/* Sub-headline */}
        {content.subheadline && (
          <p style={{ margin: "0 0 8px", fontSize: "1rem", fontWeight: 500, color: accent }}>
            {content.subheadline}
          </p>
        )}

        {/* Description */}
        {content.description && (
          <p style={{ margin: "0 0 24px", fontSize: "0.9375rem", color: muted, lineHeight: 1.6 }}>
            {content.description}
          </p>
        )}

        {/* Card */}
        <div
          style={{
            background: cardBg,
            border: `1px solid ${border}`,
            borderRadius: 16,
            padding: "28px 24px",
            marginTop: content.description || content.subheadline ? 0 : 12,
          }}
        >
          {done ? (
            /* Thank-you state */
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  margin: "0 auto 16px",
                  color: "#fff",
                }}
              >
                ✓
              </div>
              <h2 style={{ margin: "0 0 8px", fontSize: "1.2rem", fontWeight: 700, color: text }}>
                {content.success_message || "Thank you! We'll be in touch soon."}
              </h2>
              <p style={{ margin: 0, fontSize: "0.875rem", color: muted }}>
                Your message has been received.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {fields.map((f) => (
                <div key={f.key} style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: muted,
                      marginBottom: 6,
                    }}
                  >
                    {f.label}
                    {f.required && (
                      <span style={{ color: accent, marginLeft: 3 }}>*</span>
                    )}
                  </label>
                  {f.key === "message" ? (
                    <textarea
                      rows={4}
                      placeholder={f.placeholder}
                      value={values[f.key] ?? ""}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [f.key]: e.target.value }))
                      }
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        background: inputBg,
                        border: `1px solid ${border}`,
                        borderRadius: 10,
                        fontSize: "0.9375rem",
                        color: text,
                        outline: "none",
                        resize: "vertical",
                        boxSizing: "border-box",
                        fontFamily: "inherit",
                      }}
                    />
                  ) : (
                    <input
                      type={f.key === "email" ? "email" : f.key === "phone" ? "tel" : "text"}
                      placeholder={f.placeholder}
                      value={values[f.key] ?? ""}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [f.key]: e.target.value }))
                      }
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        background: inputBg,
                        border: `1px solid ${border}`,
                        borderRadius: 10,
                        fontSize: "0.9375rem",
                        color: text,
                        outline: "none",
                        boxSizing: "border-box",
                        fontFamily: "inherit",
                      }}
                    />
                  )}
                </div>
              ))}

              {error && (
                <div
                  style={{
                    marginBottom: 14,
                    padding: "10px 14px",
                    background: isDark ? "#3b1f1f" : "#fef2f2",
                    border: `1px solid ${isDark ? "#7f1d1d" : "#fecaca"}`,
                    borderRadius: 10,
                    fontSize: "0.875rem",
                    color: isDark ? "#fca5a5" : "#dc2626",
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type={preview ? "button" : "submit"}
                disabled={busy}
                style={{
                  width: "100%",
                  padding: "12px 24px",
                  background: accent,
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 12,
                  fontSize: "1rem",
                  fontWeight: 700,
                  cursor: busy ? "not-allowed" : "pointer",
                  opacity: busy ? 0.7 : 1,
                  letterSpacing: "-0.01em",
                  fontFamily: "inherit",
                }}
              >
                {busy ? "Sending…" : (content.button_label || "Send message")}
              </button>

              {preview && (
                <p style={{ margin: "10px 0 0", fontSize: "0.75rem", color: muted, textAlign: "center" }}>
                  Preview mode — form won&apos;t submit
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
