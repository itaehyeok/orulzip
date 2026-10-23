import { query } from "../db.js";
import { DEFAULT_ACTIVE_MIN_HOUSEHOLD_COUNT } from "../map-growth-cache.js";
import { REQUIRED_MAP_LEVELS, STALE_CACHE_HOURS } from "./context.js";
import { buildMonthCodeCoverage, monthSequence } from "./coverage.js";
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
  checkMolitHistoricalCoverage,
  checkMolitProviderRunFreshness,
  checkKbProviderRunFreshness,
  checkKbDailyAreaCoverage,
  checkKbPriceFreshness,
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
  const kbOnlyChecks = new Set([checkKbProviderRunFreshness, checkKbDailyAreaCoverage, checkKbPriceFreshness]);
  for (const check of CHECKS) {
    if (context.collectionHealthProvider === "molit" && kbOnlyChecks.has(check)) continue;
    checks.push(await safeCheck(check, context));
  }
  return checks;
}

async function checkMolitHistoricalCoverage(context) {
  const months = monthSequence(context.historicalStartMonth, context.endMonth);
  let result;
  try {
    result = await query(`
      select year_month, lawd_cd
      from molit_trade_fetches
      where status = 'completed'
        and year_month between $1 and $2
        and lawd_cd = any($3::text[])
      group by year_month, lawd_cd
    `, [context.historicalStartMonth, context.endMonth, context.expectedLawdCodes]);
  } catch (error) {
    if (isMissingTable(error, "molit_trade_fetches")) {
      return buildCheck({
        key: "molit_historical_coverage",
        category: "collection",
        title: "실거래 전체 이력 커버리지",
        status: "fail",
        message: "molit_trade_fetches 테이블이 없습니다. DB 초기화 또는 필수 스키마 적용 상태를 확인하세요.",
        metrics: { expectedLawdCount: context.expectedLawdCount, checkedMonths: months.length }
      });
    }
    throw error;
  }
  const details = buildMonthCodeCoverage({
    months,
    lawdCodes: context.expectedLawdCodes,
    completedRows: result.rows
  });
  const failed = details.filter((item) => item.status === "fail");
  const missingPairs = failed.reduce((sum, item) => sum + item.missingLawdCount, 0);
  return buildCheck({
    key: "molit_historical_coverage",
    category: "collection",
    title: "실거래 전체 이력 커버리지",
    status: failed.length ? "fail" : "pass",
    message: failed.length
      ? `${failed.length}개월에서 ${missingPairs}개 시군구 월 fetch가 누락되었습니다.`
      : "2016년 시작월부터 현재월까지 전국 법정동 코드별 fetch 이력이 완료되었습니다.",
    metrics: {
      startMonth: context.historicalStartMonth,
      endMonth: context.endMonth,
      expectedLawdCount: context.expectedLawdCount,
      checkedMonths: months.length,
      missingMonths: failed.length,
      missingLawdMonthPairs: missingPairs
    },
    details: details.map((item) => ({
      ...item,
      missingLawdCodes: item.missingLawdCodes.slice(0, 12)
    }))
  });
}

async function checkMolitProviderRunFreshness(context) {
  return checkProviderRunFreshness("molit", context);
}

async function checkKbProviderRunFreshness(context) {
  return checkProviderRunFreshness("kb", context);
}

