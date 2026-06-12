import { PriceDataProvider } from "./price-provider.js";
import { getRegion, listTiles, regions } from "../services/region-config.js";
const API_BASE = "https://api.kbland.kr";

export class KBPriceProvider extends PriceDataProvider {
  listRegions() {
    return regions.map(({ id, name }) => ({ id, name }));
  }

  async syncRegion(regionId, options = {}) {
    const region = getRegion(regionId);
    if (!region) throw new Error(`Unknown region: ${regionId}`);

    const maxComplexes = Number(options.maxComplexes || 40);
    const yearsBack = Number(options.yearsBack || 10);
    const maxAreaTypesPerComplex = Number(options.maxAreaTypesPerComplex || 3);
    const maxTiles = Number(options.maxTiles || 12);
    const sinceYear = new Date().getFullYear() - yearsBack;

    const tileComplexes = await this.fetchComplexesFromTiles(region, maxTiles);
    const uniqueComplexes = dedupeBy(tileComplexes, "단지기본일련번호")
      .filter((item) => ["01", "41"].includes(String(item.물건종류 || "")))
      .slice(0, maxComplexes);

    const apartments = [];
    const areaTypes = [];
    const monthlyPrices = [];
    const errors = [];

    for (const [index, marker] of uniqueComplexes.entries()) {
      try {
        const collected = await this.collectComplex(regionId, marker, {
          maxAreaTypesPerComplex,
          sinceYear
        });
        apartments.push(...collected.apartments);
        areaTypes.push(...collected.areaTypes);
        monthlyPrices.push(...collected.monthlyPrices);
      } catch (error) {
        errors.push({
          complexId: uniqueComplexes[index]?.단지기본일련번호,
          message: error.message
        });
      }
    }

    return {
      meta: {
        source: "kb_internal_mvp",
        regionId,
        syncedAt: new Date().toISOString(),
        discoveredComplexes: tileComplexes.length,
        selectedComplexes: uniqueComplexes.length,
        maxTiles,
        apartments: apartments.length,
        areaTypes: areaTypes.length,
        monthlyPrices: monthlyPrices.length,
        errors
      },
      apartments,
      areaTypes,
      monthlyPrices
    };
  }

  async collectComplex(regionId, marker, options = {}) {
    const complexId = marker.단지기본일련번호;
    const maxAreaTypesPerComplex = Number(options.maxAreaTypesPerComplex || 2);
    const sinceYear = Number(options.sinceYear || new Date().getFullYear() - 10);
    const wait = options.wait || (async () => {});

    const main = await this.fetchComplexMain(complexId);
    await wait();
    const typeRows = await this.fetchAreaTypes(complexId);
    await wait();
    const usableTypes = typeRows
      .filter((row) => Number(row.매매일반거래가 || 0) > 0 && String(row.시세제공여부 || "0") === "1")
      .slice(0, maxAreaTypesPerComplex);

    if (!usableTypes.length) {
      return { apartments: [], areaTypes: [], monthlyPrices: [] };
    }

    const apartment = normalizeApartment(regionId, main || marker);
    const areaTypes = [];
    const monthlyPrices = [];

    for (const typeRow of usableTypes) {
      const areaType = normalizeAreaType(apartment.id, typeRow);
      areaTypes.push(areaType);

      const years = await this.fetchQuoteYears(complexId, typeRow.면적일련번호);
      await wait();
      const selectedYears = years.filter((year) => Number(year) >= sinceYear);
      const history = selectedYears.length
        ? await this.fetchHistoricalPrices(complexId, typeRow.면적일련번호, selectedYears)
        : [];
      await wait();
      monthlyPrices.push(...normalizeMonthlyPrices(areaType, history));
    }

    return {
      apartments: [apartment],
      areaTypes,
      monthlyPrices
    };
  }

  async fetchComplexesFromTiles(region, maxTiles, options = {}) {
    const wait = typeof options === "function" ? options : options.wait || (async () => {});
    const onProgress = typeof options === "function" ? async () => {} : options.onProgress || (async () => {});
    const all = [];
    const tiles = listTiles(region).slice(0, maxTiles);
    for (const [index, tile] of tiles.entries()) {
      const centerLat = (tile.startLat + tile.endLat) / 2;
      const centerLng = (tile.startLng + tile.endLng) / 2;
      const payload = {
        selectCode: "1,2,3",
        zoomLevel: 17,
        startLat: tile.startLat,
        startLng: tile.startLng,
        endLat: tile.endLat,
        endLng: tile.endLng,
        "물건종류": "01,41",
        webCheck: "Y",
        latitude: centerLat,
        longitude: centerLng
      };

      try {
        const data = await requestJson("/land-complex/map/map250mBlwInfoList", {
          method: "POST",
          body: payload
        });
        all.push(...(data?.dataBody?.data?.단지리스트 || []));
      } catch {
        // Some map tiles may fail transiently. Keep the MVP sync moving.
      }
      await onProgress({ current: index + 1, total: tiles.length, found: all.length });
      await wait();
    }

    return all;
  }

