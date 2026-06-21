/**
 * lib/builder/backgrounds.ts
 * InvoxAI Page Builder v6 — section & page background tokens.
 * Returns inline styles (theme-var driven) so the render engine stays
 * self-contained and works in SSR, editor preview and the public route.
 * Do NOT import from any existing studio/route/db module.
 */
import type { CSSProperties } from 'react';
import type { PageDoc, SectionBg } from './types';

export type PageBg = PageDoc['pageBg'];

export interface BgOption<T extends string> {
  id: T;
  label: string;
}

/** Section background choices (per-section dropdown in the inspector). */
export const SECTION_BGS: BgOption<SectionBg>[] = [
  { id: 'plain', label: 'Plain' },
  { id: 'transparent', label: 'Transparent' },
  { id: 'glass', label: 'Glass' },
  { id: 'glassd', label: 'Glass (dark)' },
  { id: 'tintP', label: 'Brand tint' },
  { id: 'tintC', label: 'Accent tint' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'dots', label: 'Dots' },
  { id: 'hex', label: 'Hex grid' },
  { id: 'dark', label: 'Dark' },
  { id: 'beam', label: 'Beam' },
  { id: 'orbs', label: 'Orbs' },
  { id: 'mesh', label: 'Mesh' },
];

/** Page background choices (full-page backdrop layer behind all sections). */
export const PAGE_BGS: BgOption<PageBg>[] = [
  { id: 'none', label: 'None' },
  { id: 'orbs', label: 'Orbs' },
  { id: 'grid', label: 'Grid' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'mesh', label: 'Mesh' },
  { id: 'dots', label: 'Dots' },
];

const DOT_GRID =
  'radial-gradient(rgba(124,58,237,.18) 1px, transparent 1px)';
const HEX_LINES =
  'repeating-linear-gradient(60deg, rgba(124,58,237,.08) 0 1px, transparent 1px 22px), repeating-linear-gradient(-60deg, rgba(124,58,237,.08) 0 1px, transparent 1px 22px)';

/** Inline style for a section's background token (uses theme vars). */
export function sectionBgStyle(bg: SectionBg): CSSProperties {
  switch (bg) {
    case 'transparent':
      return { background: 'transparent' };
    case 'glass':
      return {
        background: 'rgba(255,255,255,.6)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      };
    case 'glassd':
      return {
        background: 'rgba(17,17,27,.5)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        color: '#fff',
      };
    case 'tintP':
      return { background: 'color-mix(in srgb, var(--bx-brand) 9%, transparent)' };
    case 'tintC':
      return { background: 'color-mix(in srgb, var(--bx-acc) 10%, transparent)' };
    case 'aurora':
      return {
        background:
          'radial-gradient(60% 80% at 20% 0%, color-mix(in srgb, var(--bx-brand) 24%, transparent), transparent), radial-gradient(50% 70% at 90% 20%, color-mix(in srgb, var(--bx-acc) 22%, transparent), transparent)',
      };
    case 'dots':
      return { backgroundImage: DOT_GRID, backgroundSize: '22px 22px' };
    case 'hex':
      return { backgroundImage: HEX_LINES };
    case 'dark':
      return { background: '#0b0b14', color: '#fff' };
    case 'beam':
      return {
        background:
          'linear-gradient(180deg, transparent, color-mix(in srgb, var(--bx-brand) 8%, transparent)), conic-gradient(from 90deg at 50% -10%, transparent, color-mix(in srgb, var(--bx-brand) 18%, transparent), transparent)',
      };
    case 'orbs':
      return {
        background:
          'radial-gradient(40% 50% at 15% 30%, color-mix(in srgb, var(--bx-b2) 26%, transparent), transparent), radial-gradient(35% 45% at 85% 70%, color-mix(in srgb, var(--bx-acc) 22%, transparent), transparent)',
      };
    case 'mesh':
      return {
        background:
          'radial-gradient(at 0% 0%, color-mix(in srgb, var(--bx-brand) 22%, transparent), transparent 50%), radial-gradient(at 100% 0%, color-mix(in srgb, var(--bx-acc) 22%, transparent), transparent 50%), radial-gradient(at 50% 100%, color-mix(in srgb, var(--bx-b2) 22%, transparent), transparent 50%)',
      };
    case 'plain':
    default:
      return { background: '#fff' };
  }
}

/** Inline style for the full-page backdrop layer (fixed, behind sections). */
export function pageBgStyle(bg: PageBg): CSSProperties {
  switch (bg) {
    case 'orbs':
      return {
        background:
          'radial-gradient(45% 45% at 12% 18%, color-mix(in srgb, var(--bx-brand) 18%, transparent), transparent), radial-gradient(40% 40% at 88% 82%, color-mix(in srgb, var(--bx-acc) 16%, transparent), transparent)',
      };
    case 'grid':
      return {
        backgroundImage:
          'linear-gradient(rgba(124,58,237,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,.07) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      };
    case 'aurora':
      return {
        background:
          'radial-gradient(60% 70% at 30% 0%, color-mix(in srgb, var(--bx-brand) 16%, transparent), transparent), radial-gradient(50% 60% at 80% 30%, color-mix(in srgb, var(--bx-acc) 14%, transparent), transparent)',
      };
    case 'mesh':
      return {
        background:
          'radial-gradient(at 0% 0%, color-mix(in srgb, var(--bx-brand) 16%, transparent), transparent 55%), radial-gradient(at 100% 0%, color-mix(in srgb, var(--bx-acc) 16%, transparent), transparent 55%), radial-gradient(at 50% 100%, color-mix(in srgb, var(--bx-b2) 16%, transparent), transparent 55%)',
      };
    case 'dots':
      return { backgroundImage: DOT_GRID, backgroundSize: '26px 26px' };
    case 'none':
    default:
      return {};
  }
}
