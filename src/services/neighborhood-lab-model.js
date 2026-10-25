// The lab describes observed gaps. It does not estimate future appreciation.
export function shiftMonth(value, offset) {
  if (!/^\d{4}(0[1-9]|1[0-2])$/.test(String(value))) throw new Error("Invalid month");
  const date = new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(4)) - 1 + offset, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthsBetween(start, end) {
  const result = [];
  for (let m = start; m <= end; m = shiftMonth(m, 1)) result.push(m);
  return result;
}

export function distanceMeters(a, b) {
  const dy = (a.lat - b.lat) * 111195;
  const dx = (a.lng - b.lng) * 111195 * Math.cos((a.lat + b.lat) * Math.PI / 360);
  return Math.hypot(dx, dy);
}

const validPrice = value => Number.isFinite(value) && value > 0;
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function fitRelationship(target, leader, baseline) {
  const trainingMonths = monthsBetween(shiftMonth(baseline, -35), baseline);
  const rows = trainingMonths.map(month => {
    const previous = shiftMonth(month, -1);
    const values = [target.prices[month], target.prices[previous], leader.prices[month], leader.prices[previous]];
    return values.every(validPrice) ? { month, y: Math.log(values[0] / values[1]), x: Math.log(values[2] / values[3]) } : null;
  }).filter(Boolean);
  if (rows.length < 30 || rows.some(row => Math.abs(row.x) > .3 || Math.abs(row.y) > .3)) return null;
  const changedTarget = rows.filter(row => Math.abs(row.y) > 1e-6).length;
  const changedPeer = rows.filter(row => Math.abs(row.x) > 1e-6).length;
  if (Math.min(changedTarget, changedPeer) < 8) return null;
  const mx = mean(rows.map(row => row.x));
  const my = mean(rows.map(row => row.y));
  const vx = mean(rows.map(row => (row.x - mx) ** 2));
  const vy = mean(rows.map(row => (row.y - my) ** 2));
  const cov = mean(rows.map(row => (row.x - mx) * (row.y - my)));
  if (Math.min(vx, vy) <= 1e-10) return null;
  const beta = cov / vx;
  const corr = cov / Math.sqrt(vx * vy);
  if (corr < .4 || beta < .25 || beta > 2.5) return null;
  return {
    corr, beta, alpha: my - beta * mx,
    training_start: rows[0].month, training_end: rows.at(-1).month,
    training_n: rows.length, changed_target: changedTarget, changed_peer: changedPeer
  };
}

