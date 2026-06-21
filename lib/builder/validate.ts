/**
 * lib/builder/validate.ts
 * InvoxAI Page Builder v6 — Section / PageDoc / Template validator.
 *
 * Self-contained: imports ONLY from ./registry, ./types, ./themes, ./templates.
 * Never imports studio / route / DB modules.
 *
 * Exports:
 *   validateSection(section)  → { ok, errors }
 *   validatePageDoc(doc)      → { ok, errors }
 *   validateTemplate(t)       → { ok, errors }
 *   coerceSection(section)    → Section   (best-effort fix / clean clone)
 */

import { REGISTRY, BLOCK_TYPES, createSection } from './registry';
import type { BlockType, FieldDef, Section } from './types';
import { THEMES } from './themes';
import { TEMPLATES as _TEMPLATES } from './templates'; // ensure module resolves (used in self-test)
void _TEMPLATES; // suppress unused-variable warning

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/** Valid pageBg values for PageDoc (and Template). */
const VALID_PAGE_BG = new Set<string>(['none', 'orbs', 'grid', 'aurora', 'mesh', 'dots']);

/** Set of all valid theme ids (built once from THEMES). */
const VALID_THEME_IDS = new Set<string>(THEMES.map((t) => t.id));

/** Section-level control keys (carry-over in coerceSection). */
const SECTION_CONTROL_KEYS: ReadonlyArray<keyof Section> = [
  'id', 'bg', 'size', 'align', 'anim', 'btn', 'btnSize', 'btnColor', 'textColor', 'mobileHidden',
];

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Per-field value validation (shared by validateSection + validateTemplate)
// ---------------------------------------------------------------------------

/**
 * Validate a single prop value against its FieldDef.
 * Returns an array of error strings (empty = valid).
 * Warnings are prefixed with "warning:" and do NOT cause ok=false.
 */
function validateFieldValue(key: string, value: unknown, fd: FieldDef): string[] {
  const errs: string[] = [];

  switch (fd.kind) {
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errs.push(`prop '${key}' must be a finite number (got ${typeof value})`);
        break;
      }
      if (fd.min !== undefined && (value as number) < fd.min) {
        errs.push(`prop '${key}' value ${value} is below minimum ${fd.min}`);
      }
      if (fd.max !== undefined && (value as number) > fd.max) {
        errs.push(`prop '${key}' value ${value} is above maximum ${fd.max}`);
      }
      break;
    }
    case 'toggle': {
      if (typeof value !== 'boolean') {
        errs.push(`prop '${key}' must be a boolean (got ${typeof value})`);
      }
      break;
    }
    case 'select': {
      const validValues = (fd.options ?? []).map((o) => o.value);
      if (typeof value !== 'string' || !validValues.includes(value)) {
        errs.push(
          `prop '${key}' must be one of [${validValues.map((v) => `'${v}'`).join(', ')}] (got ${JSON.stringify(value)})`,
        );
      }
      break;
    }
    case 'repeater': {
      if (!Array.isArray(value)) {
        errs.push(`prop '${key}' must be an array (got ${typeof value})`);
        break;
      }
      // Build a quick key→FieldDef map for row-level validation.
      const itemFieldMap = new Map<string, FieldDef>(
        (fd.itemFields ?? []).map((f) => [f.key, f]),
      );
      (value as unknown[]).forEach((row, rowIdx) => {
        if (typeof row !== 'object' || row === null || Array.isArray(row)) {
          errs.push(`prop '${key}[${rowIdx}]' each row must be an object`);
          return;
        }
        const rowObj = row as Record<string, unknown>;
        for (const rowKey of Object.keys(rowObj)) {
          const rowFd = itemFieldMap.get(rowKey);
          if (!rowFd) {
            // Unknown key in repeater row → warning only.
            errs.push(`warning: unknown repeater row key '${rowKey}' in '${key}[${rowIdx}]'`);
            continue;
          }
          // Recurse value check for row fields (repeater-of-repeater not supported, but
          // all other kinds are handled; kind=repeater in itemFields is a no-op guard).
          if (rowFd.kind !== 'repeater') {
            const rowErrs = validateFieldValue(`${key}[${rowIdx}].${rowKey}`, rowObj[rowKey], rowFd);
            errs.push(...rowErrs);
          }
        }
        // Missing row keys are fine — defaults fill them in.
      });
      break;
    }
    // String-backed field kinds: url, text, textarea, richtext, color, image, icon.
    case 'url':
    case 'text':
    case 'textarea':
    case 'richtext':
    case 'color':
    case 'image':
    case 'icon': {
      if (typeof value !== 'string') {
        errs.push(`prop '${key}' must be a string (got ${typeof value})`);
      }
      break;
    }
    default: {
      // Unknown kind — do not fail, just ignore.
      break;
    }
  }

  return errs;
}

