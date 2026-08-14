import { closeDb, initDb } from "../src/services/db.js";

const RESULT_PREFIX = "KB_CACHE_TASK_RESULT ";
const task = String(process.argv.find((argument) => argument.startsWith("--task=")) || "")
  .slice("--task=".length)
  .trim();

if (!task) throw new Error("--task is required");

await initDb();
try {
  const result = await runTask(task);
  console.log(`${RESULT_PREFIX}${JSON.stringify({ task, result })}`);
} finally {
  await closeDb();
}

async function runTask(taskName) {
  if (taskName === "map") {
    const { refreshMapGrowthCacheIfUnlocked } = await import("../src/services/map-growth-cache.js");
    const result = await refreshMapGrowthCacheIfUnlocked();
    if (result.skipped) throw new Error(`KB map cache refresh skipped: ${result.reason}`);
    return {
      refreshedAt: result.refreshedAt,
      snapshots: (result.snapshots || []).length,
      snapshotDetails: result.snapshots || []
    };
  }

  if (taskName === "ranking") {
    const { refreshApartmentRankCache } = await import("../src/services/apartment-rank-cache.js");
    const result = await refreshApartmentRankCache();
    return {
      refreshedAt: result.refreshedAt,
      snapshots: (result.snapshots || []).length,
      snapshotDetails: result.snapshots || []
    };
  }

  if (taskName === "overview") {
    const { refreshAppOverviewCache } = await import("../src/services/app-overview-cache.js");
    const result = await refreshAppOverviewCache();
    return {
      refreshedAt: result.cache?.refreshedAt || null,
      counts: result.counts || {},
      months: (result.months || []).length,
      regionStats: (result.regionStats || []).length,
      neighborhoods: (result.neighborhoods || []).length
    };
  }

  throw new Error(`Unsupported KB cache task: ${taskName}`);
}
