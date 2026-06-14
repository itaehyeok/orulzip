export function getAvailableMonths(dataset) {
  return [...new Set(dataset.monthlyPrices.map((price) => price.yearMonth))]
    .filter(Boolean)
    .sort();
}

export function resolvePeriod(dataset, startMonth, endMonth) {
  const months = getAvailableMonths(dataset);
  if (!months.length) {
    return { startMonth: null, endMonth: null, availableMonths: [] };
  }

  const resolvedEnd = endMonth
    ? months.filter((month) => month <= endMonth).at(-1) || months.at(-1)
    : months.at(-1);
  const resolvedStart = startMonth
    ? months.find((month) => month >= startMonth) || months[0]
    : months[Math.max(0, months.length - 13)];

  return {
    startMonth: resolvedStart,
    endMonth: resolvedEnd,
    availableMonths: months
  };
}

export function buildApartmentRankings(dataset, filters = {}) {
  const areaRows = buildApartmentAreaRankings(dataset, filters);
  const groups = new Map();

  for (const row of areaRows.rows) {
    if (!groups.has(row.apartmentId)) {
      groups.set(row.apartmentId, {
        apartmentId: row.apartmentId,
        apartmentName: row.apartmentName,
        neighborhoodName: row.neighborhoodName,
        legalDongCode: row.legalDongCode,
        rows: []
      });
    }
    groups.get(row.apartmentId).rows.push(row);
  }

  const rows = [...groups.values()].map((group) => {
    const startPyeongPrice = average(group.rows.map((row) => row.startPyeongPrice));
    const endPyeongPrice = average(group.rows.map((row) => row.endPyeongPrice));
    const growthAmount = endPyeongPrice - startPyeongPrice;
    const growthRate = startPyeongPrice ? growthAmount / startPyeongPrice : 0;
    const areaLabels = group.rows.map((row) => row.areaLabel).filter(Boolean);

    return {
      apartmentId: group.apartmentId,
      apartmentName: group.apartmentName,
      neighborhoodName: group.neighborhoodName,
      legalDongCode: group.legalDongCode,
      areaTypeCount: group.rows.length,
      areaLabel: summarizeAreaLabels(areaLabels),
      startMonth: areaRows.period.startMonth,
      endMonth: areaRows.period.endMonth,
      startPyeongPrice: Math.round(startPyeongPrice),
      endPyeongPrice: Math.round(endPyeongPrice),
      growthAmount: Math.round(growthAmount),
      growthRate,
      source: group.rows[0]?.source || ""
    };
  });

  rows.sort((a, b) => b.growthRate - a.growthRate || b.growthAmount - a.growthAmount);
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });

  return { period: areaRows.period, rows };
}

