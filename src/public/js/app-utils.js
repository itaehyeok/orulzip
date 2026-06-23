function queryParams() {
  const params = new URLSearchParams();
  params.set("regionId", els.regionSelect.value);
  if (els.neighborhoodSelect.value) params.set("neighborhood", els.neighborhoodSelect.value);
  if (els.startInput.value) params.set("start", els.startInput.value.replace("-", ""));
  if (els.endInput.value) params.set("end", els.endInput.value.replace("-", ""));
  appendHouseholdFilterParam(params);
  return params.toString();
}

function appendHouseholdFilterParam(params) {
  params.set("minHouseholdCount", String(activeMinHouseholdCount()));
  return params;
}

function activeMinHouseholdCount() {
  const value = Number(state.minHouseholdCount);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function householdFilterLabel() {
  const minHouseholdCount = activeMinHouseholdCount();
  return minHouseholdCount > 0 ? `${formatInt(minHouseholdCount)}세대 이상` : "전체";
}

function syncHouseholdFilterToggles() {
  const isActive = activeMinHouseholdCount() > 0;
  els.householdFilterToggles?.forEach((button) => {
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    if (button.getAttribute("role") === "switch") {
      button.setAttribute("aria-checked", isActive ? "true" : "false");
    }
    if (button.dataset.householdFilterStatic !== "true") {
      button.textContent = isActive ? householdFilterLabel() : "전체";
    }
  });
}

async function api(path) {
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "API request failed");
  return data;
}

function selectedRegionName() {
  return state.regions.find((region) => region.id === els.regionSelect.value)?.name || "분당";
}

function parseMonth(value) {
  return new Date(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, 1);
}

function toMonthInput(value) {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}`;
}

function formatMonth(value) {
  return `${value.slice(2, 4)}.${value.slice(4, 6)}`;
}

function formatMonthRange(start, end) {
  if (!start || !end) return "-";
  return `${formatMonth(start)} - ${formatMonth(end)}`;
}

function average(values) {
  const clean = values.map(Number).filter(Number.isFinite);
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return `${formatInt(number)}만`;
}

function formatKoreanPrice(value) {
  const amount = Number(value || 0);
  if (!amount) return "-";
  if (amount >= 10000) {
    const eok = Math.floor(amount / 10000);
    const rest = amount % 10000;
    return rest ? `${eok}억 ${formatInt(rest)}만` : `${eok}억`;
  }
  return `${formatInt(amount)}만`;
}

function formatSignedKoreanPrice(value) {
  const amount = Number(value || 0);
  if (!amount) return "-";
  const sign = amount < 0 ? "-" : "";
  return `${sign}${formatKoreanPrice(Math.abs(amount))}`;
}

function formatInt(value) {
  return Math.round(Number(value || 0)).toLocaleString("ko-KR");
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "데이터없음";
  return `${(value * 100).toFixed(1)}%`;
}

function growthRankPercentile(rank, total) {
  const rankNumber = Number(rank);
  const totalNumber = Number(total);
  if (!Number.isFinite(rankNumber) || rankNumber <= 0 || !Number.isFinite(totalNumber) || totalNumber <= 0) return null;
  return (rankNumber / totalNumber) * 100;
}

function formatTopPercentile(percentile, {
  prefix = "",
  maxFractionDigits = 4,
  minVisiblePercent = 0.0001
} = {}) {
  const number = Number(percentile);
  if (!Number.isFinite(number)) return "-";
  if (number === 0) return `${prefix}0%`;
  if (number > 0 && number < minVisiblePercent) return `${prefix}<${trimPercentFixed(minVisiblePercent, maxFractionDigits)}%`;

  const absNumber = Math.abs(number);
  const digits = absNumber >= 10
    ? 0
    : absNumber >= 0.1
      ? 1
      : Math.min(maxFractionDigits, Math.max(2, Math.ceil(-Math.log10(absNumber))));
  return `${prefix}${trimPercentFixed(number, digits)}%`;
}

function formatRankTopPercent(rank, total, options = {}) {
  const percentile = growthRankPercentile(rank, total);
  return percentile === null ? "-" : formatTopPercentile(percentile, options);
}

function trimPercentFixed(value, digits) {
  const fixed = Number(value).toFixed(Math.max(0, Number(digits) || 0));
  return fixed.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

function growthRateTone(rate, rank = null, total = null) {
  const number = Number(rate);
  if (!Number.isFinite(number)) return "growth-rate-no-data";
  if (number < 0) return "growth-rate-negative";
  if (number === 0) return "growth-rate-neutral";

  const percentile = growthRankPercentile(rank, total);
  if (percentile !== null) {
    if (percentile <= 1) return "growth-rate-top-1";
    if (percentile <= 5) return "growth-rate-top-2";
    if (percentile <= 15) return "growth-rate-top-3";
  }
  return "growth-rate-positive";
}

function growthRateToneClass(rate, rank = null, total = null) {
  return `growth-rate-tone ${growthRateTone(rate, rank, total)}`;
}

function renderGrowthRateText(rate, rank = null, total = null) {
  return `<span class="${growthRateToneClass(rate, rank, total)}">${formatPercent(rate)}</span>`;
}

function formatPercentValue(value) {
  if (!Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(2)}%`;
}

function formatSignedPercent(value) {
  if (!Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(2)}%`;
}

function formatDecimal(value, digits = 2) {
  if (!Number.isFinite(value)) return "-";
  return Number(value).toFixed(digits);
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatMapCacheLabel(cache) {
  if (!cache) return "";
  if (cache.hit === false) return "실시간 계산";
  if (!cache.updatedAt) return "";
  const updatedAt = new Date(cache.updatedAt);
  const today = new Date();
  const sameDay = updatedAt.getFullYear() === today.getFullYear()
    && updatedAt.getMonth() === today.getMonth()
    && updatedAt.getDate() === today.getDate();
  const time = updatedAt.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  });
  if (sameDay) return `오늘 ${time} 업데이트 기준`;
  return `${formatDateTime(cache.updatedAt)} 업데이트 기준`;
}

function formatPriceBandCacheLabel(cache) {
  if (!cache) return "";
  if (cache.hit === false) return "실거래가 캐시 없음";
  if (!cache.updatedAt) return "";
  const updatedAt = new Date(cache.updatedAt);
  const today = new Date();
  const sameDay = updatedAt.getFullYear() === today.getFullYear()
    && updatedAt.getMonth() === today.getMonth()
    && updatedAt.getDate() === today.getDate();
  const date = `${String(updatedAt.getMonth() + 1).padStart(2, "0")}월 ${String(updatedAt.getDate()).padStart(2, "0")}일`;
  const time = updatedAt.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  });
  return `${sameDay ? "오늘" : ""}(${date}) ${time} 기준`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
