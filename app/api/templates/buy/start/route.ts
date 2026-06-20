import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRazorpayOrder } from "@/lib/razorpay";
import { hasFeature } from "@/lib/plan-features.server";
import { TYPE_TO_PAGE, SINGLETON_PAGE_TYPES, type TemplateType, type PageTypeEnum } from "@/lib/templates-apply";

export const dynamic = "force-dynamic";

/**
 * POST /api/templates/buy/start
 *
 * Creates a Razorpay order on the PLATFORM gateway for a premium template purchase.
 * Mirrors the structure of /api/plans/subscribe/start exactly.
 *
 * Money-safety guarantees:
 * 1. Auth: user must be authenticated with an owned store.
 * 2. Template price is read from DB (templates.price_paise) — never from the client.
 * 3. Template must be published + premium (free templates must use applyTemplate directly).
 * 4. all_access templates reject here — no charge needed (plan feature unlocks them).
 * 5. Idempotency of the actual unlock is handled at /verify via the UNIQUE index on
 *    template_purchases (store_id, template_id, coalesce(page_id, zero-uuid)).
 * 6. Order notes contain kind/store_id/template_id/page_id/price_paise — server-set,
 *    client-untamperable. /verify re-fetches the order and binds to these notes,
 *    never to the request body.
 *
 * Returns: { razorpay_order_id, key_id, amount, currency, template_name }
 * or { ok: true, already: true } if the license already exists (nothing to buy).
 */
