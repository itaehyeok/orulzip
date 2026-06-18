import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { closeDb, initDb } from "../src/services/db.js";
import { DEFAULT_MAP_CACHE_PERIOD_YEARS, refreshMolitMapGrowthCache } from "../src/services/map-growth-cache.js";
import { syncMolitComplexes } from "../src/services/molit-complex-store.js";

const options = parseArgs(process.argv.slice(2));

if (!options.worker && options.years.length > 1) {
  await initDb();
  try {
    if (!options.skipComplexSync) await syncMolitComplexes({ geocode: false });
  } finally {
    await closeDb();
  }

  const scriptPath = fileURLToPath(import.meta.url);
  for (const year of options.years) {
    const result = spawnSync(process.execPath, [
      scriptPath,
      `--years=${year}`,
      "--worker",
      "--skip-complex-sync"
    ], {
      env: process.env,
      stdio: "inherit"
    });
    if (result.status !== 0) process.exit(result.status || 1);
  }

  console.log(JSON.stringify({
    message: "MOLIT map growth cache refreshed by isolated periods",
    periods: options.years
  }, null, 2));
  process.exit(0);
}

await initDb();
try {
  if (!options.skipComplexSync) await syncMolitComplexes({ geocode: false });
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
      : DEFAULT_MAP_CACHE_PERIOD_YEARS,
    worker: args.includes("--worker"),
    skipComplexSync: args.includes("--skip-complex-sync")
  };
}
