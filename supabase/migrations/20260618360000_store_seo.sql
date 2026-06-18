-- Migration: store-level SEO defaults + pixel IDs
-- Idempotent: every statement uses IF NOT EXISTS / default-only ALTER.

ALTER TABLE stores ADD COLUMN IF NOT EXISTS default_meta_title       text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS default_meta_description text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS og_image_url             text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS meta_pixel_id            text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS google_analytics_id      text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS google_ads_id            text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS seo_indexable            boolean DEFAULT true;

-- Notify PostgREST to reload its schema cache so new columns are visible
-- immediately without a process restart.
NOTIFY pgrst, 'reload schema';
