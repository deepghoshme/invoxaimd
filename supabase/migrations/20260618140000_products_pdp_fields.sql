-- Full Shopify-style PDP fields for catalog products.
alter table public.products
  add column if not exists highlights   jsonb not null default '[]'::jsonb,   -- string[] key bullets
  add column if not exists options      jsonb not null default '[]'::jsonb,   -- [{ name, values:[] }] variant pickers
  add column if not exists reviews       jsonb not null default '[]'::jsonb,   -- [{ name, rating, text, date }]
  add column if not exists rating        numeric(2,1),
  add column if not exists reviews_count integer,
  add column if not exists stock         integer,                              -- null = unlimited
  add column if not exists sku           text,
  add column if not exists vendor        text,
  add column if not exists shipping_info text,
  add column if not exists returns_info  text,
  add column if not exists trust_badges  jsonb not null default '[]'::jsonb;   -- string[]

notify pgrst, 'reload schema';
