"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateManifest, validateContentForType } from "@/lib/template-manifest";
import type { TemplateType, TemplateManifest } from "@/lib/template-manifest";

// Re-export types so consumers can import from here.
export type { TemplateType, TemplateManifest };

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

// ── Admin guard ───────────────────────────────────────────────────────────────
//
// Mirrors the pattern used in app/admin/emails/actions.ts.
// We use createClient() (user session) to verify the user_roles row, which is
// RLS-scoped and cannot be spoofed by a non-admin JWT.

async function requireAdmin(): Promise<
  | { ok: true; userId: string; email: string | undefined }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) return { ok: false, error: "Admin access required." };
  return { ok: true, userId: user.id, email: user.email };
}

// ── Row / input types ─────────────────────────────────────────────────────────

export type TemplateRow = {
  id: string;
  name: string;
  type: string;
  tier: string;
  price_paise: number;
  thumbnail_url: string | null;
  description: string | null;
  status: string;
  sales_count: number;
  created_at: string;
  // Extended fields (present after Phase C migration)
  slug?: string | null;
  tags?: string[] | null;
  license_model?: string | null;
  content?: Record<string, unknown> | null;
  theme?: Record<string, unknown> | null;
  demo_page_id?: string | null;
  version?: number | null;
};

export type TemplateInput = {
  name: string;
  type: string;
  tier: string;
  price_paise: number;
  thumbnail_url: string;
  description: string;
  status: string;
  // Extended fields
  slug?: string | null;
  tags?: string[] | null;
  license_model?: string | null;
  content?: Record<string, unknown> | null;
  theme?: Record<string, unknown> | null;
  demo_page_id?: string | null;
};

// ── listTemplates ─────────────────────────────────────────────────────────────

/** Fetch all templates (admin can see all statuses). Degrades gracefully if the table doesn't exist yet. */
export async function listTemplates(): Promise<{ rows: TemplateRow[]; migrationMissing: boolean }> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("templates")
    .select(
      "id, name, type, tier, price_paise, thumbnail_url, description, status, sales_count, created_at, " +
      "slug, tags, license_model, content, theme, demo_page_id, version"
    )
    .order("created_at", { ascending: false });

  if (error) {
    // 42P01 = undefined_table (pre-migration). Only treat truly missing table as
    // migrationMissing; surface all other errors so they aren't hidden.
    const genuinelyMissing =
      error.code === "42P01" ||
      (error.message?.toLowerCase().includes("does not exist") &&
        error.message?.toLowerCase().includes("relation"));
    if (genuinelyMissing) {
      return { rows: [], migrationMissing: true };
    }
    // Column doesn't exist yet (extended columns not migrated) — fall back to base columns.
    if (error.message?.toLowerCase().includes("column") || error.code === "42703") {
      const { data: base, error: baseErr } = await sb
        .from("templates")
        .select("id, name, type, tier, price_paise, thumbnail_url, description, status, sales_count, created_at")
        .order("created_at", { ascending: false });
      if (baseErr) {
        console.error("[admin/templates] listTemplates base fallback error:", baseErr.message);
        throw new Error(baseErr.message);
      }
      return { rows: (base ?? []) as unknown as TemplateRow[], migrationMissing: false };
    }
    console.error("[admin/templates] listTemplates error:", error.message, error.code);
    throw new Error(error.message);
  }
  return { rows: (data ?? []) as unknown as TemplateRow[], migrationMissing: false };
}

// ── createTemplate ────────────────────────────────────────────────────────────

export async function createTemplate(): Promise<Result<{ id: string }>> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("templates")
    .insert({ name: "New template", type: "bio", tier: "free", status: "draft" })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/templates");
  return { ok: true, data: { id: (data as { id: string }).id } };
}

// ── updateTemplate ────────────────────────────────────────────────────────────

