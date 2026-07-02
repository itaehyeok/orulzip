do $$
begin
  if to_regclass('area_types') is not null then
    execute '
      create index if not exists area_types_apartment_exclusive_area_idx
        on area_types(apartment_id, exclusive_area_m2)
        where exclusive_area_m2 is not null
    ';
  end if;
end $$;

do $$
declare
  constraint_name text;
begin
  if to_regclass('map_growth_snapshots') is null then
    return;
  end if;

  alter table map_growth_snapshots
    add column if not exists metric text not null default 'rate';

  update map_growth_snapshots
    set metric = 'rate'
    where metric is null or metric = '';

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

do $$
begin
  if to_regclass('map_growth_snapshots') is not null then
    execute 'drop index if exists map_growth_snapshots_household_filter_uidx';
    execute '
      create unique index if not exists map_growth_snapshots_household_filter_uidx
        on map_growth_snapshots(source, metric, period_years, start_month, end_month, min_household_count)
    ';
    execute '
      create index if not exists map_growth_snapshots_metric_period_idx
        on map_growth_snapshots(source, metric, start_month, end_month, updated_at desc)
    ';
    execute '
      create index if not exists map_growth_snapshots_metric_filter_lookup_idx
        on map_growth_snapshots(source, metric, start_month, end_month, min_household_count, updated_at desc)
    ';
  end if;
end $$;

do $$
begin
  if to_regclass('map_growth_items') is not null then
    execute '
      alter table map_growth_items
        add column if not exists start_sale_price integer,
        add column if not exists end_sale_price integer,
        add column if not exists representative_area_m2 numeric,
        add column if not exists representative_basis text
    ';
  end if;

  if to_regclass('map_dong_apartment_rank_items') is not null then
    execute '
      alter table map_dong_apartment_rank_items
        add column if not exists start_sale_price integer,
        add column if not exists end_sale_price integer,
        add column if not exists representative_area_m2 numeric,
        add column if not exists representative_basis text
    ';
  end if;
end $$;
