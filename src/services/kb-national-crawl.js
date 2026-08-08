import { getRegion, kbCollectionRegions, listTiles } from "./region-config.js";

export const KB_NATIONAL_ALL_REGION_IDS = kbCollectionRegions().map((region) => region.id);
export const KB_NATIONAL_PRECOMPLETED_REGION_IDS = ["seoul", "gyeonggi", "sejong"];
export const KB_NATIONAL_REGION_ORDER = [
  "gwangju",
  "daejeon",
  "ulsan",
  "jeju",
  "daegu",
  "busan",
  "jeonbuk",
  "chungnam",
  "chungbuk",
  "gyeongnam",
  "jeonnam",
  "gangwon",
  "gyeongbuk",
  "incheon"
];
export const KB_NATIONAL_PROGRESS_MILESTONES = [25, 50, 75];

const DEFAULT_PROFILE = {
  discoveryMsPerTile: 1600,
  infoMsPerComplex: 4000,
  priceMsPerComplex: 22000,
  complexesPerTile: 2
};

export function normalizeNationalRegionIds(value, fallback = []) {
  const requested = Array.isArray(value)
    ? value
    : String(value || "").split(",");
  const valid = new Set(KB_NATIONAL_ALL_REGION_IDS);
  const normalized = [...new Set(requested.map((item) => String(item).trim()).filter((item) => valid.has(item)))];
  return normalized.length ? normalized : [...fallback];
}

export function nationalRegionDescriptor(regionId) {
  const region = getRegion(regionId);
  return {
    id: regionId,
    name: region?.name || regionId,
    tileCount: region ? listTiles(region).length : 0
  };
}

export function normalizeCrawlJob(job = {}) {
  return {
    ...job,
    id: Number(job.id || 0),
    regionId: String(job.regionId ?? job.region_id ?? ""),
    yearsBack: Number(job.yearsBack ?? job.years_back ?? 0),
    sourceJobId: nullableNumber(job.sourceJobId ?? job.source_job_id),
    status: String(job.status || ""),
    total: Number(job.total ?? job.totalComplexes ?? job.total_complexes ?? 0),
    completed: Number(job.completed ?? job.completedComplexes ?? job.completed_complexes ?? 0),
    failed: Number(job.failed ?? job.failedComplexes ?? job.failed_complexes ?? 0),
    maxTiles: Number(job.maxTiles ?? job.max_tiles ?? 0),
    currentComplexName: String(job.currentComplexName ?? job.current_complex_name ?? ""),
    errorMessage: String(job.errorMessage ?? job.error_message ?? ""),
    createdAt: job.createdAt ?? job.created_at ?? null,
    startedAt: job.startedAt ?? job.started_at ?? null,
    discoveredAt: job.discoveredAt ?? job.discovered_at ?? null,
    finishedAt: job.finishedAt ?? job.finished_at ?? null
  };
}

export function crawlStageProgress(jobInput = {}, { tileCount = 0 } = {}) {
  const job = normalizeCrawlJob(jobInput);
  const processed = Math.min(job.total || job.completed + job.failed, job.completed + job.failed);
  if (job.status === "completed" && job.failed === 0) {
    return progressResult(job, 100, job.total, job.total, job.yearsBack > 0 ? `${job.yearsBack}년 시세` : "기본정보·면적형");
  }
  if (job.yearsBack === 0 && job.status === "discovering") {
    const discovery = parseDiscoveryProgress(job.currentComplexName);
    const total = discovery?.total || tileCount || job.maxTiles;
    const current = Math.min(total, discovery?.current || 0);
    const percent = total > 0 ? current / total * 100 : 0;
    return progressResult(job, percent, current, total, "단지 탐색", {
      found: discovery?.found || 0,
      discovery: true
    });
  }
  const percent = job.total > 0 ? processed / job.total * 100 : 0;
  return progressResult(
    job,
    percent,
    processed,
    job.total,
    job.yearsBack > 0 ? `${job.yearsBack}년 시세` : "기본정보·면적형"
  );
}

export function regionCrawlProgress(assignment = {}, { tileCount = 0 } = {}) {
  const infoJob = normalizeCrawlJob(assignment.infoJob || {});
  const priceJob = normalizeCrawlJob(assignment.priceJob || {});
  const info = crawlStageProgress(infoJob, { tileCount });
  const price = crawlStageProgress(priceJob, { tileCount });
  const infoDone = infoJob.status === "completed" && infoJob.failed === 0;
  const priceStarted = priceJob.status !== "requested" || priceJob.total > 0;
  const overallPercent = infoDone
    ? 50 + Math.min(100, price.percent) * 0.5
    : Math.min(100, info.percent) * 0.5;
  const currentStage = infoDone && priceStarted ? price : info;

  return {
    overallPercent: clampPercent(overallPercent),
    currentStage,
    info,
    price,
    startedAt: infoJob.createdAt || priceJob.createdAt || null,
    finishedAt: priceJob.finishedAt || null
  };
}

