-- Add a key/value details (specs) list to catalog products (gallery already exists).
alter table public.products add column if not exists details jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
