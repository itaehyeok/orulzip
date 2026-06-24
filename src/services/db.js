import pg from "pg";

const { Pool } = pg;

const defaultDatabaseUrl = "postgres://orulzip:orulzip@127.0.0.1:5432/orulzip";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || defaultDatabaseUrl
});

const analyticsPool = new Pool({
  connectionString: process.env.ANALYTICS_DATABASE_URL || process.env.DATABASE_URL || defaultDatabaseUrl
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

export async function analyticsQuery(sql, params = []) {
  return analyticsPool.query(sql, params);
}

export async function withAnalyticsClient(callback) {
  const client = await analyticsPool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

export async function initDb() {
  if (process.env.ORULZIP_DB_INIT === "0") return { skipped: true };

  await query(`
    create extension if not exists pg_trgm;

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
      source_job_id bigint references crawl_jobs(id) on delete set null,
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

    alter table crawl_jobs
      add column if not exists source_job_id bigint references crawl_jobs(id) on delete set null;

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
    create index if not exists crawl_queue_job_completed_idx on crawl_queue(job_id, completed_at);

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
    create index if not exists molit_trade_deals_complex_match_idx
      on molit_trade_deals (
        lawd_cd,
        (coalesce(trim(legal_dong), '')),
        (coalesce(trim(jibun), '')),
        (regexp_replace(lower(coalesce(apt_name, '')), '[^0-9a-z가-힣]', '', 'g')),
        deal_year_month,
        exclusive_area_m2
      )
      where exclusive_area_m2 is not null
        and deal_amount is not null
        and coalesce(cancel_type, '') = '';
    create index if not exists molit_trade_deals_month_complex_match_idx
      on molit_trade_deals (
        deal_year_month,
        lawd_cd,
        (coalesce(trim(legal_dong), '')),
        (coalesce(trim(jibun), '')),
        (regexp_replace(lower(coalesce(apt_name, '')), '[^0-9a-z가-힣]', '', 'g')),
        exclusive_area_m2
      )
      include (deal_amount, pyeong_price, deal_year, deal_month, deal_day)
      where exclusive_area_m2 is not null
        and deal_amount is not null
        and pyeong_price is not null
        and coalesce(cancel_type, '') = '';

    create table if not exists molit_complexes (
      id text primary key,
      lawd_cd text not null,
      lawd_name text,
      legal_dong text,
      jibun text,
      apt_name text not null,
      normalized_apt_name text not null,
      address text,
      sido_code text,
      sido_name text,
      sigungu_code text,
      sigungu_name text,
      dong_key text,
      dong_name text,
      target_region_ids text,
      build_year integer,
      deal_count integer not null default 0,
      first_month text,
      last_month text,
      matched_apartment_id text,
      match_method text,
      match_score numeric,
      kb_lat double precision,
      kb_lng double precision,
      geocoded_lat double precision,
      geocoded_lng double precision,
      geocode_provider text,
      geocode_status text not null default 'pending',
      geocode_query text,
      geocode_error text,
      geocoded_at timestamptz,
      lat double precision,
      lng double precision,
      coord_source text,
      coord_status text not null default 'missing',
      distance_to_kb_m integer,
      needs_review boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table molit_complexes
      add column if not exists sido_code text,
      add column if not exists sido_name text,
      add column if not exists sigungu_code text,
      add column if not exists sigungu_name text,
      add column if not exists dong_key text,
      add column if not exists dong_name text,
      add column if not exists reb_complex_pk text,
      add column if not exists reb_household_count integer,
      add column if not exists reb_dong_count integer,
      add column if not exists reb_match_score integer,
      add column if not exists reb_match_source text,
      add column if not exists reb_matched_at timestamptz;

    create table if not exists reb_apt_identity_raw (
      complex_pk text primary key,
      pnu text,
      adres text,
      complex_nm1 text,
      complex_nm2 text,
      complex_nm3 text,
      complex_gb_cd text,
      dong_cnt integer,
      unit_cnt integer,
      useapr_dt text,
      imported_at timestamptz not null default now()
    );

    alter table reb_apt_identity_raw
      add column if not exists pnu text,
      add column if not exists adres text,
      add column if not exists complex_nm1 text,
      add column if not exists complex_nm2 text,
      add column if not exists complex_nm3 text,
      add column if not exists complex_gb_cd text,
      add column if not exists dong_cnt integer,
      add column if not exists unit_cnt integer,
      add column if not exists useapr_dt text,
      add column if not exists imported_at timestamptz not null default now();

    create table if not exists reb_apt_identity_apartment_norm (
      complex_pk text primary key,
      pnu text,
      lawd_cd text,
      adres text,
      adres_norm text,
      complex_nm1 text,
      complex_nm2 text,
      complex_nm3 text,
      complex_nm1_norm text,
      complex_nm2_norm text,
      complex_nm3_norm text,
      complex_gb_cd text,
      dong_cnt integer,
      unit_cnt integer,
      useapr_dt text,
      imported_at timestamptz not null default now()
    );

    alter table reb_apt_identity_apartment_norm
      add column if not exists pnu text,
      add column if not exists lawd_cd text,
      add column if not exists adres text,
      add column if not exists adres_norm text,
      add column if not exists complex_nm1 text,
      add column if not exists complex_nm2 text,
      add column if not exists complex_nm3 text,
      add column if not exists complex_nm1_norm text,
      add column if not exists complex_nm2_norm text,
      add column if not exists complex_nm3_norm text,
      add column if not exists complex_gb_cd text,
      add column if not exists dong_cnt integer,
      add column if not exists unit_cnt integer,
      add column if not exists useapr_dt text,
      add column if not exists imported_at timestamptz not null default now();

    create index if not exists molit_complexes_lawd_dong_idx
      on molit_complexes(lawd_cd, legal_dong);
    create index if not exists molit_complexes_deal_match_idx
      on molit_complexes(lawd_cd, legal_dong, jibun, normalized_apt_name);
    create index if not exists molit_complexes_hierarchy_idx
      on molit_complexes(sido_code, sigungu_code, dong_key);
    create index if not exists molit_complexes_coord_idx
      on molit_complexes(lat, lng);
    create index if not exists molit_complexes_review_idx
      on molit_complexes(needs_review, distance_to_kb_m desc);
    create index if not exists molit_complexes_name_trgm_idx
      on molit_complexes using gin (normalized_apt_name gin_trgm_ops);
    create index if not exists molit_complexes_reb_household_idx
      on molit_complexes(reb_household_count);
    create index if not exists molit_complexes_reb_complex_idx
      on molit_complexes(reb_complex_pk);
    create index if not exists reb_apt_identity_raw_type_idx
      on reb_apt_identity_raw(complex_gb_cd);
    create index if not exists reb_apt_identity_raw_unit_idx
      on reb_apt_identity_raw(unit_cnt);
    create index if not exists reb_apt_identity_norm_lawd_idx
      on reb_apt_identity_apartment_norm(lawd_cd);
    create index if not exists reb_apt_identity_norm_unit_idx
      on reb_apt_identity_apartment_norm(unit_cnt);
    create index if not exists reb_apt_identity_norm_adres_trgm_idx
      on reb_apt_identity_apartment_norm using gin (adres_norm gin_trgm_ops);
    create index if not exists reb_apt_identity_norm_nm1_trgm_idx
      on reb_apt_identity_apartment_norm using gin (complex_nm1_norm gin_trgm_ops);

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
      min_household_count integer not null default 0,
      apartment_count integer not null default 0,
      area_count integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(source, period_years, start_month, end_month)
    );

    alter table map_growth_snapshots
      add column if not exists min_household_count integer not null default 0;

    do $$
    declare
      constraint_name text;
    begin
      select con.conname
        into constraint_name
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      where nsp.nspname = current_schema()
        and rel.relname = 'map_growth_snapshots'
        and con.contype = 'u'
        and array(
          select att.attname::text
          from unnest(con.conkey) with ordinality keys(attnum, ord)
          join pg_attribute att on att.attrelid = con.conrelid and att.attnum = keys.attnum
          order by keys.ord
        ) = array['source', 'period_years', 'start_month', 'end_month']::text[]
      limit 1;

      if constraint_name is not null then
        execute format('alter table map_growth_snapshots drop constraint %I', constraint_name);
      end if;
    end $$;

    create table if not exists map_growth_items (
      snapshot_id bigint not null references map_growth_snapshots(id) on delete cascade,
      level text not null,
      item_key text not null,
      item_name text not null,
      apartment_id text,
      neighborhood_name text,
      address text,
      sido_code text,
      sido_name text,
      sigungu_code text,
      sigungu_name text,
      dong_key text,
      dong_name text,
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

    alter table map_growth_items
      add column if not exists sido_code text,
      add column if not exists sido_name text,
      add column if not exists sigungu_code text,
      add column if not exists sigungu_name text,
      add column if not exists dong_key text,
      add column if not exists dong_name text;

    create index if not exists map_growth_snapshots_period_idx
      on map_growth_snapshots(source, start_month, end_month, updated_at desc);
    create unique index if not exists map_growth_snapshots_household_filter_uidx
      on map_growth_snapshots(source, period_years, start_month, end_month, min_household_count);
    create index if not exists map_growth_snapshots_filter_lookup_idx
      on map_growth_snapshots(source, start_month, end_month, min_household_count, updated_at desc);
    create index if not exists map_growth_items_lookup_idx
      on map_growth_items(snapshot_id, level, lat, lng);
    create index if not exists map_growth_items_hierarchy_idx
      on map_growth_items(snapshot_id, level, sido_code, sigungu_code, dong_key);

    create table if not exists map_dong_apartment_rank_items (
      snapshot_id bigint not null references map_growth_snapshots(id) on delete cascade,
      dong_key text not null,
      dong_name text,
      dong_rank integer not null,
      dong_rank_total integer not null,
      sigungu_rank integer,
      sigungu_rank_total integer,
      sido_rank integer,
      sido_rank_total integer,
      country_rank integer,
      country_rank_total integer,
      apartment_id text not null,
      item_name text not null,
      neighborhood_name text,
      address text,
      sido_code text,
      sido_name text,
      sigungu_code text,
      sigungu_name text,
      lat double precision,
      lng double precision,
      apartment_count integer not null default 1,
      area_count integer not null default 0,
      area_summary text,
      growth_rate double precision,
      growth_amount integer,
      start_pyeong_price integer,
      end_pyeong_price integer,
      has_data boolean not null default true,
      updated_at timestamptz not null default now(),
      primary key(snapshot_id, dong_key, dong_rank),
      unique(snapshot_id, dong_key, apartment_id)
    );

    create index if not exists map_dong_apartment_rank_lookup_idx
      on map_dong_apartment_rank_items(snapshot_id, dong_key, dong_rank);
    create index if not exists map_dong_apartment_rank_sigungu_idx
      on map_dong_apartment_rank_items(snapshot_id, sigungu_code, sigungu_rank);
    create index if not exists map_dong_apartment_rank_sido_idx
      on map_dong_apartment_rank_items(snapshot_id, sido_code, sido_rank);
    create index if not exists map_dong_apartment_rank_country_idx
      on map_dong_apartment_rank_items(snapshot_id, country_rank);
    create index if not exists map_dong_apartment_rank_apartment_idx
      on map_dong_apartment_rank_items(snapshot_id, apartment_id);
    create index if not exists map_dong_apartment_rank_bounds_idx
      on map_dong_apartment_rank_items(snapshot_id, lat, lng);

    create table if not exists apartment_rank_snapshots (
      id bigserial primary key,
      source text not null default 'kb',
      metric text not null,
      period_months integer not null,
      start_month text not null,
      end_month text not null,
      item_count integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(source, metric, start_month, end_month)
    );

    create table if not exists apartment_rank_items (
      snapshot_id bigint not null references apartment_rank_snapshots(id) on delete cascade,
      rank integer not null,
      apartment_id text not null,
      apartment_name text not null,
      neighborhood_name text,
      legal_dong_code text,
      address text,
      area_type_count integer not null default 0,
      area_label text,
      observed_month_count integer not null default 0,
      average_pyeong_price integer,
      start_pyeong_price integer,
      end_pyeong_price integer,
      growth_amount integer,
      growth_rate double precision,
      updated_at timestamptz not null default now(),
      primary key(snapshot_id, rank),
      unique(snapshot_id, apartment_id)
    );

    create index if not exists apartment_rank_snapshots_lookup_idx
      on apartment_rank_snapshots(source, metric, start_month, end_month, updated_at desc);
    create index if not exists apartment_rank_items_apartment_idx
      on apartment_rank_items(snapshot_id, apartment_id);

    create table if not exists price_band_rank_snapshots (
      id bigserial primary key,
      source text not null default 'kb',
      basis text not null,
      period_months integer not null,
      start_month text not null,
      end_month text not null,
      min_household_count integer not null default 0,
      band_count integer not null default 0,
      item_count integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(source, basis, start_month, end_month)
    );

    alter table price_band_rank_snapshots
      add column if not exists min_household_count integer not null default 0;
    alter table price_band_rank_snapshots
      add column if not exists area_band_key text not null default 'all';
    alter table price_band_rank_snapshots
      add column if not exists area_band_label text not null default '전체 평형';

    do $$
    declare
      constraint_name text;
    begin
      select con.conname
        into constraint_name
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      where nsp.nspname = current_schema()
        and rel.relname = 'price_band_rank_snapshots'
        and con.contype = 'u'
        and array(
          select att.attname::text
          from unnest(con.conkey) with ordinality keys(attnum, ord)
          join pg_attribute att on att.attrelid = con.conrelid and att.attnum = keys.attnum
          order by keys.ord
        ) = array['source', 'basis', 'start_month', 'end_month']::text[]
      limit 1;

      if constraint_name is not null then
        execute format('alter table price_band_rank_snapshots drop constraint %I', constraint_name);
      end if;
    end $$;

    create table if not exists price_band_rank_items (
      snapshot_id bigint not null references price_band_rank_snapshots(id) on delete cascade,
      band_key integer not null,
      band_label text not null,
      rank integer not null,
      apartment_id text not null,
      apartment_name text not null,
      neighborhood_name text,
      legal_dong_code text,
      area_type_count integer not null default 0,
      area_label text,
      start_sale_price integer,
      end_sale_price integer,
      start_pyeong_price integer,
      end_pyeong_price integer,
      growth_amount integer,
      growth_rate double precision,
      updated_at timestamptz not null default now(),
      primary key(snapshot_id, band_key, rank),
      unique(snapshot_id, band_key, apartment_id)
    );

    create index if not exists price_band_rank_snapshots_lookup_idx
      on price_band_rank_snapshots(source, basis, start_month, end_month, updated_at desc);
    drop index if exists price_band_rank_snapshots_household_filter_uidx;
    create unique index if not exists price_band_rank_snapshots_household_area_filter_uidx
      on price_band_rank_snapshots(source, basis, start_month, end_month, min_household_count, area_band_key);
    drop index if exists price_band_rank_snapshots_filter_lookup_idx;
    create index if not exists price_band_rank_snapshots_filter_lookup_idx
      on price_band_rank_snapshots(source, basis, start_month, end_month, min_household_count, area_band_key, updated_at desc);
    alter table price_band_rank_items
      add column if not exists address text;
    alter table price_band_rank_items
      add column if not exists area_summaries jsonb;
    create index if not exists price_band_rank_items_band_idx
      on price_band_rank_items(snapshot_id, band_key, rank);
    create index if not exists price_band_rank_items_apartment_idx
      on price_band_rank_items(snapshot_id, apartment_id);

    create table if not exists app_cache_entries (
      cache_key text primary key,
      payload jsonb not null,
      created_at timestamptz not null default now(),
      refreshed_at timestamptz not null default now()
    );

    create table if not exists data_health_runs (
      id bigserial primary key,
      environment text not null default 'unknown',
      status text not null,
      started_at timestamptz not null default now(),
      finished_at timestamptz not null default now(),
      issue_count integer not null default 0,
      warning_count integer not null default 0,
      summary jsonb not null default '{}'::jsonb,
      checks jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now()
    );

    create index if not exists data_health_runs_created_idx
      on data_health_runs(created_at desc);
    create index if not exists data_health_runs_environment_created_idx
      on data_health_runs(environment, created_at desc);
  `);
}

export async function initAnalyticsDb() {
  await analyticsQuery(`
    create schema if not exists analytics;

    create table if not exists analytics.visitors (
      visitor_id text primary key,
      first_seen_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now(),
      event_count integer not null default 0,
      page_view_count integer not null default 0,
      last_ip_hash text,
      last_user_agent text,
      last_path text,
      last_is_admin boolean not null default false,
      last_user_info jsonb not null default '{}'::jsonb,
      is_internal boolean not null default false,
      internal_reason text,
      internal_marked_at timestamptz
    );

    alter table analytics.visitors
      add column if not exists is_internal boolean not null default false,
      add column if not exists internal_reason text,
      add column if not exists internal_marked_at timestamptz,
      add column if not exists last_user_info jsonb not null default '{}'::jsonb;

    create table if not exists analytics.sessions (
      session_id text primary key,
      visitor_id text not null references analytics.visitors(visitor_id) on delete cascade,
      started_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now(),
      event_count integer not null default 0,
      page_view_count integer not null default 0,
      entry_path text,
      exit_path text,
      is_admin boolean not null default false
    );

    create table if not exists analytics.events (
      id bigserial primary key,
      visitor_id text not null references analytics.visitors(visitor_id) on delete cascade,
      session_id text not null references analytics.sessions(session_id) on delete cascade,
      event_name text not null,
      path text,
      title text,
      referrer text,
      metadata jsonb not null default '{}'::jsonb,
      user_info jsonb not null default '{}'::jsonb,
      host text,
      environment text not null default 'unknown',
      ip_hash text,
      user_agent text,
      is_admin boolean not null default false,
      is_internal boolean not null default false,
      created_at timestamptz not null default now()
    );

    alter table analytics.events
      add column if not exists host text,
      add column if not exists environment text not null default 'unknown',
      add column if not exists is_internal boolean not null default false,
      add column if not exists user_info jsonb not null default '{}'::jsonb;

    create index if not exists analytics_events_created_idx
      on analytics.events(created_at desc);
    create index if not exists analytics_events_environment_created_idx
      on analytics.events(environment, created_at desc);
    create index if not exists analytics_events_host_created_idx
      on analytics.events(host, created_at desc);
    create index if not exists analytics_events_name_path_idx
      on analytics.events(event_name, path, created_at desc);
    create index if not exists analytics_events_visitor_idx
      on analytics.events(visitor_id, created_at desc);
    create index if not exists analytics_sessions_visitor_idx
      on analytics.sessions(visitor_id, last_seen_at desc);
    create index if not exists analytics_visitors_last_seen_idx
      on analytics.visitors(last_seen_at desc);

    do $$
    begin
      if to_regclass('public.analytics_visitors') is not null then
        insert into analytics.visitors (
          visitor_id,
          first_seen_at,
          last_seen_at,
          event_count,
          page_view_count,
          last_ip_hash,
          last_user_agent,
          last_path,
          last_is_admin,
          last_user_info,
          is_internal,
          internal_reason,
          internal_marked_at
        )
        select
          visitor_id,
          first_seen_at,
          last_seen_at,
          event_count,
          page_view_count,
          last_ip_hash,
          last_user_agent,
          last_path,
          last_is_admin,
          '{}'::jsonb,
          false,
          null,
          null
        from public.analytics_visitors
        on conflict (visitor_id) do nothing;
      end if;

      if to_regclass('public.analytics_sessions') is not null then
        insert into analytics.sessions (
          session_id,
          visitor_id,
          started_at,
          last_seen_at,
          event_count,
          page_view_count,
          entry_path,
          exit_path,
          is_admin
        )
        select
          session_id,
          visitor_id,
          started_at,
          last_seen_at,
          event_count,
          page_view_count,
          entry_path,
          exit_path,
          is_admin
        from public.analytics_sessions
        on conflict (session_id) do nothing;
      end if;

      if to_regclass('public.analytics_events') is not null then
        insert into analytics.events (
          id,
          visitor_id,
          session_id,
          event_name,
          path,
          title,
          referrer,
          metadata,
          user_info,
          host,
          environment,
          ip_hash,
          user_agent,
          is_admin,
          is_internal,
          created_at
        )
        select
          id,
          visitor_id,
          session_id,
          event_name,
          path,
          title,
          referrer,
          metadata,
          '{}'::jsonb,
          null,
          'unknown',
          ip_hash,
          user_agent,
          is_admin,
          false,
          created_at
        from public.analytics_events
        on conflict (id) do nothing;

        perform setval(
          'analytics.events_id_seq',
          greatest((select coalesce(max(id), 0) from analytics.events), 1),
          true
        );
      end if;
    end $$;

    do $$
    begin
      if exists (select 1 from pg_roles where rolname = 'orulzip_analytics_writer') then
        grant usage on schema analytics to orulzip_analytics_writer;
        grant select, insert, update on analytics.visitors, analytics.sessions, analytics.events to orulzip_analytics_writer;
        grant usage, select on sequence analytics.events_id_seq to orulzip_analytics_writer;
      end if;
    exception when insufficient_privilege then
      null;
    end $$;
  `);
}

export async function closeDb() {
  await Promise.all([
    pool.end(),
    analyticsPool.end()
  ]);
}
