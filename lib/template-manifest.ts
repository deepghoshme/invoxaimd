/**
 * Template Manifest — shared validator (Phase C).
 *
 * Pure TypeScript: NO 'use server', NO DB imports, NO server-only modules.
 * Safe to import from client code, server actions, and tests.
 *
 * The manifest envelope is defined in docs/TEMPLATE-AUTHORING-FORMAT.md §1.
 * Content key allowlists below are derived from the top-level keys of each
 * *Content TypeScript type in lib/<type>.ts — they mirror those types.
 */

// ── Manifest types ────────────────────────────────────────────────────────────

export type TemplateType =
  | "bio"
  | "store"
  | "product"
  | "courses"
  | "booking"
  | "event"
  | "payment"
  | "lead"
  | "website"
  | "checkout"
  | "vip";

export type TemplateTier = "free" | "premium";

export type TemplateManifest = {
  name: string;
  type: TemplateType;
  tier: TemplateTier;
  price_paise: number;
  description: string;
  tags: string[];
  thumbnail_url: string;
  theme: Record<string, unknown>;
  content: Record<string, unknown>;
};

// ── Allowed top-level envelope keys ──────────────────────────────────────────

const ENVELOPE_KEYS = new Set<string>([
  "name",
  "type",
  "tier",
  "price_paise",
  "description",
  "tags",
  "thumbnail_url",
  "theme",
  "content",
]);

// ── Valid enum values ─────────────────────────────────────────────────────────

const VALID_TYPES = new Set<string>([
  "bio", "store", "product", "courses", "booking",
  "event", "payment", "lead", "website", "checkout", "vip",
]);

const VALID_TIERS = new Set<string>(["free", "premium"]);

// ── Content key allowlists (well-modeled types only) ─────────────────────────
//
// Derived by reading the top-level keys of each *Content type in lib/<type>.ts.
// REJECT unknown keys for these types; ACCEPT any non-empty object for the rest.
//
// website → lib/website.ts WebsiteContent
const WEBSITE_KEYS = new Set<string>([
  "site", "logo", "logoSize", "favicon", "theme", "themeToggle", "font", "pageWidth",
  "accent", "accentColor", "bg", "btshape",
  "anim", "btnAnim", "htitleGrad", "divider",
  "nav", "sticky", "cta", "ctaurl", "menu", "menuLinks",
  "pages",
  "heroLayout", "heroEyebrow", "heroRating", "heroBg", "heroTyping", "heroImgH", "heroVideo",
  "heroTitleSize", "heroTitleAlign",
  "himg", "htitle", "hsub", "hb1", "hb1url", "hb2", "hb2url",
  "seo",
  "order", "sections", "tint", "heads", "secStyle", "secPad", "secCols", "secBgImg",
  "feats", "spots", "banner", "mapAddr", "pricingYearly", "steps", "team", "logos",
  "countdown", "stepStyle", "cdStyle", "stats", "pricing", "tests", "faq", "gallery",
  "galH", "galAuto", "galStyle", "testStyle", "statsCount", "brands", "brandLogos",
  "video", "vidW", "contactStyle", "about", "ctaBand", "news",
  "email", "phone", "city", "announce", "whatsapp", "cookie", "backTop", "scrollProgress",
  "auth", "social", "legal",
  // Historical section-data aliases used in the worked example / older content blobs
  "features", "spotlight", "testimonials",
  // Premium finance / masterclass sections (added 2026-06-20)
  "ticker", "kpi", "gauges", "badge",
]);

// store → lib/store.ts StoreContent
const STORE_KEYS = new Set<string>([
  "store", "tagline", "logo",
  "accent", "accentColor", "btshape", "font", "theme", "pageWidth",
  "menu",
  "order", "sections", "heads",
  "banner", "brands", "brandLogos", "products", "featuredIdx",
  "display", "cols",
  "announce", "footerPay", "bottomNav",
  "legal",
]);

// bio → lib/bio.ts BioContent
const BIO_KEYS = new Set<string>([
  "cover_url", "profile_url", "name", "handle", "bio", "verified",
  "accent", "button_style", "button_shape", "bg", "font",
  "socials", "links", "featured",
]);

// courses → lib/course.ts CourseContent
const COURSES_KEYS = new Set<string>([
  "headline", "subheadline", "description_html", "thumbnail",
  "price", "compare_at_price", "currency",
  "theme", "accent", "font",
  "instructor_name", "instructor_bio", "instructor_avatar",
  "outcomes", "includes",
  "category",
  "cta_label",
  "seo_title", "seo_description", "og_image",
]);

// Map of type → allowlist (only for well-modeled types)
const CONTENT_KEY_ALLOWLISTS: Partial<Record<TemplateType, Set<string>>> = {
  website: WEBSITE_KEYS,
  store: STORE_KEYS,
  bio: BIO_KEYS,
  courses: COURSES_KEYS,
};

// ── validateManifest ──────────────────────────────────────────────────────────

