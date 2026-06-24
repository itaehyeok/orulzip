import { createServer } from "node:http";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { initAnalyticsDb, initDb, query } from "./services/db.js";
import {
  createCrawlJob,
  crawlDetails,
  readDatasetFromDb,
  readFilterOptions,
  readStatusOverview
} from "./services/db-store.js";
import { regions } from "./services/region-config.js";
import { tradeCollectionStatus } from "./services/molit-trade-store.js";
import { buildFormulaAnalysis } from "./services/formula-analysis.js";
import { searchMapTargets } from "./services/map-search.js";
import {
  buildMolitApartmentDetail,
  DEFAULT_ACTIVE_MIN_HOUSEHOLD_COUNT,
  readApartmentMapRankSummary,
  readCachedZoomMapSummary
} from "./services/map-growth-cache.js";
import {
  readMolitCoordinateAudit,
  readMolitDuplicateAudit
} from "./services/molit-complex-store.js";
import { readPriceBandRankPage } from "./services/price-band-rank-cache.js";
import {
  markAnalyticsVisitorInternal,
  readExternalVisitorAlertSummary,
  readAnalyticsSummary,
  readAnalyticsVisitors,
  recordAnalyticsEvent
} from "./services/analytics-store.js";
import {
  notifyTelegramExternalVisitor,
  shouldNotifyExternalVisitorVisit
} from "./services/telegram-notifier.js";
import {
  buildApartmentRankings,
  buildNeighborhoodChart,
  buildNeighborhoodRankings
} from "./services/price-calculator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "public");
const port = Number(process.env.PORT || 3050);
const host = process.env.HOST || "127.0.0.1";
const siteOrigin = (process.env.PUBLIC_SITE_URL || "https://orulzip.com").replace(/\/+$/, "");
const readOnlyMode = process.env.ORULZIP_READ_ONLY === "1";
const shouldInitDb = process.env.ORULZIP_DB_INIT !== "0";
const appRoutes = new Set(["/", "/map", "/molit-map", "/kb-map", "/neighborhood", "/apartment-rankings", "/price-bands", "/formula", "/terms", "/design", "/crawl", "/analytics"]);
const protectedAppRoutes = new Set(["/kb-map", "/neighborhood", "/formula", "/terms", "/design", "/crawl", "/analytics"]);
const protectedApiRoutes = new Set([
  "/api/crawl/details",
  "/api/crawl/start",
  "/api/sync",
  "/api/neighborhood-rankings",
  "/api/neighborhood-chart",
  "/api/apartment-detail",
  "/api/formula-analysis",
  "/api/molit/status",
  "/api/molit/coordinate-audit",
  "/api/molit/duplicate-audit",
  "/api/analytics/summary",
  "/api/analytics/visitors"
]);
const writeApiRoutes = new Set(["/api/crawl/start", "/api/sync"]);
const adminCookieName = "orulzip_admin";
const adminUser = process.env.ORULZIP_ADMIN_USER || "th";
const adminPassword = process.env.ORULZIP_ADMIN_PASSWORD || "";
const adminSessionSecret = process.env.ORULZIP_ADMIN_SESSION_SECRET
  || crypto.createHash("sha256").update(`orulzip-admin:${adminUser}:${adminPassword}`).digest("hex");
const adminSessionMaxAgeSeconds = 60 * 60 * 24 * 30;
const adminCookieSecure = process.env.ORULZIP_ADMIN_COOKIE_SECURE === "1";
const analyticsVisitorCookieName = "orulzip_visitor_id";
const analyticsSessionCookieName = "orulzip_session_id";
const analyticsVisitorMaxAgeSeconds = 60 * 60 * 24 * 365;
const analyticsSessionMaxAgeSeconds = 60 * 30;
const analyticsHashSecret = process.env.ORULZIP_ANALYTICS_HASH_SECRET || adminSessionSecret;
const deployedAtKst = process.env.ORULZIP_DEPLOYED_AT_KST || "local";
const deployCommitSha = normalizeCommitSha(process.env.ORULZIP_COMMIT_SHA) || readLocalCommitSha() || "unknown";
const deployVersionText = `v ${deployedAtKst} · ${deployCommitSha}`;
const recentDeployCommits = parseRecentCommitJson(process.env.ORULZIP_RECENT_COMMITS_JSON) || readLocalRecentCommits();
const regionSeoRoutes = new Map([
  ["/regions/seoul", {
    title: "서울 아파트 실거래가 상승률 지도 | 오를집",
    description: "서울 아파트 실거래가를 기준으로 강남구·송파구·마포구 등 지역별 상승률과 아파트 랭킹을 지도에서 확인하세요.",
    canonicalPath: "/regions/seoul"
  }],
  ["/regions/gyeonggi", {
    title: "경기 아파트 실거래가 상승률 지도 | 오를집",
    description: "경기도 아파트 실거래가 상승률을 시군구·동·아파트 단위로 비교하고 상승률 랭킹을 확인하세요.",
    canonicalPath: "/regions/gyeonggi"
  }],
  ["/regions/incheon", {
    title: "인천 아파트 실거래가 상승률 지도 | 오를집",
    description: "인천 아파트 실거래가 기반 상승률과 지역별 아파트 랭킹을 지도에서 확인하세요.",
    canonicalPath: "/regions/incheon"
  }],
  ["/regions/busan", {
    title: "부산 아파트 실거래가 상승률 지도 | 오를집",
    description: "부산 아파트 실거래가 상승률을 지역별 지도와 아파트 랭킹으로 확인하세요.",
    canonicalPath: "/regions/busan"
  }],
  ["/regions/daegu", {
    title: "대구 아파트 실거래가 상승률 지도 | 오를집",
    description: "대구 아파트 실거래가 기준 상승률과 아파트 순위를 지도에서 확인하세요.",
    canonicalPath: "/regions/daegu"
  }],
  ["/regions/daejeon", {
    title: "대전 아파트 실거래가 상승률 지도 | 오를집",
    description: "대전 아파트 실거래가 상승률과 지역별 아파트 랭킹을 지도에서 확인하세요.",
    canonicalPath: "/regions/daejeon"
  }]
]);
const routeSeo = new Map([
  ["/", {
    title: "아파트 실거래가 상승률 지도 | 오를집",
    description: "오를집은 국토부 아파트 실거래가를 기준으로 지역별 상승률, 평당가 변화, 아파트 랭킹을 지도에서 확인하는 부동산 데이터 서비스입니다.",
    canonicalPath: "/map"
  }],
  ["/map", {
    title: "아파트 실거래가 상승률 지도 | 오를집",
    description: "국토부 아파트 실거래가를 기준으로 전국·지역별 상승률을 시도, 시군구, 동, 아파트 단위 지도에서 확인하세요.",
    canonicalPath: "/map"
  }],
  ["/molit-map", {
    title: "아파트 실거래가 상승률 지도 | 오를집",
    description: "국토부 아파트 실거래가 기반 상승률 지도와 지역별 아파트 랭킹을 확인하세요.",
    canonicalPath: "/map"
  }],
  ["/apartment-rankings", {
    title: "아파트 실거래가 상승률 랭킹 | 오를집",
    description: "3개월, 6개월, 1년, 3년, 5년 기준 국토부 아파트 실거래가 상승률과 평당가 변화를 랭킹으로 확인하세요.",
    canonicalPath: "/apartment-rankings"
  }],
  ["/price-bands", {
    title: "아파트 실거래가 상승률 랭킹 | 오를집",
    description: "국토부 아파트 실거래가 기반 상승률 랭킹과 평당가 변화를 확인하세요.",
    canonicalPath: "/apartment-rankings"
  }],
  ["/neighborhood", {
    title: "동네별 아파트 실거래가 상승률 랭킹 | 오를집",
    description: "동네별 아파트 실거래가 상승률과 평당가격 변화를 그래프와 랭킹으로 확인하세요.",
    canonicalPath: "/neighborhood",
    robots: "noindex,nofollow"
  }],
  ["/kb-map", {
    title: "KB시세 지도 - 오를집",
    description: "내부 검토용 KB시세 지도입니다.",
    canonicalPath: "/kb-map",
    robots: "noindex,nofollow"
  }],
  ["/formula", {
    title: "시세식 분석 - 오를집",
    description: "내부 검토용 시세식 분석 화면입니다.",
    canonicalPath: "/formula",
    robots: "noindex,nofollow"
  }],
  ["/terms", {
    title: "용어 - 오를집",
    description: "오를집 내부 용어 정리 화면입니다.",
    canonicalPath: "/terms",
    robots: "noindex,nofollow"
  }],
  ["/design", {
    title: "디자인 - 오를집",
    description: "오를집 내부 디자인 설정 화면입니다.",
    canonicalPath: "/design",
    robots: "noindex,nofollow"
  }],
  ["/crawl", {
    title: "수집현황 - 오를집",
    description: "오를집 내부 수집 현황 화면입니다.",
    canonicalPath: "/crawl",
    robots: "noindex,nofollow"
  }],
  ["/analytics", {
    title: "방문분석 - 오를집",
    description: "오를집 내부 방문 분석 화면입니다.",
    canonicalPath: "/analytics",
    robots: "noindex,nofollow"
  }]
]);

