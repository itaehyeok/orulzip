import { query, withClient } from "./db.js";
import { resolveMolitDuplicateGroups } from "./molit-duplicate-resolver.js";
import { notifyTelegramCacheFallback } from "./telegram-notifier.js";

export const DEFAULT_PRICE_BAND_PERIOD_MONTHS = [3, 6, 12, 36, 60];
export const PRICE_BAND_BASES = ["start", "end"];
export const DEFAULT_PRICE_BAND_MIN_HOUSEHOLD_COUNTS = [0, 100];
export const PRICE_AREA_BANDS = [
  { key: "all", label: "전체 평형" },
  { key: "under10", label: "10평 이하" },
  { key: "10", label: "10평대" },
  { key: "20", label: "20평대" },
  { key: "30", label: "30평대" },
  { key: "40", label: "40평대" },
  { key: "50", label: "50평대" },
  { key: "60plus", label: "60평 이상" }
];
export const DEFAULT_PRICE_AREA_BAND_KEYS = PRICE_AREA_BANDS.map((band) => band.key);
const PRICE_BAND_SOURCE = "molit";
const PRICE_BAND_CACHE_STALE_HOURS = 36;
const allowLivePriceBandFallback = process.env.ORULZIP_ALLOW_PRICE_BAND_LIVE_FALLBACK === "1";
const MOLIT_PRICE_FRESHNESS_RULES = [
  { maxPeriodMonths: 3, startGapMonths: 1, endGapMonths: 1 },
  { maxPeriodMonths: 6, startGapMonths: 2, endGapMonths: 2 },
  { maxPeriodMonths: 12, startGapMonths: 3, endGapMonths: 3 },
  { maxPeriodMonths: 36, startGapMonths: 6, endGapMonths: 3 },
  { maxPeriodMonths: Infinity, startGapMonths: 12, endGapMonths: 3 }
];

export async function refreshPriceBandRankCache({
  source = PRICE_BAND_SOURCE,
  periodMonths = DEFAULT_PRICE_BAND_PERIOD_MONTHS,
  bases = PRICE_BAND_BASES,
  minHouseholdCounts = DEFAULT_PRICE_BAND_MIN_HOUSEHOLD_COUNTS,
  areaBandKeys = DEFAULT_PRICE_AREA_BAND_KEYS
} = {}) {
  const normalizedSource = source || PRICE_BAND_SOURCE;
  const today = todayKstDateString();
  const endMonth = today.slice(0, 7).replace("-", "");

  const snapshots = [];
  const householdFilters = normalizeMinHouseholdCounts(minHouseholdCounts);
  const areaBands = normalizePriceAreaBands(areaBandKeys);
  for (const monthsBack of normalizePeriodMonths(periodMonths)) {
    const requestedStart = addMonths(endMonth, -monthsBack);
    const data = await readMolitPriceBandMonthlyRows(today, {
      startMonth: requestedStart,
      endMonth
    });
    if (!data.rows.length) continue;

    for (const areaBand of areaBands) {
      for (const basis of normalizeBases(bases)) {
        for (const minHouseholdCount of householdFilters) {
          const ranking = buildMolitPriceBandRankings(data.rows, {
            startMonth: requestedStart,
            endMonth,
            basis,
            recentByType: data.recentByType,
            minHouseholdCount,
            areaBand
          });
          if (!ranking.period.startMonth || !ranking.period.endMonth) continue;
          const snapshot = await savePriceBandRankSnapshot({
            source: normalizedSource,
            basis,
            periodMonths: monthsBack,
            startMonth: ranking.period.startMonth,
            endMonth: ranking.period.endMonth,
            minHouseholdCount,
            areaBand,
            bands: ranking.bands,
            rows: ranking.allRows || []
          });
          snapshots.push(snapshot);
        }
      }
    }
  }

  return {
    refreshedAt: new Date().toISOString(),
    snapshots
  };
}

export async function readPriceBandRankPage({
  source = PRICE_BAND_SOURCE,
  basis = "start",
  startMonth = "",
  endMonth = "",
  bandKey = "",
  startBandKey = "",
  endBandKey = "",
  areaBandKey = "all",
  minHouseholdCount = 0,
  environment = "unknown",
  page = 1,
  pageSize = 50
} = {}) {
  const normalizedBasis = basis === "end" ? "end" : "start";
  const normalizedAreaBand = normalizePriceAreaBand(areaBandKey);
  const normalizedMinHouseholdCount = normalizeMinHouseholdCount(minHouseholdCount);
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedPageSize = Math.max(10, Math.min(Number(pageSize) || 50, 100));
  const legacyBandKey = normalizeBandKey(bandKey);
  const requestedStartBandKey = normalizeBandKey(startBandKey);
  const requestedEndBandKey = normalizeBandKey(endBandKey);
  const selectedStartBandKey = requestedStartBandKey ?? (normalizedBasis === "start" ? legacyBandKey : null);
  const selectedEndBandKey = requestedEndBandKey ?? (normalizedBasis === "end" ? legacyBandKey : null);
  const requestedPeriodMonths = monthsBetween(startMonth, endMonth);
  const snapshot = await readExactPriceBandSnapshot({
    source,
    basis: normalizedBasis,
    startMonth,
    endMonth,
    areaBandKey: normalizedAreaBand.key,
    minHouseholdCount: normalizedMinHouseholdCount
  });
  if (!snapshot) {
    const recentSnapshot = await readRecentPriceBandSnapshot({
      source,
      basis: normalizedBasis,
      areaBandKey: normalizedAreaBand.key,
      minHouseholdCount: normalizedMinHouseholdCount,
      periodMonths: requestedPeriodMonths,
      requestedEndMonth: endMonth
    });
    if (recentSnapshot) {
      return readPriceBandRankSnapshotPage({
        snapshot: recentSnapshot,
        source,
        basis: normalizedBasis,
        selectedStartBandKey,
        selectedEndBandKey,
        areaBand: normalizedAreaBand,
        minHouseholdCount: normalizedMinHouseholdCount,
        page: normalizedPage,
        pageSize: normalizedPageSize,
        environment,
        fallback: {
          reason: "requested cache snapshot missing; recent cache used",
          source: "recent-cache",
          requestedStartMonth: startMonth,
          requestedEndMonth: endMonth
        }
      });
    }
    if (!allowLivePriceBandFallback) {
      notifyCacheFallback({
        environment,
        kind: "실거래가 랭킹",
        source,
        period: `${startMonth || "-"} ~ ${endMonth || "-"}`,
        conditions: priceBandFallbackConditions({
          basis: normalizedBasis,
          minHouseholdCount: normalizedMinHouseholdCount,
          areaBand: normalizedAreaBand,
          selectedStartBandKey,
          selectedEndBandKey
        }),
        reason: "price band rank cache snapshot missing",
        action: "실시간 대형 계산을 막고 빈 응답 반환",
        dedupeKey: priceBandFallbackDedupeKey({
          source,
          startMonth,
          endMonth,
          minHouseholdCount: normalizedMinHouseholdCount,
          areaBand: normalizedAreaBand,
          selectedStartBandKey,
          selectedEndBandKey,
          reason: "cache-missing-no-live-fallback"
        })
      });
      return emptyPriceBandRankPage({
        source,
        basis: normalizedBasis,
        startMonth,
        endMonth,
        selectedStartBandKey,
        selectedEndBandKey,
        areaBand: normalizedAreaBand,
        minHouseholdCount: normalizedMinHouseholdCount,
        page: normalizedPage,
        pageSize: normalizedPageSize,
        reason: "price band rank cache snapshot missing"
      });
    }
    return readPriceBandRankFallbackPage({
      source,
      basis: normalizedBasis,
      startMonth,
      endMonth,
      selectedStartBandKey,
      selectedEndBandKey,
      areaBand: normalizedAreaBand,
      minHouseholdCount: normalizedMinHouseholdCount,
      page: normalizedPage,
      pageSize: normalizedPageSize,
      environment,
      reason: "price band rank cache snapshot missing"
    });
  }

  return readPriceBandRankSnapshotPage({
    snapshot,
    source,
    basis: normalizedBasis,
    selectedStartBandKey,
    selectedEndBandKey,
    areaBand: normalizedAreaBand,
    minHouseholdCount: normalizedMinHouseholdCount,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    environment
  });
}

