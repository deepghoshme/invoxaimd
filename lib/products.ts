// Shared one-page product (opp) content model + money helpers. No server-only
// imports → usable in both the public renderer (server) and the editor (client).

export type Testimonial = { name: string; text: string; avatar_url?: string; rating?: number };
export type Faq = { q: string; a: string };
export type ProductPolicies = { privacy?: string; terms?: string; refund?: string };

export type PDPVariant = { name: string; options: string[] };

export type OppContent = {
  layout?: "landing" | "pdp"; // page style — landing (default) or catalog product-detail
  // PDP-only fields (catalog layout):
  variants?: PDPVariant[];
  specs?: [string, string][];
  related?: { name: string; price?: number; compareAt?: number; img?: string; url?: string }[];
  highlights?: string[];
  offers?: string[];
  productType?: "digital" | "physical" | "service" | "subscription";
  plans?: { label: string; price: number; period?: string }[]; // service/subscription pricing plans
  digital?: { kind?: "file" | "url"; file?: string; url?: string }; // digital delivery (file/PDF or URL)
  deliveryDays?: number; // physical → pincode delivery estimate
  category?: string; // shown on cards + store category filter
  rating?: string; // display rating (e.g. "4.9")
  reviews_count?: string; // display review count (e.g. "1,240")
  headline?: string;
  subheadline?: string;
  description?: string;
  description_html?: string; // rich-text description (HTML); preferred over description
  image_url?: string;
  gallery?: string[]; // image slider (in addition to / instead of image_url)
  features?: string[]; // legacy plain features (kept for back-compat)
  feature_items?: { text: string; icon?: string }[]; // features with custom icons
  badges?: string[]; // trust badges: "Instant access", "Payment secured", custom…
  testimonials?: Testimonial[];
  faqs?: Faq[];
  policies?: ProductPolicies; // optional Privacy / T&C / Refund sections
  price?: number; // major units (e.g. rupees); 0/undefined = free/contact
  compare_at_price?: number; // optional strike-through "was" price
  currency?: string; // ISO 4217, default INR
  cta_label?: string; // "Buy now"
  cta_icon?: string; // icon (emoji) shown on the Buy button
  cta_animation?: "none" | "shine" | "pulse"; // Buy button animation
  sticky_buy?: boolean; // floating reveal-on-scroll Buy (default on); off → static bottom bar on mobile
  collect_phone?: boolean;
  accent?: string; // (legacy) optional accent color override — superseded by `theme`
  // ---- Page theme (applies to BOTH Landing + Catalog/PDP layouts) ----
  theme?: {
    accent?: number;                       // index into ACCENTS preset gradients
    color?: string;                        // custom hex (overrides the preset)
    mode?: "light" | "dark";               // color scheme
    font?: string;                         // heading font key (FONTS)
    btshape?: "soft" | "pill" | "sq";      // button corner style
    width?: string;                        // content width key (WIDTHS)
    bg?: string;                           // landing animated background (BGS)
  };
  show_payment_logos?: boolean; // footer payment-brand logos (default on)
  payment_icons?: string[]; // seller-uploaded payment icon images (footer)
  seller_email?: string; // contact email — required to publish
  seller_phone?: string; // contact phone — optional
  title_align?: "left" | "center" | "right";
  title_icon?: string; // emoji or short text shown before the title
  gallery_autoplay?: boolean; // slider auto-scroll
  gallery_interval?: number; // seconds between slides (default 4)

  // ---- Urgency suite ----
  countdown_enabled?: boolean;
  countdown_end?: string; // ISO datetime the offer ends
  countdown_expire_msg?: string; // shown once the timer hits zero
  countdown_disable_buy?: boolean; // block the Buy button after expiry
  countdown_align?: "left" | "center" | "right";

  seats_enabled?: boolean;
  seats_total?: number; // "Only X left" = total − paid orders; 0 left → sold out

  // When sold out, the Buy button is replaced with a "Contact seller" button.
  contact_whatsapp?: string; // phone number (digits) for wa.me
  contact_email?: string; // contact email for mailto
  contact_url?: string; // custom URL (overrides whatsapp/email)
  contact_label?: string; // custom button text
  contact_icon?: string; // custom button icon (emoji)

  liveproof_enabled?: boolean;
  liveproof_interval?: number; // seconds between popups (default 8)
  liveproof_items?: { name: string; location?: string }[];
};

export const BADGE_PRESETS = [
  "Instant access",
  "Payment secured",
  "Money-back guarantee",
  "24/7 support",
  "Lifetime access",
] as const;

export const PAYMENT_BRANDS = ["VISA", "Mastercard", "RuPay", "UPI", "Razorpay"] as const;

/** All images for the slider: gallery first, else the single image. */
export function productImages(content: OppContent): string[] {
  const g = (content.gallery ?? []).filter(Boolean);
  if (g.length) return g;
  return content.image_url ? [content.image_url] : [];
}

export const DEFAULT_CURRENCY = "INR";

/** Product types (drives delivery + pricing UI). */
export const PRODUCT_TYPES: [string, string][] = [
  ["digital", "Digital"], ["physical", "Physical"], ["service", "Service"], ["subscription", "Subscription"],
];
/** Plan billing periods (service/subscription). */
export const PLAN_PERIODS: [string, string][] = [
  ["monthly", "Monthly"], ["yearly", "Yearly"], ["lifetime", "Lifetime"], ["custom", "Custom"],
];

/** One-click product page theme presets (apply over the current theme). */
export const OPP_THEMES: { name: string; patch: NonNullable<OppContent["theme"]> }[] = [
  { name: "Sunset", patch: { accent: 0, mode: "light", font: "sora", btshape: "soft", bg: "aurora" } },
  { name: "Minimal", patch: { accent: 7, mode: "light", font: "inter", btshape: "sq", bg: "none" } },
  { name: "Bold", patch: { accent: 4, mode: "light", font: "montserrat", btshape: "pill", bg: "glow" } },
  { name: "Midnight", patch: { accent: 5, mode: "dark", font: "space", btshape: "soft", bg: "mesh" } },
  { name: "Ocean", patch: { accent: 5, mode: "light", font: "poppins", btshape: "soft", bg: "mesh" } },
  { name: "Luxe", patch: { accent: 3, mode: "dark", font: "playfair", btshape: "soft", bg: "glow" } },
];

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND"]); // no minor unit

/** Major units (₹499.00) → smallest unit (paise) for the gateway. */
export function toMinorUnit(amount: number, currency = DEFAULT_CURRENCY): number {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  const factor = ZERO_DECIMAL.has(currency.toUpperCase()) ? 1 : 100;
  return Math.round(amount * factor);
}

/** Smallest unit → display string with the currency symbol. */
export function formatMoney(minor: number, currency = DEFAULT_CURRENCY): string {
  const factor = ZERO_DECIMAL.has(currency.toUpperCase()) ? 1 : 100;
  const value = minor / factor;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: factor === 1 ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

/** Format a major-unit price directly (editor preview). */
export function formatPrice(major?: number, currency = DEFAULT_CURRENCY): string {
  if (!major || major <= 0) return "Free";
  return formatMoney(toMinorUnit(major, currency), currency);
}
