import { runDataHealthChecks } from "./data-health/checks.js";
import { buildDataHealthContext, defaultEnvironment } from "./data-health/context.js";
import { readDataHealthStatus, saveDataHealthRun, saveDataHealthTelegramResult } from "./data-health/store.js";
import { boundedErrorMessage } from "./collection-run-store.js";
import { notifyTelegramDataHealth } from "./telegram-notifier.js";

export { readDataHealthStatus };

export async function runDataHealthCheck({
  environment = defaultEnvironment(),
  save = true,
  notify = false,
  notificationLabel,
  notificationTestId,
  requireNotification = false
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
    finishedAt: finishedAt.toISOString(),
    ...(nonempty(notificationLabel) ? { notificationLabel: String(notificationLabel) } : {}),
    ...(nonempty(notificationTestId) ? { notificationTestId: String(notificationTestId) } : {})
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

  if (notify && (requireNotification || shouldNotify(status))) {
    const receipt = await notifyTelegramDataHealth({
      environment, status, summary, checks, notificationLabel
    }).catch((error) => ({ sent: false, reason: boundedErrorMessage(error?.message || error) }));
    run.telegram = receipt;
    run.summary.telegram = receipt;
    if (save && run.id !== undefined) await saveDataHealthTelegramResult(run.id, receipt);
  }

  return run;
}

function nonempty(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function shouldNotify(status) {
  if (status === "fail" || status === "warn") return true;
  return process.env.ORULZIP_TELEGRAM_DATA_HEALTH_SUCCESS === "1";
}
