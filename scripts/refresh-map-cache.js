import { closeDb, initDb } from "../src/services/db.js";
import { DEFAULT_MAP_CACHE_PERIOD_YEARS, refreshMapGrowthCache } from "../src/services/map-growth-cache.js";

const options = parseArgs(process.argv.slice(2));

await initDb();
try {
  const result = await refreshMapGrowthCache({
    periodYears: options.years.length ? options.years : DEFAULT_MAP_CACHE_PERIOD_YEARS
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await closeDb();
}

function parseArgs(args) {
  const yearsArg = args.find((arg) => arg.startsWith("--years="));
  return {
    years: yearsArg
      ? yearsArg.slice("--years=".length).split(",").map(Number).filter(Number.isFinite)
      : []
  };
}
