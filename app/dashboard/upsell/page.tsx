import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis } from "@/components/dx/ui";
import UpsellClient, { type UpsellOffer, type Product } from "./UpsellClient";

export const dynamic = "force-dynamic";

function inr(paise: number) {
  return "₹" + Math.round(paise / 100).toLocaleString("en-IN");
}

export default async function UpsellPage() {
  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  /* ── graceful: detect whether migration has been applied ── */
  let migrationPending = false;
  let offers: UpsellOffer[] = [];

  try {
    const { data, error } = await sb
      .from("upsell_offers")
      .select("*")
      .eq("store_id", store.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

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

  /* ── opp pages: one-page opportunity products ── */
  const { data: oppPages } = await sb
    .from("pages")
    .select("id, title, content")
    .eq("store_id", store.id)
    .eq("page_type", "opp")
    .order("created_at", { ascending: false });

  /* combine into a unified product list for the offer picker */
  const products: Product[] = [
    ...((storeProds ?? []).map((p) => ({
      id: p.id as string,
      name: (p.name as string) || "Untitled",
      price: p.price != null ? Number(p.price) : null,
      source: "store" as const,
    }))),
    ...((oppPages ?? []).map((p) => {
      const content = (p.content ?? {}) as Record<string, unknown>;
      const price = content.price != null ? Number(content.price) : null;
      return {
        id: p.id as string,
        name: (p.title as string) || "Untitled",
        price,
        source: "opp" as const,
      };
    })),
  ];

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
              value: String(offers.length),
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
    </>
  );
}
