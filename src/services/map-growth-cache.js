import { query, withClient } from "./db.js";
import { readDatasetFromDb } from "./db-store.js";
import { buildApartmentRankings, getAvailableMonths } from "./price-calculator.js";

export const DEFAULT_MAP_CACHE_PERIOD_YEARS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
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

  const snapshotResult = await query(`
    select *
    from map_growth_snapshots
    where source = 'kb'
      and start_month = $1
      and end_month = $2
    order by updated_at desc
    limit 1
  `, [startMonth, endMonth]);
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
            partition by coalesce(nullif(a.legal_dong_code, ''), concat(mgi.address, ':', mgi.neighborhood_name))
            order by
              mgi.has_data desc,
              mgi.growth_rate desc nulls last,
              mgi.item_name asc
          )::int as dong_rank,
          count(*) over (
            partition by coalesce(nullif(a.legal_dong_code, ''), concat(mgi.address, ':', mgi.neighborhood_name))
          )::int as dong_rank_total
        from map_growth_items mgi
        left join apartments a on a.id = mgi.apartment_id
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
              partition by substring(mgi.item_key from 1 for 5)
              order by
                mgi.has_data desc,
                mgi.growth_rate desc nulls last,
                mgi.item_name asc
            )::int as sigungu_rank,
            count(*) over (
              partition by substring(mgi.item_key from 1 for 5)
            )::int as sigungu_rank_total,
            row_number() over (
              partition by substring(mgi.item_key from 1 for 2)
              order by
                mgi.has_data desc,
                mgi.growth_rate desc nulls last,
                mgi.item_name asc
            )::int as sido_rank,
            count(*) over (
              partition by substring(mgi.item_key from 1 for 2)
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
              partition by substring(mgi.item_key from 1 for 2)
              order by
                mgi.has_data desc,
                mgi.growth_rate desc nulls last,
                mgi.item_name asc
            )::int as sido_rank,
            count(*) over (
              partition by substring(mgi.item_key from 1 for 2)
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
      updatedAt: snapshot.updated_at,
      periodYears: Number(snapshot.period_years)
    },
    items: itemsResult.rows.map((row) => serializeCachedItem(row, level))
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
  for (const years of normalizedYears(periodYears)) {
    const requestedStart = addYears(endMonth, -years);
    const ranking = buildApartmentRankings(dataset, {
      start: requestedStart,
      end: endMonth
    });
    if (!ranking.period.startMonth || !ranking.period.endMonth) continue;
    const items = buildCacheItems(dataset, ranking.rows);
    const snapshot = await saveSnapshot({
      periodYears: years,
      startMonth: ranking.period.startMonth,
      endMonth: ranking.period.endMonth,
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

async function saveSnapshot({ periodYears, startMonth, endMonth, apartmentCount, areaCount, items }) {
  return withClient(async (client) => {
    await client.query("begin");
    try {
      const snapshotResult = await client.query(`
        insert into map_growth_snapshots (
          source, period_years, start_month, end_month, apartment_count, area_count, updated_at
        ) values ('kb', $1, $2, $3, $4, $5, now())
        on conflict (source, period_years, start_month, end_month) do update set
          apartment_count = excluded.apartment_count,
          area_count = excluded.area_count,
          updated_at = now()
        returning *
      `, [periodYears, startMonth, endMonth, apartmentCount, areaCount]);
      const snapshot = snapshotResult.rows[0];
      await client.query("delete from map_growth_items where snapshot_id = $1", [snapshot.id]);

      for (const item of items) {
        await client.query(`
          insert into map_growth_items (
            snapshot_id, level, item_key, item_name, apartment_id, neighborhood_name, address,
            lat, lng, apartment_count, area_count, area_summary, growth_rate, growth_amount,
            start_pyeong_price, end_pyeong_price, has_data, updated_at
          ) values (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now()
          )
        `, [
          snapshot.id,
          item.level,
          item.itemKey,
          item.itemName,
          item.apartmentId || null,
          item.neighborhoodName || "",
          item.address || "",
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
  return rows.map((row) => ({
    id: row.apartment.id,
    name: row.apartment.name,
    neighborhoodName: row.apartment.neighborhoodName,
    address: row.apartment.address,
    lat: row.apartment.lat,
    lng: row.apartment.lng,
    areaCount: Number(row.areaTypeCount || 0),
    areaSummary: row.areaLabel || "-",
    growthRate: row.growthRate,
    growthAmount: Math.round(row.growthAmount),
    startPyeongPrice: Math.round(row.startPyeongPrice),
    endPyeongPrice: Math.round(row.endPyeongPrice)
  }));
}

function zoomGroupInfo(row, rows, level) {
  const code = row.apartment.legalDongCode || "";
  if (level === "sido") {
    const sidoCode = code.slice(0, 2);
    return { code: sidoCode, name: sidoName(sidoCode) };
  }
  if (level === "sigungu") {
    const sigunguCode = code.slice(0, 5);
    return { code: sigunguCode, name: sigunguName(rows, sigunguCode) };
  }
  const dongCode = code.slice(0, 8) || `${row.apartment.address}:${row.apartment.neighborhoodName}`;
  return {
    code: dongCode,
    name: zoomDongName(row.apartment)
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
  const address = row.apartment.address || "";
  const neighborhood = row.apartment.neighborhoodName || "";
  const withoutSido = address.split(" ").slice(1);
  const dongIndex = withoutSido.findIndex((part) => part === neighborhood);
  if (dongIndex > 0) return withoutSido.slice(0, dongIndex).join(" ");
  return withoutSido.slice(0, 2).join(" ") || code;
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
    type: level === "apartment" ? "apartment" : "group"
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
      dongRankTotal: row.dong_rank_total === null || row.dong_rank_total === undefined ? null : Number(row.dong_rank_total)
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

function normalizedYears(values) {
  return [...new Set(values.map(Number).filter((value) => Number.isInteger(value) && value > 0))]
    .sort((a, b) => a - b);
}

function addYears(month, delta) {
  const date = new Date(Number(month.slice(0, 4)), Number(month.slice(4, 6)) - 1, 1);
  date.setFullYear(date.getFullYear() + delta);
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function average(values) {
  const clean = values.map(Number).filter(Number.isFinite);
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}
