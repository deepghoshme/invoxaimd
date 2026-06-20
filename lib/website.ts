// Website page model + design constants. No server-only imports → usable in the
// builder (client), the live preview, and the public renderer (server).
// Mirrors lib/bio.ts. One WebsiteContent JSONB blob lives on pages.content
// where page_type = "website" (the seller's homepage at the store root).

import { ACCENTS } from "@/lib/bio";
export { ACCENTS }; // reuse bio's gradient set (its first 8 match the design)

export type WSFeature = { ic: string; t: string; x: string };
export type WSStat = { n: string; l: string };
export type WSPlan = { n: string; p: string; py?: string; f: string; pop?: boolean; url?: string; btn?: string };
export type WSSpot = { img?: string; title: string; text: string };
export type WSTest = { n: string; r: string; q: string; img?: string };
export type WSFaq = { q: string; a: string };
export type WSLegalDoc = { on: boolean; title: string; text: string };

/**
 * A single item in the scrolling ticker bar (e.g. a stock/market data row).
 * `up` drives the colour: true = green, false = red, absent = neutral.
 */
export type WSTickerItem = { label: string; value: string; change?: string; up?: boolean };

/**
 * A single KPI / metric card shown in a horizontal row.
 * `suffix` is appended after the value (e.g. "L", "Cr", "%").
 */
export type WSKpiItem = { label: string; value: string; suffix?: string };

/**
 * A labeled progress-bar / gauge shown as a filled bar.
 * `percent` is 0–100.
 */
export type WSGaugeItem = { label: string; percent: number };

/**
 * A single authority / credential badge (e.g. "SEBI Reg No: INH000015871").
 * `icon` is an optional emoji or image-url shown beside the text.
 */
export type WSBadgeItem = { text: string; icon?: string };

