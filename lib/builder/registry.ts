/**
 * lib/builder/registry.ts
 * InvoxAI Page Builder v6 — block registry.
 * Single source of truth for every block: category, variants, inspector
 * fields and default props. The editor builds its inspector from `fields`,
 * the render engine reads `Section.props`, the validator checks against `fields`.
 * Self-contained: do NOT import from any existing studio/route/db module.
 *
 * NOTE: field schemas + visuals are inferred pending the v6 prototype
 * (invoxai-builder-v6.html). Defaults follow the locked plan (violet brand,
 * Space Grotesk / Inter, InvoxAI branding).
 */
import type {
  BlockDef,
  BlockRegistry,
  BlockType,
  FieldDef,
  Section,
  SectionControls,
} from './types';

// ---------------------------------------------------------------------------
// Field helpers (keep the registry terse + consistent)
// ---------------------------------------------------------------------------

const f = {
  text: (key: string, label: string, def = '', placeholder?: string): FieldDef => ({
    key, label, kind: 'text', default: def, placeholder,
  }),
  area: (key: string, label: string, def = '', placeholder?: string): FieldDef => ({
    key, label, kind: 'textarea', default: def, placeholder,
  }),
  rich: (key: string, label: string, def = ''): FieldDef => ({
    key, label, kind: 'richtext', default: def,
  }),
  num: (key: string, label: string, def = 0, min?: number, max?: number, step?: number): FieldDef => ({
    key, label, kind: 'number', default: def, min, max, step,
  }),
  bool: (key: string, label: string, def = false): FieldDef => ({
    key, label, kind: 'toggle', default: def,
  }),
  sel: (key: string, label: string, options: string[] | { value: string; label: string }[], def?: string): FieldDef => ({
    key, label, kind: 'select',
    options: options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o)),
    default: def ?? (typeof options[0] === 'string' ? options[0] : (options[0] as { value: string }).value),
  }),
  color: (key: string, label: string, def = ''): FieldDef => ({
    key, label, kind: 'color', default: def,
  }),
  img: (key: string, label: string, def = ''): FieldDef => ({
    key, label, kind: 'image', default: def,
  }),
  url: (key: string, label: string, def = '', placeholder = 'https://…'): FieldDef => ({
    key, label, kind: 'url', default: def, placeholder,
  }),
  icon: (key: string, label: string, def = '✦'): FieldDef => ({
    key, label, kind: 'icon', default: def,
  }),
  rep: (key: string, label: string, itemFields: FieldDef[], itemLabel = 'Item'): FieldDef => ({
    key, label, kind: 'repeater', itemFields, itemLabel,
  }),
};

/** Build a default props object from a block's field list. */
function defaultsFrom(fields: FieldDef[], overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const fd of fields) {
    if (fd.kind === 'repeater') out[fd.key] = overrides[fd.key] ?? [];
    else out[fd.key] = fd.key in overrides ? overrides[fd.key] : fd.default ?? '';
  }
  for (const k of Object.keys(overrides)) if (!(k in out)) out[k] = overrides[k];
  return out;
}

function block(
  type: BlockType,
  meta: { label: string; category: BlockDef['category']; icon: string; variants: string[] },
  fields: FieldDef[],
  defaultOverrides: Record<string, unknown> = {},
  sectionDefaults?: SectionControls,
): BlockDef {
  return {
    type,
    label: meta.label,
    category: meta.category,
    icon: meta.icon,
    variants: meta.variants,
    fields,
    defaults: defaultsFrom(fields, defaultOverrides),
    sectionDefaults,
  };
}

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

