create table if not exists collection_runs (
  id bigserial primary key,
  provider text not null check (provider in ('molit', 'kb')),
  scheduled_date date not null,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  error_message text
);
create index if not exists collection_runs_provider_started_idx on collection_runs(provider, started_at desc);
create index if not exists collection_runs_provider_status_idx on collection_runs(provider, status, started_at desc);
