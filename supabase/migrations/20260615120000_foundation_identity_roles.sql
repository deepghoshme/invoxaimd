-- ============================================================================
-- invoxai.io — Foundation migration 1/4: Identity, roles & RLS helpers
-- ----------------------------------------------------------------------------
-- One account system (auth.users) with roles in a SEPARATE user_roles table.
-- We deliberately do NOT store role on profiles: keeping roles in their own
-- table + SECURITY DEFINER helper functions is the Supabase-recommended way to
-- avoid infinite RLS recursion (a policy that queries the same table it guards).
-- A single human can simultaneously be a buyer, a seller and (rarely) an admin.
-- ============================================================================

-- Extensions ----------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid(), crypt()

-- Roles ---------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('admin', 'seller', 'buyer');
exception when duplicate_object then null; end $$;

-- Profiles (1:1 with auth.users) --------------------------------------------
-- Global identity keyed by email. This is the buyer corner identity too: the
-- same person buying from many sellers is ONE profile.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.profiles is 'Global per-user profile, 1:1 with auth.users. Buyer + seller + admin identity.';

create table if not exists public.user_roles (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users (id) on delete cascade,
  role     public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
comment on table public.user_roles is 'Role assignments. Separate from profiles to avoid RLS recursion.';

create index if not exists user_roles_user_id_idx on public.user_roles (user_id);

-- updated_at helper ---------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- RLS helper functions (SECURITY DEFINER bypasses RLS to break recursion) ----
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'admin');
$$;

-- New-user trigger: create profile + grant the baseline 'buyer' role ---------
-- Everyone is a buyer by default (buyer corner). The 'seller' role is granted
-- later, when the user creates a store (see migration 3).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'buyer')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS -----------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.user_roles enable row level security;

-- profiles: a user sees/edits only their own row; admins see all.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- (No INSERT policy: rows are created by the SECURITY DEFINER trigger only.)

-- user_roles: a user can read their own roles; only admins may modify.
drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own on public.user_roles
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists user_roles_admin_write on public.user_roles;
create policy user_roles_admin_write on public.user_roles
  for all using (public.is_admin()) with check (public.is_admin());
