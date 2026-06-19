import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card } from "@/components/dx/ui";
import Pagination from "@/components/dx/Pagination";
import ReviewsClient, { type ReviewRow } from "./ReviewsClient";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { store, impersonating } = await requireDashboardStore();

  // Use the admin client scoped to store_id (same pattern as coupons/crm).
  // The seller's UPDATE operations in actions.ts use the session client so
  // RLS owns_store policy enforces tenancy there; reads here are scoped by
  // the explicit .eq("store_id", store.id) filter.
  const sb = createAdminClient();

  // ── KPI aggregates (all rows, lightweight select) ────────────────────────
  const { data: allRows } = await sb
    .from("product_reviews")
    .select("rating, status, is_visible")
    .eq("store_id", store.id);

  const totalReviews = (allRows ?? []).length;
  const avgRating =
    totalReviews > 0
      ? (allRows ?? []).reduce((s, r) => s + (r.rating ?? 0), 0) / totalReviews
      : 0;
  const hiddenCount = (allRows ?? []).filter(
    (r) => !r.is_visible || r.status === "hidden"
  ).length;
  const pendingCount = (allRows ?? []).filter((r) => r.status === "pending").length;

  // ── Paginated rows with product/page join (best-effort) ──────────────────
  // We left-join store_products for the product title so sellers see a friendly
  // name rather than a raw UUID. If the join returns nothing the product_id/page_id
  // UUID is shown as a fallback in the client.
  const { data: rows } = await sb
    .from("product_reviews")
    .select(
      `id, rating, body, buyer_name, buyer_email,
       status, is_visible, seller_reply, replied_at, created_at,
       product_id, page_id`
    )
    .eq("store_id", store.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  // Attempt to enrich with product titles from store_products.
  // This is best-effort: if the table or column differs the reviews still render.
  let productTitleMap: Record<string, string> = {};
  const productIds = (rows ?? [])
    .map((r) => r.product_id)
    .filter(Boolean) as string[];

  if (productIds.length > 0) {
    const { data: products } = await sb
      .from("store_products")
      .select("id, title")
      .in("id", productIds);
    for (const p of products ?? []) {
      if (p.id && p.title) productTitleMap[p.id] = p.title;
    }
  }

  const reviews: ReviewRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    rating: r.rating ?? 0,
    body: r.body ?? null,
    buyer_name: r.buyer_name ?? null,
    buyer_email: r.buyer_email ?? null,
    status: r.status as "approved" | "pending" | "hidden",
    is_visible: r.is_visible ?? false,
    seller_reply: r.seller_reply ?? null,
    replied_at: r.replied_at ?? null,
    created_at: r.created_at,
    product_id: r.product_id ?? null,
    page_id: r.page_id ?? null,
    product_title:
      (r.product_id ? productTitleMap[r.product_id] : null) ?? null,
  }));

  return (
    <>
      <Phead
        title="Reviews"
        sub="Moderate buyer reviews — reply publicly or hide reviews from your product pages."
      />

      <Kpis
        items={[
          {
            icon: "star",
            color: "var(--primary)",
            label: "Total reviews",
            value: String(totalReviews),
          },
          {
            icon: "chart",
            color: "var(--green)",
            label: "Avg. rating",
            value: totalReviews > 0 ? `${avgRating.toFixed(1)} / 5` : "—",
          },
          {
            icon: "bell",
            color: "var(--accent)",
            label: "Pending",
            value: String(pendingCount),
          },
          {
            icon: "eye",
            color: "var(--muted)",
            label: "Hidden",
            value: String(hiddenCount),
          },
        ]}
      />

      <Card title={`Reviews (${totalReviews})`}>
        <ReviewsClient initial={reviews} impersonating={!!impersonating} />
        {totalReviews > PAGE_SIZE && (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={totalReviews}
            baseParams={sp}
          />
        )}
      </Card>
    </>
  );
}