export type WebsiteContent = {
  // brand
  site?: string;
  logo?: string;
  logoSize?: number; // logo height in px
  favicon?: string;
  theme?: "light" | "dark"; // public site color scheme
  themeToggle?: boolean; // show a visitor light/dark toggle in the nav
  font?: string; // heading font family (see FONTS)
  pageWidth?: string; // content container width (see WIDTHS)
  accent?: number;
  accentColor?: string; // custom brand color (hex) — overrides the accent preset
  bg?: string; // animated site background (see BGS)
  btshape?: "soft" | "pill" | "sq";
  // premium motion
  anim?: string; // section scroll-reveal style (see REVEALS)
  btnAnim?: string; // button animation (see BTN_ANIMS)
  htitleGrad?: boolean; // animated gradient hero headline
  divider?: string; // shape divider on colored sections (see DIVIDERS)
  // header
  nav?: "a" | "b" | "c" | "d";
  sticky?: boolean; // sticky header
  cta?: string;
  ctaurl?: string;
  menu?: { home?: { label?: string; on?: boolean }; about?: { label?: string; on?: boolean }; contact?: { label?: string; on?: boolean } };
  menuLinks?: { label: string; url: string }[]; // extra custom nav links
  // custom pages — each composes any sections, gets a real URL + menu entry,
  // its own intro block, and optional per-page section content overrides (`data`)
  pages?: { slug: string; label: string; inMenu?: boolean; order: string[]; intro?: { title?: string; sub?: string; text?: string; img?: string }; data?: Partial<WebsiteContent> }[];
  // hero
  heroLayout?: "right" | "left" | "center" | "none";
  heroEyebrow?: string; // small pill above the headline
  heroRating?: string; // star-rating / social-proof line
  heroBg?: boolean; // gradient-tinted hero background
  heroTyping?: string; // comma-separated rotating typewriter words
  heroImgH?: number; // hero image height (px)
  heroVideo?: string; // hero background video (mp4/webm url)
  heroTitleSize?: "sm" | "md" | "lg" | "xl"; // hero headline size override
  heroTitleAlign?: "left" | "center" | "right"; // hero headline text align
  himg?: string;
  htitle?: string;
  hsub?: string;
  hb1?: string;
  hb1url?: string;
  hb2?: string;
  hb2url?: string;
  // seo (per-page overrides; favicon comes from `favicon` above)
  seo?: { title?: string; description?: string; ogImage?: string };
  // section order + visibility
  order?: string[];
  sections?: Record<string, boolean>;
  tint?: boolean; // alternating section background tint
  heads?: Record<string, { title?: string; sub?: string }>; // editable section headings
  secStyle?: Record<string, string>; // per-section background: auto | plain | tint | grad | dark
  secPad?: Record<string, string>; // per-section vertical padding: sm | md | lg
  secCols?: Record<string, number>; // per-section column count (grid sections)
  secBgImg?: Record<string, string>; // per-section background image url
  // section content
  feats?: WSFeature[];
  spots?: WSSpot[];
  banner?: { text?: string; cta?: string; url?: string };
  mapAddr?: string;
  pricingYearly?: boolean; // show a monthly/yearly billing toggle
  steps?: { t: string; x: string }[];
  team?: { img?: string; name: string; role: string }[];
  logos?: string[];
  countdown?: { title?: string; sub?: string; date?: string };
  stepStyle?: string; // steps design (see STEP_STYLES)
  cdStyle?: string; // countdown design (see CD_STYLES)
  stats?: WSStat[];
  pricing?: WSPlan[];
  tests?: WSTest[];
  faq?: WSFaq[];
  gallery?: string[];
  galH?: number; // image-slider height (px)
  galAuto?: boolean; // auto-advance the image slider
  galStyle?: string; // gallery layout (slider | grid)
  /**
   * Testimonials layout.
   * - "grid"     → static responsive grid (default)
   * - "carousel" → horizontal scrolling carousel
   * - "marquee"  → auto-scrolling horizontal marquee strip
   */
  testStyle?: "grid" | "carousel" | "marquee";
  statsCount?: boolean; // animate stats counting up
  brands?: string;
  brandLogos?: string[]; // brand-slider logo images (else uses `brands` text)
  video?: { url: string; title: string };
  vidW?: number; // video max width (px)
  contactStyle?: string; // contact page layout (see CONTACT_STYLES)
  about?: { img?: string; title: string; text: string };
  ctaBand?: { title: string; sub: string; url?: string; btn?: string };
  news?: { title: string; sub: string; btn: string };
  // contact + add-ons
  email?: string;
  phone?: string;
  city?: string;
  announce?: { on: boolean; text: string; cta: string; url?: string };
  whatsapp?: { on: boolean; number: string; label?: string; link?: string; icon?: string };
  cookie?: { on: boolean };
  backTop?: boolean; // floating back-to-top button
  scrollProgress?: boolean; // reading progress bar at the top
  auth?: { on?: boolean; loginUrl?: string; signupUrl?: string; accountUrl?: string }; // nav login/signup
  social?: { ig?: string; yt?: string; x?: string; tg?: string };
  legal?: Record<string, WSLegalDoc>;

  // ── Premium finance / masterclass sections ──────────────────────────────────

  /**
   * Scrolling data ticker bar — renders as a horizontal marquee strip near the
   * top of the page (above or below the nav). Each item shows label + value +
   * optional percentage change with directional colour (up=green, down=red).
   * Example: { label:"NIFTY", value:"24,812.40", change:"+0.84%", up:true }
   */
  ticker?: WSTickerItem[];

  /**
   * KPI / metric cards — a horizontal row of headline numbers.
   * Rendered as a grid of cards, each showing `value` + optional `suffix` large
   * and `label` below. Typical: 3–6 cards in a row.
   * Example: { label:"Net Profit", value:"75", suffix:"L" }
   */
  kpi?: WSKpiItem[];

  /**
   * Labeled progress bars / gauges — a vertical list of bars.
   * Each bar fills to `percent` (0–100) with the label on the left and the
   * numeric value on the right. Great for strategy accuracy, win-rate metrics, etc.
   * Example: { label:"Boomerang Accuracy", percent:78 }
   */
  gauges?: WSGaugeItem[];

  /**
   * Authority / credential badge strip — a horizontal row of trust badges.
   * Each badge shows an optional `icon` (emoji or image URL) + `text`.
   * Renders inline, space-separated, typically near the hero or footer.
   * Example: { text:"SEBI Reg No: INH000015871", icon:"🏛️" }
   */
  badge?: WSBadgeItem[];
};

