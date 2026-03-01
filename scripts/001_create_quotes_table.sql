-- Create quotes table with auto-incrementing quote numbers starting at 1000
create sequence if not exists quote_number_seq start with 1000 increment by 1;

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text unique not null default ('PP-' || nextval('quote_number_seq')::text),
  customer_name text,
  product_type text not null,
  job_details jsonb not null,
  total_price numeric(10,2) not null,
  per_unit_price numeric(10,2),
  quantity integer not null,
  pdf_url text,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

-- No RLS -- this is an internal shop tool, not customer-facing auth
alter table public.quotes disable row level security;

-- Index on quote_number for fast lookups
create index if not exists idx_quotes_quote_number on public.quotes (quote_number);
