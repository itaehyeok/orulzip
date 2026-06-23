function zoomGroupPopup(item) {
  return `
    <strong>${escapeHtml(item.name)}</strong><br>
    아파트 ${formatInt(item.apartmentCount)}개 / 면적 ${formatInt(item.areaCount)}개<br>
    평균 상승액 ${formatMoney(item.growthAmount)}<br>
    평균 상승률 ${renderGrowthRateText(item.growthRate, item.countryRank, item.countryRankTotal)}
  `;
}

function zoomLevelLabel(level) {
  return {
    sido: "시도",
    sigungu: "구/시군",
    dong: "동",
    apartment: "아파트"
  }[level] || "지역";
}

function shortZoomLabel(name, level) {
  if (level === "sido") return shortRegionLabel(name);
  const parts = String(name || "").split(/\s+/).filter(Boolean);
  if (!parts.length) return "";

  if (level === "sigungu") {
    const startIndex = isSidoLabelPart(parts[0]) ? 1 : 0;
    const first = parts[startIndex] || "";
    const second = parts[startIndex + 1] || "";
    if (/시$/.test(first) && /구$/.test(second)) return `${first} ${second}`;
    const sigungu = parts.slice(startIndex).find((part) => /구$|시$|군$/.test(part));
    if (sigungu) return sigungu;
  }

  if (level === "dong") {
    const dong = [...parts].reverse().find((part) => /동$|가$|읍$|면$|리$/.test(part));
    if (dong) return dong;
  }

  return [...parts].reverse().find((part) => !isJibunLike(part)) || parts.at(-1);
}

function isSidoLabelPart(value = "") {
  return /특별시$|광역시$|특별자치시$|특별자치도$|도$/.test(value)
    || ["서울", "서울시", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "경기도", "강원", "충북", "충남", "전북", "전북특별자치도", "전남", "경북", "경남", "제주"].includes(value);
}

function isJibunLike(value = "") {
  return /^\d+(?:-\d+)?$/.test(String(value));
}

function formatMarkerRankNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? formatInt(number) : "-";
}

function formatMarkerTopPercent(rank, total) {
  return formatRankTopPercent(rank, total, { prefix: "상위 " });
}

function compactRankLabel(label, shortLabel, design = activeRegionMarkerDesign()) {
  return label || shortLabel || "";
}

function zoomRankSigunguLabel(item) {
  const code = String(item.sigunguCode || item.code || "").slice(0, 5);
  if (sigunguLabelByCode[code]) return sigunguLabelByCode[code];
  if (item.sigunguName) return shortZoomLabel(item.sigunguName, "sigungu");
  const parts = String(item.name || "").split(/\s+/).filter(Boolean);
  if (parts.length > 1) return shortZoomLabel(parts.slice(0, -1).join(" "), "sigungu");
  return shortZoomLabel(item.name, "sigungu") || "시군구";
}

function zoomRankSidoLabel(item) {
  const code = String(item.sidoCode || item.code || "").slice(0, 2);
  return sidoLabelByCode[code] || shortRegionLabel(item.sidoName) || "시도";
}

function formatRankText(rank, total) {
  const rankNumber = Number(rank);
  const totalNumber = Number(total);
  if (!Number.isFinite(rankNumber) || rankNumber <= 0) return "-";
  if (Number.isFinite(totalNumber) && totalNumber > 0) return `${formatInt(rankNumber)}/${formatInt(totalNumber)}등`;
  return `${formatInt(rankNumber)}등`;
}

function formatRegionMarkerRankText(rank) {
  const rankNumber = Number(rank);
  if (!Number.isFinite(rankNumber) || rankNumber <= 0) return "-";
  return `${formatInt(rankNumber)}등`;
}

