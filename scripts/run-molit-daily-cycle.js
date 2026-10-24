import { spawnSync } from "node:child_process";
import { buildMolitMonthCoverage } from "./molit-lawd-code-history.js";
import { monthSequence } from "../src/services/data-health/coverage.js";
import { query, closeDb } from "../src/services/db.js";
import { DEFAULT_MAP_CACHE_PERIOD_YEARS } from "../src/services/map-growth-cache.js";
import { DEFAULT_PRICE_BAND_PERIOD_MONTHS } from "../src/services/price-band-rank-cache.js";
import { parseRepairMonthArgument, planRepairCachePeriods } from "./molit-repair-options.js";

const repairMonth = parseRepairMonthArgument(process.argv.slice(2));
const options = {
  targets: process.env.MOLIT_DAILY_TARGETS || "all-sido",
  recentTargets: process.env.MOLIT_DAILY_RECENT_TARGETS || process.env.MOLIT_DAILY_TARGETS || "all-sido",
  limit: process.env.MOLIT_DAILY_LIMIT || "6500",
  delayMs: process.env.MOLIT_DAILY_DELAY_MS || "500",
  geocodeLimit: process.env.MOLIT_GEOCODE_LIMIT || "5000",
  backfill: process.env.MOLIT_DAILY_BACKFILL !== "0",
  refreshPriceBandCache: process.env.MOLIT_DAILY_REFRESH_PRICE_BAND_CACHE !== "0",
  refreshRebIdentity: process.env.MOLIT_DAILY_REFRESH_REB_IDENTITY !== "0",
  rebIdentityKeyConfigured: Boolean(process.env.REB_APT_IDENTITY_SERVICE_KEY || process.env.DATA_GO_KR_SERVICE_KEY),
  recentStart: process.env.MOLIT_DAILY_RECENT_START || previousMonth(),
  recentEnd: process.env.MOLIT_DAILY_RECENT_END || currentMonth(),
  repairMonth
};

console.log(JSON.stringify({
  message: repairMonth ? "MOLIT historical repair started" : "MOLIT daily cycle started",
  options
}, null, 2));

if (repairMonth) await runRepairCycle();
else await runScheduledCycle();

async function runRepairCycle() {
  const fetched = await query("select year_month,lawd_cd from molit_trade_fetches where status='completed'");
  const gaps = buildMolitMonthCoverage({months:monthSequence("201601",currentMonth()),completedRows:fetched.rows})
    .filter((row) => row.status === "fail").map((row) => row.month);
  await closeDb();
  const collectionStatus = runNode("scripts/sync-molit-trades.js", [
    "--targets", options.targets,
    "--start", repairMonth,
    "--end", repairMonth,
    "--limit", options.limit,
    "--delay-ms", options.delayMs,
    "--skip-map-cache-refresh"
  ], { allowQuotaExit: true });
  if (collectionStatus === 75) {
    console.error(`[molit-repair] quota exhausted while repairing ${repairMonth}; the repair is incomplete.`);
    process.exit(75);
  }

  const backfillStatus = runNode("scripts/sync-molit-trades.js", [
    "--targets", options.targets, "--end", currentMonth(),
    "--limit", options.limit, "--delay-ms", options.delayMs, "--skip-map-cache-refresh"
  ], {allowQuotaExit:true});
  if (backfillStatus === 75) process.exit(75);

  runNpm(["run", "sync:molit-complexes", "--", "--geocode", "--geocode-mode", "missing", "--geocode-limit", options.geocodeLimit]);

  const cachePeriods = planRepairCachePeriods({
    repairMonth,
    endMonth: currentMonth(),
    mapPeriodYears: DEFAULT_MAP_CACHE_PERIOD_YEARS,
    pricePeriodMonths: DEFAULT_PRICE_BAND_PERIOD_MONTHS
  });
  if (gaps.some((month) => month !== repairMonth)) {
    cachePeriods.mapPeriodYears = null;
    cachePeriods.pricePeriodMonths = null;
    cachePeriods.fullRefreshReason = "Other missing months were repaired: " + gaps.filter((month) => month !== repairMonth).join(",");
  }
  const mapCacheArgs = ["run", "refresh:molit-map-cache", "--", "--skip-complex-sync"];
  if (!gaps.some((month) => month !== repairMonth) && cachePeriods.mapPeriodYears) {
    mapCacheArgs.push(`--years=${cachePeriods.mapPeriodYears.join(",")}`);
  }
  runNpm(mapCacheArgs);

  if (options.refreshPriceBandCache) {
    const priceCacheArgs = ["run", "refresh:price-band-cache"];
    if (!gaps.some((month) => month !== repairMonth) && cachePeriods.pricePeriodMonths) {
      priceCacheArgs.push("--", `--months=${cachePeriods.pricePeriodMonths.join(",")}`);
    }
    runNpm(priceCacheArgs);
  }

  // Verify all MOLIT history and recent district freshness; the other provider has an independent run.
  runNpm(["run", "check:data-health", "--", "--no-notify"], { ...process.env, COLLECTION_HEALTH_PROVIDER: "molit" });
  runNpm(["run", "check:price-band-cache", "--", "--fail-on-issue"]);
  runNpm(["run", "check:performance"]);
  console.log(JSON.stringify({
    message: "MOLIT historical repair finished",
    repairMonth,
    cachePeriods
  }, null, 2));
}