export async function updateTemplate(id: string, input: TemplateInput): Promise<Result> {
  const sb = await createClient();

  // Build the base update payload (always present columns)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = {
    name: input.name.trim() || "Template",
    type: input.type,
    tier: input.tier,
    price_paise: input.tier === "premium" ? Math.max(0, Number(input.price_paise) || 0) : 0,
    thumbnail_url: input.thumbnail_url.trim() || null,
    description: input.description.trim() || null,
    status: input.status,
  };

  // Extended columns (optional — only set if provided)
  if (input.slug !== undefined) {
    payload.slug = input.slug?.trim() || null;
  }
  if (input.tags !== undefined) {
    payload.tags = (input.tags ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean);
  }
  if (input.license_model !== undefined) {
    payload.license_model = input.license_model || "per_store";
  }
  if (input.content !== undefined) {
    payload.content = input.content ?? {};
  }
  if (input.theme !== undefined) {
    payload.theme = input.theme ?? {};
  }
  if (input.demo_page_id !== undefined) {
    payload.demo_page_id = input.demo_page_id || null;
  }

  const { error } = await sb.from("templates").update(payload).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/templates");
  return { ok: true };
}

// ── deleteTemplate ────────────────────────────────────────────────────────────

export async function deleteTemplate(id: string): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb.from("templates").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/templates");
  return { ok: true };
}

// ── toggleTemplateStatus ──────────────────────────────────────────────────────

export async function toggleTemplateStatus(id: string, current: string): Promise<Result> {
  const next = current === "published" ? "draft" : "published";
  const sb = await createClient();
  const { error } = await sb.from("templates").update({ status: next }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/templates");
  return { ok: true };
}

// ── importManifest ────────────────────────────────────────────────────────────

/**
 * Parse a JSON manifest string (or pre-parsed object), validate it against the
 * TemplateManifest schema + the type-specific content allowlist, then INSERT a
 * new templates row.
 *
 * @param raw   - JSON string or pre-parsed manifest object.
 * @param opts  - Optional options bag.
 * @param opts.publish - When true, inserts with status='published'; default (false/omitted) = 'draft'.
 *
 * ADMIN-ONLY.
 */
export async function importManifest(
  raw: string | object,
  opts?: { publish?: boolean },
): Promise<{ ok: true; id: string } | { ok: false; errors: string[] }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, errors: [guard.error] };

  // 1. Parse JSON if given a string
  let parsed: unknown;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, errors: ["Invalid JSON: could not parse the manifest string."] };
    }
  } else {
    parsed = raw;
  }

  // 2. Validate the envelope
  const envResult = validateManifest(parsed);
  if (!envResult.ok) {
    return { ok: false, errors: envResult.errors };
  }
  const manifest = envResult.manifest;

  // 3. Validate content keys for the type
  const contentResult = validateContentForType(manifest.type, manifest.content);
  if (!contentResult.ok) {
    return { ok: false, errors: contentResult.errors };
  }

  // 4. INSERT a template row (draft by default; published when opts.publish === true)
  const status = opts?.publish === true ? "published" : "draft";
  const sb = await createClient();
  const { data, error } = await sb
    .from("templates")
    .insert({
      name: manifest.name,
      type: manifest.type,
      tier: manifest.tier,
      price_paise: manifest.price_paise,
      description: manifest.description || null,
      thumbnail_url: manifest.thumbnail_url || null,
      tags: manifest.tags,
      theme: manifest.theme,
      content: manifest.content,
      status,
      license_model: "per_store",
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, errors: [error.message] };
  }

  revalidatePath("/admin/templates");
  return { ok: true, id: (data as { id: string }).id };
}

// ── saveStorePageAsTemplate ───────────────────────────────────────────────────

/**
 * Read a pages row's content and save it as a new draft template.
 * This is the "Save as template" / export-from-studio path.
 *
 * ADMIN-ONLY.
 *
 * The page's content blob becomes template.content.
 * theme is left {} because website-style content carries theme tokens inline.
 */
