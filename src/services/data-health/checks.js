import { query } from "../db.js";
import { DEFAULT_ACTIVE_MIN_HOUSEHOLD_COUNT } from "../map-growth-cache.js";
import { REQUIRED_MAP_LEVELS, STALE_CACHE_HOURS } from "./context.js";
import {
  addMonths,
  basisLabel,
  buildCheck,
  formatMonthKorean,
  householdLabel,
  isStale,
  matrixKey,
  periodLabel
} from "./utils.js";

const CHECKS = [
  checkRecentTradeFetches,
  checkRecentTradeDeals,
  checkMolitComplexCoverage,
  checkMapCacheMatrix,
  checkPriceBandCacheMatrix,
  checkPriceBandCacheReadPerformance,
  checkPriceBandLongRunningQueries
];

export async function runDataHealthChecks(context) {
  const checks = [];
  for (const check of CHECKS) {
    checks.push(await safeCheck(check, context));
  }
  return checks;
}

async function checkRecentTradeFetches(context) {
  const result = await query(`
    select
      year_month,
      count(distinct lawd_cd) filter (where status = 'completed')::int as completed_lawd_count,
      count(distinct lawd_cd)::int as known_lawd_count,
      count(*) filter (where status = 'completed')::int as completed_fetches,
      count(*) filter (where status = 'running')::int as running_fetches,
      count(*) filter (where status = 'failed')::int as failed_fetches,
      count(*)::int as total_fetches,
      coalesce(sum(saved_count) filter (where status = 'completed'), 0)::int as saved_count,
      max(updated_at) as updated_at
    from molit_trade_fetches
    where year_month = any($1::text[])
    group by year_month
  `, [context.recentMonths]);
  const byMonth = new Map(result.rows.map((row) => [row.year_month, row]));
  const details = context.recentMonths.map((month) => {
    const row = byMonth.get(month) || {};
    const completedLawdCount = Number(row.completed_lawd_count || 0);
    const failedFetches = Number(row.failed_fetches || 0);
    const runningFetches = Number(row.running_fetches || 0);
    const missingLawdCount = Math.max(context.expectedLawdCount - completedLawdCount, 0);
    return {
      month,
      status: missingLawdCount || failedFetches || runningFetches ? "fail" : "pass",
      completedLawdCount,
      expectedLawdCount: context.expectedLawdCount,
      missingLawdCount,
      completedFetches: Number(row.completed_fetches || 0),
      runningFetches,
      failedFetches,
      savedCount: Number(row.saved_count || 0),
      updatedAt: row.updated_at || null
    };
  });
  const failed = details.filter((item) => item.status === "fail");
  return buildCheck({
    key: "molit_recent_fetches",
    category: "collection",
    title: "최근 2개월 실거래가 fetch",
    status: failed.length ? "fail" : "pass",
    message: failed.length
      ? `${failed.length}개월에서 완료되지 않은 시군구 fetch가 있습니다.`
      : "최근 2개월 전국 시군구 fetch가 완료되었습니다.",
    metrics: {
      expectedLawdCount: context.expectedLawdCount,
      checkedMonths: context.recentMonths.length,
      failedMonths: failed.length
    },
    details
  });
}

async function checkRecentTradeDeals(context) {
  const result = await query(`
    select
      deal_year_month,
      count(*)::int as deal_count,
      count(distinct lawd_cd)::int as lawd_count,
      max(updated_at) as updated_at
    from molit_trade_deals
    where deal_year_month = any($1::text[])
      and coalesce(cancel_type, '') = ''
    group by deal_year_month
  `, [context.recentMonths]);
  const byMonth = new Map(result.rows.map((row) => [row.deal_year_month, row]));
  const details = context.recentMonths.map((month) => {
    const row = byMonth.get(month) || {};
    const dealCount = Number(row.deal_count || 0);
    return {
      month,
      status: dealCount > 0 ? "pass" : "fail",
      dealCount,
      lawdCount: Number(row.lawd_count || 0),
      updatedAt: row.updated_at || null
    };
  });
  const failed = details.filter((item) => item.status === "fail");
  return buildCheck({
    key: "molit_recent_deals",
    category: "collection",
    title: "최근 2개월 실거래 저장",
    status: failed.length ? "fail" : "pass",
    message: failed.length
      ? `${failed.map((item) => formatMonthKorean(item.month)).join(", ")} 거래 저장 건수가 0입니다.`
      : "최근 2개월 실거래 저장 데이터가 확인되었습니다.",
    metrics: {
      checkedMonths: context.recentMonths.length,
      totalDeals: details.reduce((sum, item) => sum + item.dealCount, 0)
    },
    details
  });
}