if (shouldInitDb) {
  await initDb();
  await initAnalyticsDb();
} else {
  console.log("Skipping database initialization because ORULZIP_DB_INIT=0");
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const normalizedPath = normalizeRoute(url.pathname);
    const isAdmin = isAdminRequest(req);
    const requestAnalyticsHost = analyticsRequestHost(req);
    const requestAnalyticsEnvironment = analyticsEnvironmentForHost(requestAnalyticsHost);

    if (url.pathname === "/api/admin/session") {
      return json(res, { authenticated: isAdmin });
    }

    if (normalizedPath === "/price-bands") {
      return redirectPermanent(res, `/apartment-rankings${url.search || ""}`);
    }

    if (url.pathname === "/sitemap.xml") {
      return xml(res, await renderSitemapXml());
    }

    if (url.pathname === "/analytics/exclude-me") {
      const cookies = parseCookies(req.headers.cookie || "");
      const visitorId = analyticsVisitorId(cookies);
      await markAnalyticsVisitorInternal(visitorId, { reason: "manual_exclude" });
      res.writeHead(302, {
        "Set-Cookie": createAnalyticsCookie(analyticsVisitorCookieName, visitorId, analyticsVisitorMaxAgeSeconds),
        Location: "/map"
      });
      res.end();
      return;
    }

    if (url.pathname === "/api/analytics/event" && req.method === "POST") {
      const body = await readLimitedJsonBody(req, 16 * 1024);
      const cookies = parseCookies(req.headers.cookie || "");
      const result = await recordAnalyticsEvent({
        visitorId: cookies[analyticsVisitorCookieName],
        sessionId: cookies[analyticsSessionCookieName],
        eventName: body.eventName,
        path: body.path,
        title: body.title,
        referrer: body.referrer,
        metadata: body.metadata,
        userInfo: {
          ...(body.userInfo && typeof body.userInfo === "object" && !Array.isArray(body.userInfo) ? body.userInfo : {}),
          ...analyticsRequestUserInfo(req)
        },
        host: requestAnalyticsHost,
        environment: requestAnalyticsEnvironment,
        ipHash: analyticsIpHash(req),
        userAgent: req.headers["user-agent"] || "",
        isAdmin
      });
      const visitorAlert = {
        ...result,
        url: analyticsPublicUrl(result.path)
      };
      if (shouldNotifyExternalVisitorVisit(visitorAlert)) {
        notifyTelegramExternalVisitorWithSummary(visitorAlert).catch((error) => {
          console.warn("Telegram visitor alert failed:", error?.message || error);
        });
      }
      return json(res, { ok: true }, 200, {
        "Set-Cookie": [
          createAnalyticsCookie(analyticsVisitorCookieName, result.visitorId, analyticsVisitorMaxAgeSeconds),
          createAnalyticsCookie(analyticsSessionCookieName, result.sessionId, analyticsSessionMaxAgeSeconds)
        ]
      });
    }

    if (url.pathname === "/admin-logout" || url.pathname === "/logout") {
      res.writeHead(302, {
        "Set-Cookie": clearAdminCookie(),
        Location: "/map"
      });
      res.end();
      return;
    }

    if (url.pathname === "/admin-login" || url.pathname === "/login") {
      if (req.method === "POST") {
        const body = await readFormBody(req);
        const nextPath = safeNextPath(body.next || url.searchParams.get("next") || "/map");
        if (isValidAdminLogin(body.username, body.password)) {
          const cookies = parseCookies(req.headers.cookie || "");
          const visitorId = analyticsVisitorId(cookies);
          await markAnalyticsVisitorInternal(visitorId, { reason: "admin_login" });
          res.writeHead(302, {
            "Set-Cookie": [
              createAdminCookie(),
              createAnalyticsCookie(analyticsVisitorCookieName, visitorId, analyticsVisitorMaxAgeSeconds)
            ],
            Location: nextPath
          });
          res.end();
          return;
        }
        return html(res, renderAdminLoginPage({ nextPath, error: "아이디 또는 비밀번호가 올바르지 않습니다." }), 401);
      }

      const nextPath = safeNextPath(url.searchParams.get("next") || "/map");
      if (isAdmin) {
        res.writeHead(302, { Location: nextPath });
        res.end();
        return;
      }
      return html(res, renderAdminLoginPage({ nextPath }));
    }

    if (protectedApiRoutes.has(url.pathname) && !isAdmin) {
      return json(res, { error: "Admin login required." }, 401);
    }

    if (protectedAppRoutes.has(normalizedPath) && !isAdmin) {
      res.writeHead(302, { Location: `/login?next=${encodeURIComponent(normalizedPath)}` });
      res.end();
      return;
    }

    if (readOnlyMode && writeApiRoutes.has(url.pathname)) {
      return json(res, { error: "Read-only mode is enabled." }, 403);
    }

    if (url.pathname === "/api/analytics/summary") {
      return json(res, await readAnalyticsSummary({
        days: Number(url.searchParams.get("days") || 7),
        includeAdmin: url.searchParams.get("includeAdmin") === "1",
        includeInternal: url.searchParams.get("includeInternal") === "1",
        environment: analyticsRequestedEnvironment(url.searchParams.get("environment"), requestAnalyticsEnvironment)
      }));
    }

    if (url.pathname === "/api/analytics/visitors") {
      return json(res, await readAnalyticsVisitors({
        days: Number(url.searchParams.get("days") || 7),
        includeAdmin: url.searchParams.get("includeAdmin") === "1",
        includeInternal: url.searchParams.get("includeInternal") === "1",
        environment: analyticsRequestedEnvironment(url.searchParams.get("environment"), requestAnalyticsEnvironment),
        limit: Number(url.searchParams.get("limit") || 100)
      }));
    }

    if (url.pathname === "/api/filters") {
      const filters = await readFilterOptions({
        regionId: url.searchParams.get("regionId") || ""
      });
      return json(res, {
        regions,
        regionStats: filters.regionStats,
        months: filters.months,
        neighborhoods: filters.neighborhoods
      });
    }

    if (url.pathname === "/api/status") {
      const status = await readStatusOverview();
      const payload = {
        meta: status.meta,
        counts: status.counts,
        months: status.months
      };
      if (isAdmin) {
        payload.crawl = serializeCrawlStatus(status.crawl);
        payload.mapCache = status.mapCache;
        payload.overviewCache = status.overviewCache;
      }
      return json(res, payload);
    }

    if (url.pathname === "/api/client-config") {
      const naverKeyId = process.env.NAVER_MAP_NCP_KEY_ID || "";
      const naverDisabled = process.env.NAVER_MAP_DISABLED === "1";
      return json(res, {
        maps: {
          provider: naverKeyId && !naverDisabled ? "naver" : "leaflet",
          naverKeyId
        }
      });
    }

    if (url.pathname === "/api/map-search") {
      return json(res, await searchMapTargets({
        q: url.searchParams.get("q") || "",
        limit: Number(url.searchParams.get("limit") || 12)
      }));
    }

    if (url.pathname === "/api/crawl/details") {
      const details = await crawlDetails({
        status: url.searchParams.get("status") || "",
        limit: Number(url.searchParams.get("limit") || 200)
      });
      return json(res, serializeCrawlDetails(details));
    }

    if (url.pathname === "/api/molit/status") {
      return json(res, await tradeCollectionStatus({
        limit: Number(url.searchParams.get("limit") || 30)
      }));
    }

    if (url.pathname === "/api/molit/coordinate-audit") {
      return json(res, await readMolitCoordinateAudit({
        limit: Number(url.searchParams.get("limit") || 50)
      }));
    }

    if (url.pathname === "/api/molit/duplicate-audit") {
      return json(res, await readMolitDuplicateAudit({
        limit: Number(url.searchParams.get("limit") || 50)
      }));
    }

    if (url.pathname === "/api/formula-analysis") {
      return json(res, await buildFormulaAnalysis({
        target: url.searchParams.get("target") || "seoul",
        start: url.searchParams.get("start") || "",
        end: url.searchParams.get("end") || "",
        limit: Number(url.searchParams.get("limit") || 15000)
      }));
    }

    if ((url.pathname === "/api/crawl/start" || url.pathname === "/api/sync") && ["POST", "GET"].includes(req.method)) {
      const body = req.method === "POST" ? await readJsonBody(req) : {};
      const regionId = body.regionId || url.searchParams.get("regionId") || "bundang";
      const job = await createCrawlJob({
        regionId,
        maxComplexes: Number(body.maxComplexes || url.searchParams.get("maxComplexes") || 100),
        yearsBack: Number(body.yearsBack || url.searchParams.get("yearsBack") || 10),
        maxAreaTypesPerComplex: Number(body.maxAreaTypesPerComplex || url.searchParams.get("maxAreaTypesPerComplex") || 2),
        maxTiles: Number(body.maxTiles || url.searchParams.get("maxTiles") || 50),
        delayMinMs: Number(body.delayMinMs || url.searchParams.get("delayMinMs") || 15000),
        delayMaxMs: Number(body.delayMaxMs || url.searchParams.get("delayMaxMs") || 60000)
      });
      return json(res, { job: serializeJob(job) });
    }

    if (url.pathname === "/api/neighborhood-rankings") {
      const dataset = await readDatasetFromDb();
      return json(res, buildNeighborhoodRankings(dataset, queryFilters(url)));
    }

    if (url.pathname === "/api/neighborhood-chart") {
      const dataset = await readDatasetFromDb();
      return json(res, buildNeighborhoodChart(dataset, queryFilters(url)));
    }

    if (url.pathname === "/api/price-band-rankings") {
      const filters = queryFilters(url);
      const basis = url.searchParams.get("basis") || "start";
      const bandKey = url.searchParams.get("bandKey") || "";
      const startBandKey = url.searchParams.get("startBandKey") || "";
      const endBandKey = url.searchParams.get("endBandKey") || "";
      const areaBandKey = url.searchParams.get("areaBandKey") || "all";
      const page = Number(url.searchParams.get("page") || 1);
      const pageSize = Number(url.searchParams.get("pageSize") || 50);
      return json(res, await readPriceBandRankPage({
        source: "molit",
        basis,
        startMonth: filters.start,
        endMonth: filters.end,
        bandKey,
        startBandKey,
        endBandKey,
        areaBandKey,
        minHouseholdCount: filters.minHouseholdCount,
        environment: requestAnalyticsEnvironment,
        page,
        pageSize
      }));
    }

    if (url.pathname === "/api/zoom-map-summary") {
      const filters = {
        source: "kb",
        zoom: Number(url.searchParams.get("zoom") || 9),
        start: url.searchParams.get("start") || "",
        end: url.searchParams.get("end") || "",
        north: optionalNumber(url.searchParams.get("north")),
        south: optionalNumber(url.searchParams.get("south")),
        east: optionalNumber(url.searchParams.get("east")),
        west: optionalNumber(url.searchParams.get("west")),
        dongKey: url.searchParams.get("dongKey") || "",
        sigunguCode: url.searchParams.get("sigunguCode") || "",
        sidoCode: url.searchParams.get("sidoCode") || "",
        rankingScope: url.searchParams.get("rankingScope") || "",
        minHouseholdCount: minHouseholdCountFromUrl(url, 0),
        environment: requestAnalyticsEnvironment
      };
      const cached = await readCachedZoomMapSummary(filters);
      if (cached) return json(res, cached);

      const dataset = await readDatasetFromDb();
      return json(res, {
        ...buildZoomMapSummary(dataset, filters),
        cache: { hit: false, updatedAt: null }
      });
    }

    if (url.pathname === "/api/molit-zoom-map-summary") {
      const filters = {
        source: "molit",
        zoom: Number(url.searchParams.get("zoom") || 9),
        start: url.searchParams.get("start") || "",
        end: url.searchParams.get("end") || "",
        north: optionalNumber(url.searchParams.get("north")),
        south: optionalNumber(url.searchParams.get("south")),
        east: optionalNumber(url.searchParams.get("east")),
        west: optionalNumber(url.searchParams.get("west")),
        dongKey: url.searchParams.get("dongKey") || "",
        sigunguCode: url.searchParams.get("sigunguCode") || "",
        sidoCode: url.searchParams.get("sidoCode") || "",
        rankingScope: url.searchParams.get("rankingScope") || "",
        minHouseholdCount: minHouseholdCountFromUrl(url),
        environment: requestAnalyticsEnvironment
      };
      const cached = await readCachedZoomMapSummary(filters);
      return json(res, cached || {
        level: zoomAggregationLevel(filters.zoom),
        zoom: filters.zoom,
        period: { startMonth: filters.start, endMonth: filters.end },
        cache: { hit: false, source: "molit", minHouseholdCount: filters.minHouseholdCount, updatedAt: null },
        items: []
      });
    }

    if (url.pathname === "/api/apartment-detail") {
      const dataset = await readDatasetFromDb();
      const apartmentId = url.searchParams.get("apartmentId") || "";
      return json(res, await buildApartmentDetail(dataset, apartmentId, {
        source: "kb",
        startMonth: url.searchParams.get("start") || "",
        endMonth: url.searchParams.get("end") || ""
      }));
    }

    if (url.pathname === "/api/molit-apartment-detail") {
      const apartmentId = url.searchParams.get("apartmentId") || "";
      const detail = await buildMolitApartmentDetail(apartmentId);
      return json(res, await attachApartmentRankSummary(detail, {
        source: "molit",
        apartmentId,
        startMonth: url.searchParams.get("start") || "",
        endMonth: url.searchParams.get("end") || "",
        minHouseholdCount: minHouseholdCountFromUrl(url)
      }));
    }

    return await serveStatic(url.pathname, res, {
      environment: requestAnalyticsEnvironment
    });
  } catch (error) {
    const status = Number(error.statusCode || 500);
    return json(res, { error: error.message }, status >= 400 && status < 600 ? status : 500);
  }
});

