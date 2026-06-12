import { query } from "./db.js";

const FORMULAS = [
  {
    id: "same_month_median",
    name: "동월 중앙값",
    description: "같은 월, 같은 단지, 같은 전용면적 거래의 평당가 중앙값",
    monthsBack: 0,
    monthsForward: 0,
    areaTolerance: 1.2,
    method: "median"
  },
  {
    id: "same_month_average",
    name: "동월 평균",
    description: "같은 월, 같은 단지, 같은 전용면적 거래의 평당가 단순 평균",
    monthsBack: 0,
    monthsForward: 0,
    areaTolerance: 1.2,
    method: "average"
  },
  {
    id: "same_month_trimmed",
    name: "동월 절사평균",
    description: "같은 월 거래에서 상하위 극단값을 덜어낸 평당가 평균",
    monthsBack: 0,
    monthsForward: 0,
    areaTolerance: 1.2,
    method: "trimmedAverage"
  },
  {
    id: "trailing_3m_median",
    name: "최근 3개월 중앙값",
    description: "기준월 포함 최근 3개월 거래의 평당가 중앙값",
    monthsBack: 2,
    monthsForward: 0,
    areaTolerance: 1.2,
    method: "median"
  },
  {
    id: "trailing_3m_average",
    name: "최근 3개월 평균",
    description: "기준월 포함 최근 3개월 거래의 평당가 단순 평균",
    monthsBack: 2,
    monthsForward: 0,
    areaTolerance: 1.2,
    method: "average"
  },
  {
    id: "trailing_3m_weighted",
    name: "최근 3개월 가중평균",
    description: "최근 거래일수록 높은 가중치를 둔 3개월 평당가 평균",
    monthsBack: 2,
    monthsForward: 0,
    areaTolerance: 1.2,
    method: "weightedAverage"
  },
  {
    id: "trailing_3m_trimmed",
    name: "최근 3개월 절사평균",
    description: "최근 3개월 거래에서 상하위 극단값을 덜어낸 평당가 평균",
    monthsBack: 2,
    monthsForward: 0,
    areaTolerance: 1.2,
    method: "trimmedAverage"
  },
  {
    id: "trailing_6m_median",
    name: "최근 6개월 중앙값",
    description: "기준월 포함 최근 6개월 거래의 평당가 중앙값",
    monthsBack: 5,
    monthsForward: 0,
    areaTolerance: 1.2,
    method: "median"
  },
  {
    id: "trailing_6m_average",
    name: "최근 6개월 평균",
    description: "기준월 포함 최근 6개월 거래의 평당가 단순 평균",
    monthsBack: 5,
    monthsForward: 0,
    areaTolerance: 1.2,
    method: "average"
  },
  {
    id: "trailing_6m_weighted",
    name: "최근 6개월 가중평균",
    description: "최근 거래일수록 높은 가중치를 둔 6개월 평당가 평균",
    monthsBack: 5,
    monthsForward: 0,
    areaTolerance: 1.2,
    method: "weightedAverage"
  },
  {
    id: "trailing_6m_trimmed",
    name: "최근 6개월 절사평균",
    description: "최근 6개월 거래에서 상하위 극단값을 덜어낸 평당가 평균",
    monthsBack: 5,
    monthsForward: 0,
    areaTolerance: 1.2,
    method: "trimmedAverage"
  },
  {
    id: "trailing_12m_median",
    name: "최근 12개월 중앙값",
    description: "기준월 포함 최근 12개월 거래의 평당가 중앙값",
    monthsBack: 11,
    monthsForward: 0,
    areaTolerance: 1.2,
    method: "median"
  },
  {
    id: "trailing_12m_weighted",
    name: "최근 12개월 가중평균",
    description: "최근 거래일수록 높은 가중치를 둔 12개월 평당가 평균",
    monthsBack: 11,
    monthsForward: 0,
    areaTolerance: 1.2,
    method: "weightedAverage"
  },
  {
    id: "trailing_12m_trimmed",
    name: "최근 12개월 절사평균",
    description: "최근 12개월 거래에서 상하위 극단값을 덜어낸 평당가 평균",
    monthsBack: 11,
    monthsForward: 0,
    areaTolerance: 1.2,
    method: "trimmedAverage"
  },
  {
    id: "wide_area_3m_median",
    name: "유사면적 3개월 중앙값",
    description: "전용면적 허용폭을 넓힌 최근 3개월 평당가 중앙값",
    monthsBack: 2,
    monthsForward: 0,
    areaTolerance: 3.0,
    method: "median"
  },
  {
    id: "wide_area_6m_median",
    name: "유사면적 6개월 중앙값",
    description: "전용면적 허용폭을 넓힌 최근 6개월 평당가 중앙값",
    monthsBack: 5,
    monthsForward: 0,
    areaTolerance: 3.0,
    method: "median"
  },
  {
    id: "wide_area_6m_weighted",
    name: "유사면적 6개월 가중평균",
    description: "전용면적 허용폭을 넓혀 최근 6개월 거래를 더 많이 반영",
    monthsBack: 5,
    monthsForward: 0,
    areaTolerance: 3.0,
    method: "weightedAverage"
  },
  {
    id: "wide_area_12m_weighted",
    name: "유사면적 12개월 가중평균",
    description: "전용면적 허용폭을 넓혀 최근 12개월 거래를 더 많이 반영",
    monthsBack: 11,
    monthsForward: 0,
    areaTolerance: 3.0,
    method: "weightedAverage"
  }
];

