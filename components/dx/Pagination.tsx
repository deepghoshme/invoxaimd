/**
 * Pagination — server-component-friendly (no client state).
 * Renders "Showing X–Y of N" + Prev/Next links preserving existing query params.
 *
 * Props:
 *   page        — current page (1-based)
 *   pageSize    — rows per page (default 50)
 *   total       — total row count from the DB (count: "exact")
 *   baseParams  — current searchParams record to merge into each link href
 */
export interface PaginationProps {
  page: number;
  pageSize?: number;
  total: number;
  baseParams?: Record<string, string | string[] | undefined>;
}

function buildHref(
  baseParams: Record<string, string | string[] | undefined>,
  targetPage: number
): string {
  const params = new URLSearchParams();
  // Carry over all existing params except "page"
  for (const [k, v] of Object.entries(baseParams)) {
    if (k === "page") continue;
    if (Array.isArray(v)) {
      v.forEach((val) => { if (val !== undefined) params.append(k, val); });
    } else if (v !== undefined) {
      params.set(k, v);
    }
  }
  params.set("page", String(targetPage));
  return "?" + params.toString();
}

export default function Pagination({
  page,
  pageSize = 50,
  total,
  baseParams = {},
}: PaginationProps) {
  if (total <= 0) return null;

  const lastPage = Math.ceil(total / pageSize);
  // Clamp page defensively
  const safePage = Math.max(1, Math.min(page, lastPage));

  const from = (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  const prevHref = safePage > 1 ? buildHref(baseParams, safePage - 1) : null;
  const nextHref = safePage < lastPage ? buildHref(baseParams, safePage + 1) : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        padding: "12px 16px",
        borderTop: "1px solid var(--border)",
        fontSize: 13,
        color: "var(--muted)",
      }}
    >
      <span>
        Showing {from.toLocaleString("en-IN")}–{to.toLocaleString("en-IN")} of{" "}
        {total.toLocaleString("en-IN")}
      </span>

      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {prevHref ? (
          <a
            href={prevHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface2)",
              color: "var(--text)",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            ← Prev
          </a>
        ) : (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface2)",
              color: "var(--muted)",
              fontSize: 13,
              fontWeight: 600,
              opacity: 0.45,
              cursor: "not-allowed",
            }}
          >
            ← Prev
          </span>
        )}

        <span style={{ fontSize: 12, minWidth: 60, textAlign: "center" }}>
          {safePage} / {lastPage}
        </span>

        {nextHref ? (
          <a
            href={nextHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface2)",
              color: "var(--text)",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            Next →
          </a>
        ) : (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface2)",
              color: "var(--muted)",
              fontSize: 13,
              fontWeight: 600,
              opacity: 0.45,
              cursor: "not-allowed",
            }}
          >
            Next →
          </span>
        )}
      </span>
    </div>
  );
}