export function buildApartmentAveragePyeongRankings(dataset, filters = {}) {
  const period = resolvePeriod(dataset, filters.start, filters.end);
  if (!period.startMonth || !period.endMonth) return { period, rows: [] };

  const context = buildContext(dataset, filters);
  const groups = new Map();

  for (const areaType of context.areaTypes) {
    const apartment = context.apartmentById.get(areaType.apartmentId);
    if (!apartment) continue;

    const prices = (context.pricesByAreaType.get(areaType.id) || [])
      .filter((price) => price.yearMonth >= period.startMonth && price.yearMonth <= period.endMonth)
      .filter((price) => Number.isFinite(price.pyeongPrice));
    if (!prices.length) continue;

    const start = nearestStart(prices, period.startMonth);
    const end = nearestEnd(prices, period.endMonth);
    if (!start || !end || start.yearMonth > end.yearMonth) continue;

    if (!groups.has(apartment.id)) {
      groups.set(apartment.id, {
        apartmentId: apartment.id,
        apartmentName: apartment.name,
        neighborhoodName: apartment.neighborhoodName || "미분류",
        legalDongCode: apartment.legalDongCode,
        areaAverages: [],
        startPyeongPrices: [],
        endPyeongPrices: [],
        monthKeys: new Set(),
        areaLabels: []
      });
    }

    const group = groups.get(apartment.id);
    group.areaAverages.push(average(prices.map((price) => price.pyeongPrice)));
    group.startPyeongPrices.push(start.pyeongPrice);
    group.endPyeongPrices.push(end.pyeongPrice);
    group.areaLabels.push(areaType.label);
    prices.forEach((price) => group.monthKeys.add(price.yearMonth));
  }

  const rows = [...groups.values()].map((group) => {
    const startPyeongPrice = average(group.startPyeongPrices);
    const endPyeongPrice = average(group.endPyeongPrices);
    const growthAmount = endPyeongPrice - startPyeongPrice;
    const growthRate = startPyeongPrice ? growthAmount / startPyeongPrice : 0;
    return {
      apartmentId: group.apartmentId,
      apartmentName: group.apartmentName,
      neighborhoodName: group.neighborhoodName,
      legalDongCode: group.legalDongCode,
      areaTypeCount: group.areaAverages.length,
      areaLabel: summarizeAreaLabels(group.areaLabels),
      observedMonthCount: group.monthKeys.size,
      startMonth: period.startMonth,
      endMonth: period.endMonth,
      averagePyeongPrice: Math.round(average(group.areaAverages)),
      startPyeongPrice: Math.round(startPyeongPrice),
      endPyeongPrice: Math.round(endPyeongPrice),
      growthAmount: Math.round(growthAmount),
      growthRate
    };
  });

  rows.sort((a, b) =>
    b.averagePyeongPrice - a.averagePyeongPrice
    || b.endPyeongPrice - a.endPyeongPrice
    || String(a.apartmentName || "").localeCompare(String(b.apartmentName || ""), "ko")
  );
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });

  return { period, rows };
}