async function readExactPriceBandSnapshot({
  source,
  basis,
  startMonth,
  endMonth,
  areaBandKey,
  minHouseholdCount
}) {
  const result = await query(`
    select *
    from price_band_rank_snapshots
    where source = $1
      and basis = $2
      and start_month = $3
      and end_month = $4
      and min_household_count = $5
      and area_band_key = $6
    order by updated_at desc
    limit 1
  `, [source, basis, startMonth, endMonth, minHouseholdCount, areaBandKey]);
  return result.rows[0] || null;
}

async function readRecentPriceBandSnapshot({
  source,
  basis,
  areaBandKey,
  minHouseholdCount,
  periodMonths,
  requestedEndMonth
}) {
  const params = [source, basis, minHouseholdCount, areaBandKey];
  const conditions = [
    "source = $1",
    "basis = $2",
    "min_household_count = $3",
    "area_band_key = $4",
    "band_count > 0",
    "item_count > 0"
  ];
  if (Number.isFinite(periodMonths)) {
    params.push(periodMonths);
    conditions.push(`period_months = $${params.length}`);
  }
  if (/^\d{6}$/.test(String(requestedEndMonth || ""))) {
    params.push(requestedEndMonth);
    conditions.push(`end_month <= $${params.length}`);
  }
  const result = await query(`
    select *
    from price_band_rank_snapshots
    where ${conditions.join("\n      and ")}
    order by end_month desc, updated_at desc
    limit 1
  `, params);
  return result.rows[0] || null;
}

function emptyPriceBandRankPage({
  source,
  basis,
  startMonth,
  endMonth,
  selectedStartBandKey,
  selectedEndBandKey,
  areaBand,
  minHouseholdCount,
  page,
  pageSize,
  reason
}) {
  return {
    period: { startMonth, endMonth },
    basis,
    areaBands: PRICE_AREA_BANDS,
    bands: [],
    selectedBandKey: null,
    selectedBand: null,
    selection: {
      startBandKey: selectedStartBandKey,
      startBand: null,
      endBandKey: selectedEndBandKey,
      endBand: null,
      areaBandKey: areaBand.key,
      areaBand
    },
    cache: {
      hit: false,
      status: "missing",
      fallback: false,
      source,
      basis,
      minHouseholdCount,
      areaBandKey: areaBand.key,
      updatedAt: null,
      servedStartMonth: null,
      servedEndMonth: null,
      requestedStartMonth: startMonth,
      requestedEndMonth: endMonth,
      reason
    },
    pagination: {
      page,
      pageSize,
      totalRows: 0,
      totalPages: 0
    },
    rows: []
  };
}

