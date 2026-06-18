-- ============================================================================
-- invoxai.io — Store-scoped team members (seats)
-- ----------------------------------------------------------------------------
-- This is NOT the platform-level user_roles table (which holds seller/buyer/admin).
-- team_members is per-store seats: a seller can invite teammates with limited
-- roles (editor / admin / viewer) to help manage their store.
--
-- Isolation model:
--   • Only the store OWNER may insert / update / delete team_members rows for
--     their store (uses the existing owns_store() SECURITY DEFINER helper).
--   • A team member who has signed up can read their own row (email match).
--   • Admins (platform) may select all.
-- ============================================================================

-- ── Enums ------------------------------------------------------------------
do $$ begin
  create type public.team_role as enum ('admin', 'editor', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invite_status as enum ('invited', 'active');
exception when duplicate_object then null; end $$;

-- ── Table ------------------------------------------------------------------
create table if not exists public.team_members (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id) on delete cascade,

  -- Who was invited. email is the key for matching when the invitee signs up.
  email       text not null,
  full_name   text,                       -- filled when the invite is accepted
  avatar_url  text,

  role        public.team_role   not null default 'editor',
  status      public.invite_status not null default 'invited',

  invited_at  timestamptz not null default now(),
  accepted_at timestamptz,               -- set when status -> active
  updated_at  timestamptz not null default now(),

  -- One seat per email per store.
  unique (store_id, email)
);

comment on table public.team_members is
  'Store-scoped team seats. Separate from platform user_roles (seller/buyer/admin). '
  'One row per invited teammate; role controls dashboard permissions within the store.';

create index if not exists team_members_store_idx on public.team_members (store_id);
create index if not exists team_members_email_idx on public.team_members (lower(email));

-- ── updated_at trigger -----------------------------------------------------
drop trigger if exists team_members_set_updated_at on public.team_members;
create trigger team_members_set_updated_at
  before update on public.team_members
  for each row execute function public.set_updated_at();

-- ── RLS --------------------------------------------------------------------
alter table public.team_members enable row level security;

-- Store owner: full access to their own store's team
drop policy if exists team_members_owner_all on public.team_members;
create policy team_members_owner_all on public.team_members
  for all
  using  (public.owns_store(store_id))
  with check (public.owns_store(store_id));

-- Invited user: can read their own invite row (matched by auth email)
drop policy if exists team_members_self_select on public.team_members;
create policy team_members_self_select on public.team_members
  for select
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Platform admins: read-all
drop policy if exists team_members_admin_select on public.team_members;
create policy team_members_admin_select on public.team_members
  for select
  using (public.is_admin());
