import { query } from "./db.js";
import { readCachedZoomMapSummary } from "./map-growth-cache.js";
import { readPriceBandRankPage } from "./price-band-rank-cache.js";

const SOURCE = "molit";
const MIN_HOUSEHOLD_COUNT = 100;
const DEFAULT_ENVIRONMENT = process.env.ORULZIP_ENVIRONMENT || process.env.NODE_ENV || "unknown";
const WARN_DURATION_MS = Number(process.env.PERFORMANCE_MEASUREMENT_WARN_MS || 1500);
const FAIL_DURATION_MS = Number(process.env.PERFORMANCE_MEASUREMENT_FAIL_MS || 5000);

export const PERFORMANCE_MEASUREMENT_PERIODS = [
  { key: "3m", label: "3개월", months: 3 },
  { key: "6m", label: "6개월", months: 6 },
  { key: "1y", label: "1년", months: 12 },
  { key: "3y", label: "3년", months: 36 },
  { key: "5y", label: "5년", months: 60 }
];

export const PERFORMANCE_MEASUREMENT_UNITS = [
  { key: "map_marker_sido", label: "지도 마커 · 시도", group: "지도 마커", kind: "map", zoom: 10 },
  { key: "map_marker_sigungu", label: "지도 마커 · 시군구", group: "지도 마커", kind: "map", zoom: 11 },
  { key: "map_marker_dong", label: "지도 마커 · 동", group: "지도 마커", kind: "map", zoom: 13 },
  { key: "map_marker_apartment", label: "지도 마커 · 아파트", group: "지도 마커", kind: "map", zoom: 16 },
  { key: "map_ranking", label: "지도 랭킹", group: "지도 랭킹", kind: "mapRanking", zoom: 16 },
  { key: "price_band_ranking", label: "실거래가 랭킹", group: "실거래가 랭킹", kind: "priceBand" }
];

export async function readPerformanceMeasurementStatus({ limit = 10 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50));
  try {
    const result = await query(`
      select
        id,
        environment,
        status,
        started_at,
        finished_at,
        duration_ms,
        issue_count,
        warning_count,
        summary,
        measurements,
        created_at
      from performance_measurement_runs
      order by created_at desc
      limit $1
    `, [safeLimit]);
    const runs = result.rows.map(serializeRun);
    return {
      latest: runs[0] || null,
      runs,
      periods: PERFORMANCE_MEASUREMENT_PERIODS,
      units: PERFORMANCE_MEASUREMENT_UNITS.map(serializeUnit),
      schemaReady: true,
      thresholds: {
        warnMs: WARN_DURATION_MS,
        failMs: FAIL_DURATION_MS
      }
    };
  } catch (error) {
    if (isMissingPerformanceTable(error)) {
      return {
        latest: null,
        runs: [],
        periods: PERFORMANCE_MEASUREMENT_PERIODS,
        units: PERFORMANCE_MEASUREMENT_UNITS.map(serializeUnit),
        schemaReady: false,
        error: "performance_measurement_runs_missing",
        message: "성능 측정 테이블이 아직 준비되지 않았습니다."
      };
    }
    throw error;
  }
}

export async function runPerformanceMeasurements({
  environment = DEFAULT_ENVIRONMENT,
  save = false
} = {}) {
  const startedAt = new Date();
  const [mapSnapshots, priceBandSnapshots] = await Promise.all([
    readLatestMapSnapshotsByPeriod(),
    readLatestPriceBandSnapshotsByPeriod()
  ]);
  const measurements = [];

  for (const unit of PERFORMANCE_MEASUREMENT_UNITS) {
    for (const period of PERFORMANCE_MEASUREMENT_PERIODS) {
      const snapshot = unit.kind === "priceBand"
        ? priceBandSnapshots.get(period.key)
        : mapSnapshots.get(period.key);
      measurements.push(await measureUnitPeriod({ unit, period, snapshot, environment }));
    }
  }

  const finishedAt = new Date();
  const issueCount = measurements.filter((item) => item.status === "fail").length;
  const warningCount = measurements.filter((item) => item.status === "warn").length;
  const status = issueCount ? "fail" : warningCount ? "warn" : "pass";
  const summary = buildSummary({ measurements, mapSnapshots, priceBandSnapshots });
  const run = {
    environment,
    status,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    issueCount,
    warningCount,
    summary,
    measurements
  };

  if (save) {
    const saved = await savePerformanceMeasurementRun(run);
    run.id = saved.id;
    run.createdAt = saved.createdAt;
  }

  return run;
}

