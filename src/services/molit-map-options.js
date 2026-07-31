import { query } from "./db.js";

const DEFAULT_MIN_HOUSEHOLD_COUNT = 100;

export async function readMolitMapOptions() {
  const result = await query(`
    select
      start_month,
      end_month,
      min_household_count,
      apartment_count,
      updated_at
    from map_growth_snapshots
    where source = 'molit'
      and metric = 'rate'
      and end_month = (
        select max(end_month)
        from map_growth_snapshots
        where source = 'molit'
          and metric = 'rate'
          and min_household_count = 0
          and apartment_count > 0
      )
    order by start_month, min_household_count
  `);
  return buildMolitMapOptions(result.rows);
}

export function buildMolitMapOptions(rows = []) {
  const latestEndMonth = rows
    .filter((row) => normalizedHouseholdCount(row.min_household_count) === 0 && Number(row.apartment_count || 0) > 0)
    .map((row) => normalizedMonth(row.end_month))
    .filter(Boolean)
    .sort()
    .at(-1) || "";
  const latestRows = latestEndMonth
    ? rows.filter((row) => normalizedMonth(row.end_month) === latestEndMonth)
    : [];
  const basePeriods = latestRows
    .filter((row) => normalizedHouseholdCount(row.min_household_count) === 0 && Number(row.apartment_count || 0) > 0)
    .map(serializePeriod)
    .filter((period) => period.startMonth && period.endMonth);
  const periodKeys = new Set(basePeriods.map(periodKey));
  const availableMinHouseholdCounts = [...new Set(latestRows.map((row) => normalizedHouseholdCount(row.min_household_count)))]
    .filter((minHouseholdCount) => {
      if (!periodKeys.size) return false;
      const availablePeriods = new Set(latestRows
        .filter((row) => (
          normalizedHouseholdCount(row.min_household_count) === minHouseholdCount
          && Number(row.apartment_count || 0) > 0
        ))
        .map((row) => periodKey(serializePeriod(row))));
      return [...periodKeys].every((key) => availablePeriods.has(key));
    })
    .sort((a, b) => a - b);
  const earliestStartMonth = basePeriods.map((period) => period.startMonth).sort()[0] || "";

  return {
    months: buildMonthRange(earliestStartMonth, latestEndMonth),
    periods: basePeriods.sort((a, b) => a.startMonth.localeCompare(b.startMonth)),
    availableMinHouseholdCounts,
    defaultMinHouseholdCount: availableMinHouseholdCounts.includes(DEFAULT_MIN_HOUSEHOLD_COUNT)
      ? DEFAULT_MIN_HOUSEHOLD_COUNT
      : (availableMinHouseholdCounts[0] || 0),
    updatedAt: latestRows.map((row) => row.updated_at).filter(Boolean).sort().at(-1) || null
  };
}

function serializePeriod(row) {
  return {
    startMonth: normalizedMonth(row.start_month),
    endMonth: normalizedMonth(row.end_month)
  };
}

function periodKey(period) {
  return `${period.startMonth}:${period.endMonth}`;
}

function normalizedHouseholdCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function normalizedMonth(value) {
  const month = String(value || "").trim();
  return /^\d{6}$/.test(month) ? month : "";
}

function buildMonthRange(startMonth, endMonth) {
  if (!normalizedMonth(startMonth) || !normalizedMonth(endMonth) || startMonth > endMonth) return [];
  const months = [];
  let year = Number(startMonth.slice(0, 4));
  let month = Number(startMonth.slice(4, 6));
  const end = Number(endMonth);
  while (Number(`${year}${String(month).padStart(2, "0")}`) <= end) {
    months.push(`${year}${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}
