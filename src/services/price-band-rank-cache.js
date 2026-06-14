import { query, withClient } from "./db.js";
import { readDatasetFromDb } from "./db-store.js";
import { buildPriceBandRankings, getAvailableMonths } from "./price-calculator.js";

export const DEFAULT_PRICE_BAND_PERIOD_MONTHS = [3, 6, 12, 36, 60];
export const PRICE_BAND_BASES = ["start", "end"];

export async function refreshPriceBandRankCache({
  source = "kb",
  periodMonths = DEFAULT_PRICE_BAND_PERIOD_MONTHS,
  bases = PRICE_BAND_BASES
} = {}) {
  const dataset = await readDatasetFromDb();
  const months = getAvailableMonths(dataset);
  const endMonth = months.at(-1);
  if (!endMonth) {
    return {
      refreshedAt: new Date().toISOString(),
      snapshots: [],
      reason: "No monthly price data"
    };
  }

  const snapshots = [];
  for (const monthsBack of normalizePeriodMonths(periodMonths)) {
    const requestedStart = addMonths(endMonth, -monthsBack);
    for (const basis of normalizeBases(bases)) {
      const ranking = buildPriceBandRankings(dataset, {
        start: requestedStart,
        end: endMonth,
        basis,
        includeAllRows: true
      });
      if (!ranking.period.startMonth || !ranking.period.endMonth) continue;
      const snapshot = await savePriceBandRankSnapshot({
        source,
        basis,
        periodMonths: monthsBack,
        startMonth: ranking.period.startMonth,
        endMonth: ranking.period.endMonth,
        bands: ranking.bands,
        rows: ranking.allRows || []
      });
      snapshots.push(snapshot);
    }
  }

  return {
    refreshedAt: new Date().toISOString(),
    snapshots
  };
}

export async function readPriceBandRankPage({
  source = "kb",
  basis = "start",
  startMonth = "",
  endMonth = "",
  bandKey = "",
  page = 1,
  pageSize = 50
} = {}) {
  const normalizedBasis = basis === "end" ? "end" : "start";
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedPageSize = Math.max(10, Math.min(Number(pageSize) || 50, 100));
  const snapshotResult = await query(`
    select *
    from price_band_rank_snapshots
    where source = $1
      and basis = $2
      and start_month = $3
      and end_month = $4
    order by updated_at desc
    limit 1
  `, [source, normalizedBasis, startMonth, endMonth]);
  const snapshot = snapshotResult.rows[0];
  if (!snapshot) {
    return {
      period: { startMonth, endMonth },
      basis: normalizedBasis,
      bands: [],
      selectedBandKey: null,
      selectedBand: null,
      cache: { hit: false, source, basis: normalizedBasis, updatedAt: null },
      pagination: {
        page: normalizedPage,
        pageSize: normalizedPageSize,
        totalRows: 0,
        totalPages: 0
      },
      rows: []
    };
  }

  const bands = await readBands(snapshot.id, normalizedBasis);
  const requestedBandKey = normalizeBandKey(bandKey);
  const selectedBand = bands.find((band) => band.bandKey === requestedBandKey)
    || [...bands].sort((a, b) => b.apartmentCount - a.apartmentCount || a.bandKey - b.bandKey)[0]
    || null;
  const totalRows = selectedBand?.apartmentCount || 0;
  const totalPages = totalRows ? Math.max(1, Math.ceil(totalRows / normalizedPageSize)) : 0;
  const safePage = totalRows ? Math.min(normalizedPage, totalPages) : 1;
  const offset = (safePage - 1) * normalizedPageSize;
  const rowsResult = selectedBand ? await query(`
    select *
    from price_band_rank_items
    where snapshot_id = $1
      and band_key = $2
    order by rank asc
    limit $3 offset $4
  `, [snapshot.id, selectedBand.bandKey, normalizedPageSize, offset]) : { rows: [] };

  return {
    period: {
      startMonth: snapshot.start_month,
      endMonth: snapshot.end_month
    },
    basis: snapshot.basis,
    bands,
    selectedBandKey: selectedBand?.bandKey ?? null,
    selectedBand,
    cache: {
      hit: true,
      source: snapshot.source,
      basis: snapshot.basis,
      updatedAt: snapshot.updated_at
    },
    pagination: {
      page: safePage,
      pageSize: normalizedPageSize,
      totalRows,
      totalPages
    },
    rows: rowsResult.rows.map((row) => serializePriceBandItem(row, snapshot.basis))
  };
}

