// Store product catalog model. "Store products" = lightweight items added via a
// popup on the Store page (distinct from one-page `opp` pages). Rows live in the
// `products` table. No server-only imports → usable in client form + storefront.

import { PRODUCT_TYPES, PLAN_PERIODS, formatPrice } from "@/lib/products";
export { PRODUCT_TYPES, PLAN_PERIODS, formatPrice };

export type CatalogPlan = { label: string; price: number; period?: string };
export type CatalogDetail = { label: string; value: string };
export type CatalogOption = { name: string; values: string[] };
export type CatalogReview = { name: string; rating: number; text: string; date?: string };
export type CatalogProductType = "digital" | "physical" | "service" | "subscription";

/** Matches the `products` table columns (snake_case) so no mapping is needed. */
export type CatalogProduct = {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  compare_at_price?: number | null;
  currency: string;
  image?: string | null;
  gallery: string[];
  category?: string | null;
  badge?: string | null;
  product_type: CatalogProductType;
  digital?: { kind: "file" | "url"; file?: string; url?: string } | null;
  plans: CatalogPlan[];
  details: CatalogDetail[];
  delivery_days?: number | null;
  // PDP (Shopify-style) fields
  highlights: string[];
  options: CatalogOption[];
  reviews: CatalogReview[];
  rating?: number | null;
  reviews_count?: number | null;
  stock?: number | null;
  sku?: string | null;
  vendor?: string | null;
  shipping_info?: string | null;
  returns_info?: string | null;
  trust_badges: string[];
  store_visible: boolean;
  sort: number;
};

/** Editable fields sent to the create/update actions. */
export type CatalogInput = Omit<CatalogProduct, "id">;

export const EMPTY_PRODUCT: CatalogInput = {
  name: "",
  description: "",
  price: undefined,
  compare_at_price: undefined,
  currency: "INR",
  image: "",
  gallery: [],
  category: "",
  badge: "",
  product_type: "digital",
  digital: { kind: "url" },
  plans: [],
  details: [],
  delivery_days: undefined,
  highlights: [],
  options: [],
  reviews: [],
  rating: undefined,
  reviews_count: undefined,
  stock: undefined,
  sku: "",
  vendor: "",
  shipping_info: "",
  returns_info: "",
  trust_badges: [],
  store_visible: true,
  sort: 0,
};

/** Normalise a raw DB row into a typed CatalogProduct. */
export function rowToProduct(r: Record<string, unknown>): CatalogProduct {
  return {
    id: String(r.id),
    name: (r.name as string) ?? "Untitled product",
    description: (r.description as string) ?? "",
    price: r.price != null ? Number(r.price) : undefined,
    compare_at_price: r.compare_at_price != null ? Number(r.compare_at_price) : undefined,
    currency: (r.currency as string) ?? "INR",
    image: (r.image as string) ?? "",
    gallery: Array.isArray(r.gallery) ? (r.gallery as string[]) : [],
    category: (r.category as string) ?? "",
    badge: (r.badge as string) ?? "",
    product_type: (r.product_type as CatalogProductType) ?? "digital",
    digital: (r.digital as CatalogProduct["digital"]) ?? { kind: "url" },
    plans: Array.isArray(r.plans) ? (r.plans as CatalogPlan[]) : [],
    details: Array.isArray(r.details) ? (r.details as CatalogDetail[]) : [],
    delivery_days: r.delivery_days != null ? Number(r.delivery_days) : undefined,
    highlights: Array.isArray(r.highlights) ? (r.highlights as string[]) : [],
    options: Array.isArray(r.options) ? (r.options as CatalogOption[]) : [],
    reviews: Array.isArray(r.reviews) ? (r.reviews as CatalogReview[]) : [],
    rating: r.rating != null ? Number(r.rating) : undefined,
    reviews_count: r.reviews_count != null ? Number(r.reviews_count) : undefined,
    stock: r.stock != null ? Number(r.stock) : undefined,
    sku: (r.sku as string) ?? "",
    vendor: (r.vendor as string) ?? "",
    shipping_info: (r.shipping_info as string) ?? "",
    returns_info: (r.returns_info as string) ?? "",
    trust_badges: Array.isArray(r.trust_badges) ? (r.trust_badges as string[]) : [],
    store_visible: r.store_visible !== false,
    sort: r.sort != null ? Number(r.sort) : 0,
  };
}
