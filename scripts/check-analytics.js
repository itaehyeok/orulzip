import crypto from "node:crypto";
import { analyticsQuery, closeDb, initAnalyticsDb } from "../src/services/db.js";
import {
  readAnalyticsSummary,
  recordAnalyticsEvent
} from "../src/services/analytics-store.js";

const checkId = `analytics-check-${Date.now()}`;
const visitorId = crypto.randomUUID();

try {
  if (process.env.ORULZIP_ANALYTICS_DB_INIT === "1") {
    await initAnalyticsDb();
  }
  const first = await recordAnalyticsEvent({
    visitorId,
    eventName: "page_view",
    path: "/analytics-check",
    title: "Analytics check",
    metadata: { checkId, step: "page_view" },
    ipHash: "check-ip-hash",
    userAgent: "orulzip-analytics-check",
    isAdmin: true
  });
  await recordAnalyticsEvent({
    visitorId,
    sessionId: first.sessionId,
    eventName: "analytics_check",
    path: "/analytics-check",
    title: "Analytics check",
    metadata: { checkId, step: "event" },
    ipHash: "check-ip-hash",
    userAgent: "orulzip-analytics-check",
    isAdmin: true
  });

  const summary = await readAnalyticsSummary({ days: 1, includeAdmin: true });
  const count = await analyticsQuery(`
    select count(*)::integer as count
    from analytics.events
    where visitor_id = $1
  `, [visitorId]);

  console.log(JSON.stringify({
    ok: true,
    checkId,
    visitorId,
    sessionId: first.sessionId,
    insertedEvents: Number(count.rows[0]?.count || 0),
    summary: summary.overview
  }, null, 2));
} finally {
  await closeDb();
}
