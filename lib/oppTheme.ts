// Resolve a one-page product (opp) `theme` into concrete CSS values that the
// Landing + Catalog (PDP) templates apply. Keeps the editor and both renderers
// in sync. ACCENTS entries are gradients, so we derive a solid colour too.

import { ACCENTS, FONT_FAMILY, WIDTH_PX, FONT_GOOGLE } from "@/lib/website";
import type { OppContent } from "@/lib/products";

const DEFAULT_GRAD = "linear-gradient(135deg,#FFB23E,#FF6A3D 40%,#FF4D7D 72%,#7B3FE4)";

export type ResolvedTheme = {
  solid: string;       // single accent colour (borders, text, highlights)
  gradient: string;    // accent gradient (buttons, panels)
  fontFam: string;     // heading font-family, or "" to keep default
  dark: boolean;
  btshape: "soft" | "pill" | "sq";
  bg: string;          // landing background key
  widthPx: number | null;
  googleHref: string;  // Google Fonts stylesheet URL (empty if font is preloaded)
};

export function resolveOppTheme(theme?: OppContent["theme"]): ResolvedTheme {
  const t = theme ?? {};
  const presetGrad = t.accent != null ? ACCENTS[t.accent]?.[1] : undefined;
  let gradient: string;
  let solid: string;
  if (t.color) {
    solid = t.color;
    gradient = `linear-gradient(135deg, ${t.color}, color-mix(in srgb, ${t.color} 66%, #000))`;
  } else if (presetGrad) {
    gradient = presetGrad;
    solid = (presetGrad.match(/#[0-9a-fA-F]{3,8}/) ?? ["#FF6A3D"])[0];
  } else {
    gradient = DEFAULT_GRAD;
    solid = "#FF6A3D";
  }
  const g = t.font ? FONT_GOOGLE[t.font] : undefined;
  return {
    solid,
    gradient,
    fontFam: t.font ? (FONT_FAMILY[t.font] ?? "") : "",
    dark: t.mode === "dark",
    btshape: t.btshape ?? "soft",
    bg: t.bg ?? "aurora",
    widthPx: t.width ? (WIDTH_PX[t.width] ?? null) : null,
    googleHref: g ? `https://fonts.googleapis.com/css2?family=${g}&display=swap` : "",
  };
}
