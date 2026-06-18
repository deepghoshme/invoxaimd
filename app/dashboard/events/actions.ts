"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertNotImpersonating } from "@/lib/impersonation";
import { publicId } from "@/lib/ids";
import { DEFAULT_EVENT, type EventContent } from "@/lib/event";

type Result = { ok: boolean; error?: string };

async function ownerStore() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { sb, store: null as { id: string; subdomain: string | null } | null };
  const { data: store } = await sb
    .from("stores")
    .select("id, subdomain")
    .eq("owner_id", user.id)
    .maybeSingle();
  return { sb, store };
}

/**
 * Create a new event page (draft) and redirect to its builder.
 * Returns void (never) when successful — redirect() throws internally.
 * On failure (impersonating, no store, DB error) redirects to the list page.
 */
export async function createEventPage(): Promise<void> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) redirect("/dashboard/events");

  const { sb, store } = await ownerStore();
  if (!store) redirect("/dashboard/events");

  const pid = publicId(9);
  const { data, error } = await sb
    .from("pages")
    .insert({
      store_id: store.id,
      page_type: "event",
      public_id: pid,
      title: "New Event",
      content: DEFAULT_EVENT as unknown as Record<string, unknown>,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) redirect("/dashboard/events");
  revalidatePath("/dashboard/events");
  redirect(`/studio/event/${data.id}`);
}

/** Save event page content. */
export async function saveEventPage(
  pageId: string,
  content: EventContent,
): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Verify the page belongs to the signed-in user's store.
  const { data: store } = await sb
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) return { ok: false, error: "No store." };

  const { error } = await sb
    .from("pages")
    .update({ content: content as unknown as Record<string, unknown>, title: content.title || "Event" })
    .eq("id", pageId)
    .eq("store_id", store.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/events");
  return { ok: true };
}

/** Publish or unpublish an event page. */
export async function setEventStatus(
  pageId: string,
  status: "draft" | "published",
): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: store } = await sb
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) return { ok: false, error: "No store." };

  const { error } = await sb
    .from("pages")
    .update({
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .eq("id", pageId)
    .eq("store_id", store.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/events");
  revalidatePath("/dashboard");
  return { ok: true };
}
