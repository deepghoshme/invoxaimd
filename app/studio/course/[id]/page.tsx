import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentStore } from "@/lib/auth";
import CourseBuilder from "@/components/course/CourseBuilder";
import { DEFAULT_COURSE_CONTENT, type CourseContent, type CourseModule, type CourseLesson } from "@/lib/course";
import "../../../dashboard/dx.css";
import "../../../website.css";

export const dynamic = "force-dynamic";

export default async function StudioCourse({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { store, impersonating } = await getCurrentStore();
  if (!store || !store.onboarding_completed) redirect("/onboarding");

  // Fetch the course page
  const { data: page } = await sb
    .from("pages")
    .select("id, public_id, title, content, status, store_id, page_type")
    .eq("id", id)
    .maybeSingle();

  if (!page || page.store_id !== store.id || page.page_type !== "course") notFound();

  const content: CourseContent = { ...DEFAULT_COURSE_CONTENT, ...(page.content as CourseContent ?? {}) };

  // Fetch modules + lessons (graceful — if tables missing, return empty)
  const admin = createAdminClient();
  let modules: CourseModule[] = [];
  try {
    const { data: modRows } = await admin
      .from("course_modules")
      .select("id, page_id, title, sort_order")
      .eq("page_id", id)
      .order("sort_order", { ascending: true });

    if (modRows && modRows.length > 0) {
      const modIds = modRows.map((m: { id: string }) => m.id);
      const { data: lesRows } = await admin
        .from("course_lessons")
        .select("id, module_id, title, video_url, duration, is_free_preview, sort_order, content")
        .in("module_id", modIds)
        .order("sort_order", { ascending: true });

      const lessonsByModule = new Map<string, CourseLesson[]>();
      for (const l of (lesRows ?? [])) {
        const key = l.module_id as string;
        if (!lessonsByModule.has(key)) lessonsByModule.set(key, []);
        lessonsByModule.get(key)!.push({
          id: l.id as string,
          module_id: l.module_id as string,
          title: l.title as string,
          video_url: (l.video_url as string) ?? null,
          duration: (l.duration as string) ?? null,
          is_free_preview: (l.is_free_preview as boolean) ?? false,
          sort_order: (l.sort_order as number) ?? 0,
          content: (l.content as string) ?? null,
        });
      }

      modules = modRows.map((m: { id: string; page_id: string; title: string; sort_order: number }) => ({
        id: m.id,
        page_id: m.page_id,
        title: m.title,
        sort_order: m.sort_order,
        lessons: lessonsByModule.get(m.id) ?? [],
      }));
    }
  } catch {
    // Tables don't exist yet — builder shows empty curriculum state
    modules = [];
  }

  // Analytics: paid orders for this course page
  let studentCount = 0;
  let revenue = 0;
  try {
    const { data: orderRows } = await admin
      .from("orders")
      .select("amount, buyer_email")
      .eq("page_id", id)
      .eq("status", "paid");
    const uniqueStudents = new Set((orderRows ?? []).map((o: { buyer_email: string }) => o.buyer_email).filter(Boolean));
    studentCount = uniqueStudents.size;
    revenue = (orderRows ?? []).reduce((s: number, o: { amount: number }) => s + (o.amount ?? 0), 0);
  } catch {
    // Orders query failed gracefully
  }

  const publicUrl = store.subdomain ? `https://${store.subdomain}.invoxai.io` : null;

  return (
    <div className="dx studio" style={{ background: "var(--bg)" }}>
      <div className="studio-bar">
        <a className="studio-brand" href="/dashboard">
          <span className="dot" /> invoxai <em>Course Builder</em>
        </a>
        <a className="studio-exit" href="/dashboard/courses">Exit</a>
      </div>
      <div className="studio-wrap">
        <CourseBuilder
          pageId={id}
          initial={content}
          initialModules={modules}
          publicUrl={publicUrl}
          initialStatus={page.status as string}
          isImpersonating={!!impersonating}
          students={studentCount}
          revenue={revenue}
        />
      </div>
    </div>
  );
}
