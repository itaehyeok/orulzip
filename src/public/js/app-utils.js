function queryParams() {
  const params = new URLSearchParams();
  params.set("regionId", els.regionSelect.value);
  if (els.neighborhoodSelect.value) params.set("neighborhood", els.neighborhoodSelect.value);
  if (els.startInput.value) params.set("start", els.startInput.value.replace("-", ""));
  if (els.endInput.value) params.set("end", els.endInput.value.replace("-", ""));
  return params.toString();
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
  if (cache.hit === false) return "실시간 계산";
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
