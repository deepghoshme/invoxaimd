/**
 * Pure helpers for the premium-template apply engine.
 *
 * NO server-only imports, NO DB access — usable from tests, the server action,
 * and future client-side preview code.
 *
 * §4 / §7 of docs/PREMIUM-TEMPLATES-PLAN.md  +  docs/TEMPLATE-AUTHORING-FORMAT.md §4.
 */

// ── Template type (authoring vocabulary) → page_type ENUM ────────────────────
//
// templates.type uses the public-facing names from TEMPLATE-AUTHORING-FORMAT.md §1.
// pages.page_type uses the internal DB enum from the foundation_pages migration.
//
// The 'checkout' type has NO standalone page_type in the DB enum — it is an error.
// The 'led' enum value is reserved but has no public template type today; keep it
// in the map so the action can handle it if a future template uses 'led'.

export type TemplateType =
  | "website"
  | "store"
  | "bio"
  | "courses"
  | "product"
  | "payment"
  | "booking"
  | "lead"
  | "vip"
  | "event"
  | "checkout";

export type PageTypeEnum =
  | "website"
  | "store"
  | "bio"
  | "courses"
  | "opp"
  | "pay"
  | "book"
  | "ldf"
  | "vpc"
  | "led"
  | "env";

/**
 * Maps templates.type → pages.page_type enum.
 *
 * 'checkout' deliberately has no mapping — templates of that type cannot be
 * applied to a standalone page; the apply action returns an error for this case.
 */
export const TYPE_TO_PAGE: Record<TemplateType, PageTypeEnum | null> = {
  website:  "website",
  store:    "store",
  bio:      "bio",
  courses:  "courses",
  product:  "opp",
  payment:  "pay",
  booking:  "book",
  lead:     "ldf",
  vip:      "vpc",
  event:    "env",
  checkout: null,   // no standalone page type — callers must handle null
};

// ── Singleton page types ──────────────────────────────────────────────────────
//
// These are one-per-store and have no public_id (like website/store/bio/courses).
// All other mapped types are "many" and require a targetPageId.

export const SINGLETON_PAGE_TYPES = new Set<PageTypeEnum>([
  "website",
  "store",
  "bio",
  "courses",
]);

// ── Studio redirect routes per page_type ─────────────────────────────────────
//
// Matches the /app/studio/<dir> structure.
//
// Singleton types: the studio page is at /studio/<type> (no id segment).
// Many types: the studio page is at /studio/<dir>/<pageId>.

export const STUDIO_ROUTE: Record<PageTypeEnum, (pageId: string) => string> = {
  website: (_id) => "/studio/website",
  store:   (_id) => "/studio/store",
  bio:     (_id) => "/studio/bio",
  courses: (id)  => `/studio/course/${id}`,
  opp:     (id)  => `/studio/product/${id}`,
  pay:     (id)  => `/studio/product/${id}`,   // no dedicated /studio/pay yet — falls through to product editor
  book:    (id)  => `/studio/booking/${id}`,
  ldf:     (id)  => `/studio/leadform/${id}`,
  vpc:     (id)  => `/studio/vip/${id}`,
  led:     (id)  => `/studio/product/${id}`,   // no dedicated studio yet
  env:     (id)  => `/studio/event/${id}`,
};

// ── KEEP_KEYS — seller-owned content keys that survive a template apply ───────
//
// Merge strategy: start from template.content (deep copy), then re-overlay each
// key listed here FROM the seller's existing page.content (if it exists on that
// object). This means a template NEVER wipes commerce/identity data.
//
// Per-type rationale:
//   website  — seo is the seller's slugs/title; everything else is design.
//   store    — products/featuredIdx are real catalog items; legal docs are seller
//              authored; contact fields; custom domain keys.
//   bio      — identity (name/handle/profile_url/cover_url) + the seller's real
//              link list and socials. Design = accent/bg/button styles.
//   courses  — pricing is seller-owned; headline/description can be overridden by
//              the template, but the seller's actual price must survive.
//   opp      — price, currency, policies, seller_email/phone are commerce-critical.
//   pay      — same as opp.
//   book     — price, slots, contact are the seller's real config.
//   ldf      — fields (form schema) and success routing are seller config.
//   vpc      — plans (pricing) and inviteLink (the real Telegram/Discord URL) are
//              seller-owned; theme is template design.
//   led      — no rich model yet; keep price/contact conservatively.
//   env      — tiers (ticket pricing) and event_date/location are seller-owned.