export async function saveStorePageAsTemplate(input: {
  pageId: string;
  name: string;
  type: TemplateType;
  tier: "free" | "premium";
  price_paise: number;
  license_model: "per_store" | "per_page" | "all_access";
  tags: string[];
  slug?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  if (!input.pageId?.trim()) return { ok: false, error: "pageId is required." };
  if (!input.name?.trim()) return { ok: false, error: "name is required." };

  // Use admin client to read the pages row (bypasses RLS — admin action)
  const adminSb = createAdminClient();
  const { data: page, error: pageErr } = await adminSb
    .from("pages")
    .select("id, page_type, content")
    .eq("id", input.pageId)
    .single();

  if (pageErr || !page) {
    return { ok: false, error: pageErr?.message ?? "Page not found." };
  }

  const pageContent = (page.content ?? {}) as Record<string, unknown>;

  // Light content validation for the template type
  const contentResult = validateContentForType(input.type, pageContent);
  if (!contentResult.ok) {
    // Don't hard-reject when saving from studio — warn but still allow
    console.warn("[admin/templates] saveStorePageAsTemplate content warnings:", contentResult.errors);
  }

  // Validate price_paise rule
  if (input.tier === "free" && input.price_paise !== 0) {
    return { ok: false, error: 'price_paise must be 0 when tier is "free".' };
  }

  const usingSb = await createClient();
  const { data, error } = await usingSb
    .from("templates")
    .insert({
      name: input.name.trim(),
      type: input.type,
      tier: input.tier,
      price_paise: input.price_paise,
      description: null,
      thumbnail_url: null,
      tags: (input.tags ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean),
      theme: {},
      content: pageContent,
      status: "draft",
      license_model: input.license_model,
      slug: input.slug?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/templates");
  return { ok: true, id: (data as { id: string }).id };
}

// ── templateSalesStats ────────────────────────────────────────────────────────

/**
 * Per-template revenue analytics for the admin template manager.
 *
 * Source: template_purchases WHERE source IN ('wallet','razorpay').
 * We use template_purchases as the SINGLE source for both rails here because
 * every paid purchase (wallet or razorpay) writes a template_purchases row with
 * source set accordingly. This gives us template_id + price_paise in one table,
 * which wallet_ledger does not have (ledger rows don't carry template_id).
 * NOTE: the /admin/revenue TOTAL uses wallet_ledger for wallet-rail to avoid
 * double-counting against the broader ledger; per-template analytics is a separate
 * aggregation that simply counts template_purchases once per purchase row.
 *
 * ADMIN-ONLY.
 */
export type TemplateSalesStat = {
  template_id: string;
  sales_count: number;
  revenue_paise: number;
  wallet_count: number;
  razorpay_count: number;
};

export async function templateSalesStats(): Promise<
  { ok: true; stats: TemplateSalesStat[] } | { ok: false; error: string }
> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const adminSb = createAdminClient();
  const { data, error } = await adminSb
    .from("template_purchases")
    .select("template_id, price_paise, source")
    .in("source", ["wallet", "razorpay"]);

  if (error) {
    // Graceful degradation if template_purchases table not yet applied
    if (
      error.code === "42P01" ||
      (error.message?.toLowerCase().includes("does not exist") &&
        error.message?.toLowerCase().includes("relation"))
    ) {
      return { ok: true, stats: [] };
    }
    return { ok: false, error: error.message };
  }

  // Aggregate in JS — avoids a raw SQL RPC and keeps this compatible with PostgREST
  const map = new Map<string, TemplateSalesStat>();
  for (const row of data ?? []) {
    const tid = row.template_id as string;
    const paise = Number((row as { price_paise?: number }).price_paise ?? 0);
    const src = (row as { source?: string }).source ?? "wallet";
    if (!map.has(tid)) {
      map.set(tid, { template_id: tid, sales_count: 0, revenue_paise: 0, wallet_count: 0, razorpay_count: 0 });
    }
    const s = map.get(tid)!;
    s.sales_count += 1;
    s.revenue_paise += paise;
    if (src === "razorpay") s.razorpay_count += 1;
    else s.wallet_count += 1;
  }

  return { ok: true, stats: Array.from(map.values()) };
}

// ── generateTemplateWithAI ────────────────────────────────────────────────────

/**
 * Admin-only: generate a template manifest via AI (real Claude call when
 * ANTHROPIC_API_KEY is set; deterministic stub otherwise).
 *
 * Returns the generated manifest + raw text for admin review/edit.
 * Does NOT save — the admin reviews then calls importManifest to save.
 *
 * ADMIN-ONLY (requireAdmin guard).
 */
export async function generateTemplateWithAI(brief: {
  type: string;
  vibe: string;
  audience?: string;
  tier: string;
  price_paise: number;
  license_model: string;
  name?: string;
}): Promise<
  | { ok: true; manifest: TemplateManifest; raw: string; isStub: boolean }
  | { ok: false; error: string; raw?: string }
> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  // Input validation
  const VALID_TYPES = new Set([
    "bio", "store", "product", "courses", "booking",
    "event", "payment", "lead", "website", "checkout", "vip",
  ]);
  const VALID_TIERS = new Set(["free", "premium"]);
  const VALID_LICENSE = new Set(["per_store", "per_page", "all_access"]);

  if (!brief.type || !VALID_TYPES.has(brief.type)) {
    return { ok: false, error: `Invalid type: "${brief.type}".` };
  }
  if (!brief.vibe || typeof brief.vibe !== "string" || brief.vibe.trim().length < 3) {
    return { ok: false, error: "vibe must be at least 3 characters." };
  }
  if (!VALID_TIERS.has(brief.tier)) {
    return { ok: false, error: `Invalid tier: "${brief.tier}".` };
  }
  const pricePaise = Number(brief.price_paise);
  if (!Number.isInteger(pricePaise) || pricePaise < 0) {
    return { ok: false, error: "price_paise must be a non-negative integer." };
  }
  if (brief.tier === "free" && pricePaise !== 0) {
    return { ok: false, error: 'price_paise must be 0 when tier is "free".' };
  }
  if (brief.license_model && !VALID_LICENSE.has(brief.license_model)) {
    return { ok: false, error: `Invalid license_model: "${brief.license_model}".` };
  }

  const { generateTemplateManifest } = await import("@/lib/template-ai");

  const result = await generateTemplateManifest({
    type: brief.type as TemplateType,
    vibe: brief.vibe.trim(),
    audience: brief.audience?.trim() || undefined,
    tier: brief.tier as "free" | "premium",
    price_paise: pricePaise,
    license_model: (brief.license_model || "per_store") as "per_store" | "per_page" | "all_access",
    name: brief.name?.trim() || undefined,
  });

  if (!result.ok) {
    return { ok: false, error: result.error, raw: result.raw };
  }

  const isStub = !process.env.ANTHROPIC_API_KEY;
  return { ok: true, manifest: result.manifest, raw: result.raw, isStub };
}

// ── exportTemplateManifest ────────────────────────────────────────────────────

/**
 * Return a template's content as a downloadable manifest JSON.
 * Useful for git-versioning templates.
 *
 * ADMIN-ONLY.
 */
export async function exportTemplateManifest(
  id: string,
): Promise<
  | { ok: true; manifest: Record<string, unknown>; filename: string }
  | { ok: false; error: string }
> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const sb = await createClient();
  const { data, error } = await sb
    .from("templates")
    .select(
      "name, type, tier, price_paise, description, tags, thumbnail_url, theme, content, slug, license_model, version"
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Template not found." };
  }

  const row = data as Record<string, unknown>;

  // Build the canonical manifest envelope (§1 fields only)
  const manifest: Record<string, unknown> = {
    name: row.name,
    type: row.type,
    tier: row.tier,
    price_paise: row.price_paise,
    description: row.description ?? "",
    tags: row.tags ?? [],
    thumbnail_url: row.thumbnail_url ?? "",
    theme: row.theme ?? {},
    content: row.content ?? {},
  };

  // Derive a safe filename: <slug|name>-<type>-template.json
  const base = ((row.slug ?? row.name) as string)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filename = `${base}-${row.type}-template.json`;

  return { ok: true, manifest, filename };
}

