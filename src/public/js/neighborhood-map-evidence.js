import { neighborhoodComparison, relativeSignalLabel } from "./neighborhood-map-signal.js";
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : NaN;
const validMonth = (value) => {
  const match = String(value ?? "").match(/^(\d{4})-?(\d{2})$/);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return "";
  return match[1] + match[2];
};
const monthIndex = (value) => {
  const key = validMonth(value);
  return key ? Number(key.slice(0, 4)) * 12 + Number(key.slice(4)) - 1 : NaN;
};
const shiftMonth = (value, offset) => {
  const index = monthIndex(value);
  if (!Number.isFinite(index)) return "";
  const target = index + offset;
  const year = Math.floor(target / 12), month = target % 12 + 1;
  return String(year).padStart(4, "0") + String(month).padStart(2, "0");
};
const monthLabel = (value) => {
  const key = validMonth(value);
  return key ? key.slice(0, 4) + "." + key.slice(4) : "월 자료 없음";
};
const priceAt = (item, month) => {
  const series = item?.monthly_prices, start = monthIndex(series?.start), target = monthIndex(month);
  if (!Array.isArray(series?.values) || !Number.isFinite(start) || !Number.isFinite(target)) return NaN;
  const value = finite(series.values[target - start]);
  return value > 0 ? value : NaN;
};
const rateBetween = (item, from, to) => {
  const a = priceAt(item, from), b = priceAt(item, to);
  return a > 0 && b > 0 ? (b / a - 1) * 100 : NaN;
};
const fmt = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : "자료 없음";
const pct = (value) => Number.isFinite(value) ? (value > 0 ? "+" : "") + value.toFixed(1) + "%" : "자료 없음";
const pp = (value) => Number.isFinite(value) ? (value > 0 ? "+" : "") + value.toFixed(1) + "%p" : "자료 없음";
const money = (value) => Number.isFinite(value) ? (value / 10000).toFixed(2) + "억원" : "자료 없음";
const number = (value, digits = 0) => Number.isFinite(finite(value))
  ? finite(value).toLocaleString("ko-KR", { maximumFractionDigits: digits, minimumFractionDigits: digits }) : "자료 없음";
const apartmentList = (data) => [data?.benchmark, ...(Array.isArray(data?.current_peers) ? data.current_peers : [])].filter(Boolean);