export async function buildFormulaAnalysis({
  target = "seoul",
  start = "",
  end = "",
  limit = 15000
} = {}) {
  const period = await resolveAnalysisPeriod({ target, start, end });
  if (!period.startMonth || !period.endMonth) {
    return emptyAnalysis({ target, period, reason: "KB와 실거래가가 모두 있는 기간이 없습니다." });
  }

  const [kbRows, dealRows] = await Promise.all([
    loadKbRows({ target, period, limit }),
    loadDealRows({ target, period, monthsBack: maxFormulaMonthsBack() })
  ]);
  const dealsByApartment = indexDeals(dealRows);
  const matchedRows = [];

  for (const row of kbRows) {
    const deals = dealsByApartment.get(matchKey(row.region_id, row.neighborhood_name, row.apartment_name));
    if (!deals?.length) continue;
    const predictions = {};
    for (const formula of FORMULAS) {
      const prediction = predictFormula(row, deals, formula);
      if (prediction) predictions[formula.id] = prediction;
    }
    if (!Object.keys(predictions).length) continue;
    matchedRows.push({
      apartmentId: row.apartment_id,
      apartmentName: row.apartment_name,
      neighborhoodName: row.neighborhood_name,
      areaLabel: row.area_label,
      exclusiveAreaM2: Number(row.exclusive_area_m2 || 0),
      yearMonth: row.year_month,
      kbPyeongPrice: Number(row.kb_pyeong_price || 0),
      predictions
    });
  }

  matchedRows.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth)
    || a.apartmentName.localeCompare(b.apartmentName)
    || a.areaLabel.localeCompare(b.areaLabel));

  const splitIndex = Math.max(1, Math.floor(matchedRows.length * 0.7));
  const trainRows = matchedRows.slice(0, splitIndex);
  const testRows = matchedRows.slice(splitIndex);
  const formulas = FORMULAS.map((formula) => summarizeFormula(formula, trainRows, testRows))
    .filter((formula) => formula.totalCount > 0)
    .sort((a, b) => a.testCalibratedMape - b.testCalibratedMape);

  return {
    target,
    period,
    samples: {
      kbRows: kbRows.length,
      tradeRows: dealRows.length,
      matchedRows: matchedRows.length,
      trainRows: trainRows.length,
      testRows: testRows.length
    },
    formulas,
    examples: buildExamples(matchedRows, formulas[0]).slice(0, 80)
  };
}

