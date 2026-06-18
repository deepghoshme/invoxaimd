import { createAdminClient } from "@/lib/supabase/admin";
import { requireDashboardStore } from "@/lib/auth";
import { Phead, Kpis, Card, Tag, Live } from "@/components/dx/ui";

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
          <button
            className="btn grad"
            disabled
            style={{ opacity: 0.7, cursor: "not-allowed" }}
            title="Course builder coming soon"
          >
            + New course (builder coming soon)
          </button>
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
        .pt-table th {
          text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em;
          text-transform: uppercase; color: var(--muted); padding: 9px 12px;
          border-bottom: 1px solid var(--border);
        }
        .pt-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 13px; }
        .pt-table tr:last-child td { border-bottom: 0; }
        .pt-table tr:hover td { background: var(--surface2); }
        .pt-empty {
          text-align: center; padding: 56px 24px; color: var(--muted); font-size: 13.5px;
        }
        .pt-coming {
          background: color-mix(in srgb, var(--primary) 7%, var(--surface));
          border: 1px solid color-mix(in srgb, var(--primary) 18%, var(--border));
          border-radius: 14px; padding: 18px 20px; margin-bottom: 14px;
        }
        .pt-coming h3 { font-size: 15px; margin: 0 0 6px; }
        .pt-coming p { color: var(--muted); font-size: 13px; margin: 0; }
        .pt-features { display: flex; flex-direction: column; gap: 9px; margin-top: 12px; }
        .pt-feat {
          display: flex; gap: 10px; align-items: flex-start;
          padding: 10px 12px; background: var(--surface2); border-radius: 9px; font-size: 13px;
        }
        .pt-feat b { display: block; margin-bottom: 2px; }
        .pt-feat p { margin: 0; color: var(--muted); font-size: 12px; }
      `}</style>

      <div className="dx-grid dx-cols">
        <div>
          <Card title={`Your courses (${courses.length})`}>
            {courses.length === 0 ? (
              <div className="pt-empty">
                <div style={{ fontSize: 36, marginBottom: 10 }}>📚</div>
                <p style={{ marginBottom: 0 }}>
                  No courses yet. The course builder is coming soon — you will be able to create
                  multi-module courses with video lessons, quizzes, and student tracking.
                </p>
              </div>
            ) : (
              <table className="pt-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>URL</th>
                    <th>Students</th>
                    <th>Created</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((c) => {
                    const content = (c.content ?? {}) as { headline?: string; price?: number };
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>
                          {content.headline || c.title || "Untitled"}
                        </td>
                        <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted)" }}>
                          /course/{c.public_id ?? c.id.slice(0, 8)}
                        </td>
                        <td>—</td>
                        <td style={{ fontSize: 12, color: "var(--muted)" }}>
                          {new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </td>
                        <td>
                          {c.status === "published" ? <Live /> : <Tag kind="neu">Draft</Tag>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div>
          <div className="pt-coming">
            <h3>Course builder — coming soon</h3>
            <p>
              A full course builder is planned. Once live, you will be able to create structured
              courses here and sell them as standalone pages or bundles.
            </p>
          </div>

          <Card title="Planned features">
            <div className="pt-features">
              {[
                { icon: "🎬", title: "Video lessons", desc: "Embed from YouTube, Vimeo, or upload directly" },
                { icon: "📝", title: "Modules & quizzes", desc: "Organise content into sections with progress tracking" },
                { icon: "📊", title: "Student dashboard", desc: "Students see their progress and certificates" },
                { icon: "💳", title: "One-time & subscription", desc: "Sell access as a one-off or recurring payment" },
              ].map((f) => (
                <div key={f.title} className="pt-feat">
                  <span style={{ fontSize: 18 }}>{f.icon}</span>
                  <div>
                    <b>{f.title}</b>
                    <p>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div style={{ height: 14 }} />
          <Card title="Alternative now">
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
              Until the course builder is live, sell your course using a one-page product with a payment link and manual delivery of content:
            </p>
            <a href="/dashboard/pages/products" className="btn grad" style={{ display: "inline-flex" }}>
              Create one-page product →
            </a>
          </Card>
        </div>
      </div>
    </>
  );
}
