import { closeDb } from "../src/services/db.js";
import { migratePriceBandRankCacheSchema } from "../src/services/price-band-rank-cache.js";

try {
  await migratePriceBandRankCacheSchema();
  console.log(JSON.stringify({
    ok: true,
    migrated: "price-band-rank-cache",
    migratedAt: new Date().toISOString()
  }, null, 2));
} finally {
  await closeDb();
}