async function resolveAnalysisPeriod({ target, start, end }) {
  const result = await query(`
    select
      greatest(k.start_month, d.start_month) as start_month,
      least(k.end_month, d.end_month) as end_month
    from (
      select min(mp.year_month) as start_month, max(mp.year_month) as end_month
      from monthly_prices mp
      join area_types at on at.id = mp.area_type_id
      join apartments a on a.id = at.apartment_id
      where a.region_id = $1
    ) k
    cross join (
      select min(deal_year_month) as start_month, max(deal_year_month) as end_month
      from molit_trade_deals
      where target_region_id = $1
    ) d
  `, [target]);
  const available = result.rows[0] || {};
  const startMonth = clampMonth(start || available.start_month, available.start_month, available.end_month);
  const endMonth = clampMonth(end || available.end_month, startMonth, available.end_month);
  return {
    startMonth,
    endMonth,
    availableStartMonth: available.start_month || "",
    availableEndMonth: available.end_month || ""
  };
}

async function loadKbRows({ target, period, limit }) {
  const result = await query(`
    select a.id as apartment_id,
           a.region_id,
           a.name as apartment_name,
           a.neighborhood_name,
           at.id as area_type_id,
           at.label as area_label,
           at.exclusive_area_m2,
           mp.year_month,
           mp.pyeong_price as kb_pyeong_price
    from monthly_prices mp
    join area_types at on at.id = mp.area_type_id
    join apartments a on a.id = at.apartment_id
    where a.region_id = $1
      and mp.year_month between $2 and $3
      and at.exclusive_area_m2 is not null
      and mp.pyeong_price > 0
    order by mp.year_month desc, a.name, at.exclusive_area_m2 nulls last
    limit $4
  `, [target, period.startMonth, period.endMonth, limit]);
  return result.rows;
}

async function loadDealRows({ target, period, monthsBack }) {
  const minMonth = addMonths(period.startMonth, -monthsBack);
  const result = await query(`
    select target_region_id, legal_dong, apt_name, exclusive_area_m2,
           deal_year_month, pyeong_price, deal_amount
    from molit_trade_deals
    where target_region_id = $1
      and deal_year_month between $2 and $3
      and pyeong_price is not null
      and pyeong_price > 0
      and exclusive_area_m2 is not null
      and coalesce(apt_name, '') <> ''
      and coalesce(legal_dong, '') <> ''
  `, [target, minMonth, period.endMonth]);
  return result.rows.map((row) => ({
    ...row,
    exclusive_area_m2: Number(row.exclusive_area_m2 || 0),
    pyeong_price: Number(row.pyeong_price || 0)
  }));
}

function indexDeals(rows) {
  const index = new Map();
  for (const row of rows) {
    const key = matchKey(row.target_region_id, row.legal_dong, row.apt_name);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(row);
  }
  for (const deals of index.values()) {
    deals.sort((a, b) => a.deal_year_month.localeCompare(b.deal_year_month));
  }
  return index;
}

function predictFormula(row, deals, formula) {
  const targetMonth = row.year_month;
  const minMonth = addMonths(targetMonth, -formula.monthsBack);
  const maxMonth = addMonths(targetMonth, formula.monthsForward);
  const kbArea = Number(row.exclusive_area_m2 || 0);
  const candidates = deals
    .filter((deal) => deal.deal_year_month >= minMonth && deal.deal_year_month <= maxMonth)
    .filter((deal) => Math.abs(Number(deal.exclusive_area_m2 || 0) - kbArea) <= formula.areaTolerance);

  if (!candidates.length) return null;
  const values = candidates.map((deal) => deal.pyeong_price).filter(Number.isFinite);
  if (!values.length) return null;

  const value = formula.method === "median"
    ? median(values)
    : formula.method === "weightedAverage"
      ? weightedAverage(candidates, targetMonth)
      : formula.method === "trimmedAverage"
        ? trimmedAverage(values)
      : average(values);

  return {
    value,
    dealCount: candidates.length
  };
}

function summarizeFormula(formula, trainRows, testRows) {
  const trainPairs = formulaPairs(formula.id, trainRows);
  const testPairs = formulaPairs(formula.id, testRows);
  const scale = trainPairs.length ? calibrationScale(trainPairs) : 1;
  return {
    id: formula.id,
    name: formula.name,
    description: formula.description,
    totalCount: trainPairs.length + testPairs.length,
    trainCount: trainPairs.length,
    testCount: testPairs.length,
    scale,
    trainRawMape: mape(trainPairs, 1),
    trainCalibratedMape: mape(trainPairs, scale),
    testRawMape: mape(testPairs, 1),
    testCalibratedMape: mape(testPairs, scale),
    testBias: bias(testPairs, scale)
  };
}