async function checkProviderRunFreshness(provider, context) {
  let result;
  try {
    result = await query(`
      select
        (select count(*)::int from collection_runs where provider = $1 and status = 'running') as running_count,
        (select max(started_at) from collection_runs where provider = $1 and status = 'running') as running_started_at,
        (select status from collection_runs where provider = $1 and status in ('succeeded', 'failed') order by started_at desc limit 1) as status,
        (select scheduled_date::text from collection_runs where provider = $1 and status in ('succeeded', 'failed') order by started_at desc limit 1) as scheduled_date,
        (select started_at from collection_runs where provider = $1 and status in ('succeeded', 'failed') order by started_at desc limit 1) as started_at,
        (select finished_at from collection_runs where provider = $1 and status in ('succeeded', 'failed') order by started_at desc limit 1) as finished_at
    `, [provider]);
  } catch (error) {
    if (isMissingTable(error, "collection_runs")) {
      return buildCheck({
        key: `${provider}_provider_run_freshness`,
        category: "collection",
        title: `${provider.toUpperCase()} 수집 실행 신선도`,
        status: "fail",
        message: "collection_runs 테이블이 없습니다. 수집 실행 이력 마이그레이션이 적용되지 않았습니다.",
        metrics: { schemaReady: false }
      });
    }
    throw error;
  }
  const row = result.rows[0] || {};
  const runningCount = Number(row.running_count || 0);
  const runningAgeHours = row.running_started_at
    ? Math.max(0, (Date.now() - new Date(row.running_started_at).getTime()) / (60 * 60 * 1000))
    : null;
  const ageHours = row.finished_at
    ? Math.max(0, (Date.now() - new Date(row.finished_at).getTime()) / (60 * 60 * 1000))
    : null;
  let status = "pass";
  let message = `최근 ${provider.toUpperCase()} 수집 실행이 정상 종료되었습니다.`;
  if (runningCount && runningAgeHours <= context.providerRunMaxAgeHours) {
    status = "warn";
    message = `${provider.toUpperCase()} 수집 실행이 진행 중이며 완료 후 결과를 기록합니다.`;
  } else if (runningCount && runningAgeHours > context.providerRunMaxAgeHours) {
    status = "fail";
    message = `진행 중인 ${provider.toUpperCase()} 수집 실행이 ${context.providerRunMaxAgeHours}시간보다 오래되었습니다.`;
  } else if (!row.status) {
    status = "fail";
    message = `완료된 ${provider.toUpperCase()} 수집 실행 이력이 없습니다.`;
  } else if (row.status === "failed") {
    status = "fail";
    message = `가장 최근 ${provider.toUpperCase()} 수집 실행이 실패했습니다.`;
  } else if (ageHours > context.providerRunMaxAgeHours) {
    status = "fail";
    message = `${provider.toUpperCase()} 수집 성공 이력이 ${context.providerRunMaxAgeHours}시간보다 오래되었습니다.`;
  }
  return buildCheck({
    key: `${provider}_provider_run_freshness`,
    category: "collection",
    title: `${provider.toUpperCase()} 수집 실행 신선도`,
    status,
    message,
    metrics: {
      latestStatus: row.status || null,
      scheduledDate: row.scheduled_date || null,
      startedAt: row.started_at || null,
      finishedAt: row.finished_at || null,
      ageHours,
      runningCount,
      runningStartedAt: row.running_started_at || null,
      runningAgeHours,
      maxAgeHours: context.providerRunMaxAgeHours,
      schemaReady: true
    }
  });
}