export function buildHistoricalCrawlProfile(jobs = []) {
  const normalized = jobs.map(normalizeCrawlJob);
  const discoveryRates = [];
  const infoRates = [];
  const priceRates = [];
  const densities = [];

  for (const job of normalized) {
    if (job.status !== "completed" || job.failed > 0 || job.total <= 0) continue;
    if (job.yearsBack === 0) {
      const discoveryMs = elapsedMs(job.startedAt, job.discoveredAt);
      if (positiveFinite(discoveryMs) && job.maxTiles > 0) discoveryRates.push(discoveryMs / job.maxTiles);
      const infoMs = elapsedMs(job.discoveredAt || job.startedAt, job.finishedAt);
      if (positiveFinite(infoMs)) infoRates.push(infoMs / job.total);
      if (job.maxTiles > 0) densities.push(job.total / job.maxTiles);
    } else {
      const priceMs = elapsedMs(job.startedAt, job.finishedAt);
      if (positiveFinite(priceMs)) priceRates.push(priceMs / job.total);
    }
  }

  return {
    discoveryMsPerTile: median(discoveryRates, DEFAULT_PROFILE.discoveryMsPerTile),
    infoMsPerComplex: median(infoRates, DEFAULT_PROFILE.infoMsPerComplex),
    priceMsPerComplex: median(priceRates, DEFAULT_PROFILE.priceMsPerComplex),
    complexesPerTile: median(densities, DEFAULT_PROFILE.complexesPerTile),
    sampleCounts: {
      discovery: discoveryRates.length,
      info: infoRates.length,
      price: priceRates.length,
      density: densities.length
    }
  };
}

export function estimateRegionTotalMs({ tileCount = 0, profile = DEFAULT_PROFILE } = {}) {
  const normalizedProfile = normalizeProfile(profile);
  const expectedComplexes = Math.max(1, Math.round(tileCount * normalizedProfile.complexesPerTile));
  return tileCount * normalizedProfile.discoveryMsPerTile
    + expectedComplexes * (normalizedProfile.infoMsPerComplex + normalizedProfile.priceMsPerComplex);
}

export function estimateRegionRemainingMs({
  assignment = {},
  tileCount = 0,
  profile = DEFAULT_PROFILE,
  now = new Date()
} = {}) {
  const normalizedProfile = normalizeProfile(profile);
  const infoJob = normalizeCrawlJob(assignment.infoJob || {});
  const priceJob = normalizeCrawlJob(assignment.priceJob || {});
  const nowMs = new Date(now).getTime();
  const expectedComplexes = Math.max(
    infoJob.total,
    priceJob.total,
    Math.round(tileCount * normalizedProfile.complexesPerTile),
    1
  );

  if (priceJob.status === "completed" && priceJob.failed === 0) return 0;

  if (infoJob.status === "requested" || infoJob.status === "discovering") {
    const discovery = parseDiscoveryProgress(infoJob.currentComplexName);
    const currentTile = discovery?.current || 0;
    const totalTiles = discovery?.total || tileCount || infoJob.maxTiles;
    const discoveryRate = observedRate({
      startedAt: infoJob.startedAt,
      processed: currentTile,
      fallback: normalizedProfile.discoveryMsPerTile,
      nowMs
    });
    const discoveryRemaining = Math.max(0, totalTiles - currentTile) * discoveryRate;
    return discoveryRemaining
      + expectedComplexes * (normalizedProfile.infoMsPerComplex + normalizedProfile.priceMsPerComplex);
  }

  if (infoJob.status !== "completed") {
    const infoProcessed = infoJob.completed + infoJob.failed;
    const infoRate = observedRate({
      startedAt: infoJob.discoveredAt || infoJob.startedAt,
      processed: infoProcessed,
      fallback: normalizedProfile.infoMsPerComplex,
      nowMs
    });
    return Math.max(0, infoJob.total - infoProcessed) * infoRate
      + Math.max(infoJob.total, expectedComplexes) * normalizedProfile.priceMsPerComplex;
  }

  if (priceJob.status === "requested" || priceJob.total <= 0) {
    return Math.max(infoJob.total, expectedComplexes) * normalizedProfile.priceMsPerComplex;
  }

  const priceProcessed = priceJob.completed + priceJob.failed;
  const priceRate = observedRate({
    startedAt: priceJob.startedAt,
    processed: priceProcessed,
    fallback: normalizedProfile.priceMsPerComplex,
    nowMs
  });
  return Math.max(0, priceJob.total - priceProcessed) * priceRate;
}

