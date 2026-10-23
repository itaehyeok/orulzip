create table if not exists kb_daily_area_fetches (
  area_type_id text primary key references area_types(id),
  status text not null check (status in ('completed','no_price','failed')),
  price_count integer not null default 0,
  latest_month text,
  last_attempt_at timestamptz not null default now(),
  last_success_at timestamptz,
  error_message text
);
create index if not exists kb_daily_area_fetches_success_idx on kb_daily_area_fetches(last_success_at);
