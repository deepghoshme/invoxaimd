import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card, Tag, Live } from "@/components/dx/ui";
import { createCourse } from "./actions";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const { store } = await requireDashboardStore();
  const sb = createAdminClient();

  // Real query: pages with page_type = 'course'
  const { data: coursePages } = await sb
    .from("pages")
    .select("id, title, status, content, created_at, public_id")
    .eq("store_id", store.id)
    .eq("page_type", "course")
    .order("created_at", { ascending: false });

  const courses = coursePages ?? [];

  // Revenue from orders linked to course pages
  const courseIds = courses.map((p) => p.id);
  let revenue = 0;
  let studentCount = 0;
  if (courseIds.length > 0) {
    const { data: orderRows } = await sb
      .from("orders")
      .select("amount, buyer_email")
      .in("page_id", courseIds)
      .eq("status", "paid");
    const uniqueStudents = new Set((orderRows ?? []).map((o) => o.buyer_email).filter(Boolean));
    revenue = (orderRows ?? []).reduce((s, o) => s + (o.amount ?? 0), 0);
    studentCount = uniqueStudents.size;
  }

  const inr = (p: number) => "₹" + Math.round(p / 100).toLocaleString("en-IN");

  return (
    <>
      <Phead
        title="Courses"
        sub="Sell and host online courses with modules and lessons."
        action={
          <form action={createCourse}>
            <button type="submit" className="btn grad">+ New course</button>
          </form>
        }
      />

      <Kpis
        items={[
          {
            icon: "book",
            color: "var(--primary)",
            label: "Courses",
            value: courses.length.toLocaleString("en-IN"),
          },
          {
            icon: "users",
            color: "var(--secondary)",
            label: "Students",
            value: studentCount.toLocaleString("en-IN"),
          },
          {
            icon: "rupee",
            color: "var(--green)",
            label: "Revenue",
            value: inr(revenue),
          },
          {
            icon: "chart",
            color: "var(--accent)",
            label: "Published",
            value: String(courses.filter((c) => c.status === "published").length),
          },
        ]}
      />

      <style>{`
        .pt-table { width: 100%; border-collapse: collapse; }
        .pt-table th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); padding: 9px 12px; border-bottom: 1px solid var(--border); }
        .pt-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 13px; }
        .pt-table tr:last-child td { border-bottom: 0; }
        .pt-table tr:hover td { background: var(--surface2); }
        .pt-empty { text-align: center; padding: 56px 24px; color: var(--muted); font-size: 13.5px; }
        .pt-edit-btn { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; padding: 5px 11px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text); text-decoration: none; }
        .pt-edit-btn:hover { border-color: var(--primary); color: var(--primary); }
      `}</style>

      <Card title={`Your courses (${courses.length})`}>
        {courses.length === 0 ? (
          <div className="pt-empty">
            <div style={{ fontSize: 36, marginBottom: 10 }}>📚</div>
            <p style={{ marginBottom: 16 }}>No courses yet. Create your first course to get started.</p>
            <form action={createCourse}>
              <button type="submit" className="btn grad">+ Create your first course</button>
            </form>
          </div>
        ) : (
          <table className="pt-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>URL</th>
                <th>Price</th>
                <th>Created</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => {
                const content = (c.content ?? {}) as { headline?: string; price?: number; currency?: string };
                const price = content.price;
                const currency = content.currency ?? "INR";
                const priceLabel = price
                  ? currency === "INR" ? "₹" + Math.round(price).toLocaleString("en-IN") : String(price)
                  : "—";
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{content.headline || c.title || "Untitled"}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted)" }}>
                      /course/{c.public_id ?? c.id.slice(0, 8)}
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--primary)" }}>{priceLabel}</td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>
                      {new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </td>
                    <td>{c.status === "published" ? <Live /> : <Tag kind="neu">Draft</Tag>}</td>
                    <td>
                      <a href={`/studio/course/${c.id}`} className="pt-edit-btn" target="_blank" rel="noreferrer">
                        Edit
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
