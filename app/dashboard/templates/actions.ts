"use server";

/**
 * Template apply engine — server action.
 *
 * Phase B of docs/PREMIUM-TEMPLATES-PLAN.md.
 *
 * Only exports:
 *   applyTemplate(templateId, { pageType, targetPageId? }) — main entry point.
 *   hasTemplateLicense(storeId, template, pageId?)         — reused by Phase E purchase flow.
 *
 * Auth + store-resolution pattern copied from
 *   app/dashboard/pages/products/actions.ts → `ownerStore()`.
 * Feature-key resolver: lib/plan-features.server.ts → `hasFeature()`.
 * Admin DB client: lib/supabase/admin.ts → `createAdminClient()`.
 * Seller session client: lib/supabase/server.ts → `createClient()`.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasFeature } from "@/lib/plan-features.server";
import { publicId } from "@/lib/ids";
import {
  TYPE_TO_PAGE,
  SINGLETON_PAGE_TYPES,
  STUDIO_ROUTE,
  mergeTemplateIntoContent,
  type TemplateType,
  type PageTypeEnum,
} from "@/lib/templates-apply";

// ── Internal types ────────────────────────────────────────────────────────────

/** Shape of a row from the templates table that we need. */
type TemplateRow = {
  id: string;
  type: string;
  tier: "free" | "premium";
  price_paise: number;
  license_model: "per_store" | "per_page" | "all_access";
  status: string;
  content: Record<string, unknown>;
  theme: Record<string, unknown>;
};

/** Slim page row we need for the merge + ownership check. */
type PageRow = {
  id: string;
  store_id: string;
  page_type: string;
  content: Record<string, unknown>;
  public_id: string | null;
};

// ── Auth + store resolution (pattern from products/actions.ts ownerStore) ─────

async function getAuthedStore(): Promise<{ storeId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!store) return { error: "No store found for this account." };
  return { storeId: store.id as string };
}

// ── License guard ─────────────────────────────────────────────────────────────

/**
 * Check whether a store already owns a license to apply this template.
 *
 * Called from applyTemplate (Phase B) and re-used from the Phase E purchase
 * confirmation action (after a purchase row has been recorded).
 *
 * @param storeId    The seller's store UUID.
 * @param template   The loaded template row (needs id, tier, license_model, price_paise).
 * @param pageId     The resolved target page UUID (required only for per_page license checks).
 */
export async function hasTemplateLicense(
  storeId: string,
  template: Pick<TemplateRow, "id" | "tier" | "license_model" | "price_paise">,
  pageId?: string,
): Promise<{ licensed: boolean; needsPurchase?: boolean; price_paise?: number; license_model?: string }> {
  // Free templates are always licensed.
  if (template.tier === "free") return { licensed: true };

  const admin = createAdminClient();

  switch (template.license_model) {
    case "all_access": {
      // Unlocked by the active plan's feature_keys (or per-seller override).
      // Uses lib/plan-features.server.ts hasFeature — no purchase row needed.
      const ok = await hasFeature(storeId, "templates_all_access");
      if (ok) return { licensed: true };
      // Fall through to needs-purchase signal if not on an all_access plan.
      return {
        licensed: false,
        needsPurchase: true,
        price_paise: template.price_paise,
        license_model: template.license_model,
      };
    }

    case "per_store": {
      // One purchase row per (store_id, template_id) — page_id IS NULL (zero sentinel).
      const { data } = await admin
        .from("template_purchases")
        .select("id")
        .eq("store_id", storeId)
        .eq("template_id", template.id)
        .is("page_id", null)
        .maybeSingle();

      if (data) return { licensed: true };
      return {
        licensed: false,
        needsPurchase: true,
        price_paise: template.price_paise,
        license_model: template.license_model,
      };
    }

    case "per_page": {
      if (!pageId) {
        // Can't check without a page — treat as not licensed; Phase E will resolve.
        return {
          licensed: false,
          needsPurchase: true,
          price_paise: template.price_paise,
          license_model: template.license_model,
        };
      }
      // One purchase row per (store_id, template_id, page_id).
      const { data } = await admin
        .from("template_purchases")
        .select("id")
        .eq("store_id", storeId)
        .eq("template_id", template.id)
        .eq("page_id", pageId)
        .maybeSingle();

      if (data) return { licensed: true };
      return {
        licensed: false,
        needsPurchase: true,
        price_paise: template.price_paise,
        license_model: template.license_model,
      };
    }

    default:
      // Unknown license_model — deny by default (money-safe).
      return {
        licensed: false,
        needsPurchase: true,
        price_paise: template.price_paise,
        license_model: template.license_model,
      };
  }
}

// ── Main action ───────────────────────────────────────────────────────────────

type ApplyInput = {
  /** The page_type this template should apply to (must match templates.type mapping). */
  pageType: PageTypeEnum;
  /**
   * Required for many-type pages (opp/pay/book/ldf/vpc/env).
   * Omit for singleton types (website/store/bio/courses) — they are auto-resolved.
   */
  targetPageId?: string;
};

type ApplyResult =
  | { ok: true; pageId: string; pageType: PageTypeEnum; redirect: string }
  | { ok: false; error: string }
  | { ok: false; needsPurchase: true; price_paise: number; license_model: string; error: string };

