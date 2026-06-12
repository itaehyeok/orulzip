import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { initDb } from "./services/db.js";
import { createCrawlJob, crawlDetails, crawlStatus, readDatasetFromDb } from "./services/db-store.js";
import { regions } from "./services/region-config.js";
import {
  buildApartmentRankings,
  buildNeighborhoodChart,
  buildNeighborhoodRankings,
  getAvailableMonths
} from "./services/price-calculator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "public");
const port = Number(process.env.PORT || 3050);
const host = process.env.HOST || "127.0.0.1";

await initDb();

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/filters") {
      const dataset = await readDatasetFromDb();
      return json(res, {
        regions,
        regionStats: buildRegionStats(dataset),
        months: getAvailableMonths(dataset),
        neighborhoods: listNeighborhoods(dataset, url.searchParams.get("regionId"))
      });
    }

    if (url.pathname === "/api/status") {
      const dataset = await readDatasetFromDb();
      const crawl = await crawlStatus();
      return json(res, {
        meta: dataset.meta,
        counts: {
          apartments: dataset.apartments.length,
          areaTypes: dataset.areaTypes.length,
          monthlyPrices: dataset.monthlyPrices.length
        },
        months: getAvailableMonths(dataset),
        crawl: serializeCrawlStatus(crawl)
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

    if (url.pathname === "/api/crawl/details") {
      const details = await crawlDetails({
        status: url.searchParams.get("status") || "",
        limit: Number(url.searchParams.get("limit") || 200)
      });
      return json(res, serializeCrawlDetails(details));
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
      const dataset = await readDatasetFromDb();
      const limit = Number(url.searchParams.get("limit") || 300);
      const result = buildApartmentRankings(dataset, queryFilters(url));
      result.rows = result.rows.slice(0, limit);
      return json(res, result);
    }

    if (url.pathname === "/api/zoom-map-summary") {
      const dataset = await readDatasetFromDb();
      return json(res, buildZoomMapSummary(dataset, {
        zoom: Number(url.searchParams.get("zoom") || 9),
        start: url.searchParams.get("start") || "",
        end: url.searchParams.get("end") || "",
        north: optionalNumber(url.searchParams.get("north")),
        south: optionalNumber(url.searchParams.get("south")),
        east: optionalNumber(url.searchParams.get("east")),
        west: optionalNumber(url.searchParams.get("west"))
      }));
    }

    if (url.pathname === "/api/apartment-detail") {
      const dataset = await readDatasetFromDb();
      const apartmentId = url.searchParams.get("apartmentId") || "";
      return json(res, buildApartmentDetail(dataset, apartmentId));
    }

    return serveStatic(url.pathname, res);
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

function listNeighborhoods(dataset, regionId) {
  const items = dataset.apartments
    .filter((apartment) => !regionId || apartment.regionId === regionId)
    .map((apartment) => ({
      name: apartment.neighborhoodName || "미분류",
      legalDongCode: apartment.legalDongCode || ""
    }));

  return [...new Map(items.map((item) => [`${item.legalDongCode}:${item.name}`, item])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

function buildRegionStats(dataset) {
  const apartmentIdsByRegion = new Map();
  for (const apartment of dataset.apartments) {
    if (!apartmentIdsByRegion.has(apartment.regionId)) apartmentIdsByRegion.set(apartment.regionId, new Set());
    apartmentIdsByRegion.get(apartment.regionId).add(apartment.id);
  }

  const areaTypeRegionById = new Map();
  for (const areaType of dataset.areaTypes) {
    const apartment = dataset.apartments.find((item) => item.id === areaType.apartmentId);
    if (apartment) areaTypeRegionById.set(areaType.id, apartment.regionId);
  }

  return regions.map((region) => {
    const apartmentIds = apartmentIdsByRegion.get(region.id) || new Set();
    const areaTypeIds = [...areaTypeRegionById.entries()]
      .filter(([, regionId]) => regionId === region.id)
      .map(([areaTypeId]) => areaTypeId);
    const areaTypeIdSet = new Set(areaTypeIds);
    return {
      regionId: region.id,
      apartments: apartmentIds.size,
      areaTypes: areaTypeIds.length,
      monthlyPrices: dataset.monthlyPrices.filter((price) => areaTypeIdSet.has(price.areaTypeId)).length
    };
  });
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
    .filter((row) => row.apartment?.legalDongCode && Number.isFinite(row.apartment.lat) && Number.isFinite(row.apartment.lng))
    .filter((row) => withinBounds(row.apartment, filters));
  const level = zoomAggregationLevel(filters.zoom);

  return {
    level,
    zoom: filters.zoom,
    period: ranking.period,
    items: level === "apartment"
      ? summarizeApartments(rows).slice(0, 2000).map((item) => ({ ...item, type: "apartment" }))
      : summarizeZoomGroups(rows, level).map((item) => ({ ...item, type: "group" }))
  };
}

function zoomAggregationLevel(zoom) {
  if (zoom >= 15) return "apartment";
  if (zoom >= 12) return "dong";
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

function buildApartmentDetail(dataset, apartmentId) {
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

  return {
    apartment,
    areaTypes,
    months: [...new Set(areaTypes.flatMap((item) => item.prices.map((price) => price.yearMonth)))].sort()
  };
}

function serializeCrawlStatus(crawl) {
  if (!crawl) return null;
  const job = serializeJob(crawl.job);
  const queueCounts = Object.fromEntries(crawl.queue.map((row) => [row.status, row.count]));
  const total = job.totalComplexes || 0;
  const done = (queueCounts.completed || 0) + (queueCounts.failed || 0);
  return {
    job,
    queueCounts,
    progress: total ? Math.round((done / total) * 1000) / 10 : 0,
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

  const filePath = pathname === "/" ? "/index.html" : pathname;
  const absolutePath = join(publicDir, filePath);
  const content = await readFile(absolutePath);
  res.writeHead(200, { "Content-Type": contentType(filePath) });
  res.end(content);
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