export async function POST(req: Request) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: { template_id?: string; page_type?: string; target_page_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { template_id, page_type, target_page_id } = body;
  if (!template_id || !page_type) {
    return NextResponse.json({ error: "Missing template_id or page_type" }, { status: 400 });
  }

  const admin = createAdminClient();

  // ── Resolve store ──────────────────────────────────────────────────────────
  const { data: store } = await admin
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) return NextResponse.json({ error: "No store found for your account." }, { status: 403 });
  const storeId = store.id as string;

  // ── Load template ──────────────────────────────────────────────────────────
  const { data: tmpl } = await admin
    .from("templates")
    .select("id, name, type, tier, price_paise, license_model, status")
    .eq("id", template_id)
    .maybeSingle();

  if (!tmpl) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  if ((tmpl as { status: string }).status !== "published") {
    return NextResponse.json({ error: "Template is not published." }, { status: 404 });
  }
  if ((tmpl as { tier: string }).tier !== "premium") {
    return NextResponse.json({ error: "Free templates do not require purchase." }, { status: 400 });
  }

  // ── all_access short-circuit ───────────────────────────────────────────────
  // all_access templates are unlocked by plan feature — no Razorpay order needed.
  if ((tmpl as { license_model: string }).license_model === "all_access") {
    const hasAccess = await hasFeature(storeId, "templates_all_access");
    if (hasAccess) {
      return NextResponse.json({ ok: true, already: true, reason: "all_access_plan" });
    }
    return NextResponse.json(
      { error: "This template is only available on the all-access plan." },
      { status: 403 },
    );
  }

  // ── Validate pageType ──────────────────────────────────────────────────────
  const mappedPageType = TYPE_TO_PAGE[(tmpl as { type: string }).type as TemplateType];
  if (mappedPageType === null || mappedPageType === undefined) {
    return NextResponse.json({ error: `Template type '${(tmpl as { type: string }).type}' cannot be applied to a page.` }, { status: 400 });
  }
  if (mappedPageType !== page_type) {
    return NextResponse.json(
      { error: `Template type maps to '${mappedPageType}' but '${page_type}' was requested.` },
      { status: 400 },
    );
  }

  const resolvedPageType = page_type as PageTypeEnum;
  const licenseModel = (tmpl as { license_model: string }).license_model as "per_store" | "per_page";
  const pricePaise = (tmpl as { price_paise: number }).price_paise;

  if (!pricePaise || pricePaise <= 0) {
    return NextResponse.json({ error: "Template has no price configured." }, { status: 400 });
  }

  // ── Resolve target page & license slot ────────────────────────────────────
  // For per_store the DB page_id is NULL; for per_page it's the specific page UUID.
  let licensePageId: string | null = null;

  if (licenseModel === "per_page") {
    // Resolve the target page to get its UUID for the license slot.
    if (SINGLETON_PAGE_TYPES.has(resolvedPageType)) {
      // Singleton: find or create.
      const { data: existing } = await admin
        .from("pages")
        .select("id")
        .eq("store_id", storeId)
        .eq("page_type", resolvedPageType)
        .maybeSingle();

      if (existing) {
        licensePageId = (existing as { id: string }).id;
      } else {
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
          .select("id")
          .single();
        if (createErr || !created) {
          return NextResponse.json({ error: "Failed to resolve target page." }, { status: 500 });
        }
        licensePageId = (created as { id: string }).id;
      }
    } else {
      // Many-type: targetPageId must be supplied.
      if (!target_page_id) {
        return NextResponse.json(
          { error: `A target_page_id is required for page type '${resolvedPageType}'.` },
          { status: 400 },
        );
      }
      const { data: page } = await admin
        .from("pages")
        .select("id, store_id, page_type")
        .eq("id", target_page_id)
        .maybeSingle();
      if (!page) return NextResponse.json({ error: "Target page not found." }, { status: 404 });
      if ((page as { store_id: string }).store_id !== storeId) {
        return NextResponse.json({ error: "You do not own this page." }, { status: 403 });
      }
      if ((page as { page_type: string }).page_type !== resolvedPageType) {
        return NextResponse.json({ error: "Target page type does not match template type." }, { status: 400 });
      }
      licensePageId = (page as { id: string }).id;
    }
  }
  // per_store: licensePageId stays null.

  // ── Check already-owned ────────────────────────────────────────────────────
  {
    let query = admin
      .from("template_purchases")
      .select("id")
      .eq("store_id", storeId)
      .eq("template_id", template_id);

    if (licensePageId === null) {
      query = query.is("page_id", null);
    } else {
      query = query.eq("page_id", licensePageId);
    }

    const { data: existing } = await query.maybeSingle();
    if (existing) {
      // Already owned — no charge needed; client should just apply.
      return NextResponse.json({ ok: true, already: true });
    }
  }

  // ── Platform gateway ───────────────────────────────────────────────────────
  const { data: gw } = await admin
    .from("platform_gateways")
    .select("key_id, key_secret, is_enabled")
    .eq("id", true)
    .maybeSingle();

  if (!gw || !(gw as { is_enabled: boolean }).is_enabled || !(gw as { key_id: string }).key_id || !(gw as { key_secret: string }).key_secret) {
    return NextResponse.json(
      { error: "Platform payments are not set up. Please contact the admin." },
      { status: 503 },
    );
  }

  // ── Create Razorpay order ──────────────────────────────────────────────────
  // Notes are server-set and client-untamperable. /verify re-fetches this order
  // and binds template_id, page_id, and price from these notes — NEVER from the
  // client body. This prevents a pay-cheap-activate-expensive swap.
  //
  // notes.page_id is stored as a string (empty string when null/per_store) because
  // Razorpay notes values must be strings.
  try {
    const rp = await createRazorpayOrder(
      { keyId: (gw as { key_id: string }).key_id, keySecret: (gw as { key_secret: string }).key_secret },
      {
        amount: pricePaise,
        currency: "INR",
        receipt: `tmpl_${template_id}`.slice(0, 40),
        notes: {
          kind: "template",
          store_id: storeId,
          template_id: template_id,
          page_id: licensePageId ?? "",        // "" means per_store (null page_id slot)
          price_paise: String(pricePaise),      // stringified; re-validated at /verify
          license_model: licenseModel,
          page_type: page_type,
        },
      },
    );

    return NextResponse.json({
      razorpay_order_id: rp.id,
      key_id: (gw as { key_id: string }).key_id,
      amount: pricePaise,
      currency: "INR",
      template_name: (tmpl as { name: string }).name,
    });
  } catch {
    return NextResponse.json(
      { error: "Couldn't start the payment. Please try again." },
      { status: 502 },
    );
  }
}
