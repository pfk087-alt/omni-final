create table if not exists public.affiliate_catalog (
  id text primary key check (id = 'home'),
  products jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.affiliate_catalog enable row level security;
grant usage on schema public to anon;

drop policy if exists "Public can read affiliate catalog" on public.affiliate_catalog;
create policy "Public can read affiliate catalog"
  on public.affiliate_catalog for select to anon using (true);

grant select on public.affiliate_catalog to anon;
