import { spawnSync } from "node:child_process";

const options = {
  targets: process.env.MOLIT_DAILY_TARGETS || "all-sido",
  recentTargets: process.env.MOLIT_DAILY_RECENT_TARGETS || process.env.MOLIT_DAILY_TARGETS || "all-sido",
  limit: process.env.MOLIT_DAILY_LIMIT || "6500",
  delayMs: process.env.MOLIT_DAILY_DELAY_MS || "500",
  geocodeLimit: process.env.MOLIT_GEOCODE_LIMIT || "5000",
  backfill: process.env.MOLIT_DAILY_BACKFILL !== "0",
  refreshPriceBandCache: process.env.MOLIT_DAILY_REFRESH_PRICE_BAND_CACHE !== "0",
  recentStart: process.env.MOLIT_DAILY_RECENT_START || previousMonth(),
  recentEnd: process.env.MOLIT_DAILY_RECENT_END || currentMonth()
};

console.log(JSON.stringify({
  message: "MOLIT daily cycle started",
  options
}, null, 2));

const recentStatus = runNode("scripts/sync-molit-trades.js", [
  "--targets", options.recentTargets,
  "--start", options.recentStart,
  "--end", options.recentEnd,
  "--force",
  "--only-collected-targets",
  "--limit", options.limit,
  "--delay-ms", options.delayMs,
  "--skip-map-cache-refresh"
], { allowQuotaExit: true });

if (recentStatus === 75) {
  console.log("[molit-daily] quota exhausted during recent refresh; cache refresh will wait for the next cycle.");
  process.exit(0);
}

let backfillQuotaExhausted = false;
if (options.backfill) {
  const backfillStatus = runNode("scripts/sync-molit-trades.js", [
    "--targets", options.targets,
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
runNpm(["run", "refresh:molit-map-cache", "--", "--skip-complex-sync"]);
if (options.refreshPriceBandCache) {
  runNpm(["run", "refresh:price-band-cache"]);
}
runNpm(["run", "check:data-health"]);

console.log(JSON.stringify({
  message: "MOLIT daily cycle finished",
  backfillQuotaExhausted
}, null, 2));

function runNode(script, args, { allowQuotaExit = false } = {}) {
  return run(process.execPath, [script, ...args], { allowQuotaExit });
}

function runNpm(args) {
  run("npm", args);
}

function run(command, args, { allowQuotaExit = false } = {}) {
  const result = spawnSync(command, args, {
    env: process.env,
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