async function checkKbDailyAreaCoverage(context) {
  let result;
  try {
    result = await query(`
      select
        count(*)::int as expected_area_count,
        count(f.area_type_id)::int as tracked_area_count,
        count(*) filter (where f.status in ('completed', 'no_price') and f.last_success_at >= now() - ($1::int * interval '1 hour'))::int as fresh_area_count,
        count(*) filter (where f.area_type_id is null)::int as untracked_area_count,
        count(*) filter (where f.status = 'failed')::int as failed_area_count,
        count(*) filter (where f.area_type_id is not null and (coalesce(f.status, '') not in ('completed', 'no_price') or f.last_success_at is null or f.last_success_at < now() - ($1::int * interval '1 hour')))::int as stale_area_count,
        max(f.latest_month) as latest_price_month,
        max(f.last_success_at) as latest_success_at
      from area_types at
      join apartments a on a.id = at.apartment_id
      left join kb_daily_area_fetches f on f.area_type_id = at.id
      where a.source = 'kb_internal_mvp'
        and a.source_complex_id is not null
        and (coalesce(at.supply_area_pyeong, 0) > 0 or coalesce(at.exclusive_area_pyeong, 0) > 0)
    `, [context.providerRunMaxAgeHours]);
  } catch (error) {
    if (isMissingTable(error, "kb_daily_area_fetches")) {
      return buildCheck({
        key: "kb_daily_area_coverage",
        category: "collection",
        title: "KB 기존 면적형 일일 갱신 커버리지",
        status: "fail",
        message: "kb_daily_area_fetches 테이블이 없습니다. KB 일일 갱신 마이그레이션이 적용되지 않았습니다.",
        metrics: { schemaReady: false }
      });
    }
    throw error;
  }
  const row = result.rows[0] || {};
  const expected = Number(row.expected_area_count || 0);
  const fresh = Number(row.fresh_area_count || 0);
  const untracked = Number(row.untracked_area_count || 0);
  const failed = Number(row.failed_area_count || 0);
  const stale = Number(row.stale_area_count || 0);
  const issues = [];
  if (!expected) issues.push("현재 area_types가 비어 있습니다.");
  if (untracked) issues.push(`${untracked}개 면적형이 아직 추적되지 않습니다.`);
  if (failed) issues.push(`${failed}개 면적형의 최근 조회가 실패했습니다.`);
  if (stale) issues.push(`${stale}개 면적형이 ${context.providerRunMaxAgeHours}시간 안에 성공적으로 조회되지 않았습니다.`);
  return buildCheck({
    key: "kb_daily_area_coverage",
    category: "collection",
    title: "KB 기존 면적형 일일 갱신 커버리지",
    status: issues.length ? "fail" : "pass",
    message: issues.length ? issues.join(" ") : "기존 면적형 전체가 최근 성공 조회 이력을 보유합니다.",
    metrics: {
      expectedAreaCount: expected,
      trackedAreaCount: Number(row.tracked_area_count || 0),
      freshAreaCount: fresh,
      untrackedAreaCount: untracked,
      failedAreaCount: failed,
      staleAreaCount: stale,
      latestPriceMonth: row.latest_price_month || null,
      latestSuccessAt: row.latest_success_at || null,
      maxAgeHours: context.providerRunMaxAgeHours,
      schemaReady: true
    }
  });
}

async function checkKbPriceFreshness(context) {
  let result;
  try {
    result = await query(`
      select max(year_month) as latest_price_month,
        max(updated_at) as latest_updated_at,
        count(*)::int as price_count
      from monthly_prices
    `);
  } catch (error) {
    if (isMissingTable(error, "monthly_prices")) {
      return buildCheck({
        key: "kb_price_freshness",
        category: "collection",
        title: "KB 시세 데이터 신선도",
        status: "fail",
        message: "monthly_prices 테이블이 없습니다. KB 가격 데이터 스키마를 확인하세요.",
        metrics: { schemaReady: false }
      });
    }
    throw error;
  }
  const row = result.rows[0] || {};
  const latestMonth = row.latest_price_month || null;
  const latestUpdatedAt = row.latest_updated_at || null;
  const minimumPublishedMonth = addMonths(context.endMonth, -context.kbPricePublicationGraceMonths);
  const updateAgeHours = latestUpdatedAt
    ? Math.max(0, (Date.now() - new Date(latestUpdatedAt).getTime()) / (60 * 60 * 1000))
    : null;
  const issues = [];
  if (!Number(row.price_count || 0)) issues.push("가격 데이터가 비어 있습니다.");
  if (!latestMonth) issues.push("최신 가격 월을 확인할 수 없습니다.");
  else if (latestMonth < minimumPublishedMonth) {
    issues.push(`최신 가격 월이 공개 유예 기준(${minimumPublishedMonth})보다 오래되었습니다.`);
  }
  if (!latestUpdatedAt) issues.push("가격 데이터 갱신 시각을 확인할 수 없습니다.");
  else if (updateAgeHours > context.kbPriceMaxUpdateAgeHours) {
    issues.push(`가격 데이터 갱신이 ${context.kbPriceMaxUpdateAgeHours}시간보다 오래되었습니다.`);
  }
  return buildCheck({
    key: "kb_price_freshness",
    category: "collection",
    title: "KB 시세 데이터 신선도",
    status: issues.length ? "fail" : "pass",
    message: issues.length ? issues.join(" ") : "공개된 최신월 기준과 최근 갱신 시각이 정상입니다.",
    metrics: {
      priceCount: Number(row.price_count || 0),
      latestPriceMonth: latestMonth,
      minimumPublishedMonth,
      latestUpdatedAt,
      updateAgeHours,
      maxUpdateAgeHours: context.kbPriceMaxUpdateAgeHours,
      publicationGraceMonths: context.kbPricePublicationGraceMonths
    }
  });
}