function formulaPairs(formulaId, rows) {
  return rows
    .map((row) => {
      const prediction = row.predictions[formulaId];
      if (!prediction) return null;
      return {
        kb: row.kbPyeongPrice,
        predicted: prediction.value,
        dealCount: prediction.dealCount,
        row
      };
    })
    .filter((item) => item && item.kb > 0 && item.predicted > 0);
}

function calibrationScale(pairs) {
  const numerator = pairs.reduce((sum, pair) => sum + pair.kb * pair.predicted, 0);
  const denominator = pairs.reduce((sum, pair) => sum + pair.predicted * pair.predicted, 0);
  return denominator ? numerator / denominator : 1;
}

function mape(pairs, scale) {
  if (!pairs.length) return null;
  return average(pairs.map((pair) => Math.abs(pair.predicted * scale - pair.kb) / pair.kb));
}

function bias(pairs, scale) {
  if (!pairs.length) return null;
  return average(pairs.map((pair) => (pair.predicted * scale - pair.kb) / pair.kb));
}

function buildExamples(rows, formula) {
  if (!formula) return [];
  return rows
    .map((row) => {
      const prediction = row.predictions[formula.id];
      if (!prediction) return null;
      const calibrated = prediction.value * formula.scale;
      return {
        apartmentName: row.apartmentName,
        neighborhoodName: row.neighborhoodName,
        areaLabel: row.areaLabel,
        yearMonth: row.yearMonth,
        kbPyeongPrice: row.kbPyeongPrice,
        predictedPyeongPrice: Math.round(calibrated),
        dealCount: prediction.dealCount,
        errorRate: (calibrated - row.kbPyeongPrice) / row.kbPyeongPrice
      };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(a.errorRate) - Math.abs(b.errorRate));
}

function matchKey(regionId, legalDong, apartmentName) {
  return `${regionId}|${normalizeDong(legalDong)}|${normalizeApartmentName(apartmentName)}`;
}

function normalizeDong(value) {
  return String(value || "").replace(/\s+/g, "");
}

function normalizeApartmentName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/아파트/g, "")
    .replace(/[()[\]{}·ㆍ.\-_/]/g, "");
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function trimmedAverage(values) {
  if (values.length < 4) return average(values);
  const sorted = [...values].sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * 0.1);
  return average(sorted.slice(trimCount, sorted.length - trimCount));
}

function weightedAverage(deals, targetMonth) {
  let total = 0;
  let weightTotal = 0;
  for (const deal of deals) {
    const distance = Math.max(0, monthDistance(deal.deal_year_month, targetMonth));
    const weight = 1 / (distance + 1);
    total += deal.pyeong_price * weight;
    weightTotal += weight;
  }
  return weightTotal ? total / weightTotal : 0;
}

function monthDistance(fromMonth, toMonth) {
  const fromYear = Number(fromMonth.slice(0, 4));
  const from = fromYear * 12 + Number(fromMonth.slice(4, 6));
  const toYear = Number(toMonth.slice(0, 4));
  const to = toYear * 12 + Number(toMonth.slice(4, 6));
  return to - from;
}

function addMonths(month, delta) {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(4, 6)) - 1 + delta;
  const date = new Date(year, monthIndex, 1);
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function clampMonth(value, min, max) {
  if (!value) return "";
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
}

function maxFormulaMonthsBack() {
  return Math.max(...FORMULAS.map((formula) => formula.monthsBack || 0));
}

function emptyAnalysis({ target, period, reason }) {
  return {
    target,
    period,
    reason,
    samples: {
      kbRows: 0,
      tradeRows: 0,
      matchedRows: 0,
      trainRows: 0,
      testRows: 0
    },
    formulas: [],
    examples: []
  };
}
