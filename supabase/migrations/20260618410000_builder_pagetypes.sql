-- The course/booking/event/vip builders use these page_type values for their
-- "many" pages. The original enum only had abbreviated slots; add the explicit
-- values the builders actually insert. ADD VALUE IF NOT EXISTS is idempotent and
-- safe (we never use the new value in this same transaction).
alter type public.page_type add value if not exists 'course';
alter type public.page_type add value if not exists 'booking';
alter type public.page_type add value if not exists 'event';
alter type public.page_type add value if not exists 'vip';

notify pgrst, 'reload schema';