/** Animated, full-site background motions. */
export const BGS: [string, string][] = [
  ["none", "None"], ["aurora", "Aurora"], ["mesh", "Mesh"], ["blobs", "Blobs"],
  ["waves", "Waves"], ["dots", "Particles"], ["grid", "Grid glow"], ["rays", "Rays"], ["glow", "Spotlight"],
  // premium pack
  ["auroraflow", "Aurora Flow"], ["silk", "Silk Gradient"], ["meshblobs", "Mesh Blobs"],
  ["flowfield", "Flow Field"], ["starfield", "Starfield Dust"], ["shapes", "Floating Shapes"],
];

/** Section scroll-reveal animations (applied on the live published site). */
export const REVEALS: [string, string][] = [
  ["none", "None"], ["fade", "Fade in"], ["rise", "Rise up"], ["zoom", "Zoom in"], ["slide", "Slide in"],
];

/** Button animations. */
export const BTN_ANIMS: [string, string][] = [
  ["none", "None"], ["shine", "Shine"], ["pulse", "Pulse"], ["glow", "Glow"], ["lift", "Lift"],
];

/** Shape dividers on colored sections. */
export const DIVIDERS: [string, string][] = [
  ["none", "None"], ["slant", "Slant"], ["tilt", "Tilt"], ["round", "Rounded"],
];

/** Content container width presets → CSS `--ww` value. "full" ≈ edge-to-edge (26px gutters). */
export const WIDTHS: [string, string][] = [
  ["standard", "Standard"], ["wide", "Wide"], ["xwide", "Extra wide"], ["full", "Full width"],
];
export const WIDTH_PX: Record<string, number> = { standard: 1180, wide: 1400, xwide: 1600, full: 100000 };

/** Heading fonts (Sora + Inter are preloaded; the rest load on demand). */
export const FONTS: [string, string][] = [
  ["sora", "Sora"], ["poppins", "Poppins"], ["montserrat", "Montserrat"],
  ["playfair", "Playfair"], ["dmsans", "DM Sans"], ["space", "Space Grotesk"], ["inter", "Inter"],
];
export const FONT_FAMILY: Record<string, string> = {
  sora: "'Sora'", poppins: "'Poppins'", montserrat: "'Montserrat'",
  playfair: "'Playfair Display'", dmsans: "'DM Sans'", space: "'Space Grotesk'", inter: "'Inter'",
};
/** Google Fonts css2 family params for the ones not already loaded by the app. */
export const FONT_GOOGLE: Record<string, string> = {
  poppins: "Poppins:wght@500;600;700;800", montserrat: "Montserrat:wght@500;600;700;800",
  playfair: "Playfair+Display:wght@600;700;800", dmsans: "DM+Sans:wght@500;600;700",
  space: "Space+Grotesk:wght@500;600;700",
};

/** Per-section background styles. */
export const SEC_STYLES: [string, string][] = [
  ["auto", "Auto"], ["plain", "Plain"], ["tint", "Tint"], ["grad", "Gradient"], ["dark", "Dark"],
];

/** "How it works" layouts. */
export const STEP_STYLES: [string, string][] = [
  ["cards", "Cards"], ["numbers", "Big numbers"], ["timeline", "Timeline"],
  ["gradient", "Gradient cards"], ["connected", "Connected"], ["minimal", "Minimal"],
];

/** Countdown layouts. */
export const CD_STYLES: [string, string][] = [
  ["cards", "Cards"], ["solid", "Solid bar"], ["minimal", "Minimal"],
];

/** Gallery layouts. */
export const GAL_STYLES: [string, string][] = [["slider", "Slider"], ["grid", "Grid"]];
/** Testimonials layouts. */
export const TEST_STYLES: [string, string][] = [["grid", "Grid"], ["carousel", "Carousel"], ["marquee", "Marquee"]];

/** Contact page layouts. */
export const CONTACT_STYLES: [string, string][] = [
  ["split", "Split"], ["card", "Centered card"], ["stacked", "Stacked"], ["map", "With map band"],
];

/** Per-section vertical padding. */
export const PADS: [string, string][] = [["sm", "Compact"], ["md", "Default"], ["lg", "Spacious"]];

