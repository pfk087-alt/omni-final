-- Run once in Supabase SQL Editor. Only server-side service role access is used.
-- Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the private Vercel environment.
create table if not exists public.affiliate_click_events (
  id bigint generated always as identity primary key,
  product_id text not null,
  network text not null default 'amazon',
  destination text not null,
  affiliate_tag text not null,
  clicked_at timestamptz not null default now()
);

create index if not exists affiliate_click_events_clicked_at_idx
  on public.affiliate_click_events (clicked_at);

create table if not exists public.affiliate_earnings (
  id bigint generated always as identity primary key,
  transaction_id text not null unique,
  network text not null,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null,
  status text not null check (status in ('pending', 'confirmed', 'reversed')),
  occurred_at timestamptz not null,
  source_reference text,
  created_at timestamptz not null default now()
);

create index if not exists affiliate_earnings_occurred_at_idx
  on public.affiliate_earnings (occurred_at, status);

alter table public.affiliate_click_events enable row level security;
alter table public.affiliate_earnings enable row level security;
revoke all on public.affiliate_click_events from anon, authenticated;
revoke all on public.affiliate_earnings from anon, authenticated;
