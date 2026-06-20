/**
 * lib/template-ai.ts — AI-powered template generation.
 *
 * AI GENERATION IS ADMIN-ONLY.
 * - Real Claude API call activates when ANTHROPIC_API_KEY is set in env.
 * - When the key is absent a deterministic, fully-valid manifest stub runs so the
 *   entire pipeline (validate → preview → save) is exercisable end-to-end without
 *   a real API key.
 * - This module is server-only (reads fs, uses process.env). Never import it from
 *   client components or seller-facing routes.
 *
 * Environment variables:
 *   ANTHROPIC_API_KEY  — Anthropic secret key. Required for real model calls.
 *   ANTHROPIC_MODEL    — Override model ID (default: claude-sonnet-4-6).
 *                        For max design quality use claude-opus-4-8.
 *
 * To enable real generation:
 *   1. Add ANTHROPIC_API_KEY=sk-ant-... to your .env.local (never commit it).
 *   2. Restart the server: sudo systemctl restart invoxai-web
 *   3. The stub console.warn will disappear and real completions will flow.
 */

import fs from "fs";
import path from "path";
import {
  validateManifest,
  validateContentForType,
  KNOWN_CONTENT_KEYS,
  type TemplateManifest,
  type TemplateType,
} from "@/lib/template-manifest";

// ── Brief type ────────────────────────────────────────────────────────────────

export type AITemplateBrief = {
  type: TemplateType;
  vibe: string;
  audience?: string;
  tier: "free" | "premium";
  price_paise: number;
  license_model: "per_store" | "per_page" | "all_access";
  name?: string;
};

// ── Helper: read the authoring format doc at runtime ─────────────────────────

function readAuthoringFormatDoc(): string {
  try {
    const docPath = path.join(process.cwd(), "docs", "TEMPLATE-AUTHORING-FORMAT.md");
    return fs.readFileSync(docPath, "utf-8");
  } catch {
    // Fallback short spec if the file cannot be read
    return `# Template Authoring Format (fallback spec)
A template manifest is a JSON object with these top-level keys:
name (2-40 chars), type (bio|store|product|courses|booking|event|payment|lead|website|checkout|vip),
tier (free|premium), price_paise (int>=0, 0 when free), description (string), tags (string[]),
thumbnail_url (string, may be ""), theme (object), content (non-empty object).
Rules: content keys must match the type's *Content TS type. No unknown keys. No lorem ipsum.
Real copy only. Output one JSON object with no markdown fences.`;
  }
}

// ── Helper: build the content key list hint for a given type ─────────────────

function contentKeysHint(type: TemplateType): string {
  const allowlist = KNOWN_CONTENT_KEYS[type as keyof typeof KNOWN_CONTENT_KEYS];
  if (allowlist) {
    return `Allowed top-level content keys for type "${type}": ${[...allowlist].join(", ")}.`;
  }
  // For less-modeled types accept any keys; hint toward checking lib/<type>.ts
  const libFile = type === "courses" ? "course" : type;
  return `For type "${type}", use the top-level keys from lib/${libFile}.ts. Any non-empty content object is accepted.`;
}

// ── buildTemplatePrompt ───────────────────────────────────────────────────────

/**
 * Assemble the system + user prompt pair for template generation.
 * Pure / synchronous: reads the authoring doc from disk (may throw only if fs
 * is broken, but has a fallback).
 *
 * Exported so it can be tested independently of the HTTP call.
 */
export function buildTemplatePrompt(brief: AITemplateBrief): { system: string; user: string } {
  const authoringDoc = readAuthoringFormatDoc();
  const keysHint = contentKeysHint(brief.type);

  const system = `You are an expert template author for the Invoxai platform.
You create complete, production-ready Template Manifests for seller page types.
You must follow the authoring format EXACTLY.

=== TEMPLATE AUTHORING FORMAT (full spec) ===
${authoringDoc}

=== CONTENT KEY CONTRACT FOR TYPE "${brief.type.toUpperCase()}" ===
${keysHint}

=== RULES ===
1. Return ONLY a single raw JSON object — no markdown fences, no comments, no trailing commas.
2. Obey every rule in the authoring format (§5 Authoring rules).
3. Do not invent any content keys that are not in the allowed list above.
4. Write real, on-brand copy matching the brief. No lorem ipsum.
5. Leave thumbnail_url as "" — it will be generated later.
6. The manifest must be valid JSON and pass the validator before you output it.`;

  const audienceLine = brief.audience ? `, target audience: ${brief.audience}` : "";
  const priceLine =
    brief.tier === "premium"
      ? ` Price: ₹${Math.round(brief.price_paise / 100)} (${brief.price_paise} paise).`
      : " This is a free template (price_paise must be 0).";
  const nameLine = brief.name ? ` Template name: "${brief.name}".` : "";

  const user = `Generate a ${brief.tier} "${brief.type}" template.
Vibe/brief: ${brief.vibe}${audienceLine}.${priceLine}${nameLine}
Return ONE JSON manifest only, matching the spec above.`;

  return { system, user };
}

