import { initDb } from "../src/services/db.js";
import { runPerformanceMeasurements } from "../src/services/performance-measurements.js";

const args = new Set(process.argv.slice(2));
const save = !args.has("--no-save");
const environment = readArg("--environment") || process.env.ORULZIP_ENVIRONMENT || process.env.NODE_ENV || "unknown";
const failOnIssue = args.has("--fail-on-issue");
const attempts = normalizeAttempts(readArg("--attempts") || process.env.PERFORMANCE_MEASUREMENT_ATTEMPTS);

await initDb();

const attemptResults = [];
let result = null;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  result = await runPerformanceMeasurements({
    environment,
    save: save && attempts === 1
  });
  attemptResults.push(summarizeAttempt(result, attempt));
  if (!failOnIssue || result.status !== "fail") break;
}

const issueDetails = result.measurements
  .filter((item) => item.status !== "pass")
  .map((item) => ({
    unit: item.unitLabel,
    period: item.periodLabel,
    status: item.status,
    durationMs: item.durationMs,
    dataCount: item.dataCount,
    message: item.message
  }));

console.log(JSON.stringify({
  status: result.status,
  environment: result.environment,
  startedAt: result.startedAt,
  finishedAt: result.finishedAt,
  durationMs: result.durationMs,
  issueCount: result.issueCount,
  warningCount: result.warningCount,
  measurementCount: result.summary?.measurementCount || result.measurements?.length || 0,
  slowest: result.summary?.slowest || null,
  issues: issueDetails,
  attempt: attemptResults.length,
  attempts,
  previousAttempts: attemptResults.slice(0, -1),
  saved: Boolean(result.id),
  id: result.id || null
}, null, 2));

if (failOnIssue && result.status === "fail") process.exitCode = 1;

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] || "";
}

function normalizeAttempts(value) {
  const number = Math.floor(Number(value || 1));
  if (!Number.isFinite(number) || number <= 1) return 1;
  return Math.min(number, 5);
}

function summarizeAttempt(run, attempt) {
  return {
    attempt,
    status: run.status,
    durationMs: run.durationMs,
    issueCount: run.issueCount,
    warningCount: run.warningCount,
    slowest: run.summary?.slowest || null
  };
}
