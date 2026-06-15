// Shared bio-page theme + content model. No server-only imports → usable in both
// the public renderer (server) and the editor live preview (client).

export type SocialLink = { platform: string; url: string };
export type BioLink = { label: string; url: string; icon_url?: string };
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
  bio?: string;
  links?: BioLink[];
  socials?: SocialLink[];
  theme?: string;
  background?: BioBackground;
  animation?: "none" | "fade" | "rise" | "pop";
  button_style?: "rounded" | "pill" | "outline";
};

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