server.listen(port, host, () => {
  console.log(`Apartment growth MVP running at http://${host}:${port}`);
});

function queryFilters(url) {
  return {
    regionId: url.searchParams.get("regionId") || "",
    neighborhood: url.searchParams.get("neighborhood") || "",
    start: url.searchParams.get("start") || "",
    end: url.searchParams.get("end") || "",
    minHouseholdCount: minHouseholdCountFromUrl(url)
  };
}

function minHouseholdCountFromUrl(url, fallback = DEFAULT_ACTIVE_MIN_HOUSEHOLD_COUNT) {
  const number = Number(url.searchParams.get("minHouseholdCount"));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.floor(number));
}

function buildZoomMapSummary(dataset, filters) {
  const ranking = buildApartmentRankings(dataset, {
    start: filters.start,
    end: filters.end
  });
  const apartmentById = new Map(dataset.apartments.map((item) => [item.id, item]));
  const rows = ranking.rows
    .map((row) => ({
      ...row,
      apartment: apartmentById.get(row.apartmentId)
    }))
    .filter((row) => row.apartment?.legalDongCode && Number.isFinite(row.apartment.lat) && Number.isFinite(row.apartment.lng));
  const level = zoomAggregationLevel(filters.zoom);

  return {
    level,
    zoom: filters.zoom,
    period: ranking.period,
    items: level === "apartment"
      ? summarizeZoomApartments({ rows, dataset, filters }).slice(0, 2000)
      : rankZoomGroups(summarizeZoomGroups(rows, level), level)
        .filter((item) => withinBounds(item, filters))
        .map((item) => ({ ...item, type: "group" }))
  };
}

