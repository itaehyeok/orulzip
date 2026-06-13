import { closeDb, initDb } from "../src/services/db.js";
import { refreshAppOverviewCache } from "../src/services/app-overview-cache.js";

await initDb();
try {
  const result = await refreshAppOverviewCache();
  console.log(JSON.stringify({
    refreshedAt: result.cache.refreshedAt,
    counts: result.counts,
    months: result.months.length,
    regionStats: result.regionStats.length,
    neighborhoods: result.neighborhoods.length,
    mapCache: result.mapCache
  }, null, 2));
} finally {
  await closeDb();
}