async function readLatestMapSnapshotsByPeriod() {
  const result = await query(`
    select
      start_month,
      end_month,
      period_years,
      min_household_count,
      apartment_count,
      area_count,
      updated_at
    from map_growth_snapshots
    where source = $1
      and min_household_count = $2
    order by end_month desc, updated_at desc
  `, [SOURCE, MIN_HOUSEHOLD_COUNT]);
  return selectSnapshotsByPeriod(result.rows, (row) => monthsBetween(row.start_month, row.end_month));
}

async function readLatestPriceBandSnapshotsByPeriod() {
  const result = await query(`
    select
      start_month,
      end_month,
      period_months,
      min_household_count,
      item_count,
      band_count,
      updated_at
    from price_band_rank_snapshots
    where source = $1
      and basis = 'start'
      and min_household_count = $2
      and area_band_key = 'all'
      and status = 'active'
    order by end_month desc, activated_at desc nulls last, updated_at desc
  `, [SOURCE, MIN_HOUSEHOLD_COUNT]);
  return selectSnapshotsByPeriod(result.rows, (row) => Number(row.period_months || monthsBetween(row.start_month, row.end_month)));
}

function selectSnapshotsByPeriod(rows, monthGetter) {
  const selected = new Map();
  for (const period of PERFORMANCE_MEASUREMENT_PERIODS) {
    const candidates = rows
      .map((row) => ({
        row,
        actualMonths: monthGetter(row),
        distance: Math.abs(monthGetter(row) - period.months)
      }))
      .filter((item) => Number.isFinite(item.actualMonths))
      .filter((item) => item.distance <= periodToleranceMonths(period.months))
      .sort((a, b) => (
        a.distance - b.distance
        || compareDesc(a.row.end_month, b.row.end_month)
        || compareDesc(a.row.updated_at, b.row.updated_at)
      ));
    if (candidates[0]) {
      selected.set(period.key, serializeSnapshot(candidates[0].row, candidates[0].actualMonths));
    }
  }
  return selected;
}

async function measureUnitPeriod({ unit, period, snapshot, environment }) {
  if (!snapshot) {
    return buildMeasurement({
      unit,
      period,
      snapshot: null,
      status: "fail",
      message: "해당 기간의 100세대 캐시 스냅샷이 없습니다.",
      durationMs: 0,
      dataCount: 0
    });
  }

  const started = Date.now();
  try {
    const result = unit.kind === "priceBand"
      ? await measurePriceBandRanking(snapshot, period, environment)
      : await measureMapSummary(unit, snapshot, environment);
    const durationMs = Date.now() - started;
    const status = measurementStatus({ durationMs, dataCount: result.dataCount });
    return buildMeasurement({
      unit,
      period,
      snapshot,
      status,
      message: measurementMessage({ status, durationMs, dataCount: result.dataCount }),
      durationMs,
      ...result
    });
  } catch (error) {
    return buildMeasurement({
      unit,
      period,
      snapshot,
      status: "fail",
      message: error?.message || "측정 중 오류가 발생했습니다.",
      durationMs: Date.now() - started,
      dataCount: 0
    });
  }
}

