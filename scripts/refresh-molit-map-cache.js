import { closeDb, initDb } from "../src/services/db.js";
import { DEFAULT_MAP_CACHE_PERIOD_YEARS, refreshMolitMapGrowthCache } from "../src/services/map-growth-cache.js";
import { syncMolitComplexes } from "../src/services/molit-complex-store.js";

const options = parseArgs(process.argv.slice(2));

await initDb();
try {
  await syncMolitComplexes({ geocode: false });
  const result = await refreshMolitMapGrowthCache({
    periodYears: options.years
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
      : DEFAULT_MAP_CACHE_PERIOD_YEARS
  };
}