// ---------------------------------------------------------------------------
// 1. validateSection
// ---------------------------------------------------------------------------

/**
 * Validate a single Section object.
 *
 * - section.type must exist in REGISTRY.
 * - section.variant, if present, must be in REGISTRY[type].variants.
 * - Each key in section.props that maps to a known field is validated by kind.
 * - Unknown prop keys produce a "warning:" prefix error but do NOT set ok=false.
 * - Missing props are fine (defaults fill them).
 */
export function validateSection(section: unknown): ValidationResult {
  const errors: string[] = [];
  let ok = true;

  // Guard: section must be an object.
  if (typeof section !== 'object' || section === null || Array.isArray(section)) {
    return { ok: false, errors: ['section must be a non-null object'] };
  }

  const s = section as Record<string, unknown>;
  const type = s['type'];

  // type must be a string present in REGISTRY.
  if (typeof type !== 'string' || !(BLOCK_TYPES as string[]).includes(type)) {
    return {
      ok: false,
      errors: [`unknown block type '${typeof type === 'string' ? type : String(type)}'`],
    };
  }

  const blockType = type as BlockType;
  const def = REGISTRY[blockType];

  // variant check (optional field).
  const variant = s['variant'];
  if (variant !== undefined && variant !== null && variant !== '') {
    if (!def.variants.includes(String(variant))) {
      errors.push(
        `unknown variant '${variant}' for type '${blockType}' (valid: ${def.variants.map((v) => `'${v}'`).join(', ')})`,
      );
      ok = false;
    }
  }

  // Build a key→FieldDef map for this block.
  const fieldMap = new Map<string, FieldDef>(def.fields.map((f) => [f.key, f]));

  // Validate props (only keys that are present).
  const props = s['props'];
  if (props !== undefined && props !== null) {
    if (typeof props !== 'object' || Array.isArray(props)) {
      errors.push(`section.props must be a plain object`);
      ok = false;
    } else {
      const propsObj = props as Record<string, unknown>;
      for (const key of Object.keys(propsObj)) {
        const fd = fieldMap.get(key);
        if (!fd) {
          // Unknown prop key → warning only (section is still usable).
          errors.push(`warning: unknown prop '${key}' on ${blockType}`);
          // ok stays true for warning-only issues.
          continue;
        }
        const fieldErrs = validateFieldValue(key, propsObj[key], fd);
        for (const e of fieldErrs) {
          if (e.startsWith('warning:')) {
            errors.push(e); // keep as warning
          } else {
            errors.push(e);
            ok = false;
          }
        }
      }
    }
  }

  return { ok, errors };
}

// ---------------------------------------------------------------------------
// 2. validatePageDoc
// ---------------------------------------------------------------------------

/**
 * Validate a PageDoc.
 *
 * - themeId: if present and non-empty, must be a valid theme id.
 * - pageBg: if present, must be one of the 6 valid values.
 * - sections: must be an array; each section validated via validateSection.
 */