async function measureMapSummary(unit, snapshot, environment) {
  const filters = {
    source: SOURCE,
    start: snapshot.startMonth,
    end: snapshot.endMonth,
    zoom: unit.zoom,
    minHouseholdCount: MIN_HOUSEHOLD_COUNT,
    environment
  };
  if (unit.kind === "mapRanking") filters.rankingScope = "country";
  const result = await readCachedZoomMapSummary(filters);
  const items = Array.isArray(result?.items) ? result.items : [];
  return {
    dataCount: items.length,
    cacheUpdatedAt: result?.cache?.updatedAt || snapshot.updatedAt,
    cacheHit: Boolean(result?.cache?.hit),
    cacheSource: result?.cache?.rankSource || result?.cache?.source || SOURCE,
    servedPeriod: result?.period || null,
    details: {
      level: result?.level || "",
      zoom: unit.zoom,
      rankSource: result?.cache?.rankSource || "",
      rankingScope: result?.cache?.rankingScope || ""
    }
  };
}

async function measurePriceBandRanking(snapshot, period, environment) {
  const result = await readPriceBandRankPage({
    source: SOURCE,
    basis: "start",
    startMonth: snapshot.startMonth,
    endMonth: snapshot.endMonth,
    minHouseholdCount: MIN_HOUSEHOLD_COUNT,
    areaBandKey: "all",
    page: 1,
    pageSize: 50,
    environment
  });
  return {
    dataCount: Number(result?.pagination?.totalRows || result?.rows?.length || 0),
    cacheUpdatedAt: result?.cache?.updatedAt || snapshot.updatedAt,
    cacheHit: Boolean(result?.cache?.hit),
    cacheSource: result?.cache?.source || SOURCE,
    servedPeriod: result?.period || null,
    details: {
      pageRows: Array.isArray(result?.rows) ? result.rows.length : 0,
      totalRows: Number(result?.pagination?.totalRows || 0),
      bands: Array.isArray(result?.bands) ? result.bands.length : 0,
      cacheStatus: result?.cache?.status || "",
      fallback: Boolean(result?.cache?.fallback)
    }
  };
}

function buildMeasurement({
  unit,
  period,
  snapshot,
  status,
  message,
  durationMs,
  dataCount,
  cacheUpdatedAt = null,
  cacheHit = false,
  cacheSource = "",
  servedPeriod = null,
  details = {}
}) {
  return {
    unitKey: unit.key,
    unitLabel: unit.label,
    unitGroup: unit.group,
    periodKey: period.key,
    periodLabel: period.label,
    targetMonths: period.months,
    status,
    message,
    durationMs: Number(durationMs || 0),
    dataCount: Number(dataCount || 0),
    cacheUpdatedAt,
    cacheHit,
    cacheSource,
    snapshot,
    servedPeriod,
    details
  };
}

async function savePerformanceMeasurementRun(run) {
  const result = await query(`
    insert into performance_measurement_runs (
      environment,
      status,
      started_at,
      finished_at,
      duration_ms,
      issue_count,
      warning_count,
      summary,
      measurements
    ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
    returning id, created_at
  `, [
    run.environment,
    run.status,
    run.startedAt,
    run.finishedAt,
    run.durationMs,
    run.issueCount,
    run.warningCount,
    JSON.stringify(run.summary),
    JSON.stringify(run.measurements)
  ]);
  return {
    id: Number(result.rows[0].id),
    createdAt: result.rows[0].created_at
  };
}

function buildSummary({ measurements, mapSnapshots, priceBandSnapshots }) {
  const durations = measurements.map((item) => Number(item.durationMs || 0));
  const slowest = [...measurements].sort((a, b) => Number(b.durationMs || 0) - Number(a.durationMs || 0))[0] || null;
  return {
    source: SOURCE,
    minHouseholdCount: MIN_HOUSEHOLD_COUNT,
    measurementCount: measurements.length,
    passCount: measurements.filter((item) => item.status === "pass").length,
    warningCount: measurements.filter((item) => item.status === "warn").length,
    issueCount: measurements.filter((item) => item.status === "fail").length,
    maxDurationMs: Math.max(0, ...durations),
    averageDurationMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
    slowest: slowest ? {
      unitKey: slowest.unitKey,
      unitLabel: slowest.unitLabel,
      periodKey: slowest.periodKey,
      periodLabel: slowest.periodLabel,
      durationMs: slowest.durationMs
    } : null,
    mapSnapshots: snapshotSummary(mapSnapshots),
    priceBandSnapshots: snapshotSummary(priceBandSnapshots),
    thresholds: {
      warnMs: WARN_DURATION_MS,
      failMs: FAIL_DURATION_MS
    }
  };
}

