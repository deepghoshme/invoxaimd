// Server-renderable reviews section — no "use client" needed (pure display).
// Renders real product_reviews rows fetched server-side.

export type ProductReview = {
  id: string;
  buyer_name: string | null;
  buyer_email?: string | null;
  rating: number;
  body: string | null;
  created_at: string;
  seller_reply: string | null;
  replied_at: string | null;
};

export type ReviewStats = {
  avg: number; // 1 decimal place
  count: number;
};

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  const full = Math.round(Math.max(0, Math.min(5, rating)));
  return (
    <span
      aria-label={`${full} out of 5 stars`}
      style={{ fontSize: size, letterSpacing: 1, lineHeight: 1 }}
    >
      {"★★★★★".slice(0, full)}
      <span style={{ opacity: 0.25 }}>{"★★★★★".slice(full)}</span>
    </span>
  );
}

function formatReviewDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function EmptyState() {
  return (
    <div
      style={{
        padding: "40px 0",
        textAlign: "center",
        color: "var(--pdp-muted, #6b7280)",
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 12 }}>★</div>
      <p style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 500 }}>No reviews yet</p>
      <p style={{ margin: "6px 0 0", fontSize: "0.85rem", opacity: 0.7 }}>
        Be the first to review this product.
      </p>
    </div>
  );
}

export default function ReviewsSection({
  reviews,
  stats,
}: {
  reviews: ProductReview[];
  stats?: ReviewStats;
}) {
  if (!reviews.length) return <EmptyState />;

  return (
    <div className="pdp-reviews-list">
      {/* Aggregate summary header */}
      {stats && stats.count > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 24,
            padding: "16px 20px",
            background: "var(--pdp-review-bg, rgba(0,0,0,.04))",
            borderRadius: 12,
          }}
        >
          <div
            style={{
              fontSize: "2.5rem",
              fontWeight: 800,
              lineHeight: 1,
              color: "var(--pdp-text, #111)",
            }}
          >
            {stats.avg.toFixed(1)}
          </div>
          <div>
            <StarRow rating={stats.avg} size={18} />
            <div
              style={{
                fontSize: "0.8125rem",
                color: "var(--pdp-muted, #6b7280)",
                marginTop: 4,
              }}
            >
              Based on {stats.count} review{stats.count === 1 ? "" : "s"}
            </div>
          </div>
        </div>
      )}

      {/* Individual reviews */}
      {reviews.map((r) => (
        <div
          key={r.id}
          style={{
            borderBottom: "1px solid var(--pdp-border, #e5e7eb)",
            padding: "18px 0",
          }}
        >
          {/* Reviewer header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "var(--p, #6366f1)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: "0.875rem",
                flexShrink: 0,
              }}
            >
              {(r.buyer_name || "V")[0].toUpperCase()}
            </div>
            <div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "0.9375rem",
                  color: "var(--pdp-text, #111)",
                }}
              >
                {r.buyer_name || "Verified buyer"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                <StarRow rating={r.rating} size={13} />
                {r.created_at && (
                  <span
                    style={{ fontSize: "0.75rem", color: "var(--pdp-muted, #9ca3af)" }}
                  >
                    {formatReviewDate(r.created_at)}
                  </span>
                )}
              </div>
            </div>
            <span
              style={{
                marginLeft: "auto",
                fontSize: "0.7rem",
                color: "var(--pdp-muted, #9ca3af)",
                background: "var(--pdp-review-bg, rgba(0,0,0,.04))",
                padding: "2px 8px",
                borderRadius: 99,
                whiteSpace: "nowrap",
              }}
            >
              Verified purchase
            </span>
          </div>

          {/* Review body */}
          {r.body && (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: "0.9375rem",
                lineHeight: 1.6,
                color: "var(--pdp-text, #374151)",
                whiteSpace: "pre-wrap",
              }}
            >
              {r.body}
            </p>
          )}

          {/* Seller reply */}
          {r.seller_reply && (
            <div
              style={{
                marginTop: 12,
                padding: "12px 16px",
                background: "var(--pdp-reply-bg, rgba(99,102,241,.06))",
                borderLeft: "3px solid var(--p, #6366f1)",
                borderRadius: "0 8px 8px 0",
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "var(--p, #6366f1)",
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Seller reply
                {r.replied_at && (
                  <span
                    style={{
                      fontWeight: 400,
                      color: "var(--pdp-muted, #9ca3af)",
                      marginLeft: 8,
                      textTransform: "none",
                      letterSpacing: 0,
                    }}
                  >
                    · {formatReviewDate(r.replied_at)}
                  </span>
                )}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.9rem",
                  lineHeight: 1.6,
                  color: "var(--pdp-text, #374151)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {r.seller_reply}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