export function validatePageDoc(doc: unknown): ValidationResult {
  const errors: string[] = [];
  let ok = true;

  // Guard: doc must be an object.
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    return { ok: false, errors: ['doc must be a non-null object'] };
  }

  const d = doc as Record<string, unknown>;

  // themeId: optional — invalid only when present and non-empty and unrecognised.
  const themeId = d['themeId'];
  if (themeId !== undefined && themeId !== null && themeId !== '') {
    if (!VALID_THEME_IDS.has(String(themeId))) {
      errors.push(`invalid themeId '${themeId}' (valid ids: ${Array.from(VALID_THEME_IDS).join(', ')})`);
      ok = false;
    }
  }

  // pageBg: optional — invalid only when present and unrecognised.
  const pageBg = d['pageBg'];
  if (pageBg !== undefined && pageBg !== null) {
    if (!VALID_PAGE_BG.has(String(pageBg))) {
      errors.push(
        `invalid pageBg '${pageBg}' (valid: ${Array.from(VALID_PAGE_BG).join(', ')})`,
      );
      ok = false;
    }
  }

  // sections: must be an array.
  const sections = d['sections'];
  if (!Array.isArray(sections)) {
    errors.push(`sections must be an array (got ${typeof sections})`);
    ok = false;
  } else {
    sections.forEach((sec: unknown, idx: number) => {
      const secType =
        typeof sec === 'object' && sec !== null && !Array.isArray(sec)
          ? String((sec as Record<string, unknown>)['type'] ?? '')
          : '';
      const result = validateSection(sec);
      if (!result.ok) ok = false;
      for (const e of result.errors) {
        errors.push(`section[${idx}] ${secType}: ${e}`);
      }
    });
  }

  return { ok, errors };
}

// ---------------------------------------------------------------------------
// 3. validateTemplate
// ---------------------------------------------------------------------------

/**
 * Validate a Template object.
 *
 * - t.tag must be 'Free' or 'Pro'.
 * - t.themeId must be a valid theme id.
 * - t.pageBg if present must be a valid pageBg value.
 * - t.blocks must be an array of tuples; each tuple validated per REGISTRY.
 */
export function validateTemplate(t: unknown): ValidationResult {
  const errors: string[] = [];
  let ok = true;

  // Guard: must be a non-null object.
  if (typeof t !== 'object' || t === null || Array.isArray(t)) {
    return { ok: false, errors: ['template must be a non-null object'] };
  }

  const tmpl = t as Record<string, unknown>;

  // tag check.
  if (tmpl['tag'] !== 'Free' && tmpl['tag'] !== 'Pro') {
    errors.push(`tag must be 'Free' or 'Pro' (got ${JSON.stringify(tmpl['tag'])})`);
    ok = false;
  }

  // themeId check (required for templates, must be valid).
  const themeId = tmpl['themeId'];
  if (!themeId || typeof themeId !== 'string' || !VALID_THEME_IDS.has(themeId)) {
    errors.push(
      `invalid or missing themeId '${themeId}' (valid ids: ${Array.from(VALID_THEME_IDS).join(', ')})`,
    );
    ok = false;
  }

  // pageBg: optional but if present must be valid.
  const pageBg = tmpl['pageBg'];
  if (pageBg !== undefined && pageBg !== null) {
    if (!VALID_PAGE_BG.has(String(pageBg))) {
      errors.push(
        `invalid pageBg '${pageBg}' (valid: ${Array.from(VALID_PAGE_BG).join(', ')})`,
      );
      ok = false;
    }
  }

  // blocks: must be an array of tuples.
  const blocks = tmpl['blocks'];
  if (!Array.isArray(blocks)) {
    errors.push(`blocks must be an array (got ${typeof blocks})`);
    ok = false;
  } else {
    (blocks as unknown[]).forEach((tuple: unknown, i: number) => {
      if (!Array.isArray(tuple)) {
        errors.push(`block[${i}]: must be a tuple array, got ${typeof tuple}`);
        ok = false;
        return;
      }

      const [rawType, rawVariant, rawProps] = tuple as [unknown, unknown?, unknown?];

      // type check.
      if (typeof rawType !== 'string' || !(BLOCK_TYPES as string[]).includes(rawType)) {
        errors.push(`block[${i}] ${rawType}: unknown block type '${rawType}'`);
        ok = false;
        return; // can't validate further without a known type
      }

      const blockType = rawType as BlockType;
      const def = REGISTRY[blockType];

      // variant check (optional).
      if (rawVariant !== undefined && rawVariant !== null && rawVariant !== '') {
        if (!def.variants.includes(String(rawVariant))) {
          errors.push(
            `block[${i}] ${blockType}: unknown variant '${rawVariant}' (valid: ${def.variants.map((v) => `'${v}'`).join(', ')})`,
          );
          ok = false;
        }
      }

      // props check (optional, partial props are fine).
      if (rawProps !== undefined && rawProps !== null) {
        if (typeof rawProps !== 'object' || Array.isArray(rawProps)) {
          errors.push(`block[${i}] ${blockType}: props must be a plain object`);
          ok = false;
        } else {
          const propsObj = rawProps as Record<string, unknown>;
          const fieldMap = new Map<string, FieldDef>(def.fields.map((f) => [f.key, f]));

          for (const key of Object.keys(propsObj)) {
            const fd = fieldMap.get(key);
            if (!fd) {
              errors.push(`block[${i}] ${blockType}: warning: unknown prop key '${key}'`);
              // warning only — ok stays true
              continue;
            }
            const fieldErrs = validateFieldValue(key, propsObj[key], fd);
            for (const e of fieldErrs) {
              if (e.startsWith('warning:')) {
                errors.push(`block[${i}] ${blockType}: ${e}`);
              } else {
                errors.push(`block[${i}] ${blockType}: ${e}`);
                ok = false;
              }
            }
          }
        }
      }
    });
  }

  return { ok, errors };
}

