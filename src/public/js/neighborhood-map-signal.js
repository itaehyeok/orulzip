const finite = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : NaN;
const monthKey = value => {
  const key = String(value ?? "").replace("-", "");
  return /^\d{4}(0[1-9]|1[0-2])$/.test(key) ? key : "";
};
const ordinal = value => {
  const key = monthKey(value);
  return key ? Number(key.slice(0, 4)) * 12 + Number(key.slice(4)) - 1 : NaN;
};
function priceAt(item, month) {
  const series = item?.monthly_prices, index = ordinal(month) - ordinal(series?.start);
  if (!Array.isArray(series?.values) || !Number.isInteger(index)) return NaN;
  const value = finite(series.values[index]);
  return value > 0 ? value : NaN;
}
function growth(item, from, to) {
  const a = priceAt(item, from), b = priceAt(item, to);
  return a > 0 && b > 0 ? (b / a - 1) * 100 : NaN;
}

// This describes a current gap to a previously fitted relationship, not a forecast.
export function compareNeighborhood({ item, peer = null, model = null, baseline, selected }) {
  const ownRate = growth(item, baseline, selected), peerRate = peer ? growth(peer, baseline, selected) : NaN;
  const k = ordinal(selected) - ordinal(baseline);
  const available = Boolean(model && peer && Number.isFinite(ownRate) && Number.isFinite(peerRate)
    && Number.isFinite(finite(model.alpha)) && Number.isFinite(finite(model.beta)) && Number.isInteger(k) && k >= 0);
  const rawGap = peer && Number.isFinite(ownRate) && Number.isFinite(peerRate) ? peerRate - ownRate : NaN;
  const expected = available ? Math.expm1(finite(model.alpha) * k + finite(model.beta) * Math.log1p(peerRate / 100)) * 100 : NaN;
  const adjustedGap = available ? expected - ownRate : NaN;
  const triggered = Boolean(available && k > 0 && peerRate >= 5 && rawGap >= 5 && adjustedGap >= 3);
  const status = !available ? "unknown" : k === 0 ? "baseline" : triggered ? "lagging"
    : adjustedGap <= -3 ? "ahead" : adjustedGap >= 3 ? "reference-gap" : "similar";
  return { model, peer, k, ownRate, peerRate, rawGap, expected, adjustedGap, available, triggered, status };
}

export function neighborhoodComparison({ data, item, monthIndex } = {}) {
  const months = Array.isArray(data?.timeline?.months) ? data.timeline.months.map(monthKey).filter(Boolean) : [];
  const index = Math.trunc(finite(monthIndex));
  const selectedIndex = Math.max(0, Math.min(months.length - 1, Number.isFinite(index) ? index : 0));
  const baseline = months[0] || monthKey(data?.timeline?.start), selected = months[selectedIndex] || baseline;
  const model = data?.models?.[String(item?.apt_id ?? "")] || null;
  const items = [data?.benchmark, ...(Array.isArray(data?.current_peers) ? data.current_peers : [])].filter(Boolean);
  const peer = model ? items.find(row => String(row.apt_id) === String(model.leader_id)) || null : null;
  const baseOrdinal = ordinal(baseline) - 12;
  const prior = Number.isFinite(baseOrdinal) ? String(Math.floor(baseOrdinal / 12)) + String(baseOrdinal % 12 + 1).padStart(2, "0") : "";
  return { ...compareNeighborhood({ item, peer, model, baseline, selected }), months, baseline, selected, prior };
}

export function relativeSignalLabel(comparison) {
  return ({ unknown: "판단 보류", baseline: "비교 시작월", lagging: "상대 덜 오름", ahead: "과거 관계보다 더 오름",
    similar: "차이 작음", "reference-gap": "신호 기준 미충족" })[comparison?.status] || "판단 보류";
}

export function relativeSignalPaint(comparison) {
  const clamp = value => Math.max(0, Math.min(1, value));
  if (!comparison?.available) return { rgb: [160, 172, 182], strength: 0 };
  if (!["lagging", "ahead"].includes(comparison.status)) return { rgb: [185, 196, 204], strength: 0 };
  const intensity = clamp(Math.abs(comparison.adjustedGap) / 15);
  const from = comparison.status === "lagging" ? [203, 187, 231] : [178, 201, 211];
  const to = comparison.status === "lagging" ? [111, 69, 194] : [70, 125, 148];
  return { rgb: from.map((value, index) => Math.round(value + (to[index] - value) * intensity)), strength: .35 + .65 * intensity };
}
