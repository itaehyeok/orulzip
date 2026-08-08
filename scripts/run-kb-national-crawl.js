import { refreshApartmentRankCache } from "../src/services/apartment-rank-cache.js";
import { refreshAppOverviewCache } from "../src/services/app-overview-cache.js";
import { closeDb, initDb, withClient } from "../src/services/db.js";
import { runDataHealthCheck } from "../src/services/data-health.js";
import {
  buildHistoricalCrawlProfile,
  buildNationalProgress,
  crawlStageProgress,
  KB_NATIONAL_ALL_REGION_IDS,
  KB_NATIONAL_PRECOMPLETED_REGION_IDS,
  KB_NATIONAL_REGION_ORDER,
  nationalRegionDescriptor,
  normalizeCrawlJob,
  normalizeNationalRegionIds,
  reachedProgressMilestones
} from "../src/services/kb-national-crawl.js";
import {
  DEFAULT_MAP_CACHE_PERIOD_YEARS,
  DEFAULT_MAP_GROWTH_METRICS,
  DEFAULT_MIN_HOUSEHOLD_COUNTS,
  refreshMapGrowthCacheIfUnlocked,
  refreshMolitMapGrowthCache
} from "../src/services/map-growth-cache.js";
import { syncMolitComplexes } from "../src/services/molit-complex-store.js";
import { runPerformanceMeasurements } from "../src/services/performance-measurements.js";
import { getRegion, legalDongCodePrefixes, listTiles } from "../src/services/region-config.js";
import { notifyTelegramKbNationalCrawl } from "../src/services/telegram-notifier.js";

const ORCHESTRATOR_LOCK_ID = 442061305;
const RUN_STARTED_MESSAGE = "KB national crawl run started";
const JOB_ASSIGNED_MESSAGE = "KB national crawl job assigned";
const REGION_COMPLETED_MESSAGE = "KB national crawl region completed";
const REGION_RETRY_MESSAGE = "KB national crawl region retry scheduled";
const REGION_PAUSED_MESSAGE = "KB national crawl region paused";
const CACHE_RETRY_MESSAGE = "KB national crawl cache retry failed";
const CACHE_DEFERRED_MESSAGE = "KB national crawl cache retry deferred";
const NOTIFICATION_MESSAGE = "Telegram KB national crawl notification sent";
const FINALIZATION_COMPLETED_MESSAGE = "KB national crawl finalization stage completed";
const FINALIZATION_FAILED_MESSAGE = "KB national crawl finalization stage failed";
const RUN_COMPLETED_MESSAGE = "KB national crawl run completed";

const runId = String(process.env.KB_NATIONAL_RUN_ID || "kb-national-10y-v1").trim();
const environment = process.env.ORULZIP_ENVIRONMENT || process.env.NODE_ENV || "unknown";
const intervalMs = Math.max(5_000, Number(process.env.KB_NATIONAL_INTERVAL_MS || 30_000));
const targetRegionIds = normalizeNationalRegionIds(
  process.env.KB_NATIONAL_REGION_ORDER,
  KB_NATIONAL_REGION_ORDER
);
const precompletedRegionIds = normalizeNationalRegionIds(
  process.env.KB_NATIONAL_PRECOMPLETED_REGION_IDS,
  KB_NATIONAL_PRECOMPLETED_REGION_IDS
).filter((regionId) => !targetRegionIds.includes(regionId));
const allRegionIds = [...new Set([...precompletedRegionIds, ...targetRegionIds])];
const maxComplexes = positiveInteger(process.env.KB_NATIONAL_MAX_COMPLEXES, 50_000);
const maxAreaTypesPerComplex = positiveInteger(process.env.KB_NATIONAL_MAX_AREA_TYPES_PER_COMPLEX, 50);
const delayMinMs = positiveInteger(process.env.KB_NATIONAL_DELAY_MIN_MS, 800);
const delayMaxMs = Math.max(delayMinMs, positiveInteger(process.env.KB_NATIONAL_DELAY_MAX_MS, 2_000));
const maxRegionRetries = positiveInteger(process.env.KB_NATIONAL_MAX_REGION_RETRIES, 2);
const maxCacheRetries = positiveInteger(process.env.KB_NATIONAL_MAX_CACHE_RETRIES, 3);
const maxFinalizationRetries = positiveInteger(process.env.KB_NATIONAL_MAX_FINALIZATION_RETRIES, 3);
const cacheWorkerGraceMs = positiveInteger(process.env.KB_NATIONAL_CACHE_WORKER_GRACE_MS, 10 * 60_000);
const cacheRetryIntervalMs = positiveInteger(process.env.KB_NATIONAL_CACHE_RETRY_INTERVAL_MS, 5 * 60_000);
const finalizationEnabled = boolValue(process.env.KB_NATIONAL_FINALIZE, true);
let stopping = false;

