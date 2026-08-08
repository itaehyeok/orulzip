export const MAX_KB_MAP_TILE_SIZE = 0.029;

export const regions = [
  {
    id: "bundang",
    name: "분당",
    bbox: {
      startLat: 37.335,
      endLat: 37.425,
      startLng: 127.065,
      endLng: 127.185
    },
    tileSize: 0.015
  },
  {
    id: "dongtan",
    name: "동탄",
    bbox: {
      startLat: 37.155,
      endLat: 37.245,
      startLng: 127.035,
      endLng: 127.16
    },
    tileSize: 0.015
  },
  {
    id: "seoul",
    name: "서울",
    legalDongCodePrefix: "11",
    bbox: {
      startLat: 37.42,
      endLat: 37.7,
      startLng: 126.76,
      endLng: 127.2
    },
    tileSize: 0.015,
    dedupeAgainstAllRegions: true
  },
  {
    id: "gyeonggi",
    name: "경기도",
    legalDongCodePrefix: "41",
    bbox: {
      startLat: 36.88,
      endLat: 38.32,
      startLng: 126.35,
      endLng: 127.9
    },
    tileSize: 0.015,
    dedupeAgainstAllRegions: true
  },
  {
    id: "incheon",
    name: "인천",
    legalDongCodePrefix: "28",
    bbox: {
      startLat: 37.02,
      endLat: 37.98,
      startLng: 124.58,
      endLng: 126.92
    },
    tileSize: 0.025,
    dedupeAgainstAllRegions: true
  },
  {
    id: "busan",
    name: "부산",
    legalDongCodePrefix: "26",
    bbox: {
      startLat: 35.02,
      endLat: 35.42,
      startLng: 128.75,
      endLng: 129.32
    },
    tileSize: 0.02,
    dedupeAgainstAllRegions: true
  },
  {
    id: "daegu",
    name: "대구",
    legalDongCodePrefix: "27",
    bbox: {
      startLat: 35.62,
      endLat: 36.05,
      startLng: 128.35,
      endLng: 128.78
    },
    tileSize: 0.02,
    dedupeAgainstAllRegions: true
  },
  {
    id: "gwangju",
    name: "광주",
    // Keep the former Gwangju code and the five city districts introduced by
    // the 2026-07-01 Jeonnam-Gwangju integration.
    legalDongCodePrefixes: ["29", "12210", "12240", "12270", "12300", "12330"],
    bbox: {
      startLat: 35.02,
      endLat: 35.28,
      startLng: 126.65,
      endLng: 127.02
    },
    tileSize: 0.02,
    dedupeAgainstAllRegions: true
  },
  {
    id: "daejeon",
    name: "대전",
    legalDongCodePrefix: "30",
    bbox: {
      startLat: 36.18,
      endLat: 36.5,
      startLng: 127.24,
      endLng: 127.55
    },
    tileSize: 0.02,
    dedupeAgainstAllRegions: true
  },
  {
    id: "ulsan",
    name: "울산",
    legalDongCodePrefix: "31",
    bbox: {
      startLat: 35.32,
      endLat: 35.75,
      startLng: 129.0,
      endLng: 129.48
    },
    tileSize: 0.025,
    dedupeAgainstAllRegions: true
  },
  {
    id: "sejong",
    name: "세종",
    legalDongCodePrefix: "36",
    bbox: {
      startLat: 36.37,
      endLat: 36.75,
      startLng: 127.12,
      endLng: 127.42
    },
    tileSize: 0.025,
    dedupeAgainstAllRegions: true
  },
  {
    id: "gangwon",
    name: "강원",
    legalDongCodePrefixes: ["51", "42"],
    bbox: {
      startLat: 37.02,
      endLat: 38.62,
      startLng: 127.08,
      endLng: 129.38
    },
    tileSize: 0.04,
    dedupeAgainstAllRegions: true
  },
  {
    id: "chungbuk",
    name: "충북",
    legalDongCodePrefix: "43",
    bbox: {
      startLat: 36.0,
      endLat: 37.25,
      startLng: 127.25,
      endLng: 128.7
    },
    tileSize: 0.035,
    dedupeAgainstAllRegions: true
  },
  {
    id: "chungnam",
    name: "충남",
    legalDongCodePrefix: "44",
    bbox: {
      startLat: 35.98,
      endLat: 37.08,
      startLng: 126.05,
      endLng: 127.65
    },
    tileSize: 0.035,
    dedupeAgainstAllRegions: true
  },
  {
    id: "jeonbuk",
    name: "전북",
    legalDongCodePrefixes: ["52", "45"],
    bbox: {
      startLat: 35.3,
      endLat: 36.18,
      startLng: 126.4,
      endLng: 127.9
    },
    tileSize: 0.035,
    dedupeAgainstAllRegions: true
  },
  {
    id: "jeonnam",
    name: "전남",
    // Prefix 12 is shared with Gwangju, so the current Jeonnam cities and
    // counties must be listed explicitly. Prefix 46 preserves legacy rows.
    legalDongCodePrefixes: [
      "46",
      "12110", "12130", "12150", "12170", "12190",
      "12710", "12720", "12730", "12740", "12750", "12760", "12770", "12780", "12790",
      "12800", "12810", "12820", "12830", "12840", "12850", "12860", "12870"
    ],
    bbox: {
      startLat: 33.9,
      endLat: 35.55,
      startLng: 125.0,
      endLng: 127.85
    },
    tileSize: 0.045,
    dedupeAgainstAllRegions: true
  },
  {
    id: "gyeongbuk",
    name: "경북",
    legalDongCodePrefix: "47",
    bbox: {
      startLat: 35.55,
      endLat: 37.55,
      startLng: 128.0,
      endLng: 130.1
    },
    tileSize: 0.04,
    dedupeAgainstAllRegions: true
  },
  {
    id: "gyeongnam",
    name: "경남",
    legalDongCodePrefix: "48",
    bbox: {
      startLat: 34.55,
      endLat: 35.95,
      startLng: 127.55,
      endLng: 129.35
    },
    tileSize: 0.04,
    dedupeAgainstAllRegions: true
  },
  {
    id: "jeju",
    name: "제주",
    legalDongCodePrefix: "50",
    bbox: {
      startLat: 33.1,
      endLat: 33.6,
      startLng: 126.1,
      endLng: 126.95
    },
    tileSize: 0.035,
    dedupeAgainstAllRegions: true
  }
];

