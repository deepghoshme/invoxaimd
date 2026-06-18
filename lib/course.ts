/**
 * Course types and helpers.
 * Course meta lives in pages.content (JSONB).
 * Curriculum structure lives in course_modules + course_lessons tables.
 */

export type CourseTheme = "light" | "dark";

export type CourseContent = {
  /** Course title (also kept in pages.title for SEO) */
  headline?: string;
  subheadline?: string;
  description_html?: string;
  thumbnail?: string;
  /** Price in the store's default currency (e.g. 1499 = ₹1,499) */
  price?: number;
  compare_at_price?: number;
  currency?: string;
  /** Color theme token */
  theme?: CourseTheme;
  /** Accent hue for the course page */
  accent?: string;
  /** Instructor name shown on the landing */
  instructor_name?: string;
  instructor_bio?: string;
  instructor_avatar?: string;
  /** What students will learn (bullet points) */
  outcomes?: string[];
  /** Includes list shown on enroll card */
  includes?: string[];
  /** Category label (e.g. "Music production · Beginner to Pro") */
  category?: string;
  /** CTA label overrides */
  cta_label?: string;
  /** SEO */
  seo_title?: string;
  seo_description?: string;
  og_image?: string;
};

export type CourseModule = {
  id: string;
  page_id: string;
  title: string;
  sort_order: number;
  lessons: CourseLesson[];
};

export type CourseLesson = {
  id: string;
  module_id: string;
  title: string;
  video_url?: string | null;
  duration?: string | null;
  is_free_preview: boolean;
  sort_order: number;
  content?: string | null;
};

export const DEFAULT_COURSE_CONTENT: CourseContent = {
  headline: "New course",
  subheadline: "Add a short compelling subtitle",
  description_html: "<p>Describe what makes this course special and who it is for.</p>",
  price: 999,
  currency: "INR",
  theme: "light",
  outcomes: [
    "Outcome one — what students will be able to do",
    "Outcome two — a second concrete skill",
    "Outcome three — a third takeaway",
    "Outcome four — a fourth result",
  ],
  includes: [
    "Video lessons with lifetime access",
    "Access on mobile and desktop",
    "Certificate of completion",
  ],
  cta_label: "Enroll now",
  instructor_name: "",
};

/** Format a price number to a currency string (e.g. 1499 → "₹1,499") */
export function formatCoursePrice(amount: number, currency = "INR"): string {
  if (currency === "INR") return "₹" + Math.round(amount).toLocaleString("en-IN");
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

/** Compute total duration label from lessons */
export function totalDuration(lessons: CourseLesson[]): string {
  let totalSecs = 0;
  for (const l of lessons) {
    if (!l.duration) continue;
    const parts = l.duration.split(":").map(Number);
    if (parts.length === 2) totalSecs += (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
    else if (parts.length === 3) totalSecs += (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  }
  if (totalSecs === 0) return "";
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
