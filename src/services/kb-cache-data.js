import { query } from "./db.js";

export async function readKbAvailableMonths() {
  const result = await query(`
    select distinct year_month
    from monthly_prices
    where year_month is not null and year_month <> ''
    order by year_month
  `);
  return result.rows.map((row) => row.year_month).filter(Boolean);
}

export async function readKbApartmentCatalog() {
  const result = await query(`
    select
      id, region_id, source, source_complex_id, name, neighborhood_name,
      legal_dong_code, address, built_year, household_count, lat, lng
    from apartments
    order by name
  `);
  return result.rows.map(serializeApartment);
}

export async function readKbGrowthRankingRows({ startMonth, endMonth }) {
  const result = await query(`
    with area_growth as (
      select
        at.apartment_id,
        at.id as area_type_id,
        at.label as area_label,
        start_price.pyeong_price::double precision as start_pyeong_price,
        end_price.pyeong_price::double precision as end_pyeong_price,
        end_price.source
      from area_types at
      join lateral (
        select mp.pyeong_price, mp.year_month
        from monthly_prices mp
        where mp.area_type_id = at.id
          and mp.year_month >= $1
          and mp.year_month <= $2
        order by mp.year_month asc
        limit 1
      ) start_price on true
      join lateral (
        select mp.pyeong_price, mp.year_month, mp.source
        from monthly_prices mp
        where mp.area_type_id = at.id
          and mp.year_month >= $1
          and mp.year_month <= $2
        order by mp.year_month desc
        limit 1
      ) end_price on true
      where start_price.year_month <= end_price.year_month
    ), apartment_growth as (
      select
        apartment_id,
        count(*)::int as area_type_count,
        count(distinct nullif(area_label, ''))::int as area_label_count,
        min(nullif(area_label, '')) as area_label,
        avg(start_pyeong_price)::double precision as start_pyeong_price,
        avg(end_pyeong_price)::double precision as end_pyeong_price,
        min(source) as source
      from area_growth
      group by apartment_id
    )
    select
      growth.*,
      a.name as apartment_name,
      a.neighborhood_name,
      a.legal_dong_code
    from apartment_growth growth
    join apartments a on a.id = growth.apartment_id
    order by
      ((growth.end_pyeong_price - growth.start_pyeong_price) / nullif(growth.start_pyeong_price, 0)) desc,
      (growth.end_pyeong_price - growth.start_pyeong_price) desc,
      a.name
  `, [startMonth, endMonth]);

  return result.rows.map((row, index) => growthRankingRow(row, index));
}

export async function readKbAveragePyeongRankingRows({ startMonth, endMonth }) {
  const result = await query(`
    with area_averages as (
      select
        at.apartment_id,
        at.id as area_type_id,
        at.label as area_label,
        avg(mp.pyeong_price)::double precision as average_pyeong_price
      from area_types at
      join monthly_prices mp on mp.area_type_id = at.id
      where mp.year_month >= $1
        and mp.year_month <= $2
      group by at.apartment_id, at.id, at.label
    ), area_stats as (
      select
        averages.*,
        start_price.pyeong_price::double precision as start_pyeong_price,
        end_price.pyeong_price::double precision as end_pyeong_price
      from area_averages averages
      join lateral (
        select mp.pyeong_price
        from monthly_prices mp
        where mp.area_type_id = averages.area_type_id
          and mp.year_month >= $1
          and mp.year_month <= $2
        order by mp.year_month asc
        limit 1
      ) start_price on true
      join lateral (
        select mp.pyeong_price
        from monthly_prices mp
        where mp.area_type_id = averages.area_type_id
          and mp.year_month >= $1
          and mp.year_month <= $2
        order by mp.year_month desc
        limit 1
      ) end_price on true
    ), apartment_months as (
      select
        at.apartment_id,
        count(distinct mp.year_month)::int as observed_month_count
      from area_types at
      join monthly_prices mp on mp.area_type_id = at.id
      where mp.year_month >= $1
        and mp.year_month <= $2
      group by at.apartment_id
    ), apartment_stats as (
      select
        stats.apartment_id,
        count(*)::int as area_type_count,
        count(distinct nullif(stats.area_label, ''))::int as area_label_count,
        min(nullif(stats.area_label, '')) as area_label,
        avg(stats.average_pyeong_price)::double precision as average_pyeong_price,
        avg(stats.start_pyeong_price)::double precision as start_pyeong_price,
        avg(stats.end_pyeong_price)::double precision as end_pyeong_price
      from area_stats stats
      group by stats.apartment_id
    )
    select
      stats.*,
      months.observed_month_count,
      a.name as apartment_name,
      a.neighborhood_name,
      a.legal_dong_code
    from apartment_stats stats
    join apartment_months months on months.apartment_id = stats.apartment_id
    join apartments a on a.id = stats.apartment_id
  `, [startMonth, endMonth]);

  const rows = result.rows.map(averagePyeongRankingRow);
  rows.sort((a, b) =>
    b.averagePyeongPrice - a.averagePyeongPrice
    || b.endPyeongPrice - a.endPyeongPrice
    || String(a.apartmentName || "").localeCompare(String(b.apartmentName || ""), "ko")
  );
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });
  return rows;
}