function zoomAggregationLevel(zoom) {
  if (zoom >= 16) return "apartment";
  if (zoom >= 13) return "dong";
  if (zoom >= 11) return "sigungu";
  return "sido";
}

function withinBounds(apartment, filters) {
  const hasBounds = [filters.north, filters.south, filters.east, filters.west].every(Number.isFinite);
  if (!hasBounds) return true;
  return apartment.lat <= filters.north
    && apartment.lat >= filters.south
    && apartment.lng <= filters.east
    && apartment.lng >= filters.west;
}

function optionalNumber(value) {
  if (value === null || value === "") return null;
  return Number(value);
}

function summarizeZoomGroups(rows, level) {
  const groups = new Map();
  for (const row of rows) {
    const group = zoomGroupInfo(row, rows, level);
    if (!groups.has(group.code)) {
      groups.set(group.code, {
        code: group.code,
        name: group.name,
        hierarchy: group.hierarchy || {},
        latValues: [],
        lngValues: [],
        growthRates: [],
        growthAmounts: [],
        apartmentIds: new Set(),
        areaCount: 0
      });
    }
    const current = groups.get(group.code);
    current.latValues.push(row.apartment.lat);
    current.lngValues.push(row.apartment.lng);
    current.growthRates.push(row.growthRate);
    current.growthAmounts.push(row.growthAmount);
    current.apartmentIds.add(row.apartmentId);
    current.areaCount += 1;
  }

  return [...groups.values()]
    .map((group) => ({
      code: group.code,
      name: group.name,
      sidoCode: group.hierarchy.sidoCode || group.code.slice(0, 2),
      sidoName: group.hierarchy.sidoName || sidoName(group.code.slice(0, 2)),
      sigunguCode: group.hierarchy.sigunguCode || (level !== "sido" ? group.code.slice(0, 5) : ""),
      sigunguName: group.hierarchy.sigunguName || "",
      dongKey: group.hierarchy.dongKey || (level === "dong" ? group.code : ""),
      dongName: group.hierarchy.dongName || "",
      lat: average(group.latValues),
      lng: average(group.lngValues),
      apartmentCount: group.apartmentIds.size,
      areaCount: group.areaCount,
      growthRate: average(group.growthRates),
      growthAmount: Math.round(average(group.growthAmounts))
    }))
    .sort((a, b) => b.apartmentCount - a.apartmentCount || b.growthRate - a.growthRate);
}

function rankZoomGroups(items, level) {
  if (level === "dong") {
    assignGroupRanks(items, (item) => String(item.code || "").slice(0, 5), "sigunguRank", "sigunguRankTotal");
    assignGroupRanks(items, (item) => String(item.code || "").slice(0, 2), "sidoRank", "sidoRankTotal");
    assignGroupRanks(items, () => "country", "countryRank", "countryRankTotal");
  } else if (level === "sigungu") {
    assignGroupRanks(items, (item) => String(item.code || "").slice(0, 2), "sidoRank", "sidoRankTotal");
    assignGroupRanks(items, () => "country", "countryRank", "countryRankTotal");
  } else if (level === "sido") {
    assignGroupRanks(items, () => "country", "countryRank", "countryRankTotal");
  }
  return items;
}

function assignGroupRanks(items, keyOf, rankField, totalField) {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item) || "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  for (const group of groups.values()) {
    group
      .sort((a, b) => {
        const rateDiff = sortableRate(b.growthRate) - sortableRate(a.growthRate);
        if (rateDiff) return rateDiff;
        return String(a.name || "").localeCompare(String(b.name || ""), "ko");
      })
      .forEach((item, index) => {
        item[rankField] = index + 1;
        item[totalField] = group.length;
      });
  }
}

function zoomGroupInfo(row, rows, level) {
  const code = row.apartment.legalDongCode || "";
  const hierarchy = hierarchyFromApartment(row.apartment, rows);
  if (level === "sido") {
    const sidoCode = code.slice(0, 2);
    return {
      code: sidoCode,
      name: hierarchy.sidoName || sidoName(sidoCode),
      hierarchy: {
        sidoCode,
        sidoName: hierarchy.sidoName || sidoName(sidoCode)
      }
    };
  }
  if (level === "sigungu") {
    const sigunguCode = code.slice(0, 5);
    return {
      code: sigunguCode,
      name: hierarchy.sigunguName || sigunguName(rows, sigunguCode),
      hierarchy: {
        sidoCode: hierarchy.sidoCode,
        sidoName: hierarchy.sidoName,
        sigunguCode,
        sigunguName: hierarchy.sigunguName || sigunguName(rows, sigunguCode)
      }
    };
  }
  const dongCode = code.slice(0, 8) || `${row.apartment.address}:${row.apartment.neighborhoodName}`;
  return {
    code: dongCode,
    name: hierarchy.dongDisplayName || zoomDongName(row.apartment),
    hierarchy
  };
}

function hierarchyFromApartment(apartment, rows = []) {
  const code = apartment.legalDongCode || "";
  const sidoCode = code.slice(0, 2);
  const sigunguCode = code.slice(0, 5);
  const sigungu = sigunguName(rows, sigunguCode);
  const dong = apartment.neighborhoodName || "미분류";
  return {
    sidoCode,
    sidoName: sidoName(sidoCode),
    sigunguCode,
    sigunguName: sigungu,
    dongKey: code.slice(0, 8) || `${apartment.address}:${dong}`,
    dongName: dong,
    dongDisplayName: sigungu && !String(dong).startsWith(sigungu)
      ? `${sigungu} ${dong}`
      : dong
  };
}