export const REGISTRY: BlockRegistry = {
  // ---- Structure --------------------------------------------------------
  navbar: block(
    'navbar',
    { label: 'Navbar', category: 'structure', icon: '▭', variants: ['left', 'center', 'split'] },
    [
      f.text('logoText', 'Logo text', 'InvoxAI'),
      f.img('logoImg', 'Logo image'),
      f.rep('links', 'Links', [f.text('label', 'Label', 'Link'), f.url('url', 'URL', '#')], 'Link'),
      f.text('ctaLabel', 'CTA label', 'Get started'),
      f.url('ctaUrl', 'CTA link', '#'),
      f.bool('sticky', 'Sticky', true),
    ],
    {
      links: [
        { label: 'Features', url: '#features' },
        { label: 'Pricing', url: '#pricing' },
        { label: 'FAQ', url: '#faq' },
      ],
    },
    { bg: 'glass', size: 'sm' },
  ),
  footer: block(
    'footer',
    { label: 'Footer', category: 'structure', icon: '▬', variants: ['simple', 'columns', 'minimal'] },
    [
      f.text('logoText', 'Logo text', 'InvoxAI'),
      f.text('tagline', 'Tagline', 'Build pages that convert.'),
      f.rep('links', 'Links', [f.text('label', 'Label', 'Link'), f.url('url', 'URL', '#')], 'Link'),
      f.rep('socials', 'Socials', [f.icon('icon', 'Icon', '🌐'), f.url('url', 'URL', '#')], 'Social'),
      f.text('copyright', 'Copyright', '© InvoxAI. All rights reserved.'),
    ],
    {
      links: [
        { label: 'Privacy', url: '#' },
        { label: 'Terms', url: '#' },
        { label: 'Contact', url: '#' },
      ],
    },
    { bg: 'dark', textColor: 'light' },
  ),

  // ---- Headers ----------------------------------------------------------
  badgebar: block(
    'badgebar',
    { label: 'Badge bar', category: 'header', icon: '🏷', variants: ['pills', 'ticker'] },
    [f.rep('items', 'Badges', [f.icon('icon', 'Icon', '✓'), f.text('text', 'Text', 'Trusted')], 'Badge')],
    { items: [{ icon: '⚡', text: 'Fast' }, { icon: '🔒', text: 'Secure' }, { icon: '★', text: 'Rated 4.9' }] },
    { bg: 'tintP', size: 'sm', align: 'center' },
  ),
  hero: block(
    'hero',
    { label: 'Hero', category: 'header', icon: '★', variants: ['center', 'left', 'right', 'split'] },
    [
      f.text('eyebrow', 'Eyebrow', 'NEW'),
      f.text('title', 'Title', 'Build pages that convert'),
      f.area('subtitle', 'Subtitle', 'Launch a polished, high-converting page in minutes — no code.'),
      f.text('b1Label', 'Button 1', 'Get started'),
      f.url('b1Url', 'Button 1 link', '#'),
      f.text('b2Label', 'Button 2', 'Learn more'),
      f.url('b2Url', 'Button 2 link', '#'),
      f.img('image', 'Image'),
      f.num('rating', 'Rating (0–5)', 0, 0, 5, 0.1),
    ],
    {},
    { size: 'lg', align: 'center', anim: 'up' },
  ),
  flip3d: block(
    'flip3d',
    { label: '3D flip', category: 'header', icon: '🃏', variants: ['card', 'tilt'] },
    [f.text('title', 'Title', 'Meet the future'), f.area('subtitle', 'Subtitle', 'A bold, interactive intro.'), f.img('image', 'Image')],
    {},
    { size: 'lg', align: 'center', anim: 'zoom' },
  ),
  webinfo: block(
    'webinfo',
    { label: 'Info bar', category: 'header', icon: 'ℹ', variants: ['bar', 'cards'] },
    [f.rep('items', 'Items', [f.text('label', 'Label', 'Label'), f.text('value', 'Value', 'Value')], 'Item')],
    { items: [{ label: 'Customers', value: '12k+' }, { label: 'Uptime', value: '99.9%' }] },
    { bg: 'glass', size: 'sm' },
  ),

  // ---- Social proof -----------------------------------------------------
  logos: block(
    'logos',
    { label: 'Logo wall', category: 'social', icon: '🏢', variants: ['row', 'grid', 'marquee'] },
    [f.text('heading', 'Heading', 'Trusted by teams everywhere'), f.rep('logos', 'Logos', [f.img('img', 'Logo'), f.text('alt', 'Alt', 'Brand')], 'Logo')],
    { logos: [{ img: '', alt: 'Acme' }, { img: '', alt: 'Globex' }, { img: '', alt: 'Initech' }] },
    { bg: 'transparent', size: 'sm', align: 'center' },
  ),
  marquee: block(
    'marquee',
    { label: 'Marquee', category: 'social', icon: '➡', variants: ['single', 'double'] },
    [f.rep('items', 'Items', [f.text('text', 'Text', 'Ship faster')], 'Item')],
    { items: [{ text: 'Ship faster' }, { text: 'Convert more' }, { text: 'No code' }] },
    { bg: 'dark', textColor: 'light', size: 'sm' },
  ),
  proof: block(
    'proof',
    { label: 'Social proof', category: 'social', icon: '⭐', variants: ['stars', 'avatars', 'mixed'] },
    [f.text('heading', 'Heading', 'Loved by 10,000+ creators'), f.num('rating', 'Rating', 4.9, 0, 5, 0.1), f.num('count', 'Review count', 1200), f.rep('avatars', 'Avatars', [f.img('img', 'Avatar')], 'Avatar')],
    { avatars: [{ img: '' }, { img: '' }, { img: '' }] },
    { align: 'center' },
  ),
  testimonials: block(
    'testimonials',
    { label: 'Testimonials', category: 'social', icon: '💬', variants: ['grid', 'slider', 'marquee'] },
    [
      f.text('heading', 'Heading', 'What people say'),
      f.rep('items', 'Testimonials', [f.area('quote', 'Quote', 'This changed how we launch.'), f.text('name', 'Name', 'Jane Doe'), f.text('role', 'Role', 'Founder'), f.img('avatar', 'Avatar')], 'Testimonial'),
    ],
    { items: [
      { quote: 'Best builder we have used.', name: 'Alex Kim', role: 'CEO, Acme', avatar: '' },
      { quote: 'Doubled our conversions.', name: 'Sam Lee', role: 'Marketing', avatar: '' },
    ] },
    { align: 'center' },
  ),

  // ---- Content ----------------------------------------------------------
  features: block(
    'features',
    { label: 'Features', category: 'content', icon: '✦', variants: ['grid', 'list', 'icon-cards'] },
    [
      f.text('heading', 'Heading', 'Everything you need'),
      f.area('sub', 'Subheading', 'Powerful building blocks, ready to ship.'),
      f.rep('items', 'Features', [f.icon('icon', 'Icon', '✦'), f.text('title', 'Title', 'Feature'), f.area('text', 'Text', 'Short description.')], 'Feature'),
    ],
    { items: [
      { icon: '⚡', title: 'Fast', text: 'Blazing performance out of the box.' },
      { icon: '🎨', title: 'Beautiful', text: 'Polished, on-brand sections.' },
      { icon: '🔒', title: 'Secure', text: 'Server-side writes, no leaks.' },
    ] },
    { align: 'center' },
  ),
  bento: block(
    'bento',
    { label: 'Bento grid', category: 'content', icon: '▦', variants: ['3x2', 'asym'] },
    [f.text('heading', 'Heading', 'Highlights'), f.rep('items', 'Cells', [f.text('title', 'Title', 'Cell'), f.area('text', 'Text', 'Description.'), f.sel('span', 'Span', ['1', '2'], '1')], 'Cell')],
    { items: [{ title: 'Big idea', text: 'A standout cell.', span: '2' }, { title: 'Detail', text: 'Supporting cell.', span: '1' }, { title: 'Detail', text: 'Supporting cell.', span: '1' }] },
  ),
  tabs: block(
    'tabs',
    { label: 'Tabs', category: 'content', icon: '⊟', variants: ['top', 'side'] },
    [f.text('heading', 'Heading', 'How it works'), f.rep('items', 'Tabs', [f.text('label', 'Tab label', 'Tab'), f.text('title', 'Title', 'Title'), f.area('text', 'Text', 'Description.'), f.img('image', 'Image')], 'Tab')],
    { items: [{ label: 'Design', title: 'Design fast', text: 'Drag, drop, done.', image: '' }, { label: 'Publish', title: 'Go live', text: 'One click to publish.', image: '' }] },
  ),
  orbital: block(
    'orbital',
    { label: 'Orbital', category: 'content', icon: '◍', variants: ['ring'] },
    [f.text('heading', 'Heading', 'One platform'), f.text('center', 'Center label', 'InvoxAI'), f.rep('items', 'Nodes', [f.text('label', 'Label', 'Node')], 'Node')],
    { items: [{ label: 'Pages' }, { label: 'Store' }, { label: 'Checkout' }, { label: 'Analytics' }] },
    { align: 'center' },
  ),
  alist: block(
    'alist',
    { label: 'Accordion list', category: 'content', icon: '☰', variants: ['accordion', 'checklist'] },
    [f.text('heading', 'Heading', 'Includes'), f.rep('items', 'Items', [f.text('title', 'Title', 'Item'), f.area('text', 'Text', 'Detail.')], 'Item')],
    { items: [{ title: 'Unlimited pages', text: 'Build as many as you need.' }, { title: 'Custom domains', text: 'Bring your own domain.' }] },
  ),
  stats: block(
    'stats',
    { label: 'Stats', category: 'content', icon: '📊', variants: ['row', 'cards'] },
    [f.text('heading', 'Heading', 'By the numbers'), f.rep('items', 'Stats', [f.text('value', 'Value', '99%'), f.text('label', 'Label', 'Uptime')], 'Stat')],
    { items: [{ value: '12k+', label: 'Users' }, { value: '99.9%', label: 'Uptime' }, { value: '4.9★', label: 'Rating' }] },
    { align: 'center' },
  ),
  steps: block(
    'steps',
    { label: 'Steps', category: 'content', icon: '①', variants: ['horizontal', 'vertical', 'numbered'] },
    [f.text('heading', 'Heading', 'Get started in 3 steps'), f.rep('items', 'Steps', [f.text('title', 'Title', 'Step'), f.area('text', 'Text', 'What happens here.')], 'Step')],
    { items: [{ title: 'Pick a template', text: 'Start from a preset.' }, { title: 'Customize', text: 'Edit content + theme.' }, { title: 'Publish', text: 'Go live instantly.' }] },
  ),
  video: block(
    'video',
    { label: 'Video', category: 'content', icon: '▶', variants: ['embed', 'lightbox'] },
    [f.text('heading', 'Heading', 'See it in action'), f.url('url', 'Video URL', '', 'YouTube/Vimeo/MP4 URL'), f.img('poster', 'Poster image')],
    {},
    { align: 'center' },
  ),
  faq: block(
    'faq',
    { label: 'FAQ', category: 'content', icon: '❓', variants: ['accordion', 'two-col'] },
    [f.text('heading', 'Heading', 'Frequently asked questions'), f.rep('items', 'Questions', [f.text('q', 'Question', 'Question?'), f.area('a', 'Answer', 'Answer.')], 'Question')],
    { items: [{ q: 'Is there a free plan?', a: 'Yes, start free.' }, { q: 'Can I use my domain?', a: 'Absolutely.' }] },
  ),
  counters: block(
    'counters',
    { label: 'Counters', category: 'content', icon: '🔢', variants: ['row'] },
    [f.text('heading', 'Heading', 'Trusted at scale'), f.rep('items', 'Counters', [f.num('value', 'Value', 100), f.text('label', 'Label', 'Customers'), f.text('suffix', 'Suffix', '+')], 'Counter')],
    { items: [{ value: 12000, label: 'Users', suffix: '+' }, { value: 99, label: 'Uptime', suffix: '%' }] },
    { align: 'center' },
  ),

  // ---- Layout -----------------------------------------------------------
  grid: block(
    'grid',
    { label: 'Card grid', category: 'layout', icon: '▤', variants: ['2col', '3col', '4col'] },
    [f.text('heading', 'Heading', 'Explore'), f.rep('items', 'Cards', [f.img('image', 'Image'), f.text('title', 'Title', 'Card'), f.area('text', 'Text', 'Description.')], 'Card')],
    { items: [{ image: '', title: 'One', text: 'Description.' }, { image: '', title: 'Two', text: 'Description.' }, { image: '', title: 'Three', text: 'Description.' }] },
  ),
  media: block(
    'media',
    { label: 'Media + text', category: 'layout', icon: '🖼', variants: ['left', 'right', 'full'] },
    [f.text('title', 'Title', 'A picture says more'), f.area('text', 'Text', 'Pair an image with a clear message.'), f.img('image', 'Image'), f.text('b1Label', 'Button', 'Learn more'), f.url('b1Url', 'Button link', '#')],
  ),
  gallery: block(
    'gallery',
    { label: 'Gallery', category: 'layout', icon: '🎞', variants: ['grid', 'masonry', 'carousel'] },
    [f.text('heading', 'Heading', 'Gallery'), f.rep('images', 'Images', [f.img('img', 'Image'), f.text('caption', 'Caption', '')], 'Image')],
    { images: [{ img: '', caption: '' }, { img: '', caption: '' }, { img: '', caption: '' }] },
  ),

  // ---- Commerce ---------------------------------------------------------
  pricing: block(
    'pricing',
    { label: 'Pricing', category: 'commerce', icon: '💲', variants: ['cards', 'table', 'toggle'] },
    [
      f.text('heading', 'Heading', 'Simple pricing'),
      f.area('sub', 'Subheading', 'Pick a plan that scales with you.'),
      f.rep('plans', 'Plans', [
        f.text('name', 'Name', 'Pro'),
        f.text('price', 'Price', '$29'),
        f.text('period', 'Period', '/mo'),
        f.area('features', 'Features (one per line)', 'Unlimited pages\nCustom domain\nAnalytics'),
        f.text('ctaLabel', 'CTA label', 'Choose plan'),
        f.url('ctaUrl', 'CTA link', '#'),
        f.bool('featured', 'Featured', false),
      ], 'Plan'),
    ],
    { plans: [
      { name: 'Starter', price: '$0', period: '/mo', features: 'One page\nInvoxAI subdomain', ctaLabel: 'Start free', ctaUrl: '#', featured: false },
      { name: 'Pro', price: '$29', period: '/mo', features: 'Unlimited pages\nCustom domain\nAnalytics', ctaLabel: 'Go Pro', ctaUrl: '#', featured: true },
    ] },
    { align: 'center' },
  ),
  payment: block(
    'payment',
    { label: 'Payment', category: 'commerce', icon: '💳', variants: ['inline', 'button', 'card'] },
    [f.text('heading', 'Heading', 'Complete your purchase'), f.num('amount', 'Amount', 999), f.sel('currency', 'Currency', ['INR', 'USD', 'EUR'], 'INR'), f.text('label', 'Button label', 'Pay now'), f.text('productId', 'Product ID', '')],
    {},
    { align: 'center' },
  ),

  // ---- Capture ----------------------------------------------------------
  countdown: block(
    'countdown',
    { label: 'Countdown', category: 'capture', icon: '⏳', variants: ['bar', 'block'] },
    [f.text('heading', 'Heading', 'Offer ends soon'), f.text('target', 'Target (ISO date)', '', '2026-12-31T23:59:59Z'), f.text('expiredText', 'Expired text', 'This offer has ended.')],
    {},
    { bg: 'tintC', align: 'center' },
  ),
  banner: block(
    'banner',
    { label: 'CTA banner', category: 'capture', icon: '📣', variants: ['band', 'floating'] },
    [f.text('text', 'Text', 'Ready to launch?'), f.text('ctaLabel', 'CTA label', 'Get started'), f.url('ctaUrl', 'CTA link', '#')],
    {},
    { bg: 'tintP', align: 'center' },
  ),
  lead: block(
    'lead',
    { label: 'Lead form', category: 'capture', icon: '✉', variants: ['inline', 'stacked', 'card'] },
    [
      f.text('heading', 'Heading', 'Get early access'),
      f.area('sub', 'Subheading', 'Join the waitlist — no spam.'),
      f.rep('fields', 'Fields', [f.text('label', 'Label', 'Email'), f.text('key', 'Key', 'email'), f.sel('type', 'Type', ['text', 'email', 'tel', 'textarea'], 'email')], 'Field'),
      f.text('submitLabel', 'Submit label', 'Join'),
      f.url('action', 'Submit action (URL)', ''),
    ],
    { fields: [{ label: 'Name', key: 'name', type: 'text' }, { label: 'Email', key: 'email', type: 'email' }] },
    { align: 'center' },
  ),
  popup: block(
    'popup',
    { label: 'Popup', category: 'capture', icon: '🪟', variants: ['center', 'slidein'] },
    [f.text('title', 'Title', 'Wait! Special offer'), f.area('text', 'Text', 'Get 20% off your first month.'), f.text('ctaLabel', 'CTA label', 'Claim offer'), f.url('ctaUrl', 'CTA link', '#'), f.num('delay', 'Delay (seconds)', 5, 0, 120, 1)],
  ),
};