export function getRegion(regionId) {
  return regions.find((region) => region.id === regionId);
}

export function kbCollectionRegions() {
  return regions.filter((region) => legalDongCodePrefixes(region).length);
}

export function legalDongCodePrefixes(region) {
  const prefixes = [
    ...(Array.isArray(region?.legalDongCodePrefixes) ? region.legalDongCodePrefixes : []),
    region?.legalDongCodePrefix
  ].filter(Boolean);
  return [...new Set(prefixes.map((prefix) => String(prefix)))];
}

export function legalDongCodeMatchesRegion(region, legalDongCode) {
  const code = String(legalDongCode || "").trim();
  return Boolean(code) && legalDongCodePrefixes(region).some((prefix) => code.startsWith(prefix));
}

export function listTiles(region) {
  const tiles = [];
  const configuredStep = Number(region?.tileSize);
  if (!Number.isFinite(configuredStep) || configuredStep <= 0) {
    throw new Error(`Invalid tile size for region: ${region?.id || "unknown"}`);
  }
  // KB silently returns an empty list when either map span reaches 0.03 degrees.
  const step = Math.min(configuredStep, MAX_KB_MAP_TILE_SIZE);
  const centerLat = (region.bbox.startLat + region.bbox.endLat) / 2;
  const centerLng = (region.bbox.startLng + region.bbox.endLng) / 2;

  for (let lat = region.bbox.startLat; lat < region.bbox.endLat; lat += step) {
    for (let lng = region.bbox.startLng; lng < region.bbox.endLng; lng += step) {
      tiles.push({
        startLat: roundCoord(lat),
        endLat: roundCoord(Math.min(lat + step, region.bbox.endLat)),
        startLng: roundCoord(lng),
        endLng: roundCoord(Math.min(lng + step, region.bbox.endLng))
      });
    }
  }

  return tiles.sort((a, b) => {
    const aDistance = distanceToCenter(a, centerLat, centerLng);
    const bDistance = distanceToCenter(b, centerLat, centerLng);
    return aDistance - bDistance;
  });
}

function roundCoord(value) {
  return Number(value.toFixed(7));
}

function distanceToCenter(tile, centerLat, centerLng) {
  const tileLat = (tile.startLat + tile.endLat) / 2;
  const tileLng = (tile.startLng + tile.endLng) / 2;
  return Math.abs(tileLat - centerLat) + Math.abs(tileLng - centerLng);
}
