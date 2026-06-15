import { query, withClient } from "./db.js";
import { refreshAppOverviewCache } from "./app-overview-cache.js";
import { readDatasetFromDb } from "./db-store.js";
import { buildApartmentRankings, getAvailableMonths } from "./price-calculator.js";

export const DEFAULT_MAP_CACHE_PERIOD_YEARS = [0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const MAP_CACHE_REFRESH_LOCK_ID = 442061301;

export async function readMapGrowthCacheOverview() {
  const result = await query(`
    select
      count(*)::int as snapshots,
      max(updated_at) as updated_at,
      min(start_month) as start_month,
      max(end_month) as end_month
    from map_growth_snapshots
    where source = 'kb'
  `);
  const row = result.rows[0] || {};
  return {
    snapshots: Number(row.snapshots || 0),
    updatedAt: row.updated_at || null,
    startMonth: row.start_month || "",
    endMonth: row.end_month || ""
  };
}

export async function readCachedZoomMapSummary(filters) {
  const startMonth = filters.start || "";
  const endMonth = filters.end || "";
  if (!startMonth || !endMonth) return null;
  const source = filters.source || "kb";

  const snapshotResult = await query(`
    select *
    from map_growth_snapshots
    where source = $3
      and start_month = $1
      and end_month = $2
    order by updated_at desc
    limit 1
  `, [startMonth, endMonth, source]);
  const snapshot = snapshotResult.rows[0];
  if (!snapshot) return null;

  const level = zoomAggregationLevel(filters.zoom);
  const params = [snapshot.id, level];
  const boundsClause = boundsWhereClause(filters, params);
  const itemsResult = level === "apartment"
    ? await query(`
      with ranked as (
        select
          mgi.*,
          row_number() over (
            partition by coalesce(
              nullif(mgi.dong_key, ''),
              concat(mgi.address, ':', mgi.neighborhood_name)
            )
            order by
              mgi.has_data desc,
              mgi.growth_rate desc nulls last,
              mgi.item_name asc
          )::int as dong_rank,
          count(*) over (
            partition by coalesce(
              nullif(mgi.dong_key, ''),
              concat(mgi.address, ':', mgi.neighborhood_name)
            )
          )::int as dong_rank_total,
          row_number() over (
            partition by coalesce(nullif(mgi.sigungu_code, ''), substring(mgi.dong_key from 1 for 5))
            order by
              mgi.has_data desc,
              mgi.growth_rate desc nulls last,
              mgi.item_name asc
          )::int as sigungu_rank,
          count(*) over (
            partition by coalesce(nullif(mgi.sigungu_code, ''), substring(mgi.dong_key from 1 for 5))
          )::int as sigungu_rank_total,
          row_number() over (
            partition by coalesce(nullif(mgi.sido_code, ''), substring(mgi.dong_key from 1 for 2))
            order by
              mgi.has_data desc,
              mgi.growth_rate desc nulls last,
              mgi.item_name asc
          )::int as sido_rank,
          count(*) over (
            partition by coalesce(nullif(mgi.sido_code, ''), substring(mgi.dong_key from 1 for 2))
          )::int as sido_rank_total,
          row_number() over (
            order by
              mgi.has_data desc,
              mgi.growth_rate desc nulls last,
              mgi.item_name asc
          )::int as country_rank,
          count(*) over ()::int as country_rank_total
        from map_growth_items mgi
        where mgi.snapshot_id = $1
          and mgi.level = $2
      )
      select *
      from ranked
      where true
        ${boundsClause}
      order by
        has_data desc,
        growth_rate desc nulls last,
        apartment_count desc,
        item_name asc
      limit 2000
    `, params)
    : level === "dong"
      ? await query(`
        with ranked as (
          select
            mgi.*,
            row_number() over (
              partition by coalesce(nullif(mgi.sigungu_code, ''), substring(mgi.item_key from 1 for 5))
              order by
                mgi.has_data desc,
                mgi.growth_rate desc nulls last,
                mgi.item_name asc
            )::int as sigungu_rank,
            count(*) over (
              partition by coalesce(nullif(mgi.sigungu_code, ''), substring(mgi.item_key from 1 for 5))
            )::int as sigungu_rank_total,
            row_number() over (
              partition by coalesce(nullif(mgi.sido_code, ''), substring(mgi.item_key from 1 for 2))
              order by
                mgi.has_data desc,
                mgi.growth_rate desc nulls last,
                mgi.item_name asc
            )::int as sido_rank,
            count(*) over (
              partition by coalesce(nullif(mgi.sido_code, ''), substring(mgi.item_key from 1 for 2))
            )::int as sido_rank_total,
            row_number() over (
              order by
                mgi.has_data desc,
                mgi.growth_rate desc nulls last,
                mgi.item_name asc
            )::int as country_rank,
            count(*) over ()::int as country_rank_total
          from map_growth_items mgi
          where mgi.snapshot_id = $1
            and mgi.level = $2
        )
        select *
        from ranked
        where true
          ${boundsClause}
        order by
          has_data desc,
          growth_rate desc nulls last,
          apartment_count desc,
          item_name asc
      `, params)
    : level === "sigungu"
      ? await query(`
        with ranked as (
          select
            mgi.*,
            row_number() over (
              partition by coalesce(nullif(mgi.sido_code, ''), substring(mgi.item_key from 1 for 2))
              order by
                mgi.has_data desc,
                mgi.growth_rate desc nulls last,
                mgi.item_name asc
            )::int as sido_rank,
            count(*) over (
              partition by coalesce(nullif(mgi.sido_code, ''), substring(mgi.item_key from 1 for 2))
            )::int as sido_rank_total,
            row_number() over (
              order by
                mgi.has_data desc,
                mgi.growth_rate desc nulls last,
                mgi.item_name asc
            )::int as country_rank,
            count(*) over ()::int as country_rank_total
          from map_growth_items mgi
          where mgi.snapshot_id = $1
            and mgi.level = $2
        )
        select *
        from ranked
        where true
          ${boundsClause}
        order by
          has_data desc,
          growth_rate desc nulls last,
          apartment_count desc,
          item_name asc
      `, params)
    : await query(`
      select *
      from map_growth_items
      where snapshot_id = $1
        and level = $2
        ${boundsClause}
      order by
        has_data desc,
        growth_rate desc nulls last,
        apartment_count desc,
        item_name asc
    `, params);

  return {
    level,
    zoom: filters.zoom,
    period: {
      startMonth: snapshot.start_month,
      endMonth: snapshot.end_month
    },
    cache: {
      hit: true,
      source,
      updatedAt: snapshot.updated_at,
      periodYears: Number(snapshot.period_years)
    },
    items: itemsResult.rows.map((row) => serializeCachedItem(row, level))
  };
}

export async function refreshMolitMapGrowthCache({ periodYears = DEFAULT_MAP_CACHE_PERIOD_YEARS } = {}) {
  const today = todayKstDateString();
  const endMonth = today.slice(0, 7).replace("-", "");
  const rows = await readMolitMatchedMonthlyRows(today);
  if (!rows.length) {
    return {
      refreshedAt: new Date().toISOString(),
      snapshots: [],
      reason: "No matched MOLIT trade data"
    };
  }

  const snapshots = [];
  for (const period of normalizedPeriods(periodYears)) {
    const startMonth = addMonths(endMonth, -period.months);
    const items = buildMolitCacheItems(rows, { startMonth, endMonth });
    const snapshot = await saveSnapshot({
      source: "molit",
      periodYears: period.storageYears,
      startMonth,
      endMonth,
      apartmentCount: items.apartmentCount,
      areaCount: items.areaCount,
      items: items.rows
    });
    snapshots.push(snapshot);
  }

  return {
    refreshedAt: new Date().toISOString(),
    snapshots
  };
}

export async function readApartmentMapRankSummary({
  source = "kb",
  apartmentId,
  startMonth = "",
  endMonth = ""
} = {}) {
  if (!apartmentId || !startMonth || !endMonth) return null;
  const result = await query(`
    with snapshot as (
      select id
      from map_growth_snapshots
      where source = $1
        and start_month = $2
        and end_month = $3
      order by updated_at desc
      limit 1
    ),
    ranked as (
      select
        mgi.*,
        row_number() over (
          partition by coalesce(nullif(mgi.dong_key, ''), concat(mgi.address, ':', mgi.neighborhood_name))
          order by
            mgi.has_data desc,
            mgi.growth_rate desc nulls last,
            mgi.item_name asc
        )::int as dong_rank,
        count(*) over (
          partition by coalesce(nullif(mgi.dong_key, ''), concat(mgi.address, ':', mgi.neighborhood_name))
        )::int as dong_rank_total,
        row_number() over (
          partition by coalesce(nullif(mgi.sigungu_code, ''), substring(mgi.item_key from 1 for 5))
          order by
            mgi.has_data desc,
            mgi.growth_rate desc nulls last,
            mgi.item_name asc
        )::int as sigungu_rank,
        count(*) over (
          partition by coalesce(nullif(mgi.sigungu_code, ''), substring(mgi.item_key from 1 for 5))
        )::int as sigungu_rank_total,
        row_number() over (
          partition by coalesce(nullif(mgi.sido_code, ''), substring(mgi.item_key from 1 for 2))
          order by
            mgi.has_data desc,
            mgi.growth_rate desc nulls last,
            mgi.item_name asc
        )::int as sido_rank,
        count(*) over (
          partition by coalesce(nullif(mgi.sido_code, ''), substring(mgi.item_key from 1 for 2))
        )::int as sido_rank_total,
        row_number() over (
          order by
            mgi.has_data desc,
            mgi.growth_rate desc nulls last,
            mgi.item_name asc
        )::int as country_rank,
        count(*) over ()::int as country_rank_total
      from map_growth_items mgi
      join snapshot s on s.id = mgi.snapshot_id
      where mgi.level = 'apartment'
    )
    select *
    from ranked
    where apartment_id = $4
    limit 1
  `, [source, startMonth, endMonth, apartmentId]);
  const row = result.rows[0];
  if (!row) return null;
  return {
    source,
    startMonth,
    endMonth,
    hasData: row.has_data,
    growthRate: row.growth_rate === null ? null : Number(row.growth_rate),
    dongName: row.dong_name || row.neighborhood_name || "",
    sigunguName: row.sigungu_name || "",
    sidoName: row.sido_name || "",
    dongRank: row.dong_rank === null ? null : Number(row.dong_rank),
    dongRankTotal: row.dong_rank_total === null ? null : Number(row.dong_rank_total),
    sigunguRank: row.sigungu_rank === null ? null : Number(row.sigungu_rank),
    sigunguRankTotal: row.sigungu_rank_total === null ? null : Number(row.sigungu_rank_total),
    sidoRank: row.sido_rank === null ? null : Number(row.sido_rank),
    sidoRankTotal: row.sido_rank_total === null ? null : Number(row.sido_rank_total),
    countryRank: row.country_rank === null ? null : Number(row.country_rank),
    countryRankTotal: row.country_rank_total === null ? null : Number(row.country_rank_total)
  };
}

export async function buildMolitApartmentDetail(apartmentId) {
  const normalizedApartmentId = normalizeApartmentPrimaryId(apartmentId);
  const today = todayKstDateString();
  const currentMonth = today.slice(0, 7).replace("-", "");
  const [complexResult, monthlyResult, recentResult] = await Promise.all([
    query(`
      select id, apt_name, legal_dong, lawd_cd, address,
             sido_code, sido_name, sigungu_code, sigungu_name, dong_key, dong_name,
             build_year, lat, lng, deal_count
      from molit_complexes
      where id = $1
    `, [normalizedApartmentId]),
    query(`
      select
        round(d.exclusive_area_m2::numeric, 2) as exclusive_area_m2,
        d.deal_year_month,
        round(avg(d.deal_amount))::int as sale_mid,
        min(d.deal_amount)::int as sale_low,
        max(d.deal_amount)::int as sale_high,
        round(avg(d.pyeong_price))::int as pyeong_price,
        count(*)::int as deal_count
      from molit_trade_deals d
      join molit_complexes c
        on c.id = $1
       and c.lawd_cd = d.lawd_cd
       and c.legal_dong = coalesce(trim(d.legal_dong), '')
       and c.jibun = coalesce(trim(d.jibun), '')
       and c.normalized_apt_name = regexp_replace(lower(coalesce(d.apt_name, '')), '[^0-9a-z가-힣]', '', 'g')
      where d.exclusive_area_m2 is not null
        and d.deal_amount is not null
        and d.pyeong_price is not null
        and coalesce(d.cancel_type, '') = ''
      group by round(d.exclusive_area_m2::numeric, 2), d.deal_year_month
      order by exclusive_area_m2, d.deal_year_month
    `, [normalizedApartmentId]),
    query(`
      select
        round(d.exclusive_area_m2::numeric, 2) as exclusive_area_m2,
        round(avg(d.deal_amount))::int as sale_mid,
        min(d.deal_amount)::int as sale_low,
        max(d.deal_amount)::int as sale_high,
        round(avg(d.pyeong_price))::int as pyeong_price,
        count(*)::int as deal_count
      from molit_trade_deals d
      join molit_complexes c
        on c.id = $1
       and c.lawd_cd = d.lawd_cd
       and c.legal_dong = coalesce(trim(d.legal_dong), '')
       and c.jibun = coalesce(trim(d.jibun), '')
       and c.normalized_apt_name = regexp_replace(lower(coalesce(d.apt_name, '')), '[^0-9a-z가-힣]', '', 'g')
      where d.exclusive_area_m2 is not null
        and d.deal_amount is not null
        and d.pyeong_price is not null
        and coalesce(d.cancel_type, '') = ''
        and make_date(d.deal_year, d.deal_month, d.deal_day) between $2::date - interval '30 days' and $2::date
      group by round(d.exclusive_area_m2::numeric, 2)
    `, [normalizedApartmentId, today])
  ]);

  const apartment = serializeMolitComplexRow(complexResult.rows[0]);
  if (!apartment) {
    return { apartment: null, areaTypes: [], months: [] };
  }
  if (!monthlyResult.rows.length) {
    return { apartment, areaTypes: [], months: [] };
  }

  const firstMonth = monthlyResult.rows.reduce((min, row) =>
    !min || row.deal_year_month < min ? row.deal_year_month : min
  , "");
  const months = monthRange(firstMonth, currentMonth);
  const recentByType = new Map(recentResult.rows.map((row) => [String(row.exclusive_area_m2), serializeMolitPrice(row)]));
  const types = new Map();
  for (const row of monthlyResult.rows) {
    const typeKey = String(row.exclusive_area_m2);
    if (!types.has(typeKey)) {
      const exclusiveAreaM2 = Number(row.exclusive_area_m2);
      types.set(typeKey, {
        id: `molit:${normalizedApartmentId}:${typeKey}`,
        label: `전용 ${exclusiveAreaM2.toFixed(2)}㎡`,
        supplyAreaPyeong: exclusiveAreaM2 / 3.305785,
        exclusiveAreaPyeong: exclusiveAreaM2 / 3.305785,
        totalDealCount: 0,
        monthly: new Map()
      });
    }
    const type = types.get(typeKey);
    type.totalDealCount += Number(row.deal_count || 0);
    type.monthly.set(row.deal_year_month, serializeMolitPrice(row));
  }

  const areaTypes = [...types.entries()].map(([typeKey, type]) => {
    const prices = [];
    let carried = null;
    for (const yearMonth of months) {
      carried = type.monthly.get(yearMonth) || carried;
      const recent = yearMonth === currentMonth ? recentByType.get(typeKey) : null;
      const price = recent || carried;
      if (!price) continue;
      prices.push({
        yearMonth,
        saleLow: price.saleLow,
        saleMid: price.saleMid,
        saleHigh: price.saleHigh,
        pyeongPrice: price.pyeongPrice,
        dealCount: price.dealCount
      });
    }
    return {
      id: type.id,
      label: type.label,
      supplyAreaPyeong: type.supplyAreaPyeong,
      exclusiveAreaPyeong: type.exclusiveAreaPyeong,
      totalDealCount: type.totalDealCount,
      prices
    };
  }).filter((type) => type.prices.length);

  return {
    apartment,
    areaTypes,
    months: [...new Set(areaTypes.flatMap((item) => item.prices.map((price) => price.yearMonth)))].sort()
  };
}

export async function refreshMapGrowthCache({ periodYears = DEFAULT_MAP_CACHE_PERIOD_YEARS } = {}) {
  const dataset = await readDatasetFromDb();
  const months = getAvailableMonths(dataset);
  const endMonth = months.at(-1);
  if (!endMonth) {
    return {
      refreshedAt: new Date().toISOString(),
      snapshots: [],
      reason: "No monthly price data"
    };
  }

  const snapshots = [];
  for (const period of normalizedPeriods(periodYears)) {
    const requestedStart = addMonths(endMonth, -period.months);
    const ranking = buildApartmentRankings(dataset, {
      start: requestedStart,
      end: endMonth
    });
    if (!ranking.period.startMonth || !ranking.period.endMonth) continue;
    const items = buildCacheItems(dataset, ranking.rows);
    const snapshot = await saveSnapshot({
      periodYears: period.storageYears,
      startMonth: ranking.period.startMonth,
      endMonth: ranking.period.endMonth,
      apartmentCount: items.apartmentCount,
      areaCount: items.areaCount,
      items: items.rows
    });
    snapshots.push(snapshot);
  }

  const appOverview = await refreshAppOverviewCache();

  return {
    refreshedAt: new Date().toISOString(),
    snapshots,
    appOverviewCache: {
      refreshedAt: appOverview.cache.refreshedAt,
      counts: appOverview.counts,
      months: appOverview.months.length,
      regionStats: appOverview.regionStats.length,
      neighborhoods: appOverview.neighborhoods.length
    }
  };
}

export async function refreshMapGrowthCacheIfUnlocked(options = {}) {
  return withClient(async (client) => {
    const lockResult = await client.query("select pg_try_advisory_lock($1) as locked", [MAP_CACHE_REFRESH_LOCK_ID]);
    if (!lockResult.rows[0]?.locked) {
      return {
        refreshedAt: new Date().toISOString(),
        skipped: true,
        reason: "Map growth cache refresh is already running"
      };
    }

    try {
      return await refreshMapGrowthCache(options);
    } finally {
      await client.query("select pg_advisory_unlock($1)", [MAP_CACHE_REFRESH_LOCK_ID]);
    }
  });
}

function buildCacheItems(dataset, rankingRows) {
  const apartmentById = new Map(dataset.apartments.map((item) => [item.id, item]));
  const rows = rankingRows
    .map((row) => ({
      ...row,
      apartment: apartmentById.get(row.apartmentId)
    }))
    .filter((row) => row.apartment?.legalDongCode && Number.isFinite(row.apartment.lat) && Number.isFinite(row.apartment.lng));

  const apartmentItems = summarizeApartments(rows).map((item) => ({
    level: "apartment",
    itemKey: item.id,
    itemName: item.name,
    apartmentId: item.id,
    neighborhoodName: item.neighborhoodName,
    address: item.address,
    ...item.hierarchy,
    lat: item.lat,
    lng: item.lng,
    apartmentCount: 1,
    areaCount: item.areaCount,
    areaSummary: item.areaSummary,
    growthRate: item.growthRate,
    growthAmount: item.growthAmount,
    startPyeongPrice: item.startPyeongPrice,
    endPyeongPrice: item.endPyeongPrice,
    hasData: true
  }));
  const includedIds = new Set(apartmentItems.map((item) => item.apartmentId));
  const noDataApartmentItems = dataset.apartments
    .filter((apartment) => apartment?.legalDongCode && Number.isFinite(apartment.lat) && Number.isFinite(apartment.lng))
    .filter((apartment) => !includedIds.has(apartment.id))
    .map((apartment) => ({
      level: "apartment",
      itemKey: apartment.id,
      itemName: apartment.name,
      apartmentId: apartment.id,
      neighborhoodName: apartment.neighborhoodName,
      address: apartment.address,
      ...hierarchyFromApartment(apartment),
      lat: apartment.lat,
      lng: apartment.lng,
      apartmentCount: 1,
      areaCount: 0,
      areaSummary: "데이터없음",
      growthRate: null,
      growthAmount: null,
      startPyeongPrice: null,
      endPyeongPrice: null,
      hasData: false
    }));
  const groupItems = ["sido", "sigungu", "dong"].flatMap((level) => summarizeGroups(rows, level));

  return {
    apartmentCount: apartmentItems.length,
    areaCount: rankingRows.reduce((sum, row) => sum + Number(row.areaTypeCount || 1), 0),
    rows: [...groupItems, ...apartmentItems, ...noDataApartmentItems]
  };
}

async function readMolitMatchedMonthlyRows(today) {
  const [monthly, recent] = await Promise.all([
    query(`
      with matched as (
        select
          c.id as apartment_id,
          c.apt_name as apartment_name,
          c.legal_dong as neighborhood_name,
          c.dong_key as legal_dong_code,
          c.address,
          c.sido_code,
          c.sido_name,
          c.sigungu_code,
          c.sigungu_name,
          c.dong_key,
          c.dong_name,
          c.lat,
          c.lng,
          round(d.exclusive_area_m2::numeric, 2) as exclusive_area_m2,
          d.deal_year_month,
          d.deal_amount,
          d.pyeong_price
        from molit_trade_deals d
        join molit_complexes c
          on c.lawd_cd = d.lawd_cd
         and c.legal_dong = coalesce(trim(d.legal_dong), '')
         and c.jibun = coalesce(trim(d.jibun), '')
         and c.normalized_apt_name = regexp_replace(lower(coalesce(d.apt_name, '')), '[^0-9a-z가-힣]', '', 'g')
        where d.exclusive_area_m2 is not null
          and d.deal_amount is not null
          and d.pyeong_price is not null
          and coalesce(d.cancel_type, '') = ''
          and c.lat is not null
          and c.lng is not null
      )
      select
        apartment_id,
        apartment_name,
        neighborhood_name,
        legal_dong_code,
        address,
        sido_code,
        sido_name,
        sigungu_code,
        sigungu_name,
        dong_key,
        dong_name,
        lat,
        lng,
        exclusive_area_m2,
        deal_year_month,
        round(avg(deal_amount))::int as sale_mid,
        min(deal_amount)::int as sale_low,
        max(deal_amount)::int as sale_high,
        round(avg(pyeong_price))::int as pyeong_price,
        count(*)::int as deal_count
      from matched
      group by apartment_id, apartment_name, neighborhood_name, legal_dong_code, address,
               sido_code, sido_name, sigungu_code, sigungu_name, dong_key, dong_name,
               lat, lng, exclusive_area_m2, deal_year_month
      order by apartment_id, exclusive_area_m2, deal_year_month
    `),
    query(`
      with matched as (
        select
          c.id as apartment_id,
          round(d.exclusive_area_m2::numeric, 2) as exclusive_area_m2,
          d.deal_amount,
          d.pyeong_price
        from molit_trade_deals d
        join molit_complexes c
          on c.lawd_cd = d.lawd_cd
         and c.legal_dong = coalesce(trim(d.legal_dong), '')
         and c.jibun = coalesce(trim(d.jibun), '')
         and c.normalized_apt_name = regexp_replace(lower(coalesce(d.apt_name, '')), '[^0-9a-z가-힣]', '', 'g')
        where d.exclusive_area_m2 is not null
          and d.deal_amount is not null
          and d.pyeong_price is not null
          and coalesce(d.cancel_type, '') = ''
          and make_date(d.deal_year, d.deal_month, d.deal_day) between $1::date - interval '30 days' and $1::date
          and c.lat is not null
          and c.lng is not null
      )
      select
        apartment_id,
        exclusive_area_m2,
        round(avg(deal_amount))::int as sale_mid,
        min(deal_amount)::int as sale_low,
        max(deal_amount)::int as sale_high,
        round(avg(pyeong_price))::int as pyeong_price,
        count(*)::int as deal_count
      from matched
      group by apartment_id, exclusive_area_m2
    `, [today])
  ]);

  const recentByType = new Map(recent.rows.map((row) => [molitTypeKey(row.apartment_id, row.exclusive_area_m2), serializeMolitPrice(row)]));
  return monthly.rows.map((row) => ({
    apartment: {
      id: row.apartment_id,
      name: row.apartment_name,
      neighborhoodName: row.neighborhood_name || "",
      legalDongCode: row.legal_dong_code || "",
      address: row.address || "",
      sidoCode: row.sido_code || "",
      sidoName: row.sido_name || "",
      sigunguCode: row.sigungu_code || "",
      sigunguName: row.sigungu_name || "",
      dongKey: row.dong_key || "",
      dongName: row.dong_name || "",
      lat: Number(row.lat),
      lng: Number(row.lng)
    },
    typeKey: String(row.exclusive_area_m2),
    exclusiveAreaM2: Number(row.exclusive_area_m2),
    yearMonth: row.deal_year_month,
    price: serializeMolitPrice(row),
    recentPrice: recentByType.get(molitTypeKey(row.apartment_id, row.exclusive_area_m2)) || null
  }));
}

function buildMolitCacheItems(rows, { startMonth, endMonth }) {
  const apartments = groupMolitRows(rows);
  const rankingRows = [];

  for (const apartmentGroup of apartments.values()) {
    const typeSummaries = [...apartmentGroup.types.values()].map((type) => {
      const start = carriedMolitPriceAtOrBefore(type.monthly, startMonth);
      const end = type.recentPrice || carriedMolitPriceAtOrBefore(type.monthly, endMonth);
      if (!start || !end || !start.pyeongPrice) return null;
      return { type, start, end };
    }).filter(Boolean);
    if (!typeSummaries.length) continue;

    const startPyeongPrice = average(typeSummaries.map((item) => item.start.pyeongPrice));
    const endPyeongPrice = average(typeSummaries.map((item) => item.end.pyeongPrice));
    if (!startPyeongPrice || !endPyeongPrice) continue;

    rankingRows.push({
      apartmentId: apartmentGroup.apartment.id,
      apartment: apartmentGroup.apartment,
      areaTypeCount: typeSummaries.length,
      areaLabel: `${typeSummaries.length}개 타입`,
      growthRate: (endPyeongPrice - startPyeongPrice) / startPyeongPrice,
      growthAmount: endPyeongPrice - startPyeongPrice,
      startPyeongPrice,
      endPyeongPrice
    });
  }

  const apartmentItems = summarizeApartments(rankingRows).map((item) => ({
    level: "apartment",
    itemKey: item.id,
    itemName: item.name,
    apartmentId: item.id,
    neighborhoodName: item.neighborhoodName,
    address: item.address,
    ...item.hierarchy,
    lat: item.lat,
    lng: item.lng,
    apartmentCount: 1,
    areaCount: item.areaCount,
    areaSummary: item.areaSummary,
    growthRate: item.growthRate,
    growthAmount: item.growthAmount,
    startPyeongPrice: item.startPyeongPrice,
    endPyeongPrice: item.endPyeongPrice,
    hasData: true
  }));
  const includedIds = new Set(apartmentItems.map((item) => item.apartmentId));
  const noDataApartmentItems = [...apartments.values()]
    .filter((apartmentGroup) => {
      const apartment = apartmentGroup.apartment;
      return apartment?.legalDongCode && Number.isFinite(apartment.lat) && Number.isFinite(apartment.lng);
    })
    .filter((apartmentGroup) => !includedIds.has(apartmentGroup.apartment.id))
    .map((apartmentGroup) => ({
      level: "apartment",
      itemKey: apartmentGroup.apartment.id,
      itemName: apartmentGroup.apartment.name,
      apartmentId: apartmentGroup.apartment.id,
      neighborhoodName: apartmentGroup.apartment.neighborhoodName,
      address: apartmentGroup.apartment.address,
      ...hierarchyFromApartment(apartmentGroup.apartment),
      lat: apartmentGroup.apartment.lat,
      lng: apartmentGroup.apartment.lng,
      apartmentCount: 1,
      areaCount: apartmentGroup.types.size,
      areaSummary: "데이터없음",
      growthRate: null,
      growthAmount: null,
      startPyeongPrice: null,
      endPyeongPrice: null,
      hasData: false
    }));
  const groupItems = ["sido", "sigungu", "dong"].flatMap((level) => summarizeGroups(rankingRows, level));

  return {
    apartmentCount: apartmentItems.length,
    areaCount: rankingRows.reduce((sum, row) => sum + Number(row.areaTypeCount || 1), 0),
    rows: [...groupItems, ...apartmentItems, ...noDataApartmentItems]
  };
}

function groupMolitRows(rows) {
  const apartments = new Map();
  for (const row of rows) {
    if (!apartments.has(row.apartment.id)) {
      apartments.set(row.apartment.id, {
        apartment: row.apartment,
        types: new Map()
      });
    }
    const apartment = apartments.get(row.apartment.id);
    if (!apartment.types.has(row.typeKey)) {
      apartment.types.set(row.typeKey, {
        typeKey: row.typeKey,
        exclusiveAreaM2: row.exclusiveAreaM2,
        recentPrice: row.recentPrice,
        monthly: new Map()
      });
    }
    const type = apartment.types.get(row.typeKey);
    if (row.recentPrice) type.recentPrice = row.recentPrice;
    type.monthly.set(row.yearMonth, row.price);
  }
  return apartments;
}

function carriedMolitPriceAtOrBefore(monthly, yearMonth) {
  return [...monthly.entries()]
    .filter(([month]) => month <= yearMonth)
    .sort(([a], [b]) => b.localeCompare(a))[0]?.[1] || null;
}

function serializeMolitPrice(row) {
  return {
    saleMid: Number(row.sale_mid || 0),
    saleLow: Number(row.sale_low || 0),
    saleHigh: Number(row.sale_high || 0),
    pyeongPrice: Number(row.pyeong_price || 0),
    dealCount: Number(row.deal_count || 0)
  };
}

function molitTypeKey(apartmentId, exclusiveAreaM2) {
  return `${apartmentId}:${Number(exclusiveAreaM2).toFixed(2)}`;
}

async function saveSnapshot({ source = "kb", periodYears, startMonth, endMonth, apartmentCount, areaCount, items }) {
  return withClient(async (client) => {
    await client.query("begin");
    try {
      const snapshotResult = await client.query(`
        insert into map_growth_snapshots (
          source, period_years, start_month, end_month, apartment_count, area_count, updated_at
        ) values ($1, $2, $3, $4, $5, $6, now())
        on conflict (source, period_years, start_month, end_month) do update set
          apartment_count = excluded.apartment_count,
          area_count = excluded.area_count,
          updated_at = now()
        returning *
      `, [source, periodYears, startMonth, endMonth, apartmentCount, areaCount]);
      const snapshot = snapshotResult.rows[0];
      await client.query("delete from map_growth_items where snapshot_id = $1", [snapshot.id]);

      for (const item of items) {
        await client.query(`
          insert into map_growth_items (
            snapshot_id, level, item_key, item_name, apartment_id, neighborhood_name, address,
            sido_code, sido_name, sigungu_code, sigungu_name, dong_key, dong_name,
            lat, lng, apartment_count, area_count, area_summary, growth_rate, growth_amount,
            start_pyeong_price, end_pyeong_price, has_data, updated_at
          ) values (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,now()
          )
        `, [
          snapshot.id,
          item.level,
          item.itemKey,
          item.itemName,
          item.apartmentId || null,
          item.neighborhoodName || "",
          item.address || "",
          item.sidoCode || "",
          item.sidoName || "",
          item.sigunguCode || "",
          item.sigunguName || "",
          item.dongKey || "",
          item.dongName || "",
          item.lat,
          item.lng,
          item.apartmentCount || 0,
          item.areaCount || 0,
          item.areaSummary || "",
          item.growthRate,
          item.growthAmount,
          item.startPyeongPrice,
          item.endPyeongPrice,
          item.hasData !== false
        ]);
      }

      await client.query("commit");
      return {
        id: Number(snapshot.id),
        source,
        periodYears,
        startMonth,
        endMonth,
        apartmentCount,
        areaCount,
        itemCount: items.length,
        updatedAt: snapshot.updated_at
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

function summarizeGroups(rows, level) {
  const groups = new Map();
  for (const row of rows) {
    const group = zoomGroupInfo(row, rows, level);
    if (!groups.has(group.code)) {
      groups.set(group.code, {
        code: group.code,
        name: group.name,
        hierarchy: group.hierarchy,
        latValues: [],
        lngValues: [],
        growthRates: [],
        growthAmounts: [],
        apartmentIds: new Set(),
        areaCount: 0
      });
    }
    const current = groups.get(group.code);
    current.latValues.push(row.apartment.lat);
    current.lngValues.push(row.apartment.lng);
    current.growthRates.push(row.growthRate);
    current.growthAmounts.push(row.growthAmount);
    current.apartmentIds.add(row.apartmentId);
    current.areaCount += Number(row.areaTypeCount || 1);
  }

  return [...groups.values()]
    .map((group) => ({
      level,
      itemKey: group.code,
      itemName: group.name,
      ...group.hierarchy,
      lat: average(group.latValues),
      lng: average(group.lngValues),
      apartmentCount: group.apartmentIds.size,
      areaCount: group.areaCount,
      growthRate: average(group.growthRates),
      growthAmount: Math.round(average(group.growthAmounts)),
      hasData: true
    }))
    .sort((a, b) => b.apartmentCount - a.apartmentCount || b.growthRate - a.growthRate);
}

function summarizeApartments(rows) {
  return rows.map((row) => {
    const hierarchy = hierarchyFromApartment(row.apartment);
    return {
      id: row.apartment.id,
      name: row.apartment.name,
      neighborhoodName: row.apartment.neighborhoodName,
      address: row.apartment.address,
      hierarchy,
      lat: row.apartment.lat,
      lng: row.apartment.lng,
      areaCount: Number(row.areaTypeCount || 0),
      areaSummary: row.areaLabel || "-",
      growthRate: row.growthRate,
      growthAmount: Math.round(row.growthAmount),
      startPyeongPrice: Math.round(row.startPyeongPrice),
      endPyeongPrice: Math.round(row.endPyeongPrice)
    };
  });
}

function hierarchyFromApartment(apartment = {}) {
  const legalDongCode = apartment.legalDongCode || "";
  const sidoCode = apartment.sidoCode || legalDongCode.slice(0, 2);
  const sigunguCode = apartment.sigunguCode || legalDongCode.slice(0, 5);
  const dongKey = apartment.dongKey || (legalDongCode.length >= 8
    ? legalDongCode.slice(0, 8)
    : `${sigunguCode || "unknown"}:${apartment.neighborhoodName || apartment.address || "미분류"}`);
  const sidoLabel = apartment.sidoName || sidoName(sidoCode);
  const sigunguLabel = apartment.sigunguName || sigunguNameFromAddress(apartment.address || "", sigunguCode);
  const dongLabel = apartment.dongName || apartment.neighborhoodName || "미분류";
  return {
    sidoCode,
    sidoName: sidoLabel,
    sigunguCode,
    sigunguName: sigunguLabel,
    dongKey,
    dongName: dongLabel,
    dongDisplayName: sigunguLabel && !String(dongLabel).startsWith(sigunguLabel)
      ? `${sigunguLabel} ${dongLabel}`
      : dongLabel
  };
}

function zoomGroupInfo(row, rows, level) {
  const hierarchy = hierarchyFromApartment(row.apartment);
  if (level === "sido") {
    return {
      code: hierarchy.sidoCode || row.apartment.legalDongCode?.slice(0, 2) || "unknown",
      name: hierarchy.sidoName || sidoName(row.apartment.legalDongCode?.slice(0, 2) || ""),
      hierarchy: {
        sidoCode: hierarchy.sidoCode,
        sidoName: hierarchy.sidoName
      }
    };
  }
  if (level === "sigungu") {
    const sigunguCode = hierarchy.sigunguCode || row.apartment.legalDongCode?.slice(0, 5) || "unknown";
    return {
      code: sigunguCode,
      name: hierarchy.sigunguName || sigunguName(rows, sigunguCode),
      hierarchy: {
        sidoCode: hierarchy.sidoCode,
        sidoName: hierarchy.sidoName,
        sigunguCode,
        sigunguName: hierarchy.sigunguName || sigunguName(rows, sigunguCode)
      }
    };
  }
  const dongCode = hierarchy.dongKey
    || (row.apartment.legalDongCode?.length >= 8
      ? row.apartment.legalDongCode.slice(0, 8)
      : `${hierarchy.sigunguCode || "unknown"}:${row.apartment.neighborhoodName || row.apartment.address || "미분류"}`);
  return {
    code: dongCode,
    name: hierarchy.dongDisplayName || zoomDongName(row.apartment),
    hierarchy
  };
}

function zoomDongName(apartment) {
  const neighborhood = apartment.neighborhoodName || "미분류";
  const addressParts = String(apartment.address || "").split(" ").filter(Boolean);
  const sigungu = addressParts.slice(1).find((part) => /구$|시$|군$/.test(part));
  return sigungu ? `${sigungu} ${neighborhood}` : neighborhood;
}

function sidoName(code) {
  return {
    11: "서울",
    26: "부산",
    27: "대구",
    28: "인천",
    29: "광주",
    30: "대전",
    31: "울산",
    36: "세종",
    41: "경기",
    42: "강원",
    43: "충북",
    44: "충남",
    45: "전북",
    46: "전남",
    47: "경북",
    48: "경남",
    50: "제주"
  }[code] || code || "미분류";
}

function sigunguName(rows, code) {
  const row = rows.find((item) => item.apartment.legalDongCode.startsWith(code));
  if (!row) return code || "미분류";
  return sigunguNameFromAddress(row.apartment.address || "", code, row.apartment.neighborhoodName || "");
}

function sigunguNameFromAddress(address, code = "", neighborhood = "") {
  const parts = address.split(" ").filter(Boolean);
  const startIndex = isSidoAddressPart(parts[0]) ? 1 : 0;
  const first = parts[startIndex] || "";
  const second = parts[startIndex + 1] || "";
  if (/시$/.test(first) && /구$/.test(second)) return `${first} ${second}`;
  if (/구$|시$|군$/.test(first)) return first;
  if (/구$|시$|군$/.test(second)) return second;
  const withoutSido = parts.slice(startIndex + 1);
  const dongIndex = withoutSido.findIndex((part) => part === neighborhood);
  if (dongIndex > 0) return withoutSido.slice(0, dongIndex).join(" ");
  return withoutSido.slice(0, 2).join(" ") || code;
}

function isSidoAddressPart(value = "") {
  return /특별시$|광역시$|특별자치시$|특별자치도$|도$/.test(value)
    || ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"].includes(value);
}

function serializeCachedItem(row, level) {
  const growthRate = row.growth_rate === null ? null : Number(row.growth_rate);
  const growthAmount = row.growth_amount === null ? null : Number(row.growth_amount);
  const base = {
    lat: Number(row.lat),
    lng: Number(row.lng),
    areaCount: Number(row.area_count || 0),
    growthRate,
    growthAmount,
    hasData: row.has_data,
    type: level === "apartment" ? "apartment" : "group",
    sidoCode: row.sido_code || "",
    sidoName: row.sido_name || "",
    sigunguCode: row.sigungu_code || "",
    sigunguName: row.sigungu_name || "",
    dongKey: row.dong_key || "",
    dongName: row.dong_name || ""
  };
  if (level === "apartment") {
    return {
      ...base,
      id: row.apartment_id,
      name: row.item_name,
      neighborhoodName: row.neighborhood_name || "",
      address: row.address || "",
      areaSummary: row.area_summary || "",
      startPyeongPrice: row.start_pyeong_price === null ? null : Number(row.start_pyeong_price),
      endPyeongPrice: row.end_pyeong_price === null ? null : Number(row.end_pyeong_price),
      dongRank: row.dong_rank === null || row.dong_rank === undefined ? null : Number(row.dong_rank),
      dongRankTotal: row.dong_rank_total === null || row.dong_rank_total === undefined ? null : Number(row.dong_rank_total),
      sigunguRank: row.sigungu_rank === null || row.sigungu_rank === undefined ? null : Number(row.sigungu_rank),
      sigunguRankTotal: row.sigungu_rank_total === null || row.sigungu_rank_total === undefined ? null : Number(row.sigungu_rank_total),
      sidoRank: row.sido_rank === null || row.sido_rank === undefined ? null : Number(row.sido_rank),
      sidoRankTotal: row.sido_rank_total === null || row.sido_rank_total === undefined ? null : Number(row.sido_rank_total),
      countryRank: row.country_rank === null || row.country_rank === undefined ? null : Number(row.country_rank),
      countryRankTotal: row.country_rank_total === null || row.country_rank_total === undefined ? null : Number(row.country_rank_total)
    };
  }
  return {
    ...base,
    code: row.item_key,
    name: row.item_name,
    apartmentCount: Number(row.apartment_count || 0),
    sigunguRank: row.sigungu_rank === null || row.sigungu_rank === undefined ? null : Number(row.sigungu_rank),
    sigunguRankTotal: row.sigungu_rank_total === null || row.sigungu_rank_total === undefined ? null : Number(row.sigungu_rank_total),
    sidoRank: row.sido_rank === null || row.sido_rank === undefined ? null : Number(row.sido_rank),
    sidoRankTotal: row.sido_rank_total === null || row.sido_rank_total === undefined ? null : Number(row.sido_rank_total),
    countryRank: row.country_rank === null || row.country_rank === undefined ? null : Number(row.country_rank),
    countryRankTotal: row.country_rank_total === null || row.country_rank_total === undefined ? null : Number(row.country_rank_total)
  };
}

function boundsWhereClause(filters, params) {
  const hasBounds = [filters.north, filters.south, filters.east, filters.west].every(Number.isFinite);
  if (!hasBounds) return "";
  params.push(filters.north, filters.south, filters.east, filters.west);
  const north = params.length - 3;
  const south = params.length - 2;
  const east = params.length - 1;
  const west = params.length;
  return `and lat <= $${north} and lat >= $${south} and lng <= $${east} and lng >= $${west}`;
}

function zoomAggregationLevel(zoom) {
  if (zoom >= 16) return "apartment";
  if (zoom >= 13) return "dong";
  if (zoom >= 11) return "sigungu";
  return "sido";
}

function normalizedPeriods(values) {
  const periods = values
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((years) => {
      const months = Math.max(1, Math.round(years * 12));
      return {
        months,
        storageYears: months < 12 ? 0 : Math.round(months / 12)
      };
    });
  return [...new Map(periods.map((period) => [period.months, period])).values()]
    .sort((a, b) => a.months - b.months);
}

function addYears(month, delta) {
  return addMonths(month, delta * 12);
}

function addMonths(month, delta) {
  const date = new Date(Number(month.slice(0, 4)), Number(month.slice(4, 6)) - 1, 1);
  date.setMonth(date.getMonth() + delta);
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(startMonth, endMonth) {
  const months = [];
  let year = Number(startMonth.slice(0, 4));
  let month = Number(startMonth.slice(4, 6));
  const end = Number(endMonth);
  while (Number(`${year}${String(month).padStart(2, "0")}`) <= end) {
    months.push(`${year}${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

function todayKstDateString() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function normalizeApartmentPrimaryId(value) {
  return String(value || "");
}

function serializeApartmentRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    regionId: row.region_id,
    source: row.source,
    sourceComplexId: Number(row.source_complex_id || 0),
    name: row.name,
    neighborhoodName: row.neighborhood_name || "",
    legalDongCode: row.legal_dong_code || "",
    address: row.address || "",
    sidoCode: row.sido_code || "",
    sidoName: row.sido_name || "",
    sigunguCode: row.sigungu_code || "",
    sigunguName: row.sigungu_name || "",
    dongKey: row.dong_key || "",
    dongName: row.dong_name || "",
    builtYear: row.built_year || "",
    householdCount: Number(row.household_count || 0),
    lat: Number(row.lat || 0),
    lng: Number(row.lng || 0)
  };
}

function serializeMolitComplexRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    regionId: "molit",
    source: "molit",
    sourceComplexId: 0,
    name: row.apt_name,
    neighborhoodName: row.legal_dong || "",
    legalDongCode: row.dong_key || row.lawd_cd || "",
    address: row.address || "",
    sidoCode: row.sido_code || "",
    sidoName: row.sido_name || "",
    sigunguCode: row.sigungu_code || row.lawd_cd || "",
    sigunguName: row.sigungu_name || "",
    dongKey: row.dong_key || "",
    dongName: row.dong_name || row.legal_dong || "",
    builtYear: row.build_year || "",
    householdCount: Number(row.deal_count || 0),
    lat: Number(row.lat || 0),
    lng: Number(row.lng || 0)
  };
}

function average(values) {
  const clean = values.map(Number).filter(Number.isFinite);
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}
