import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis } from "@/components/dx/ui";
import UpsellClient, { type UpsellOffer, type Product } from "./UpsellClient";
import Pagination from "@/components/dx/Pagination";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function inr(paise: number) {
  return "₹" + Math.round(paise / 100).toLocaleString("en-IN");
}

export default async function UpsellPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  /* ── graceful: detect whether migration has been applied ── */
  let migrationPending = false;
  let offers: UpsellOffer[] = [];
  let offerTotal = 0;

  try {
    const { data, error, count } = await sb
      .from("upsell_offers")
      .select("*", { count: "exact" })
      .eq("store_id", store.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      if (
        error.code === "42P01" ||
        error.message.includes("relation") ||
        error.message.includes("does not exist")
      ) {
        migrationPending = true;
      }
    } else {
      offers = (data ?? []) as UpsellOffer[];
      offerTotal = count ?? 0;
    }
  } catch {
    migrationPending = true;
  }

  /* ── real products from the `products` (store catalog) table ── */
  const { data: storeProds } = await sb
    .from("products")
    .select("id, name, price")
    .eq("store_id", store.id)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: false });

  /* Only the store catalog `products` table is a valid upsell target:
     upsell_offers.offer_product_id / trigger_product_id have FKs to products.id.
     One-page opp funnels live in `pages` (not `products`), so offering one as a
     bump would violate the FK — they're intentionally excluded from the picker. */
  const products: Product[] = (storeProds ?? []).map((p) => ({
    id: p.id as string,
    name: (p.name as string) || "Untitled",
    price: p.price != null ? Number(p.price) : null,
    source: "store" as const,
  }));

  /* ── analytics from real paid orders ── */
  const { data: paidOrders } = await sb
    .from("orders")
    .select("amount")
    .eq("store_id", store.id)
    .eq("status", "paid");

  const paidCount = (paidOrders ?? []).length;
  const totalRevenue = (paidOrders ?? []).reduce(
    (s, o) => s + (o.amount ?? 0),
    0
  );
  const avgOrder = paidCount ? Math.round(totalRevenue / paidCount) : 0;

  const activeOffers = offers.filter((o) => o.is_active).length;

  return (
    <>
      <Phead
        title="Upsell"
        sub="Order bumps and post-purchase offers that increase your average order value."
      />

      {!migrationPending && (
        <Kpis
          items={[
            {
              icon: "up",
              color: "var(--primary)",
              label: "Active offers",
              value: String(activeOffers),
            },
            {
              icon: "bag",
              color: "var(--secondary)",
              label: "Total offers",
              value: String(offerTotal),
            },
            {
              icon: "rupee",
              color: "var(--green)",
              label: "Avg. order value",
              value: inr(avgOrder),
            },
            {
              icon: "chart",
              color: "var(--accent)",
              label: "Paid orders",
              value: paidCount.toLocaleString("en-IN"),
            },
          ]}
        />
      )}

      <UpsellClient
        storeId={store.id}
        initial={offers}
        products={products}
        migrationPending={migrationPending}
      />
      {offerTotal > PAGE_SIZE && (
        <Pagination page={page} pageSize={PAGE_SIZE} total={offerTotal} baseParams={sp} />
      )}
    </>
  );
}
