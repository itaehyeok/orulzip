export function parseRepairMonthArgument(args) {
  const indexes = args.flatMap((value, index) => value === "--repair-month" ? [index] : []);
  if (!indexes.length) return null;
  if (indexes.length > 1) throw new Error("Use --repair-month only once.");
  const value = args[indexes[0] + 1];
  if (!/^\d{4}(0[1-9]|1[0-2])$/.test(value || "")) {
    throw new Error("--repair-month requires a valid YYYYMM month.");
  }
  return value;
}

export function planRepairCachePeriods({ repairMonth, endMonth, mapPeriodYears, pricePeriodMonths }) {
  const monthDelta = monthOrdinal(endMonth) - monthOrdinal(repairMonth);
  const mapMatches = mapPeriodYears.filter((years) => Math.round(Number(years) * 12) === monthDelta);
  const priceMatches = pricePeriodMonths.filter((months) => Number(months) === monthDelta);
  return {
    monthDelta,
    mapPeriodYears: mapMatches.length ? mapMatches : null,
    pricePeriodMonths: priceMatches.length ? priceMatches : null
  };
}

function monthOrdinal(value) {
  if (!/^\d{4}(0[1-9]|1[0-2])$/.test(String(value || ""))) {
    throw new Error(`Invalid month: ${value}`);
  }
  return Number(value.slice(0, 4)) * 12 + Number(value.slice(4, 6));
}