// ---------------------------------------------------------------------------
// 4. coerceSection
// ---------------------------------------------------------------------------

/**
 * Best-effort coerce / clean a raw section object into a valid Section.
 *
 * - If type is unknown, return the input as-is (cast) — do not crash.
 * - For known type: start from createSection(type, validVariantOrDefault),
 *   merge ONLY known prop keys from input over registry defaults,
 *   then carry over section-level controls (id, bg, size, …) from input.
 */
export function coerceSection(section: unknown): Section {
  // Guard: if input isn't an object at all, return a minimal unknown-type section.
  if (typeof section !== 'object' || section === null || Array.isArray(section)) {
    // Return a safe no-op shape (typed as Section to satisfy the return type).
    return section as unknown as Section;
  }

  const raw = section as Record<string, unknown>;
  const rawType = raw['type'];

  // Unknown type — leave as-is (do not crash).
  if (typeof rawType !== 'string' || !(BLOCK_TYPES as string[]).includes(rawType)) {
    return raw as unknown as Section;
  }

  const blockType = rawType as BlockType;
  const def = REGISTRY[blockType];

  // Determine a valid variant (fallback to first registered variant).
  const rawVariant = raw['variant'];
  const validVariant =
    typeof rawVariant === 'string' && def.variants.includes(rawVariant)
      ? rawVariant
      : def.variants[0];

  // Start from a fresh section (registry defaults + proper id/type/variant).
  const cleaned = createSection(blockType, validVariant);

  // Carry over section-level controls from the input (when present).
  for (const key of SECTION_CONTROL_KEYS) {
    if (key in raw && raw[key] !== undefined) {
      // Carry over the raw value; the renderer will ignore anything invalid.
      (cleaned as unknown as Record<string, unknown>)[key] = raw[key];
    }
  }

  // Build a field key set for this block — only merge KNOWN prop keys.
  const knownKeys = new Set<string>(def.fields.map((f) => f.key));

  const inputProps =
    typeof raw['props'] === 'object' && raw['props'] !== null && !Array.isArray(raw['props'])
      ? (raw['props'] as Record<string, unknown>)
      : {};

  for (const key of Object.keys(inputProps)) {
    if (knownKeys.has(key)) {
      cleaned.props[key] = inputProps[key];
    }
    // Unknown prop keys are silently dropped.
  }

  return cleaned;
}
