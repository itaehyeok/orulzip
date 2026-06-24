import { getRegion, kbCollectionRegions, listTiles } from "../src/services/region-config.js";

const args = parseArgs(process.argv.slice(2));
const dryRun = boolArg(args.dryRun, false);
const skipActive = boolArg(args.skipActive, true);
const selectedRegionIds = parseRegionIds(args.regions || args.region || "all");
const yearsBack = numberArg(args.yearsBack, 0);
const maxComplexes = numberArg(args.maxComplexes, 50000);
const maxAreaTypesPerComplex = numberArg(args.maxAreaTypesPerComplex, 50);
const delayMinMs = numberArg(args.delayMinMs, 800);
const delayMaxMs = numberArg(args.delayMaxMs, 2000);
const maxTilesArg = args.maxTiles || "all";

const regions = selectedRegionIds.includes("all")
  ? kbCollectionRegions()
  : selectedRegionIds.map((regionId) => getRegion(regionId)).filter(Boolean);

if (!regions.length) {
  console.error("No valid KB collection regions selected.");
  process.exit(1);
}

const results = [];
let dbModule = null;

try {
  dbModule = dryRun ? null : await import("../src/services/db.js");
  const store = dryRun ? null : await import("../src/services/db-store.js");
  if (dbModule) await dbModule.initDb();

  for (const region of regions) {
    const tileCount = listTiles(region).length;
    const maxTiles = maxTilesArg === "all" ? tileCount : Math.min(numberArg(maxTilesArg, tileCount), tileCount);

    if (!dryRun && skipActive && await hasActiveJob(dbModule.query, region.id)) {
      results.push({
        regionId: region.id,
        regionName: region.name,
        status: "skipped_active",
        maxTiles,
        tileCount
      });
      continue;
    }

    if (dryRun) {
      results.push({
        regionId: region.id,
        regionName: region.name,
        status: "dry_run",
        maxComplexes,
        yearsBack,
        maxAreaTypesPerComplex,
        maxTiles,
        tileCount,
        delayMinMs,
        delayMaxMs
      });
      continue;
    }

    const job = await store.createCrawlJob({
      regionId: region.id,
      maxComplexes,
      yearsBack,
      maxAreaTypesPerComplex,
      maxTiles,
      delayMinMs,
      delayMaxMs
    });

    results.push({
      regionId: region.id,
      regionName: region.name,
      status: "queued",
      jobId: Number(job.id),
      maxTiles,
      tileCount
    });
  }

  console.log(JSON.stringify({
    message: dryRun ? "KB national crawl dry run completed." : "KB national crawl jobs queued.",
    mode: yearsBack > 0 ? `${yearsBack} years` : "area-types-only",
    regions: results
  }, null, 2));
} finally {
  if (dbModule) await dbModule.closeDb();
}

async function hasActiveJob(dbQuery, regionId) {
  const result = await dbQuery(`
    select count(*)::int as count
    from crawl_jobs
    where region_id = $1
      and status in ('requested', 'discovering', 'running')
  `, [regionId]);
  return Number(result.rows[0]?.count || 0) > 0;
}

function parseArgs(items) {
  const parsed = {};
  for (const item of items) {
    if (!item.startsWith("--")) continue;
    const [rawKey, rawValue] = item.slice(2).split("=");
    const key = rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    parsed[key] = rawValue === undefined ? "1" : rawValue;
  }
  return parsed;
}

function parseRegionIds(value) {
  return String(value || "all")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberArg(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function boolArg(value, fallback) {
  if (value === undefined) return fallback;
  return !["0", "false", "no", "off"].includes(String(value).toLowerCase());
}