function context(data, item, monthIndexValue) {
  return neighborhoodComparison({ data, item, monthIndex: monthIndexValue });
}
function priceChangeRow(item, from, to) {
  const first = priceAt(item, from), last = priceAt(item, to);
  return '<span>' + escapeHtml(item?.name || "단지") + " · " + escapeHtml(pct(rateBetween(item, from, to))) +
    '</span><br><span>' + escapeHtml(money(first)) + " → " + escapeHtml(money(last)) + "</span>";
}
function chartMarkup(item, peer, c) {
  if (!item || !peer) return '<p class="nn-note">선정된 비교 관계가 없어 두 단지의 비교 차트는 표시하지 않습니다.</p>';
  const from = shiftMonth(c.baseline, -12), count = monthIndex(c.selected) - monthIndex(from) + 1;
  const ownBase = priceAt(item, from), peerBase = priceAt(peer, from);
  if (!(ownBase > 0) || !(peerBase > 0) || count < 2) {
    return '<p class="nn-note">두 단지 모두 ' + escapeHtml(monthLabel(from)) + ' 시세가 있어야 같은 달을 100으로 둔 비교 차트를 그릴 수 있습니다.</p>';
  }
  const series = [
    { name: item.name || "선택 단지", color: "#348fae", dashed: false, base: ownBase, item },
    { name: peer.name || "비교 단지", color: "#ce7041", dashed: true, base: peerBase, item: peer }
  ].map((entry) => ({
    ...entry,
    values: Array.from({ length: count }, (_, i) => {
      const value = priceAt(entry.item, shiftMonth(from, i));
      return value > 0 ? value / entry.base * 100 : NaN;
    })
  }));
  const all = series.flatMap((s) => s.values.filter(Number.isFinite));
  if (!all.length) return '<p class="nn-note">비교할 월별 가격 자료가 없습니다.</p>';
  let min = Math.min(...all), max = Math.max(...all);
  const pad = Math.max(2, (max - min) * .12);
  min -= pad; max += pad;
  const left = 58, right = 12, top = 28, bottom = 42, width = 440, height = 200;
  const plotW = width - left - right, plotH = height - top - bottom;
  const x = (i) => left + i / Math.max(1, count - 1) * plotW;
  const y = (v) => top + (max - v) / (max - min || 1) * plotH;
  const grid = [min, min + (max - min) / 2, max].map((v) =>
    '<line x1="' + left + '" x2="' + (width - right) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="nn-grid"/>' +
    '<text x="' + (left - 7) + '" y="' + (y(v) + 3) + '" text-anchor="end" class="nn-axis-label">' + Math.round(v) + "</text>"
  ).join("");
  const tickIndexes = [...new Set([0, Math.min(12, count - 1), count - 1])];
  const dateTicks = tickIndexes.map((i) =>
    '<text x="' + x(i) + '" y="' + (height - 17) + '" text-anchor="' + (i === 0 ? "start" : i === count - 1 ? "end" : "middle") +
    '" class="nn-axis-label">' + escapeHtml(monthLabel(shiftMonth(from, i))) + "</text>"
  ).join("");
  const paths = series.map((entry) => {
    let d = "", pen = false;
    entry.values.forEach((value, i) => {
      if (!Number.isFinite(value)) { pen = false; return; }
      d += (pen ? " L" : " M") + x(i).toFixed(2) + " " + y(value).toFixed(2);
      pen = true;
    });
    return '<path d="' + d + '" fill="none" stroke="' + entry.color + '" stroke-width="2.5"' +
      (entry.dashed ? ' stroke-dasharray="6 4"' : "") + ' class="nn-series"/>' +
      entry.values.map((value, i) => Number.isFinite(value)
        ? '<circle cx="' + x(i).toFixed(2) + '" cy="' + y(value).toFixed(2) + '" r="2.3" fill="' + entry.color + '"/>'
        : "").join("");
  }).join("");
  const baselineX = x(12);
  const baselineLine = baselineX <= width - right
    ? '<line x1="' + baselineX + '" x2="' + baselineX + '" y1="' + top + '" y2="' + (height - bottom) + '" class="nn-baseline"/>'
    : "";
  const legend = series.map((entry) =>
    '<span class="nn-legend-item"><i class="nn-swatch' + (entry.dashed ? " nn-swatch-dashed" : "") +
    '" style="--nn-series:' + entry.color + '"></i>' + escapeHtml(entry.name) + "</span>"
  ).join("");
  return '<div class="nn-chart-wrap"><svg class="nn-chart" viewBox="0 0 440 200" role="img" aria-label="' +
    escapeHtml(monthLabel(from) + " 시세를 100으로 둔 실제 월별 가격 지수 비교") + '">' +
    '<text x="' + left + '" y="14" class="nn-axis-title">실제 KB 시세 지수 · ' + escapeHtml(monthLabel(from)) + '=100</text>' +
    grid + baselineLine + paths + dateTicks +
    '<text x="10" y="' + (top + plotH / 2) + '" text-anchor="middle" transform="rotate(-90 10 ' + (top + plotH / 2) + ')" class="nn-axis-title">지수</text>' +
    '<text x="' + (left + plotW / 2) + '" y="' + (height - 2) + '" text-anchor="middle" class="nn-axis-title">관측 월</text>' +
    "</svg><div class=\"nn-legend\">" + legend + '</div><p class="nn-note">두 선은 모두 같은 ' +
    escapeHtml(monthLabel(from)) + ' 시세를 100으로 맞췄습니다. 점선은 이번 비교 기간의 시작입니다. 관측이 빠진 달은 선을 끊었습니다.</p></div>';
}
function tradeMarkup(data) {
  const checks = data?.tradeChecks;
  if (!checks || (typeof checks === "object" && Object.keys(checks).length === 0)) {
    return '<p class="nn-note">실거래 교차 확인 미완료. 이 화면의 비교는 월별 KB 시세 자료에 기반합니다.</p>';
  }
  return '<p class="nn-note">실거래 교차 확인 자료가 연결되어 있습니다. 월별 KB 시세와 별도 자료로 확인해 주세요.</p>';
}

