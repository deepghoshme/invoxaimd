-- VIP: relax the vip_members.plan CHECK constraint.
-- The builder lets sellers define arbitrary plan ids (e.g. plan_1750000000000),
-- but the original constraint only allowed ('monthly','yearly','lifetime'), so
-- joins on custom plans violated the CHECK and the member row was silently lost.
-- Apply via: node scripts/db-apply.mjs supabase/migrations/20260619120000_vip_plan_constraint_relax.sql

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'vip_members'
  ) then
    -- Drop the old restrictive plan CHECK constraint (name may vary across envs)
    alter table public.vip_members drop constraint if exists vip_members_plan_check;
    -- Re-add a permissive constraint: any non-null plan id is allowed
    alter table public.vip_members add constraint vip_members_plan_check check (plan is not null);
  end if;
end $$;

-- Notify PostgREST to reload schema
notify pgrst, 'reload schema';