// ---------------------------------------------------------------------------
// Ordered metadata for the section-library popup
// ---------------------------------------------------------------------------

export const CATEGORY_ORDER: { id: BlockDef['category']; label: string }[] = [
  { id: 'structure', label: 'Structure' },
  { id: 'header', label: 'Headers' },
  { id: 'social', label: 'Social proof' },
  { id: 'content', label: 'Content' },
  { id: 'layout', label: 'Layout' },
  { id: 'commerce', label: 'Commerce' },
  { id: 'capture', label: 'Capture' },
];

export const BLOCK_TYPES = Object.keys(REGISTRY) as BlockType[];

export function getBlock(type: BlockType): BlockDef {
  return REGISTRY[type];
}

/** Blocks grouped by category, in display order. */
export function blocksByCategory(): { category: { id: BlockDef['category']; label: string }; blocks: BlockDef[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    blocks: BLOCK_TYPES.map((t) => REGISTRY[t]).filter((b) => b.category === category.id),
  }));
}

// ---------------------------------------------------------------------------
// Section factory
// ---------------------------------------------------------------------------

function uid(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return 'bx-' + Math.abs(Date.now() ^ Math.floor(Math.random() * 1e9)).toString(36);
}

const SECTION_BASE: Omit<Section, 'id' | 'type' | 'variant' | 'props'> = {
  bg: 'plain',
  size: 'md',
  align: '',
  anim: '',
  btn: 'gradient',
  btnSize: 'md',
  btnColor: '',
  textColor: '',
  mobileHidden: false,
};

/** Create a new Section for a block type, applying its defaults + variant. */
export function createSection(type: BlockType, variant?: string): Section {
  const def = REGISTRY[type];
  return {
    id: uid(),
    type,
    variant: variant ?? def.variants[0],
    ...SECTION_BASE,
    ...def.sectionDefaults,
    props: structuredClone(def.defaults),
  };
}

/** Default props for a block (deep copy, safe to mutate). */
export function defaultProps(type: BlockType): Record<string, unknown> {
  return structuredClone(REGISTRY[type].defaults);
}