// ── callClaude ────────────────────────────────────────────────────────────────

/**
 * THE PLUGGABLE MODEL CALL.
 *
 * When ANTHROPIC_API_KEY is set: makes a real HTTP request to
 *   https://api.anthropic.com/v1/messages
 * with model claude-sonnet-4-6 (or ANTHROPIC_MODEL env override).
 *
 * When the key is absent: returns a deterministic stub manifest string that
 * PASSES validateManifest + validateContentForType for the requested type.
 * A console.warn is emitted once per call so it is visible in server logs.
 */
export async function callClaude(
  system: string,
  user: string,
  brief: AITemplateBrief,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey) {
    // ── Real Claude call ──────────────────────────────────────────────────────
    const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "(could not read response body)");
      throw new Error(`Anthropic API error ${response.status}: ${errText}`);
    }

    const json = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = json?.content?.find((b) => b.type === "text")?.text ?? "";
    if (!text) throw new Error("Anthropic API returned no text content.");
    return text;
  }

  // ── Stub (no API key) ─────────────────────────────────────────────────────
  // eslint-disable-next-line no-console
  console.warn(
    "[template-ai] ANTHROPIC_API_KEY is not set — returning a deterministic stub manifest. " +
      "Set ANTHROPIC_API_KEY in .env.local to enable real Claude generation.",
  );
  return buildStubManifest(brief);
}

// ── generateTemplateManifest ──────────────────────────────────────────────────

/**
 * End-to-end pipeline:
 *   1. Build the prompt.
 *   2. Call the model (real or stub).
 *   3. Strip any accidental ```json fences from the response.
 *   4. Parse JSON.
 *   5. Run validateManifest + validateContentForType.
 *   6. Return the validated manifest, or errors + raw text for admin inspection.
 */
export async function generateTemplateManifest(brief: AITemplateBrief): Promise<
  | { ok: true; raw: string; manifest: TemplateManifest }
  | { ok: false; error: string; raw?: string }
> {
  let raw: string;

  try {
    const { system, user } = buildTemplatePrompt(brief);
    raw = await callClaude(system, user, brief);
  } catch (err) {
    return { ok: false, error: String(err) };
  }

  // Strip markdown code fences if present (defensive)
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    return {
      ok: false,
      error: `Model returned non-JSON output: ${String(parseErr)}`,
      raw: cleaned,
    };
  }

  // Validate envelope
  const envResult = validateManifest(parsed);
  if (!envResult.ok) {
    return {
      ok: false,
      error: `Manifest validation failed:\n${envResult.errors.join("\n")}`,
      raw: cleaned,
    };
  }

  // Validate content keys for type
  const contentResult = validateContentForType(envResult.manifest.type, envResult.manifest.content);
  if (!contentResult.ok) {
    return {
      ok: false,
      error: `Content validation failed:\n${contentResult.errors.join("\n")}`,
      raw: cleaned,
    };
  }

  return { ok: true, raw: cleaned, manifest: envResult.manifest };
}

// ── buildStubManifest ─────────────────────────────────────────────────────────
//
// Produces a manifest that PASSES validateManifest + validateContentForType for
// any type. For well-modeled types (website, store, bio, courses) the content
// blob is populated with real-looking on-brand copy derived from the brief's
// vibe. For other types a minimal but valid content object is emitted.

function buildStubManifest(brief: AITemplateBrief): string {
  const safeName =
    brief.name ??
    `${brief.vibe.split(/\s+/).slice(0, 3).join(" ")} — AI Draft`;
  const trimmedName = safeName.slice(0, 40);

  const vibe = brief.vibe;
  const audience = brief.audience ?? "professionals";

  let content: Record<string, unknown>;

  switch (brief.type) {
    case "website":
      content = buildWebsiteContent(vibe, audience);
      break;
    case "store":
      content = buildStoreContent(vibe, audience);
      break;
    case "bio":
      content = buildBioContent(vibe, audience);
      break;
    case "courses":
      content = buildCoursesContent(vibe, audience);
      break;
    default:
      content = buildGenericContent(brief.type, vibe, audience);
      break;
  }

  const manifest = {
    name: trimmedName,
    type: brief.type,
    tier: brief.tier,
    price_paise: brief.tier === "free" ? 0 : brief.price_paise,
    description: `${brief.tier === "premium" ? "Premium" : "Free"} ${brief.type} template: ${vibe}.`,
    tags: deriveTagsFromVibe(vibe, brief.type),
    thumbnail_url: "",
    theme: {},
    content,
  };

  return JSON.stringify(manifest, null, 2);
}

// ── Per-type stub content builders ────────────────────────────────────────────