async function readPriceBandRankSnapshotPage({
  snapshot,
  source,
  basis,
  selectedStartBandKey,
  selectedEndBandKey,
  areaBand,
  minHouseholdCount,
  page,
  pageSize,
  environment,
  fallback = null
}) {
  const bands = await readBands(snapshot.id, basis, { minHouseholdCount });
  const selectedBandKey = basis === "end" ? selectedEndBandKey : selectedStartBandKey;
  const selectedBand = selectedBandKey === null
    ? null
    : bands.find((band) => band.bandKey === selectedBandKey) || null;
  const where = buildPriceBandItemWhere({
    snapshotId: snapshot.id,
    snapshotBasis: basis,
    startBandKey: selectedStartBandKey,
    endBandKey: selectedEndBandKey
  });
  const countResult = await query(`
    select count(*)::int as total_rows
    from price_band_rank_items pbi
    where ${where.sql}
  `, where.params);
  const totalRows = Number(countResult.rows[0]?.total_rows || 0);
  const totalPages = totalRows ? Math.max(1, Math.ceil(totalRows / pageSize)) : 0;
  const safePage = totalRows ? Math.min(page, totalPages) : 1;
  const offset = (safePage - 1) * pageSize;
  const rowsResult = totalRows ? await query(`
    with filtered as (
      select pbi.*
      from price_band_rank_items pbi
      where ${where.sql}
    ),
    ordered as (
      select *
      from filtered
      order by growth_rate desc nulls last,
               growth_amount desc nulls last,
               end_pyeong_price desc nulls last,
               apartment_name asc
      limit $${where.params.length + 1} offset $${where.params.length + 2}
    ),
    paged as (
      select
        ordered.*,
        ($${where.params.length + 2}::int + row_number() over (
          order by growth_rate desc nulls last,
                   growth_amount desc nulls last,
                   end_pyeong_price desc nulls last,
                   apartment_name asc
        ))::int as filtered_rank
      from ordered
    )
    select
      paged.*,
      coalesce(c.reb_household_count, a.household_count, 0)::int as household_count
    from paged
    left join molit_complexes c
      on c.id = paged.apartment_id
    left join apartments a
      on a.id = c.matched_apartment_id
    order by paged.filtered_rank asc
  `, [...where.params, pageSize, offset]) : { rows: [] };

  if (fallback) {
    notifyCacheFallback({
      environment,
      kind: "실거래가 랭킹",
      source,
      period: `${snapshot.start_month || "-"} ~ ${snapshot.end_month || "-"}`,
      conditions: priceBandFallbackConditions({
        basis,
        minHouseholdCount,
        areaBand,
        selectedStartBandKey,
        selectedEndBandKey
      }),
      reason: fallback.reason,
      action: fallback.source === "recent-cache"
        ? "마지막 정상 캐시로 응답"
        : "대체 캐시로 응답",
      dedupeKey: priceBandFallbackDedupeKey({
        source,
        startMonth: fallback.requestedStartMonth || snapshot.start_month,
        endMonth: fallback.requestedEndMonth || snapshot.end_month,
        minHouseholdCount,
        areaBand,
        selectedStartBandKey,
        selectedEndBandKey,
        reason: fallback.reason
      })
    });
  }

  return {
    period: {
      startMonth: snapshot.start_month,
      endMonth: snapshot.end_month
    },
    basis: snapshot.basis,
    areaBands: PRICE_AREA_BANDS,
    bands,
    selectedBandKey: selectedBand?.bandKey ?? null,
    selectedBand,
    selection: {
      startBandKey: selectedStartBandKey,
      startBand: basis === "start"
        ? bands.find((band) => band.bandKey === selectedStartBandKey) || null
        : null,
      endBandKey: selectedEndBandKey,
      endBand: basis === "end"
        ? bands.find((band) => band.bandKey === selectedEndBandKey) || null
        : null,
      areaBandKey: areaBand.key,
      areaBand
    },
    cache: {
      hit: true,
      status: priceBandCacheStatus(snapshot, fallback),
      stale: isPriceBandCacheStale(snapshot.updated_at) || Boolean(fallback),
      ...(fallback ? {
        fallback: true,
        fallbackSource: fallback.source,
        reason: fallback.reason,
        requestedStartMonth: fallback.requestedStartMonth || null,
        requestedEndMonth: fallback.requestedEndMonth || null
      } : {}),
      source: snapshot.source,
      basis: snapshot.basis,
      minHouseholdCount,
      areaBandKey: areaBand.key,
      updatedAt: snapshot.updated_at,
      servedStartMonth: snapshot.start_month,
      servedEndMonth: snapshot.end_month
    },
    pagination: {
      page: safePage,
      pageSize,
      totalRows,
      totalPages
    },
    rows: rowsResult.rows.map((row) => serializePriceBandItem(row, snapshot.basis))
  };
}

function priceBandCacheStatus(snapshot, fallback = null) {
  if (fallback?.source === "recent-cache") return "stale";
  return isPriceBandCacheStale(snapshot?.updated_at) ? "stale" : "fresh";
}

function isPriceBandCacheStale(updatedAt) {
  if (!updatedAt) return true;
  const updatedTime = new Date(updatedAt).getTime();
  if (!Number.isFinite(updatedTime)) return true;
  return Date.now() - updatedTime > PRICE_BAND_CACHE_STALE_HOURS * 60 * 60 * 1000;
}

async function readBroaderPriceBandSnapshot({
  source,
  basis,
  startMonth,
  endMonth,
  areaBandKey,
  minHouseholdCount
}) {
  if (normalizeMinHouseholdCount(minHouseholdCount) <= 0) return null;
  const result = await query(`
    select *
    from price_band_rank_snapshots
    where source = $1
      and basis = $2
      and start_month = $3
      and end_month = $4
      and min_household_count = 0
      and area_band_key = $5
    order by updated_at desc
    limit 1
  `, [source, basis, startMonth, endMonth, areaBandKey]);
  return result.rows[0] || null;
}

async function readPriceBandRankFallbackPage({
  source,
  basis,
  startMonth,
  endMonth,
  selectedStartBandKey,
  selectedEndBandKey,
  areaBand,
  minHouseholdCount,
  page,
  pageSize,
  environment,
  reason
}) {
  const data = await readMolitPriceBandMonthlyRows(todayKstDateString(), { startMonth, endMonth });
  const ranking = data.rows.length
    ? buildMolitPriceBandRankings(data.rows, {
      startMonth,
      endMonth,
      basis,
      recentByType: data.recentByType,
      minHouseholdCount,
      areaBand
    })
    : { period: { startMonth, endMonth }, bands: [], allRows: [] };
  const selectedBandKey = basis === "end" ? selectedEndBandKey : selectedStartBandKey;
  const selectedBand = selectedBandKey === null
    ? null
    : ranking.bands.find((band) => band.bandKey === selectedBandKey) || null;
  const rows = filterComputedPriceBandRows(ranking.allRows || [], {
    startBandKey: selectedStartBandKey,
    endBandKey: selectedEndBandKey
  }).sort(compareApartmentGrowth);
  const totalRows = rows.length;
  const totalPages = totalRows ? Math.max(1, Math.ceil(totalRows / pageSize)) : 0;
  const safePage = totalRows ? Math.min(page, totalPages) : 1;
  const offset = (safePage - 1) * pageSize;
  const pagedRows = rows.slice(offset, offset + pageSize)
    .map((row, index) => serializeComputedPriceBandItem({ ...row, rank: offset + index + 1 }, basis));

  notifyCacheFallback({
    environment,
    kind: "실거래가 랭킹",
    source,
    period: `${startMonth || "-"} ~ ${endMonth || "-"}`,
    conditions: priceBandFallbackConditions({
      basis,
      minHouseholdCount,
      areaBand,
      selectedStartBandKey,
      selectedEndBandKey
    }),
    reason,
    action: "실시간 계산으로 응답",
    dedupeKey: [
      "price-band-rank",
      source,
      startMonth || "",
      endMonth || "",
      minHouseholdCount,
      areaBand.key,
      selectedStartBandKey ?? "all",
      selectedEndBandKey ?? "all",
      reason
    ].join(":")
  });

  return {
    period: {
      startMonth: ranking.period?.startMonth || startMonth,
      endMonth: ranking.period?.endMonth || endMonth
    },
    basis,
    areaBands: PRICE_AREA_BANDS,
    bands: ranking.bands || [],
    selectedBandKey: selectedBand?.bandKey ?? null,
    selectedBand,
    selection: {
      startBandKey: selectedStartBandKey,
      startBand: basis === "start"
        ? ranking.bands.find((band) => band.bandKey === selectedStartBandKey) || null
        : null,
      endBandKey: selectedEndBandKey,
      endBand: basis === "end"
        ? ranking.bands.find((band) => band.bandKey === selectedEndBandKey) || null
        : null,
      areaBandKey: areaBand.key,
      areaBand
    },
    cache: {
      hit: false,
      fallback: true,
      source,
      basis,
      minHouseholdCount,
      areaBandKey: areaBand.key,
      updatedAt: null,
      reason
    },
    pagination: {
      page: safePage,
      pageSize,
      totalRows,
      totalPages
    },
    rows: pagedRows
  };
}

