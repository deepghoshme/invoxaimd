-- ============================================================================
-- invoxai.io — SMART recharge-reminder mail: admin-configurable active window
--              and inactive/no-revenue path behaviour.
-- ----------------------------------------------------------------------------
-- Builds on the existing reminder config in public.platform_settings
-- (recharge_reminder_enabled, recharge_reminder_min_interval_min,
--  recharge_reminder_active_only, recharge_reminder_min_revenue_paise — added by
--  migration 20260619230000_wallet_gate_reminders.sql).
--
-- What this migration adds (the two genuinely new "smart" knobs):
--   1. recharge_reminder_active_window_days  — how many days of look-back define
--      an "ACTIVE" seller (recent order / login). Previously hardcoded to 30.
--   2. recharge_reminder_inactive_action — what to do with sellers who are NOT
--      active or have NO/low revenue: 'skip' (send nothing) or 'nudge' (send a
--      different, softer re-engagement mail instead of the friendly recharge one).
--
-- The qualifying ("ACTIVE + HIGH REVENUE") sellers get the existing friendly
-- recharge mail. Non-qualifying sellers follow recharge_reminder_inactive_action.
--
-- RLS: platform_settings is covered by the existing
--   platform_settings_admin_write policy (for all using (public.is_admin())
--   with check (public.is_admin())) — new columns inherit it. No new policy.
--
-- MONEY SAFETY: these are threshold / behaviour-flag columns only. No money is
--   charged, credited, or moved by this migration.
--
-- Idempotent: all DDL uses ADD COLUMN IF NOT EXISTS / guarded constraint add.
-- Apply via:
--   node scripts/db-apply.mjs supabase/migrations/20260620010000_smart_reminder_mail.sql
-- ============================================================================

-- Admin-configurable activity look-back window (days). An ACTIVE seller is one
-- with a paid order (or an active subscription) within this many days. Default 14.
alter table public.platform_settings
  add column if not exists recharge_reminder_active_window_days int not null default 14;

comment on column public.platform_settings.recharge_reminder_active_window_days is
  'Number of days of look-back that define an ACTIVE seller for the smart '
  'recharge-reminder job. A seller is ACTIVE if they have at least one paid order '
  '(or an active subscription) within this window. Only ACTIVE sellers whose '
  'revenue also meets recharge_reminder_min_revenue_paise receive the friendly '
  'recharge mail. Default 14. Admin-configurable.';

-- Behaviour for sellers who are NOT active or have NO/low revenue.
--   'skip'  → send nothing (default; do not spam dormant sellers).
--   'nudge' → send a different, softer re-engagement email instead.
alter table public.platform_settings
  add column if not exists recharge_reminder_inactive_action text not null default 'skip';

comment on column public.platform_settings.recharge_reminder_inactive_action is
  'What the smart recharge-reminder job does with sellers who do NOT qualify '
  '(not active within the active window, or revenue below the threshold). '
  '''skip'' = send nothing (default). ''nudge'' = send a different, softer '
  're-engagement email instead of the friendly recharge mail. Admin-configurable: '
  '"if not active or no revenue, set a different parameter/behaviour in admin side."';

-- Guard the allowed values without failing if the constraint already exists.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'platform_settings_reminder_inactive_action_chk'
  ) then
    alter table public.platform_settings
      add constraint platform_settings_reminder_inactive_action_chk
      check (recharge_reminder_inactive_action in ('skip', 'nudge'));
  end if;
end $$;

-- ============================================================================
-- PostgREST schema cache reload
-- ============================================================================

notify pgrst, 'reload schema';