async function runScheduledCycle() {
  const recentStatus = runNode("scripts/sync-molit-trades.js", [
    "--targets", options.recentTargets,
    "--start", options.recentStart,
    "--end", options.recentEnd,
    "--force",
    "--limit", options.limit,
    "--delay-ms", options.delayMs,
    "--skip-map-cache-refresh"
  ], { allowQuotaExit: true });

  if (recentStatus === 75) {
    console.error("[molit-daily] quota exhausted during recent refresh; the recent window is incomplete.");
    process.exit(75);
  }

  let backfillQuotaExhausted = false;
  if (options.backfill) {
    const backfillStatus = runNode("scripts/sync-molit-trades.js", [
      "--targets", options.targets,
      "--end", currentMonth(),
      "--limit", options.limit,
      "--delay-ms", options.delayMs,
      "--skip-map-cache-refresh"
    ], { allowQuotaExit: true });
    backfillQuotaExhausted = backfillStatus === 75;
    if (backfillQuotaExhausted) {
      console.log("[molit-daily] quota exhausted during backfill; continuing with cache refresh.");
    }
  }

  runNpm(["run", "sync:molit-complexes", "--", "--geocode", "--geocode-mode", "missing", "--geocode-limit", options.geocodeLimit]);
  if (options.refreshRebIdentity && options.rebIdentityKeyConfigured) {
    runNpm(["run", "sync:reb-apartments"]);
  } else if (options.refreshRebIdentity) {
    console.log("[molit-daily] REB household sync skipped: service key is not configured.");
  }
  runNpm(["run", "refresh:molit-map-cache", "--", "--skip-complex-sync"]);
  if (options.refreshPriceBandCache) {
    runNpm(["run", "refresh:price-band-cache"]);
  }
  runNpm(["run", "check:data-health", "--", "--no-notify"], { ...process.env, COLLECTION_HEALTH_PROVIDER: "molit" });
  runNpm(["run", "check:price-band-cache", "--", "--fail-on-issue"]);
  runNpm(["run", "check:performance"]);

  console.log(JSON.stringify({
    message: "MOLIT daily cycle finished",
    backfillQuotaExhausted
  }, null, 2));
}

function runNode(script, args, { allowQuotaExit = false } = {}) {
  return run(process.execPath, [script, ...args], { allowQuotaExit });
}

function runNpm(args, env = process.env) {
  run("npm", args, { env });
}

function run(command, args, { allowQuotaExit = false, env = process.env } = {}) {
  const result = spawnSync(command, args, {
    env,
    stdio: "inherit"
  });
  if (result.status === 75 && allowQuotaExit) return 75;
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
  return result.status || 0;
}

function currentMonth() {
  return kstDate().toISOString().slice(0, 7).replace("-", "");
}

function previousMonth() {
  const date = kstDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7).replace("-", "");
}

function kstDate() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}