function snapshotSummary(snapshotMap) {
  return PERFORMANCE_MEASUREMENT_PERIODS.map((period) => {
    const snapshot = snapshotMap.get(period.key);
    return {
      periodKey: period.key,
      periodLabel: period.label,
      startMonth: snapshot?.startMonth || "",
      endMonth: snapshot?.endMonth || "",
      updatedAt: snapshot?.updatedAt || null
    };
  });
}

function measurementStatus({ durationMs, dataCount }) {
  if (!Number.isFinite(Number(dataCount)) || Number(dataCount) <= 0) return "fail";
  if (durationMs >= FAIL_DURATION_MS) return "fail";
  if (durationMs >= WARN_DURATION_MS) return "warn";
  return "pass";
}

function measurementMessage({ status, durationMs, dataCount }) {
  if (!Number.isFinite(Number(dataCount)) || Number(dataCount) <= 0) return "데이터가 비어 있습니다.";
  if (status === "fail") return `${formatSeconds(durationMs)} 이상 지연입니다.`;
  if (status === "warn") return `${formatSeconds(durationMs)}로 주의 기준을 넘었습니다.`;
  return "정상 응답입니다.";
}

function serializeRun(row) {
  return {
    id: Number(row.id),
    environment: row.environment || "unknown",
    status: row.status || "unknown",
    startedAt: row.started_at || null,
    finishedAt: row.finished_at || null,
    durationMs: Number(row.duration_ms || 0),
    issueCount: Number(row.issue_count || 0),
    warningCount: Number(row.warning_count || 0),
    summary: row.summary || {},
    measurements: Array.isArray(row.measurements) ? row.measurements : [],
    createdAt: row.created_at || null
  };
}

function serializeUnit(unit) {
  return {
    key: unit.key,
    label: unit.label,
    group: unit.group,
    kind: unit.kind,
    zoom: unit.zoom || null
  };
}

function serializeSnapshot(row, actualMonths) {
  return {
    startMonth: row.start_month || "",
    endMonth: row.end_month || "",
    actualMonths: Number(actualMonths || 0),
    periodYears: Number(row.period_years || 0),
    periodMonths: Number(row.period_months || actualMonths || 0),
    minHouseholdCount: Number(row.min_household_count || 0),
    apartmentCount: Number(row.apartment_count || row.item_count || 0),
    areaCount: Number(row.area_count || 0),
    bandCount: Number(row.band_count || 0),
    updatedAt: row.updated_at || null
  };
}

function periodToleranceMonths(months) {
  if (months <= 12) return 2;
  return 6;
}

function monthsBetween(startMonth, endMonth) {
  const start = parseYearMonth(startMonth);
  const end = parseYearMonth(endMonth);
  if (!start || !end) return NaN;
  return (end.year - start.year) * 12 + (end.month - start.month);
}

function parseYearMonth(value) {
  const match = String(value || "").match(/^(\d{4})(\d{2})$/);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return {
    year: Number(match[1]),
    month
  };
}

function compareDesc(a, b) {
  const left = a instanceof Date ? a.getTime() : String(a || "");
  const right = b instanceof Date ? b.getTime() : String(b || "");
  if (left > right) return -1;
  if (left < right) return 1;
  return 0;
}

function formatSeconds(ms) {
  return `${(Number(ms || 0) / 1000).toFixed(2)}초`;
}

function isMissingPerformanceTable(error) {
  return error?.code === "42P01" && /performance_measurement_runs/.test(error?.message || "");
}