async function checkMolitComplexCoverage() {
  const result = await query(`
    select
      count(*)::int as total_count,
      count(*) filter (where lat is not null and lng is not null)::int as coordinate_count,
      count(*) filter (where coalesce(reb_household_count, 0) > 0)::int as household_count,
      count(*) filter (where coalesce(reb_household_count, 0) >= $1)::int as household_100_count,
      count(*) filter (where needs_review = true)::int as review_count,
      max(updated_at) as updated_at
    from molit_complexes
  `, [DEFAULT_ACTIVE_MIN_HOUSEHOLD_COUNT]);
  const row = result.rows[0] || {};
  const totalCount = Number(row.total_count || 0);
  const coordinateCount = Number(row.coordinate_count || 0);
  const householdCount = Number(row.household_count || 0);
  const coordinateRate = totalCount ? coordinateCount / totalCount : 0;
  const householdRate = totalCount ? householdCount / totalCount : 0;
  const warnings = [];
  if (!totalCount) {
    return buildCheck({
      key: "molit_complex_coverage",
      category: "complex",
      title: "실거래 단지 커버리지",
      status: "fail",
      message: "실거래 단지 테이블이 비어 있습니다.",
      metrics: { totalCount }
    });
  }
  if (coordinateRate < 0.8) warnings.push("좌표 확보율이 80% 미만입니다.");
  if (householdRate < 0.5) warnings.push("세대수 확보율이 50% 미만입니다.");
  return buildCheck({
    key: "molit_complex_coverage",
    category: "complex",
    title: "실거래 단지 커버리지",
    status: warnings.length ? "warn" : "pass",
    message: warnings.length ? warnings.join(" ") : "좌표와 세대수 커버리지가 기준 이상입니다.",
    metrics: {
      totalCount,
      coordinateCount,
      coordinateRate,
      householdCount,
      householdRate,
      household100Count: Number(row.household_100_count || 0),
      reviewCount: Number(row.review_count || 0),
      updatedAt: row.updated_at || null
    }
  });
}

async function checkMapCacheMatrix(context) {
  const expectedStarts = context.periodMonths.map((months) => addMonths(context.endMonth, -months));
  const result = await query(`
    select
      s.id,
      s.start_month,
      s.end_month,
      s.min_household_count,
      s.apartment_count,
      s.area_count,
      s.updated_at,
      count(i.*) filter (where i.level = 'sido')::int as sido_count,
      count(i.*) filter (where i.level = 'sigungu')::int as sigungu_count,
      count(i.*) filter (where i.level = 'dong')::int as dong_count,
      count(i.*) filter (where i.level = 'apartment')::int as apartment_count_items,
      count(i.*) filter (where i.level = 'apartment' and i.has_data = true)::int as apartment_data_count
    from map_growth_snapshots s
    left join map_growth_items i on i.snapshot_id = s.id
    where s.source = 'molit'
      and s.end_month = $1
      and s.start_month = any($2::text[])
      and s.min_household_count = any($3::int[])
    group by s.id
  `, [context.endMonth, expectedStarts, context.minHouseholdCounts]);
  const snapshots = new Map(result.rows.map((row) => [
    matrixKey(row.start_month, row.min_household_count),
    row
  ]));
  const details = [];
  for (const months of context.periodMonths) {
    const startMonth = addMonths(context.endMonth, -months);
    for (const minHouseholdCount of context.minHouseholdCounts) {
      const row = snapshots.get(matrixKey(startMonth, minHouseholdCount));
      details.push(mapCacheDetail({ row, months, startMonth, endMonth: context.endMonth, minHouseholdCount }));
    }
  }
  const failed = details.filter((item) => item.status === "fail");
  const warned = details.filter((item) => item.status === "warn");
  return buildCheck({
    key: "molit_map_cache_matrix",
    category: "cache",
    title: "지도 캐시 필수 조합",
    status: failed.length ? "fail" : warned.length ? "warn" : "pass",
    message: failed.length
      ? `${failed.length}개 지도 캐시 조합이 누락되었거나 비어 있습니다.`
      : warned.length
        ? `${warned.length}개 지도 캐시 조합이 오래되었습니다.`
        : "지도 캐시 필수 조합이 모두 준비되어 있습니다.",
    metrics: {
      expectedSnapshots: context.periodMonths.length * context.minHouseholdCounts.length,
      foundSnapshots: details.filter((item) => item.snapshotId).length,
      failedSnapshots: failed.length,
      warningSnapshots: warned.length
    },
    details
  });
}

