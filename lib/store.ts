// Store (storefront) page model + constants. No server-only imports → usable in
// the builder (client), preview, and public renderer (server). Mirrors lib/website.ts.
// One StoreContent JSONB blob on pages.content where page_type = "store"
// (the seller's storefront at /store). Products come from real published `opp`
// pages (via getStoreProducts) — this model is layout + merchandising only.

import { ACCENTS, BTSHAPES, FONTS, FONT_FAMILY, FONT_GOOGLE, WIDTHS, WIDTH_PX, type WSLegalDoc } from "@/lib/website";
export { ACCENTS, BTSHAPES, FONTS, FONT_FAMILY, FONT_GOOGLE, WIDTHS, WIDTH_PX };

export type StoreBanner = { img?: string; heading: string; sub: string; cta: string; url?: string };
/** A product added directly in the store builder (shown alongside real opp products). */
export type StoreItem = { id: string; name: string; cat: string; price?: string; compareAt?: string; img?: string; badge?: string; rating?: string; url?: string };

export type StoreContent = {
  // brand
  store?: string;
  tagline?: string;
  logo?: string;
  accent?: number;
  accentColor?: string;
  btshape?: "soft" | "pill" | "sq";
  font?: string;
  theme?: "light" | "dark";
  pageWidth?: string;
  menu?: string[];
  // sections
  order?: string[];
  sections?: Record<string, boolean>;
  heads?: Record<string, { title?: string; sub?: string }>;
  // merchandising content
  banner?: StoreBanner[];
  brands?: string;
  brandLogos?: string[];
  products?: StoreItem[]; // products added directly in the builder
  featuredIdx?: number; // index into the combined product list
  display?: "grid" | "list" | "row";
  cols?: number;
  // add-ons
  announce?: { on: boolean; text: string };
  footerPay?: boolean;
  bottomNav?: boolean; // mobile bottom app nav
  legal?: Record<string, WSLegalDoc>;
};

/** Reorderable / toggleable storefront sections. */
export const STORE_SECTIONS: [string, string][] = [
  ["banner", "Banner slider"], ["brands", "Brand slider"], ["topselling", "Top selling"],
  ["featured", "Featured banner"], ["catalog", "All products"],
];
export const STORE_LABELS: Record<string, string> = Object.fromEntries(STORE_SECTIONS);

/** Catalog layout modes. */
export const DISPLAYS: [string, string][] = [["grid", "Grid"], ["list", "List"], ["row", "Row"]];
export const STORE_COLS = [2, 3, 4];

const ORDER = ["banner", "brands", "topselling", "featured", "catalog"];

/** Footer payment method labels. */
export const PAY_METHODS = ["UPI", "VISA", "Mastercard", "RuPay", "Paytm", "PhonePe", "GPay", "Net Banking"];

export const DEFAULT_STORE: StoreContent = {
  store: "Your store",
  tagline: "Quality products, delivered with care",
  accent: 0,
  btshape: "soft",
  font: "sora",
  theme: "light",
  pageWidth: "wide",
  menu: ["Home", "Shop", "Categories", "About"],
  order: [...ORDER],
  sections: Object.fromEntries(ORDER.map((k) => [k, true])),
  heads: {
    topselling: { title: "Top selling", sub: "" },
    catalog: { title: "All products", sub: "" },
  },
  banner: [
    { heading: "Festive Sale is Live", sub: "Up to 60% off across the store", cta: "Shop the sale", url: "#" },
    { heading: "New arrivals just dropped", sub: "Fresh picks for the season", cta: "Explore", url: "#" },
  ],
  brands: "Forbes, YogaToday, Mindful, Wellness+, Bloom, NDTV",
  brandLogos: [],
  products: [],
  featuredIdx: 0,
  display: "grid",
  cols: 3,
  announce: { on: true, text: "🎉 Festive sale — up to 60% off! Code SALE60" },
  footerPay: true,
  bottomNav: true,
  legal: {
    privacy: { on: true, title: "Privacy Policy", text: "We respect your privacy. We never sell your personal data." },
    terms: { on: true, title: "Terms of Service", text: "By using this store you agree to these terms." },
    refund: { on: true, title: "Refund Policy", text: "Easy refunds within the return window — contact us." },
    shipping: { on: false, title: "Shipping Policy", text: "Orders ship within 1–2 business days." },
  },
};

/** A product card as the storefront renders it (mapped from a published opp page). */
export type StoreProduct = { id: string; name: string; cat: string; price?: string; compareAt?: string; img?: string; rating?: string; badge?: string; url: string; priceNum?: number; currency?: string; buyable?: boolean };