/** Available legal/policy documents (slug → default title). */
export const LEGAL_DOCS: [string, string][] = [
  ["privacy", "Privacy Policy"], ["terms", "Terms of Service"], ["refund", "Refund Policy"],
  ["shipping", "Shipping Policy"], ["disclaimer", "Disclaimer"], ["cookies", "Cookie Policy"],
];

/** Sections that render a grid → support a column-count override. */
export const GRID_SECTIONS = new Set(["features", "logos", "team", "testimonials", "pricing", "shop"]);

/** Header / menu layouts. */
export const NAVS: [NonNullable<WebsiteContent["nav"]>, string][] = [
  ["a", "Logo left"], ["b", "Centered"], ["c", "Menu center"], ["d", "Minimal"],
];

/** Button corner shapes. */
export const BTSHAPES: [NonNullable<WebsiteContent["btshape"]>, string][] = [
  ["soft", "Soft"], ["pill", "Pill"], ["sq", "Square"],
];

/** Hero image placement. */
export const HERO_LAYOUTS: [NonNullable<WebsiteContent["heroLayout"]>, string][] = [
  ["right", "Image right"], ["left", "Image left"], ["center", "Centered"], ["none", "No image"],
];

export const ICONS = ["🧘", "✨", "🎓", "💬", "📅", "🌿", "⭐", "🔥", "💎", "🎯", "📈", "❤️"];

/** Reorderable / toggleable homepage sections (key → label). */
export const SECTIONS: [string, string][] = [
  ["features", "Features"], ["steps", "How it works"], ["spotlight", "Image + text"], ["stats", "Stats / counters"],
  ["banner", "Banner strip"], ["logos", "Logos grid"], ["gallery", "Image slider"], ["brands", "Brand slider"],
  ["team", "Team"], ["pricing", "Pricing"], ["shop", "Products / Shop"], ["countdown", "Countdown"], ["video", "Video"], ["about", "About"],
  ["map", "Map"], ["testimonials", "Testimonials"], ["faq", "FAQ"], ["newsletter", "Newsletter"], ["cta", "CTA band"],
  // Premium finance / masterclass sections
  ["ticker", "Ticker bar"],
  ["badge", "Badge strip"],
  ["kpi", "KPI cards"],
  ["gauges", "Gauges / bars"],
];
export const LABELS: Record<string, string> = Object.fromEntries(SECTIONS);

const ORDER = [
  "features", "steps", "spotlight", "stats", "banner", "logos", "gallery", "brands",
  "team", "pricing", "shop", "countdown", "video", "about", "map",
  "testimonials", "faq", "newsletter", "cta",
  // Premium sections appended — renderer agent controls exact placement per template
  "ticker", "badge", "kpi", "gauges",
];

/** One-click design presets (applied over current content, keeps your text). */
export const TEMPLATES: { name: string; patch: Partial<WebsiteContent> }[] = [
  { name: "Sunset", patch: { accent: 0, bg: "aurora", btshape: "soft", nav: "a", heroLayout: "right" } },
  { name: "Minimal", patch: { accent: 7, bg: "none", btshape: "sq", nav: "d", heroLayout: "left" } },
  { name: "Bold", patch: { accent: 14, bg: "glow", btshape: "pill", nav: "c", heroLayout: "center" } },
  { name: "Ocean", patch: { accent: 5, bg: "aurora", btshape: "soft", nav: "b", heroLayout: "right" } },
  { name: "Forest", patch: { accent: 6, bg: "glow", btshape: "soft", nav: "a", heroLayout: "left" } },
  { name: "Berry", patch: { accent: 4, bg: "aurora", btshape: "pill", nav: "c", heroLayout: "center" } },
];

