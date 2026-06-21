/**
 * lib/builder/templates.ts
 * Page Builder v6 — code-defined starter templates + Direct Apply.
 * Self-contained (no DB): each template is a list of block tuples expanded into
 * fresh Sections via the registry. Applying a template replaces a page's
 * sections + theme + background. Paid ("Pro") purchase wiring is layered later.
 */
import { createSection } from './registry';
import type { PageDoc, Section, Template, TemplateTuple } from './types';

/** Expand a tuple [type, variant?, propsOverride?] into a fresh Section. */
function expand(tuple: TemplateTuple): Section {
  const [type, variant, props] = tuple;
  const sec = createSection(type, variant);
  if (props) sec.props = { ...sec.props, ...props };
  return sec;
}

/** Build fresh Sections (new ids) for a template. */
export function templateSections(t: Template): Section[] {
  return t.blocks.map(expand);
}

/** Return a new PageDoc with the template's sections + theme + background. */
export function applyTemplate(doc: PageDoc, t: Template): PageDoc {
  return { ...doc, sections: templateSections(t), themeId: t.themeId, pageBg: t.pageBg ?? 'none' };
}

const hero = (title: string, subtitle: string, b1 = 'Get started'): TemplateTuple =>
  ['hero', 'center', { title, subtitle, b1Label: b1, eyebrow: '' }];

export const TEMPLATES: Template[] = [
  {
    id: 'saas-launch', name: 'SaaS Launch', category: 'SaaS', type: 'landing', tag: 'Free',
    description: 'Crisp product launch page with pricing and FAQ.',
    themeId: 'violet', pageBg: 'aurora',
    blocks: [
      ['navbar'], hero('Ship your product faster', 'The all-in-one platform to launch, sell and grow — no code required.'),
      ['logos'], ['features'], ['stats'], ['pricing'], ['faq'], ['banner'], ['footer'],
    ],
  },
  {
    id: 'agency-bold', name: 'Bold Agency', category: 'Agency', type: 'landing', tag: 'Pro',
    description: 'Dark, high-impact agency page with case-study feel.',
    themeId: 'midnight', pageBg: 'mesh',
    blocks: [
      ['navbar'], ['hero', 'split', { title: 'We build brands that win', subtitle: 'Strategy, design and growth for ambitious teams.' }],
      ['media', 'right'], ['features'], ['testimonials'], ['stats'], ['banner'], ['footer'],
    ],
  },
  {
    id: 'ecom-product', name: 'Product Store', category: 'Ecommerce', type: 'landing', tag: 'Free',
    description: 'Showcase a product with gallery, features and pricing.',
    themeId: 'emerald', pageBg: 'none',
    blocks: [
      ['navbar'], hero('Meet your new favourite thing', 'Designed to delight, built to last.', 'Buy now'),
      ['grid', '3col'], ['features', 'list'], ['testimonials'], ['pricing'], ['faq'], ['footer'],
    ],
  },
  {
    id: 'event-countdown', name: 'Live Event', category: 'Event', type: 'event', tag: 'Pro',
    description: 'Event landing with countdown, agenda and signup.',
    themeId: 'sunset', pageBg: 'orbs',
    blocks: [
      ['navbar'], hero('The conference for builders', 'Two days of talks, workshops and networking.', 'Get tickets'),
      ['countdown'], ['steps'], ['proof'], ['faq'], ['lead', 'card'], ['footer'],
    ],
  },
  {
    id: 'course-pro', name: 'Online Course', category: 'Education', type: 'courses', tag: 'Free',
    description: 'Sell a course with curriculum, proof and pricing.',
    themeId: 'indigo', pageBg: 'aurora',
    blocks: [
      ['navbar'], hero('Master a new skill in weeks', 'A practical, project-based course from real practitioners.', 'Enroll now'),
      ['features'], ['steps', 'numbered'], ['testimonials'], ['pricing'], ['faq'], ['footer'],
    ],
  },
  {
    id: 'portfolio-min', name: 'Minimal Portfolio', category: 'Portfolio', type: 'landing', tag: 'Free',
    description: 'Clean personal portfolio with gallery and contact.',
    themeId: 'slate', pageBg: 'dots',
    blocks: [
      ['navbar'], ['hero', 'center', { title: 'Hi, I design things', subtitle: 'Selected work from the last few years.', b1Label: 'View work' }],
      ['gallery'], ['alist', 'checklist'], ['banner'], ['footer'],
    ],
  },
  {
    id: 'leadgen-simple', name: 'Lead Magnet', category: 'Lead gen', type: 'lead', tag: 'Free',
    description: 'Capture emails with a focused value proposition.',
    themeId: 'ocean', pageBg: 'mesh',
    blocks: [
      ['navbar'], hero('Get the free playbook', 'Everything we learned scaling to 6 figures, in one PDF.', 'Download free'),
      ['features'], ['proof'], ['lead', 'card'], ['footer'],
    ],
  },
  {
    id: 'webinar-vip', name: 'Webinar / VIP', category: 'Webinar', type: 'vip', tag: 'Pro',
    description: 'Register for a live webinar with video and social proof.',
    themeId: 'crimson', pageBg: 'orbs',
    blocks: [
      ['navbar'], hero('The free masterclass', 'Join live and learn the exact system we use.', 'Save my seat'),
      ['video'], ['counters'], ['testimonials'], ['lead', 'card'], ['footer'],
    ],
  },
  {
    id: 'app-showcase', name: 'App Showcase', category: 'Mobile app', type: 'landing', tag: 'Pro',
    description: 'Promote a mobile app with bento highlights and pricing.',
    themeId: 'teal', pageBg: 'aurora',
    blocks: [
      ['navbar'], ['hero', 'split', { title: 'Your day, organised', subtitle: 'The app that keeps everything in one place.', b1Label: 'Download' }],
      ['bento'], ['features'], ['stats'], ['pricing'], ['faq'], ['footer'],
    ],
  },
  {
    id: 'creator-news', name: 'Creator Newsletter', category: 'Creator', type: 'lead', tag: 'Free',
    description: 'Grow a newsletter with proof and a strong CTA.',
    themeId: 'rose', pageBg: 'none',
    blocks: [
      ['navbar'], hero('Join 20,000+ readers', 'A weekly email on building in public — free, every Sunday.', 'Subscribe'),
      ['marquee'], ['features'], ['testimonials'], ['lead'], ['footer'],
    ],
  },
];

export const TEMPLATE_CATEGORIES = Array.from(new Set(TEMPLATES.map((t) => t.category)));

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