async function checkRecentTradeFetches(context) {
  const result = await query(`
    select year_month, lawd_cd
    from molit_trade_fetches
    where status = 'completed'
      and year_month = any($1::text[])
      and lawd_cd = any($2::text[])
    group by year_month, lawd_cd
  `, [context.recentMonths, context.expectedLawdCodes]);
  const details = buildMonthCodeCoverage({
    months: context.recentMonths,
    lawdCodes: context.expectedLawdCodes,
    completedRows: result.rows
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
      failedMonths: failed.length,
      missingLawdMonthPairs: failed.reduce((sum, item) => sum + item.missingLawdCount, 0)
    },
    details: details.map((item) => ({ ...item, missingLawdCodes: item.missingLawdCodes.slice(0, 12) }))
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
      s.metric,
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
      and s.metric = any($4::text[])
    group by s.id
  `, [context.endMonth, expectedStarts, context.minHouseholdCounts, context.mapGrowthMetrics]);
  const snapshots = new Map(result.rows.map((row) => [
    matrixKey(row.start_month, row.min_household_count, row.metric),
    row
  ]));
  const details = [];
  for (const months of context.periodMonths) {
    const startMonth = addMonths(context.endMonth, -months);
    for (const minHouseholdCount of context.minHouseholdCounts) {
      for (const metric of context.mapGrowthMetrics) {
        const row = snapshots.get(matrixKey(startMonth, minHouseholdCount, metric));
        details.push(mapCacheDetail({
          row,
          months,
          startMonth,
          endMonth: context.endMonth,
          minHouseholdCount,
          metric
        }));
      }
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
      expectedSnapshots: context.periodMonths.length * context.minHouseholdCounts.length * context.mapGrowthMetrics.length,
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

function mapCacheDetail({ row, months, startMonth, endMonth, minHouseholdCount, metric }) {
  if (!row) {
    return {
      status: "fail",
      label: `${periodLabel(months)} · ${mapGrowthMetricLabel(metric)} · ${householdLabel(minHouseholdCount)}`,
      months,
      startMonth,
      endMonth,
      minHouseholdCount,
      metric,
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
    label: `${periodLabel(months)} · ${mapGrowthMetricLabel(row.metric || metric)} · ${householdLabel(minHouseholdCount)}`,
    snapshotId: Number(row.id),
    months,
    startMonth,
    endMonth,
    minHouseholdCount: Number(row.min_household_count || minHouseholdCount),
    metric: row.metric || metric,
    apartmentCount: Number(row.apartment_count || 0),
    areaCount: Number(row.area_count || 0),
    levelCounts,
    apartmentDataCount,
    missingLevels,
    updatedAt: row.updated_at || null,
    reason: failed ? "empty_level" : stale ? "stale_cache" : ""
  };
}

function mapGrowthMetricLabel(metric) {
  return metric === "amount" ? "상승액" : "상승률";
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

function isMissingTable(error, tableName) {
  return error?.code === "42P01" && String(error.message || "").includes(tableName);
}
