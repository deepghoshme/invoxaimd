/**
 * lib/builder/themes.ts
 * InvoxAI Page Builder v6 — theme palette (13 themes).
 * Each theme re-tints the page root via CSS custom properties.
 * Default: `violet` (brand #7C3AED / #A855F7 / #06B6D4) — locked by the v6 plan.
 * Self-contained: do NOT import from any existing studio/route/db module.
 */
import type { CSSProperties } from 'react';
import type { ThemeTokens } from './types';

export const DEFAULT_THEME_ID = 'violet';

/** The 13 seed themes. `brand` = primary, `b2` = secondary, `acc` = accent/cyan. */
export const THEMES: ThemeTokens[] = [
  { id: 'violet', name: 'Violet', brand: '#7C3AED', b2: '#A855F7', acc: '#06B6D4' },
  { id: 'ocean', name: 'Ocean', brand: '#2563EB', b2: '#3B82F6', acc: '#06B6D4' },
  { id: 'emerald', name: 'Emerald', brand: '#059669', b2: '#10B981', acc: '#84CC16' },
  { id: 'sunset', name: 'Sunset', brand: '#F97316', b2: '#FB923C', acc: '#EF4444' },
  { id: 'rose', name: 'Rose', brand: '#E11D48', b2: '#F43F5E', acc: '#FB7185' },
  { id: 'midnight', name: 'Midnight', brand: '#1E293B', b2: '#334155', acc: '#38BDF8' },
  { id: 'gold', name: 'Gold', brand: '#D97706', b2: '#F59E0B', acc: '#FCD34D' },
  { id: 'teal', name: 'Teal', brand: '#0D9488', b2: '#14B8A6', acc: '#2DD4BF' },
  { id: 'crimson', name: 'Crimson', brand: '#DC2626', b2: '#EF4444', acc: '#F87171' },
  { id: 'indigo', name: 'Indigo', brand: '#4F46E5', b2: '#6366F1', acc: '#818CF8' },
  { id: 'forest', name: 'Forest', brand: '#166534', b2: '#16A34A', acc: '#4ADE80' },
  { id: 'slate', name: 'Slate', brand: '#475569', b2: '#64748B', acc: '#94A3B8' },
  { id: 'magenta', name: 'Magenta', brand: '#C026D3', b2: '#D946EF', acc: '#F0ABFC' },
];

const THEME_MAP: Record<string, ThemeTokens> = Object.fromEntries(
  THEMES.map((t) => [t.id, t]),
);

/** Look up a theme by id, falling back to the default (`violet`). */
export function getTheme(id?: string | null): ThemeTokens {
  return (id && THEME_MAP[id]) || THEME_MAP[DEFAULT_THEME_ID];
}

/**
 * CSS custom properties for a theme, applied on the page/preview root.
 * Consumed throughout the render engine as `var(--bx-brand)` etc.
 */
export function themeVars(theme: ThemeTokens): CSSProperties {
  const grad = `linear-gradient(135deg, ${theme.brand} 0%, ${theme.b2} 60%, ${theme.acc} 120%)`;
  return {
    ['--bx-brand' as string]: theme.brand,
    ['--bx-b2' as string]: theme.b2,
    ['--bx-acc' as string]: theme.acc,
    ['--bx-grad' as string]: grad,
    ['--bx-font-display' as string]: '"Space Grotesk", system-ui, sans-serif',
    ['--bx-font-body' as string]: 'Inter, system-ui, sans-serif',
  };
}
