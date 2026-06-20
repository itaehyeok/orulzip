import crypto from "node:crypto";
import { analyticsQuery, closeDb, initAnalyticsDb } from "../src/services/db.js";
import {
  markAnalyticsVisitorInternal,
  readAnalyticsSummary,
  recordAnalyticsEvent
} from "../src/services/analytics-store.js";

const checkId = `analytics-check-${Date.now()}`;
const visitorId = crypto.randomUUID();

try {
  if (process.env.ORULZIP_ANALYTICS_DB_INIT === "1") {
    await initAnalyticsDb();
  }
  await markAnalyticsVisitorInternal(visitorId, { reason: "analytics_check" });
  const first = await recordAnalyticsEvent({
    visitorId,
    eventName: "page_view",
    path: "/analytics-check",
    title: "Analytics check",
    metadata: { checkId, step: "page_view" },
    userInfo: {
      country: "KR",
      region: "Seoul",
      city: "Seoul",
      timezone: "Asia/Seoul",
      language: "ko-KR",
      viewportWidth: 390,
      viewportHeight: 844,
      screenWidth: 390,
      screenHeight: 844,
      devicePixelRatio: 3,
      touchSupported: true,
      utmSource: "analytics-check"
    },
    host: "analytics-check.local",
    environment: "local",
    ipHash: "check-ip-hash",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    isAdmin: true
  });
  await recordAnalyticsEvent({
    visitorId,
    sessionId: first.sessionId,
    eventName: "analytics_check",
    path: "/analytics-check",
    title: "Analytics check",
    metadata: { checkId, step: "event" },
    userInfo: {
      country: "KR",
      region: "Seoul",
      city: "Seoul",
      timezone: "Asia/Seoul",
      language: "ko-KR"
    },
    host: "analytics-check.local",
    environment: "local",
    ipHash: "check-ip-hash",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    isAdmin: true
  });

  const summary = await readAnalyticsSummary({ days: 1, includeAdmin: true, includeInternal: true, environment: "local" });
  const count = await analyticsQuery(`
    select count(*)::integer as count
    from analytics.events
    where visitor_id = $1
  `, [visitorId]);
  const userInfo = await analyticsQuery(`
    select user_info
    from analytics.events
    where visitor_id = $1
    order by created_at desc
    limit 1
  `, [visitorId]);

  console.log(JSON.stringify({
    ok: true,
    checkId,
    visitorId,
    sessionId: first.sessionId,
    insertedEvents: Number(count.rows[0]?.count || 0),
    latestUserInfo: userInfo.rows[0]?.user_info || {},
    summary: summary.overview,
    userInfoSummary: summary.userInfo
  }, null, 2));
} finally {
  await closeDb();
}
