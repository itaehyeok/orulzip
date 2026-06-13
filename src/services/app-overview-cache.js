import { query, withClient } from "./db.js";

const APP_OVERVIEW_CACHE_KEY = "app-overview-v1";
const DEFAULT_CACHE_MAX_AGE_HOURS = 24;

export async function readAppOverviewCache({ maxAgeHours = DEFAULT_CACHE_MAX_AGE_HOURS } = {}) {
  const cached = await query(`
    select payload, refreshed_at
    from app_cache_entries
    where cache_key = $1
      and refreshed_at >= now() - make_interval(hours => $2::int)
  `, [APP_OVERVIEW_CACHE_KEY, maxAgeHours]);

  if (cached.rows[0]) {
    return {
      ...cached.rows[0].payload,
      cache: {
        hit: true,
        refreshedAt: cached.rows[0].refreshed_at
      }
    };
  }

  return refreshAppOverviewCache();
}

export async function refreshAppOverviewCache() {
  const overview = await buildAppOverview();
  const saved = await withClient(async (client) => {
    const result = await client.query(`
      insert into app_cache_entries (cache_key, payload, refreshed_at)
      values ($1, $2, now())
      on conflict (cache_key) do update set
        payload = excluded.payload,
        refreshed_at = now()
      returning refreshed_at
    `, [APP_OVERVIEW_CACHE_KEY, overview]);
    return result.rows[0];
  });

  return {
    ...overview,
    cache: {
      hit: false,
      refreshedAt: saved.refreshed_at
    }
  };
}

async function buildAppOverview() {
  const [counts, months, updatedAt, regionStats, neighborhoods, mapCache] = await Promise.all([
    query(`
      select
        (select count(*)::int from apartments) as apartments,
        (select count(*)::int from area_types) as area_types,
        (select count(*)::int from monthly_prices) as monthly_prices
    `),
    query(`
      select distinct year_month
      from monthly_prices
      where year_month is not null
      order by year_month
    `),
    query(`select max(updated_at) as updated_at from monthly_prices`),
    query(`
      with apartment_counts as (
        select region_id, count(*)::int as apartments
        from apartments
        group by region_id
      ),
      area_counts as (
        select a.region_id, count(at.id)::int as area_types
        from apartments a
        left join area_types at on at.apartment_id = a.id
        group by a.region_id
      ),
      price_counts as (
        select a.region_id, count(mp.id)::int as monthly_prices
        from monthly_prices mp
        join area_types at on at.id = mp.area_type_id
        join apartments a on a.id = at.apartment_id
        group by a.region_id
      )
      select
        ac.region_id,
        ac.apartments,
        coalesce(arc.area_types, 0)::int as area_types,
        coalesce(pc.monthly_prices, 0)::int as monthly_prices
      from apartment_counts ac
      left join area_counts arc on arc.region_id = ac.region_id
      left join price_counts pc on pc.region_id = ac.region_id
      order by ac.region_id
    `),
    query(`
      select distinct
        coalesce(region_id, '') as region_id,
        coalesce(neighborhood_name, '미분류') as name,
        coalesce(legal_dong_code, '') as legal_dong_code
      from apartments
      order by region_id, name
    `),
    query(`
      select
        count(*)::int as snapshots,
        max(updated_at) as updated_at,
        min(start_month) as start_month,
        max(end_month) as end_month
      from map_growth_snapshots
      where source = 'kb'
    `)
  ]);

  const countRow = counts.rows[0] || {};
  const mapCacheRow = mapCache.rows[0] || {};
  return {
    meta: {
      source: "kb_internal_mvp",
      syncedAt: updatedAt.rows[0]?.updated_at || null
    },
    counts: {
      apartments: Number(countRow.apartments || 0),
      areaTypes: Number(countRow.area_types || 0),
      monthlyPrices: Number(countRow.monthly_prices || 0)
    },
    months: months.rows.map((row) => row.year_month),
    regionStats: regionStats.rows.map((row) => ({
      regionId: row.region_id,
      apartments: Number(row.apartments || 0),
      areaTypes: Number(row.area_types || 0),
      monthlyPrices: Number(row.monthly_prices || 0)
    })),
    neighborhoods: neighborhoods.rows.map((row) => ({
      regionId: row.region_id,
      name: row.name,
      legalDongCode: row.legal_dong_code
    })),
    mapCache: {
      snapshots: Number(mapCacheRow.snapshots || 0),
      updatedAt: mapCacheRow.updated_at || null,
      startMonth: mapCacheRow.start_month || "",
      endMonth: mapCacheRow.end_month || ""
    }
  };
}