async function checkPriceBandCacheMatrix(context) {
  const expectedStarts = context.periodMonths.map((months) => addMonths(context.endMonth, -months));
  const result = await query(`
    select
      s.id,
      s.basis,
      s.period_months,
      s.start_month,
      s.end_month,
      s.min_household_count,
      s.area_band_key,
      s.area_band_label,
      s.band_count,
      s.item_count,
      s.updated_at,
      coalesce(b.band_rows, 0)::int as stored_band_count
    from price_band_rank_snapshots s
    left join (
      select snapshot_id, count(*)::int as band_rows
      from price_band_rank_bands
      group by snapshot_id
    ) b
      on b.snapshot_id = s.id
    where s.source = 'molit'
      and s.end_month = $1
      and s.start_month = any($2::text[])
      and s.min_household_count = any($3::int[])
      and s.area_band_key = any($4::text[])
      and s.basis = any($5::text[])
      and s.status = 'active'
  `, [
    context.endMonth,
    expectedStarts,
    context.minHouseholdCounts,
    context.areaBandKeys,
    context.priceBandBases
  ]);
  const snapshots = new Map(result.rows.map((row) => [
    matrixKey(row.start_month, row.min_household_count, row.basis, row.area_band_key),
    row
  ]));
  const details = [];
  for (const months of context.periodMonths) {
    const startMonth = addMonths(context.endMonth, -months);
    for (const minHouseholdCount of context.minHouseholdCounts) {
      for (const basis of context.priceBandBases) {
        for (const areaBandKey of context.areaBandKeys) {
          const row = snapshots.get(matrixKey(startMonth, minHouseholdCount, basis, areaBandKey));
          details.push(priceBandCacheDetail({
            row,
            months,
            startMonth,
            endMonth: context.endMonth,
            minHouseholdCount,
            basis,
            areaBandKey
          }));
        }
      }
    }
  }
  const failed = details.filter((item) => item.status === "fail");
  const warned = details.filter((item) => item.status === "warn");
  return buildCheck({
    key: "molit_price_band_cache_matrix",
    category: "cache",
    title: "실거래가 랭킹 캐시 필수 조합",
    status: failed.length ? "fail" : warned.length ? "warn" : "pass",
    message: failed.length
      ? `${failed.length}개 실거래가 랭킹 캐시 조합이 누락되었거나 핵심 데이터가 비어 있습니다.`
      : warned.length
        ? `${warned.length}개 실거래가 랭킹 캐시 조합이 비어 있거나 오래되었습니다.`
        : "실거래가 랭킹 캐시 필수 조합이 모두 준비되어 있습니다.",
    metrics: {
      expectedSnapshots: context.periodMonths.length
        * context.minHouseholdCounts.length
        * context.priceBandBases.length
        * context.areaBandKeys.length,
      foundSnapshots: details.filter((item) => item.snapshotId).length,
      failedSnapshots: failed.length,
      warningSnapshots: warned.length
    },
    details
  });
}

