import assert from "node:assert/strict";
import test from "node:test";
import {
  buildKbCrawlNotificationEvents,
  KB_CRAWL_NOTIFICATION_LOG_MESSAGE
} from "../src/services/kb-crawl-notifications.js";
import { telegramKbCrawlMessage } from "../src/services/telegram-notifier.js";

const baseJobs = [
  {
    id: 1,
    region_id: "sejong",
    years_back: 0,
    source_job_id: null,
    status: "running",
    total_complexes: 376,
    completed_complexes: 100,
    failed_complexes: 0,
    current_complex_name: "테스트아파트",
    created_at: "2026-08-07T06:43:37.000Z",
    started_at: "2026-08-07T06:43:37.000Z"
  },
  {
    id: 2,
    region_id: "sejong",
    years_back: 10,
    source_job_id: 1,
    status: "requested",
    total_complexes: 0,
    completed_complexes: 0,
    failed_complexes: 0,
    created_at: "2026-08-07T06:43:37.000Z"
  }
];

test("builds monitoring, discovery, and the reached progress milestone", () => {
  const events = buildKbCrawlNotificationEvents({ jobs: baseJobs, environment: "production" });

  assert.deepEqual(events.map((event) => event.kind), [
    "monitoring_started",
    "discovery_completed",
    "progress"
  ]);
  assert.equal(events[2].threshold, 25);
  assert.equal(events[2].regionName, "세종");
});

test("collapses missed progress milestones into the highest reached notification", () => {
  const jobs = structuredClone(baseJobs);
  jobs[0].completed_complexes = 300;
  const events = buildKbCrawlNotificationEvents({ jobs });
  const progress = events.find((event) => event.kind === "progress");

  assert.equal(progress.threshold, 75);
  assert.deepEqual(progress.dedupeKeys, [
    "kb-crawl:job:1:progress:25",
    "kb-crawl:job:1:progress:50",
    "kb-crawl:job:1:progress:75"
  ]);
});

test("does not repeat notifications recorded in crawl logs", () => {
  const sentEventKeys = [
    "kb-crawl:1,2:monitoring-started",
    "kb-crawl:job:1:discovery-completed",
    "kb-crawl:job:1:progress:25"
  ];
  const events = buildKbCrawlNotificationEvents({ jobs: baseJobs, sentEventKeys });

  assert.deepEqual(events, []);
  assert.equal(KB_CRAWL_NOTIFICATION_LOG_MESSAGE, "Telegram KB crawl notification sent");
});

test("sends the final summary only after the final cache refresh", () => {
  const jobs = structuredClone(baseJobs);
  jobs[0] = {
    ...jobs[0],
    status: "completed",
    completed_complexes: 376,
    finished_at: "2026-08-07T07:00:00.000Z"
  };
  jobs[1] = {
    ...jobs[1],
    status: "completed",
    total_complexes: 376,
    completed_complexes: 374,
    failed_complexes: 2,
    started_at: "2026-08-07T07:00:01.000Z",
    finished_at: "2026-08-07T10:00:00.000Z"
  };
  const sentEventKeys = [
    "kb-crawl:1,2:monitoring-started",
    "kb-crawl:job:1:discovery-completed",
    "kb-crawl:job:1:completed"
  ];

  const waitingEvents = buildKbCrawlNotificationEvents({ jobs, sentEventKeys });
  assert.equal(waitingEvents.some((event) => event.kind === "all_completed"), false);
  assert.equal(waitingEvents.some((event) => event.kind === "stage_completed" && event.jobId === 2), true);

  const finalEvents = buildKbCrawlNotificationEvents({
    jobs,
    sentEventKeys,
    cacheRefreshedJobIds: [2],
    now: new Date("2026-08-07T10:00:01.000Z")
  });
  const finalEvent = finalEvents.find((event) => event.kind === "all_completed");
  assert.ok(finalEvent);
  assert.equal(finalEvents.some((event) => event.kind === "stage_completed" && event.jobId === 2), false);

  const message = telegramKbCrawlMessage({
    ...finalEvent,
    coverage: {
      apartments: 376,
      areaTypes: 812,
      monthlyPrices: 50400,
      minMonth: "201608",
      maxMonth: "202608"
    }
  });
  assert.match(message, /오를집 KB 전체 수집 완료/);
  assert.match(message, /월별 시세: 50,400건/);
  assert.match(message, /KB 지도 캐시: 갱신 완료/);
});

test("reports a cache refresh failure without declaring the crawl complete", () => {
  const jobs = structuredClone(baseJobs);
  jobs[0].status = "completed";
  jobs[0].completed_complexes = 376;
  const events = buildKbCrawlNotificationEvents({
    jobs,
    cacheFailedJobs: [{ jobId: 1, errorMessage: "timeout" }]
  });
  const failure = events.find((event) => event.kind === "cache_failed");

  assert.ok(failure);
  assert.equal(failure.errorMessage, "timeout");
  assert.equal(events.some((event) => event.kind === "all_completed"), false);
});