function buildPriceBandItemWhere({
  snapshotId,
  snapshotBasis = "start",
  startBandKey = null,
  endBandKey = null
}) {
  const clauses = ["pbi.snapshot_id = $1"];
  const params = [snapshotId];
  appendPriceBandClause({
    clauses,
    params,
    snapshotBasis,
    basis: "start",
    key: startBandKey,
    column: "start_sale_price"
  });
  appendPriceBandClause({
    clauses,
    params,
    snapshotBasis,
    basis: "end",
    key: endBandKey,
    column: "end_sale_price"
  });
  return {
    sql: clauses.join("\n      and "),
    params
  };
}

function appendPriceBandClause({
  clauses,
  params,
  snapshotBasis,
  basis,
  key,
  column
}) {
  if (key === null || key === undefined) return;
  if (snapshotBasis === basis) {
    params.push(key);
    clauses.push(`pbi.band_key = $${params.length}`);
    return;
  }
  const range = priceBandRange(key);
  if (!range) return;
  if (range.max === null) {
    params.push(range.min);
    clauses.push(`pbi.${column} >= $${params.length}`);
    return;
  }
  if (range.min === null) {
    params.push(range.max);
    clauses.push(`pbi.${column} < $${params.length}`);
    return;
  }
  params.push(range.min, range.max);
  clauses.push(`pbi.${column} >= $${params.length - 1} and pbi.${column} < $${params.length}`);
}

