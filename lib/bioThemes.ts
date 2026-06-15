// Shared bio-page theme + content model. No server-only imports → usable in both
// the public renderer (server) and the editor live preview (client).

export type SocialLink = { platform: string; url: string };
export type BioLink = { label: string; url: string; icon_url?: string; highlight?: boolean };
export type BioBackground = {
  type: "theme" | "solid" | "gradient" | "image";
  color?: string;
  color2?: string;
  image_url?: string;
};
export type BioContent = {
  display_name?: string;
  headline?: string;
  avatar_url?: string;
  cover_url?: string;
  bio?: string;
  links?: BioLink[];
  socials?: SocialLink[];
  theme?: string;
  background?: BioBackground;
  bg_motion?: "none" | "gradient" | "blobs" | "aurora" | "bubbles" | "glow" | "rays" | "waves" | "stars" | "mesh";
  animation?: "none" | "fade" | "rise" | "pop";
  button_style?: "rounded" | "pill" | "outline";
  icon_position?: "left" | "center" | "right";
  highlight_color?: string;
  stripe_color?: string;
  highlight_size?: "s" | "m" | "l";
  highlight_text_size?: "s" | "m" | "l";
};

export const SIZE_OPTS = [
  { id: "s", name: "Small" },
  { id: "m", name: "Medium" },
  { id: "l", name: "Large" },
] as const;

export const BG_MOTIONS = [
  { id: "none", name: "None" },
  { id: "gradient", name: "Gradient flow" },
  { id: "blobs", name: "Floating blobs" },
  { id: "aurora", name: "Aurora" },
  { id: "bubbles", name: "Rising bubbles" },
  { id: "glow", name: "Pulsing glow" },
  { id: "rays", name: "Rotating rays" },
  { id: "waves", name: "Waves" },
  { id: "stars", name: "Twinkling stars" },
  { id: "mesh", name: "Mesh gradient" },
] as const;

export type BioTheme = {
  id: string;
  name: string;
  bg: string;
  card: string;
  cardBorder: string;
  text: string;
  muted: string;
  primary: string;
  primaryText: string;
};

export const BIO_THEMES: BioTheme[] = [
  {
    id: "sunset",
    name: "Sunset",
    bg: "#FFF9F4",
    card: "#FFFFFF",
    cardBorder: "#F0E1D6",
    text: "#2B1B2E",
    muted: "#7A6770",
    primary: "#FF6A3D",
    primaryText: "#FFFFFF",
  },
  {
    id: "twilight",
    name: "Twilight",
    bg: "#16101F",
    card: "#221833",
    cardBorder: "#34264A",
    text: "#F6EEF2",
    muted: "#B9A8BC",
    primary: "#FF7E55",
    primaryText: "#1a0f14",
  },
  {
    id: "ocean",
    name: "Ocean",
    bg: "#F2F8FC",
    card: "#FFFFFF",
    cardBorder: "#D8E8F2",
    text: "#0C2A3A",
    muted: "#5B7488",
    primary: "#1E88C7",
    primaryText: "#FFFFFF",
  },
  {
    id: "forest",
    name: "Forest",
    bg: "#F3F8F2",
    card: "#FFFFFF",
    cardBorder: "#D7E8D4",
    text: "#16291A",
    muted: "#5D7560",
    primary: "#2E9E6B",
    primaryText: "#FFFFFF",
  },
  {
    id: "candy",
    name: "Candy",
    bg: "#FFF4FA",
    card: "#FFFFFF",
    cardBorder: "#F6DCEC",
    text: "#3A1230",
    muted: "#8C6A82",
    primary: "#FF4D9D",
    primaryText: "#FFFFFF",
  },
  {
    id: "mono",
    name: "Mono",
    bg: "#FAFAFA",
    card: "#FFFFFF",
    cardBorder: "#E6E6E6",
    text: "#111111",
    muted: "#777777",
    primary: "#111111",
    primaryText: "#FFFFFF",
  },
  {
    id: "midnight",
    name: "Midnight",
    bg: "#0B1220",
    card: "#131C2E",
    cardBorder: "#26344C",
    text: "#EAF0FA",
    muted: "#9DAAC2",
    primary: "#5B8DEF",
    primaryText: "#FFFFFF",
  },
  {
    id: "noir",
    name: "Noir",
    bg: "#0A0A0A",
    card: "#171717",
    cardBorder: "#2A2A2A",
    text: "#F5F5F5",
    muted: "#9A9A9A",
    primary: "#E5B567",
    primaryText: "#1a1400",
  },
  {
    id: "royal",
    name: "Royal",
    bg: "#F6F3FF",
    card: "#FFFFFF",
    cardBorder: "#E4DAF7",
    text: "#241046",
    muted: "#6E5C90",
    primary: "#7B3FE4",
    primaryText: "#FFFFFF",
  },
  {
    id: "mint",
    name: "Mint",
    bg: "#F0FBF7",
    card: "#FFFFFF",
    cardBorder: "#D2EFE4",
    text: "#0E2E25",
    muted: "#5A7E73",
    primary: "#10B981",
    primaryText: "#FFFFFF",
  },
  {
    id: "rose",
    name: "Rose Gold",
    bg: "#FFF5F1",
    card: "#FFFFFF",
    cardBorder: "#F4DDD3",
    text: "#3A1E1A",
    muted: "#8C6A60",
    primary: "#E08160",
    primaryText: "#FFFFFF",
  },
  {
    id: "slate",
    name: "Slate",
    bg: "#0F141B",
    card: "#1A222D",
    cardBorder: "#2C3947",
    text: "#E8EEF5",
    muted: "#9CABBC",
    primary: "#38BDF8",
    primaryText: "#06222F",
  },
  {
    id: "cyber",
    name: "Cyber",
    bg: "#0B0B1A",
    card: "#15152E",
    cardBorder: "#2A2A53",
    text: "#EDEBFF",
    muted: "#9D9BC9",
    primary: "#00E5C0",
    primaryText: "#04241F",
  },
  {
    id: "sand",
    name: "Sand",
    bg: "#FAF6EF",
    card: "#FFFFFF",
    cardBorder: "#ECE2D2",
    text: "#3A3024",
    muted: "#857a68",
    primary: "#C99A4B",
    primaryText: "#2A2114",
  },
];

export const DEFAULT_THEME = "sunset";

export function getBioTheme(id?: string): BioTheme {
  return BIO_THEMES.find((t) => t.id === id) ?? BIO_THEMES[0];
}

/** Resolve the page background CSS from content + theme. */
export function backgroundCss(content: BioContent, theme: BioTheme): string {
  const bg = content.background;
  if (!bg || bg.type === "theme") return theme.bg;
  if (bg.type === "solid") return bg.color || theme.bg;
  if (bg.type === "gradient")
    return `linear-gradient(135deg, ${bg.color || theme.primary}, ${bg.color2 || theme.bg})`;
  if (bg.type === "image" && bg.image_url)
    return `center/cover no-repeat url(${bg.image_url})`;
  return theme.bg;
}

export const BUTTON_RADIUS: Record<string, string> = {
  rounded: "14px",
  pill: "999px",
  outline: "14px",
};

export const ANIMATIONS = [
  { id: "none", name: "None" },
  { id: "fade", name: "Fade in" },
  { id: "rise", name: "Rise up" },
  { id: "pop", name: "Pop" },
] as const;
