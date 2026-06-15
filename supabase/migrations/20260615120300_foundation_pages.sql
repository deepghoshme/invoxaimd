-- ============================================================================
-- invoxai.io — Foundation migration 4/4: Pages (builder + renderer source)
-- ----------------------------------------------------------------------------
-- Every public seller surface is a row here. Singleton types (website/store/
-- bio/courses) are one-per-store; the rest are "many" and addressed by a short
-- random public_id (nanoid) per URL-STRUCTURE.md. content/seo/pixels are JSONB
-- so the renderer + builder stay schema-stable as templates evolve.
-- ============================================================================

do $$ begin
  create type public.page_type as enum
    ('website', 'store', 'bio', 'courses',   -- singletons (one per store)
     'opp', 'pay', 'book', 'ldf', 'vpc', 'led', 'env');  -- many
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.page_status as enum ('draft', 'published');
exception when duplicate_object then null; end $$;

create table if not exists public.pages (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id) on delete cascade,
  page_type   public.page_type not null,
  -- Short, random, non-sequential id for "many" page types (e.g. opp/a7Bx9KmQ).
  -- Null for singletons. Generated app-side (nanoid) for guess-resistance.
  public_id   text,
  -- Optional human slug (e.g. opp/summer-sale). Unique per store when set.
  slug        text,

  title       text,
  template_id text,                              -- which template renders this
  content     jsonb not null default '{}'::jsonb, -- editable sections/blocks
  seo         jsonb not null default '{}'::jsonb, -- title, description, og, canonical, robots, schema
  pixels      jsonb not null default '{}'::jsonb, -- { meta_pixel_id, google_id, ... }

  status      public.page_status not null default 'draft',
  is_premium  boolean not null default false,    -- premium template (paid)
  published_at timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (store_id, public_id),
  unique (store_id, slug)
);
comment on table public.pages is 'All seller public pages. JSONB content/seo/pixels keep the renderer schema-stable.';

-- One singleton page per type per store (website/store/bio/courses).
create unique index if not exists pages_singleton_uidx
  on public.pages (store_id, page_type)
  where page_type in ('website', 'store', 'bio', 'courses');

create index if not exists pages_store_idx     on public.pages (store_id);
create index if not exists pages_public_id_idx on public.pages (public_id) where public_id is not null;
create index if not exists pages_published_idx on public.pages (store_id, status);

drop trigger if exists pages_set_updated_at on public.pages;
create trigger pages_set_updated_at
  before update on public.pages
  for each row execute function public.set_updated_at();

-- RLS -----------------------------------------------------------------------
-- Sellers manage only pages within a store they own; admins see all. Public
-- rendering of PUBLISHED pages is performed server-side with the service role
-- (subdomain/custom-domain resolution), so anon gets no direct table access.
alter table public.pages enable row level security;

drop policy if exists pages_owner_all on public.pages;
create policy pages_owner_all on public.pages
  for all
  using (public.owns_store(store_id) or public.is_admin())
  with check (public.owns_store(store_id) or public.is_admin());