async function readMolitPriceBandMonthlyRows(today, { startMonth, endMonth }) {
  const freshness = molitPriceFreshnessRule(startMonth, endMonth);
  const queryStartMonth = [
    addMonths(startMonth, -freshness.startGapMonths),
    addMonths(endMonth, -freshness.endGapMonths)
  ].sort()[0];
  const recentStartMonth = addMonths(endMonth, -1);
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
          c.sigungu_code,
          c.dong_key,
          c.build_year,
          c.deal_count as apartment_deal_count,
          c.first_month,
          c.last_month,
          c.lat,
          c.lng,
          coalesce(c.reb_household_count, a.household_count, 0) as household_count,
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
        left join apartments a
          on a.id = c.matched_apartment_id
        where d.exclusive_area_m2 is not null
          and d.deal_amount is not null
          and d.pyeong_price is not null
          and d.deal_year_month >= $3
          and d.deal_year_month <= $2
          and coalesce(d.cancel_type, '') = ''
          and c.lat is not null
          and c.lng is not null
      ),
      monthly as (
        select
          apartment_id,
          apartment_name,
          neighborhood_name,
          legal_dong_code,
          address,
          sido_code,
          sigungu_code,
          dong_key,
          build_year,
          apartment_deal_count,
          first_month,
          last_month,
          lat,
          lng,
          household_count,
          exclusive_area_m2,
          deal_year_month,
          round(avg(deal_amount))::int as sale_mid,
          round(avg(pyeong_price))::int as pyeong_price,
          count(*)::int as deal_count
        from matched
        group by apartment_id, apartment_name, neighborhood_name, legal_dong_code, address,
                 sido_code, sigungu_code, dong_key, build_year, apartment_deal_count,
                 first_month, last_month, lat, lng, household_count, exclusive_area_m2, deal_year_month
      ),
      start_rows as (
        select *
        from (
          select
            monthly.*,
            row_number() over (
              partition by apartment_id, exclusive_area_m2
              order by deal_year_month desc
            ) as start_rank
          from monthly
          where deal_year_month <= $1
        ) ranked_start_rows
        where start_rank = 1
      ),
      end_rows as (
        select *
        from (
          select
            monthly.*,
            row_number() over (
              partition by apartment_id, exclusive_area_m2
              order by deal_year_month desc
            ) as end_rank
          from monthly
          where deal_year_month <= $2
        ) ranked_end_rows
        where end_rank = 1
      )
      select
        apartment_id,
        apartment_name,
        neighborhood_name,
        legal_dong_code,
        address,
        sido_code,
        sigungu_code,
        dong_key,
        build_year,
        apartment_deal_count,
        first_month,
        last_month,
        lat,
        lng,
        household_count,
        exclusive_area_m2,
        deal_year_month,
        sale_mid,
        pyeong_price,
        deal_count
      from start_rows
      union all
      select
        apartment_id,
        apartment_name,
        neighborhood_name,
        legal_dong_code,
        address,
        sido_code,
        sigungu_code,
        dong_key,
        build_year,
        apartment_deal_count,
        first_month,
        last_month,
        lat,
        lng,
        household_count,
        exclusive_area_m2,
        deal_year_month,
        sale_mid,
        pyeong_price,
        deal_count
      from end_rows
      order by apartment_id, exclusive_area_m2, deal_year_month
    `, [startMonth, endMonth, queryStartMonth]),
    query(`
      with matched as (
        select
          c.id as apartment_id,
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
          and d.deal_year_month >= $2
          and make_date(d.deal_year, d.deal_month, d.deal_day) between $1::date - interval '30 days' and $1::date
          and c.lat is not null
          and c.lng is not null
      )
      select
        apartment_id,
        exclusive_area_m2,
        to_char($1::date, 'YYYYMM') as deal_year_month,
        max(deal_year_month) as source_year_month,
        round(avg(deal_amount))::int as sale_mid,
        round(avg(pyeong_price))::int as pyeong_price,
        count(*)::int as deal_count
      from matched
      group by apartment_id, exclusive_area_m2
    `, [today, recentStartMonth])
  ]);

  return {
    rows: monthly.rows,
    recentByType: new Map(recent.rows.map((row) => [molitTypeKey(row.apartment_id, row.exclusive_area_m2), serializeMolitPrice(row)]))
  };
}

function buildMolitPriceBandRankings(rows, {
  startMonth,
  endMonth,
  basis = "start",
  recentByType = new Map(),
  minHouseholdCount = 0,
  areaBand = PRICE_AREA_BANDS[0]
}) {
  const normalizedAreaBand = normalizePriceAreaBand(areaBand?.key || areaBand);
  const apartments = groupMolitRows(rows, recentByType);
  const eligibleApartments = [...apartments.values()]
    .filter((apartmentGroup) => Number(apartmentGroup.apartment?.householdCount || 0) >= minHouseholdCount);
  const freshness = molitPriceFreshnessRule(startMonth, endMonth);
  const duplicateResolution = resolveMolitDuplicateGroups(eligibleApartments.map((group) => group.apartment));
  const hiddenDuplicateIds = duplicateResolution.hiddenIds;
  const groups = new Map();

  for (const apartmentGroup of eligibleApartments) {
    if (hiddenDuplicateIds.has(apartmentGroup.apartment.id)) continue;
    const typeSummaries = [...apartmentGroup.types.values()].map((type) => {
      const start = carriedPriceAtOrBefore(type.monthly, startMonth);
      const end = type.recentPrice || carriedPriceAtOrBefore(type.monthly, endMonth);
      if (!start || !end || !start.saleMid || !end.saleMid || !start.pyeongPrice || !end.pyeongPrice) return null;
      if (!isMolitPriceFreshForMonth(start, startMonth, freshness.startGapMonths)) return null;
      if (!isMolitPriceFreshForMonth(end, endMonth, freshness.endGapMonths)) return null;
      return molitPriceBandAreaSummary(type, start, end);
    }).filter((summary) => summary && isAreaSummaryInBand(summary, normalizedAreaBand)).sort(compareAreaSummaryGrowth);
    if (!typeSummaries.length) continue;

    const representative = typeSummaries[0];
    const startSalePrice = representative.startSalePrice;
    const endSalePrice = representative.endSalePrice;
    const startPyeongPrice = representative.startPyeongPrice;
    const endPyeongPrice = representative.endPyeongPrice;
    if (!startSalePrice || !endSalePrice || !startPyeongPrice || !endPyeongPrice) continue;

    const band = priceBand(basis === "end" ? endSalePrice : startSalePrice);
    if (!groups.has(band.key)) {
      groups.set(band.key, {
        ...band,
        apartments: [],
        startSalePrices: [],
        endSalePrices: [],
        startPyeongPrices: [],
        endPyeongPrices: []
      });
    }

    const group = groups.get(band.key);
    group.apartments.push({
      apartmentId: apartmentGroup.apartment.id,
      apartmentName: apartmentGroup.apartment.name,
      neighborhoodName: apartmentGroup.apartment.neighborhoodName,
      legalDongCode: apartmentGroup.apartment.legalDongCode,
      address: apartmentGroup.apartment.address,
      householdCount: apartmentGroup.apartment.householdCount,
      areaTypeCount: typeSummaries.length,
      areaLabel: representative.areaLabel,
      areaSummaries: typeSummaries,
      bandKey: band.key,
      bandLabel: band.label,
      basis,
      startSalePrice: Math.round(startSalePrice),
      endSalePrice: Math.round(endSalePrice),
      startPyeongPrice: Math.round(startPyeongPrice),
      endPyeongPrice: Math.round(endPyeongPrice),
      growthAmount: representative.growthAmount,
      growthRate: representative.growthRate
    });
    group.startSalePrices.push(startSalePrice);
    group.endSalePrices.push(endSalePrice);
    group.startPyeongPrices.push(startPyeongPrice);
    group.endPyeongPrices.push(endPyeongPrice);
  }

  const bands = [...groups.values()].map((group) => {
    const startSalePrice = average(group.startSalePrices);
    const endSalePrice = average(group.endSalePrices);
    const averageStartPyeongPrice = average(group.startPyeongPrices);
    const averageEndPyeongPrice = average(group.endPyeongPrices);
    const averageGrowthAmount = averageEndPyeongPrice - averageStartPyeongPrice;
    const averageGrowthRate = averageStartPyeongPrice ? averageGrowthAmount / averageStartPyeongPrice : 0;
    const topApartment = [...group.apartments].sort(compareApartmentGrowth)[0] || null;
    return {
      bandKey: group.key,
      bandLabel: group.label,
      basis,
      apartmentCount: group.apartments.length,
      startSalePrice: Math.round(startSalePrice),
      endSalePrice: Math.round(endSalePrice),
      startPyeongPrice: Math.round(averageStartPyeongPrice),
      endPyeongPrice: Math.round(averageEndPyeongPrice),
      averageGrowthAmount: Math.round(averageGrowthAmount),
      averageGrowthRate,
      topGrowthRate: topApartment?.growthRate ?? null,
      topApartmentName: topApartment?.apartmentName || ""
    };
  }).sort((a, b) => a.bandKey - b.bandKey);
  const allRows = bands.flatMap((band) => [...(groups.get(band.bandKey)?.apartments || [])].sort(compareApartmentGrowth)
    .map((row, index) => ({ ...row, rank: index + 1 })));

  return {
    period: { startMonth, endMonth },
    basis,
    areaBand: normalizedAreaBand,
    bands,
    allRows
  };
}

async function savePriceBandRankSnapshot({
  source,
  basis,
  periodMonths,
  startMonth,
  endMonth,
  minHouseholdCount = 0,
  areaBand = PRICE_AREA_BANDS[0],
  bands,
  rows
}) {
  const normalizedAreaBand = normalizePriceAreaBand(areaBand?.key || areaBand);
  return withClient(async (client) => {
    await client.query("begin");
    try {
      const snapshotResult = await client.query(`
        insert into price_band_rank_snapshots (
          source, basis, period_months, start_month, end_month, min_household_count,
          area_band_key, area_band_label, band_count, item_count, updated_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
        on conflict (source, basis, start_month, end_month, min_household_count, area_band_key) do update set
          period_months = excluded.period_months,
          area_band_label = excluded.area_band_label,
          band_count = excluded.band_count,
          item_count = excluded.item_count,
          updated_at = now()
        returning *
      `, [
        source,
        basis,
        periodMonths,
        startMonth,
        endMonth,
        minHouseholdCount,
        normalizedAreaBand.key,
        normalizedAreaBand.label,
        bands.length,
        rows.length
      ]);
      const snapshot = snapshotResult.rows[0];
      await client.query("delete from price_band_rank_items where snapshot_id = $1", [snapshot.id]);
      await insertPriceBandRankItems(client, snapshot.id, rows);

      await client.query("commit");
      return {
        id: Number(snapshot.id),
        source,
        basis,
        periodMonths,
        startMonth,
        endMonth,
        minHouseholdCount,
        areaBandKey: normalizedAreaBand.key,
        areaBandLabel: normalizedAreaBand.label,
        bandCount: bands.length,
        itemCount: rows.length,
        updatedAt: snapshot.updated_at
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

async function insertPriceBandRankItems(client, snapshotId, rows) {
  const chunkSize = 500;
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    const params = [];
    const values = chunk.map((row, index) => {
      const offset = index * 18;
      params.push(
        snapshotId,
        row.bandKey,
        row.bandLabel,
        row.rank,
        row.apartmentId,
        row.apartmentName,
        row.neighborhoodName || "",
        row.legalDongCode || "",
        row.address || "",
        row.areaTypeCount || 0,
        row.areaLabel || "",
        row.startSalePrice ?? null,
        row.endSalePrice ?? null,
        row.startPyeongPrice ?? null,
        row.endPyeongPrice ?? null,
        row.growthAmount ?? null,
        row.growthRate ?? null,
        JSON.stringify(Array.isArray(row.areaSummaries) ? row.areaSummaries : [])
      );
      return `(
        $${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},
        $${offset + 7},$${offset + 8},$${offset + 9},$${offset + 10},$${offset + 11},
        $${offset + 12},$${offset + 13},$${offset + 14},$${offset + 15},$${offset + 16},$${offset + 17},$${offset + 18}::jsonb,now()
      )`;
    });

    await client.query(`
      insert into price_band_rank_items (
        snapshot_id, band_key, band_label, rank, apartment_id, apartment_name,
        neighborhood_name, legal_dong_code, address, area_type_count, area_label,
        start_sale_price, end_sale_price, start_pyeong_price, end_pyeong_price,
        growth_amount, growth_rate, area_summaries, updated_at
      ) values ${values.join(",")}
    `, params);
  }
}

async function readBands(snapshotId, basis) {
  const result = await query(`
    with band_stats as (
      select
        band_key,
        band_label,
        count(*)::int as apartment_count,
        round(avg(start_sale_price))::int as start_sale_price,
        round(avg(end_sale_price))::int as end_sale_price,
        round(avg(start_pyeong_price))::int as start_pyeong_price,
        round(avg(end_pyeong_price))::int as end_pyeong_price,
        round(avg(end_pyeong_price) - avg(start_pyeong_price))::int as average_growth_amount,
        case
          when avg(start_pyeong_price) is null or avg(start_pyeong_price) = 0 then null
          else (avg(end_pyeong_price) - avg(start_pyeong_price)) / avg(start_pyeong_price)
        end as average_growth_rate,
        max(growth_rate) as top_growth_rate
      from price_band_rank_items
      where snapshot_id = $1
      group by band_key, band_label
    ),
    top_apartment as (
      select distinct on (band_key)
        band_key,
        apartment_name as top_apartment_name
      from price_band_rank_items
      where snapshot_id = $1
      order by band_key, growth_rate desc nulls last, growth_amount desc nulls last, end_pyeong_price desc nulls last, apartment_name asc
    )
    select band_stats.*, top_apartment.top_apartment_name
    from band_stats
    left join top_apartment using (band_key)
    order by band_key asc
  `, [snapshotId]);

  return result.rows.map((row) => ({
    bandKey: Number(row.band_key),
    bandLabel: row.band_label || "",
    basis,
    apartmentCount: Number(row.apartment_count || 0),
    startSalePrice: row.start_sale_price === null ? null : Number(row.start_sale_price),
    endSalePrice: row.end_sale_price === null ? null : Number(row.end_sale_price),
    startPyeongPrice: row.start_pyeong_price === null ? null : Number(row.start_pyeong_price),
    endPyeongPrice: row.end_pyeong_price === null ? null : Number(row.end_pyeong_price),
    averageGrowthAmount: row.average_growth_amount === null ? null : Number(row.average_growth_amount),
    averageGrowthRate: row.average_growth_rate === null ? null : Number(row.average_growth_rate),
    topGrowthRate: row.top_growth_rate === null ? null : Number(row.top_growth_rate),
    topApartmentName: row.top_apartment_name || ""
  }));
}

function serializePriceBandItem(row, basis) {
  return {
    rank: Number(row.filtered_rank || row.rank || 0),
    apartmentId: row.apartment_id || "",
    apartmentName: row.apartment_name || "",
    neighborhoodName: row.neighborhood_name || "",
    legalDongCode: row.legal_dong_code || "",
    address: row.address || "",
    householdCount: Number(row.household_count || 0),
    areaTypeCount: Number(row.area_type_count || 0),
    areaLabel: row.area_label || "",
    bandKey: Number(row.band_key),
    bandLabel: row.band_label || "",
    basis,
    startSalePrice: row.start_sale_price === null ? null : Number(row.start_sale_price),
    endSalePrice: row.end_sale_price === null ? null : Number(row.end_sale_price),
    startPyeongPrice: row.start_pyeong_price === null ? null : Number(row.start_pyeong_price),
    endPyeongPrice: row.end_pyeong_price === null ? null : Number(row.end_pyeong_price),
    growthAmount: row.growth_amount === null ? null : Number(row.growth_amount),
    growthRate: row.growth_rate === null ? null : Number(row.growth_rate),
    areaSummaries: normalizeAreaSummaries(row.area_summaries)
  };
}

function serializeComputedPriceBandItem(row, basis) {
  return {
    rank: Number(row.rank || 0),
    apartmentId: row.apartmentId || "",
    apartmentName: row.apartmentName || "",
    neighborhoodName: row.neighborhoodName || "",
    legalDongCode: row.legalDongCode || "",
    address: row.address || "",
    householdCount: Number(row.householdCount || 0),
    areaTypeCount: Number(row.areaTypeCount || 0),
    areaLabel: row.areaLabel || "",
    bandKey: Number(row.bandKey),
    bandLabel: row.bandLabel || "",
    basis,
    startSalePrice: nullableNumber(row.startSalePrice),
    endSalePrice: nullableNumber(row.endSalePrice),
    startPyeongPrice: nullableNumber(row.startPyeongPrice),
    endPyeongPrice: nullableNumber(row.endPyeongPrice),
    growthAmount: nullableNumber(row.growthAmount),
    growthRate: nullableNumber(row.growthRate),
    areaSummaries: normalizeAreaSummaries(row.areaSummaries)
  };
}

function filterComputedPriceBandRows(rows, { startBandKey = null, endBandKey = null } = {}) {
  return rows.filter((row) => {
    if (!priceInBand(row.startSalePrice, startBandKey)) return false;
    if (!priceInBand(row.endSalePrice, endBandKey)) return false;
    return true;
  });
}

function priceInBand(price, key) {
  if (key === null || key === undefined) return true;
  const range = priceBandRange(key);
  const number = Number(price);
  if (!range || !Number.isFinite(number)) return true;
  if (range.min !== null && number < range.min) return false;
  if (range.max !== null && number >= range.max) return false;
  return true;
}

function priceBandFallbackConditions({
  basis,
  minHouseholdCount,
  areaBand,
  selectedStartBandKey,
  selectedEndBandKey
}) {
  return [
    `기준=${basis === "end" ? "현재 가격" : "과거 가격"}`,
    `${formatHouseholdCondition(minHouseholdCount)}`,
    `평형=${areaBand?.label || "전체 평형"}`,
    `과거=${formatBandCondition(selectedStartBandKey)}`,
    `현재=${formatBandCondition(selectedEndBandKey)}`
  ].join(" / ");
}

function priceBandFallbackDedupeKey({
  source,
  startMonth,
  endMonth,
  minHouseholdCount,
  areaBand,
  selectedStartBandKey,
  selectedEndBandKey,
  reason
}) {
  return [
    "price-band-rank",
    source,
    startMonth || "",
    endMonth || "",
    minHouseholdCount,
    areaBand?.key || "all",
    selectedStartBandKey ?? "all",
    selectedEndBandKey ?? "all",
    reason
  ].join(":");
}

function formatHouseholdCondition(minHouseholdCount) {
  const count = Number(minHouseholdCount || 0);
  return count > 0 ? `${count}세대 이상` : "전체 세대";
}

function formatBandCondition(key) {
  if (key === null || key === undefined) return "전체";
  return priceBandLabelFromKey(key);
}

function priceBandLabelFromKey(key) {
  const number = Number(key);
  if (!Number.isFinite(number)) return "전체";
  if (number === 0) return "1억 미만";
  return `${number}억대`;
}

function notifyCacheFallback(event) {
  notifyTelegramCacheFallback(event).catch((error) => {
    console.warn("Telegram cache fallback alert failed:", error?.message || error);
  });
}

function normalizePeriodMonths(values) {
  return [...new Set(values.map(Number).filter((value) => Number.isInteger(value) && value > 0))]
    .sort((a, b) => a - b);
}

function normalizeMinHouseholdCounts(values) {
  const source = Array.isArray(values) ? values : [values];
  const normalized = source.map(normalizeMinHouseholdCount);
  return [...new Set(normalized)].sort((a, b) => a - b);
}

function normalizeMinHouseholdCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.floor(number);
}

function normalizeBases(values) {
  return [...new Set(values.map((value) => value === "end" ? "end" : "start"))]
    .sort((a, b) => PRICE_BAND_BASES.indexOf(a) - PRICE_BAND_BASES.indexOf(b));
}

function normalizePriceAreaBands(values) {
  const source = Array.isArray(values) ? values : [values];
  const normalized = source.map((value) => normalizePriceAreaBand(value));
  const byKey = new Map(normalized.map((band) => [band.key, band]));
  return PRICE_AREA_BANDS.filter((band) => byKey.has(band.key));
}

function normalizePriceAreaBand(value) {
  const key = typeof value === "object" && value !== null ? value.key : value;
  return PRICE_AREA_BANDS.find((band) => band.key === String(key || "")) || PRICE_AREA_BANDS[0];
}

function normalizeBandKey(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function groupMolitRows(rows, recentByType = new Map()) {
  const apartments = new Map();
  for (const row of rows) {
    const apartmentId = row.apartment_id;
    if (!apartments.has(apartmentId)) {
      apartments.set(apartmentId, {
        apartment: molitApartmentFromRow(row),
        types: new Map()
      });
    }
    const apartment = apartments.get(apartmentId);
    const typeKey = String(row.exclusive_area_m2);
    if (!apartment.types.has(typeKey)) {
      apartment.types.set(typeKey, {
        typeKey,
        exclusiveAreaM2: Number(row.exclusive_area_m2),
        recentPrice: recentByType.get(molitTypeKey(apartmentId, row.exclusive_area_m2)) || null,
        monthly: new Map()
      });
    }
    apartment.types.get(typeKey).monthly.set(row.deal_year_month, serializeMolitPrice(row));
  }
  return apartments;
}

function molitApartmentFromRow(row) {
  return {
    id: row.apartment_id,
    name: row.apartment_name,
    neighborhoodName: row.neighborhood_name || "",
    legalDongCode: row.legal_dong_code || "",
    address: row.address || "",
    sidoCode: row.sido_code || "",
    sigunguCode: row.sigungu_code || "",
    dongKey: row.dong_key || "",
    buildYear: row.build_year === null ? null : Number(row.build_year),
    dealCount: Number(row.apartment_deal_count || 0),
    householdCount: Number(row.household_count || 0),
    firstMonth: row.first_month || "",
    lastMonth: row.last_month || "",
    lat: Number(row.lat),
    lng: Number(row.lng)
  };
}

function carriedPriceAtOrBefore(monthly, yearMonth) {
  const result = [...monthly.entries()]
    .filter(([month]) => month <= yearMonth)
    .sort(([a], [b]) => b.localeCompare(a))[0];
  if (!result) return null;
  const [month, price] = result;
  return { ...price, yearMonth: month };
}

function serializeMolitPrice(row) {
  return {
    yearMonth: row.deal_year_month || "",
    sourceMonth: row.source_year_month || row.deal_year_month || "",
    saleMid: Number(row.sale_mid || 0),
    pyeongPrice: Number(row.pyeong_price || 0),
    dealCount: Number(row.deal_count || 0)
  };
}

function molitPriceBandAreaSummary(type, start, end) {
  const startSalePrice = Number(start.saleMid || 0);
  const endSalePrice = Number(end.saleMid || 0);
  const startPyeongPrice = Number(start.pyeongPrice || 0);
  const endPyeongPrice = Number(end.pyeongPrice || 0);
  const growthAmount = endSalePrice - startSalePrice;
  const growthRate = startSalePrice ? growthAmount / startSalePrice : 0;
  const pyeongGrowthAmount = endPyeongPrice - startPyeongPrice;
  const pyeongGrowthRate = startPyeongPrice ? pyeongGrowthAmount / startPyeongPrice : 0;

  return {
    typeKey: type.typeKey,
    exclusiveAreaM2: Number(type.exclusiveAreaM2 || 0),
    areaLabel: molitAreaLabel(type.exclusiveAreaM2),
    startMonth: start.yearMonth || "",
    endMonth: end.yearMonth || "",
    startSalePrice: Math.round(startSalePrice),
    endSalePrice: Math.round(endSalePrice),
    startPyeongPrice: Math.round(startPyeongPrice),
    endPyeongPrice: Math.round(endPyeongPrice),
    growthAmount: Math.round(growthAmount),
    growthRate,
    pyeongGrowthAmount: Math.round(pyeongGrowthAmount),
    pyeongGrowthRate,
    startDealCount: Number(start.dealCount || 0),
    endDealCount: Number(end.dealCount || 0)
  };
}

function normalizeAreaSummaries(value) {
  const summaries = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? safeJsonArray(value)
      : [];
  return summaries.map((item) => ({
    typeKey: item.typeKey || "",
    exclusiveAreaM2: Number(item.exclusiveAreaM2 || 0),
    areaLabel: item.areaLabel || molitAreaLabel(item.exclusiveAreaM2),
    startMonth: item.startMonth || "",
    endMonth: item.endMonth || "",
    startSalePrice: nullableNumber(item.startSalePrice),
    endSalePrice: nullableNumber(item.endSalePrice),
    startPyeongPrice: nullableNumber(item.startPyeongPrice),
    endPyeongPrice: nullableNumber(item.endPyeongPrice),
    growthAmount: nullableNumber(item.growthAmount),
    growthRate: nullableNumber(item.growthRate),
    pyeongGrowthAmount: nullableNumber(item.pyeongGrowthAmount),
    pyeongGrowthRate: nullableNumber(item.pyeongGrowthRate),
    startDealCount: Number(item.startDealCount || 0),
    endDealCount: Number(item.endDealCount || 0)
  })).filter((item) => item.areaLabel);
}

function safeJsonArray(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function nullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function molitPriceFreshnessRule(startMonth, endMonth) {
  const periodMonths = monthsBetween(startMonth, endMonth);
  if (!Number.isFinite(periodMonths)) return MOLIT_PRICE_FRESHNESS_RULES.at(-1);
  return MOLIT_PRICE_FRESHNESS_RULES.find((rule) => periodMonths <= rule.maxPeriodMonths)
    || MOLIT_PRICE_FRESHNESS_RULES.at(-1);
}

function isMolitPriceFreshForMonth(price, targetMonth, maxGapMonths) {
  const gapMonths = monthsBetween(price?.sourceMonth || price?.yearMonth, targetMonth);
  return Number.isFinite(gapMonths) && gapMonths >= 0 && gapMonths <= maxGapMonths;
}

function monthsBetween(startMonth, endMonth) {
  if (!/^\d{6}$/.test(String(startMonth || "")) || !/^\d{6}$/.test(String(endMonth || ""))) {
    return Number.NaN;
  }
  const startYear = Number(startMonth.slice(0, 4));
  const startMonthNumber = Number(startMonth.slice(4, 6));
  const endYear = Number(endMonth.slice(0, 4));
  const endMonthNumber = Number(endMonth.slice(4, 6));
  if (
    !Number.isFinite(startYear)
    || !Number.isFinite(startMonthNumber)
    || !Number.isFinite(endYear)
    || !Number.isFinite(endMonthNumber)
    || startMonthNumber < 1
    || startMonthNumber > 12
    || endMonthNumber < 1
    || endMonthNumber > 12
  ) {
    return Number.NaN;
  }
  return (endYear - startYear) * 12 + (endMonthNumber - startMonthNumber);
}

function average(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function compareApartmentGrowth(a, b) {
  return b.growthRate - a.growthRate
    || b.growthAmount - a.growthAmount
    || b.endPyeongPrice - a.endPyeongPrice
    || String(a.apartmentName || "").localeCompare(String(b.apartmentName || ""), "ko");
}

function compareAreaSummaryGrowth(a, b) {
  return b.growthRate - a.growthRate
    || b.growthAmount - a.growthAmount
    || b.endSalePrice - a.endSalePrice
    || a.exclusiveAreaM2 - b.exclusiveAreaM2;
}

function isAreaSummaryInBand(summary, band) {
  if (!summary || !band || band.key === "all") return true;
  const pyeong = exclusiveAreaPyeong(summary.exclusiveAreaM2);
  if (!Number.isFinite(pyeong) || pyeong <= 0) return false;
  if (band.key === "under10") return pyeong <= 10;
  if (band.key === "60plus") return pyeong >= 60;
  const decade = Number(band.key);
  if (decade === 10) return pyeong > 10 && pyeong < 20;
  return Number.isFinite(decade) && pyeong >= decade && pyeong < decade + 10;
}

function exclusiveAreaPyeong(exclusiveAreaM2) {
  return Number(exclusiveAreaM2) / 3.305785;
}

function molitAreaLabel(exclusiveAreaM2) {
  const area = Number(exclusiveAreaM2);
  if (!Number.isFinite(area) || area <= 0) return "전용 -";
  const pyeong = exclusiveAreaPyeong(area);
  const rounded = pyeong >= 10 ? Math.round(pyeong) : Math.round(pyeong * 10) / 10;
  return `전용 ${rounded}평`;
}

function priceBand(price) {
  const eok = Number(price) / 10000;
  if (!Number.isFinite(eok) || eok < 1) {
    return { key: 0, label: "1억 미만" };
  }
  if (eok < 10) {
    const floor = Math.floor(eok);
    return { key: floor, label: `${floor}억대` };
  }
  const floor = Math.floor(eok / 10) * 10;
  return { key: floor, label: `${floor}억대` };
}

function priceBandRange(key) {
  const number = Number(key);
  if (!Number.isFinite(number) || number < 0) return null;
  if (number === 0) return { min: null, max: 10000 };
  if (number < 10) return { min: number * 10000, max: (number + 1) * 10000 };
  return { min: number * 10000, max: (number + 10) * 10000 };
}

function molitTypeKey(apartmentId, exclusiveAreaM2) {
  return `${apartmentId}:${Number(exclusiveAreaM2).toFixed(2)}`;
}

function addMonths(month, delta) {
  const date = new Date(Number(month.slice(0, 4)), Number(month.slice(4, 6)) - 1, 1);
  date.setMonth(date.getMonth() + delta);
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function todayKstDateString() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
