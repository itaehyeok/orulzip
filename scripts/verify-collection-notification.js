import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { query, withClient, closeDb } from "../src/services/db.js";
import { COLLECTION_LOCK_IDS, scheduledDateKst, boundedErrorMessage } from "../src/services/collection-run-store.js";
import { runDataHealthCheck } from "../src/services/data-health.js";

export function notificationTestPlan(testId, now = new Date()) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,63}$/.test(testId || "")) throw new Error("A bounded notification test ID is required.");
  const month = scheduledDateKst(now).slice(0, 7).replace("-", "");
  return { testId, month, args: ["--targets", "all-sido", "--start", month, "--end", month,
    "--force", "--limit", "1", "--delay-ms", "100", "--skip-map-cache-refresh"] };
}

export async function runNotificationTest(testId) {
  const plan = notificationTestPlan(testId);
  return withClient(async (client) => {
    const lock = await client.query("select pg_try_advisory_lock($1) as locked", [COLLECTION_LOCK_IDS.molit]);
    if (!lock.rows[0]?.locked) throw new Error("MOLIT is already running; refusing an overlapping notification test.");
    try {
      const previous = await query("select id, summary->'telegram' as telegram from data_health_runs where summary->>'notificationTestId' = $1 and summary->'telegram'->>'sent' = 'true' order by id desc limit 1", [plan.testId]);
      if (previous.rows.length) return {skipped:true, reason:"test_already_delivered", ...previous.rows[0]};
      const startedAt = new Date().toISOString();
      await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ["scripts/sync-molit-trades.js", ...plan.args], {cwd:process.cwd(),env:{...process.env,ORULZIP_DB_INIT:"0"},stdio:"inherit"});
        child.once("error", reject);
        child.once("close", (code) => code === 0 ? resolve() : reject(new Error("Bounded collection exited with status " + code)));
      });
      const written = await query("select count(*)::int as count from molit_trade_deals where deal_year_month=$1 and updated_at >= $2::timestamptz", [plan.month, startedAt]);
      const rowCount = written.rows[0].count;
      if (!Number.isSafeInteger(rowCount) || rowCount < 1) throw new Error("No DB rows were written; refusing a successful collection test notification.");
      const result = await runDataHealthCheck({
        environment: process.env.ORULZIP_ENVIRONMENT || "production", notify:true,
        notificationTestId: plan.testId,
        notificationLabel: "실거래 수집·알림 테스트 완료 (일부 대상: 1개 지역, " + plan.month + ", DB " + rowCount + "행 저장 확인)"
      });
      if (result.status === "fail") throw new Error("Collection test health check failed; inspect saved health run " + result.id);
      if (!result.telegram?.sent) throw new Error("Telegram test was not delivered; inspect saved health run " + result.id);
      return {testId:plan.testId,healthRunId:result.id,rowsWritten:rowCount,telegram:result.telegram};
    } finally {
      await client.query("select pg_advisory_unlock($1)", [COLLECTION_LOCK_IDS.molit]);
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify({message:"Collection notification test finished",...await runNotificationTest(process.argv[2])})); }
  catch(error) { console.error(JSON.stringify({message:"Collection notification test failed",error:boundedErrorMessage(error.message)})); process.exitCode=1; }
  finally { await closeDb(); }
}