function formatMarkerRankText(rank, total, scope = "region", growthRate = null) {
  const rankNumber = Number(rank);
  const totalNumber = Number(total);
  if (!Number.isFinite(rankNumber) || rankNumber <= 0) return "-";
  const options = markerRankDisplayOptions(scope);
  const suffix = options.showSuffix ? "등" : "";
  let text = `${formatInt(rankNumber)}${suffix}`;
  if (options.showTotal && Number.isFinite(totalNumber) && totalNumber > 0) {
    text += `/${formatInt(totalNumber)}`;
  }
  const growthNumber = Number(growthRate);
  if (options.showPercent && Number.isFinite(growthNumber)) {
    text += ` (${formatPercent(growthNumber)})`;
  }
  return text;
}

function formatMarkerRankRatioText(rank, total) {
  return formatRankText(rank, total);
}

function formatMarkerTopPercentShort(rank, total) {
  return formatRankTopPercent(rank, total);
}

function markerRankWidthExtra(scope = "region") {
  const options = markerRankDisplayOptions(scope);
  return (options.showTotal ? 18 : 0) + (options.showPercent ? 34 : 0) + (options.showSuffix ? 6 : 0);
}

const growthMarkerColorBands = [
  {
    min: 0.2,
    main: "#dc2626",
    bg: "#ffffff",
    badgeBg: "#ffe4e6",
    badgeBorder: "rgba(220, 38, 38, 0.22)",
    hoverBg: "#ffe4e6"
  },
  {
    min: 0.1,
    main: "#d97706",
    bg: "#ffffff",
    badgeBg: "#ffedd5",
    badgeBorder: "rgba(217, 119, 6, 0.24)",
    hoverBg: "#ffedd5"
  },
  {
    min: 0.05,
    main: "#16a34a",
    bg: "#ffffff",
    badgeBg: "#dcfce7",
    badgeBorder: "rgba(22, 163, 74, 0.22)",
    hoverBg: "#dcfce7"
  },
  {
    min: 0,
    main: "#0f766e",
    bg: "#ffffff",
    badgeBg: "#ccfbf1",
    badgeBorder: "rgba(15, 118, 110, 0.22)",
    hoverBg: "#ccfbf1"
  },
  {
    min: -Infinity,
    main: "#2563eb",
    bg: "#ffffff",
    badgeBg: "#dbeafe",
    badgeBorder: "rgba(37, 99, 235, 0.22)",
    hoverBg: "#dbeafe"
  }
];

const growthMarkerNoDataColors = {
  main: "#667085",
  bg: "#f2f4f7",
  badgeBg: "#e4e7ec",
  badgeBorder: "rgba(102, 112, 133, 0.22)",
  hoverBg: "#e4e7ec"
};

function growthMarkerColors(rate) {
  if (rate === null || rate === undefined || rate === "") return growthMarkerNoDataColors;
  const number = Number(rate);
  if (!Number.isFinite(number)) return growthMarkerNoDataColors;
  return growthMarkerColorBands.find((band) => number >= band.min) || growthMarkerNoDataColors;
}

function growthColor(rate) {
  return growthMarkerColors(rate).main;
}

function growthMarkerStyleVars(rate) {
  const colors = growthMarkerColors(rate);
  return [
    `--marker-color:${colors.main}`,
    `--zoom-color:${colors.main}`,
    `--growth-marker-main:${colors.main}`,
    `--growth-marker-text:${colors.main}`,
    `--growth-marker-border:${colors.main}`,
    `--growth-marker-bg:${colors.bg}`,
    `--growth-marker-badge-bg:${colors.badgeBg}`,
    `--growth-marker-badge-text:${colors.main}`,
    `--growth-marker-badge-border:${colors.badgeBorder}`,
    `--growth-marker-hover-bg:${colors.hoverBg}`,
    `--growth-marker-hover-border:${colors.main}`
  ].join("; ");
}

function sortableRate(rate) {
  return Number.isFinite(rate) ? Number(rate) : -Infinity;
}

function rateClass(rate, rank = null, total = null) {
  return growthRateToneClass(rate, rank, total);
}
