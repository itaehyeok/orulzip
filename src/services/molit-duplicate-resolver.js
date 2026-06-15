export const MOLIT_DUPLICATE_DISTANCE_METERS = 35;
const HISTORICAL_DUPLICATE_MONTH_GAP = 24;

export function resolveMolitDuplicateGroups(apartments, {
  distanceMeters = MOLIT_DUPLICATE_DISTANCE_METERS
} = {}) {
  const candidates = apartments
    .filter((item) => item?.id && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)))
    .map(normalizeApartment);
  const parent = new Map(candidates.map((item) => [item.id, item.id]));
  const byId = new Map(candidates.map((item) => [item.id, item]));

  for (const group of groupBy(candidates, exactAddressKey).values()) {
    if (group.length > 1) unionGroup(parent, group);
  }

  for (const group of groupBy(candidates, (item) => item.dongKey || item.sigunguCode || item.sidoCode || "unknown").values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        if (distanceBetweenMeters(group[i], group[j]) <= distanceMeters) {
          union(parent, group[i].id, group[j].id);
        }
      }
    }
  }

  const grouped = new Map();
  for (const item of candidates) {
    const root = find(parent, item.id);
    if (!grouped.has(root)) grouped.set(root, []);
    grouped.get(root).push(item);
  }

  const hiddenIds = new Set();
  const groups = [...grouped.values()]
    .filter((items) => items.length > 1)
    .map((items) => resolveGroup(items))
    .filter((group) => group.items.length > 1)
    .sort((a, b) =>
      b.hiddenCount - a.hiddenCount
      || b.items.length - a.items.length
      || String(a.label).localeCompare(String(b.label), "ko")
    );

  for (const group of groups) {
    for (const item of group.items) {
      if (item.action === "hidden") hiddenIds.add(item.id);
    }
  }

  return { hiddenIds, groups, byId };
}

function resolveGroup(items) {
  const sorted = [...items].sort(compareSurvivor);
  const survivor = sorted[0];
  const resolved = sorted.map((item) => {
    const hidden = item.id !== survivor.id && isHistoricalDuplicate(item, survivor);
    return {
      ...item,
      action: hidden ? "hidden" : "active",
      reason: hidden
        ? `최신 단지 ${survivor.name}의 마지막 거래월(${formatMonthCompact(survivor.lastMonth)})보다 오래된 기록`
        : item.id === survivor.id
          ? "대표 표시"
          : "최근 단지와 겹치지 않는 기록"
    };
  });
  return {
    id: groupId(resolved),
    label: groupLabel(resolved),
    activeId: survivor.id,
    hiddenCount: resolved.filter((item) => item.action === "hidden").length,
    distanceMeters: maxDistanceFromSurvivor(resolved, survivor),
    items: resolved
  };
}

function isHistoricalDuplicate(item, survivor) {
  const gap = monthGap(item.lastMonth, survivor.lastMonth);
  if (gap >= HISTORICAL_DUPLICATE_MONTH_GAP) return true;
  const buildGap = Number(survivor.buildYear || 0) - Number(item.buildYear || 0);
  return buildGap >= 10 && gap >= 12;
}

function compareSurvivor(a, b) {
  return compareMonth(b.lastMonth, a.lastMonth)
    || Number(b.buildYear || 0) - Number(a.buildYear || 0)
    || Number(b.dealCount || 0) - Number(a.dealCount || 0)
    || String(a.name).localeCompare(String(b.name), "ko");
}

function normalizeApartment(item) {
  return {
    id: String(item.id || ""),
    name: item.name || item.aptName || "",
    address: item.address || "",
    legalDong: item.legalDong || item.neighborhoodName || item.dongName || "",
    jibun: item.jibun || "",
    dongKey: item.dongKey || item.legalDongCode || "",
    sidoCode: item.sidoCode || "",
    sigunguCode: item.sigunguCode || "",
    lat: Number(item.lat),
    lng: Number(item.lng),
    firstMonth: item.firstMonth || "",
    lastMonth: item.lastMonth || "",
    buildYear: item.buildYear === null || item.buildYear === undefined ? null : Number(item.buildYear),
    dealCount: Number(item.dealCount || 0),
    coordSource: item.coordSource || "",
    coordStatus: item.coordStatus || ""
  };
}

function exactAddressKey(item) {
  const address = normalizeAddress(item.address);
  if (!address) return "";
  return `${item.dongKey || item.sigunguCode || ""}:${address}`;
}

function normalizeAddress(value) {
  return String(value || "").replace(/\s+/g, "");
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function unionGroup(parent, items) {
  for (let i = 1; i < items.length; i += 1) {
    union(parent, items[0].id, items[i].id);
  }
}

function union(parent, a, b) {
  const rootA = find(parent, a);
  const rootB = find(parent, b);
  if (rootA !== rootB) parent.set(rootB, rootA);
}

function find(parent, id) {
  const current = parent.get(id) || id;
  if (current === id) return current;
  const root = find(parent, current);
  parent.set(id, root);
  return root;
}

function distanceBetweenMeters(a, b) {
  const lat1 = radians(Number(a.lat));
  const lat2 = radians(Number(b.lat));
  const dLat = radians(Number(b.lat) - Number(a.lat));
  const dLng = radians(Number(b.lng) - Number(a.lng));
  const hav = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
}

function radians(value) {
  return Number(value) * Math.PI / 180;
}

function monthGap(older, newer) {
  const olderValue = monthIndex(older);
  const newerValue = monthIndex(newer);
  if (olderValue === null || newerValue === null) return 0;
  return Math.max(0, newerValue - olderValue);
}

function compareMonth(a, b) {
  const aValue = monthIndex(a);
  const bValue = monthIndex(b);
  if (aValue === null && bValue === null) return 0;
  if (aValue === null) return -1;
  if (bValue === null) return 1;
  return aValue - bValue;
}

function monthIndex(value) {
  const text = String(value || "");
  if (!/^\d{6}$/.test(text)) return null;
  return Number(text.slice(0, 4)) * 12 + Number(text.slice(4, 6));
}

function formatMonthCompact(value) {
  const text = String(value || "");
  return /^\d{6}$/.test(text) ? `${text.slice(2, 4)}.${text.slice(4, 6)}` : "-";
}

function maxDistanceFromSurvivor(items, survivor) {
  return Math.round(Math.max(0, ...items.map((item) => distanceBetweenMeters(item, survivor))));
}

function groupId(items) {
  return items.map((item) => item.id).sort().join("|");
}

function groupLabel(items) {
  const survivor = items.find((item) => item.action === "active") || items[0];
  return survivor.address || `${survivor.legalDong || ""} ${survivor.jibun || ""}`.trim() || survivor.name;
}
