/**
 * lib/builder/types.ts
 * InvoxAI Page Builder v6 — foundation types
 * Used by editor, renderer, validator.
 * DO NOT import from any existing studio/route/db module.
 */

// ---------------------------------------------------------------------------
// Primitive control types
// ---------------------------------------------------------------------------

export type SectionBg =
  | 'plain'
  | 'transparent'
  | 'glass'
  | 'glassd'
  | 'tintP'
  | 'tintC'
  | 'aurora'
  | 'dots'
  | 'hex'
  | 'dark'
  | 'beam'
  | 'orbs'
  | 'mesh';

export type SectionAnim = '' | 'up' | 'zoom' | 'float' | 'fade';

export type BtnStyle = 'gradient' | 'solid' | 'outline' | 'metal' | 'glow';

export type BtnColor = '' | 'accent' | 'dark' | 'white' | 'success';

export type SizeScale = 'sm' | 'md' | 'lg';

export type AlignX = '' | 'left' | 'center' | 'right';

export type TextColor = '' | 'dark' | 'light';

// ---------------------------------------------------------------------------
// Block types (all registered blocks)
// ---------------------------------------------------------------------------

export type BlockType =
  // Structure
  | 'navbar'
  | 'footer'
  // Headers
  | 'badgebar'
  | 'hero'
  | 'flip3d'
  | 'webinfo'
  // Social proof
  | 'logos'
  | 'marquee'
  | 'proof'
  | 'testimonials'
  // Content
  | 'features'
  | 'bento'
  | 'tabs'
  | 'orbital'
  | 'alist'
  | 'stats'
  | 'steps'
  | 'video'
  | 'faq'
  | 'counters'
  // Layout
  | 'grid'
  | 'media'
  | 'gallery'
  // Commerce
  | 'pricing'
  | 'payment'
  // Capture
  | 'countdown'
  | 'banner'
  | 'lead'
  | 'popup';

// ---------------------------------------------------------------------------
// Page types
// ---------------------------------------------------------------------------

export type PageType =
  | 'landing'
  | 'vip'
  | 'lead'
  | 'event'
  | 'booking'
  | 'courses'
  | 'opp'
  | 'website';

// ---------------------------------------------------------------------------
// Section — one block on a page
// ---------------------------------------------------------------------------

export interface Section {
  /** Stable unique id (nanoid / uuid) */
  id: string;
  type: BlockType;
  /** Variant name from BlockRegistry[type].variants[] */
  variant: string;
  bg: SectionBg;
  size: SizeScale;
  align: AlignX;
  anim: SectionAnim;
  btn: BtnStyle;
  btnSize: SizeScale;
  btnColor: BtnColor;
  textColor: TextColor;
  mobileHidden: boolean;
  /** Block-specific data; shape defined by BlockRegistry[type].fields */
  props: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

export interface ThemeTokens {
  /** Theme id (slug) */
  id: string;
  name: string;
  /** Primary brand colour hex */
  brand: string;
  /** Secondary brand colour hex */
  b2: string;
  /** Accent / cyan hex */
  acc: string;
}

// ---------------------------------------------------------------------------
// Page document (stored in pages.content as JSON with v=6)
// ---------------------------------------------------------------------------

/** Optional sticky mobile call-to-action bar (shown only on phones). */
export interface MobileCta {
  enabled: boolean;
  label: string;
  url: string;
}

export interface PageDoc {
  /** Matches pages.id */
  id: string;
  ownerId: string;
  type: PageType;
  slug: string;
  title: string;
  themeId: string;
  pageBg: 'none' | 'orbs' | 'grid' | 'aurora' | 'mesh' | 'dots';
  sections: Section[];
  /** Sticky bottom CTA on mobile (optional). */
  mobileCta?: MobileCta;
  status: 'draft' | 'published';
  updatedAt: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

/**
 * A template block tuple: [blockType, variant?, partialProps?]
 */
export type TemplateTuple = [BlockType, string?, Partial<Section['props']>?];

export interface Template {
  id: string;
  name: string;
  category: string;
  /** Which v6 page type this template targets. */
  type?: PageType;
  /** One-line description for the gallery. */
  description?: string;
  themeId: string;
  /** Page background applied with the template. */
  pageBg?: PageDoc['pageBg'];
  tag: 'Free' | 'Pro';
  blocks: TemplateTuple[];
}

// ---------------------------------------------------------------------------
// Block registry — schema-driven fields, defaults and metadata per block
// ---------------------------------------------------------------------------

export type BlockCategory =
  | 'structure'
  | 'header'
  | 'social'
  | 'content'
  | 'layout'
  | 'commerce'
  | 'capture';

/** Supported inspector field controls. */
export type FieldKind =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'number'
  | 'toggle'
  | 'select'
  | 'color'
  | 'image'
  | 'url'
  | 'icon'
  | 'repeater';

export interface FieldOption {
  value: string;
  label: string;
}

/** One inspector control bound to a key inside Section.props. */
export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  help?: string;
  /** select */
  options?: FieldOption[];
  /** number */
  min?: number;
  max?: number;
  step?: number;
  /** repeater: schema of each row + add-button label + default row count */
  itemFields?: FieldDef[];
  itemLabel?: string;
  /** default value when a block is created */
  default?: unknown;
}

/** Section-level control overrides a block may set on creation. */
export type SectionControls = Partial<
  Pick<
    Section,
    | 'bg'
    | 'size'
    | 'align'
    | 'anim'
    | 'btn'
    | 'btnSize'
    | 'btnColor'
    | 'textColor'
    | 'mobileHidden'
  >
>;

export interface BlockDef {
  type: BlockType;
  label: string;
  category: BlockCategory;
  /** Short glyph/emoji for the section-library popup. */
  icon: string;
  /** Layout variants selectable in the inspector. */
  variants: string[];
  /** Inspector fields driving Section.props. */
  fields: FieldDef[];
  /** Default Section.props for a freshly added block. */
  defaults: Record<string, unknown>;
  /** Optional section-control overrides for a freshly added block. */
  sectionDefaults?: SectionControls;
}

export type BlockRegistry = Record<BlockType, BlockDef>;
