-- ============================================================
-- COURSES — modules and lessons tables
-- ============================================================
-- Course meta (title, price, description, thumbnail, theme) lives
-- in pages.content JSONB (page_type = 'course').
-- This migration adds the structured curriculum tables.
-- ============================================================

-- Guard: only create tables if they don't exist yet (idempotent)

CREATE TABLE IF NOT EXISTS public.course_modules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id     uuid NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'Module',
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.course_lessons (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id       uuid NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title           text NOT NULL DEFAULT 'Lesson',
  video_url       text,
  duration        text,           -- human-readable e.g. "12:34"
  is_free_preview boolean NOT NULL DEFAULT false,
  sort_order      integer NOT NULL DEFAULT 0,
  content         text,           -- optional rich text / notes
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS course_modules_page_id_idx   ON public.course_modules(page_id);
CREATE INDEX IF NOT EXISTS course_lessons_module_id_idx ON public.course_lessons(module_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;

-- ---- course_modules ----

-- Store owner can do everything on their own course modules
-- (ownership: modules.page_id → pages.store_id → stores.owner_id = current user)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'course_modules' AND policyname = 'store_owner_manage_modules'
  ) THEN
    CREATE POLICY store_owner_manage_modules ON public.course_modules
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.pages p
          JOIN  public.stores s ON s.id = p.store_id
          WHERE p.id = course_modules.page_id
            AND s.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.pages p
          JOIN  public.stores s ON s.id = p.store_id
          WHERE p.id = course_modules.page_id
            AND s.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Public can read modules of published course pages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'course_modules' AND policyname = 'public_read_published_modules'
  ) THEN
    CREATE POLICY public_read_published_modules ON public.course_modules
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.pages p
          WHERE p.id = course_modules.page_id
            AND p.page_type = 'course'
            AND p.status = 'published'
        )
      );
  END IF;
END $$;

-- ---- course_lessons ----

-- Store owner can manage lessons of their own course modules
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'course_lessons' AND policyname = 'store_owner_manage_lessons'
  ) THEN
    CREATE POLICY store_owner_manage_lessons ON public.course_lessons
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.course_modules m
          JOIN  public.pages p  ON p.id = m.page_id
          JOIN  public.stores s ON s.id = p.store_id
          WHERE m.id = course_lessons.module_id
            AND s.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.course_modules m
          JOIN  public.pages p  ON p.id = m.page_id
          JOIN  public.stores s ON s.id = p.store_id
          WHERE m.id = course_lessons.module_id
            AND s.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Public can read lessons of published course pages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'course_lessons' AND policyname = 'public_read_published_lessons'
  ) THEN
    CREATE POLICY public_read_published_lessons ON public.course_lessons
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.course_modules m
          JOIN  public.pages p ON p.id = m.page_id
          WHERE m.id = course_lessons.module_id
            AND p.page_type = 'course'
            AND p.status = 'published'
        )
      );
  END IF;
END $$;

-- ── PostgREST schema-reload notification ────────────────────────────────────
NOTIFY pgrst, 'reload schema';
