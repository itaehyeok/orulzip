do $$
declare
  constraint_name text;
begin
  if to_regclass('price_band_rank_snapshots') is null then
    return;
  end if;

  alter table price_band_rank_snapshots
    add column if not exists status text not null default 'active',
    add column if not exists activated_at timestamptz,
    add column if not exists superseded_at timestamptz,
    add column if not exists build_error text;

  update price_band_rank_snapshots
    set status = 'active',
        activated_at = coalesce(activated_at, updated_at)
    where status = 'active'
      and activated_at is null;

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

  drop index if exists price_band_rank_snapshots_household_filter_uidx;
  drop index if exists price_band_rank_snapshots_household_area_filter_uidx;

  create unique index if not exists price_band_rank_snapshots_active_uidx
    on price_band_rank_snapshots(
      source,
      basis,
      start_month,
      end_month,
      min_household_count,
      area_band_key
    )
    where status = 'active';

  drop index if exists price_band_rank_snapshots_filter_lookup_idx;
  create index price_band_rank_snapshots_filter_lookup_idx
    on price_band_rank_snapshots(
      source,
      basis,
      start_month,
      end_month,
      min_household_count,
      area_band_key,
      status,
      updated_at desc
    );

  create index if not exists price_band_rank_snapshots_status_idx
    on price_band_rank_snapshots(status, updated_at desc);
end $$;