async function checkPriceBandCacheReadPerformance(context) {
  const minHouseholdCount = DEFAULT_ACTIVE_MIN_HOUSEHOLD_COUNT;
  const expectedStarts = context.periodMonths.map((months) => addMonths(context.endMonth, -months));
  const snapshotResult = await query(`
    select
      s.id,
      s.start_month,
      s.end_month,
      s.period_months,
      s.basis,
      s.min_household_count,
      s.area_band_key,
      s.item_count,
      s.updated_at,
      coalesce(b.band_rows, 0)::int as stored_band_count
    from price_band_rank_snapshots
    s
    left join (
      select snapshot_id, count(*)::int as band_rows
      from price_band_rank_bands
      group by snapshot_id
    ) b
      on b.snapshot_id = s.id
    where s.source = 'molit'
      and s.status = 'active'
      and s.basis = any($1::text[])
      and s.start_month = any($2::text[])
      and s.end_month = $3
      and s.min_household_count = $4
      and s.area_band_key = 'all'
  `, [context.priceBandBases, expectedStarts, context.endMonth, minHouseholdCount]);
  const snapshots = new Map(snapshotResult.rows.map((row) => [
    matrixKey(row.start_month, row.min_household_count, row.basis, row.area_band_key),
    row
  ]));
  const details = [];
  for (const months of context.periodMonths) {
    const startMonth = addMonths(context.endMonth, -months);
    for (const basis of context.priceBandBases) {
      const snapshot = snapshots.get(matrixKey(startMonth, minHouseholdCount, basis, "all"));
      if (!snapshot) {
        details.push({
          status: "fail",
          label: `${periodLabel(months)} · ${basisLabel(basis)} · ${householdLabel(minHouseholdCount)} · 전체 평형`,
          months,
          basis,
          startMonth,
          endMonth: context.endMonth,
          minHouseholdCount,
          reason: "snapshot_missing"
        });
        continue;
      }

      const storedBandCount = Number(snapshot.stored_band_count || 0);
      const startedAt = Date.now();
      const [bandsResult, rowsResult] = await Promise.all([
        query(`
          select band_key, apartment_count
          from price_band_rank_bands
          where snapshot_id = $1
          order by band_key asc
        `, [snapshot.id]),
        query(`
          with ordered as (
            select pbi.*
            from price_band_rank_items pbi
            where pbi.snapshot_id = $1
            order by growth_rate desc nulls last,
                     growth_amount desc nulls last,
                     end_pyeong_price desc nulls last,
                     apartment_name asc
            limit 50
          )
          select ordered.rank, ordered.apartment_id, ordered.apartment_name, ordered.growth_rate,
                 coalesce(c.reb_household_count, a.household_count, 0)::int as household_count
          from ordered
          left join molit_complexes c
            on c.id = ordered.apartment_id
          left join apartments a
            on a.id = c.matched_apartment_id
        `, [snapshot.id])
      ]);
      const durationMs = Date.now() - startedAt;
      const sampleRows = rowsResult.rows.length;
      const bandRows = bandsResult.rows.length || storedBandCount;
      const itemCount = Number(snapshot.item_count || 0);
      const missingStoredBands = bandRows <= 0;
      const missingRows = itemCount <= 0 || sampleRows <= 0;
      const status = missingStoredBands || missingRows || durationMs > 5000
        ? "fail"
        : durationMs > 1500
          ? "warn"
          : "pass";
      details.push({
        status,
        label: `${periodLabel(months)} · ${basisLabel(basis)} · ${householdLabel(minHouseholdCount)} · 전체 평형`,
        months,
        basis,
        snapshotId: Number(snapshot.id),
        startMonth,
        endMonth: context.endMonth,
        minHouseholdCount,
        readDurationMs: durationMs,
        totalRows: itemCount,
        sampleRows,
        storedBandCount: bandRows,
        updatedAt: snapshot.updated_at || null,
        reason: missingStoredBands
          ? "stored_bands_missing"
          : missingRows
            ? "empty_cache_read"
            : status === "pass" ? "" : "slow_cache_read"
      });
    }
  }
  const failed = details.filter((item) => item.status === "fail");
  const warned = details.filter((item) => item.status === "warn");
  const durations = details.map((item) => Number(item.readDurationMs || 0)).filter(Number.isFinite);
  const maxDurationMs = durations.length ? Math.max(...durations) : 0;
  return buildCheck({
    key: "molit_price_band_cache_read_performance",
    category: "cache",
    title: "실거래가 랭킹 캐시 조회 성능",
    status: failed.length ? "fail" : warned.length ? "warn" : "pass",
    message: failed.length
      ? `${failed.length}개 기간/기준의 랭킹 캐시 조회가 실패했거나 너무 느립니다.`
      : warned.length
        ? `${warned.length}개 기간/기준의 랭킹 캐시 조회가 느립니다.`
        : "모든 기간의 랭킹 캐시 조회가 빠르게 응답합니다.",
    metrics: {
      checkedSnapshots: details.length,
      failedSnapshots: failed.length,
      warningSnapshots: warned.length,
      maxReadDurationMs: maxDurationMs,
      minHouseholdCount
    },
    details
  });
}

async function checkPriceBandLongRunningQueries() {
  const result = await query(`
    select
      pid,
      usename,
      wait_event_type,
      wait_event,
      extract(epoch from now() - query_start)::int as age_seconds,
      left(regexp_replace(query, E'[\\n\\r\\t ]+', ' ', 'g'), 240) as query_text
    from pg_stat_activity
    where datname = current_database()
      and state = 'active'
      and pid <> pg_backend_pid()
      and now() - query_start > interval '60 seconds'
      and (
        query ilike '%price_band_rank_items%'
        or query ilike '%price_band_rank_bands%'
        or query ilike '%price_band_rank_snapshots%'
        or (query ilike '%molit_trade_deals%' and query ilike '%with matched as%')
      )
    order by query_start asc
    limit 20
  `);
  const details = result.rows.map((row) => {
    const ageSeconds = Number(row.age_seconds || 0);
    return {
      status: ageSeconds >= 300 ? "fail" : "warn",
      label: `PID ${row.pid}`,
      pid: Number(row.pid),
      user: row.usename || "",
      waitEventType: row.wait_event_type || "",
      waitEvent: row.wait_event || "",
      ageSeconds,
      queryText: row.query_text || "",
      reason: "long_running_query"
    };
  });
  const failed = details.filter((item) => item.status === "fail");
  return buildCheck({
    key: "molit_price_band_long_running_queries",
    category: "cache",
    title: "실거래가 랭킹 장기 실행 쿼리",
    status: failed.length ? "fail" : details.length ? "warn" : "pass",
    message: failed.length
      ? `${failed.length}개 랭킹 관련 쿼리가 5분 이상 실행 중입니다.`
      : details.length
        ? `${details.length}개 랭킹 관련 쿼리가 1분 이상 실행 중입니다.`
        : "랭킹 관련 장기 실행 쿼리가 없습니다.",
    metrics: {
      longRunningQueries: details.length,
      fiveMinuteQueries: failed.length
    },
    details
  });
}

