// Bio page model + design constants. No server-only imports → usable in the
// builder (client), the live preview, and the public renderer (server).

export type BioLink = { ic: string; t: string; u: string; img?: string; type?: "link" | "header"; highlight?: boolean };
export type BioFeatured = { image_url?: string; title?: string; real?: string; off?: string; cta?: string; url?: string };

export type BioContent = {
  cover_url?: string;
  profile_url?: string;
  name?: string;
  handle?: string;
  bio?: string;
  verified?: boolean;
  accent?: number;
  button_style?: "soft" | "grad" | "outline" | "glass";
  button_shape?: "rounded" | "pill" | "square";
  bg?: string;
  socials?: { platform?: string; label?: string; url?: string }[];
  links?: BioLink[];
  featured?: BioFeatured;
};

export const SHAPES: [NonNullable<BioContent["button_shape"]>, string][] = [
  ["rounded", "Rounded"], ["pill", "Pill"], ["square", "Square"],
];

/** [name, gradient] — many themes. */
export const ACCENTS: [string, string][] = [
  ["Sunset", "linear-gradient(135deg,#FFB23E,#FF6A3D 40%,#FF4D7D 72%,#7B3FE4)"],
  ["Coral", "linear-gradient(135deg,#FF9A5A,#FF5E7E)"],
  ["Violet", "linear-gradient(135deg,#7B3FE4,#A06BFF)"],
  ["Gold", "linear-gradient(135deg,#FFC773,#FF8A3D)"],
  ["Berry", "linear-gradient(135deg,#FF4D7D,#B23FD6)"],
  ["Ocean", "linear-gradient(135deg,#3FA9F5,#5E7CE2)"],
  ["Forest", "linear-gradient(135deg,#36C28B,#1F9E73)"],
  ["Mono", "linear-gradient(135deg,#4a3f54,#7a6b82)"],
  ["Peach", "linear-gradient(135deg,#FFD3A5,#FD6585)"],
  ["Mint", "linear-gradient(135deg,#43E97B,#38F9D7)"],
  ["Sky", "linear-gradient(135deg,#48C6EF,#6F86D6)"],
  ["Rose", "linear-gradient(135deg,#F857A6,#FF5858)"],
  ["Aqua", "linear-gradient(135deg,#13547A,#80D0C7)"],
  ["Ember", "linear-gradient(135deg,#F12711,#F5AF19)"],
  ["Grape", "linear-gradient(135deg,#8E2DE2,#4A00E0)"],
  ["Night", "linear-gradient(135deg,#232526,#414345)"],
];

export const STYLES: [BioContent["button_style"], string][] = [
  ["soft", "Soft"], ["grad", "Gradient"], ["outline", "Outline"], ["glass", "Glass"],
];

export const BGS: [string, string][] = [
  ["none", "None"], ["aurora", "Aurora"], ["blobs", "Blobs"], ["glow", "Glow"],
  ["gradient", "Gradient flow"], ["bubbles", "Bubbles"], ["rays", "Rays"], ["stars", "Stars"],
];

export const ICONS = ["🔗", "🎓", "📓", "🛍️", "📅", "👑", "📸", "▶️", "✉️", "📞", "💬", "🎁", "🎟️", "🎵", "📝", "💼", "🌐", "⭐", "🔥", "💎"];

/** Quick-start presets (accent index, style, bg). */
export const TEMPLATES: { name: string; accent: number; style: BioContent["button_style"]; bg: string }[] = [
  { name: "Sunset", accent: 0, style: "soft", bg: "aurora" },
  { name: "Neon", accent: 14, style: "grad", bg: "glow" },
  { name: "Glass", accent: 5, style: "glass", bg: "blobs" },
  { name: "Mono", accent: 7, style: "outline", bg: "none" },
  { name: "Mint", accent: 9, style: "soft", bg: "bubbles" },
  { name: "Ember", accent: 13, style: "grad", bg: "rays" },
];

export const DEFAULT_BIO: BioContent = {
  accent: 0,
  button_style: "soft",
  bg: "aurora",
  socials: [],
  links: [],
  featured: {},
};