export function buildLabPayload(apartments, asOf, metadata = {}) {
  if (!apartments.length) throw new Error("비교할 단지 자료가 없습니다.");
  const baseline = shiftMonth(asOf, -6);
  const timeline = monthsBetween(baseline, asOf);
  const historyMonths = monthsBetween(shiftMonth(baseline, -23), baseline);
  const models = {};
  // Leader selection is fixed at the baseline, before the six-month gap window.
  for (const target of apartments) {
    const ownHistory = historyMonths.map(month => target.prices[month] / target.area_m2).filter(validPrice);
    if (ownHistory.length < 18 || !validPrice(target.prices[baseline])) continue;
    const ownMedian = median(ownHistory);
    const leaders = apartments.filter(leader => {
      const distance = distanceMeters(target, leader);
      return leader.apt_id !== target.apt_id && leader.legal_dong_code === target.legal_dong_code
        && leader.households >= 300 && target.households >= 100 && distance >= 30 && distance <= 500
        && Math.abs(leader.built_year - target.built_year) <= 5
        && Math.max(leader.area_m2, target.area_m2) / Math.min(leader.area_m2, target.area_m2) <= 1.15;
    }).map(leader => {
      const history = historyMonths.map(month => leader.prices[month] / leader.area_m2).filter(validPrice);
      const paired = historyMonths.filter(month => validPrice(leader.prices[month]) && validPrice(target.prices[month]));
      const leaderMedian = history.length ? median(history) : 0;
      const premium = leaderMedian / ownMedian;
      const higher = paired.filter(month => leader.prices[month] / leader.area_m2 > target.prices[month] / target.area_m2).length;
      return { leader, history, paired, leaderMedian, premium, higher };
    }).filter(item => item.history.length >= 18 && item.paired.length >= 18
      && item.higher / item.paired.length >= .75 && item.premium >= 1.05 && item.premium <= 1.8
      && validPrice(item.leader.prices[baseline]))
      .sort((a, b) => b.leaderMedian - a.leaderMedian || a.leader.apt_id.localeCompare(b.leader.apt_id));
    const chosen = leaders[0];
    if (!chosen) continue;
    const fit = fitRelationship(target, chosen.leader, baseline);
    if (!fit || !timeline.every(month => validPrice(target.prices[month]) && validPrice(chosen.leader.prices[month]))) continue;
    models[target.apt_id] = {
      ...fit, leader_id: chosen.leader.apt_id, distance_m: distanceMeters(target, chosen.leader),
      historical_premium: chosen.premium, peer_area: chosen.leader.area_m2, target_area: target.area_m2,
      target_built: target.built_year, peer_built: chosen.leader.built_year,
      target_households: target.households, peer_households: chosen.leader.households
    };
  }
  const reference = apartments.find(apartment => apartment.apt_id === metadata.area?.reference_id) || apartments[0];
  const formatted = apartments.map(apartment => {
    const start = Object.keys(apartment.prices).filter(month => month <= asOf).sort()[0] || shiftMonth(asOf, -42);
    const values = monthsBetween(start, asOf).map(month => validPrice(apartment.prices[month]) ? apartment.prices[month] : null);
    const base = apartment.prices[baseline], end = apartment.prices[asOf];
    return {
      ...apartment, prices: undefined, monthly_prices: { start: Number(start), end: Number(asOf), values },
      return_6m_pct: validPrice(base) && validPrice(end) ? (end / base - 1) * 100 : null,
      distance_m: distanceMeters(apartment, reference)
    };
  });
  const benchmark = formatted.find(apartment => apartment.apt_id === reference.apt_id);
  const legalDongCodes = [...new Set(apartments.map(apartment => apartment.legal_dong_code))].sort();
  const trainingMonths = monthsBetween(shiftMonth(baseline, -35), baseline);
  const coverage = {
    observed_at_as_of: apartments.filter(apartment => validPrice(apartment.prices[asOf])).length,
    complete_replay: apartments.filter(apartment => timeline.every(month => validPrice(apartment.prices[month]))).length,
    relationship_count: Object.keys(models).length,
    missing_history_count: apartments.filter(apartment => trainingMonths.filter(month =>
      validPrice(apartment.prices[month]) && validPrice(apartment.prices[shiftMonth(month, -1)]))
      .length < 30).length
  };
  return {
    environment: "development", asOf, source: "KB 월별 시세", ...metadata,
    generatedAt: new Date().toISOString(), timeline: { start: baseline, end: asOf, months: timeline },
    benchmark, current_peers: formatted.filter(apartment => apartment.apt_id !== benchmark.apt_id), models, coverage,
    historical_examples: [], tradeChecks: {}, tradeMethod: null,
    filters: { same_legal_dong_required: true, same_legal_dong_code: legalDongCodes.length === 1 ? legalDongCodes[0] : null,
      legal_dong_codes: legalDongCodes, minimum_households: 100, max_distance_m: 500,
      max_built_year_difference: 5, area_ratio_max: 1.15, area_selection: "전용 84㎡에 가장 가까운 면적형", monthly_prices: "관측값만 사용 · 보간 없음" },
    method: { version: 1, leaderLookbackMonths: 24, trainingMonths: 36, minimumPairedMonths: 30,
      minimumChangedMonths: 8, minCorrelation: .4, minBeta: .25, maxBeta: 2.5,
      signal: { leaderGrowthMin: 5, rawGapMinPp: 5, adjustedGapMinPp: 3 },
      note: "과거 가격 간격 탐색이며 미래 상승 확률이 아닙니다. 현재 선정한 비교 관계를 과거 시점에 재생합니다." }
  };
}
