create table if not exists performance_measurement_runs (
  id bigserial primary key,
  environment text not null default 'unknown',
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now(),
  duration_ms integer not null default 0,
  issue_count integer not null default 0,
  warning_count integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  measurements jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists performance_measurement_runs_created_idx
  on performance_measurement_runs(created_at desc);

create index if not exists performance_measurement_runs_environment_created_idx
  on performance_measurement_runs(environment, created_at desc);