function mapCacheDetail({ row, months, startMonth, endMonth, minHouseholdCount }) {
  if (!row) {
    return {
      status: "fail",
      label: `${periodLabel(months)} · ${householdLabel(minHouseholdCount)}`,
      months,
      startMonth,
      endMonth,
      minHouseholdCount,
      reason: "snapshot_missing"
    };
  }
  const levelCounts = {
    sido: Number(row.sido_count || 0),
    sigungu: Number(row.sigungu_count || 0),
    dong: Number(row.dong_count || 0),
    apartment: Number(row.apartment_count_items || 0)
  };
  const missingLevels = REQUIRED_MAP_LEVELS.filter((level) => levelCounts[level] <= 0);
  const apartmentDataCount = Number(row.apartment_data_count || 0);
  const stale = isStale(row.updated_at, STALE_CACHE_HOURS);
  const failed = missingLevels.length || apartmentDataCount <= 0;
  return {
    status: failed ? "fail" : stale ? "warn" : "pass",
    label: `${periodLabel(months)} · ${householdLabel(minHouseholdCount)}`,
    snapshotId: Number(row.id),
    months,
    startMonth,
    endMonth,
    minHouseholdCount: Number(row.min_household_count || minHouseholdCount),
    apartmentCount: Number(row.apartment_count || 0),
    areaCount: Number(row.area_count || 0),
    levelCounts,
    apartmentDataCount,
    missingLevels,
    updatedAt: row.updated_at || null,
    reason: failed ? "empty_level" : stale ? "stale_cache" : ""
  };
}

function priceBandCacheDetail({ row, months, startMonth, endMonth, minHouseholdCount, basis, areaBandKey }) {
  const label = `${periodLabel(months)} · ${basisLabel(basis)} · ${householdLabel(minHouseholdCount)} · ${areaBandKey}`;
  if (!row) {
    return {
      status: "fail",
      label,
      months,
      startMonth,
      endMonth,
      minHouseholdCount,
      basis,
      areaBandKey,
      reason: "snapshot_missing"
    };
  }
  const bandCount = Number(row.band_count || 0);
  const storedBandCount = Number(row.stored_band_count || 0);
  const itemCount = Number(row.item_count || 0);
  const stale = isStale(row.updated_at, STALE_CACHE_HOURS);
  const coreEmpty = areaBandKey === "all" && (bandCount <= 0 || storedBandCount <= 0 || itemCount <= 0);
  const sideEmpty = areaBandKey !== "all" && itemCount <= 0;
  return {
    status: coreEmpty ? "fail" : sideEmpty || stale ? "warn" : "pass",
    label: `${periodLabel(months)} · ${basisLabel(basis)} · ${householdLabel(minHouseholdCount)} · ${row.area_band_label || areaBandKey}`,
    snapshotId: Number(row.id),
    months,
    startMonth,
    endMonth,
    minHouseholdCount: Number(row.min_household_count || minHouseholdCount),
    basis,
    areaBandKey: row.area_band_key || areaBandKey,
    areaBandLabel: row.area_band_label || areaBandKey,
    bandCount,
    storedBandCount,
    itemCount,
    updatedAt: row.updated_at || null,
    reason: coreEmpty ? "core_empty_or_bands_missing" : sideEmpty ? "area_empty" : stale ? "stale_cache" : ""
  };
}

async function safeCheck(check, context) {
  try {
    return await check(context);
  } catch (error) {
    return buildCheck({
      key: check.name || "unknown_check",
      category: "system",
      title: "검증 실행 오류",
      status: "fail",
      message: error.message || String(error),
      metrics: {}
    });
  }
}