function zoomDongName(apartment) {
  const neighborhood = apartment.neighborhoodName || "미분류";
  const addressParts = String(apartment.address || "").split(" ").filter(Boolean);
  const sigungu = addressParts.slice(1).find((part) => /구$|시$|군$/.test(part));
  return sigungu ? `${sigungu} ${neighborhood}` : neighborhood;
}

function summarizeZoomApartments({ rows, dataset, filters }) {
  const summarized = summarizeApartments(rows).map((item) => ({
    ...item,
    hasData: true,
    type: "apartment"
  }));
  const includedIds = new Set(summarized.map((item) => item.id));
  const missing = dataset.apartments
    .filter((apartment) => apartment?.legalDongCode && Number.isFinite(apartment.lat) && Number.isFinite(apartment.lng))
    .filter((apartment) => !includedIds.has(apartment.id))
    .map((apartment) => ({
      id: apartment.id,
      name: apartment.name,
      neighborhoodName: apartment.neighborhoodName,
      legalDongCode: apartment.legalDongCode,
      address: apartment.address,
      lat: apartment.lat,
      lng: apartment.lng,
      areaCount: 0,
      areaSummary: "데이터없음",
      growthRate: null,
      growthAmount: null,
      startPyeongPrice: null,
      endPyeongPrice: null,
      hasData: false,
      type: "apartment"
    }));

  return rankApartmentItemsByDong([...summarized, ...missing])
    .filter((item) => withinBounds(item, filters))
    .sort((a, b) => Number(b.hasData) - Number(a.hasData) || sortableRate(b.growthRate) - sortableRate(a.growthRate));
}