export function buildPriceBandRankings(dataset, filters = {}) {
  const period = resolvePeriod(dataset, filters.start, filters.end);
  const basis = filters.basis === "end" ? "end" : "start";
  if (!period.startMonth || !period.endMonth) {
    return emptyPriceBandResult({ period, basis, page: filters.page, pageSize: filters.pageSize });
  }

  const context = buildContext(dataset, filters);
  const apartments = new Map();

  for (const areaType of context.areaTypes) {
    const apartment = context.apartmentById.get(areaType.apartmentId);
    if (!apartment) continue;

    const prices = context.pricesByAreaType.get(areaType.id) || [];
    const start = nearestStart(prices, period.startMonth);
    const end = nearestEnd(prices, period.endMonth);
    if (!start || !end || start.yearMonth > end.yearMonth) continue;

    if (!apartments.has(apartment.id)) {
      apartments.set(apartment.id, {
        apartmentId: apartment.id,
        apartmentName: apartment.name,
        neighborhoodName: apartment.neighborhoodName || "미분류",
        legalDongCode: apartment.legalDongCode,
        address: apartment.address || "",
        areaLabels: [],
        startSalePrices: [],
        endSalePrices: [],
        startPyeongPrices: [],
        endPyeongPrices: []
      });
    }

    const item = apartments.get(apartment.id);
    item.areaLabels.push(areaType.label);
    item.startSalePrices.push(start.saleMid);
    item.endSalePrices.push(end.saleMid);
    item.startPyeongPrices.push(start.pyeongPrice);
    item.endPyeongPrices.push(end.pyeongPrice);
  }

  const groups = new Map();
  for (const apartment of apartments.values()) {
    const startSalePrice = average(apartment.startSalePrices);
    const endSalePrice = average(apartment.endSalePrices);
    const startPyeongPrice = average(apartment.startPyeongPrices);
    const endPyeongPrice = average(apartment.endPyeongPrices);
    if (!startSalePrice || !endSalePrice || !startPyeongPrice || !endPyeongPrice) continue;

    const band = priceBand(basis === "end" ? endSalePrice : startSalePrice);
    if (!groups.has(band.key)) {
      groups.set(band.key, {
        ...band,
        apartments: [],
        startSalePrices: [],
        endSalePrices: [],
        startPyeongPrices: [],
        endPyeongPrices: []
      });
    }

    const group = groups.get(band.key);
    const growthAmount = endPyeongPrice - startPyeongPrice;
    const growthRate = startPyeongPrice ? growthAmount / startPyeongPrice : 0;
    group.apartments.push({
      apartmentId: apartment.apartmentId,
      apartmentName: apartment.apartmentName,
      neighborhoodName: apartment.neighborhoodName,
      legalDongCode: apartment.legalDongCode,
      address: apartment.address,
      areaTypeCount: apartment.startPyeongPrices.length,
      areaLabel: summarizeAreaLabels(apartment.areaLabels),
      bandKey: band.key,
      bandLabel: band.label,
      basis,
      startSalePrice: Math.round(startSalePrice),
      endSalePrice: Math.round(endSalePrice),
      startPyeongPrice: Math.round(startPyeongPrice),
      endPyeongPrice: Math.round(endPyeongPrice),
      growthAmount: Math.round(growthAmount),
      growthRate
    });
    group.startSalePrices.push(startSalePrice);
    group.endSalePrices.push(endSalePrice);
    group.startPyeongPrices.push(startPyeongPrice);
    group.endPyeongPrices.push(endPyeongPrice);
  }

  const bands = [...groups.values()].map((group) => {
    const startSalePrice = average(group.startSalePrices);
    const endSalePrice = average(group.endSalePrices);
    const averageStartPyeongPrice = average(group.startPyeongPrices);
    const averageEndPyeongPrice = average(group.endPyeongPrices);
    const averageGrowthAmount = averageEndPyeongPrice - averageStartPyeongPrice;
    const averageGrowthRate = averageStartPyeongPrice ? averageGrowthAmount / averageStartPyeongPrice : 0;
    const rankedApartments = [...group.apartments].sort(compareApartmentGrowth);
    const topApartment = rankedApartments[0] || null;
    return {
      bandKey: group.key,
      bandLabel: group.label,
      basis,
      apartmentCount: group.apartments.length,
      startSalePrice: Math.round(startSalePrice),
      endSalePrice: Math.round(endSalePrice),
      startPyeongPrice: Math.round(averageStartPyeongPrice),
      endPyeongPrice: Math.round(averageEndPyeongPrice),
      averageGrowthAmount: Math.round(averageGrowthAmount),
      averageGrowthRate,
      topGrowthRate: topApartment?.growthRate ?? null,
      topApartmentName: topApartment?.apartmentName || ""
    };
  }).sort((a, b) => a.bandKey - b.bandKey);

  if (!bands.length) return emptyPriceBandResult({ period, basis, page: filters.page, pageSize: filters.pageSize });

  const requestedBandKey = normalizeBandKey(filters.bandKey);
  const selectedBand = bands.find((band) => band.bandKey === requestedBandKey)
    || [...bands].sort((a, b) => b.apartmentCount - a.apartmentCount || a.bandKey - b.bandKey)[0];
  const selectedGroup = groups.get(selectedBand.bandKey);
  const rankedRows = [...selectedGroup.apartments].sort(compareApartmentGrowth)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  const allRows = filters.includeAllRows
    ? bands.flatMap((band) => [...(groups.get(band.bandKey)?.apartments || [])].sort(compareApartmentGrowth)
      .map((row, index) => ({ ...row, rank: index + 1 })))
    : null;
  const pagination = paginateRows(rankedRows, {
    page: filters.page,
    pageSize: filters.pageSize
  });

  return {
    period,
    basis,
    bands,
    selectedBandKey: selectedBand.bandKey,
    selectedBand,
    pagination: pagination.pagination,
    rows: pagination.rows,
    ...(allRows ? { allRows } : {})
  };
}

function emptyPriceBandResult({ period, basis, page, pageSize }) {
  const pagination = paginateRows([], { page, pageSize }).pagination;
  return {
    period,
    basis,
    bands: [],
    selectedBandKey: null,
    selectedBand: null,
    pagination,
    rows: []
  };
}