  async fetchComplexMain(complexId) {
    const data = await requestJson("/land-complex/complex/main", {
      params: { "단지기본일련번호": complexId }
    });
    return data?.dataBody?.data || null;
  }

  async fetchAreaTypes(complexId) {
    const data = await requestJson("/land-complex/complex/mpriByType", {
      params: { "단지기본일련번호": complexId }
    });
    return data?.dataBody?.data || [];
  }

  async fetchQuoteYears(complexId, areaId) {
    const data = await requestJson("/land-price/price/QuotBaseYear", {
      params: {
        "단지기본일련번호": complexId,
        "면적일련번호": areaId
      }
    });
    return (data?.dataBody?.data || []).map((item) => item.기준년).filter(Boolean);
  }

  async fetchHistoricalPrices(complexId, areaId, years) {
    const data = await requestJson("/land-price/price/WholQuotList", {
      params: {
        "단지기본일련번호": complexId,
        "면적일련번호": areaId,
        "기준년": years.join(",")
      }
    });
    return data?.dataBody?.data?.시세 || [];
  }
}

async function requestJson(path, { method = "GET", params = {}, body = null } = {}) {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }

  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "WebService": "1",
          "traceId": `user_${Date.now()}`
        },
        body: method === "POST" ? JSON.stringify(body || {}) : undefined
      });
      const parsed = await response.json();
      const code = parsed?.dataHeader?.resultCode;
      if (code && code !== "10000") {
        throw new Error(parsed?.dataHeader?.message || `KB API error: ${code}`);
      }
      return parsed;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }
  throw lastError;
}

function normalizeApartment(regionId, row) {
  const complexId = row.단지기본일련번호;
  return {
    id: `kb:${complexId}`,
    regionId,
    source: "kb_internal_mvp",
    sourceComplexId: complexId,
    name: row.단지명,
    neighborhoodName: row.읍면동명 || row.법정동명 || "",
    legalDongCode: row.법정동코드 || "",
    address: row.구주소 || row.신주소 || "",
    builtYear: String(row.준공년월일 || row.준공년도 || "").slice(0, 4),
    householdCount: Number(row.총세대수 || row.세대수 || 0),
    lat: Number(row.wgs84위도 || row.wgs84위도값 || 0),
    lng: Number(row.wgs84경도 || row.wgs84경도값 || 0)
  };
}

function normalizeAreaType(apartmentId, row) {
  const areaId = row.면적일련번호;
  return {
    id: `${apartmentId}:area:${areaId}`,
    apartmentId,
    sourceAreaId: areaId,
    label: `${row.공급면적평 || row.공급면적평N || ""}평${row.주택형타입내용 ? ` ${row.주택형타입내용}` : ""}`.trim(),
    supplyAreaM2: Number(row.공급면적 || 0),
    supplyAreaPyeong: Number(row.공급면적평 || row.공급면적평N || 0),
    exclusiveAreaM2: Number(row.전용면적 || 0),
    exclusiveAreaPyeong: Number(row.전용면적평 || 0),
    householdCount: Number(row.세대수 || 0)
  };
}

function normalizeMonthlyPrices(areaType, groups) {
  const prices = [];
  for (const group of groups) {
    for (const item of group.items || []) {
      const saleMid = Number(item.매매일반거래가 || 0);
      const pyeong = areaType.supplyAreaPyeong || areaType.exclusiveAreaPyeong;
      if (!saleMid || !pyeong) continue;
      prices.push({
        id: `${areaType.id}:${item.기준년월}`,
        areaTypeId: areaType.id,
        yearMonth: item.기준년월,
        saleLow: Number(item.매매하한가 || 0),
        saleMid,
        saleHigh: Number(item.매매상한가 || 0),
        pyeongPrice: Math.round(saleMid / pyeong),
        source: "kb_internal_mvp"
      });
    }
  }
  return prices;
}

function dedupeBy(items, key) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const value = item[key];
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(item);
  }
  return result;
}
