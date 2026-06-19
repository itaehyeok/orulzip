import crypto from "node:crypto";
import { analyticsQuery, withAnalyticsClient } from "./db.js";

const sessionTimeoutMinutes = 30;

export async function recordAnalyticsEvent(input = {}) {
  const eventName = normalizeEventName(input.eventName);
  const visitorId = normalizeTrackingId(input.visitorId) || crypto.randomUUID();
  const requestedSessionId = normalizeTrackingId(input.sessionId);
  const pageViewIncrement = eventName === "page_view" ? 1 : 0;
  const payload = {
    visitorId,
    eventName,
    path: truncateText(input.path, 320),
    title: truncateText(input.title, 240),
    referrer: truncateText(input.referrer, 640),
    metadata: sanitizeMetadata(input.metadata),
    host: truncateText(input.host, 240),
    environment: normalizeStoredAnalyticsEnvironment(input.environment),
    ipHash: truncateText(input.ipHash, 128),
    userAgent: truncateText(input.userAgent, 640),
    isAdmin: Boolean(input.isAdmin)
  };

  return await withAnalyticsClient(async (client) => {
    await client.query("begin");
    try {
      await client.query(`
        insert into analytics.visitors as visitors (
          visitor_id,
          first_seen_at,
          last_seen_at,
          event_count,
          page_view_count,
          last_ip_hash,
          last_user_agent,
          last_path,
          last_is_admin
        )
        values ($1, now(), now(), 1, $2, $3, $4, $5, $6)
        on conflict (visitor_id) do update set
          last_seen_at = now(),
          event_count = visitors.event_count + 1,
          page_view_count = visitors.page_view_count + $2,
          last_ip_hash = excluded.last_ip_hash,
          last_user_agent = excluded.last_user_agent,
          last_path = excluded.last_path,
          last_is_admin = excluded.last_is_admin
      `, [
        payload.visitorId,
        pageViewIncrement,
        payload.ipHash,
        payload.userAgent,
        payload.path,
        payload.isAdmin
      ]);

      const internalStatus = await client.query(`
        select is_internal
        from analytics.visitors
        where visitor_id = $1
        limit 1
      `, [payload.visitorId]);
      const isInternal = Boolean(internalStatus.rows[0]?.is_internal);

      const sessionId = await activeOrNewSessionId(client, {
        requestedSessionId,
        visitorId: payload.visitorId,
        path: payload.path,
        isAdmin: payload.isAdmin,
        pageViewIncrement
      });

      const event = await client.query(`
        insert into analytics.events (
          visitor_id,
          session_id,
          event_name,
          path,
          title,
          referrer,
          metadata,
          host,
          environment,
          ip_hash,
          user_agent,
          is_admin,
          is_internal
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13)
        returning id, created_at
      `, [
        payload.visitorId,
        sessionId,
        payload.eventName,
        payload.path,
        payload.title,
        payload.referrer,
        JSON.stringify(payload.metadata),
        payload.host,
        payload.environment,
        payload.ipHash,
        payload.userAgent,
        payload.isAdmin,
        isInternal
      ]);

      await client.query("commit");
      return {
        visitorId: payload.visitorId,
        sessionId,
        eventId: Number(event.rows[0]?.id || 0),
        createdAt: event.rows[0]?.created_at || null,
        isInternal
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

export async function markAnalyticsVisitorInternal(visitorId, { reason = "admin_login" } = {}) {
  const normalizedVisitorId = normalizeTrackingId(visitorId);
  if (!normalizedVisitorId) return { marked: false, visitorId: "" };

  await withAnalyticsClient(async (client) => {
    await client.query("begin");
    try {
      await client.query(`
        insert into analytics.visitors (
          visitor_id,
          first_seen_at,
          last_seen_at,
          is_internal,
          internal_reason,
          internal_marked_at
        )
        values ($1, now(), now(), true, $2, now())
        on conflict (visitor_id) do update set
          is_internal = true,
          internal_reason = excluded.internal_reason,
          internal_marked_at = now()
      `, [normalizedVisitorId, truncateText(reason, 120)]);
      await client.query(`
        update analytics.visitors
        set
          is_internal = true,
          internal_reason = $2,
          internal_marked_at = now()
        where visitor_id = $1
      `, [normalizedVisitorId, truncateText(reason, 120)]);
      await client.query(`
        update analytics.events
        set is_internal = true
        where visitor_id = $1
      `, [normalizedVisitorId]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });

  return { marked: true, visitorId: normalizedVisitorId };
}

export async function readAnalyticsSummary({ days = 7, includeAdmin = false, includeInternal = false, environment = "all" } = {}) {
  const filters = normalizedAnalyticsFilters({ days, includeAdmin, includeInternal, environment });
  const params = [filters.days, filters.includeAdmin, filters.includeInternal, filters.environment];
  const eventWhere = `created_at >= now() - ($1::int * interval '1 day') and ($2::boolean or not is_admin) and ($3::boolean or not is_internal) and ($4::text = 'all' or coalesce(environment, 'unknown') = $4::text)`;
  const eventWhereWithAlias = `e.created_at >= now() - ($1::int * interval '1 day') and ($2::boolean or not e.is_admin) and ($3::boolean or not e.is_internal) and ($4::text = 'all' or coalesce(e.environment, 'unknown') = $4::text)`;

  const [
    overview,
    daily,
    pages,
    events,
    recentVisitors,
    recentEvents
  ] = await Promise.all([
    analyticsQuery(`
      select
        count(*)::integer as events,
        count(*) filter (where event_name = 'page_view')::integer as page_views,
        count(distinct visitor_id)::integer as visitors,
        count(distinct session_id)::integer as sessions,
        count(distinct path) filter (where event_name = 'page_view' and coalesce(path, '') <> '')::integer as pages
      from analytics.events
      where ${eventWhere}
    `, params),
    analyticsQuery(`
      select
        date_trunc('day', created_at)::date as day,
        count(*)::integer as events,
        count(*) filter (where event_name = 'page_view')::integer as page_views,
        count(distinct visitor_id)::integer as visitors,
        count(distinct session_id)::integer as sessions
      from analytics.events
      where ${eventWhere}
      group by 1
      order by 1 desc
      limit 31
    `, params),
    analyticsQuery(`
      select
        coalesce(path, '-') as path,
        (array_agg(title order by created_at desc))[1] as title,
        count(*)::integer as page_views,
        count(distinct visitor_id)::integer as visitors,
        max(created_at) as last_seen_at
      from analytics.events
      where ${eventWhere} and event_name = 'page_view'
      group by coalesce(path, '-')
      order by page_views desc, visitors desc, last_seen_at desc
      limit 30
    `, params),
    analyticsQuery(`
      select
        event_name,
        count(*)::integer as events,
        count(distinct visitor_id)::integer as visitors,
        max(created_at) as last_seen_at
      from analytics.events
      where ${eventWhere}
      group by event_name
      order by events desc, visitors desc, last_seen_at desc
      limit 30
    `, params),
    analyticsQuery(`
      select
        e.visitor_id,
        min(v.first_seen_at) as first_seen_at,
        max(e.created_at) as last_seen_at,
        max(v.last_ip_hash) as last_ip_hash,
        count(*)::integer as period_events,
        count(*) filter (where e.event_name = 'page_view')::integer as period_page_views,
        count(distinct e.session_id)::integer as period_sessions,
        (array_agg(e.path order by e.created_at desc))[1] as last_path,
        bool_or(e.is_admin)::boolean as has_admin_events,
        bool_or(e.is_internal)::boolean as is_internal,
        (array_agg(e.host order by e.created_at desc))[1] as last_host,
        (array_agg(e.environment order by e.created_at desc))[1] as last_environment,
        max(v.internal_reason) as internal_reason,
        max(v.internal_marked_at) as internal_marked_at
      from analytics.events e
      join analytics.visitors v on v.visitor_id = e.visitor_id
      where ${eventWhereWithAlias}
      group by e.visitor_id
      order by max(e.created_at) desc
      limit 30
    `, params),
    analyticsQuery(`
      select
        id,
        visitor_id,
        session_id,
        event_name,
        path,
        title,
        metadata,
        host,
        environment,
        is_admin,
        is_internal,
        created_at
      from analytics.events
      where ${eventWhere}
      order by created_at desc
      limit 50
    `, params)
  ]);

  return {
    filters,
    overview: normalizeOverviewRow(overview.rows[0]),
    daily: daily.rows.map(normalizeDailyRow),
    pages: pages.rows.map(normalizePageRow),
    events: events.rows.map(normalizeEventRow),
    recentVisitors: recentVisitors.rows.map(normalizeVisitorRow),
    recentEvents: recentEvents.rows.map(normalizeRecentEventRow)
  };
}

export async function readAnalyticsVisitors({ days = 7, includeAdmin = false, includeInternal = false, environment = "all", limit = 100 } = {}) {
  const filters = normalizedAnalyticsFilters({ days, includeAdmin, includeInternal, environment });
  const normalizedLimit = Math.max(10, Math.min(Number(limit) || 100, 300));
  const result = await analyticsQuery(`
    select
      e.visitor_id,
      min(v.first_seen_at) as first_seen_at,
      max(e.created_at) as last_seen_at,
      max(v.last_ip_hash) as last_ip_hash,
      count(*)::integer as period_events,
      count(*) filter (where e.event_name = 'page_view')::integer as period_page_views,
      count(distinct e.session_id)::integer as period_sessions,
      (array_agg(e.path order by e.created_at desc))[1] as last_path,
      bool_or(e.is_admin)::boolean as has_admin_events,
      bool_or(e.is_internal)::boolean as is_internal,
      (array_agg(e.host order by e.created_at desc))[1] as last_host,
      (array_agg(e.environment order by e.created_at desc))[1] as last_environment,
      max(v.internal_reason) as internal_reason,
      max(v.internal_marked_at) as internal_marked_at
    from analytics.events e
    join analytics.visitors v on v.visitor_id = e.visitor_id
    where e.created_at >= now() - ($1::int * interval '1 day') and ($2::boolean or not e.is_admin) and ($3::boolean or not e.is_internal) and ($4::text = 'all' or coalesce(e.environment, 'unknown') = $4::text)
    group by e.visitor_id
    order by max(e.created_at) desc
    limit $5
  `, [filters.days, filters.includeAdmin, filters.includeInternal, filters.environment, normalizedLimit]);

  return {
    filters: { ...filters, limit: normalizedLimit },
    visitors: result.rows.map(normalizeVisitorRow)
  };
}

async function activeOrNewSessionId(client, { requestedSessionId, visitorId, path, isAdmin, pageViewIncrement }) {
  if (requestedSessionId) {
    const active = await client.query(`
      select session_id
      from analytics.sessions
      where session_id = $1
        and visitor_id = $2
        and last_seen_at >= now() - ($3::int * interval '1 minute')
      limit 1
    `, [requestedSessionId, visitorId, sessionTimeoutMinutes]);

    if (active.rows[0]?.session_id) {
      await client.query(`
        update analytics.sessions
        set
          last_seen_at = now(),
          event_count = event_count + 1,
          page_view_count = page_view_count + $2,
          exit_path = $3,
          is_admin = is_admin or $4
        where session_id = $1
      `, [requestedSessionId, pageViewIncrement, path, isAdmin]);
      return requestedSessionId;
    }
  }

  const sessionId = crypto.randomUUID();
  await client.query(`
    insert into analytics.sessions (
      session_id,
      visitor_id,
      started_at,
      last_seen_at,
      event_count,
      page_view_count,
      entry_path,
      exit_path,
      is_admin
    )
    values ($1, $2, now(), now(), 1, $3, $4, $4, $5)
  `, [sessionId, visitorId, pageViewIncrement, path, isAdmin]);
  return sessionId;
}

function normalizedAnalyticsFilters({ days = 7, includeAdmin = false, includeInternal = false, environment = "all" } = {}) {
  return {
    days: Math.max(1, Math.min(Number(days) || 7, 90)),
    includeAdmin: Boolean(includeAdmin),
    includeInternal: Boolean(includeInternal),
    environment: normalizeAnalyticsEnvironment(environment)
  };
}

function normalizeAnalyticsEnvironment(value) {
  const environment = String(value || "unknown").trim().toLowerCase();
  if (["production", "development", "local", "unknown", "all"].includes(environment)) return environment;
  return "unknown";
}

function normalizeStoredAnalyticsEnvironment(value) {
  const environment = normalizeAnalyticsEnvironment(value);
  return environment === "all" ? "unknown" : environment;
}

function normalizeTrackingId(value) {
  const id = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return "";
  return id;
}

function normalizeEventName(value) {
  const name = String(value || "page_view")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return name || "page_view";
}

function truncateText(value, maxLength) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : "";
}

function sanitizeMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value).slice(0, 30).map(([key, entryValue]) => [
    String(key).slice(0, 80),
    sanitizeMetadataValue(entryValue)
  ]);
  const metadata = Object.fromEntries(entries);
  const encoded = JSON.stringify(metadata);
  if (encoded.length <= 4000) return metadata;
  return { truncated: true };
}

function sanitizeMetadataValue(value) {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value.slice(0, 500);
  if (Array.isArray(value)) return value.slice(0, 20).map(sanitizeMetadataValue);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, 12).map(([key, entryValue]) => [
      String(key).slice(0, 80),
      sanitizeMetadataValue(entryValue)
    ]));
  }
  return String(value).slice(0, 200);
}

function normalizeOverviewRow(row = {}) {
  const events = Number(row.events || 0);
  const visitors = Number(row.visitors || 0);
  return {
    visitors,
    sessions: Number(row.sessions || 0),
    pageViews: Number(row.page_views || 0),
    events,
    pages: Number(row.pages || 0),
    eventsPerVisitor: visitors ? events / visitors : 0
  };
}

function normalizeDailyRow(row) {
  return {
    day: String(row.day || ""),
    visitors: Number(row.visitors || 0),
    sessions: Number(row.sessions || 0),
    pageViews: Number(row.page_views || 0),
    events: Number(row.events || 0)
  };
}

function normalizePageRow(row) {
  return {
    path: String(row.path || "-"),
    title: String(row.title || ""),
    pageViews: Number(row.page_views || 0),
    visitors: Number(row.visitors || 0),
    lastSeenAt: row.last_seen_at || null
  };
}

function normalizeEventRow(row) {
  return {
    eventName: String(row.event_name || ""),
    events: Number(row.events || 0),
    visitors: Number(row.visitors || 0),
    lastSeenAt: row.last_seen_at || null
  };
}

function normalizeVisitorRow(row) {
  return {
    visitorId: String(row.visitor_id || ""),
    firstSeenAt: row.first_seen_at || null,
    lastSeenAt: row.last_seen_at || null,
    lastIpHash: String(row.last_ip_hash || ""),
    periodEvents: Number(row.period_events || 0),
    periodPageViews: Number(row.period_page_views || 0),
    periodSessions: Number(row.period_sessions || 0),
    lastPath: String(row.last_path || ""),
    hasAdminEvents: Boolean(row.has_admin_events),
    isInternal: Boolean(row.is_internal),
    lastHost: String(row.last_host || ""),
    lastEnvironment: normalizeAnalyticsEnvironment(row.last_environment),
    internalReason: String(row.internal_reason || ""),
    internalMarkedAt: row.internal_marked_at || null
  };
}

function normalizeRecentEventRow(row) {
  return {
    id: Number(row.id || 0),
    visitorId: String(row.visitor_id || ""),
    sessionId: String(row.session_id || ""),
    eventName: String(row.event_name || ""),
    path: String(row.path || ""),
    title: String(row.title || ""),
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    host: String(row.host || ""),
    environment: normalizeAnalyticsEnvironment(row.environment),
    isAdmin: Boolean(row.is_admin),
    isInternal: Boolean(row.is_internal),
    createdAt: row.created_at || null
  };
}
