export function buildCheck({ key, category, title, status, message, metrics = {}, details = [] }) {
  return {
    key,
    category,
    title,
    status,
    message,
    metrics,
    details
  };
}

export function matrixKey(...parts) {
  return parts.map((part) => String(part ?? "")).join("|");
}

export function isStale(value, staleCacheHours) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp > staleCacheHours * 60 * 60 * 1000;
}

export function addMonths(month, delta) {
  const value = String(month || "");
  const date = new Date(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, 1);
  date.setMonth(date.getMonth() + delta);
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function todayKstDateString() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function periodLabel(months) {
  const number = Number(months);
  if (number === 3) return "3개월";
  if (number === 6) return "6개월";
  if (number % 12 === 0) return `${number / 12}년`;
  return `${number}개월`;
}

export function householdLabel(value) {
  const number = Number(value) || 0;
  return number > 0 ? `${number}세대 이상` : "전체";
}

export function basisLabel(value) {
  return value === "end" ? "현재가격" : "과거가격";
}

export function formatMonthKorean(value) {
  const text = String(value || "");
  if (text.length !== 6) return text || "-";
  return `${text.slice(0, 4)}년 ${text.slice(4, 6)}월`;
}
