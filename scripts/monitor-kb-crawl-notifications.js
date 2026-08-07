import { closeDb, initDb, withClient } from "../src/services/db.js";
import {
  buildKbCrawlNotificationEvents,
  KB_CRAWL_NOTIFICATION_LOG_MESSAGE
} from "../src/services/kb-crawl-notifications.js";
import { notifyTelegramKbCrawl } from "../src/services/telegram-notifier.js";

const monitorLockId = 442061304;
const intervalMs = Math.max(5_000, Number(process.env.KB_CRAWL_NOTIFICATION_INTERVAL_MS || 30_000));
const environment = process.env.ORULZIP_ENVIRONMENT || process.env.NODE_ENV || "unknown";
const jobIds = parseJobIds(process.env.KB_CRAWL_NOTIFICATION_JOB_IDS || "");
let stopping = false;

if (!jobIds.length) {
  throw new Error("KB_CRAWL_NOTIFICATION_JOB_IDS must contain at least one crawl job ID");
}

process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});

await initDb();
try {
  await withClient(async (client) => {
    const lockResult = await client.query("select pg_try_advisory_lock($1) as locked", [monitorLockId]);
    if (!lockResult.rows[0]?.locked) {
      console.log(JSON.stringify({
        message: "KB crawl Telegram monitor skipped because another monitor holds the lock",
        jobIds
      }));
      return;
    }

    console.log(JSON.stringify({
      message: "KB crawl Telegram monitor started",
      environment,
      intervalMs,
      jobIds
    }));

    try {
      while (!stopping) {
        try {
          await runNotificationCycle(client);
        } catch (error) {
          console.error(JSON.stringify({
            message: "KB crawl Telegram notification cycle failed",
            error: error?.message || String(error)
          }));
        }
        if (!stopping) await sleep(intervalMs);
      }
    } finally {
      await client.query("select pg_advisory_unlock($1)", [monitorLockId]);
    }
  });
} finally {
  await closeDb();
}

console.log(JSON.stringify({
  message: "KB crawl Telegram monitor stopped",
  jobIds
}));

async function runNotificationCycle(client) {
  const jobsResult = await client.query(`
    select *
    from crawl_jobs
    where id = any($1::bigint[])
    order by id
  `, [jobIds]);
  if (!jobsResult.rows.length) {
    throw new Error(`No crawl jobs found for IDs: ${jobIds.join(",")}`);
  }

  const [sentResult, cacheResult] = await Promise.all([
    client.query(`
      select details->>'eventKey' as event_key
      from crawl_logs
      where job_id = any($1::bigint[])
        and message = $2
        and details ? 'eventKey'
    `, [jobIds, KB_CRAWL_NOTIFICATION_LOG_MESSAGE]),
    client.query(`
      select distinct on (job_id)
        job_id,
        message,
        details
      from crawl_logs
      where job_id = any($1::bigint[])
        and message in ('Map growth cache refreshed', 'Map growth cache refresh failed')
      order by job_id, created_at desc
    `, [jobIds])
  ]);

  const events = buildKbCrawlNotificationEvents({
    jobs: jobsResult.rows,
    cacheRefreshedJobIds: cacheResult.rows
      .filter((row) => row.message === "Map growth cache refreshed")
      .map((row) => Number(row.job_id)),
    cacheFailedJobs: cacheResult.rows
      .filter((row) => row.message === "Map growth cache refresh failed")
      .map((row) => ({
        jobId: Number(row.job_id),
        errorMessage: row.details?.error || "캐시 갱신 실패"
      })),
    sentEventKeys: sentResult.rows.map((row) => row.event_key).filter(Boolean),
    environment,
    now: new Date()
  });

  for (const baseEvent of events) {
    const event = baseEvent.kind === "all_completed"
      ? { ...baseEvent, coverage: await readRegionCoverage(client, baseEvent.regionId) }
      : baseEvent;
    try {
      const result = await notifyTelegramKbCrawl(event);
      if (!result.sent) {
        console.warn(JSON.stringify({
          message: "KB crawl Telegram notification not sent",
          eventKey: event.key,
          reason: result.reason || "unknown"
        }));
        continue;
      }
      await recordSentEvent(client, event);
      console.log(JSON.stringify({
        message: "KB crawl Telegram notification sent",
        eventKey: event.key,
        kind: event.kind,
        jobId: event.jobId
      }));
    } catch (error) {
      console.error(JSON.stringify({
        message: "KB crawl Telegram notification failed",
        eventKey: event.key,
        error: error?.message || String(error)
      }));
    }
  }
}

async function recordSentEvent(client, event) {
  await client.query("begin");
  try {
    for (const eventKey of event.dedupeKeys || [event.key]) {
      await client.query(`
        insert into crawl_logs (job_id, level, message, details)
        values ($1, 'info', $2, $3)
      `, [event.jobId, KB_CRAWL_NOTIFICATION_LOG_MESSAGE, {
        eventKey,
        notificationKey: event.key,
        kind: event.kind,
        threshold: event.threshold || null,
        sentAt: new Date().toISOString()
      }]);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function readRegionCoverage(client, regionId) {
  const result = await client.query(`
    select
      count(distinct a.id)::int as apartments,
      count(distinct at.id)::int as area_types,
      count(mp.id)::int as monthly_prices,
      min(mp.year_month) as min_month,
      max(mp.year_month) as max_month
    from apartments a
    left join area_types at on at.apartment_id = a.id
    left join monthly_prices mp on mp.area_type_id = at.id
    where a.region_id = $1
  `, [regionId]);
  const row = result.rows[0] || {};
  return {
    apartments: Number(row.apartments || 0),
    areaTypes: Number(row.area_types || 0),
    monthlyPrices: Number(row.monthly_prices || 0),
    minMonth: row.min_month || "",
    maxMonth: row.max_month || ""
  };
}

function parseJobIds(value) {
  return [...new Set(String(value || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0))];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
