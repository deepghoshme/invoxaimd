"use client";

import { useState, useTransition } from "react";
import { replyToReview, setReviewVisibility } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReviewRow = {
  id: string;
  rating: number;
  body: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  status: "approved" | "pending" | "hidden";
  is_visible: boolean;
  seller_reply: string | null;
  replied_at: string | null;
  created_at: string;
  product_id: string | null;
  page_id: string | null;
  product_title: string | null;
};

type Props = {
  initial: ReviewRow[];
  impersonating: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ letterSpacing: 1, fontSize: 15 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < rating ? "#f59e0b" : "var(--border)" }}>
          ★
        </span>
      ))}
    </span>
  );
}

function StatusBadge({ status, is_visible }: { status: string; is_visible: boolean }) {
  const show = is_visible && status === "approved";
  const label = show ? "Visible" : status === "pending" ? "Pending" : "Hidden";
  const color = show ? "var(--green)" : status === "pending" ? "var(--accent)" : "var(--muted)";
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: ".04em",
        textTransform: "uppercase",
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        borderRadius: 6,
        padding: "3px 8px",
      }}
    >
      {label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReviewsClient({ initial, impersonating }: Props) {
  const [reviews, setReviews] = useState<ReviewRow[]>(initial);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Per-review reply draft state
  const [draftReply, setDraftReply] = useState<Record<string, string>>({});
  const [openReply, setOpenReply] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<Record<string, string>>({});

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Reply ────────────────────────────────────────────────────────────────────
  function handleReply(id: string) {
    const text = (draftReply[id] ?? "").trim();
    if (!text) {
      setReplyError((p) => ({ ...p, [id]: "Reply cannot be empty." }));
      return;
    }
    if (text.length > 2000) {
      setReplyError((p) => ({ ...p, [id]: "Reply must be 2000 characters or fewer." }));
      return;
    }
    setReplyError((p) => ({ ...p, [id]: "" }));

    startTransition(async () => {
      const res = await replyToReview(id, text);
      if (!res.ok) {
        showToast(res.error ?? "Failed to save reply.", false);
        return;
      }
      setReviews((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, seller_reply: text, replied_at: new Date().toISOString() }
            : r
        )
      );
      setOpenReply(null);
      setDraftReply((p) => ({ ...p, [id]: "" }));
      showToast("Reply saved.");
    });
  }

  // ── Visibility toggle ────────────────────────────────────────────────────────
  function handleToggleVisibility(id: string, currentlyVisible: boolean) {
    startTransition(async () => {
      const nextVisible = !currentlyVisible;
      const res = await setReviewVisibility(id, nextVisible);
      if (!res.ok) {
        showToast(res.error ?? "Failed to update visibility.", false);
        return;
      }
      setReviews((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, is_visible: nextVisible, status: nextVisible ? "approved" : "hidden" }
            : r
        )
      );
      showToast(nextVisible ? "Review is now visible to buyers." : "Review hidden from public view.");
    });
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (reviews.length === 0) {
    return (
      <div className="rvw-empty">
        No reviews yet. Reviews appear here when buyers leave feedback on your products.
      </div>
    );
  }

  return (
    <>
      <style>{`
        .rvw-list { display: flex; flex-direction: column; gap: 14px; }

        .rvw-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 16px 18px;
        }
        .rvw-card-head {
          display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap;
          margin-bottom: 10px;
        }
        .rvw-buyer { flex: 1; min-width: 0; }
        .rvw-buyer-name { font-weight: 700; font-size: 14px; }
        .rvw-buyer-meta { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .rvw-product-tag {
          font-size: 11.5px; color: var(--muted);
          background: var(--surface2); border-radius: 6px; padding: 3px 8px;
          border: 1px solid var(--border); white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis; max-width: 200px;
        }
        .rvw-body {
          font-size: 13.5px; line-height: 1.6; color: var(--text);
          margin-bottom: 10px; white-space: pre-wrap; word-break: break-word;
        }
        .rvw-reply-box {
          background: color-mix(in srgb, var(--primary) 6%, var(--surface));
          border: 1px solid color-mix(in srgb, var(--primary) 18%, var(--border));
          border-radius: 10px; padding: 12px 14px; margin-bottom: 10px;
          font-size: 13px;
        }
        .rvw-reply-label {
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .05em; color: var(--primary); margin-bottom: 5px;
        }
        .rvw-reply-text { font-size: 13px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
        .rvw-reply-date { font-size: 11px; color: var(--muted); margin-top: 4px; }

        .rvw-actions {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 8px;
        }
        .rvw-btn {
          font: inherit; font-size: 12.5px; font-weight: 600;
          border: 1px solid var(--border); background: var(--surface2);
          color: var(--text); padding: 6px 13px; border-radius: 8px;
          cursor: pointer; transition: background .15s, border-color .15s;
        }
        .rvw-btn:hover { background: var(--surface); border-color: var(--primary); }
        .rvw-btn:disabled { opacity: .45; cursor: not-allowed; }
        .rvw-btn.danger { color: var(--red, #e53935); border-color: color-mix(in srgb, var(--red, #e53935) 30%, var(--border)); }
        .rvw-btn.danger:hover { background: color-mix(in srgb, var(--red, #e53935) 8%, var(--surface2)); }
        .rvw-btn.primary {
          background: var(--primary); color: #fff; border-color: var(--primary);
        }
        .rvw-btn.primary:hover { opacity: .9; }

        .rvw-textarea {
          width: 100%; font: inherit; font-size: 13.5px;
          background: var(--surface2); border: 1.5px solid var(--border);
          border-radius: 10px; padding: 10px 13px; color: var(--text);
          resize: vertical; min-height: 80px; outline: none;
          transition: border-color .15s; box-sizing: border-box;
        }
        .rvw-textarea:focus { border-color: var(--primary); }
        .rvw-char-count { font-size: 11.5px; color: var(--muted); text-align: right; margin-top: 3px; }
        .rvw-err { font-size: 12px; color: var(--red, #e53935); margin-top: 4px; }

        .rvw-empty {
          text-align: center; padding: 50px 24px; color: var(--muted); font-size: 13.5px;
        }

        .rvw-readonly-banner {
          background: color-mix(in srgb, var(--accent) 8%, var(--surface));
          border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--border));
          border-radius: 12px; padding: 12px 16px; font-size: 13px;
          color: var(--muted); margin-bottom: 18px;
        }

        .rvw-toast {
          position: fixed; left: 50%; bottom: 24px; z-index: 200;
          background: #18121f; color: #fff; padding: 12px 20px;
          border-radius: 12px; font-size: 13px; font-weight: 600;
          box-shadow: 0 20px 50px -20px rgba(0,0,0,.6);
          display: flex; align-items: center; gap: 9px;
          transform: translateX(-50%);
          animation: rvw-toast-in .35s ease;
        }
        .rvw-toast .d { width: 8px; height: 8px; border-radius: 50%; flex: none; }
        .rvw-toast .d.ok { background: #36c98e; }
        .rvw-toast .d.err { background: #e53935; }
        @keyframes rvw-toast-in {
          from { transform: translate(-50%, 16px); opacity: 0; }
          to   { transform: translate(-50%, 0);    opacity: 1; }
        }
      `}</style>

      {impersonating && (
        <div className="rvw-readonly-banner">
          You are viewing this store as an admin. Review moderation is read-only while impersonating.
        </div>
      )}

      <div className="rvw-list">
        {reviews.map((r) => {
          const isPublic = r.is_visible && r.status === "approved";
          const productLabel =
            r.product_title ?? r.product_id ?? r.page_id ?? "Unknown product";
          const isOpen = openReply === r.id;
          const draft = draftReply[r.id] ?? r.seller_reply ?? "";

          return (
            <div key={r.id} className="rvw-card">
              {/* Header */}
              <div className="rvw-card-head">
                <div className="rvw-buyer">
                  <div className="rvw-buyer-name">{r.buyer_name || "Anonymous"}</div>
                  <div className="rvw-buyer-meta">
                    {r.buyer_email && <span>{r.buyer_email} · </span>}
                    {fmtDate(r.created_at)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Stars rating={r.rating} />
                  <StatusBadge status={r.status} is_visible={r.is_visible} />
                </div>
              </div>

              {/* Product tag */}
              <div style={{ marginBottom: 8 }}>
                <span className="rvw-product-tag" title={productLabel}>
                  {productLabel}
                </span>
              </div>

              {/* Review body */}
              {r.body ? (
                <div className="rvw-body">{r.body}</div>
              ) : (
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10, fontStyle: "italic" }}>
                  (No written review — rating only)
                </div>
              )}

              {/* Existing reply */}
              {r.seller_reply && !isOpen && (
                <div className="rvw-reply-box">
                  <div className="rvw-reply-label">Your reply</div>
                  <div className="rvw-reply-text">{r.seller_reply}</div>
                  {r.replied_at && (
                    <div className="rvw-reply-date">Replied {fmtDate(r.replied_at)}</div>
                  )}
                </div>
              )}

              {/* Reply textarea (open state) */}
              {isOpen && (
                <div style={{ marginBottom: 10 }}>
                  <textarea
                    className="rvw-textarea"
                    value={draft}
                    onChange={(e) => {
                      setDraftReply((p) => ({ ...p, [r.id]: e.target.value }));
                      if (replyError[r.id]) {
                        setReplyError((p) => ({ ...p, [r.id]: "" }));
                      }
                    }}
                    placeholder="Write a public reply to this review…"
                    maxLength={2100}
                    disabled={impersonating || isPending}
                  />
                  <div className="rvw-char-count">
                    {draft.length} / 2000
                  </div>
                  {replyError[r.id] && (
                    <div className="rvw-err">{replyError[r.id]}</div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="rvw-actions">
                {/* Reply toggle / save */}
                {!impersonating && (
                  <>
                    {isOpen ? (
                      <>
                        <button
                          className="rvw-btn primary"
                          onClick={() => handleReply(r.id)}
                          disabled={isPending}
                        >
                          {isPending ? "Saving…" : r.seller_reply ? "Update reply" : "Post reply"}
                        </button>
                        <button
                          className="rvw-btn"
                          onClick={() => {
                            setOpenReply(null);
                            setDraftReply((p) => ({ ...p, [r.id]: r.seller_reply ?? "" }));
                            setReplyError((p) => ({ ...p, [r.id]: "" }));
                          }}
                          disabled={isPending}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className="rvw-btn"
                        onClick={() => {
                          setOpenReply(r.id);
                          setDraftReply((p) => ({ ...p, [r.id]: r.seller_reply ?? "" }));
                        }}
                        disabled={isPending}
                      >
                        {r.seller_reply ? "Edit reply" : "Reply"}
                      </button>
                    )}
                  </>
                )}

                {/* Hide / Show toggle */}
                {!impersonating && (
                  <button
                    className={`rvw-btn${isPublic ? " danger" : ""}`}
                    onClick={() => handleToggleVisibility(r.id, isPublic)}
                    disabled={isPending}
                    title={
                      isPublic
                        ? "Hide this review — it will no longer appear on the product page"
                        : "Make this review visible to buyers on the product page"
                    }
                  >
                    {isPublic ? "Hide review" : "Show review"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div className="rvw-toast">
          <span className={`d ${toast.ok ? "ok" : "err"}`} />
          {toast.msg}
        </div>
      )}
    </>
  );
}