/**
 * Apply a template's design into a seller's page.
 *
 * Steps (see §4 of PREMIUM-TEMPLATES-PLAN.md):
 *  1. Load template; assert published and type-compatible.
 *  2. Auth + resolve seller's store.
 *  3. Resolve or create the target page.
 *  4. License check (premium only).
 *  5. Merge template.content + theme over existing content (keep-whitelist applied).
 *  6. Write pages row (content + template_id + is_premium). Never touches seo/pixels.
 *  7. Return redirect URL into the appropriate studio builder.
 *
 * Money-safety notes:
 *  - Template content is loaded from the DB, never from the client.
 *  - Ownership is verified via the user's authenticated session before any write.
 *  - The license guard runs server-side; the client gets only a needsPurchase signal.
 *  - seo and pixels columns are NEVER overwritten (they are separate JSONB columns).
 *  - sales_count is NOT incremented here (Phase E purchase flow only).
 */
export async function applyTemplate(
  templateId: string,
  input: ApplyInput,
): Promise<ApplyResult> {
  const admin = createAdminClient();

  // ── 1. Load and validate template ─────────────────────────────────────────

  const { data: tmpl, error: tmplErr } = await admin
    .from("templates")
    .select("id, type, tier, price_paise, license_model, status, content, theme")
    .eq("id", templateId)
    .maybeSingle();

  if (tmplErr || !tmpl) {
    return { ok: false, error: "Template not found." };
  }

  const template = tmpl as TemplateRow;

  if (template.status !== "published") {
    return { ok: false, error: "Template is not published." };
  }

  // Validate template type against the requested pageType.
  const templateType = template.type as TemplateType;

  // 'checkout' type has no page mapping — block explicitly.
  if (templateType === "checkout") {
    return { ok: false, error: "checkout templates are not page-applicable." };
  }

  const mappedPageType = TYPE_TO_PAGE[templateType];
  if (mappedPageType === null || mappedPageType === undefined) {
    return { ok: false, error: `Template type '${template.type}' cannot be applied to a page.` };
  }

  if (mappedPageType !== input.pageType) {
    return {
      ok: false,
      error: `Template type '${template.type}' maps to page type '${mappedPageType}' but '${input.pageType}' was requested.`,
    };
  }

  const resolvedPageType = input.pageType;

  // ── 2. Auth + store resolution ────────────────────────────────────────────

  const storeResult = await getAuthedStore();
  if ("error" in storeResult) {
    return { ok: false, error: storeResult.error };
  }
  const { storeId } = storeResult;

  // ── 3. Resolve or create the target page ─────────────────────────────────

  let targetPage: PageRow;

  if (SINGLETON_PAGE_TYPES.has(resolvedPageType)) {
    // Singleton: find or create the store's one page of this type.
    const { data: existing } = await admin
      .from("pages")
      .select("id, store_id, page_type, content, public_id")
      .eq("store_id", storeId)
      .eq("page_type", resolvedPageType)
      .maybeSingle();

    if (existing) {
      targetPage = existing as PageRow;
    } else {
      // Create a draft singleton page.
      const { data: created, error: createErr } = await admin
        .from("pages")
        .insert({
          store_id: storeId,
          page_type: resolvedPageType,
          title: resolvedPageType.charAt(0).toUpperCase() + resolvedPageType.slice(1),
          status: "draft",
          content: {},
          seo: {},
          pixels: {},
        })
        .select("id, store_id, page_type, content, public_id")
        .single();

      if (createErr || !created) {
        return { ok: false, error: "Failed to create page: " + (createErr?.message ?? "unknown error") };
      }
      targetPage = created as PageRow;
    }
  } else {
    // Many-type: targetPageId is required.
    if (!input.targetPageId) {
      return {
        ok: false,
        error: `A targetPageId is required for page type '${resolvedPageType}'.`,
      };
    }

    const { data: existing } = await admin
      .from("pages")
      .select("id, store_id, page_type, content, public_id")
      .eq("id", input.targetPageId)
      .maybeSingle();

    if (!existing) {
      return { ok: false, error: "Target page not found." };
    }

    const existingPage = existing as PageRow;

    // Ownership: the page must belong to this store.
    if (existingPage.store_id !== storeId) {
      return { ok: false, error: "You do not own this page." };
    }

    // Type match: the page must be the right type.
    if (existingPage.page_type !== resolvedPageType) {
      return {
        ok: false,
        error: `Page type mismatch: page is '${existingPage.page_type}', template requires '${resolvedPageType}'.`,
      };
    }

    targetPage = existingPage;
  }

  // ── 4. License check (premium only) ──────────────────────────────────────

  const licenseResult = await hasTemplateLicense(storeId, template, targetPage.id);

  if (!licenseResult.licensed) {
    return {
      ok: false,
      needsPurchase: true,
      price_paise: licenseResult.price_paise ?? template.price_paise,
      license_model: licenseResult.license_model ?? template.license_model,
      error: "Purchase required to apply this template.",
    };
  }

  // ── 5. Merge template content over existing (keep-whitelist applied) ──────

  const existingContent = (targetPage.content ?? {}) as Record<string, unknown>;
  const templateContent = (template.content ?? {}) as Record<string, unknown>;
  const templateTheme = (template.theme ?? {}) as Record<string, unknown>;

  const merged = mergeTemplateIntoContent(
    templateContent,
    templateTheme,
    existingContent,
    resolvedPageType,
  );

  // ── 6. Write to pages (never touch seo or pixels columns) ─────────────────

  const { error: updateErr } = await admin
    .from("pages")
    .update({
      content: merged,
      template_id: String(templateId),
      is_premium: template.tier === "premium",
      updated_at: new Date().toISOString(),
    })
    .eq("id", targetPage.id);

  if (updateErr) {
    return { ok: false, error: "Failed to apply template: " + updateErr.message };
  }

  // ── 7. Return success with studio redirect URL ────────────────────────────

  const redirect = STUDIO_ROUTE[resolvedPageType](targetPage.id);

  return {
    ok: true,
    pageId: targetPage.id,
    pageType: resolvedPageType,
    redirect,
  };
}