function compareApartmentGrowth(a, b) {
  return b.growthRate - a.growthRate
    || b.growthAmount - a.growthAmount
    || b.endPyeongPrice - a.endPyeongPrice
    || String(a.apartmentName || "").localeCompare(String(b.apartmentName || ""), "ko");
}

function paginateRows(rows, { page = 1, pageSize = 50 } = {}) {
  const normalizedPageSize = Math.max(10, Math.min(Number(pageSize) || 50, 100));
  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / normalizedPageSize));
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const offset = (safePage - 1) * normalizedPageSize;
  return {
    pagination: {
      page: safePage,
      pageSize: normalizedPageSize,
      totalRows,
      totalPages
    },
    rows: rows.slice(offset, offset + normalizedPageSize)
  };
}

function normalizeBandKey(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildApartmentAreaRankings(dataset, filters = {}) {
  const period = resolvePeriod(dataset, filters.start, filters.end);
  if (!period.startMonth || !period.endMonth) return { period, rows: [] };

  const context = buildContext(dataset, filters);
  const rows = [];

  for (const areaType of context.areaTypes) {
    const apartment = context.apartmentById.get(areaType.apartmentId);
    if (!apartment) continue;

    const prices = context.pricesByAreaType.get(areaType.id) || [];
    const start = nearestStart(prices, period.startMonth);
    const end = nearestEnd(prices, period.endMonth);
    if (!start || !end || start.yearMonth > end.yearMonth) continue;

    const growthAmount = end.pyeongPrice - start.pyeongPrice;
    const growthRate = start.pyeongPrice ? growthAmount / start.pyeongPrice : 0;

    rows.push({
      apartmentId: apartment.id,
      apartmentName: apartment.name,
      neighborhoodName: apartment.neighborhoodName || "미분류",
      legalDongCode: apartment.legalDongCode,
      areaTypeId: areaType.id,
      areaLabel: areaType.label,
      supplyAreaPyeong: areaType.supplyAreaPyeong,
      exclusiveAreaPyeong: areaType.exclusiveAreaPyeong,
      startMonth: start.yearMonth,
      endMonth: end.yearMonth,
      startPyeongPrice: start.pyeongPrice,
      endPyeongPrice: end.pyeongPrice,
      growthAmount,
      growthRate,
      source: end.source
    });
  }

  rows.sort((a, b) => b.growthRate - a.growthRate || b.growthAmount - a.growthAmount);
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });

  return { period, rows };
}

export function buildNeighborhoodRankings(dataset, filters = {}) {
  const apartmentRankings = buildApartmentAreaRankings(dataset, filters);
  const groups = new Map();

  for (const row of apartmentRankings.rows) {
    const key = `${row.legalDongCode || ""}:${row.neighborhoodName || "미분류"}`;
    if (!groups.has(key)) {
      groups.set(key, {
        neighborhoodName: row.neighborhoodName || "미분류",
        legalDongCode: row.legalDongCode,
        rows: []
      });
    }
    groups.get(key).rows.push(row);
  }

  const rows = [...groups.values()].map((group) => {
    const startPyeongPrice = average(group.rows.map((row) => row.startPyeongPrice));
    const endPyeongPrice = average(group.rows.map((row) => row.endPyeongPrice));
    const growthAmount = endPyeongPrice - startPyeongPrice;
    const growthRate = startPyeongPrice ? growthAmount / startPyeongPrice : 0;

    return {
      neighborhoodName: group.neighborhoodName,
      legalDongCode: group.legalDongCode,
      apartmentAreaCount: group.rows.length,
      startPyeongPrice: Math.round(startPyeongPrice),
      endPyeongPrice: Math.round(endPyeongPrice),
      growthAmount: Math.round(growthAmount),
      growthRate
    };
  });

  rows.sort((a, b) => b.growthRate - a.growthRate || b.growthAmount - a.growthAmount);
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });

  return { period: apartmentRankings.period, rows };
}

