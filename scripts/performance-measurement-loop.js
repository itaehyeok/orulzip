import { initDb } from "../src/services/db.js";
import { runPerformanceMeasurements } from "../src/services/performance-measurements.js";

const intervalMs = Math.max(60_000, Number(process.env.PERFORMANCE_MEASUREMENT_INTERVAL_MS || 600_000));
const environment = process.env.ORULZIP_ENVIRONMENT || process.env.NODE_ENV || "unknown";
let stopping = false;

process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});

await initDb();

console.log(JSON.stringify({
  message: "performance measurement loop started",
  intervalMs,
  environment
}, null, 2));

while (!stopping) {
  const startedAt = new Date().toISOString();
  try {
    const result = await runPerformanceMeasurements({ environment, save: true });
    console.log(JSON.stringify({
      message: "performance measurement finished",
      startedAt,
      status: result.status,
      id: result.id || null,
      durationMs: result.durationMs,
      issueCount: result.issueCount,
      warningCount: result.warningCount
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      message: "performance measurement failed",
      startedAt,
      error: error?.message || String(error)
    }, null, 2));
  }
  await sleep(intervalMs);
}

console.log(JSON.stringify({
  message: "performance measurement loop stopped",
  environment
}, null, 2));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
