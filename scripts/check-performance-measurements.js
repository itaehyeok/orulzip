import { initDb } from "../src/services/db.js";
import { runPerformanceMeasurements } from "../src/services/performance-measurements.js";

const args = new Set(process.argv.slice(2));
const save = !args.has("--no-save");
const environment = readArg("--environment") || process.env.ORULZIP_ENVIRONMENT || process.env.NODE_ENV || "unknown";

await initDb();

const result = await runPerformanceMeasurements({
  environment,
  save
});

console.log(JSON.stringify({
  status: result.status,
  environment: result.environment,
  startedAt: result.startedAt,
  finishedAt: result.finishedAt,
  durationMs: result.durationMs,
  issueCount: result.issueCount,
  warningCount: result.warningCount,
  measurementCount: result.summary?.measurementCount || result.measurements?.length || 0,
  saved: Boolean(result.id),
  id: result.id || null
}, null, 2));

if (args.has("--fail-on-issue") && result.status === "fail") process.exitCode = 1;

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] || "";
}