export function buildNeighborhoodChart(dataset, filters = {}) {
  const period = resolvePeriod(dataset, filters.start, filters.end);
  if (!period.startMonth || !period.endMonth) return { period, series: [] };

  const context = buildContext(dataset, filters);
  const monthRange = period.availableMonths.filter(
    (month) => month >= period.startMonth && month <= period.endMonth
  );
  const neighborhoods = new Map();

  for (const areaType of context.areaTypes) {
    const apartment = context.apartmentById.get(areaType.apartmentId);
    if (!apartment) continue;
    const key = `${apartment.legalDongCode || ""}:${apartment.neighborhoodName || "미분류"}`;
    if (!neighborhoods.has(key)) {
      neighborhoods.set(key, {
        neighborhoodName: apartment.neighborhoodName || "미분류",
        legalDongCode: apartment.legalDongCode,
        areaTypeIds: []
      });
    }
    neighborhoods.get(key).areaTypeIds.push(areaType.id);
  }

  const series = [...neighborhoods.values()].map((neighborhood) => {
    const points = monthRange.map((month) => {
      const values = [];
      for (const areaTypeId of neighborhood.areaTypeIds) {
        const exact = (context.pricesByAreaType.get(areaTypeId) || []).find((price) => price.yearMonth === month);
        if (exact) values.push(exact.pyeongPrice);
      }
      return {
        month,
        pyeongPrice: values.length ? Math.round(average(values)) : null
      };
    });

    const base = points.find((point) => point.pyeongPrice)?.pyeongPrice;
    return {
      neighborhoodName: neighborhood.neighborhoodName,
      legalDongCode: neighborhood.legalDongCode,
      points: points.map((point) => ({
        month: point.month,
        index: base && point.pyeongPrice ? Number(((point.pyeongPrice / base) * 100).toFixed(1)) : null,
        pyeongPrice: point.pyeongPrice
      }))
    };
  }).filter((item) => item.points.some((point) => point.index !== null));

  return { period, series };
}

function buildContext(dataset, filters) {
  const apartmentById = new Map(dataset.apartments.map((apartment) => [apartment.id, apartment]));
  const filteredApartmentIds = new Set(
    dataset.apartments
      .filter((apartment) => !filters.regionId || apartment.regionId === filters.regionId)
      .filter((apartment) => !filters.neighborhood || apartment.neighborhoodName === filters.neighborhood)
      .map((apartment) => apartment.id)
  );
  const areaTypes = dataset.areaTypes.filter((areaType) => filteredApartmentIds.has(areaType.apartmentId));
  const areaTypeIds = new Set(areaTypes.map((areaType) => areaType.id));
  const pricesByAreaType = new Map();

  for (const price of dataset.monthlyPrices) {
    if (!areaTypeIds.has(price.areaTypeId)) continue;
    if (!pricesByAreaType.has(price.areaTypeId)) pricesByAreaType.set(price.areaTypeId, []);
    pricesByAreaType.get(price.areaTypeId).push(price);
  }

  for (const prices of pricesByAreaType.values()) {
    prices.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  }

  return { apartmentById, areaTypes, pricesByAreaType };
}

function nearestStart(prices, startMonth) {
  return prices.find((price) => price.yearMonth >= startMonth) || null;
}

function nearestEnd(prices, endMonth) {
  return prices.filter((price) => price.yearMonth <= endMonth).at(-1) || null;
}

function average(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function summarizeAreaLabels(labels) {
  const unique = [...new Set(labels)];
  if (!unique.length) return "-";
  if (unique.length === 1) return unique[0];
  return `${unique.length}개 면적`;
}

function priceBand(price) {
  const eok = Number(price) / 10000;
  if (!Number.isFinite(eok) || eok < 1) {
    return { key: 0, label: "1억 미만" };
  }
  if (eok < 10) {
    const floor = Math.floor(eok);
    return { key: floor, label: `${floor}억대` };
  }
  const floor = Math.floor(eok / 10) * 10;
  return { key: floor, label: `${floor}억대` };
}