function rankApartmentItemsByDong(items) {
  const groups = new Map();
  for (const item of items) {
    const key = item.legalDongCode || `${item.address || ""}:${item.neighborhoodName || "미분류"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  for (const group of groups.values()) {
    group
      .sort((a, b) => {
        if ((a.hasData !== false) !== (b.hasData !== false)) return a.hasData === false ? 1 : -1;
        const rateDiff = sortableRate(b.growthRate) - sortableRate(a.growthRate);
        if (rateDiff) return rateDiff;
        return String(a.name || "").localeCompare(String(b.name || ""), "ko");
      })
      .forEach((item, index) => {
        item.dongRank = index + 1;
        item.dongRankTotal = group.length;
      });
  }

  return items;
}

function summarizeApartments(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.apartmentId)) {
      groups.set(row.apartmentId, {
        apartment: row.apartment,
        areaLabels: [],
        growthRates: [],
        growthAmounts: [],
        startPrices: [],
        endPrices: []
      });
    }
    const group = groups.get(row.apartmentId);
    group.areaLabels.push(row.areaLabel);
    group.growthRates.push(row.growthRate);
    group.growthAmounts.push(row.growthAmount);
    group.startPrices.push(row.startPyeongPrice);
    group.endPrices.push(row.endPyeongPrice);
  }

  return [...groups.values()]
    .map((group) => ({
      id: group.apartment.id,
      name: group.apartment.name,
      neighborhoodName: group.apartment.neighborhoodName,
      legalDongCode: group.apartment.legalDongCode,
      address: group.apartment.address,
      lat: group.apartment.lat,
      lng: group.apartment.lng,
      areaCount: group.areaLabels.length,
      areaSummary: group.areaLabels.slice(0, 3).join(", "),
      growthRate: average(group.growthRates),
      growthAmount: Math.round(average(group.growthAmounts)),
      startPyeongPrice: Math.round(average(group.startPrices)),
      endPyeongPrice: Math.round(average(group.endPrices))
    }))
    .sort((a, b) => b.growthRate - a.growthRate);
}

function sidoName(code) {
  return {
    11: "서울",
    26: "부산",
    27: "대구",
    28: "인천",
    29: "광주",
    30: "대전",
    31: "울산",
    36: "세종",
    41: "경기",
    42: "강원",
    43: "충북",
    44: "충남",
    45: "전북",
    46: "전남",
    47: "경북",
    48: "경남",
    50: "제주",
    51: "강원",
    52: "전북"
  }[code] || code || "미분류";
}

function sigunguName(rows, code) {
  const row = rows.find((item) => item.apartment.legalDongCode.startsWith(code));
  if (!row) return code || "미분류";
  const address = row.apartment.address || "";
  const neighborhood = row.apartment.neighborhoodName || "";
  const withoutSido = address.split(" ").slice(1);
  const dongIndex = withoutSido.findIndex((part) => part === neighborhood);
  if (dongIndex > 0) return withoutSido.slice(0, dongIndex).join(" ");
  return withoutSido.slice(0, 2).join(" ") || code;
}

function average(values) {
  const clean = values.map(Number).filter(Number.isFinite);
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function sortableRate(rate) {
  const value = Number(rate);
  return Number.isFinite(value) ? value : -Infinity;
}

async function buildApartmentDetail(dataset, apartmentId, rankOptions = {}) {
  const apartment = dataset.apartments.find((item) => item.id === apartmentId);
  if (!apartment) {
    return {
      apartment: null,
      areaTypes: [],
      months: []
    };
  }

  const areaTypes = dataset.areaTypes
    .filter((item) => item.apartmentId === apartment.id)
    .map((areaType) => {
      const prices = dataset.monthlyPrices
        .filter((price) => price.areaTypeId === areaType.id)
        .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
      return {
        id: areaType.id,
        label: areaType.label,
        supplyAreaPyeong: areaType.supplyAreaPyeong,
        exclusiveAreaPyeong: areaType.exclusiveAreaPyeong,
        prices: prices.map((price) => ({
          yearMonth: price.yearMonth,
          saleLow: price.saleLow,
          saleMid: price.saleMid,
          saleHigh: price.saleHigh,
          pyeongPrice: price.pyeongPrice
        }))
      };
    });

  return attachApartmentRankSummary({
    apartment,
    areaTypes,
    months: [...new Set(areaTypes.flatMap((item) => item.prices.map((price) => price.yearMonth)))].sort()
  }, { ...rankOptions, apartmentId });
}

async function attachApartmentRankSummary(detail, {
  source = "kb",
  apartmentId = "",
  startMonth = "",
  endMonth = ""
} = {}) {
  return {
    ...detail,
    rankSummary: await readApartmentMapRankSummary({
      source,
      apartmentId,
      startMonth,
      endMonth
    })
  };
}

function serializeCrawlStatus(crawl) {
  if (!crawl) return null;
  const job = serializeJob(crawl.job);
  const queueCounts = Object.fromEntries(crawl.queue.map((row) => [row.status, row.count]));
  const total = job.totalComplexes || 0;
  const done = (queueCounts.completed || 0) + (queueCounts.failed || 0);
  const trackedQueueByJob = new Map();
  for (const row of crawl.trackedQueue || []) {
    const jobId = Number(row.job_id);
    const counts = trackedQueueByJob.get(jobId) || {};
    counts[row.status] = Number(row.count || 0);
    trackedQueueByJob.set(jobId, counts);
  }
  const trackedRecentByJob = new Map();
  for (const row of crawl.trackedRecent || []) {
    trackedRecentByJob.set(Number(row.job_id), {
      completedLast10Minutes: Number(row.completed_last_10_minutes || 0),
      completedLastHour: Number(row.completed_last_hour || 0),
      completedLastDay: Number(row.completed_last_day || 0)
    });
  }
  const recentLabelsByJob = new Map();
  for (const row of crawl.trackedRecentLabels || []) {
    const jobId = Number(row.job_id);
    const labels = recentLabelsByJob.get(jobId) || [];
    if (labels.length < 3) {
      labels.push({
        label: row.label || "",
        count: Number(row.count || 0)
      });
    }
    recentLabelsByJob.set(jobId, labels);
  }
  return {
    job,
    queueCounts,
    progress: total ? Math.round((done / total) * 1000) / 10 : 0,
    jobProgress: (crawl.trackedJobs || []).map((row) => {
      const trackedJob = serializeJob(row);
      const trackedCounts = trackedQueueByJob.get(trackedJob.id) || {};
      const trackedTotal = trackedJob.totalComplexes || 0;
      const trackedDone = (trackedCounts.completed || 0) + (trackedCounts.failed || 0);
      return {
        job: trackedJob,
        queueCounts: trackedCounts,
        progress: trackedTotal ? Math.round((trackedDone / trackedTotal) * 1000) / 10 : 0,
        recent: {
          completedLast10Minutes: trackedRecentByJob.get(trackedJob.id)?.completedLast10Minutes || 0,
          completedLastHour: trackedRecentByJob.get(trackedJob.id)?.completedLastHour || 0,
          completedLastDay: trackedRecentByJob.get(trackedJob.id)?.completedLastDay || 0,
          topLabels: recentLabelsByJob.get(trackedJob.id) || []
        }
      };
    }),
    logs: crawl.logs.map((row) => ({
      level: row.level,
      message: row.message,
      details: row.details,
      createdAt: row.created_at
    }))
  };
}

function serializeCrawlDetails(details) {
  const queueCounts = Object.fromEntries(details.queueCounts.map((row) => [row.status, row.count]));
  return {
    job: serializeJob(details.job),
    queueCounts,
    rows: details.rows.map((row) => ({
      id: Number(row.id),
      sourceComplexId: Number(row.source_complex_id),
      complexName: row.complex_name || "",
      pyeong: row.pyeong || "",
      markerSaleAvg: row.marker_sale_avg || "",
      markerPyeongPrice: row.marker_pyeong_price || "",
      markerBaseDate: row.marker_base_date || "",
      status: row.status,
      attempts: Number(row.attempts || 0),
      errorMessage: row.error_message || "",
      startedAt: row.started_at,
      completedAt: row.completed_at,
      updatedAt: row.updated_at
    }))
  };
}

function serializeJob(job) {
  if (!job) return null;
  return {
    id: Number(job.id),
    regionId: job.region_id,
    status: job.status,
    maxComplexes: Number(job.max_complexes),
    yearsBack: Number(job.years_back),
    maxAreaTypesPerComplex: Number(job.max_area_types_per_complex),
    maxTiles: Number(job.max_tiles),
    delayMinMs: Number(job.delay_min_ms),
    delayMaxMs: Number(job.delay_max_ms),
    sourceJobId: job.source_job_id ? Number(job.source_job_id) : null,
    totalComplexes: Number(job.total_complexes),
    completedComplexes: Number(job.completed_complexes),
    failedComplexes: Number(job.failed_complexes),
    currentComplexId: job.current_complex_id ? Number(job.current_complex_id) : null,
    currentComplexName: job.current_complex_name,
    errorMessage: job.error_message,
    startedAt: job.started_at,
    finishedAt: job.finished_at,
    createdAt: job.created_at,
    updatedAt: job.updated_at
  };
}

async function serveStatic(pathname, res, { environment = "unknown" } = {}) {
  if (pathname === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }

  const normalizedPath = normalizeRoute(pathname);
  const filePath = isAppRoute(normalizedPath) ? "/index.html" : pathname;
  const absolutePath = join(publicDir, filePath);
  let content;
  try {
    content = await readFile(absolutePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    throw error;
  }
  if (filePath === "/index.html") {
    content = await injectRouteSeo(content.toString("utf8"), normalizedPath);
    content = injectDeployVersion(content, { environment });
  }

  res.writeHead(200, {
    "Content-Type": contentType(filePath),
    "Cache-Control": "no-store"
  });
  res.end(content);
}

function normalizeRoute(pathname) {
  const normalized = String(pathname || "/").replace(/\/+$/, "");
  return normalized || "/";
}

function isAppRoute(routePath) {
  return appRoutes.has(routePath) || regionSeoRoutes.has(routePath) || Boolean(apartmentRouteId(routePath));
}

function apartmentRouteId(routePath) {
  const match = String(routePath || "").match(/^\/apartments\/([^/]+)$/);
  return match ? safeDecodeURIComponent(match[1]).trim() : "";
}

function contentType(filePath) {
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml; charset=utf-8"
  }[extname(filePath)] || "application/octet-stream";
}

async function injectRouteSeo(html, routePath) {
  const seo = await seoForRoute(routePath);
  const canonicalUrl = absoluteUrl(seo.canonicalPath || routePath);
  const title = seo.title;
  const description = seo.description;
  const robots = seo.robots || "index,follow";

  return html
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/s, `<meta name="description" content="${escapeAttribute(description)}">`)
    .replace(/<meta name="robots" content="[^"]*">/s, `<meta name="robots" content="${escapeAttribute(robots)}">`)
    .replace(/<link rel="canonical" href="[^"]*">/s, `<link rel="canonical" href="${escapeAttribute(canonicalUrl)}">`)
    .replace(/<meta property="og:title" content="[^"]*">/s, `<meta property="og:title" content="${escapeAttribute(title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/s, `<meta property="og:description" content="${escapeAttribute(description)}">`)
    .replace(/<meta property="og:url" content="[^"]*">/s, `<meta property="og:url" content="${escapeAttribute(canonicalUrl)}">`)
    .replace(/<meta name="twitter:title" content="[^"]*">/s, `<meta name="twitter:title" content="${escapeAttribute(title)}">`)
    .replace(/<meta name="twitter:description" content="[^"]*">/s, `<meta name="twitter:description" content="${escapeAttribute(description)}">`);
}

async function seoForRoute(routePath) {
  if (routeSeo.has(routePath)) return routeSeo.get(routePath);
  if (regionSeoRoutes.has(routePath)) return regionSeoRoutes.get(routePath);
  const apartmentId = apartmentRouteId(routePath);
  if (apartmentId) return apartmentSeo(apartmentId);
  return routeSeo.get("/map");
}

async function apartmentSeo(apartmentId) {
  try {
    const result = await query(`
      select
        id,
        apt_name,
        legal_dong,
        address,
        sido_name,
        sigungu_name,
        dong_name,
        build_year,
        deal_count
      from molit_complexes
      where id = $1
      limit 1
    `, [apartmentId]);
    const row = result.rows[0];
    if (!row) {
      return {
        title: "아파트 실거래가 상세 | 오를집",
        description: "오를집에서 아파트 실거래가 상승률 지도와 랭킹을 확인하세요.",
        canonicalPath: apartmentCanonicalPath(apartmentId),
        robots: "noindex,follow"
      };
    }

    const location = apartmentLocationText(row);
    const locationPrefix = location ? `${location} ` : "";
    const details = [
      row.build_year ? `${row.build_year}년 준공` : "",
      Number(row.deal_count) > 0 ? `실거래 ${Number(row.deal_count).toLocaleString("ko-KR")}건` : ""
    ].filter(Boolean).join(", ");
    return {
      title: `${row.apt_name} 아파트 실거래가·상승률 | 오를집`,
      description: `${locationPrefix}${row.apt_name} 아파트 매매 실거래가, 평당가 변화와 상승률 랭킹을 확인하세요.${details ? ` ${details}.` : ""}`,
      canonicalPath: apartmentCanonicalPath(row.id)
    };
  } catch (error) {
    console.warn("Apartment SEO lookup failed:", error?.message || error);
    return {
      title: "아파트 실거래가 상세 | 오를집",
      description: "오를집에서 아파트 실거래가 상승률 지도와 랭킹을 확인하세요.",
      canonicalPath: apartmentCanonicalPath(apartmentId),
      robots: "noindex,follow"
    };
  }
}

function apartmentLocationText(row) {
  const sidoName = String(row.sido_name || "").trim();
  const sigunguName = stripSidoPrefix(row.sigungu_name, sidoName);
  const parts = [sidoName, sigunguName, row.dong_name || row.legal_dong]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  if (parts.length) return parts.join(" ");
  return String(row.address || "").split(/\s+/).filter(Boolean).slice(0, 3).join(" ");
}

function stripSidoPrefix(sigunguName, sidoName) {
  const sigungu = String(sigunguName || "").trim();
  const sido = String(sidoName || "").trim();
  if (!sigungu || !sido) return sigungu;
  const [firstPart, ...rest] = sigungu.split(/\s+/);
  if (sameSidoName(firstPart, sido) && rest.length) return rest.join(" ");
  return sigungu;
}

function sameSidoName(left, right) {
  return normalizeSidoName(left) === normalizeSidoName(right);
}

function normalizeSidoName(value) {
  const aliases = new Map([
    ["서울특별시", "서울"],
    ["부산광역시", "부산"],
    ["대구광역시", "대구"],
    ["인천광역시", "인천"],
    ["광주광역시", "광주"],
    ["대전광역시", "대전"],
    ["울산광역시", "울산"],
    ["세종특별자치시", "세종"],
    ["경기도", "경기"],
    ["강원특별자치도", "강원"],
    ["강원도", "강원"],
    ["충청북도", "충북"],
    ["충청남도", "충남"],
    ["전북특별자치도", "전북"],
    ["전라북도", "전북"],
    ["전라남도", "전남"],
    ["경상북도", "경북"],
    ["경상남도", "경남"],
    ["제주특별자치도", "제주"]
  ]);
  const normalized = String(value || "").replace(/\s+/g, "");
  return aliases.get(normalized) || normalized;
}

function injectDeployVersion(html, { environment = "unknown" } = {}) {
  const deployBadgeHidden = environment === "production" ? "hidden" : "";

  return html
    .replaceAll("__ORULZIP_DEPLOY_BADGE_HIDDEN__", deployBadgeHidden)
    .replaceAll("__ORULZIP_DEPLOY_VERSION__", escapeHtml(deployVersionText))
    .replaceAll("__ORULZIP_DEPLOYED_AT__", escapeHtml(`v ${deployedAtKst}`))
    .replaceAll("__ORULZIP_DEPLOY_COMMIT__", escapeHtml(deployCommitSha))
    .replaceAll("__ORULZIP_DEPLOY_COPY_TEXT__", escapeAttribute(deployVersionText))
    .replaceAll("__ORULZIP_RECENT_COMMITS__", escapeAttribute(JSON.stringify(recentDeployCommits)));
}

function absoluteUrl(pathname) {
  return `${siteOrigin}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function apartmentCanonicalPath(apartmentId) {
  return `/apartments/${encodeURIComponent(apartmentId)}`;
}

async function renderSitemapXml() {
  const entries = [
    sitemapUrlEntry("/map", { priority: "1.0" }),
    sitemapUrlEntry("/apartment-rankings", { priority: "0.9" }),
    ...Array.from(regionSeoRoutes.keys()).map((path) => sitemapUrlEntry(path, { priority: "0.8" }))
  ];

  try {
    const result = await query(`
      with latest as (
        select id
        from map_growth_snapshots
        where source = 'molit'
          and period_years = 1
          and min_household_count = $1
        order by end_month desc, updated_at desc
        limit 1
      )
      select
        mgi.apartment_id,
        max(mgi.updated_at) as updated_at
      from map_growth_items mgi
      join latest on latest.id = mgi.snapshot_id
      where mgi.level = 'apartment'
        and mgi.apartment_id is not null
        and mgi.has_data = true
      group by mgi.apartment_id
      order by max(mgi.growth_rate) desc nulls last, min(mgi.item_name) asc
      limit 1000
    `, [DEFAULT_ACTIVE_MIN_HOUSEHOLD_COUNT]);

    for (const row of result.rows) {
      entries.push(sitemapUrlEntry(apartmentCanonicalPath(row.apartment_id), {
        priority: "0.6",
        lastmod: row.updated_at ? new Date(row.updated_at).toISOString().slice(0, 10) : ""
      }));
    }
  } catch (error) {
    console.warn("Dynamic sitemap apartment URLs failed:", error?.message || error);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>`;
}

function sitemapUrlEntry(pathname, { changefreq = "daily", priority = "0.7", lastmod = "" } = {}) {
  return `  <url>
    <loc>${escapeXml(absoluteUrl(pathname))}</loc>${lastmod ? `
    <lastmod>${escapeXml(lastmod)}</lastmod>` : ""}
    <changefreq>${escapeXml(changefreq)}</changefreq>
    <priority>${escapeXml(priority)}</priority>
  </url>`;
}

function normalizeCommitSha(value) {
  const match = String(value || "").match(/[0-9a-f]{7,40}/i);
  return match ? match[0].slice(0, 7) : "";
}

function readLocalCommitSha() {
  try {
    return normalizeCommitSha(execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
      cwd: __dirname,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }));
  } catch {
    return "";
  }
}

