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
import SiteFooter from "@/components/SiteFooter";

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
.cu-thumb { aspect-ratio: 16/10; background: linear-gradient(135deg,var(--s2, #2a1830),var(--accent, #7b3fe4)); position: relative; overflow: hidden; }
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
.cu-screen { aspect-ratio: 16/9; background: radial-gradient(60% 80% at 50% 40%, color-mix(in srgb, var(--accent, #7b3fe4) 30%, #0c0c11), #0c0c11); display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
.cu-screen iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.cu-screen .play { width: 64px; height: 64px; border-radius: 50%; background: rgba(255,255,255,.92); display: grid; place-items: center; color: var(--primary); font-size: 24px; cursor: pointer; animation: cu-pulse 2.4s ease-in-out infinite; }
.cu-screen .ttl { position: absolute; bottom: 16px; left: 18px; color: #fff; font-family: var(--fh); font-weight: 700; font-size: 15px; }
.cu-bar { background: rgba(255,255,255,.06); height: 5px; }
.cu-bar i { display: block; height: 100%; background: var(--grad); transition: width .3s; }
.cu-pcontrols { display: flex; align-items: center; gap: 12px; padding: 16px 22px; color: rgba(255,255,255,.9); flex-wrap: wrap; }
.cu-pcontrols .nm { font-family: var(--fh); font-weight: 700; font-size: 16px; color: #fff; }
.cu-pcontrols .sub { font-size: 12.5px; color: rgba(255,255,255,.6); margin-top: 2px; }
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
/* ── Trust bar ── */
.cu-trust { background: var(--s2); border-bottom: 1px solid var(--border); padding: 14px 0; }
.cu-trust-in { display: flex; flex-wrap: wrap; gap: 8px 28px; align-items: center; justify-content: center; font-size: 13px; color: var(--muted); }
.cu-trust-in span { display: flex; align-items: center; gap: 7px; }
.cu-trust-in span::before { content: "✓"; color: var(--green); font-weight: 800; }

/* ── Instructor card ── */
.cu-icard { display: flex; gap: 20px; background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 22px; margin-top: 0; }
.cu-icard .av-lg { width: 72px; height: 72px; border-radius: 50%; background: var(--grad); color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 26px; font-family: var(--fh); flex: none; }
.cu-icard .av-lg img { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; display: block; }
.cu-icard-info h3 { font-size: 17px; margin-bottom: 4px; }
.cu-icard-info .role { font-size: 13px; color: var(--primary); font-weight: 600; margin-bottom: 8px; }
.cu-icard-info p { font-size: 14px; color: var(--muted); line-height: 1.6; margin: 0; }

/* ── Testimonials ── */
.cu-tgrid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }
.cu-tcard { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 18px; }
.cu-tcard .stars { color: var(--gold); font-size: 14px; letter-spacing: 1px; margin-bottom: 10px; }
.cu-tcard p { font-size: 14px; color: var(--text); line-height: 1.65; margin: 0 0 14px; }
.cu-tcard .who { display: flex; align-items: center; gap: 10px; }
.cu-tcard .who .av-s { width: 32px; height: 32px; border-radius: 50%; background: var(--grad); color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 13px; font-family: var(--fh); flex: none; }
.cu-tcard .who b { font-size: 13px; display: block; }
.cu-tcard .who span { font-size: 12px; color: var(--muted); }

/* ── FAQ ── */
.cu-faq { display: flex; flex-direction: column; gap: 0; }
.cu-faq-item { border-bottom: 1px solid var(--border); }
.cu-faq-item:first-child { border-top: 1px solid var(--border); }
.cu-faq-q { width: 100%; display: flex; justify-content: space-between; align-items: center; background: none; border: 0; color: var(--text); padding: 16px 0; font-size: 15px; font-weight: 600; font-family: var(--fh); cursor: pointer; text-align: left; gap: 12px; }
.cu-faq-q .chev { font-size: 18px; color: var(--muted); flex: none; transition: transform .2s; }
.cu-faq-item.open .cu-faq-q .chev { transform: rotate(45deg); }
.cu-faq-a { font-size: 14px; color: var(--muted); line-height: 1.7; padding-bottom: 16px; display: none; }
.cu-faq-item.open .cu-faq-a { display: block; }

/* ── Bottom CTA band ── */
.cu-ctaband { background: var(--grad); border-radius: 20px; padding: 48px 36px; text-align: center; color: #fff; margin-bottom: 48px; position: relative; overflow: hidden; }
.cu-ctaband::after { content: ""; position: absolute; inset: 0; background: radial-gradient(50% 120% at 80% 0%, rgba(255,255,255,.25), transparent 60%); pointer-events: none; }
.cu-ctaband > * { position: relative; z-index: 1; }
.cu-ctaband h2 { font-size: clamp(24px, 3.5vw, 36px); margin-bottom: 10px; }
.cu-ctaband p { opacity: .9; font-size: 15px; margin-bottom: 22px; }
.cu-ctaband-btn { display: inline-block; background: #fff; color: var(--primary); border: 0; border-radius: 12px; padding: 14px 28px; font-family: var(--fh); font-weight: 800; font-size: 15.5px; cursor: pointer; }

/* ── Footer wrapper inside .cu ── */
.cu .sf-root { background: var(--card); border-top-color: var(--border); color: var(--muted); }
.cu .sf-brand, .cu .sf-col h5 { color: var(--text); }

@media (max-width: 880px) {
  .cu-hero-in { grid-template-columns: 1fr; } .cu-buy { position: static; }
  .cu-learn { grid-template-columns: 1fr; }
  .cu-player { grid-template-columns: 1fr; } .cu-side { border-left: 0; border-top: 1px solid var(--border); }
  .cu-title { font-size: 28px; }
  .cu-tgrid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .cu { padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px)); }
  .cu-ctaband { padding: 32px 22px; }
  .cu-icard { flex-direction: column; align-items: flex-start; }
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

// ── FAQ accordion (client-only toggle) ──────────────────────────────────────

function FaqSection({ items }: { items: { q?: string; a?: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="cu-faq">
      {items.map((item, i) => (
        <div key={i} className={`cu-faq-item${open === i ? " open" : ""}`}>
          <button className="cu-faq-q" onClick={() => setOpen(open === i ? null : i)}>
            <span>{item.q ?? `Question ${i + 1}`}</span>
            <span className="chev">+</span>
          </button>
          <div className="cu-faq-a">{item.a ?? ""}</div>
        </div>
      ))}
    </div>
  );
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

  async function handleEnroll() {
    if (!payEnabled) {
      alert("Payment is not configured for this store yet.");
      return;
    }
    // Create an order server-side first (price is read from DB — never trusted from
    // client), then redirect to the standard /{prefix}/checkout/{orderId} URL that
    // the sites router dispatches to <CheckoutForm>.
    try {
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId }),
      });
      const j = await res.json();
      if (!res.ok) {
        alert(j.error ?? "Could not start checkout. Please try again.");
        return;
      }
      window.location.href = `/course/checkout/${j.order_id}`;
    } catch {
      alert("Network error. Please try again.");
    }
  }

  const price = c.price ?? 0;
  const compareAt = c.compare_at_price;
  const priceLabel = formatCoursePrice(price, c.currency ?? "INR");
  const compareLabel = compareAt ? formatCoursePrice(compareAt, c.currency ?? "INR") : null;
  const discountPct = compareAt && compareAt > price
    ? Math.round((1 - price / compareAt) * 100)
    : null;

  const instructorInitial = (c.instructor_name ?? storeName ?? "?").charAt(0).toUpperCase();

  // Extended fields that the builder may write into content but aren't in the
  // base CourseContent type yet — access via cast so tsc doesn't reject them.
  const cx = c as Record<string, unknown>;
  const testimonials = (cx.testimonials as { name?: string; role?: string; body?: string }[] | undefined) ?? [];
  const faq = (cx.faq as { q?: string; a?: string }[] | undefined) ?? [];
  const ctaHeading = (cx.cta_heading as string | undefined);
  const ctaSubheading = (cx.cta_subheading as string | undefined);

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

        {/* Trust bar */}
        {view === "landing" && (
          <div className="cu-trust">
            <div className="cu-wrap cu-trust-in">
              <span>Lifetime access</span>
              <span>Certificate on completion</span>
              <span>{totalLessons > 0 ? `${totalLessons} lessons` : "Self-paced"}</span>
              {dur && <span>{dur} of content</span>}
              <span>Instant access after enroll</span>
            </div>
          </div>
        )}

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

              {/* Instructor */}
              {c.instructor_name && (
                <section className="cu-sec">
                  <h2>Your instructor</h2>
                  <div className="cu-icard">
                    <div className="av-lg">
                      {c.instructor_avatar
                        ? <img src={c.instructor_avatar} alt={c.instructor_name} />
                        : instructorInitial
                      }
                    </div>
                    <div className="cu-icard-info">
                      <h3>{c.instructor_name}</h3>
                      {c.instructor_bio && <div className="role">{c.instructor_bio}</div>}
                      <p>
                        {c.instructor_bio
                          ? `${c.instructor_name} brings deep expertise to every lesson. Each module is designed for practical, real-world application so you can start applying what you learn immediately.`
                          : `${storeName ?? "Academy"} brings you this course with carefully structured lessons to help you achieve your goals step by step.`
                        }
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {/* Testimonials — shown only if testimonials data exists */}
              {testimonials.length > 0 && (
                <section className="cu-sec">
                  <h2>What students say</h2>
                  <div className="cu-tgrid">
                    {testimonials.map((t, i) => (
                      <div className="cu-tcard" key={i}>
                        <div className="stars">★★★★★</div>
                        <p>&ldquo;{t.body ?? ""}&rdquo;</p>
                        <div className="who">
                          <span className="av-s">{(t.name ?? "?").charAt(0).toUpperCase()}</span>
                          <div>
                            <b>{t.name ?? "Student"}</b>
                            {t.role && <span>{t.role}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* FAQ — shown only if faq data exists */}
              {faq.length > 0 && (
                <section className="cu-sec">
                  <h2>Frequently asked questions</h2>
                  <FaqSection items={faq} />
                </section>
              )}

              {/* Bottom CTA band */}
              {!enrolled && (
                <div className="cu-ctaband">
                  <h2>{ctaHeading ?? "Ready to get started?"}</h2>
                  <p>{ctaSubheading ?? "Join today and get lifetime access to all lessons."}</p>
                  <button className="cu-ctaband-btn" onClick={handleEnroll}>
                    {c.cta_label ?? "Enroll now"} →
                  </button>
                </div>
              )}
            </div>

            {/* Site footer */}
            <SiteFooter brandName={storeName} />
          </div>
        )}

        {/* Mobile-only fixed bottom pay bar — hidden on desktop (≤640px only).
            Shows the enroll action when the .cu-buy card has stacked below content. */}
        {view === "landing" && !enrolled && (
          <div className="mobile-pay-bar">
            <div className="mobile-pay-bar-price">
              {priceLabel}
              {compareLabel && <small>was {compareLabel}</small>}
            </div>
            <button
              className="mobile-pay-bar-btn"
              onClick={handleEnroll}
            >
              {c.cta_label ?? "Enroll now"} →
            </button>
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
