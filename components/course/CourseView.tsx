"use client";

import { useState } from "react";
import {
  type CourseContent,
  type CourseModule,
  type CourseLesson,
  formatCoursePrice,
  totalDuration,
} from "@/lib/course";
import { sanitizeHtml } from "@/lib/sanitize";

// ── Inline styles as a <style> tag ──────────────────────────────────────────
// All classes namespaced under .cu to avoid collisions with other page types.
const COURSE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
@keyframes cu-fade { from { transform: translateY(8px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes cu-shine { 0% { left: -60%; } 55%,100% { left: 130%; } }
@keyframes cu-pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: .85; } }

.cu {
  --bg: #fff9f4; --card: #fff; --s2: #fff3ec;
  --primary: #ff6a3d; --primaryh: #f0532a; --secondary: #ff4d7d; --accent: #7b3fe4; --gold: #ffb23e;
  --text: #2b1b2e; --muted: #7a6770; --border: #f0e1d6; --green: #1fb57a;
  --grad: linear-gradient(135deg,#ffb23e,#ff6a3d 38%,#ff4d7d 72%,#7b3fe4);
  --shadow: 0 1px 2px rgba(43,27,46,.04), 0 16px 36px -20px rgba(43,27,46,.28);
  --fh: "Sora", system-ui, sans-serif; --fb: "Inter", system-ui, sans-serif;
  background: var(--bg); color: var(--text); font-family: var(--fb); min-height: 100dvh; line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
.cu[data-theme="dark"] {
  --bg: #0f1115; --card: #1c1f26; --s2: #23262e;
  --primary: #ff7e55; --primaryh: #ff8e69; --secondary: #ff6aa0; --accent: #a06bff; --gold: #ffc773;
  --text: #f2f3f5; --muted: #9aa0ab; --border: rgba(255,255,255,.1); --green: #36c98e;
  --shadow: 0 1px 2px rgba(0,0,0,.3), 0 16px 40px -20px rgba(0,0,0,.6);
}
.cu h1,.cu h2,.cu h3 { margin: 0; font-family: var(--fh); letter-spacing: -.02em; }
.cu p { margin: 0; }
.cu-wrap { max-width: 1080px; margin: 0 auto; padding: 0 24px; }
.cu-nav { position: sticky; top: 0; z-index: 30; background: color-mix(in srgb,var(--bg) 86%,transparent); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
.cu-nav-in { display: flex; align-items: center; gap: 12px; height: 60px; }
.cu-brand { display: flex; align-items: center; gap: 9px; font-family: var(--fh); font-weight: 800; font-size: 17px; }
.cu-logo { width: 27px; height: 27px; border-radius: 8px; background: var(--grad); }
.cu-main { animation: cu-fade .4s ease; }
.cu-hero { background: var(--card); border-bottom: 1px solid var(--border); }
.cu-hero-in { display: grid; grid-template-columns: 1.4fr 1fr; gap: 34px; padding: 36px 0 40px; align-items: start; }
.cu-cat { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--accent); }
.cu-title { font-size: 40px; line-height: 1.08; font-weight: 800; margin: 12px 0 14px; }
.cu-sub { font-size: 16px; color: var(--muted); margin-bottom: 14px; line-height: 1.5; }
.cu-meta { display: flex; flex-wrap: wrap; gap: 8px 18px; align-items: center; font-size: 13.5px; color: var(--muted); margin-bottom: 16px; }
.cu-meta b { color: var(--text); }
.cu-inst { display: flex; align-items: center; gap: 10px; font-size: 13.5px; color: var(--muted); }
.cu-inst .av { width: 34px; height: 34px; border-radius: 50%; background: var(--grad); color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 13px; font-family: var(--fh); flex: none; }
.cu-learn { display: grid; grid-template-columns: 1fr 1fr; gap: 11px 20px; margin-top: 22px; }
.cu-learn div { display: flex; gap: 9px; font-size: 14px; }
.cu-learn div::before { content: "✓"; color: var(--green); font-weight: 800; }
.cu-buy { background: var(--card); border: 1px solid var(--border); border-radius: 18px; box-shadow: var(--shadow); overflow: hidden; position: sticky; top: 76px; }
.cu-thumb { aspect-ratio: 16/10; background: linear-gradient(135deg,#2a1830,#7b3fe4); position: relative; overflow: hidden; }
.cu-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cu-thumb-ph { display: grid; place-items: center; width: 100%; height: 100%; color: rgba(255,255,255,.7); font-size: 13px; }
.cu-buy-bd { padding: 20px; }
.cu-price { display: flex; align-items: baseline; gap: 9px; margin-bottom: 4px; }
.cu-price .now { font-family: var(--fh); font-weight: 800; font-size: 30px; }
.cu-price .was { text-decoration: line-through; color: var(--muted); font-size: 15px; }
.cu-price .off { background: var(--secondary); color: #fff; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 7px; }
.cu-enroll { position: relative; overflow: hidden; width: 100%; margin-top: 14px; background: var(--grad); color: #fff; border: 0; border-radius: 12px; padding: 14px; font-family: var(--fh); font-weight: 800; font-size: 15.5px; cursor: pointer; }
.cu-enroll .sh { position: absolute; top: 0; left: -60%; width: 34%; height: 100%; transform: skewX(-18deg); background: #fff; opacity: .4; filter: blur(3px); animation: cu-shine 3s ease-in-out infinite; }
.cu-incl { list-style: none; padding: 14px 0 0; margin: 14px 0 0; border-top: 1px solid var(--border); font-size: 13px; color: var(--muted); display: flex; flex-direction: column; gap: 9px; }
.cu-incl li { display: flex; gap: 9px; }
.cu-sec { padding: 36px 0; border-bottom: 1px solid var(--border); }
.cu-sec h2 { font-size: 24px; margin-bottom: 18px; }
.cu-curr-meta { font-size: 13px; color: var(--muted); margin-bottom: 14px; }
.cu-mod { border: 1px solid var(--border); border-radius: 12px; margin-bottom: 10px; overflow: hidden; background: var(--card); }
.cu-mod summary { cursor: pointer; list-style: none; display: flex; align-items: center; gap: 10px; padding: 15px 18px; font-family: var(--fh); font-weight: 700; font-size: 15px; }
.cu-mod summary::-webkit-details-marker { display: none; }
.cu-mod summary .chev { margin-left: auto; color: var(--muted); transition: transform .2s; }
.cu-mod[open] summary .chev { transform: rotate(90deg); }
.cu-mod summary .ct { font-family: var(--fb); font-weight: 500; font-size: 12.5px; color: var(--muted); }
.cu-lessons { border-top: 1px solid var(--border); }
.cu-lesson { display: flex; align-items: center; gap: 12px; padding: 12px 18px; border-bottom: 1px solid var(--border); font-size: 13.5px; cursor: default; }
.cu-lesson.playable { cursor: pointer; }
.cu-lesson.playable:hover { background: var(--s2); }
.cu-lesson:last-child { border-bottom: 0; }
.cu-lesson .ic { color: var(--muted); }
.cu-lesson .ic.free { color: var(--green); }
.cu-lesson .nm { flex: 1; }
.cu-lesson .dur { color: var(--muted); font-size: 12.5px; }
.cu-lesson .pv { font-size: 11px; font-weight: 700; color: var(--primary); }
/* player */
.cu-player { display: grid; grid-template-columns: 1fr 340px; min-height: calc(100dvh - 60px); }
.cu-stage { background: #0c0c11; min-width: 0; display: flex; flex-direction: column; }
.cu-screen { aspect-ratio: 16/9; background: radial-gradient(60% 80% at 50% 40%, #2a1830, #0c0c11); display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
.cu-screen iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.cu-screen .play { width: 64px; height: 64px; border-radius: 50%; background: rgba(255,255,255,.92); display: grid; place-items: center; color: var(--primary); font-size: 24px; cursor: pointer; animation: cu-pulse 2.4s ease-in-out infinite; }
.cu-screen .ttl { position: absolute; bottom: 16px; left: 18px; color: #fff; font-family: var(--fh); font-weight: 700; font-size: 15px; }
.cu-bar { background: rgba(255,255,255,.06); height: 5px; }
.cu-bar i { display: block; height: 100%; background: var(--grad); transition: width .3s; }
.cu-pcontrols { display: flex; align-items: center; gap: 12px; padding: 16px 22px; color: #e7e3ee; flex-wrap: wrap; }
.cu-pcontrols .nm { font-family: var(--fh); font-weight: 700; font-size: 16px; color: #fff; }
.cu-pcontrols .sub { font-size: 12.5px; color: #9aa0ab; margin-top: 2px; }
.cu-pbtn { font: inherit; font-family: var(--fh); font-weight: 600; font-size: 13px; padding: 9px 15px; border-radius: 9px; border: 1px solid rgba(255,255,255,.16); background: rgba(255,255,255,.06); color: #fff; cursor: pointer; }
.cu-pbtn.done { background: var(--green); border-color: transparent; }
.cu-side { background: var(--card); border-left: 1px solid var(--border); display: flex; flex-direction: column; min-height: 0; overflow-y: auto; }
.cu-side-h { padding: 16px 18px; border-bottom: 1px solid var(--border); }
.cu-side-h .t { font-family: var(--fh); font-weight: 700; font-size: 14.5px; }
.cu-prog { height: 7px; border-radius: 999px; background: var(--s2); overflow: hidden; margin-top: 10px; }
.cu-prog i { display: block; height: 100%; background: var(--grad); transition: width .3s; }
.cu-prog-t { font-size: 12px; color: var(--muted); margin-top: 7px; }
.cu-side-mod { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); padding: 14px 18px 6px; }
.cu-pl { display: flex; align-items: center; gap: 11px; padding: 11px 18px; cursor: pointer; border-left: 3px solid transparent; }
.cu-pl:hover { background: var(--s2); }
.cu-pl.on { background: var(--s2); border-left-color: var(--primary); }
.cu-pl .ck { width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid var(--border); display: grid; place-items: center; font-size: 11px; flex: none; color: transparent; }
.cu-pl.done .ck { background: var(--green); border-color: transparent; color: #fff; }
.cu-pl .nm { flex: 1; font-size: 13px; }
.cu-pl.on .nm { font-weight: 600; }
.cu-pl .dur { font-size: 11.5px; color: var(--muted); }
@media (max-width: 880px) {
  .cu-hero-in { grid-template-columns: 1fr; } .cu-buy { position: static; }
  .cu-learn { grid-template-columns: 1fr; }
  .cu-player { grid-template-columns: 1fr; } .cu-side { border-left: 0; border-top: 1px solid var(--border); }
  .cu-title { font-size: 28px; }
}
`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function allLessons(modules: CourseModule[]): CourseLesson[] {
  return modules.flatMap((m) => m.lessons);
}

function embedUrl(url: string): string | null {
  if (!url) return null;
  // YouTube
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1`;
  // Vimeo
  const vi = url.match(/vimeo\.com\/(\d+)/);
  if (vi) return `https://player.vimeo.com/video/${vi[1]}?autoplay=1`;
  // Already an embed URL
  if (url.includes("embed")) return url;
  return null;
}

// ── Component ────────────────────────────────────────────────────────────────

export type CourseViewProps = {
  page: {
    id: string;
    public_id: string | null;
    content: CourseContent;
    status: string;
  };
  modules: CourseModule[];
  storeName?: string;
  pageId: string;
  payEnabled: boolean;
  /** True if the buyer has already paid (from session cookie / order lookup) */
  enrolled?: boolean;
};

export default function CourseView({
  page,
  modules,
  storeName,
  pageId,
  payEnabled,
  enrolled = false,
}: CourseViewProps) {
  const c = page.content;
  const theme = c.theme ?? "light";
  const lessons = allLessons(modules);
  const totalLessons = lessons.length;
  const dur = totalDuration(lessons);

  // Player state
  const [view, setView] = useState<"landing" | "player">("landing");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());

  const currentLesson = lessons[currentIdx];
  const currentModTitle = modules.find((m) => m.lessons.some((l) => l.id === currentLesson?.id))?.title ?? "";

  function markDone(idx: number) {
    setDone((prev) => new Set([...prev, idx]));
  }

  const pct = totalLessons > 0 ? Math.round((done.size / totalLessons) * 100) : 0;

  function goLesson(idx: number) {
    setCurrentIdx(idx);
    setView("player");
  }

  function handleEnroll() {
    if (!payEnabled) {
      alert("Payment is not configured for this store yet.");
      return;
    }
    // Navigate to checkout — page_type=course, uses the same orders+checkout flow as opp
    window.location.href = `/course/${page.public_id ?? pageId}/checkout`;
  }

  const price = c.price ?? 0;
  const compareAt = c.compare_at_price;
  const priceLabel = formatCoursePrice(price, c.currency ?? "INR");
  const compareLabel = compareAt ? formatCoursePrice(compareAt, c.currency ?? "INR") : null;
  const discountPct = compareAt && compareAt > price
    ? Math.round((1 - price / compareAt) * 100)
    : null;

  const instructorInitial = (c.instructor_name ?? storeName ?? "?").charAt(0).toUpperCase();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: COURSE_CSS }} />
      <div className="cu" data-theme={theme}>
        {/* Nav */}
        <nav className="cu-nav">
          <div className="cu-wrap cu-nav-in">
            <div className="cu-brand">
              <span className="cu-logo" />
              {storeName ?? "Academy"}
            </div>
            {enrolled && (
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button
                  onClick={() => setView("landing")}
                  style={{ border: "1px solid var(--border)", background: view === "landing" ? "var(--card)" : "transparent", color: "var(--text)", padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Course page
                </button>
                <button
                  onClick={() => setView("player")}
                  style={{ border: "1px solid var(--border)", background: view === "player" ? "var(--card)" : "transparent", color: "var(--text)", padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Lesson player
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* ── LANDING ── */}
        {view === "landing" && (
          <div className="cu-main">
            <div className="cu-hero">
              <div className="cu-wrap cu-hero-in">
                <div>
                  {c.category && <div className="cu-cat">{c.category}</div>}
                  <h1 className="cu-title">{c.headline || "Course title"}</h1>
                  {c.subheadline && <p className="cu-sub">{c.subheadline}</p>}
                  <div className="cu-meta">
                    <span><b>{totalLessons}</b> lessons{dur ? ` · ${dur} total` : ""}</span>
                    <span><b>{modules.length}</b> modules</span>
                  </div>
                  {c.instructor_name && (
                    <div className="cu-inst">
                      {c.instructor_avatar
                        ? <img src={c.instructor_avatar} alt="" className="av" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }} />
                        : <span className="av">{instructorInitial}</span>
                      }
                      <span>By <strong style={{ color: "var(--text)" }}>{c.instructor_name}</strong>
                        {c.instructor_bio && <> · {c.instructor_bio}</>}
                      </span>
                    </div>
                  )}
                  {(c.outcomes ?? []).length > 0 && (
                    <div className="cu-learn">
                      {(c.outcomes ?? []).map((o, i) => <div key={i}>{o}</div>)}
                    </div>
                  )}
                </div>

                {/* Enroll card */}
                <div className="cu-buy">
                  <div className="cu-thumb">
                    {c.thumbnail
                      ? <img src={c.thumbnail} alt={c.headline ?? "Course thumbnail"} />
                      : <div className="cu-thumb-ph">Course preview</div>
                    }
                  </div>
                  <div className="cu-buy-bd">
                    <div className="cu-price">
                      <span className="now">{priceLabel}</span>
                      {compareLabel && <span className="was">{compareLabel}</span>}
                      {discountPct && <span className="off">{discountPct}% OFF</span>}
                    </div>
                    {enrolled ? (
                      <button className="cu-enroll" onClick={() => setView("player")}>
                        Continue learning ↗
                        <span className="sh" />
                      </button>
                    ) : (
                      <button className="cu-enroll" onClick={handleEnroll}>
                        {c.cta_label ?? "Enroll now"}
                        <span className="sh" />
                      </button>
                    )}
                    {(c.includes ?? []).length > 0 && (
                      <ul className="cu-incl">
                        {(c.includes ?? []).map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="cu-wrap">
              {/* Curriculum */}
              {modules.length > 0 && (
                <section className="cu-sec">
                  <h2>Course curriculum</h2>
                  <div className="cu-curr-meta">
                    {modules.length} module{modules.length !== 1 ? "s" : ""} · {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
                    {dur ? ` · ${dur}` : ""}
                  </div>
                  {modules.map((mod, mi) => {
                    const modDur = totalDuration(mod.lessons);
                    return (
                      <details key={mod.id} className="cu-mod" open={mi === 0}>
                        <summary>
                          {mi + 1} · {mod.title}
                          <span className="ct">{mod.lessons.length} lesson{mod.lessons.length !== 1 ? "s" : ""}{modDur ? ` · ${modDur}` : ""}</span>
                          <span className="chev">▸</span>
                        </summary>
                        <div className="cu-lessons">
                          {mod.lessons.map((les) => {
                            const lesIdx = lessons.findIndex((l) => l.id === les.id);
                            const canPlay = enrolled || les.is_free_preview;
                            return (
                              <div
                                key={les.id}
                                className={`cu-lesson${canPlay ? " playable" : ""}`}
                                onClick={() => canPlay && goLesson(lesIdx)}
                              >
                                <span className={`ic${les.is_free_preview ? " free" : ""}`}>
                                  {les.is_free_preview ? "▶" : "🔒"}
                                </span>
                                <span className="nm">{les.title}</span>
                                {les.is_free_preview && <span className="pv">Preview</span>}
                                {les.duration && <span className="dur">{les.duration}</span>}
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    );
                  })}
                </section>
              )}

              {/* Description */}
              {c.description_html && (
                <section className="cu-sec">
                  <h2>About this course</h2>
                  <div
                    style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text)" }}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(c.description_html) }}
                  />
                </section>
              )}
            </div>
          </div>
        )}

        {/* ── PLAYER ── */}
        {view === "player" && (
          <div className="cu-main cu-player">
            <div className="cu-stage">
              <div className="cu-screen">
                {currentLesson?.video_url && embedUrl(currentLesson.video_url)
                  ? <iframe
                      src={embedUrl(currentLesson.video_url)!}
                      allow="autoplay; fullscreen"
                      allowFullScreen
                    />
                  : <div className="play" onClick={() => markDone(currentIdx)}>▶</div>
                }
                <div className="ttl">{currentLesson?.title}</div>
              </div>
              <div className="cu-bar">
                <i style={{ width: currentLesson?.video_url ? "0%" : done.has(currentIdx) ? "100%" : "0%" }} />
              </div>
              <div className="cu-pcontrols">
                <div>
                  <div className="nm">{currentLesson?.title}</div>
                  <div className="sub">{currentModTitle}</div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  {currentIdx > 0 && (
                    <button className="cu-pbtn" onClick={() => setCurrentIdx(i => i - 1)}>
                      ← Prev
                    </button>
                  )}
                  <button
                    className={`cu-pbtn${done.has(currentIdx) ? " done" : ""}`}
                    onClick={() => { markDone(currentIdx); if (currentIdx < lessons.length - 1) setCurrentIdx(i => i + 1); }}
                  >
                    {done.has(currentIdx) ? "✓ Done" : "Mark done"}
                  </button>
                  {currentIdx < lessons.length - 1 && (
                    <button className="cu-pbtn" onClick={() => setCurrentIdx(i => i + 1)}>
                      Next →
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="cu-side">
              <div className="cu-side-h">
                <div className="t">{c.headline || "Course"}</div>
                <div className="cu-prog">
                  <i style={{ width: `${pct}%` }} />
                </div>
                <div className="cu-prog-t">{pct}% complete · {done.size}/{totalLessons} lessons</div>
              </div>
              {modules.map((mod) => (
                <div key={mod.id}>
                  <div className="cu-side-mod">{mod.title}</div>
                  {mod.lessons.map((les) => {
                    const lesIdx = lessons.findIndex((l) => l.id === les.id);
                    return (
                      <div
                        key={les.id}
                        className={`cu-pl${lesIdx === currentIdx ? " on" : ""}${done.has(lesIdx) ? " done" : ""}`}
                        onClick={() => setCurrentIdx(lesIdx)}
                      >
                        <span className="ck">{done.has(lesIdx) ? "✓" : ""}</span>
                        <span className="nm">{les.title}</span>
                        {les.duration && <span className="dur">{les.duration}</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