export function renderNeighborhoodEvidence({ data, item, monthIndex: selectedIndex } = {}) {
  const c = context(data, item, selectedIndex);
  const name = escapeHtml(item?.name || "선택 단지");
  const source = escapeHtml(data?.source || "자료 출처 없음");
  const asOf = escapeHtml(monthLabel(data?.asOf || data?.timeline?.end));
  const snapshot = data?.dataset === "validated"
    ? "검증용 발췌 자료 · 실시간 자료가 아닙니다."
    : "개발 자료 스냅샷 · 실시간 시세가 아닙니다.";
  const ownStart = priceAt(item, c.baseline), ownEnd = priceAt(item, c.selected);
  const sections = [];
  const missingHistory = Math.max(0, Math.trunc(finite(item?.comparison_missing_history_count ?? data?.coverage?.missing_history_count) || 0));
  const summary = c.available
    ? escapeHtml(c.peer.name) + " 대비 · " + escapeHtml(relativeSignalLabel(c)) +
      '<br>과거 관계 대비 차이 <strong>' + escapeHtml(pp(c.adjustedGap)) + '</strong>'
    : "비교 근거 부족으로 판단 보류";
  sections.push('<header class="nn-header"><h2>' + name + ' 비교 근거</h2><p class="nn-relative-summary" data-status="' +
    escapeHtml(c.status) + '">' + summary + '</p><p>' +
    escapeHtml(monthLabel(c.baseline)) + " → " + escapeHtml(monthLabel(c.selected)) +
    " · 선택 기간 실제 변화 " + escapeHtml(pct(c.ownRate)) + "</p></header>");
  if (c.model && c.peer) {
    const m = c.model, peer = c.peer;
    const distance = Math.round(finite(m.distance_m)), premium = finite(m.historical_premium);
    const premiumText = Number.isFinite(premium) ? " · 과거 면적당 시세 중앙값 " +
      (premium >= 1 ? premium.toFixed(2) + "배" : (premium * 100).toFixed(0) + "%") : "";
    sections.push('<section class="nn-section"><h3>비교 상대를 고른 이유</h3><p><strong>' +
      escapeHtml(peer.name) + "</strong> · " + (Number.isFinite(distance) ? distance + "m" : "거리 자료 없음") +
      "</p><p>" + escapeHtml(number(item?.area_m2, 2)) + "㎡ · " + escapeHtml(String(item?.built_year ?? "자료 없음")) + "년 · " +
      escapeHtml(number(item?.households)) + "세대 / " + escapeHtml(number(peer.area_m2, 2)) + "㎡ · " +
      escapeHtml(String(peer.built_year ?? "자료 없음")) + "년 · " + escapeHtml(number(peer.households)) + "세대" +
      escapeHtml(premiumText) + "</p><p class=\"nn-note\">비교 상대는 " + escapeHtml(monthLabel(c.baseline)) +
      " 이전 자료로 정한 관계입니다.</p></section>");
    sections.push('<section class="nn-section"><h3>비교 시작 전의 가격 관계</h3><p>월별 변화 상관 <strong>' +
      escapeHtml(fmt(finite(m.corr), 2)) + "</strong> · " + escapeHtml(monthLabel(m.training_start)) + "–" +
      escapeHtml(monthLabel(m.training_end)) + " · 실제 짝지어진 변화 " + escapeHtml(number(m.training_n)) +
      "개월</p><p class=\"nn-note\">가격이 바뀐 관측 월: " + name + " " + escapeHtml(number(m.changed_target)) +
      "/" + escapeHtml(number(m.training_n)) + " · " + escapeHtml(peer.name) + " " +
      escapeHtml(number(m.changed_peer)) + "/" + escapeHtml(number(m.training_n)) +
      ". 월별 시세 반영 시차가 차이처럼 보일 수 있습니다. 상관은 과거 동행이며 인과관계가 아닙니다.</p></section>");
    sections.push('<section class="nn-section"><h3>선택 기간의 실제 차이</h3><p>' +
      priceChangeRow(item, c.baseline, c.selected) + "</p><p>" + priceChangeRow(peer, c.baseline, c.selected) +
      '</p><p class="nn-highlight">두 단지의 실제 상승률 차이 ' + escapeHtml(pp(c.rawGap)) +
      '</p><p class="nn-note">' + escapeHtml(monthLabel(c.baseline)) + " 시세 " + escapeHtml(money(ownStart)) +
      " → " + escapeHtml(money(ownEnd)) + ". 가격 단위는 원자료의 만원을 억원으로 환산했습니다.</p></section>");
    sections.push('<section class="nn-section"><h3>과거 관계를 반영한 참고값</h3><p>상대 단지의 선택 기간 상승률을 과거 회귀식에 넣으면 ' +
      escapeHtml(pct(c.expected)) + "가 나오고, 실제 선택 단지 변화와의 차이는 <strong>" +
      escapeHtml(pp(c.adjustedGap)) + "</strong>입니다.</p><p class=\"nn-note\">계산식: exp(α × 선택 개월 + β × ln(1 + 비교 단지 상승률)) − 1. 이 값은 과거 관계와의 차이를 설명하는 방식이며 예측이나 미래 확률이 아닙니다." +
      (c.k > 0 ? (c.triggered ? " 현재 상대 덜 오름 표시 기준을 충족합니다." : " 현재 상대 덜 오름 표시 기준은 충족하지 않습니다.") : " 시작월이라 선택 기간 차이가 없습니다.") +
      "</p></section>");
  } else {
    sections.push('<section class="nn-section"><h3>관측 자료</h3><p>이 단지는 주변 월별 시세를 보여주는 관측점입니다. 비교 상대 선정 기준을 충족하지 못해 동행 상대를 지정하지 않았습니다.</p><p>' +
      name + " · " + escapeHtml(pct(c.ownRate)) + " · " + escapeHtml(money(ownStart)) + " → " +
      escapeHtml(money(ownEnd)) + "</p><p class=\"nn-note\">관측된 가격 움직임만 표시하며, 지도 색만으로 상승 여력이나 미래 가격을 판정하지 않습니다.</p></section>");
  }
  const ownPrior = priceChangeRow(item, c.prior, c.baseline), peerPrior = c.peer ? priceChangeRow(c.peer, c.prior, c.baseline) : "";
  const ownWhole = priceChangeRow(item, c.prior, c.selected), peerWhole = c.peer ? priceChangeRow(c.peer, c.prior, c.selected) : "";
  sections.push('<section class="nn-section nn-counter"><h3>함께 볼 반대 근거</h3><p>직전 12개월 · ' +
    escapeHtml(monthLabel(c.prior)) + " → " + escapeHtml(monthLabel(c.baseline)) + "</p><p>" +
    ownPrior + (peerPrior ? "<br>" + peerPrior : "") + "</p><p>전체 " +
    escapeHtml(monthLabel(c.prior)) + " → " + escapeHtml(monthLabel(c.selected)) +
    " · " + Math.max(0, monthIndex(c.selected) - monthIndex(c.prior)) + "개월</p><p>" +
    ownWhole + (peerWhole ? "<br>" + peerWhole : "") +
    '</p><p class="nn-note">기간을 바꾸면 상대 차이가 작아지거나 반대 방향으로 보일 수 있습니다.</p></section>');
  sections.push('<section class="nn-section"><h3>월별 실제 시세</h3>' + chartMarkup(item, c.peer, c) + "</section>");
  sections.push('<section class="nn-section"><h3>실거래 확인</h3>' + tradeMarkup(data) + "</section>");
  if (missingHistory > 0) sections.push('<p class="nn-note">지역 자료 중 ' + missingHistory + '개 단지는 비교 시작 전 36개월 안에 계산 가능한 월별 변화가 30개 미만입니다. 결측 자료를 채우거나 비교 기준을 완화하지 않았습니다.</p>');
  sections.push('<details class="nn-method"><summary>상대 비교의 계산 기준과 자료 범위</summary><p>같은 법정동, 직선거리 30~500m, 준공연도 차이 5년 이내, 면적비 1.15 이내의 단지를 비교합니다. 대상 100세대 이상, 비교 상대 300세대 이상이며 이번 지도에 표시한 ' + escapeHtml(item?.comparison_area_label || data?.area?.label || "선택 지역") + ' ' + (item?.comparison_pool_count || apartmentList(data).length) + '개 단지 안에서 선정합니다.</p><p>상대 덜 오름은 비교 상대 상승률 5% 이상, 실제 상승률 차이 5%p 이상, 과거 관계 조정 차이 3%p 이상일 때 표시합니다. 과거 관계는 기준월까지 최대 36개월의 월 변화율로 계산하고 결측은 채우지 않습니다.</p><p>지도 색은 비교 근거가 있는 단지의 과거 관계 대비 차이를 단지 주변에 표시합니다. 보라색은 상대 덜 오름, 파란색은 관계 대비 차이 -3%p 이하로 더 오른 상태입니다. 회색 점은 차이가 작거나 신호 기준 미충족, 회색 빈 원은 비교 근거 부족으로 판단 보류입니다. 모든 위치에 비교 근거가 있다는 뜻은 아닙니다.</p></details>');
  sections.push('<footer class="nn-footer"><p>출처: ' + source + " · 기준일 " + asOf + "</p><p>" +
    escapeHtml(snapshot) + " 이 화면은 " + escapeHtml(monthLabel(data?.timeline?.end || data?.asOf)) +
    " 기준으로 정한 비교 관계를 과거 선택 시점에 적용한 재생입니다. 시점별 당시 자료만으로 다시 선정한 백테스트가 아니며, 향후 회복 가능성을 추정하지 않습니다.</p></footer>");
  return '<article class="nn-evidence">' + sections.join("") + "</article>";
}

