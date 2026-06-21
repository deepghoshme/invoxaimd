"use server";

/**
 * Page Builder v6 — persistence server actions (Phase 5).
 * v6 pages reuse public.pages: Section[] + meta in pages.content under
 * content.v = 6; theme/bg/title/slug/status in canonical columns. All writes
 * go through the user session (RLS enforces tenant isolation) and the
 * impersonation guard. Legacy rows (content.v absent) are never touched.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertNotImpersonating } from "@/lib/impersonation";
import { createSection } from "@/lib/builder/registry";
import { DEFAULT_THEME_ID } from "@/lib/builder/themes";
import type { PageDoc, PageType, Section } from "@/lib/builder/types";

type LoadResult = { ok: boolean; doc?: PageDoc; error?: string };
type SaveResult = { ok: boolean; error?: string };

// v6 page types → existing public.page_type enum.
const PAGE_TYPE_DB: Record<PageType, string> = {
  landing: "opp",
  opp: "opp",
  vip: "vpc",
  lead: "ldf",
  event: "env",
  booking: "book",
  courses: "courses",
  website: "website",
};

const ROW_COLS = "id, slug, title, content, theme_id, page_bg, status, updated_at";

function starterSections(): Section[] {
  return [
    createSection("navbar"),
    createSection("hero"),
    createSection("features"),
    createSection("pricing"),
    createSection("faq"),
    createSection("footer"),
  ];
}

function rowToDoc(row: Record<string, unknown>, userId: string, type: PageType): PageDoc {
  const content = (row.content ?? {}) as Record<string, unknown>;
  return {
    id: String(row.id),
    ownerId: userId,
    type: (content.type as PageType) ?? type,
    slug: (row.slug as string) ?? "untitled",
    title: (row.title as string) ?? "Untitled page",
    themeId: (row.theme_id as string) ?? DEFAULT_THEME_ID,
    pageBg: (row.page_bg as PageDoc["pageBg"]) ?? "none",
    sections: Array.isArray(content.sections) ? (content.sections as Section[]) : [],
    mobileCta: content.mobileCta as PageDoc["mobileCta"],
    status: (row.status as PageDoc["status"]) ?? "draft",
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

/**
 * Resolve the seller's v6 page of a given type, creating a starter draft on
 * first visit. Returns a fully-hydrated PageDoc with a real (persisted) id.
 */
export async function ensureV6Page(type: PageType): Promise<LoadResult> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data: store } = await sb.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
  if (!store) return { ok: false, error: "No store." };

  const dbType = PAGE_TYPE_DB[type];
  const { data: rows } = await sb
    .from("pages")
    .select(ROW_COLS)
    .eq("store_id", store.id)
    .eq("page_type", dbType)
    .order("updated_at", { ascending: false });
  const existing = (rows ?? []).find((r) => (r.content as Record<string, unknown>)?.v === 6);
  if (existing) return { ok: true, doc: rowToDoc(existing, user.id, type) };

  // No v6 page yet — seed a starter draft. Guard the write.
  const guard = await assertNotImpersonating();
  if (!guard.ok) return { ok: false, error: guard.error };
  const content = { v: 6, type, sections: starterSections() };
  const { data, error } = await sb
    .from("pages")
    .insert({ store_id: store.id, page_type: dbType, slug: `v6-${type}`, title: "Untitled page", template_id: "v6", content, theme_id: DEFAULT_THEME_ID, page_bg: "none", status: "draft" })
    .select(ROW_COLS)
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, doc: rowToDoc(data, user.id, type) };
}

/** Save (and optionally publish/unpublish) a v6 page by id. */
export async function saveV6Page(doc: PageDoc, publish?: boolean): Promise<SaveResult> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return { ok: false, error: guard.error };
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const content = { v: 6, type: doc.type, sections: doc.sections ?? [], mobileCta: doc.mobileCta };
  const patch: Record<string, unknown> = {
    content,
    title: doc.title || "Untitled page",
    theme_id: doc.themeId,
    page_bg: doc.pageBg,
  };
  if (publish !== undefined) {
    patch.status = publish ? "published" : "draft";
    patch.published_at = publish ? new Date().toISOString() : null;
  }
  // RLS restricts the update to rows owned by the caller's store.
  const { error } = await sb.from("pages").update(patch).eq("id", doc.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/studio/v6");
  return { ok: true };
}
