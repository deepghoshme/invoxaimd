"use client";

/**
 * ReviewForm — star rating + text review form shown on the buyer order-detail page.
 *
 * Props:
 *   orderId     — the order this review is for
 *   existingReview — if non-null, the buyer already reviewed; show read-only state
 *   productTitle — for personalising the prompt
 */

import { useState, useTransition } from "react";
import { submitReview } from "./reviewActions";
import type { BuyerReview } from "@/lib/buyer";

interface Props {
  orderId: string;
  existingReview: BuyerReview | null;
  productTitle: string;
}

const STAR_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="rv-stars-display" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rating ? "rv-star rv-star-filled" : "rv-star rv-star-empty"}>
          ★
        </span>
      ))}
    </span>
  );
}

function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;

  return (
    <span className="rv-star-picker" aria-label="Select a star rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          aria-label={`${n} star${n !== 1 ? "s" : ""}`}
          className={
            "rv-star-btn" +
            (n <= display ? " rv-star-btn-on" : " rv-star-btn-off")
          }
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
      {display > 0 && (
        <span className="rv-star-label">{STAR_LABELS[display]}</span>
      )}
    </span>
  );
}

export default function ReviewForm({ orderId, existingReview, productTitle }: Props) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Already reviewed — show read-only card
  if (existingReview) {
    return (
      <>
        <style>{REVIEW_CSS}</style>
        <div className="rv-section">
          <h3 className="rv-section-title">Your Review</h3>
          <div className="rv-existing-card">
            <div className="rv-existing-top">
              <StarDisplay rating={existingReview.rating} />
              <span className="rv-existing-date">
                {new Date(existingReview.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
            {existingReview.body && (
              <p className="rv-existing-body">{existingReview.body}</p>
            )}
            <p className="rv-thanks-note">Thanks for your review!</p>
            {existingReview.seller_reply && (
              <div className="rv-seller-reply">
                <div className="rv-seller-reply-label">Seller reply</div>
                <p className="rv-seller-reply-body">{existingReview.seller_reply}</p>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // Not yet reviewed — show the form
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setResult({ ok: false, message: "Please select a star rating." });
      return;
    }
    setResult(null);
    startTransition(async () => {
      const res = await submitReview({ orderId, rating, body });
      if (res.ok) {
        setResult({ ok: true, message: "Your review has been submitted. Thank you!" });
      } else {
        setResult({ ok: false, message: res.error });
      }
    });
  }

  const submitted = result?.ok === true;

  return (
    <>
      <style>{REVIEW_CSS}</style>
      <div className="rv-section">
        <h3 className="rv-section-title">Rate your purchase</h3>
        <div className="rv-form-card">
          {submitted ? (
            <div className="rv-success">
              <div className="rv-success-icon">✓</div>
              <div className="rv-success-text">
                <strong>Review submitted!</strong>
                <p>Thanks for rating {productTitle}. Your feedback helps other buyers.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="rv-form">
              <div className="rv-form-row">
                <label className="rv-label">Your rating</label>
                <StarPicker value={rating} onChange={setRating} disabled={isPending} />
              </div>

              <div className="rv-form-row">
                <label className="rv-label" htmlFor="rv-body">
                  Your review <span className="rv-optional">(optional)</span>
                </label>
                <textarea
                  id="rv-body"
                  className="rv-textarea"
                  rows={4}
                  maxLength={2000}
                  placeholder={`What did you think of ${productTitle}?`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  disabled={isPending}
                />
                <div className="rv-char-count">{body.length}/2000</div>
              </div>

              {result && !result.ok && (
                <div className="rv-error" role="alert">
                  {result.message}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-gradient btn-sm rv-submit-btn"
                disabled={isPending || rating === 0}
              >
                {isPending ? "Submitting..." : "Submit review"}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

// ── Scoped CSS ─────────────────────────────────────────────────────────────

const REVIEW_CSS = `
  .rv-section {
    margin-bottom: 18px;
  }
  .rv-section-title {
    font-family: var(--font-heading);
    font-size: 16px;
    font-weight: 700;
    margin: 0 0 12px;
  }
  /* ── Form card ── */
  .rv-form-card {
    background: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 22px 24px;
    box-shadow: var(--shadow);
  }
  .rv-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .rv-form-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .rv-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text);
  }
  .rv-optional {
    font-weight: 400;
    color: var(--color-muted);
    font-size: 12px;
  }
  /* ── Star picker ── */
  .rv-star-picker {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .rv-star-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 28px;
    padding: 0 3px;
    line-height: 1;
    transition: transform 0.1s;
  }
  .rv-star-btn:not(:disabled):hover { transform: scale(1.15); }
  .rv-star-btn:disabled { cursor: default; opacity: 0.6; }
  .rv-star-btn-on  { color: #f59e0b; }
  .rv-star-btn-off { color: var(--color-border); }
  .rv-star-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-muted);
    margin-left: 8px;
  }
  /* ── Textarea ── */
  .rv-textarea {
    width: 100%;
    background: var(--color-surface2);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 14px;
    color: var(--color-text);
    font-family: var(--font-body);
    resize: vertical;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }
  .rv-textarea:focus {
    outline: none;
    border-color: var(--color-accent);
  }
  .rv-textarea:disabled { opacity: 0.6; }
  .rv-char-count {
    font-size: 11px;
    color: var(--color-muted);
    text-align: right;
  }
  /* ── Error / success ── */
  .rv-error {
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.25);
    border-radius: 8px;
    padding: 9px 13px;
    font-size: 13px;
    color: #ef4444;
  }
  .rv-submit-btn {
    align-self: flex-start;
  }
  .rv-success {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }
  .rv-success-icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(34,197,94,0.12);
    color: #22c55e;
    display: grid;
    place-items: center;
    font-size: 18px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .rv-success-text strong {
    display: block;
    font-size: 15px;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .rv-success-text p {
    margin: 0;
    font-size: 13.5px;
    color: var(--color-muted);
    line-height: 1.5;
  }
  /* ── Existing review (read-only) ── */
  .rv-existing-card {
    background: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 20px 24px;
    box-shadow: var(--shadow);
  }
  .rv-existing-top {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .rv-stars-display { display: inline-flex; gap: 2px; }
  .rv-star { font-size: 20px; line-height: 1; }
  .rv-star-filled { color: #f59e0b; }
  .rv-star-empty  { color: var(--color-border); }
  .rv-existing-date {
    font-size: 12px;
    color: var(--color-muted);
  }
  .rv-existing-body {
    font-size: 14px;
    color: var(--color-text);
    line-height: 1.55;
    margin: 0 0 10px;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .rv-thanks-note {
    font-size: 12.5px;
    color: var(--color-muted);
    margin: 0;
    font-style: italic;
  }
  .rv-seller-reply {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--color-border);
  }
  .rv-seller-reply-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--color-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 6px;
  }
  .rv-seller-reply-body {
    font-size: 13.5px;
    color: var(--color-text);
    margin: 0;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }
`;