export function resolveKbCachePeriod(months, startMonth, endMonth) {
  if (!months.length) return { startMonth: null, endMonth: null };
  const resolvedEnd = endMonth
    ? months.filter((month) => month <= endMonth).at(-1) || months.at(-1)
    : months.at(-1);
  const resolvedStart = startMonth
    ? months.find((month) => month >= startMonth) || months[0]
    : months[0];
  return { startMonth: resolvedStart, endMonth: resolvedEnd };
}

function serializeApartment(row) {
  return {
    id: row.id,
    regionId: row.region_id,
    source: row.source,
    sourceComplexId: Number(row.source_complex_id),
    name: row.name,
    neighborhoodName: row.neighborhood_name || "",
    legalDongCode: row.legal_dong_code || "",
    address: row.address || "",
    builtYear: row.built_year || "",
    householdCount: Number(row.household_count || 0),
    lat: Number(row.lat || 0),
    lng: Number(row.lng || 0)
  };
}

function growthRankingRow(row, index) {
  const startPyeongPrice = Number(row.start_pyeong_price || 0);
  const endPyeongPrice = Number(row.end_pyeong_price || 0);
  const growthAmount = endPyeongPrice - startPyeongPrice;
  return {
    rank: index + 1,
    apartmentId: row.apartment_id,
    apartmentName: row.apartment_name,
    neighborhoodName: row.neighborhood_name || "미분류",
    legalDongCode: row.legal_dong_code || "",
    areaTypeCount: Number(row.area_type_count || 0),
    areaLabel: areaLabel(row),
    startPyeongPrice: Math.round(startPyeongPrice),
    endPyeongPrice: Math.round(endPyeongPrice),
    growthAmount: Math.round(growthAmount),
    growthRate: startPyeongPrice ? growthAmount / startPyeongPrice : 0,
    source: row.source || ""
  };
}

function averagePyeongRankingRow(row) {
  const startPyeongPrice = Number(row.start_pyeong_price || 0);
  const endPyeongPrice = Number(row.end_pyeong_price || 0);
  const growthAmount = endPyeongPrice - startPyeongPrice;
  return {
    rank: 0,
    apartmentId: row.apartment_id,
    apartmentName: row.apartment_name,
    neighborhoodName: row.neighborhood_name || "미분류",
    legalDongCode: row.legal_dong_code || "",
    areaTypeCount: Number(row.area_type_count || 0),
    areaLabel: areaLabel(row),
    observedMonthCount: Number(row.observed_month_count || 0),
    averagePyeongPrice: Math.round(Number(row.average_pyeong_price || 0)),
    startPyeongPrice: Math.round(startPyeongPrice),
    endPyeongPrice: Math.round(endPyeongPrice),
    growthAmount: Math.round(growthAmount),
    growthRate: startPyeongPrice ? growthAmount / startPyeongPrice : 0
  };
}

function areaLabel(row) {
  const count = Number(row.area_label_count || 0);
  if (!count) return "-";
  if (count === 1) return row.area_label || "-";
  return `${count}개 면적`;
}
