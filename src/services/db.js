import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://orulzip:orulzip@127.0.0.1:5432/orulzip"
});

export async function query(sql, params = []) {
  return pool.query(sql, params);
}

export async function withClient(callback) {
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

export async function initDb() {
  await query(`
    create table if not exists apartments (
      id text primary key,
      region_id text not null,
      source text not null,
      source_complex_id bigint not null,
      name text not null,
      neighborhood_name text,
      legal_dong_code text,
      address text,
      built_year text,
      household_count integer,
      lat double precision,
      lng double precision,
      updated_at timestamptz not null default now()
    );

    create table if not exists area_types (
      id text primary key,
      apartment_id text not null references apartments(id) on delete cascade,
      source_area_id bigint not null,
      label text,
      supply_area_m2 numeric,
      supply_area_pyeong numeric,
      exclusive_area_m2 numeric,
      exclusive_area_pyeong numeric,
      household_count integer,
      updated_at timestamptz not null default now()
    );

    create table if not exists monthly_prices (
      id text primary key,
      area_type_id text not null references area_types(id) on delete cascade,
      year_month text not null,
      sale_low integer,
      sale_mid integer not null,
      sale_high integer,
      pyeong_price integer not null,
      source text not null,
      updated_at timestamptz not null default now()
    );

    create index if not exists monthly_prices_area_month_idx on monthly_prices(area_type_id, year_month);
    create index if not exists monthly_prices_month_idx on monthly_prices(year_month);
    create index if not exists apartments_region_idx on apartments(region_id);
    create index if not exists apartments_neighborhood_idx on apartments(neighborhood_name);

    create table if not exists crawl_jobs (
      id bigserial primary key,
      region_id text not null,
      status text not null default 'requested',
      max_complexes integer not null default 100,
      years_back integer not null default 10,
      max_area_types_per_complex integer not null default 2,
      max_tiles integer not null default 50,
      delay_min_ms integer not null default 15000,
      delay_max_ms integer not null default 60000,
      total_complexes integer not null default 0,
      completed_complexes integer not null default 0,
      failed_complexes integer not null default 0,
      current_complex_id bigint,
      current_complex_name text,
      error_message text,
      started_at timestamptz,
      finished_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists crawl_queue (
      id bigserial primary key,
      job_id bigint not null references crawl_jobs(id) on delete cascade,
      source_complex_id bigint not null,
      marker jsonb not null,
      status text not null default 'pending',
      attempts integer not null default 0,
      error_message text,
      started_at timestamptz,
      completed_at timestamptz,
      updated_at timestamptz not null default now(),
      unique(job_id, source_complex_id)
    );

    create index if not exists crawl_queue_job_status_idx on crawl_queue(job_id, status, id);

    create table if not exists crawl_logs (
      id bigserial primary key,
      job_id bigint references crawl_jobs(id) on delete cascade,
      level text not null,
      message text not null,
      details jsonb,
      created_at timestamptz not null default now()
    );

    create table if not exists molit_trade_deals (
      id text primary key,
      source text not null default 'molit_apt_trade_detail',
      target_region_id text not null,
      lawd_cd text not null,
      sgg_cd text,
      deal_year_month text not null,
      deal_year integer,
      deal_month integer,
      deal_day integer,
      apt_name text,
      apt_dong text,
      legal_dong text,
      jibun text,
      floor integer,
      build_year integer,
      exclusive_area_m2 numeric,
      deal_amount integer,
      pyeong_price integer,
      cancel_type text,
      cancel_day text,
      registration_date text,
      dealing_type text,
      estate_agent_sgg_name text,
      buyer_type text,
      seller_type text,
      raw jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists molit_trade_deals_target_month_idx
      on molit_trade_deals(target_region_id, deal_year_month);
    create index if not exists molit_trade_deals_lawd_month_idx
      on molit_trade_deals(lawd_cd, deal_year_month);
    create index if not exists molit_trade_deals_apt_idx
      on molit_trade_deals(apt_name, legal_dong);

    create table if not exists molit_trade_fetches (
      id bigserial primary key,
      target_region_id text not null,
      lawd_cd text not null,
      lawd_name text not null,
      year_month text not null,
      status text not null default 'pending',
      total_count integer not null default 0,
      fetched_count integer not null default 0,
      saved_count integer not null default 0,
      filtered_count integer not null default 0,
      page_count integer not null default 0,
      error_message text,
      started_at timestamptz,
      completed_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(target_region_id, lawd_cd, year_month)
    );

    create index if not exists molit_trade_fetches_status_idx
      on molit_trade_fetches(status, target_region_id, year_month);

    create table if not exists map_growth_snapshots (
      id bigserial primary key,
      source text not null default 'kb',
      period_years integer not null,
      start_month text not null,
      end_month text not null,
      apartment_count integer not null default 0,
      area_count integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(source, period_years, start_month, end_month)
    );

    create table if not exists map_growth_items (
      snapshot_id bigint not null references map_growth_snapshots(id) on delete cascade,
      level text not null,
      item_key text not null,
      item_name text not null,
      apartment_id text,
      neighborhood_name text,
      address text,
      lat double precision,
      lng double precision,
      apartment_count integer not null default 0,
      area_count integer not null default 0,
      area_summary text,
      growth_rate double precision,
      growth_amount integer,
      start_pyeong_price integer,
      end_pyeong_price integer,
      has_data boolean not null default true,
      updated_at timestamptz not null default now(),
      primary key(snapshot_id, level, item_key)
    );

    create index if not exists map_growth_snapshots_period_idx
      on map_growth_snapshots(source, start_month, end_month, updated_at desc);
    create index if not exists map_growth_items_lookup_idx
      on map_growth_items(snapshot_id, level, lat, lng);
  `);
}

export async function closeDb() {
  await pool.end();
}