export function renderNeighborhoodHover({ data, item, monthIndex: selectedIndex } = {}) {
  const c = context(data, item, selectedIndex);
  const title = escapeHtml(item?.name || "선택 단지");
  const period = escapeHtml(monthLabel(c.baseline)) + " → " + escapeHtml(monthLabel(c.selected));
  const details = [];
  if (c.available) {
    const rawDescription = Math.abs(c.rawGap) < 1e-9 ? "실제 상승률 차이 없음"
      : fmt(Math.abs(c.rawGap)) + "%p " + (c.rawGap > 0 ? "덜 상승" : "더 상승");
    details.push('<p class="nn-hover-comparison">' + escapeHtml(c.peer.name) + ' 대비 <strong>' +
      escapeHtml(rawDescription) + '</strong></p>');
    details.push('<div class="nn-hover-row"><span>과거 관계 대비 차이</span><strong>' +
      escapeHtml(pp(c.adjustedGap)) + '</strong></div>');
    details.push('<div class="nn-hover-note" data-status="' + escapeHtml(c.status) + '">' + escapeHtml(relativeSignalLabel(c)) + '</div>');
    details.push('<div class="nn-hover-row"><span>선택 단지 실제 변화</span><strong>' + escapeHtml(pct(c.ownRate)) + '</strong></div>');
    details.push('<div class="nn-hover-row"><span>비교 상대 실제 변화</span><strong>' + escapeHtml(pct(c.peerRate)) + '</strong></div>');
  } else {
    details.push('<p class="nn-hover-comparison">비교 근거 부족으로 판단 보류</p><div class="nn-hover-note">선정된 비교 관계가 없어 상대 차이를 계산하지 않습니다.</div>');
    details.push('<div class="nn-hover-row"><span>선택 단지 실제 변화</span><strong>' + escapeHtml(pct(c.ownRate)) + '</strong></div>');
  }
  details.push('<div class="nn-hover-note">과거 가격 자료의 비교이며 미래 가격 예측이 아닙니다.</div>');
  return '<section class="nn-hover-content" role="group" aria-label="' + title + ' 비교 요약"><strong class="nn-hover-title">' +
    title + '</strong><div class="nn-hover-period">' + period + '</div>' + details.join('') + '</section>';
}
