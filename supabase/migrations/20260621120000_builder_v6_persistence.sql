-- Page Builder v6 — persistence.
-- Additive + non-destructive: new nullable columns on pages + a new global
-- themes reference table. Legacy rows (content.v absent) are untouched and keep
-- rendering via the old renderer. Safe to re-run (idempotent).

-- v6 page meta stored as columns (canonical); the Section[] lives in
-- pages.content under content.v = 6.
alter table public.pages add column if not exists theme_id text;
alter table public.pages add column if not exists page_bg  text;

-- Global theme palette (13 seed themes). Reference data: world-readable.
create table if not exists public.themes (
  id         text primary key,
  name       text not null,
  brand      text not null,
  b2         text not null,
  acc        text not null,
  created_at timestamptz not null default now()
);
comment on table public.themes is 'Page Builder v6 global theme palette (seed of 13).';

alter table public.themes enable row level security;
drop policy if exists themes_read_all on public.themes;
create policy themes_read_all on public.themes for select using (true);

-- Seed the 13 themes (must match lib/builder/themes.ts).
insert into public.themes (id, name, brand, b2, acc) values
  ('violet',   'Violet',   '#7C3AED', '#A855F7', '#06B6D4'),
  ('ocean',    'Ocean',    '#2563EB', '#3B82F6', '#06B6D4'),
  ('emerald',  'Emerald',  '#059669', '#10B981', '#84CC16'),
  ('sunset',   'Sunset',   '#F97316', '#FB923C', '#EF4444'),
  ('rose',     'Rose',     '#E11D48', '#F43F5E', '#FB7185'),
  ('midnight', 'Midnight', '#1E293B', '#334155', '#38BDF8'),
  ('gold',     'Gold',     '#D97706', '#F59E0B', '#FCD34D'),
  ('teal',     'Teal',     '#0D9488', '#14B8A6', '#2DD4BF'),
  ('crimson',  'Crimson',  '#DC2626', '#EF4444', '#F87171'),
  ('indigo',   'Indigo',   '#4F46E5', '#6366F1', '#818CF8'),
  ('forest',   'Forest',   '#166534', '#16A34A', '#4ADE80'),
  ('slate',    'Slate',    '#475569', '#64748B', '#94A3B8'),
  ('magenta',  'Magenta',  '#C026D3', '#D946EF', '#F0ABFC')
on conflict (id) do nothing;