function parseRecentCommitJson(value) {
  try {
    const commits = JSON.parse(String(value || ""));
    if (!Array.isArray(commits)) return null;
    return sanitizeRecentCommits(commits);
  } catch {
    return null;
  }
}

function readLocalRecentCommits() {
  try {
    const output = execFileSync("git", ["log", "-5", "--pretty=format:%h%x09%cI%x09%s"], {
      cwd: __dirname,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    const commits = output.split("\n").filter(Boolean).map((line) => {
      const [sha, committedAt, ...subjectParts] = line.split("\t");
      return { sha, committedAt, subject: subjectParts.join("\t") };
    });
    return sanitizeRecentCommits(commits);
  } catch {
    return [];
  }
}

function sanitizeRecentCommits(commits) {
  return commits
    .map((commit) => ({
      sha: normalizeCommitSha(commit?.sha),
      committedAt: String(commit?.committedAt || ""),
      subject: String(commit?.subject || "").slice(0, 120)
    }))
    .filter((commit) => commit.sha)
    .slice(0, 5);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function escapeXml(value) {
  return escapeAttribute(value).replace(/'/g, "&apos;");
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return String(value || "");
  }
}

function isAdminRequest(req) {
  const token = parseCookies(req.headers.cookie || "")[adminCookieName];
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = signAdminPayload(payload);
  if (!timingSafeEqual(signature, expected)) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return session.user === adminUser && Number(session.exp || 0) > Date.now();
  } catch {
    return false;
  }
}

function isValidAdminLogin(username, password) {
  if (!adminPassword) return false;
  return timingSafeEqual(String(username || ""), adminUser)
    && timingSafeEqual(String(password || ""), adminPassword);
}

function createAdminCookie() {
  const payload = Buffer.from(JSON.stringify({
    user: adminUser,
    exp: Date.now() + adminSessionMaxAgeSeconds * 1000
  })).toString("base64url");
  const token = `${payload}.${signAdminPayload(payload)}`;
  return [
    `${adminCookieName}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${adminSessionMaxAgeSeconds}`,
    adminCookieSecure ? "Secure" : ""
  ].filter(Boolean).join("; ");
}

function clearAdminCookie() {
  return [
    `${adminCookieName}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    adminCookieSecure ? "Secure" : ""
  ].filter(Boolean).join("; ");
}

function createAnalyticsCookie(name, value, maxAgeSeconds) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    adminCookieSecure ? "Secure" : ""
  ].filter(Boolean).join("; ");
}

function analyticsVisitorId(cookies) {
  const value = String(cookies?.[analyticsVisitorCookieName] || "").trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return value;
  }
  return crypto.randomUUID();
}

function analyticsRequestHost(req) {
  const forwardedHost = firstHeaderValue(req.headers["x-forwarded-host"]);
  const hostHeader = firstHeaderValue(req.headers.host);
  return normalizeAnalyticsHost(forwardedHost || hostHeader);
}

function analyticsPublicUrl(path) {
  try {
    return new URL(path || "/", siteOrigin).toString();
  } catch {
    return `${siteOrigin}/`;
  }
}

async function notifyTelegramExternalVisitorWithSummary(visitorAlert) {
  let summary = null;
  try {
    summary = await readExternalVisitorAlertSummary({ environment: visitorAlert.environment });
  } catch (error) {
    console.warn("Telegram visitor summary failed:", error?.message || error);
  }
  await notifyTelegramExternalVisitor({ ...visitorAlert, summary });
}

function firstHeaderValue(value) {
  const headerValue = Array.isArray(value) ? value[0] : value;
  return String(headerValue || "").split(",")[0].trim();
}

function normalizeAnalyticsHost(value) {
  const hostValue = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0];
  const ipv6Match = hostValue.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (ipv6Match) return ipv6Match[1];
  if (hostValue.includes(":") && hostValue.indexOf(":") === hostValue.lastIndexOf(":")) {
    return hostValue.replace(/:\d+$/, "");
  }
  return hostValue;
}

function analyticsEnvironmentForHost(hostValue) {
  const normalizedHost = normalizeAnalyticsHost(hostValue);
  if (normalizedHost === "dev.orulzip.com") return "development";
  if (normalizedHost === "orulzip.com" || normalizedHost === "www.orulzip.com") return "production";
  if (
    normalizedHost === "localhost"
    || normalizedHost === "127.0.0.1"
    || normalizedHost === "::1"
    || normalizedHost.startsWith("192.168.")
    || normalizedHost.startsWith("10.")
  ) {
    return "local";
  }
  return "unknown";
}

function analyticsRequestedEnvironment(value, fallbackEnvironment) {
  const environment = String(value || "").trim().toLowerCase();
  if (!environment || environment === "current") return fallbackEnvironment || "unknown";
  if (["production", "development", "local", "unknown", "all"].includes(environment)) return environment;
  return fallbackEnvironment || "unknown";
}

function analyticsIpHash(req) {
  const ip = clientIp(req);
  if (!ip) return "";
  return crypto
    .createHmac("sha256", analyticsHashSecret)
    .update(ip)
    .digest("hex");
}

function analyticsRequestUserInfo(req) {
  return compactAnalyticsObject({
    country: firstGeoHeader(req, [
      "cf-ipcountry",
      "cloudfront-viewer-country",
      "x-vercel-ip-country",
      "x-appengine-country",
      "x-geoip-country",
      "x-country-code",
      "x-forwarded-country"
    ]),
    region: firstGeoHeader(req, [
      "cloudfront-viewer-country-region",
      "x-vercel-ip-country-region",
      "x-geoip-region",
      "x-region-code",
      "x-forwarded-region"
    ]),
    city: firstGeoHeader(req, [
      "x-vercel-ip-city",
      "x-geoip-city",
      "x-city",
      "x-forwarded-city"
    ]),
    timezone: firstGeoHeader(req, [
      "cloudfront-viewer-time-zone",
      "x-vercel-ip-timezone",
      "x-timezone"
    ]),
    acceptLanguage: firstHeaderValue(req.headers["accept-language"])
  });
}

function firstGeoHeader(req, names) {
  for (const name of names) {
    const value = decodeHeaderValue(firstHeaderValue(req.headers[name]));
    if (value) return value;
  }
  return "";
}

function decodeHeaderValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    return decodeURIComponent(text.replace(/\+/g, "%20"));
  } catch {
    return text;
  }
}

function compactAnalyticsObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => String(entryValue || "").trim()));
}

function clientIp(req) {
  const forwarded = Array.isArray(req.headers["x-forwarded-for"])
    ? req.headers["x-forwarded-for"][0]
    : req.headers["x-forwarded-for"];
  const firstForwarded = String(forwarded || "").split(",")[0].trim();
  return firstForwarded || req.socket?.remoteAddress || "";
}

function signAdminPayload(payload) {
  return crypto.createHmac("sha256", adminSessionSecret).update(payload).digest("base64url");
}

function parseCookies(cookieHeader) {
  return Object.fromEntries(String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf("=");
      if (index < 0) return [part, ""];
      return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    }));
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function safeNextPath(value) {
  const nextPath = String(value || "/map");
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) return "/map";
  return nextPath;
}

function renderAdminLoginPage({ nextPath = "/map", error = "" } = {}) {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>관리자 로그인 - 오를집</title>
    <style>
      :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f3f4f6; color: #111827; }
      main { width: min(420px, calc(100vw - 32px)); border: 1px solid #e5e7eb; border-radius: 14px; background: #fff; box-shadow: 0 24px 70px rgba(16,24,40,.12); }
      form { display: grid; gap: 14px; padding: 26px; }
      h1 { margin: 0 0 4px; font-size: 24px; letter-spacing: 0; }
      p { margin: 0; color: #667085; font-size: 14px; line-height: 1.45; }
      label { display: grid; gap: 7px; color: #344054; font-size: 13px; font-weight: 800; }
      input { height: 44px; border: 1px solid #d0d5dd; border-radius: 9px; padding: 0 12px; font: inherit; font-size: 15px; }
      button { height: 46px; border: 0; border-radius: 9px; background: #111827; color: #fff; cursor: pointer; font: inherit; font-weight: 900; }
      .error { border: 1px solid #fecaca; border-radius: 9px; background: #fef2f2; color: #b42318; padding: 10px 12px; font-size: 13px; font-weight: 800; }
      a { color: #344054; font-size: 13px; font-weight: 800; text-align: center; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <form method="post" action="/login">
        <div>
          <h1>관리자 로그인</h1>
          <p>오를집 내부 관리 화면에 접근하려면 로그인하세요.</p>
        </div>
        ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
        <input type="hidden" name="next" value="${escapeAttribute(nextPath)}">
        <label>아이디
          <input name="username" autocomplete="username" autofocus>
        </label>
        <label>비밀번호
          <input name="password" type="password" autocomplete="current-password">
        </label>
        <button type="submit">로그인</button>
        <a href="/map">지도로 돌아가기</a>
      </form>
    </main>
  </body>
</html>`;
}

function html(res, body, status = 200) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function json(res, payload, status = 200, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(payload));
}

function xml(res, body, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function redirectPermanent(res, location) {
  res.writeHead(301, {
    Location: location,
    "Cache-Control": "no-store"
  });
  res.end();
}

async function readFormBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString("utf8")));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function readLimitedJsonBody(req, maxBytes) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Invalid JSON body.");
    error.statusCode = 400;
    throw error;
  }
}
