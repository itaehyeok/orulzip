import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { initDb } from "./services/db.js";
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
  readApartmentMapRankSummary,
  readCachedZoomMapSummary
} from "./services/map-growth-cache.js";
import { readMolitCoordinateAudit } from "./services/molit-complex-store.js";
import {
  APARTMENT_RANK_METRICS,
  readApartmentRankPage
} from "./services/apartment-rank-cache.js";
import { readPriceBandRankPage } from "./services/price-band-rank-cache.js";
import {
  buildApartmentAveragePyeongRankings,
  buildApartmentRankings,
  buildNeighborhoodChart,
  buildNeighborhoodRankings,
  buildPriceBandRankings
} from "./services/price-calculator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "public");
const port = Number(process.env.PORT || 3050);
const host = process.env.HOST || "127.0.0.1";
const appRoutes = new Set(["/", "/map", "/molit-map", "/kb-map", "/neighborhood", "/apartments", "/price-bands", "/formula", "/terms", "/design", "/crawl"]);

await initDb();

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

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
      return json(res, {
        meta: status.meta,
        counts: status.counts,
        months: status.months,
        crawl: serializeCrawlStatus(status.crawl),
        mapCache: status.mapCache,
        overviewCache: status.overviewCache
      });
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

    if (url.pathname === "/api/apartment-rankings") {
      const filters = queryFilters(url);
      const rankMode = url.searchParams.get("rankMode") || "growth";
      const page = Number(url.searchParams.get("page") || 1);
      const pageSize = Number(url.searchParams.get("pageSize") || 50);
      if (rankMode === "averagePyeong") {
        const cached = await readApartmentRankPage({
          source: "kb",
          metric: APARTMENT_RANK_METRICS.averagePyeong,
          startMonth: filters.start,
          endMonth: filters.end,
          page,
          pageSize
        });
        if (cached.cache.hit) return json(res, { ...cached, rankMode });
        const dataset = await readDatasetFromDb();
        return json(res, {
          ...paginateRows(buildApartmentAveragePyeongRankings(dataset, filters), { page, pageSize }),
          rankMode,
          cache: cached.cache
        });
      }
      const dataset = await readDatasetFromDb();
      return json(res, {
        ...paginateRows(buildApartmentRankings(dataset, filters), { page, pageSize }),
        rankMode,
        cache: { hit: false, source: "kb", metric: "growth", updatedAt: null }
      });
    }

    if (url.pathname === "/api/price-band-rankings") {
      const filters = queryFilters(url);
      const basis = url.searchParams.get("basis") || "start";
      const bandKey = url.searchParams.get("bandKey") || "";
      const page = Number(url.searchParams.get("page") || 1);
      const pageSize = Number(url.searchParams.get("pageSize") || 50);
      const cached = await readPriceBandRankPage({
        source: "kb",
        basis,
        startMonth: filters.start,
        endMonth: filters.end,
        bandKey,
        page,
        pageSize
      });
      if (cached.cache.hit) return json(res, cached);
      const dataset = await readDatasetFromDb();
      return json(res, {
        ...buildPriceBandRankings(dataset, {
          ...filters,
          basis,
          bandKey,
          page,
          pageSize
        }),
        cache: cached.cache
      });
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
        west: optionalNumber(url.searchParams.get("west"))
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
        west: optionalNumber(url.searchParams.get("west"))
      };
      const cached = await readCachedZoomMapSummary(filters);
      return json(res, cached || {
        level: zoomAggregationLevel(filters.zoom),
        zoom: filters.zoom,
        period: { startMonth: filters.start, endMonth: filters.end },
        cache: { hit: false, source: "molit", updatedAt: null },
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
        endMonth: url.searchParams.get("end") || ""
      }));
    }

    return await serveStatic(url.pathname, res);
  } catch (error) {
    return json(res, { error: error.message }, 500);
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
    end: url.searchParams.get("end") || ""
  };
}

function paginateRows(result, { page = 1, pageSize = 50 } = {}) {
  const normalizedPageSize = Math.max(10, Math.min(Number(pageSize) || 50, 100));
  const totalRows = result.rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / normalizedPageSize));
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const offset = (safePage - 1) * normalizedPageSize;
  return {
    ...result,
    pagination: {
      page: safePage,
      pageSize: normalizedPageSize,
      totalRows,
      totalPages
    },
    rows: result.rows.slice(offset, offset + normalizedPageSize)
  };
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
  if (level === "sido") {
    const sidoCode = code.slice(0, 2);
    return { code: sidoCode, name: sidoName(sidoCode) };
  }
  if (level === "sigungu") {
    const sigunguCode = code.slice(0, 5);
    return { code: sigunguCode, name: sigunguName(rows, sigunguCode) };
  }
  const dongCode = code.slice(0, 8) || `${row.apartment.address}:${row.apartment.neighborhoodName}`;
  return {
    code: dongCode,
    name: zoomDongName(row.apartment)
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
    50: "제주"
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

async function serveStatic(pathname, res) {
  if (pathname === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }

  const normalizedPath = normalizeRoute(pathname);
  const filePath = appRoutes.has(normalizedPath) ? "/index.html" : pathname;
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

function contentType(filePath) {
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml"
  }[extname(filePath)] || "application/octet-stream";
}

function json(res, payload, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}