/**
 * Validates a raw unknown value as a TemplateManifest.
 *
 * Rules (from TEMPLATE-AUTHORING-FORMAT.md §1):
 *  - Only documented envelope keys allowed at the top level.
 *  - name: 2–40 chars string.
 *  - type: one of the 11-value enum.
 *  - tier: "free" | "premium".
 *  - price_paise: integer >= 0; must be 0 when tier = "free".
 *  - description: string (may be empty; we accept it).
 *  - tags: string[]; each tag coerced to lowercase.
 *  - thumbnail_url: string (defaults to "").
 *  - theme: plain object.
 *  - content: non-empty plain object.
 */
export function validateManifest(
  input: unknown,
): { ok: true; manifest: TemplateManifest } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["Manifest must be a JSON object."] };
  }

  const obj = input as Record<string, unknown>;

  // Reject unknown top-level keys
  for (const key of Object.keys(obj)) {
    if (!ENVELOPE_KEYS.has(key)) {
      errors.push(`Unknown top-level key: "${key}". Only these keys are allowed: ${[...ENVELOPE_KEYS].join(", ")}.`);
    }
  }

  // name
  const name = obj["name"];
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 40) {
    errors.push("name must be a string between 2 and 40 characters.");
  }

  // type
  const type = obj["type"];
  if (typeof type !== "string" || !VALID_TYPES.has(type)) {
    errors.push(`type must be one of: ${[...VALID_TYPES].join(", ")}.`);
  }

  // tier
  const tier = obj["tier"];
  if (typeof tier !== "string" || !VALID_TIERS.has(tier)) {
    errors.push(`tier must be "free" or "premium".`);
  }

  // price_paise
  const pricePaise = obj["price_paise"];
  const priceNum = typeof pricePaise === "number" ? pricePaise : NaN;
  if (!Number.isInteger(priceNum) || priceNum < 0) {
    errors.push("price_paise must be a non-negative integer.");
  } else if (tier === "free" && priceNum !== 0) {
    errors.push('price_paise must be 0 when tier is "free".');
  }

  // description
  const description = obj["description"];
  if (typeof description !== "string") {
    errors.push("description must be a string.");
  }

  // tags
  const rawTags = obj["tags"];
  let tags: string[] = [];
  if (!Array.isArray(rawTags)) {
    errors.push("tags must be an array of strings.");
  } else {
    for (let i = 0; i < rawTags.length; i++) {
      if (typeof rawTags[i] !== "string") {
        errors.push(`tags[${i}] must be a string.`);
      } else {
        tags.push((rawTags[i] as string).toLowerCase());
      }
    }
  }

  // thumbnail_url
  const thumbnailUrl = obj["thumbnail_url"];
  if (thumbnailUrl !== undefined && typeof thumbnailUrl !== "string") {
    errors.push("thumbnail_url must be a string.");
  }

  // theme
  const theme = obj["theme"];
  if (
    theme !== undefined &&
    (typeof theme !== "object" || theme === null || Array.isArray(theme))
  ) {
    errors.push("theme must be a plain object.");
  }

  // content
  const content = obj["content"];
  if (
    content === null ||
    typeof content !== "object" ||
    Array.isArray(content)
  ) {
    errors.push("content must be a non-empty plain object.");
  } else if (Object.keys(content as object).length === 0) {
    errors.push("content must not be empty.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const manifest: TemplateManifest = {
    name: (name as string).trim(),
    type: type as TemplateType,
    tier: tier as TemplateTier,
    price_paise: priceNum,
    description: (description as string),
    tags,
    thumbnail_url: typeof thumbnailUrl === "string" ? thumbnailUrl : "",
    theme: (theme ?? {}) as Record<string, unknown>,
    content: content as Record<string, unknown>,
  };

  return { ok: true, manifest };
}

// ── validateContentForType ────────────────────────────────────────────────────

/**
 * Light structural check: for well-modeled types (website, store, bio, courses),
 * reject any content keys not in the known allowlist.
 * For all other types, just require content is a non-empty object.
 */
export function validateContentForType(
  type: string,
  content: unknown,
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (
    content === null ||
    typeof content !== "object" ||
    Array.isArray(content)
  ) {
    return { ok: false, errors: ["content must be a non-empty plain object."] };
  }

  const contentObj = content as Record<string, unknown>;

  if (Object.keys(contentObj).length === 0) {
    return { ok: false, errors: ["content must not be empty."] };
  }

  const allowlist = CONTENT_KEY_ALLOWLISTS[type as TemplateType];

  if (allowlist) {
    // Well-modeled type: reject unknown keys
    for (const key of Object.keys(contentObj)) {
      if (!allowlist.has(key)) {
        errors.push(
          `Unknown content key for type "${type}": "${key}". ` +
            `Check lib/${type === "courses" ? "course" : type}.ts for valid keys.`,
        );
      }
    }
  }
  // For less-modeled types (booking, event, payment, lead, vip, product, checkout),
  // any non-empty object is accepted — no key restriction.

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true };
}

// ── Re-export the known-keys allowlists (used by tests / Phase G) ─────────────

export const KNOWN_CONTENT_KEYS = {
  website: WEBSITE_KEYS,
  store: STORE_KEYS,
  bio: BIO_KEYS,
  courses: COURSES_KEYS,
} as const;
