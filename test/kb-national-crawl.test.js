import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHistoricalCrawlProfile,
  buildNationalProgress,
  KB_NATIONAL_ALL_REGION_IDS,
  KB_NATIONAL_PRECOMPLETED_REGION_IDS,
  KB_NATIONAL_REGION_ORDER,
  parseDiscoveryProgress,
  reachedProgressMilestones,
  regionCrawlProgress
} from "../src/services/kb-national-crawl.js";
import { telegramKbNationalCrawlMessage } from "../src/services/telegram-notifier.js";

const infoJob = {
  id: 101,
  region_id: "gwangju",
  years_back: 0,
  status: "completed",
  total_complexes: 400,
  completed_complexes: 400,
  failed_complexes: 0,
  max_tiles: 200,
  created_at: "2026-08-08T00:00:00.000Z",
  started_at: "2026-08-08T00:00:00.000Z",
  discovered_at: "2026-08-08T00:10:00.000Z",
  finished_at: "2026-08-08T00:40:00.000Z"
};

const priceJob = {
  id: 102,
  region_id: "gwangju",
  years_back: 10,
  source_job_id: 101,
  status: "running",
  total_complexes: 400,
  completed_complexes: 100,
  failed_complexes: 0,
  max_tiles: 200,
  created_at: "2026-08-08T00:00:00.000Z",
  started_at: "2026-08-08T00:40:00.000Z"
};

test("national configuration covers all 17 collection regions exactly once", () => {
  const configured = [...KB_NATIONAL_PRECOMPLETED_REGION_IDS, ...KB_NATIONAL_REGION_ORDER];
  assert.equal(configured.length, 17);
  assert.equal(new Set(configured).size, 17);
  assert.deepEqual(new Set(configured), new Set(KB_NATIONAL_ALL_REGION_IDS));
});

test("parses persisted tile discovery progress", () => {
  assert.deepEqual(parseDiscoveryProgress("단지 탐색 125/247 타일, 발견 318개"), {
    current: 125,
    total: 247,
    found: 318
  });
});

test("reports 62.5 percent when info is complete and prices are 25 percent", () => {
  const progress = regionCrawlProgress({ infoJob, priceJob }, { tileCount: 200 });
  assert.equal(progress.info.percent, 100);
  assert.equal(progress.price.percent, 25);
  assert.equal(progress.overallPercent, 62.5);
  assert.equal(progress.currentStage.label, "10년 시세");
});

test("builds ETA rates from completed crawl history", () => {
  const completedPrice = {
    ...priceJob,
    status: "completed",
    completed_complexes: 400,
    finished_at: "2026-08-08T02:40:00.000Z"
  };
  const profile = buildHistoricalCrawlProfile([infoJob, completedPrice]);

  assert.equal(profile.discoveryMsPerTile, 3000);
  assert.equal(profile.infoMsPerComplex, 4500);
  assert.equal(profile.priceMsPerComplex, 18000);
  assert.equal(profile.complexesPerTile, 2);
  assert.deepEqual(profile.sampleCounts, { discovery: 1, info: 1, price: 1, density: 1 });
});

test("builds nationwide counts, remaining list, and ETA", () => {
  const progress = buildNationalProgress({
    allRegionIds: [...KB_NATIONAL_PRECOMPLETED_REGION_IDS, ...KB_NATIONAL_REGION_ORDER],
    targetRegionIds: KB_NATIONAL_REGION_ORDER,
    completedRegionIds: KB_NATIONAL_PRECOMPLETED_REGION_IDS,
    assignments: [{ regionId: "gwangju", infoJob, priceJob }],
    activeRegionId: "gwangju",
    runStartedAt: "2026-08-08T00:00:00.000Z",
    profile: {
      discoveryMsPerTile: 1000,
      infoMsPerComplex: 2000,
      priceMsPerComplex: 3000,
      complexesPerTile: 1
    },
    now: new Date("2026-08-08T01:00:00.000Z")
  });

  assert.equal(progress.completedCount, 3);
  assert.equal(progress.totalCount, 17);
  assert.equal(progress.remainingCount, 14);
  assert.equal(progress.remainingRegionNames[0], "광주");
  assert.equal(progress.regionProgress.overallPercent, 62.5);
  assert.ok(progress.regionRemainingMs > 0);
  assert.ok(progress.nationalRemainingMs > progress.regionRemainingMs);
  assert.ok(progress.nationalExpectedAt);
});

