"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { publicId } from "@/lib/ids";
import { assertNotImpersonating } from "@/lib/impersonation";
import { DEFAULT_COURSE_CONTENT, type CourseContent } from "@/lib/course";

type Result = { ok: boolean; error?: string };

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

/** Create a new draft course page; redirect to the studio builder. */
export async function createCourse(): Promise<void> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return; // impersonating — silently ignore from form action

  const { supabase, store } = await ownerStore();
  if (!store) return;

  const content: CourseContent = { ...DEFAULT_COURSE_CONTENT };

  const { data, error } = await supabase
    .from("pages")
    .insert({
      store_id: store.id,
      page_type: "course",
      public_id: publicId(),
      title: "New course",
      status: "draft",
      content,
    })
    .select("id")
    .single();

  if (error) return; // DB error — fail silently from form action

  revalidatePath("/dashboard/courses");
  redirect(`/studio/course/${data.id}`);
}

/** Save course content (pages.content) + rebuild modules/lessons. */
export async function saveCourse(
  pageId: string,
  payload: {
    content: CourseContent;
    modules: Array<{
      id: string | null;    // null = new
      title: string;
      sort_order: number;
      lessons: Array<{
        id: string | null;  // null = new
        title: string;
        video_url?: string;
        duration?: string;
        is_free_preview: boolean;
        sort_order: number;
        content?: string;
      }>;
    }>;
  },
): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const supabase = await createClient();

  // Verify ownership
  const { data: page } = await supabase
    .from("pages")
    .select("id, store_id")
    .eq("id", pageId)
    .eq("page_type", "course")
    .maybeSingle();
  if (!page) return { ok: false, error: "Course not found." };

  // Save pages.content (title from headline)
  const headline = payload.content.headline || "Untitled course";
  const { error: pageErr } = await supabase
    .from("pages")
    .update({ content: payload.content, title: headline })
    .eq("id", pageId)
    .eq("page_type", "course");
  if (pageErr) return { ok: false, error: pageErr.message };

  // Sync modules — upsert + delete removed ones
  const keptModuleIds: string[] = [];

  for (const mod of payload.modules) {
    if (mod.id) {
      // Update existing
      const { error } = await supabase
        .from("course_modules")
        .update({ title: mod.title, sort_order: mod.sort_order })
        .eq("id", mod.id)
        .eq("page_id", pageId);
      if (error) return { ok: false, error: error.message };
      keptModuleIds.push(mod.id);

      // Sync lessons
      const keptLessonIds: string[] = [];
      for (const les of mod.lessons) {
        if (les.id) {
          await supabase.from("course_lessons").update({
            title: les.title,
            video_url: les.video_url || null,
            duration: les.duration || null,
            is_free_preview: les.is_free_preview,
            sort_order: les.sort_order,
            content: les.content || null,
          }).eq("id", les.id).eq("module_id", mod.id);
          keptLessonIds.push(les.id);
        } else {
          const { data: newL } = await supabase.from("course_lessons").insert({
            module_id: mod.id,
            title: les.title,
            video_url: les.video_url || null,
            duration: les.duration || null,
            is_free_preview: les.is_free_preview,
            sort_order: les.sort_order,
            content: les.content || null,
          }).select("id").single();
          if (newL) keptLessonIds.push(newL.id as string);
        }
      }
      // Delete lessons no longer in payload
      if (keptLessonIds.length > 0) {
        await supabase.from("course_lessons")
          .delete()
          .eq("module_id", mod.id)
          .not("id", "in", `(${keptLessonIds.map((x) => `"${x}"`).join(",")})`);
      } else {
        await supabase.from("course_lessons").delete().eq("module_id", mod.id);
      }
    } else {
      // Insert new module
      const { data: newMod } = await supabase.from("course_modules").insert({
        page_id: pageId,
        title: mod.title,
        sort_order: mod.sort_order,
      }).select("id").single();
      if (!newMod) continue;
      keptModuleIds.push(newMod.id as string);

      for (const les of mod.lessons) {
        await supabase.from("course_lessons").insert({
          module_id: newMod.id,
          title: les.title,
          video_url: les.video_url || null,
          duration: les.duration || null,
          is_free_preview: les.is_free_preview,
          sort_order: les.sort_order,
          content: les.content || null,
        });
      }
    }
  }

  // Delete modules no longer in payload
  if (keptModuleIds.length > 0) {
    await supabase.from("course_modules")
      .delete()
      .eq("page_id", pageId)
      .not("id", "in", `(${keptModuleIds.map((x) => `"${x}"`).join(",")})`);
  } else {
    await supabase.from("course_modules").delete().eq("page_id", pageId);
  }

  revalidatePath(`/studio/course/${pageId}`);
  revalidatePath("/dashboard/courses");
  return { ok: true };
}

/** Publish or unpublish a course page. */
export async function setCourseStatus(
  pageId: string,
  status: "draft" | "published",
): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;

  const supabase = await createClient();

  if (status === "published") {
    const { data: page } = await supabase
      .from("pages")
      .select("content")
      .eq("id", pageId)
      .eq("page_type", "course")
      .maybeSingle();
    const c = (page?.content ?? {}) as CourseContent;
    if (!c.price || Number(c.price) <= 0) {
      return { ok: false, error: "Set a price above 0 before publishing." };
    }
  }

  const { error } = await supabase
    .from("pages")
    .update({ status, published_at: status === "published" ? new Date().toISOString() : null })
    .eq("id", pageId)
    .eq("page_type", "course");
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/studio/course/${pageId}`);
  revalidatePath("/dashboard/courses");
  return { ok: true };
}

/** Delete a course page (cascades to modules+lessons). */
export async function deleteCourse(pageId: string): Promise<Result> {
  const guard = await assertNotImpersonating();
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { error } = await supabase
    .from("pages")
    .delete()
    .eq("id", pageId)
    .eq("page_type", "course");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/courses");
  return { ok: true };
}