if (!runId) throw new Error("KB_NATIONAL_RUN_ID must not be empty");
if (!targetRegionIds.length) throw new Error("KB_NATIONAL_REGION_ORDER must contain at least one region");
if (allRegionIds.length !== KB_NATIONAL_ALL_REGION_IDS.length) {
  throw new Error(`National region configuration must contain ${KB_NATIONAL_ALL_REGION_IDS.length} unique regions; received ${allRegionIds.length}`);
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
    const lock = await client.query("select pg_try_advisory_lock($1) as locked", [ORCHESTRATOR_LOCK_ID]);
    if (!lock.rows[0]?.locked) {
      console.log(JSON.stringify({ message: "KB national orchestrator skipped; lock is held", runId }));
      return;
    }

    console.log(JSON.stringify({
      message: "KB national orchestrator started",
      runId,
      environment,
      precompletedRegionIds,
      targetRegionIds,
      intervalMs
    }));

    try {
      while (!stopping) {
        try {
          await runCycle(client);
        } catch (error) {
          console.error(JSON.stringify({
            message: "KB national orchestrator cycle failed",
            runId,
            error: error?.stack || error?.message || String(error)
          }));
        }
        if (!stopping) await sleep(intervalMs);
      }
    } finally {
      await client.query("select pg_advisory_unlock($1)", [ORCHESTRATOR_LOCK_ID]);
    }
  });
} finally {
  await closeDb();
}

console.log(JSON.stringify({ message: "KB national orchestrator stopped", runId }));

async function runCycle(client) {
  const run = await ensureRunStarted(client);
  let assignments = await readAssignments(client);
  let completionRecords = await readRegionCompletionRecords(client);
  const historicalJobs = await readHistoricalJobs(client);
  const profile = buildHistoricalCrawlProfile(historicalJobs);
  const sentKeys = await readSentEventKeys(client);

  await emitNationalStart(client, { run, assignments, completionRecords, profile, sentKeys });
  await emitRecordedLifecycleEvents(client, { run, assignments, completionRecords, profile, sentKeys });

  const completedRegionIds = completedIds(completionRecords);
  const nextRegionId = targetRegionIds.find((regionId) => !completedRegionIds.has(regionId));
  if (!nextRegionId) {
    await finalizeRun(client, { run, assignments, completionRecords, profile, sentKeys });
    return;
  }

  let assignment = assignments.find((item) => item.regionId === nextRegionId);
  if (!assignment) {
    assignment = await queueRegion(client, nextRegionId);
    assignments = [...assignments, assignment];
    await emitRegionStarted(client, { run, assignment, assignments, completionRecords, profile, sentKeys });
    return;
  }

  const failedJob = failedAssignmentJob(assignment);
  if (failedJob) {
    await handleRegionFailure(client, {
      run,
      assignment,
      failedJob,
      assignments,
      completionRecords,
      profile,
      sentKeys
    });
    return;
  }

  if (!assignmentJobsCompleted(assignment)) return;

  const cacheReady = await ensureRegionCache(client, {
    run,
    assignment,
    assignments,
    completionRecords,
    profile,
    sentKeys
  });
  if (!cacheReady) return;

  const coverage = await readRegionCoverage(client, assignment.regionId);
  const coverageError = validateRegionCoverage(assignment, coverage);
  if (coverageError) {
    await pauseRegion(client, {
      run,
      assignment,
      failedJob: assignment.priceJob,
      errorMessage: coverageError,
      retryAttempt: maxRegionRetries,
      maxRetries: maxRegionRetries,
      assignments,
      completionRecords,
      profile,
      sentKeys,
      stage: "지역 데이터 검증"
    });
    return;
  }

  await recordRegionCompleted(client, assignment, coverage);
  completionRecords = await readRegionCompletionRecords(client);
  await emitRecordedLifecycleEvents(client, { run, assignments, completionRecords, profile, sentKeys });

  const nowCompleted = completedIds(completionRecords);
  const followingRegionId = targetRegionIds.find((regionId) => !nowCompleted.has(regionId));
  if (followingRegionId && !assignments.some((item) => item.regionId === followingRegionId)) {
    const nextAssignment = await queueRegion(client, followingRegionId);
    assignments = [...assignments, nextAssignment];
    await emitRegionStarted(client, {
      run,
      assignment: nextAssignment,
      assignments,
      completionRecords,
      profile,
      sentKeys
    });
  }
}

async function ensureRunStarted(client) {
  const existing = await client.query(`
    select created_at, details
    from crawl_logs
    where message = $1
      and details->>'runId' = $2
    order by created_at
    limit 1
  `, [RUN_STARTED_MESSAGE, runId]);
  if (existing.rows[0]) {
    return { startedAt: existing.rows[0].created_at, details: existing.rows[0].details || {} };
  }

  const details = {
    runId,
    environment,
    precompletedRegionIds,
    targetRegionIds,
    yearsBack: 10,
    maxComplexes,
    maxAreaTypesPerComplex,
    delayMinMs,
    delayMaxMs
  };
  const created = await client.query(`
    insert into crawl_logs (job_id, level, message, details)
    values (null, 'info', $1, $2)
    returning created_at
  `, [RUN_STARTED_MESSAGE, details]);
  return { startedAt: created.rows[0].created_at, details };
}

