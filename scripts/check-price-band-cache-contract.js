import { closeDb } from "../src/services/db.js";
import { readPriceBandRankPage } from "../src/services/price-band-rank-cache.js";

const SOURCE = "molit";
const BASIS = "start";
const MIN_HOUSEHOLD_COUNT = Number(process.env.PRICE_BAND_CONTRACT_MIN_HOUSEHOLD_COUNT || 100);
const PERIOD_MONTHS = [3, 6, 12, 36, 60];
const REGION_SMOKE_SIDO_CODE = process.env.PRICE_BAND_CONTRACT_SIDO_CODE || "41";

const options = parseArgs(process.argv.slice(2));

try {
  const endMonth = options.endMonth || currentKstMonth();
  const checks = [];
  for (const months of PERIOD_MONTHS) {
    const startMonth = addMonths(endMonth, -months);
    checks.push(await checkPriceBandPage({
      label: `${months}개월 전국`,
      startMonth,
      endMonth,
      months
    }));
    checks.push(await checkPriceBandPage({
      label: `${months}개월 지역 ${REGION_SMOKE_SIDO_CODE}`,
      startMonth,
      endMonth,
      months,
      sidoCode: REGION_SMOKE_SIDO_CODE,
      requireRegionOptions: true
    }));
  }

  const failed = checks.filter((check) => check.status === "fail");
  const result = {
    ok: failed.length === 0,
    checkedAt: new Date().toISOString(),
    endMonth,
    checks,
    failedCount: failed.length
  };
  console.log(JSON.stringify(result, null, 2));
  if (failed.length && options.failOnIssue) process.exit(1);
} finally {
  await closeDb();
}

async function checkPriceBandPage({
  label,
  startMonth,
  endMonth,
  months,
  sidoCode = "",
  requireRegionOptions = false
}) {
  const startedAt = Date.now();
  try {
    const result = await readPriceBandRankPage({
      source: SOURCE,
      basis: BASIS,
      startMonth,
      endMonth,
      minHouseholdCount: MIN_HOUSEHOLD_COUNT,
      areaBandKey: "all",
      sidoCode,
      page: 1,
      pageSize: 10,
      environment: process.env.ORULZIP_ENVIRONMENT || process.env.NODE_ENV || "contract"
    });
    const rowCount = Array.isArray(result.rows) ? result.rows.length : 0;
    const totalRows = Number(result.pagination?.totalRows || 0);
    const sidoOptions = Array.isArray(result.region?.options?.sidos) ? result.region.options.sidos.length : 0;
    const sigunguOptions = Array.isArray(result.region?.options?.sigungus) ? result.region.options.sigungus.length : 0;
    const issues = [];
    if (!result.cache?.hit) issues.push("cache_miss");
    if (result.cache?.fallback) issues.push("cache_fallback");
    if (totalRows <= 0 || rowCount <= 0) issues.push("empty_rows");
    if (requireRegionOptions && sigunguOptions <= 0) issues.push("empty_region_options");
    if (!requireRegionOptions && sidoOptions <= 0) issues.push("empty_sido_options");
    return {
      status: issues.length ? "fail" : "pass",
      label,
      months,
      period: { startMonth, endMonth },
      sidoCode,
      durationMs: Date.now() - startedAt,
      totalRows,
      rowCount,
      cacheStatus: result.cache?.status || "",
      cacheHit: Boolean(result.cache?.hit),
      cacheFallback: Boolean(result.cache?.fallback),
      regionOptions: { sidos: sidoOptions, sigungus: sigunguOptions },
      issues
    };
  } catch (error) {
    return {
      status: "fail",
      label,
      months,
      period: { startMonth, endMonth },
      sidoCode,
      durationMs: Date.now() - startedAt,
      totalRows: 0,
      rowCount: 0,
      issues: ["exception"],
      error: error?.message || String(error)
    };
  }
}

function parseArgs(args) {
  return {
    failOnIssue: args.includes("--fail-on-issue"),
    endMonth: readOption(args, "--end-month")
  };
}

function readOption(args, name) {
  const prefix = `${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

function currentKstMonth() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7).replace("-", "");
}

function addMonths(yearMonth, delta) {
  const year = Number(String(yearMonth).slice(0, 4));
  const month = Number(String(yearMonth).slice(4, 6));
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