function buildWebsiteContent(vibe: string, audience: string): Record<string, unknown> {
  return {
    site: vibe.split(/\s+/).slice(0, 4).join(" "),
    theme: "dark",
    accent: 0,
    font: "sora",
    pageWidth: "wide",
    bg: "auroraflow",
    btshape: "pill",
    anim: "rise",
    btnAnim: "shine",
    htitleGrad: true,
    nav: "c",
    sticky: true,
    cta: "Get started",
    ctaurl: "#cta",
    heroLayout: "center",
    heroEyebrow: `Built for ${audience}`,
    htitle: `${capitalise(vibe)}.`,
    hsub: `Everything you need to grow your ${audience.toLowerCase()} business.`,
    hb1: "Explore features",
    hb1url: "#features",
    hb2: "Start free",
    hb2url: "#cta",
    order: ["features", "stats", "testimonials", "faq", "cta"],
    sections: {
      features: true,
      stats: true,
      testimonials: true,
      faq: true,
      cta: true,
    },
    heads: {
      features: { title: "What you get", sub: "Everything in one place." },
      stats: { title: "By the numbers", sub: "" },
      testimonials: { title: "What clients say", sub: "" },
      faq: { title: "Questions answered", sub: "" },
      cta: { title: "Ready to begin?", sub: "" },
    },
    secStyle: { cta: "grad", features: "tint" },
    features: [
      { ic: "✦", t: "Fast setup", x: "Go live in minutes, not days." },
      { ic: "▲", t: "Beautiful design", x: "Looks great on every screen." },
      { ic: "◆", t: "Built to convert", x: "Copy and layout optimised for conversions." },
    ],
    stats: [
      { n: "10k+", l: "Customers" },
      { n: "4.9", l: "Avg rating" },
      { n: "99%", l: "Uptime" },
    ],
    testimonials: [
      {
        n: `Priya, ${capitalise(audience)}`,
        r: "Verified buyer",
        q: `This template completely transformed how we present ourselves online.`,
      },
    ],
    faq: [
      {
        q: "Is this template customisable?",
        a: "Yes — every colour, font, and section can be changed in the builder.",
      },
      {
        q: "Do I need coding skills?",
        a: "None at all. Everything is drag-and-drop in the visual studio.",
      },
    ],
  };
}

function buildStoreContent(vibe: string, audience: string): Record<string, unknown> {
  return {
    store: capitalise(vibe.split(/\s+/).slice(0, 3).join(" ")),
    tagline: `The best products for ${audience}.`,
    theme: "light",
    accent: 1,
    font: "poppins",
    btshape: "soft",
    pageWidth: "standard",
    order: ["banner", "brands"],
    sections: { banner: true, brands: false },
    heads: { banner: { title: `Shop for ${audience}`, sub: "" } },
    announce: `Free shipping on orders above ₹499`,
    display: "grid",
    cols: 3,
    footerPay: true,
    bottomNav: true,
  };
}

function buildBioContent(vibe: string, audience: string): Record<string, unknown> {
  return {
    name: capitalise(vibe.split(/\s+/).slice(0, 3).join(" ")),
    handle: vibe.split(/\s+/).slice(0, 2).join("_").toLowerCase(),
    bio: `${capitalise(vibe)} — helping ${audience} achieve more.`,
    verified: false,
    accent: 2,
    button_style: "solid",
    button_shape: "pill",
    bg: "mesh",
    socials: [],
    links: [
      { id: "1", label: "My website", url: "https://example.com", icon: "globe" },
      { id: "2", label: "Contact me", url: "mailto:hello@example.com", icon: "mail" },
    ],
    featured: [],
  };
}

function buildCoursesContent(vibe: string, audience: string): Record<string, unknown> {
  return {
    headline: `Master ${capitalise(vibe)}`,
    subheadline: `The complete course for ${audience}.`,
    description_html: `<p>This course teaches ${audience} everything they need to know about ${vibe}. Practical, hands-on, and designed for real results.</p>`,
    price: 1999,
    compare_at_price: 3999,
    currency: "INR",
    theme: "dark",
    accent: 0,
    instructor_name: "Your Name",
    instructor_bio: `Expert instructor with years of experience helping ${audience}.`,
    instructor_avatar: "",
    outcomes: [
      `Understand the fundamentals of ${vibe}`,
      "Apply techniques in real-world projects",
      "Build a portfolio that stands out",
    ],
    includes: ["Lifetime access", "Certificate of completion", "Community support"],
    category: vibe.split(/\s+/)[0] ?? "general",
    cta_label: "Enroll now",
    seo_title: `${capitalise(vibe)} Course — ${capitalise(audience)}`,
    seo_description: `Learn ${vibe} with this expert-led course for ${audience}.`,
    og_image: "",
  };
}

function buildGenericContent(type: string, vibe: string, audience: string): Record<string, unknown> {
  // Minimal valid content for types with no strict key allowlist
  return {
    title: `${capitalise(vibe)} — ${type}`,
    subtitle: `For ${audience}`,
    theme: "light",
    accent: 0,
  };
}

// ── Utility ───────────────────────────────────────────────────────────────────

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function deriveTagsFromVibe(vibe: string, type: string): string[] {
  const words = vibe
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 4);
  return [...new Set([...words, type])];
}