async function queueRegion(client, regionId) {
  const region = getRegion(regionId);
  if (!region) throw new Error(`Unknown KB region: ${regionId}`);
  const maxTiles = listTiles(region).length;

  await client.query("begin");
  try {
    const infoResult = await client.query(`
      insert into crawl_jobs (
        region_id, status, max_complexes, years_back, max_area_types_per_complex,
        max_tiles, delay_min_ms, delay_max_ms, source_job_id
      ) values ($1, 'requested', $2, 0, $3, $4, $5, $6, null)
      returning *
    `, [regionId, maxComplexes, maxAreaTypesPerComplex, maxTiles, delayMinMs, delayMaxMs]);
    const infoJob = infoResult.rows[0];
    const priceResult = await client.query(`
      insert into crawl_jobs (
        region_id, status, max_complexes, years_back, max_area_types_per_complex,
        max_tiles, delay_min_ms, delay_max_ms, source_job_id
      ) values ($1, 'requested', $2, 10, $3, $4, $5, $6, $7)
      returning *
    `, [regionId, maxComplexes, maxAreaTypesPerComplex, maxTiles, delayMinMs, delayMaxMs, infoJob.id]);
    const priceJob = priceResult.rows[0];
    for (const [job, role] of [[infoJob, "info"], [priceJob, "price"]]) {
      await client.query(`
        insert into crawl_logs (job_id, level, message, details)
        values ($1, 'info', $2, $3)
      `, [job.id, JOB_ASSIGNED_MESSAGE, { runId, regionId, role }]);
    }
    await client.query("commit");
    console.log(JSON.stringify({
      message: "KB national region queued",
      runId,
      regionId,
      infoJobId: Number(infoJob.id),
      priceJobId: Number(priceJob.id),
      maxTiles
    }));
    return {
      regionId,
      infoJob: normalizeCrawlJob(infoJob),
      priceJob: normalizeCrawlJob(priceJob),
      assignedAt: infoJob.created_at
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function readAssignments(client) {
  const result = await client.query(`
    select
      j.*,
      assignment.details as assignment_details,
      assignment.created_at as assigned_at,
      discovery.created_at as discovered_at
    from crawl_logs assignment
    join crawl_jobs j on j.id = assignment.job_id
    left join lateral (
      select created_at
      from crawl_logs
      where job_id = j.id
        and message like 'Discovered % complexes'
      order by created_at desc
      limit 1
    ) discovery on true
    where assignment.message = $1
      and assignment.details->>'runId' = $2
    order by assignment.created_at, j.id
  `, [JOB_ASSIGNED_MESSAGE, runId]);
  const grouped = new Map();
  for (const row of result.rows) {
    const regionId = row.assignment_details?.regionId || row.region_id;
    const role = row.assignment_details?.role || (Number(row.years_back) > 0 ? "price" : "info");
    const current = grouped.get(regionId) || { regionId, infoJob: null, priceJob: null, assignedAt: row.assigned_at };
    current[role === "price" ? "priceJob" : "infoJob"] = normalizeCrawlJob(row);
    grouped.set(regionId, current);
  }
  return targetRegionIds.map((regionId) => grouped.get(regionId)).filter(Boolean);
}

async function readRegionCompletionRecords(client) {
  const result = await client.query(`
    select distinct on (details->>'regionId')
      job_id,
      details,
      created_at
    from crawl_logs
    where message = $1
      and details->>'runId' = $2
    order by details->>'regionId', created_at desc
  `, [REGION_COMPLETED_MESSAGE, runId]);
  return result.rows.map((row) => ({
    regionId: row.details?.regionId,
    jobId: Number(row.job_id || 0),
    coverage: row.details?.coverage || {},
    regionElapsedMs: Number(row.details?.regionElapsedMs || 0),
    completedAt: row.created_at
  })).filter((row) => row.regionId);
}

async function readHistoricalJobs(client) {
  const result = await client.query(`
    select
      j.*,
      discovery.created_at as discovered_at
    from crawl_jobs j
    left join lateral (
      select created_at
      from crawl_logs
      where job_id = j.id
        and message like 'Discovered % complexes'
      order by created_at desc
      limit 1
    ) discovery on true
    where j.status = 'completed'
      and j.total_complexes > 0
      and j.failed_complexes = 0
      and j.started_at is not null
      and j.finished_at is not null
      and j.years_back in (0, 10)
    order by j.finished_at desc
    limit 200
  `);
  return result.rows;
}

async function readSentEventKeys(client) {
  const result = await client.query(`
    select details->>'eventKey' as event_key
    from crawl_logs
    where message = $1
      and details->>'runId' = $2
      and details ? 'eventKey'
  `, [NOTIFICATION_MESSAGE, runId]);
  return new Set(result.rows.map((row) => row.event_key).filter(Boolean));
}

async function emitNationalStart(client, state) {
  const key = `${runId}:national-started`;
  if (state.sentKeys.has(key)) return;
  const event = {
    ...eventContext(state, ""),
    kind: "national_started",
    key,
    jobId: null
  };
  await sendEvent(client, event, state.sentKeys);
}

async function emitRegionStarted(client, state) {
  const { assignment } = state;
  const key = `${runId}:region:${assignment.regionId}:started`;
  if (state.sentKeys.has(key)) return;
  const descriptor = nationalRegionDescriptor(assignment.regionId);
  await sendEvent(client, {
    ...eventContext(state, assignment.regionId),
    kind: "region_started",
    key,
    jobId: assignment.infoJob.id,
    jobIds: [assignment.infoJob.id, assignment.priceJob.id],
    regionId: assignment.regionId,
    regionName: descriptor.name,
    tileCount: descriptor.tileCount
  }, state.sentKeys);
}

async function emitRecordedLifecycleEvents(client, state) {
  const completionByRegion = new Map(state.completionRecords.map((record) => [record.regionId, record]));
  for (const assignment of state.assignments) {
    if (completionByRegion.has(assignment.regionId)) continue;
    await emitRegionStarted(client, { ...state, assignment });
  }

  const completed = completedIds(state.completionRecords);
  const currentRegionId = targetRegionIds.find((regionId) => !completed.has(regionId));
  const current = state.assignments.find((assignment) => assignment.regionId === currentRegionId);
  if (current) await emitCurrentRegionProgress(client, { ...state, assignment: current });

  for (const assignment of state.assignments) {
    const record = completionByRegion.get(assignment.regionId);
    if (!record) continue;
    const key = `${runId}:region:${assignment.regionId}:completed`;
    if (state.sentKeys.has(key)) continue;
    const following = targetRegionIds.find((regionId) => !completed.has(regionId));
    await sendEvent(client, {
      ...eventContext(state, assignment.regionId),
      kind: "region_completed",
      key,
      jobId: assignment.priceJob.id,
      regionId: assignment.regionId,
      regionName: nationalRegionDescriptor(assignment.regionId).name,
      regionElapsedMs: record.regionElapsedMs,
      coverage: record.coverage,
      nextRegionName: following ? nationalRegionDescriptor(following).name : "없음"
    }, state.sentKeys);
  }
}

async function emitCurrentRegionProgress(client, state) {
  const { assignment, sentKeys } = state;
  const descriptor = nationalRegionDescriptor(assignment.regionId);
  const discoveryKey = `${runId}:region:${assignment.regionId}:discovery-completed`;
  if (assignment.infoJob.total > 0 && !["requested", "discovering"].includes(assignment.infoJob.status) && !sentKeys.has(discoveryKey)) {
    await sendEvent(client, {
      ...eventContext(state, assignment.regionId),
      kind: "discovery_completed",
      key: discoveryKey,
      jobId: assignment.infoJob.id,
      regionId: assignment.regionId,
      regionName: descriptor.name,
      total: assignment.infoJob.total
    }, sentKeys);
  }

  for (const job of [assignment.infoJob, assignment.priceJob]) {
    const stage = crawlStageProgress(job, { tileCount: descriptor.tileCount });
    if (job.total <= 0) continue;
    const keyFor = (milestone) => `${runId}:region:${assignment.regionId}:job:${job.id}:progress:${milestone}`;
    const reached = reachedProgressMilestones(stage.percent, sentKeys, keyFor);
    if (!reached) continue;
    await sendEvent(client, {
      ...eventContext(state, assignment.regionId),
      kind: "progress",
      key: keyFor(reached.threshold),
      dedupeKeys: reached.dedupeKeys,
      jobId: job.id,
      regionId: assignment.regionId,
      regionName: descriptor.name,
      stage: stage.label,
      threshold: reached.threshold,
      stagePercent: stage.percent,
      processed: stage.processed,
      total: stage.total,
      currentComplexName: stage.currentComplexName
    }, sentKeys);
  }
}

async function handleRegionFailure(client, state) {
  const retryCount = await countRegionRetries(client, state.assignment.regionId, state.failedJob.id);
  const errorMessage = state.failedJob.errorMessage || `${state.failedJob.failed}개 수집 항목 실패`;
  if (retryCount >= maxRegionRetries) {
    await pauseRegion(client, {
      ...state,
      errorMessage,
      retryAttempt: retryCount,
      maxRetries: maxRegionRetries,
      stage: state.failedJob.yearsBack > 0 ? "10년 시세" : "기본정보·면적형"
    });
    return;
  }

  await resetFailedAssignment(client, state.assignment, state.failedJob);
  const attempt = retryCount + 1;
  await client.query(`
    insert into crawl_logs (job_id, level, message, details)
    values ($1, 'warn', $2, $3)
  `, [state.failedJob.id, REGION_RETRY_MESSAGE, {
    runId,
    regionId: state.assignment.regionId,
    jobId: state.failedJob.id,
    attempt,
    error: errorMessage
  }]);
  const key = `${runId}:region:${state.assignment.regionId}:retry:${attempt}`;
  await sendEvent(client, {
    ...eventContext(state, state.assignment.regionId),
    kind: "region_retry",
    key,
    jobId: state.failedJob.id,
    regionId: state.assignment.regionId,
    regionName: nationalRegionDescriptor(state.assignment.regionId).name,
    stage: state.failedJob.yearsBack > 0 ? "10년 시세" : "기본정보·면적형",
    retryAttempt: attempt,
    maxRetries: maxRegionRetries,
    errorMessage
  }, state.sentKeys);
}

async function resetFailedAssignment(client, assignment, failedJob) {
  await client.query("begin");
  try {
    const queue = await client.query(`
      select count(*) filter (where status = 'failed')::int as failed
      from crawl_queue
      where job_id = $1
    `, [failedJob.id]);
    if (Number(queue.rows[0]?.failed || 0) > 0) {
      await client.query(`
        update crawl_queue
        set status = 'pending',
            attempts = 0,
            error_message = null,
            started_at = null,
            completed_at = null,
            updated_at = now()
        where job_id = $1 and status = 'failed'
      `, [failedJob.id]);
      await client.query(`
        update crawl_jobs
        set status = 'running',
            failed_complexes = 0,
            error_message = null,
            finished_at = null,
            current_complex_id = null,
            current_complex_name = null,
            updated_at = now()
        where id = $1
      `, [failedJob.id]);
    } else {
      await client.query("delete from crawl_queue where job_id = $1", [failedJob.id]);
      await client.query(`
        update crawl_jobs
        set status = 'requested',
            total_complexes = 0,
            completed_complexes = 0,
            failed_complexes = 0,
            current_complex_id = null,
            current_complex_name = null,
            error_message = null,
            started_at = null,
            finished_at = null,
            updated_at = now()
        where id = $1
      `, [failedJob.id]);
    }

    if (failedJob.id === assignment.infoJob.id) {
      await client.query("delete from crawl_queue where job_id = $1", [assignment.priceJob.id]);
      await client.query(`
        update crawl_jobs
        set status = 'requested',
            total_complexes = 0,
            completed_complexes = 0,
            failed_complexes = 0,
            current_complex_id = null,
            current_complex_name = null,
            error_message = null,
            started_at = null,
            finished_at = null,
            updated_at = now()
        where id = $1
      `, [assignment.priceJob.id]);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function pauseRegion(client, state) {
  const key = `${runId}:region:${state.assignment.regionId}:paused:${state.stage || "crawl"}`;
  const alreadyLogged = await client.query(`
    select 1
    from crawl_logs
    where message = $1
      and details->>'runId' = $2
      and details->>'regionId' = $3
      and details->>'stage' = $4
    limit 1
  `, [REGION_PAUSED_MESSAGE, runId, state.assignment.regionId, state.stage || "crawl"]);
  if (!alreadyLogged.rows[0]) {
    await client.query(`
      insert into crawl_logs (job_id, level, message, details)
      values ($1, 'error', $2, $3)
    `, [state.failedJob?.id || state.assignment.priceJob.id, REGION_PAUSED_MESSAGE, {
      runId,
      regionId: state.assignment.regionId,
      stage: state.stage || "crawl",
      error: state.errorMessage
    }]);
  }
  await sendEvent(client, {
    ...eventContext(state, state.assignment.regionId),
    kind: "region_paused",
    key,
    jobId: state.failedJob?.id || state.assignment.priceJob.id,
    regionId: state.assignment.regionId,
    regionName: nationalRegionDescriptor(state.assignment.regionId).name,
    stage: state.stage || "수집",
    retryAttempt: state.retryAttempt,
    maxRetries: state.maxRetries,
    errorMessage: state.errorMessage
  }, state.sentKeys);
}

async function ensureRegionCache(client, state) {
  const job = state.assignment.priceJob;
  const terminal = await client.query(`
    select message, details, created_at
    from crawl_logs
    where job_id = $1
      and created_at >= $2
      and message in ('Map growth cache refreshed', 'Map growth cache refresh failed', 'Map growth cache refresh skipped')
    order by created_at desc
    limit 1
  `, [job.id, job.finishedAt]);
  if (terminal.rows[0]?.message === "Map growth cache refreshed") return true;

  const finishedMs = new Date(job.finishedAt || 0).getTime();
  if (Number.isFinite(finishedMs) && Date.now() - finishedMs < cacheWorkerGraceMs && !terminal.rows[0]) return false;

  const retryRows = await client.query(`
    select message, created_at, details
    from crawl_logs
    where job_id = $1
      and message in ($2, $3)
      and details->>'runId' = $4
    order by created_at desc
  `, [job.id, CACHE_RETRY_MESSAGE, CACHE_DEFERRED_MESSAGE, runId]);
  const failedRetries = retryRows.rows.filter((row) => row.message === CACHE_RETRY_MESSAGE);
  const retryCount = failedRetries.length;
  if (retryCount >= maxCacheRetries) {
    await pauseRegion(client, {
      ...state,
      failedJob: job,
      errorMessage: failedRetries[0]?.details?.error || terminal.rows[0]?.details?.error || "지도 캐시 갱신 실패",
      retryAttempt: retryCount,
      maxRetries: maxCacheRetries,
      stage: "KB 지도 캐시"
    });
    return false;
  }
  const lastRetryMs = new Date(retryRows.rows[0]?.created_at || 0).getTime();
  if (lastRetryMs && Date.now() - lastRetryMs < cacheRetryIntervalMs) return false;

  try {
    const result = await refreshMapGrowthCacheIfUnlocked();
    if (result.skipped) {
      await client.query(`
        insert into crawl_logs (job_id, level, message, details)
        values ($1, 'info', $2, $3)
      `, [job.id, CACHE_DEFERRED_MESSAGE, { runId, regionId: state.assignment.regionId, reason: result.reason }]);
      return false;
    }
    await client.query(`
      insert into crawl_logs (job_id, level, message, details)
      values ($1, 'info', 'Map growth cache refreshed', $2)
    `, [job.id, {
      runId,
      source: "kb-national-orchestrator",
      snapshots: (result.snapshots || []).length,
      refreshedAt: result.refreshedAt
    }]);
    return true;
  } catch (error) {
    const attempt = retryCount + 1;
    await client.query(`
      insert into crawl_logs (job_id, level, message, details)
      values ($1, 'error', $2, $3)
    `, [job.id, CACHE_RETRY_MESSAGE, {
      runId,
      regionId: state.assignment.regionId,
      attempt,
      error: error.message
    }]);
    const key = `${runId}:region:${state.assignment.regionId}:cache-retry:${attempt}`;
    await sendEvent(client, {
      ...eventContext(state, state.assignment.regionId),
      kind: "cache_retry",
      key,
      jobId: job.id,
      regionId: state.assignment.regionId,
      regionName: nationalRegionDescriptor(state.assignment.regionId).name,
      stage: "KB 지도 캐시",
      retryAttempt: attempt,
      maxRetries: maxCacheRetries,
      errorMessage: error.message
    }, state.sentKeys);
    return false;
  }
}

async function readRegionCoverage(client, regionId) {
  const region = getRegion(regionId);
  const prefixes = legalDongCodePrefixes(region);
  const result = await client.query(`
    with target_apartments as (
      select id
      from apartments a
      where (
        cardinality($2::text[]) = 0 and a.region_id = $1
      ) or exists (
           select 1
           from unnest($2::text[]) prefix
           where coalesce(a.legal_dong_code, '') like prefix || '%'
      )
    ), target_area_types as (
      select at.id
      from area_types at
      join target_apartments a on a.id = at.apartment_id
    )
    select
      (select count(*)::int from target_apartments) as apartments,
      (select count(*)::int from target_area_types) as area_types,
      (select count(*)::int from monthly_prices mp join target_area_types at on at.id = mp.area_type_id) as monthly_prices,
      (select min(mp.year_month) from monthly_prices mp join target_area_types at on at.id = mp.area_type_id) as min_month,
      (select max(mp.year_month) from monthly_prices mp join target_area_types at on at.id = mp.area_type_id) as max_month
  `, [regionId, prefixes]);
  const row = result.rows[0] || {};
  return {
    apartments: Number(row.apartments || 0),
    areaTypes: Number(row.area_types || 0),
    monthlyPrices: Number(row.monthly_prices || 0),
    minMonth: row.min_month || "",
    maxMonth: row.max_month || ""
  };
}

function validateRegionCoverage(assignment, coverage) {
  if (assignment.priceJob.total <= 0) return "10년 시세 수집 대상이 0개입니다.";
  if (coverage.apartments <= 0) return "지역 필터를 통과한 아파트가 0개입니다.";
  if (coverage.areaTypes <= 0) return "저장된 면적형이 0개입니다.";
  if (coverage.monthlyPrices <= 0) return "저장된 월별 시세가 0건입니다.";
  return "";
}

async function recordRegionCompleted(client, assignment, coverage) {
  const exists = await client.query(`
    select 1
    from crawl_logs
    where message = $1
      and details->>'runId' = $2
      and details->>'regionId' = $3
    limit 1
  `, [REGION_COMPLETED_MESSAGE, runId, assignment.regionId]);
  if (exists.rows[0]) return;
  const regionElapsedMs = elapsedMs(assignment.infoJob.createdAt, assignment.priceJob.finishedAt || new Date());
  await client.query(`
    insert into crawl_logs (job_id, level, message, details)
    values ($1, 'info', $2, $3)
  `, [assignment.priceJob.id, REGION_COMPLETED_MESSAGE, {
    runId,
    regionId: assignment.regionId,
    infoJobId: assignment.infoJob.id,
    priceJobId: assignment.priceJob.id,
    regionElapsedMs,
    coverage
  }]);
  console.log(JSON.stringify({ message: "KB national region completed", runId, regionId: assignment.regionId, coverage }));
}

async function finalizeRun(client, state) {
  const existing = await client.query(`
    select details, created_at
    from crawl_logs
    where message = $1
      and details->>'runId' = $2
    order by created_at desc
    limit 1
  `, [RUN_COMPLETED_MESSAGE, runId]);
  if (existing.rows[0]) {
    await emitAllCompleted(client, state, existing.rows[0]);
    return;
  }

  const finalizingKey = `${runId}:finalizing`;
  if (!state.sentKeys.has(finalizingKey)) {
    await sendEvent(client, {
      ...eventContext(state, ""),
      kind: "finalizing",
      key: finalizingKey,
      jobId: state.assignments.at(-1)?.priceJob?.id || null,
      stage: finalizationEnabled ? "전국 매칭·캐시·상태 점검" : "전국 완료 기록",
      retryAttempt: 0,
      maxRetries: maxFinalizationRetries
    }, state.sentKeys);
  }

  if (finalizationEnabled) {
    const steps = [
      {
        key: "molit_matching",
        run: async () => {
          const result = await syncMolitComplexes({ geocode: false });
          return { matched: result.matched, overview: result.overview };
        }
      },
      {
        key: "kb_caches",
        run: async () => {
          const map = await refreshMapGrowthCacheIfUnlocked();
          if (map.skipped) throw new Error(`KB map cache refresh skipped: ${map.reason}`);
          const ranking = await refreshApartmentRankCache();
          const overview = await refreshAppOverviewCache();
          return {
            mapSnapshots: (map.snapshots || []).length,
            rankingSnapshots: (ranking.snapshots || []).length,
            overviewRefreshedAt: overview.cache?.refreshedAt || null
          };
        }
      },
      {
        key: "molit_map_cache",
        run: async () => {
          let snapshotCount = 0;
          for (const periodYears of DEFAULT_MAP_CACHE_PERIOD_YEARS) {
            const result = await refreshMolitMapGrowthCache({
              periodYears: [periodYears],
              minHouseholdCounts: DEFAULT_MIN_HOUSEHOLD_COUNTS,
              metrics: DEFAULT_MAP_GROWTH_METRICS
            });
            snapshotCount += (result.snapshots || []).length;
          }
          return { snapshotCount, periods: DEFAULT_MAP_CACHE_PERIOD_YEARS };
        }
      },
      {
        key: "diagnostics",
        run: async () => {
          const dataHealth = await runDataHealthCheck({ environment, save: true, notify: false });
          const performance = await runPerformanceMeasurements({ environment, save: true });
          return {
            dataHealthStatus: dataHealth.status,
            dataHealthIssues: dataHealth.issueCount,
            dataHealthWarnings: dataHealth.warningCount,
            performanceStatus: performance.status,
            performanceIssues: performance.issueCount,
            performanceWarnings: performance.warningCount
          };
        }
      }
    ];
    for (const step of steps) {
      const ready = await ensureFinalizationStep(client, state, step);
      if (!ready) return;
    }
  }

  const coverage = await readNationalCoverage(client);
  const finalization = await readFinalizationResults(client);
  const summary = {
    coverage,
    matching: {
      kbMatched: Number(finalization.molit_matching?.overview?.kb_matched || 0),
      kbMatchedCoordinates: Number(finalization.molit_matching?.overview?.kb_matched_coordinates || 0)
    },
    cacheStatus: finalizationEnabled ? "갱신 완료" : "지역별 갱신 완료",
    dataHealthStatus: finalization.diagnostics?.dataHealthStatus || "미측정",
    performanceStatus: finalization.diagnostics?.performanceStatus || "미측정",
    completedRegionIds: [...precompletedRegionIds, ...targetRegionIds],
    nationalElapsedMs: elapsedMs(state.run.startedAt, new Date())
  };
  const inserted = await client.query(`
    insert into crawl_logs (job_id, level, message, details)
    values ($1, 'info', $2, $3)
    returning details, created_at
  `, [state.assignments.at(-1)?.priceJob?.id || null, RUN_COMPLETED_MESSAGE, { runId, summary }]);
  await emitAllCompleted(client, state, inserted.rows[0]);
}

async function ensureFinalizationStep(client, state, step) {
  const completed = await client.query(`
    select 1
    from crawl_logs
    where message = $1
      and details->>'runId' = $2
      and details->>'stage' = $3
    limit 1
  `, [FINALIZATION_COMPLETED_MESSAGE, runId, step.key]);
  if (completed.rows[0]) return true;

  const failures = await client.query(`
    select details, created_at
    from crawl_logs
    where message = $1
      and details->>'runId' = $2
      and details->>'stage' = $3
    order by created_at desc
  `, [FINALIZATION_FAILED_MESSAGE, runId, step.key]);
  const retryCount = failures.rows.length;
  if (retryCount >= maxFinalizationRetries) {
    const key = `${runId}:finalization:${step.key}:paused`;
    await sendEvent(client, {
      ...eventContext(state, ""),
      kind: "finalization_retry",
      key,
      jobId: state.assignments.at(-1)?.priceJob?.id || null,
      stage: step.key,
      retryAttempt: retryCount,
      maxRetries: maxFinalizationRetries,
      errorMessage: failures.rows[0]?.details?.error || "후처리 실패"
    }, state.sentKeys);
    return false;
  }

  try {
    const result = await step.run();
    await client.query(`
      insert into crawl_logs (job_id, level, message, details)
      values ($1, 'info', $2, $3)
    `, [state.assignments.at(-1)?.priceJob?.id || null, FINALIZATION_COMPLETED_MESSAGE, {
      runId,
      stage: step.key,
      result
    }]);
    return true;
  } catch (error) {
    const attempt = retryCount + 1;
    await client.query(`
      insert into crawl_logs (job_id, level, message, details)
      values ($1, 'error', $2, $3)
    `, [state.assignments.at(-1)?.priceJob?.id || null, FINALIZATION_FAILED_MESSAGE, {
      runId,
      stage: step.key,
      attempt,
      error: error.message
    }]);
    const key = `${runId}:finalization:${step.key}:retry:${attempt}`;
    await sendEvent(client, {
      ...eventContext(state, ""),
      kind: "finalization_retry",
      key,
      jobId: state.assignments.at(-1)?.priceJob?.id || null,
      stage: step.key,
      retryAttempt: attempt,
      maxRetries: maxFinalizationRetries,
      errorMessage: error.message
    }, state.sentKeys);
    return false;
  }
}

async function readFinalizationResults(client) {
  const result = await client.query(`
    select details->>'stage' as stage, details->'result' as result
    from crawl_logs
    where message = $1
      and details->>'runId' = $2
  `, [FINALIZATION_COMPLETED_MESSAGE, runId]);
  return Object.fromEntries(result.rows.map((row) => [row.stage, row.result || {}]));
}

async function readNationalCoverage(client) {
  const result = await client.query(`
    select
      (select count(*)::int from apartments) as apartments,
      (select count(*)::int from area_types) as area_types,
      (select count(*)::int from monthly_prices) as monthly_prices,
      (select min(year_month) from monthly_prices) as min_month,
      (select max(year_month) from monthly_prices) as max_month
  `);
  const row = result.rows[0] || {};
  return {
    apartments: Number(row.apartments || 0),
    areaTypes: Number(row.area_types || 0),
    monthlyPrices: Number(row.monthly_prices || 0),
    minMonth: row.min_month || "",
    maxMonth: row.max_month || ""
  };
}

async function emitAllCompleted(client, state, row) {
  const key = `${runId}:all-completed`;
  if (state.sentKeys.has(key)) return;
  const summary = row.details?.summary || {};
  await sendEvent(client, {
    ...eventContext(state, ""),
    kind: "all_completed",
    key,
    jobId: state.assignments.at(-1)?.priceJob?.id || null,
    completedCount: allRegionIds.length,
    totalCount: allRegionIds.length,
    nationalPercent: 100,
    nationalElapsedMs: Number(summary.nationalElapsedMs || elapsedMs(state.run.startedAt, row.created_at)),
    completedRegionNames: allRegionIds.map((regionId) => nationalRegionDescriptor(regionId).name),
    remainingRegionNames: [],
    remainingCount: 0,
    coverage: summary.coverage || {},
    matching: summary.matching || {},
    cacheStatus: summary.cacheStatus,
    dataHealthStatus: summary.dataHealthStatus,
    performanceStatus: summary.performanceStatus
  }, state.sentKeys);
}

function eventContext(state, activeRegionId) {
  const completed = completedIds(state.completionRecords);
  const progress = buildNationalProgress({
    allRegionIds,
    targetRegionIds,
    completedRegionIds: [...completed],
    assignments: state.assignments,
    activeRegionId,
    runStartedAt: state.run.startedAt,
    profile: state.profile,
    now: new Date()
  });
  const region = progress.regionProgress;
  return {
    environment,
    runId,
    completedCount: progress.completedCount,
    totalCount: progress.totalCount,
    nationalPercent: progress.nationalPercent,
    nationalElapsedMs: progress.nationalElapsedMs,
    nationalRemainingMs: progress.nationalRemainingMs,
    nationalExpectedAt: progress.nationalExpectedAt,
    completedRegionNames: progress.completedRegionNames,
    remainingRegionNames: progress.remainingRegionNames,
    remainingCount: progress.remainingCount,
    regionProgressPercent: region?.overallPercent || 0,
    regionElapsedMs: progress.regionElapsedMs,
    regionRemainingMs: progress.regionRemainingMs,
    regionExpectedAt: progress.regionExpectedAt
  };
}

async function sendEvent(client, event, sentKeys) {
  const dedupeKeys = event.dedupeKeys || [event.key];
  if (dedupeKeys.every((key) => sentKeys.has(key))) return false;
  try {
    const result = await notifyTelegramKbNationalCrawl(event);
    if (!result.sent) {
      console.warn(JSON.stringify({
        message: "KB national Telegram notification not sent",
        eventKey: event.key,
        reason: result.reason || "unknown"
      }));
      return false;
    }
    await client.query("begin");
    try {
      for (const eventKey of dedupeKeys) {
        await client.query(`
          insert into crawl_logs (job_id, level, message, details)
          values ($1, 'info', $2, $3)
        `, [event.jobId || null, NOTIFICATION_MESSAGE, {
          runId,
          eventKey,
          notificationKey: event.key,
          kind: event.kind,
          sentAt: new Date().toISOString()
        }]);
        sentKeys.add(eventKey);
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
    console.log(JSON.stringify({ message: "KB national Telegram notification sent", eventKey: event.key, kind: event.kind }));
    return true;
  } catch (error) {
    console.error(JSON.stringify({
      message: "KB national Telegram notification failed",
      eventKey: event.key,
      error: error.message || String(error)
    }));
    return false;
  }
}

async function countRegionRetries(client, regionId, jobId) {
  const result = await client.query(`
    select count(*)::int as count
    from crawl_logs
    where message = $1
      and details->>'runId' = $2
      and details->>'regionId' = $3
      and details->>'jobId' = $4
  `, [REGION_RETRY_MESSAGE, runId, regionId, String(jobId)]);
  return Number(result.rows[0]?.count || 0);
}

function completedIds(completionRecords) {
  return new Set([
    ...precompletedRegionIds,
    ...completionRecords.map((record) => record.regionId)
  ]);
}

function failedAssignmentJob(assignment) {
  for (const job of [assignment.infoJob, assignment.priceJob]) {
    if (!job) continue;
    if (job.status === "failed" || job.failed > 0) return job;
  }
  return null;
}

function assignmentJobsCompleted(assignment) {
  return assignment.infoJob?.status === "completed"
    && assignment.priceJob?.status === "completed"
    && assignment.infoJob.failed === 0
    && assignment.priceJob.failed === 0;
}

function elapsedMs(start, end) {
  if (!start || !end) return null;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return endMs - startMs;
}

function positiveInteger(value, fallback) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function boolValue(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return !["0", "false", "no", "off"].includes(String(value).toLowerCase());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