async function savePriceBandRankSnapshot({ source, basis, periodMonths, startMonth, endMonth, bands, rows }) {
  return withClient(async (client) => {
    await client.query("begin");
    try {
      const snapshotResult = await client.query(`
        insert into price_band_rank_snapshots (
          source, basis, period_months, start_month, end_month, band_count, item_count, updated_at
        ) values ($1, $2, $3, $4, $5, $6, $7, now())
        on conflict (source, basis, start_month, end_month) do update set
          period_months = excluded.period_months,
          band_count = excluded.band_count,
          item_count = excluded.item_count,
          updated_at = now()
        returning *
      `, [source, basis, periodMonths, startMonth, endMonth, bands.length, rows.length]);
      const snapshot = snapshotResult.rows[0];
      await client.query("delete from price_band_rank_items where snapshot_id = $1", [snapshot.id]);

      for (const row of rows) {
        await client.query(`
          insert into price_band_rank_items (
            snapshot_id, band_key, band_label, rank, apartment_id, apartment_name,
            neighborhood_name, legal_dong_code, address, area_type_count, area_label,
            start_sale_price, end_sale_price, start_pyeong_price, end_pyeong_price,
            growth_amount, growth_rate, updated_at
          ) values (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now()
          )
        `, [
          snapshot.id,
          row.bandKey,
          row.bandLabel,
          row.rank,
          row.apartmentId,
          row.apartmentName,
          row.neighborhoodName || "",
          row.legalDongCode || "",
          row.address || "",
          row.areaTypeCount || 0,
          row.areaLabel || "",
          row.startSalePrice ?? null,
          row.endSalePrice ?? null,
          row.startPyeongPrice ?? null,
          row.endPyeongPrice ?? null,
          row.growthAmount ?? null,
          row.growthRate ?? null
        ]);
      }

      await client.query("commit");
      return {
        id: Number(snapshot.id),
        source,
        basis,
        periodMonths,
        startMonth,
        endMonth,
        bandCount: bands.length,
        itemCount: rows.length,
        updatedAt: snapshot.updated_at
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

async function readBands(snapshotId, basis) {
  const result = await query(`
    with band_stats as (
      select
        band_key,
        band_label,
        count(*)::int as apartment_count,
        round(avg(start_sale_price))::int as start_sale_price,
        round(avg(end_sale_price))::int as end_sale_price,
        round(avg(start_pyeong_price))::int as start_pyeong_price,
        round(avg(end_pyeong_price))::int as end_pyeong_price,
        round(avg(end_pyeong_price) - avg(start_pyeong_price))::int as average_growth_amount,
        case
          when avg(start_pyeong_price) is null or avg(start_pyeong_price) = 0 then null
          else (avg(end_pyeong_price) - avg(start_pyeong_price)) / avg(start_pyeong_price)
        end as average_growth_rate,
        max(growth_rate) as top_growth_rate
      from price_band_rank_items
      where snapshot_id = $1
      group by band_key, band_label
    ),
    top_apartment as (
      select distinct on (band_key)
        band_key,
        apartment_name as top_apartment_name
      from price_band_rank_items
      where snapshot_id = $1
      order by band_key, growth_rate desc nulls last, growth_amount desc nulls last, end_pyeong_price desc nulls last, apartment_name asc
    )
    select band_stats.*, top_apartment.top_apartment_name
    from band_stats
    left join top_apartment using (band_key)
    order by band_key asc
  `, [snapshotId]);

  return result.rows.map((row) => ({
    bandKey: Number(row.band_key),
    bandLabel: row.band_label || "",
    basis,
    apartmentCount: Number(row.apartment_count || 0),
    startSalePrice: row.start_sale_price === null ? null : Number(row.start_sale_price),
    endSalePrice: row.end_sale_price === null ? null : Number(row.end_sale_price),
    startPyeongPrice: row.start_pyeong_price === null ? null : Number(row.start_pyeong_price),
    endPyeongPrice: row.end_pyeong_price === null ? null : Number(row.end_pyeong_price),
    averageGrowthAmount: row.average_growth_amount === null ? null : Number(row.average_growth_amount),
    averageGrowthRate: row.average_growth_rate === null ? null : Number(row.average_growth_rate),
    topGrowthRate: row.top_growth_rate === null ? null : Number(row.top_growth_rate),
    topApartmentName: row.top_apartment_name || ""
  }));
}

function serializePriceBandItem(row, basis) {
  return {
    rank: Number(row.rank || 0),
    apartmentId: row.apartment_id || "",
    apartmentName: row.apartment_name || "",
    neighborhoodName: row.neighborhood_name || "",
    legalDongCode: row.legal_dong_code || "",
    address: row.address || "",
    areaTypeCount: Number(row.area_type_count || 0),
    areaLabel: row.area_label || "",
    bandKey: Number(row.band_key),
    bandLabel: row.band_label || "",
    basis,
    startSalePrice: row.start_sale_price === null ? null : Number(row.start_sale_price),
    endSalePrice: row.end_sale_price === null ? null : Number(row.end_sale_price),
    startPyeongPrice: row.start_pyeong_price === null ? null : Number(row.start_pyeong_price),
    endPyeongPrice: row.end_pyeong_price === null ? null : Number(row.end_pyeong_price),
    growthAmount: row.growth_amount === null ? null : Number(row.growth_amount),
    growthRate: row.growth_rate === null ? null : Number(row.growth_rate)
  };
}

function normalizePeriodMonths(values) {
  return [...new Set(values.map(Number).filter((value) => Number.isInteger(value) && value > 0))]
    .sort((a, b) => a - b);
}

function normalizeBases(values) {
  return [...new Set(values.map((value) => value === "end" ? "end" : "start"))]
    .sort((a, b) => PRICE_BAND_BASES.indexOf(a) - PRICE_BAND_BASES.indexOf(b));
}

function normalizeBandKey(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function addMonths(month, delta) {
  const date = new Date(Number(month.slice(0, 4)), Number(month.slice(4, 6)) - 1, 1);
  date.setMonth(date.getMonth() + delta);
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
}