export const KEEP_KEYS: Record<PageTypeEnum, string[]> = {
  website: [
    "seo",
    "pages",        // custom sub-pages carry seller slugs
  ],

  store: [
    "products",       // StoreContent.products — inline store items
    "featuredIdx",    // which product is featured
    "catalog",        // any catalog reference key
    "customDomain",   // legacy camelCase
    "custom_domain",  // snake_case variant
    "footerPay",      // seller-chosen payment methods
    "legal",          // seller-authored privacy/terms/refund/shipping docs
    "menuLinks",      // seller's real navigation links
    "email",          // contact fields (may live in content)
    "phone",
    "whatsapp",
  ],

  bio: [
    "name",
    "handle",
    "profile_url",
    "cover_url",
    "bio",
    "verified",
    "links",          // the seller's real link list
    "socials",        // the seller's social profiles
  ],

  courses: [
    "price",
    "compare_at_price",
    "currency",
    "instructor_name",
    "instructor_bio",
    "instructor_avatar",
  ],

  opp: [
    "price",
    "compare_at_price",
    "currency",
    "seller_email",
    "seller_phone",
    "policies",
    "collect_phone",
    "digital",
    "deliveryDays",
    "variants",
    "specs",
    "category",
    "productType",
    "payment_icons",
    "plans",          // service/subscription price plans authored by seller
  ],

  pay: [
    "price",
    "compare_at_price",
    "currency",
    "seller_email",
    "seller_phone",
    "policies",
    "collect_phone",
    "payment_icons",
  ],

  book: [
    "price",
    "currency",
    "is_free",
    "duration",
    "buffer",
    "max_per_day",
    "timezone",
    "slots",
    "meeting_type",
    "meeting_detail",
    "host_name",
    "host_bio",
    "host_avatar",
  ],

  ldf: [
    "fields",           // the seller's form field config
    "success_message",  // the seller's post-submit copy
  ],

  vpc: [
    "plans",            // VipPlan[] — the seller's subscription tiers
    "currency",
    "inviteLink",       // the real Telegram/Discord/WhatsApp invite URL
    "platform",
    "host",
    "hostTitle",
    "hostAvatarUrl",
  ],

  led: [
    "price",
    "currency",
    "seller_email",
    "seller_phone",
  ],

  env: [
    "tiers",            // EventTier[] — ticket pricing
    "currency",
    "event_date",
    "event_time",
    "timezone",
    "is_online",
    "location",
  ],
};

// ── Pure merge helper ─────────────────────────────────────────────────────────

/**
 * Produce a merged content blob:
 *   1. Deep-copy template.content.
 *   2. Spread template.theme keys into the copy (theme tokens override content-level
 *      theme fields because the template manifest may store tokens in `theme` separately).
 *   3. Re-overlay KEEP_KEYS from the seller's existing content (never lost).
 *
 * This function is pure and unit-testable — it does no I/O.
 *
 * @param templateContent  The `content` JSONB from the templates table.
 * @param templateTheme    The `theme` JSONB from the templates table (may be {}).
 * @param existingContent  The seller's current pages.content (may be null/undefined).
 * @param pageType         The page_type enum value (drives KEEP_KEYS selection).
 */
export function mergeTemplateIntoContent(
  templateContent: Record<string, unknown>,
  templateTheme: Record<string, unknown>,
  existingContent: Record<string, unknown> | null | undefined,
  pageType: PageTypeEnum,
): Record<string, unknown> {
  // 1. Deep-copy template content (JSON round-trip — all values are JSON-safe JSONB)
  const merged: Record<string, unknown> = JSON.parse(JSON.stringify(templateContent));

  // 2. Overlay template theme tokens (design tokens like accent/font/bg).
  //    Only spread non-empty theme objects to avoid clobbering content with `{}`.
  if (templateTheme && Object.keys(templateTheme).length > 0) {
    Object.assign(merged, JSON.parse(JSON.stringify(templateTheme)));
  }

  // 3. Re-overlay seller-owned keys from existing content (the keep-whitelist).
  const keysToKeep = KEEP_KEYS[pageType] ?? [];
  if (existingContent && keysToKeep.length > 0) {
    for (const key of keysToKeep) {
      if (Object.prototype.hasOwnProperty.call(existingContent, key)) {
        merged[key] = existingContent[key];
      }
    }
  }

  return merged;
}