test("collapses unsent progress milestones to the highest reached", () => {
  const sent = new Set();
  const reached = reachedProgressMilestones(80, sent, (milestone) => `progress:${milestone}`);
  assert.equal(reached.threshold, 75);
  assert.deepEqual(reached.dedupeKeys, ["progress:25", "progress:50", "progress:75"]);
});

test("formats the accepted nationwide Telegram progress summary", () => {
  const message = telegramKbNationalCrawlMessage({
    kind: "progress",
    environment: "production",
    regionName: "충북",
    regionProgressPercent: 62.5,
    stage: "10년 시세",
    stagePercent: 25,
    processed: 94,
    total: 376,
    regionElapsedMs: 102 * 60_000,
    regionRemainingMs: 130 * 60_000,
    regionExpectedAt: "2026-08-08T09:40:00.000Z",
    completedCount: 3,
    totalCount: 17,
    nationalPercent: 17.647,
    nationalElapsedMs: 372 * 60_000,
    nationalRemainingMs: 80 * 60 * 60_000,
    nationalExpectedAt: "2026-08-11T14:30:00.000Z",
    completedRegionNames: ["서울", "경기도", "세종"],
    remainingRegionNames: ["광주", "대전", "충북"],
    remainingCount: 14
  });

  assert.match(message, /현재 지역: 충북/);
  assert.match(message, /지역 전체 진행률: 62.5%/);
  assert.match(message, /현재 단계: 10년 시세 25.0% \(94\/376\)/);
  assert.match(message, /전국 진행: 3\/17개 지역 완료 \(17.6%\)/);
  assert.match(message, /남은 지역: 14곳/);
});

test("does not show a moving ETA while a region is paused for a fix", () => {
  const message = telegramKbNationalCrawlMessage({
    kind: "region_paused",
    environment: "production",
    regionName: "광주",
    stage: "10년 시세",
    retryAttempt: 2,
    maxRetries: 2,
    errorMessage: "No regional complexes available",
    regionElapsedMs: 113 * 60_000,
    regionRemainingMs: 7 * 60 * 60_000,
    regionExpectedAt: "2026-08-08T10:54:00.000Z",
    completedCount: 3,
    totalCount: 17,
    nationalPercent: 17.647,
    nationalElapsedMs: 113 * 60_000,
    nationalRemainingMs: 20 * 24 * 60 * 60_000,
    nationalExpectedAt: "2026-08-28T04:13:00.000Z",
    completedRegionNames: ["서울", "경기도", "세종"],
    remainingRegionNames: ["광주", "대전"],
    remainingCount: 14
  });

  assert.match(message, /지역 예상 남은 시간: 수정 대기/);
  assert.match(message, /지역 예상 완료: 수정 대기/);
  assert.match(message, /전국 예상 남은 시간: 수정 대기/);
  assert.match(message, /전국 예상 완료: 수정 대기/);
  assert.doesNotMatch(message, /20일/);
});

test("reports that regional completion no longer waits for the national cache", () => {
  const message = telegramKbNationalCrawlMessage({
    kind: "region_completed",
    environment: "production",
    regionName: "경남",
    cacheStatus: "전국 수집 완료 후 갱신 예정",
    nextRegionName: "전남",
    coverage: {
      apartments: 1200,
      areaTypes: 3400,
      monthlyPrices: 180000,
      minMonth: "201608",
      maxMonth: "202608"
    },
    completedCount: 13,
    totalCount: 17,
    nationalPercent: 76.47,
    completedRegionNames: ["서울", "경기도", "세종", "경남"],
    remainingRegionNames: ["전남", "강원", "경북", "인천"],
    remainingCount: 4
  });

  assert.match(message, /오를집 KB 경남 수집 완료/);
  assert.match(message, /KB 지도 캐시: 전국 수집 완료 후 갱신 예정/);
  assert.match(message, /다음 지역: 전남/);
});
