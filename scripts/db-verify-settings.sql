select
  (select count(*) from public.platform_settings) as rows,
  (select show_brand_badge from public.platform_settings limit 1) as show_brand_badge,
  (select count(*) from pg_policies where tablename = 'platform_settings') as policies,
  (select relrowsecurity from pg_class where relname = 'platform_settings') as rls_enabled;