/** Starter content so a brand-new site previews full, not blank (like bio's seed). */
export const DEFAULT_WEBSITE: WebsiteContent = {
  site: "Your brand",
  logoSize: 28,
  theme: "light",
  themeToggle: false,
  font: "sora",
  pageWidth: "standard",
  accent: 0,
  bg: "aurora",
  btshape: "soft",
  anim: "rise",
  btnAnim: "shine",
  htitleGrad: true,
  divider: "none",
  nav: "a",
  sticky: true,
  cta: "Get started",
  ctaurl: "#",
  menu: { home: { label: "Home", on: true }, about: { label: "About", on: true }, contact: { label: "Contact", on: true } },
  menuLinks: [],
  pages: [],
  heroLayout: "right",
  heroEyebrow: "✨ New — now open for 2026",
  heroRating: "Rated 4.9/5 by 2,000+ happy members",
  heroBg: false,
  heroTyping: "",
  heroImgH: 280,
  heroVideo: "",
  htitle: "Build a calmer daily practice.",
  hsub: "Yoga, courses and tools to help you slow down — trusted by 10,000+ students.",
  hb1: "Start free",
  hb1url: "#",
  hb2: "Watch intro",
  hb2url: "",
  order: [...ORDER],
  sections: {
    // Core sections — on by default
    ...Object.fromEntries(ORDER.filter((k) => !["ticker", "badge", "kpi", "gauges"].includes(k)).map((k) => [k, true])),
    // Premium finance / masterclass sections — off by default so existing sites are unaffected
    ticker: false,
    badge: false,
    kpi: false,
    gauges: false,
  },
  tint: true,
  heads: {
    features: { title: "Everything you need", sub: "Built to help you start and stay consistent." },
    steps: { title: "How it works", sub: "Get started in three simple steps." },
    spotlight: { title: "Why choose us", sub: "" },
    shop: { title: "Shop our products", sub: "Browse and buy in a tap." },
    map: { title: "Find us", sub: "" },
    logos: { title: "Trusted by great teams", sub: "" },
    team: { title: "Meet the team", sub: "The people behind the work." },
    countdown: { title: "", sub: "" },
    gallery: { title: "Gallery", sub: "A look inside." },
    pricing: { title: "Simple pricing", sub: "Pick a plan that grows with you." },
    testimonials: { title: "Loved by customers", sub: "Real words from our community." },
    faq: { title: "Frequently asked", sub: "" },
    contact: { title: "Get in touch", sub: "We usually reply within a day." },
    // Premium finance / masterclass sections
    kpi: { title: "Performance at a glance", sub: "Real numbers. Real results." },
    gauges: { title: "Strategy accuracy", sub: "Backtested across 5 years of live market data." },
    badge: { title: "Credentials & registrations", sub: "" },
  },
  feats: [
    { ic: "🧘", t: "Live classes", x: "Daily guided sessions from anywhere." },
    { ic: "🎓", t: "Courses", x: "Learn at your own rhythm, lifetime access." },
    { ic: "💬", t: "Community", x: "Grow with thousands of members." },
  ],
  spots: [
    { title: "Designed around you", text: "Every detail is built to help you move forward without the overwhelm." },
    { title: "Results you can feel", text: "Thousands of members have transformed their routine — you’re next." },
  ],
  banner: { text: "🚀 Limited-time launch offer — save 30% today", cta: "Claim offer", url: "#" },
  mapAddr: "",
  pricingYearly: false,
  steps: [
    { t: "Create your account", x: "Sign up free in under a minute — no card needed." },
    { t: "Pick your plan", x: "Choose what fits and unlock everything instantly." },
    { t: "Start growing", x: "Launch, share and watch the results roll in." },
  ],
  team: [
    { name: "Aanya Sharma", role: "Founder & Coach" },
    { name: "Rohan Mehta", role: "Head of Programs" },
    { name: "Sara Khan", role: "Community Lead" },
  ],
  logos: [],
  countdown: { title: "Launch offer ends soon", sub: "Grab 30% off before the timer runs out.", date: "" },
  stepStyle: "cards",
  cdStyle: "cards",
  brandLogos: [],
  stats: [
    { n: "10,000+", l: "Students" }, { n: "4.9★", l: "Avg rating" },
    { n: "50+", l: "Courses" }, { n: "12", l: "Countries" },
  ],
  pricing: [
    { n: "Starter", p: "Free", py: "Free", f: "1 course,Community access,Weekly tips", pop: false },
    { n: "Pro", p: "₹499/mo", py: "₹4,990/yr", f: "All courses,Live sessions,Priority support,Certificates", pop: true },
    { n: "Studio", p: "₹999/mo", py: "₹9,990/yr", f: "Everything in Pro,1:1 coaching,Brand kit,Early access", pop: false },
  ],
  tests: [
    { n: "Riya", r: "Student", q: "Completely changed my mornings. So calming." },
    { n: "Arjun", r: "Member", q: "The courses are world-class and easy to follow." },
    { n: "Meera", r: "Student", q: "Best community I have joined. Highly recommend." },
  ],
  faq: [
    { q: "How do I get started?", a: "Sign up free, pick a course, and start your first session today." },
    { q: "Can I cancel anytime?", a: "Yes — manage your plan from your account, cancel in one click." },
    { q: "Do you offer refunds?", a: "We offer a 7-day money-back guarantee on all plans." },
  ],
  gallery: [],
  galH: 280,
  galAuto: true,
  galStyle: "slider",
  testStyle: "grid",
  statsCount: true,
  brands: "Forbes, YogaToday, Mindful, Wellness+, Bloom",
  video: { url: "", title: "See how it works" },
  vidW: 760,
  contactStyle: "split",
  about: {
    title: "Our story",
    text: "We started our studio to make mindful living simple. Today we help thousands build steady, joyful routines.",
  },
  ctaBand: { title: "Ready to begin?", sub: "Join today and get your first week free." },
  news: { title: "Join our newsletter", sub: "Weekly tips, new drops and offers — no spam.", btn: "Subscribe" },
  email: "hello@yourbrand.com",
  phone: "+91 90000 00000",
  city: "Mumbai, India",
  seo: {},
  announce: { on: true, text: "🎉 New course is live — 30% off this week only!", cta: "Shop now" },
  whatsapp: { on: false, number: "+919000000000", label: "", link: "", icon: "💬" },
  cookie: { on: true },
  backTop: true,
  scrollProgress: false,
  auth: { on: false, loginUrl: "", signupUrl: "", accountUrl: "" },
  social: { ig: "", yt: "", x: "", tg: "" },
  legal: {
    privacy: { on: true, title: "Privacy Policy", text: "We respect your privacy. This policy explains what data we collect, how we use it, and your rights.\nWe never sell your personal data. You can request deletion at any time by contacting us." },
    terms: { on: true, title: "Terms of Service", text: "By using this site you agree to these terms.\nAll content is owned by us. Misuse may result in suspension of access." },
    refund: { on: true, title: "Refund Policy", text: "We offer a 7-day money-back guarantee on all purchases.\nTo request a refund, email us within 7 days of your purchase." },
    shipping: { on: false, title: "Shipping Policy", text: "Orders are processed within 1–2 business days.\nDelivery timelines and charges are shown at checkout." },
    disclaimer: { on: false, title: "Disclaimer", text: "All information on this site is for general purposes only.\nResults may vary; nothing here is professional advice." },
    cookies: { on: false, title: "Cookie Policy", text: "We use cookies to improve your experience and analyse traffic.\nYou can control cookies through your browser settings." },
  },

  // ── Premium finance / masterclass sample data (sections default OFF) ─────────

  ticker: [
    { label: "NIFTY 50", value: "24,812.40", change: "+0.84%", up: true },
    { label: "SENSEX", value: "81,632.15", change: "+0.76%", up: true },
    { label: "BANKNIFTY", value: "53,204.80", change: "-0.32%", up: false },
    { label: "RELIANCE", value: "2,948.55", change: "+1.12%", up: true },
    { label: "TCS", value: "4,102.30", change: "+0.45%", up: true },
    { label: "INFY", value: "1,873.65", change: "-0.18%", up: false },
  ],

  kpi: [
    { label: "Net Profit", value: "75", suffix: "L" },
    { label: "Win Rate", value: "82", suffix: "%" },
    { label: "Avg Monthly Return", value: "12", suffix: "%" },
    { label: "Members Trained", value: "3,400", suffix: "+" },
  ],

  gauges: [
    { label: "Boomerang Strategy Accuracy", percent: 82 },
    { label: "Gap-Up Open Play", percent: 74 },
    { label: "Option Selling Precision", percent: 78 },
  ],

  badge: [
    { text: "SEBI Reg No: INH000015871", icon: "🏛️" },
    { text: "NSE Certified", icon: "📜" },
    { text: "10+ Years Market Experience", icon: "📈" },
    { text: "ISO 9001:2015 Certified", icon: "✅" },
  ],
};
