"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { publicId } from "@/lib/ids";
import { assertNotImpersonating } from "@/lib/impersonation";

type Result = { ok: boolean; error?: string; id?: string };

async function ownerStore() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, store: null as { id: string } | null };
  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  return { supabase, store };
}

/**
 * Create a new draft booking page; returns its id for redirect to the studio.
 */
export async function createBookingPage(): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const { supabase, store } = await ownerStore();
  if (!store) return { ok: false, error: "No store found." };

  const { data, error } = await supabase
    .from("pages")
    .insert({
      store_id: store.id,
      page_type: "booking",
      public_id: publicId(),
      title: "New booking page",
      status: "draft",
      content: {
        title: "Book a session",
        description: "",
        duration: 60,
        buffer: 0,
        timezone: "Asia/Kolkata",
        price: 0,
        is_free: true,
        currency: "INR",
        meeting_type: "Google Meet",
        meeting_detail: "Link sent on booking",
        slots: [
          { day: 1, start: "09:00", end: "17:00" },
          { day: 2, start: "09:00", end: "17:00" },
          { day: 3, start: "09:00", end: "17:00" },
          { day: 4, start: "09:00", end: "17:00" },
          { day: 5, start: "09:00", end: "17:00" },
        ],
        theme: "light",
      },
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/booking");
  return { ok: true, id: data.id };
}

/**
 * Save booking page content and SEO.
 */
export async function saveBookingPage(
  pageId: string,
  payload: { content: Record<string, unknown>; seo: Record<string, unknown> },
): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const { supabase, store } = await ownerStore();
  if (!store) return { ok: false, error: "No store found." };

  const { error } = await supabase
    .from("pages")
    .update({ content: payload.content, seo: payload.seo })
    .eq("id", pageId)
    .eq("page_type", "booking")
    .eq("store_id", store.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/studio/booking/${pageId}`);
  revalidatePath("/dashboard/booking");
  return { ok: true };
}

/**
 * Set the booking page status (draft / published).
 */
export async function setBookingPageStatus(
  pageId: string,
  status: "draft" | "published",
): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const { supabase, store } = await ownerStore();
  if (!store) return { ok: false, error: "No store found." };

  const { error } = await supabase
    .from("pages")
    .update({
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .eq("id", pageId)
    .eq("page_type", "booking")
    .eq("store_id", store.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/studio/booking/${pageId}`);
  revalidatePath("/dashboard/booking");
  return { ok: true };
}

/**
 * Delete a booking page.
 */
export async function deleteBookingPage(pageId: string): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const { supabase, store } = await ownerStore();
  if (!store) return { ok: false, error: "No store found." };

  const { error } = await supabase
    .from("pages")
    .delete()
    .eq("id", pageId)
    .eq("page_type", "booking")
    .eq("store_id", store.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/booking");
  return { ok: true };
}
