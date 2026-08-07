import { getRegion } from "./region-config.js";

export const KB_CRAWL_NOTIFICATION_LOG_MESSAGE = "Telegram KB crawl notification sent";
export const KB_CRAWL_PROGRESS_MILESTONES = [25, 50, 75];

const activeStatuses = new Set(["discovering", "running"]);

export function buildKbCrawlNotificationEvents({
  jobs = [],
  cacheRefreshedJobIds = [],
  cacheFailedJobs = [],
  sentEventKeys = [],
  environment = "unknown",
  now = new Date()
} = {}) {
  const normalizedJobs = jobs.map(normalizeJob).sort((left, right) => left.id - right.id);
  if (!normalizedJobs.length) return [];

  const sent = new Set(sentEventKeys.map(String));
  const cacheRefreshed = new Set(cacheRefreshedJobIds.map(Number));
  const cacheFailures = new Map(cacheFailedJobs.map((item) => [
    Number(item.jobId ?? item.job_id),
    String(item.errorMessage ?? item.error_message ?? "캐시 갱신 실패")
  ]));
  const jobIds = normalizedJobs.map((job) => job.id);
  const rootJob = normalizedJobs.find((job) => !job.sourceJobId) || normalizedJobs[0];
  const currentJob = normalizedJobs.find((job) => activeStatuses.has(job.status))
    || normalizedJobs.find((job) => job.status === "requested")
    || normalizedJobs.at(-1);
  const region = getRegion(rootJob.regionId);
  const base = {
    environment,
    regionId: rootJob.regionId,
    regionName: region?.name || rootJob.regionId,
    jobIds
  };
  const events = [];

  addEvent(events, sent, {
    ...base,
    ...jobEventFields(currentJob),
    kind: "monitoring_started",
    key: `kb-crawl:${jobIds.join(",")}:monitoring-started`,
    jobId: rootJob.id
  });

  for (const job of normalizedJobs) {
    const jobBase = { ...base, ...jobEventFields(job) };
    if (job.yearsBack === 0 && job.total > 0) {
      addEvent(events, sent, {
        ...jobBase,
        kind: "discovery_completed",
        key: `kb-crawl:job:${job.id}:discovery-completed`
      });
    }

    if (job.failed > 0) {
      addEvent(events, sent, {
        ...jobBase,
        kind: "item_failure",
        key: `kb-crawl:job:${job.id}:item-failure-detected`
      });
    }

    if (job.status === "failed") {
      addEvent(events, sent, {
        ...jobBase,
        kind: "job_failed",
        key: `kb-crawl:job:${job.id}:failed`
      });
      continue;
    }

    if (cacheFailures.has(job.id) && !cacheRefreshed.has(job.id)) {
      addEvent(events, sent, {
        ...jobBase,
        kind: "cache_failed",
        errorMessage: cacheFailures.get(job.id),
        key: `kb-crawl:job:${job.id}:cache-failed`
      });
    }

    if (activeStatuses.has(job.status) && job.total > 0) {
      const percent = progressPercent(job);
      const crossed = KB_CRAWL_PROGRESS_MILESTONES.filter((milestone) =>
        percent >= milestone && !sent.has(progressEventKey(job.id, milestone))
      );
      if (crossed.length) {
        const threshold = crossed.at(-1);
        addEvent(events, sent, {
          ...jobBase,
          kind: "progress",
          threshold,
          key: progressEventKey(job.id, threshold),
          dedupeKeys: crossed.map((milestone) => progressEventKey(job.id, milestone))
        });
      }
    }
  }

  const finalJobs = normalizedJobs.filter((job) => job.sourceJobId && job.yearsBack > 0);
  for (const finalJob of finalJobs) {
    if (finalJob.status !== "completed") continue;
    const sourceJob = normalizedJobs.find((job) => job.id === finalJob.sourceJobId);
    const finalCacheReady = cacheRefreshed.has(finalJob.id);
    if (!finalCacheReady) {
      addEvent(events, sent, {
        ...base,
        ...jobEventFields(finalJob),
        kind: "stage_completed",
        key: `kb-crawl:job:${finalJob.id}:completed`
      });
      continue;
    }

    addEvent(events, sent, {
      ...base,
      kind: "all_completed",
      key: `kb-crawl:${jobIds.join(",")}:all-completed`,
      jobId: finalJob.id,
      sourceJob: jobSummary(sourceJob),
      finalJob: jobSummary(finalJob),
      elapsedMs: elapsedMs(sourceJob?.createdAt || rootJob.createdAt, finalJob.finishedAt || now)
    });
  }

  for (const job of normalizedJobs) {
    if (job.status !== "completed") continue;
    if (job.sourceJobId && job.yearsBack > 0 && cacheRefreshed.has(job.id)) continue;
    addEvent(events, sent, {
      ...base,
      ...jobEventFields(job),
      kind: "stage_completed",
      key: `kb-crawl:job:${job.id}:completed`
    });
  }

  return events;
}

export function kbCrawlStageLabel(job = {}) {
  const yearsBack = Number(job.yearsBack ?? job.years_back ?? 0);
  return yearsBack > 0 ? `${yearsBack}년 시세` : "기본정보·면적형";
}

function normalizeJob(job = {}) {
  return {
    id: Number(job.id || 0),
    regionId: String(job.regionId ?? job.region_id ?? ""),
    yearsBack: Number(job.yearsBack ?? job.years_back ?? 0),
    sourceJobId: nullableNumber(job.sourceJobId ?? job.source_job_id),
    status: String(job.status || ""),
    total: Number(job.total ?? job.totalComplexes ?? job.total_complexes ?? 0),
    completed: Number(job.completed ?? job.completedComplexes ?? job.completed_complexes ?? 0),
    failed: Number(job.failed ?? job.failedComplexes ?? job.failed_complexes ?? 0),
    currentComplexName: String(job.currentComplexName ?? job.current_complex_name ?? ""),
    errorMessage: String(job.errorMessage ?? job.error_message ?? ""),
    createdAt: job.createdAt ?? job.created_at ?? null,
    startedAt: job.startedAt ?? job.started_at ?? null,
    finishedAt: job.finishedAt ?? job.finished_at ?? null
  };
}

function jobEventFields(job) {
  return {
    jobId: job.id,
    sourceJobId: job.sourceJobId,
    stage: kbCrawlStageLabel(job),
    status: job.status,
    total: job.total,
    completed: job.completed,
    failed: job.failed,
    currentComplexName: job.currentComplexName,
    errorMessage: job.errorMessage,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt
  };
}

function jobSummary(job) {
  if (!job) return {};
  return {
    jobId: job.id,
    total: job.total,
    completed: job.completed,
    failed: job.failed
  };
}

function progressPercent(job) {
  if (!job.total) return 0;
  return Math.min(100, ((job.completed + job.failed) / job.total) * 100);
}

function progressEventKey(jobId, milestone) {
  return `kb-crawl:job:${jobId}:progress:${milestone}`;
}

function addEvent(events, sent, event) {
  if (sent.has(event.key)) return;
  events.push({
    ...event,
    dedupeKeys: event.dedupeKeys || [event.key]
  });
  for (const eventKey of event.dedupeKeys || [event.key]) sent.add(eventKey);
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function elapsedMs(start, end) {
  if (!start || !end) return null;
  const startMs = new Date(start || 0).getTime();
  const endMs = new Date(end || 0).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return endMs - startMs;
}