export function buildNationalProgress({
  allRegionIds = KB_NATIONAL_ALL_REGION_IDS,
  targetRegionIds = KB_NATIONAL_REGION_ORDER,
  completedRegionIds = KB_NATIONAL_PRECOMPLETED_REGION_IDS,
  assignments = [],
  activeRegionId = "",
  runStartedAt = null,
  profile = DEFAULT_PROFILE,
  now = new Date()
} = {}) {
  const nowDate = new Date(now);
  const completed = new Set(completedRegionIds);
  const assignmentByRegion = new Map(assignments.map((assignment) => [assignment.regionId, assignment]));
  const descriptors = allRegionIds.map(nationalRegionDescriptor);
  const completedNames = descriptors.filter((region) => completed.has(region.id)).map((region) => region.name);
  const remaining = descriptors.filter((region) => !completed.has(region.id));
  const activeDescriptor = descriptors.find((region) => region.id === activeRegionId) || null;
  const activeAssignment = assignmentByRegion.get(activeRegionId) || null;
  const regionProgress = activeDescriptor && activeAssignment
    ? regionCrawlProgress(activeAssignment, { tileCount: activeDescriptor.tileCount })
    : null;
  const regionRemainingMs = activeDescriptor && activeAssignment
    ? estimateRegionRemainingMs({
      assignment: activeAssignment,
      tileCount: activeDescriptor.tileCount,
      profile,
      now: nowDate
    })
    : null;

  let nationalRemainingMs = Number(regionRemainingMs || 0);
  for (const regionId of targetRegionIds) {
    if (completed.has(regionId) || regionId === activeRegionId) continue;
    const descriptor = descriptors.find((region) => region.id === regionId);
    if (!descriptor) continue;
    const assignment = assignmentByRegion.get(regionId);
    nationalRemainingMs += assignment
      ? estimateRegionRemainingMs({ assignment, tileCount: descriptor.tileCount, profile, now: nowDate })
      : estimateRegionTotalMs({ tileCount: descriptor.tileCount, profile });
  }

  const totalCount = descriptors.length;
  const completedCount = completedNames.length;
  const nationalElapsedMs = elapsedMs(runStartedAt, nowDate);
  const regionElapsedMs = regionProgress ? elapsedMs(regionProgress.startedAt, nowDate) : null;

  return {
    activeRegionId,
    activeRegionName: activeDescriptor?.name || "",
    regionProgress,
    regionElapsedMs,
    regionRemainingMs,
    regionExpectedAt: expectedAt(nowDate, regionRemainingMs),
    completedCount,
    totalCount,
    nationalPercent: totalCount > 0 ? clampPercent(completedCount / totalCount * 100) : 0,
    nationalElapsedMs,
    nationalRemainingMs,
    nationalExpectedAt: expectedAt(nowDate, nationalRemainingMs),
    completedRegionNames: completedNames,
    remainingRegionNames: remaining.map((region) => region.name),
    remainingCount: remaining.length
  };
}

export function reachedProgressMilestones(percent, sentKeys, keyForMilestone) {
  const sent = sentKeys instanceof Set ? sentKeys : new Set(sentKeys || []);
  const reached = KB_NATIONAL_PROGRESS_MILESTONES.filter((milestone) =>
    Number(percent) >= milestone && !sent.has(keyForMilestone(milestone))
  );
  if (!reached.length) return null;
  return {
    threshold: reached.at(-1),
    dedupeKeys: reached.map(keyForMilestone)
  };
}

export function parseDiscoveryProgress(value) {
  const match = String(value || "").match(/단지 탐색\s+([\d,]+)\/([\d,]+)\s+타일(?:,\s*발견\s*([\d,]+)개)?/);
  if (!match) return null;
  return {
    current: Number(match[1].replaceAll(",", "")),
    total: Number(match[2].replaceAll(",", "")),
    found: Number(String(match[3] || "0").replaceAll(",", ""))
  };
}

function progressResult(job, percent, processed, total, label, extra = {}) {
  return {
    label,
    percent: clampPercent(percent),
    processed: Number(processed || 0),
    total: Number(total || 0),
    completed: job.completed,
    failed: job.failed,
    status: job.status,
    currentComplexName: job.currentComplexName,
    ...extra
  };
}

function normalizeProfile(profile = {}) {
  return {
    discoveryMsPerTile: positiveNumber(profile.discoveryMsPerTile, DEFAULT_PROFILE.discoveryMsPerTile),
    infoMsPerComplex: positiveNumber(profile.infoMsPerComplex, DEFAULT_PROFILE.infoMsPerComplex),
    priceMsPerComplex: positiveNumber(profile.priceMsPerComplex, DEFAULT_PROFILE.priceMsPerComplex),
    complexesPerTile: positiveNumber(profile.complexesPerTile, DEFAULT_PROFILE.complexesPerTile)
  };
}

function observedRate({ startedAt, processed, fallback, nowMs }) {
  if (!startedAt || processed < 5) return fallback;
  const elapsed = nowMs - new Date(startedAt).getTime();
  if (!positiveFinite(elapsed)) return fallback;
  return Math.min(fallback * 4, Math.max(fallback * 0.25, elapsed / processed));
}

function expectedAt(now, remainingMs) {
  if (!Number.isFinite(remainingMs) || remainingMs < 0) return null;
  return new Date(now.getTime() + remainingMs).toISOString();
}

function elapsedMs(start, end) {
  if (!start || !end) return null;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return endMs - startMs;
}

function median(values, fallback) {
  const sorted = values.filter(positiveFinite).sort((left, right) => left - right);
  if (!sorted.length) return fallback;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return positiveFinite(number) ? number : fallback;
}

function positiveFinite(value) {
  return Number.isFinite(value) && value > 0;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}
