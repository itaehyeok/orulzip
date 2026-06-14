import { query, withClient } from "./db.js";
import { readDatasetFromDb } from "./db-store.js";
import { buildApartmentAveragePyeongRankings, buildApartmentRankings, getAvailableMonths } from "./price-calculator.js";

export const DEFAULT_APARTMENT_RANK_PERIOD_MONTHS = [3, 6, 12, 36, 60];
export const APARTMENT_RANK_METRICS = {
  growth: "growth",
  averagePyeong: "average_pyeong"
};

export async function refreshApartmentRankCache({
  source = "kb",
  metric = APARTMENT_RANK_METRICS.averagePyeong,
  periodMonths = DEFAULT_APARTMENT_RANK_PERIOD_MONTHS
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
    const ranking = metric === APARTMENT_RANK_METRICS.averagePyeong
      ? buildApartmentAveragePyeongRankings(dataset, { start: requestedStart, end: endMonth })
      : buildApartmentRankings(dataset, { start: requestedStart, end: endMonth });
    if (!ranking.period.startMonth || !ranking.period.endMonth) continue;
    const snapshot = await saveApartmentRankSnapshot({
      source,
      metric,
      periodMonths: monthsBack,
      startMonth: ranking.period.startMonth,
      endMonth: ranking.period.endMonth,
      rows: ranking.rows
    });
    snapshots.push(snapshot);
  }

  return {
    refreshedAt: new Date().toISOString(),
    snapshots
  };
}

export async function readApartmentRankPage({
  source = "kb",
  metric = APARTMENT_RANK_METRICS.averagePyeong,
  startMonth = "",
  endMonth = "",
  page = 1,
  pageSize = 50
} = {}) {
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedPageSize = Math.max(10, Math.min(Number(pageSize) || 50, 100));
  const snapshotResult = await query(`
    select *
    from apartment_rank_snapshots
    where source = $1
      and metric = $2
      and start_month = $3
      and end_month = $4
    order by updated_at desc
    limit 1
  `, [source, metric, startMonth, endMonth]);
  const snapshot = snapshotResult.rows[0];
  if (!snapshot) {
    return {
      period: { startMonth, endMonth },
      cache: { hit: false, source, metric, updatedAt: null },
      pagination: {
        page: normalizedPage,
        pageSize: normalizedPageSize,
        totalRows: 0,
        totalPages: 0
      },
      rows: []
    };
  }

  const totalRows = Number(snapshot.item_count || 0);
  const totalPages = Math.max(1, Math.ceil(totalRows / normalizedPageSize));
  const safePage = Math.min(normalizedPage, totalPages);
  const offset = (safePage - 1) * normalizedPageSize;
  const rowsResult = await query(`
    select *
    from apartment_rank_items
    where snapshot_id = $1
    order by rank asc
    limit $2 offset $3
  `, [snapshot.id, normalizedPageSize, offset]);

  return {
    period: {
      startMonth: snapshot.start_month,
      endMonth: snapshot.end_month
    },
    cache: {
      hit: true,
      source: snapshot.source,
      metric: snapshot.metric,
      updatedAt: snapshot.updated_at
    },
    pagination: {
      page: safePage,
      pageSize: normalizedPageSize,
      totalRows,
      totalPages
    },
    rows: rowsResult.rows.map(serializeRankItem)
  };
}

async function saveApartmentRankSnapshot({ source, metric, periodMonths, startMonth, endMonth, rows }) {
  return withClient(async (client) => {
    await client.query("begin");
    try {
      const snapshotResult = await client.query(`
        insert into apartment_rank_snapshots (
          source, metric, period_months, start_month, end_month, item_count, updated_at
        ) values ($1, $2, $3, $4, $5, $6, now())
        on conflict (source, metric, start_month, end_month) do update set
          period_months = excluded.period_months,
          item_count = excluded.item_count,
          updated_at = now()
        returning *
      `, [source, metric, periodMonths, startMonth, endMonth, rows.length]);
      const snapshot = snapshotResult.rows[0];
      await client.query("delete from apartment_rank_items where snapshot_id = $1", [snapshot.id]);

      for (const row of rows) {
        await client.query(`
          insert into apartment_rank_items (
            snapshot_id, rank, apartment_id, apartment_name, neighborhood_name, legal_dong_code,
            area_type_count, area_label, observed_month_count, average_pyeong_price,
            start_pyeong_price, end_pyeong_price, growth_amount, growth_rate, updated_at
          ) values (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now()
          )
        `, [
          snapshot.id,
          row.rank,
          row.apartmentId,
          row.apartmentName,
          row.neighborhoodName || "",
          row.legalDongCode || "",
          row.areaTypeCount || 0,
          row.areaLabel || "",
          row.observedMonthCount || 0,
          row.averagePyeongPrice ?? null,
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
        metric,
        periodMonths,
        startMonth,
        endMonth,
        itemCount: rows.length,
        updatedAt: snapshot.updated_at
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

function serializeRankItem(row) {
  return {
    rank: Number(row.rank || 0),
    apartmentId: row.apartment_id || "",
    apartmentName: row.apartment_name || "",
    neighborhoodName: row.neighborhood_name || "",
    legalDongCode: row.legal_dong_code || "",
    areaTypeCount: Number(row.area_type_count || 0),
    areaLabel: row.area_label || "",
    observedMonthCount: Number(row.observed_month_count || 0),
    averagePyeongPrice: row.average_pyeong_price === null ? null : Number(row.average_pyeong_price),
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

function addMonths(month, delta) {
  const date = new Date(Number(month.slice(0, 4)), Number(month.slice(4, 6)) - 1, 1);
  date.setMonth(date.getMonth() + delta);
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
}
