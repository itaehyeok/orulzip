import { runDataHealthChecks } from "./data-health/checks.js";
import { buildDataHealthContext, defaultEnvironment } from "./data-health/context.js";
import { readDataHealthStatus, saveDataHealthRun } from "./data-health/store.js";
import { notifyTelegramDataHealth } from "./telegram-notifier.js";

export { readDataHealthStatus };

export async function runDataHealthCheck({
  environment = defaultEnvironment(),
  save = true,
  notify = false
} = {}) {
  const startedAt = new Date();
  const context = buildDataHealthContext();
  const checks = await runDataHealthChecks(context);
  const finishedAt = new Date();
  const issueCount = checks.filter((item) => item.status === "fail").length;
  const warningCount = checks.filter((item) => item.status === "warn").length;
  const status = issueCount ? "fail" : warningCount ? "warn" : "pass";
  const summary = {
    status,
    today: context.today,
    endMonth: context.endMonth,
    recentMonths: context.recentMonths,
    periodMonths: context.periodMonths,
    minHouseholdCounts: context.minHouseholdCounts,
    expectedLawdCount: context.expectedLawdCount,
    issueCount,
    warningCount,
    checkCount: checks.length,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString()
  };

  const run = {
    environment,
    status,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    issueCount,
    warningCount,
    summary,
    checks
  };

  if (save) {
    const saved = await saveDataHealthRun(run);
    run.id = saved.id;
    run.createdAt = saved.createdAt;
  }

  if (notify && shouldNotify(status)) {
    run.telegram = await notifyTelegramDataHealth({ environment, status, summary, checks })
      .catch((error) => ({ sent: false, reason: error.message || String(error) }));
  }

  return run;
}

function shouldNotify(status) {
  if (status === "fail" || status === "warn") return true;
  return process.env.ORULZIP_TELEGRAM_DATA_HEALTH_SUCCESS === "1";
}
