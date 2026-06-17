function zoomGroupPopup(item) {
  return `
    <strong>${escapeHtml(item.name)}</strong><br>
    아파트 ${formatInt(item.apartmentCount)}개 / 면적 ${formatInt(item.areaCount)}개<br>
    평균 상승액 ${formatMoney(item.growthAmount)}<br>
    평균 상승률 ${formatPercent(item.growthRate)}
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
    || ["서울", "서울시", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "경기도", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"].includes(value);
}

function isJibunLike(value = "") {
  return /^\d+(?:-\d+)?$/.test(String(value));
}

function zoomGroupMarkerContentHtml(item, level, design = activeRegionMarkerDesign(level)) {
  const markerDesign = activeRegionMarkerDesign(level) || design;
  const rows = zoomGroupMarkerRankRows(item, level);
  const sizeClass = regionMarkerSizeClass(level);
  const markerStyle = [
    `--zoom-color: ${growthColor(item.growthRate)}`,
    regionMarkerStyleInline(level, markerDesign)
  ].filter(Boolean).join("; ");
  const markerClasses = [
    "zoom-cluster-content",
    "dong-rank-demo",
    "region-data-marker",
    `level-${level}`,
    sizeClass,
    markerDesign.className
  ].filter(Boolean).map(escapeHtml).join(" ");
  return `
    <span class="${markerClasses}" style="${markerStyle}">
      <small>${escapeHtml(zoomGroupCurrentLabel(item, level))}</small>
      <strong>${formatPercent(item.growthRate)}</strong>
      ${rows.length ? `
        <span>
          ${rows.map((row) => `
            <em data-rank-level="${escapeHtml(row.rankLevel)}"><b>${escapeHtml(row.label)}</b> ${escapeHtml(row.rank)}</em>
          `).join("")}
        </span>
      ` : ""}
    </span>
  `;
}

function regionMarkerSizeClass(level) {
  if (level === "sido") return "rank-chip-sido";
  if (level === "sigungu") return "rank-chip-region";
  return "";
}

function zoomGroupCurrentLabel(item, level) {
  if (level === "sido") {
    return shortRegionLabel(item.sidoName || item.name) || shortZoomLabel(item.name, level) || "시도";
  }
  if (level === "sigungu") {
    return shortZoomLabel(item.sigunguName || item.name, level) || "시군구";
  }
  if (level === "dong") {
    return shortZoomLabel(item.dongName || item.name, level) || "동";
  }
  return shortZoomLabel(item.name, level) || item.name || "지역";
}

function zoomGroupMarkerRankRows(item, level, design = activeRegionMarkerDesign(level)) {
  const visibleRankLevels = new Set(activeRegionMarkerRankLevels(level));
  return zoomGroupAllRankRows(item, level, design)
    .filter((row) => visibleRankLevels.has(row.rankLevel) && row.rank !== "-");
}

function zoomGroupAllRankRows(item, level, design = activeRegionMarkerDesign(level)) {
  if (level === "dong") {
    return [
      zoomRankRow("sigungu", zoomRankSigunguLabel(item), "구", item.sigunguRank, item.sigunguRankTotal, design),
      zoomRankRow("sido", zoomRankSidoLabel(item), "시", item.sidoRank, item.sidoRankTotal, design),
      zoomRankRow("national", "전국", "전국", item.countryRank, item.countryRankTotal, design)
    ];
  }
  if (level === "sigungu") {
    return [
      zoomRankRow("sido", zoomRankSidoLabel(item), "시", item.sidoRank, item.sidoRankTotal, design),
      zoomRankRow("national", "전국", "전국", item.countryRank, item.countryRankTotal, design)
    ];
  }
  return [
    zoomRankRow("national", "전국", "전국", item.countryRank, item.countryRankTotal, design)
  ];
}

function zoomRankRow(rankLevel, label, shortLabel, rank, total, design = activeRegionMarkerDesign()) {
  return {
    rankLevel,
    label: compactRankLabel(label, shortLabel, design),
    rank: formatRegionMarkerRankText(rank)
  };
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
  if (!Number.isFinite(rankNumber)) return "-";
  if (Number.isFinite(totalNumber) && totalNumber > 0) return `${formatInt(rankNumber)}/${formatInt(totalNumber)}등`;
  return `${formatInt(rankNumber)}등`;
}

function formatRegionMarkerRankText(rank) {
  const rankNumber = Number(rank);
  if (!Number.isFinite(rankNumber)) return "-";
  return `${formatInt(rankNumber)}등`;
}

function zoomMarkerSize(level = "", design = activeRegionMarkerDesign(level)) {
  const normalizedLevel = normalizeRegionMarkerLevel(level);
  const rowCount = activeRegionMarkerRankLevels(normalizedLevel).length;
  const style = activeRegionMarkerStyle(normalizedLevel, design);
  const width = Math.max(style.outerBoxWidth, style.rankBoxWidth + 16) + 22;
  const rankRowsHeight = rowCount
    ? (rowCount * style.rankRowHeight) + (Math.max(0, rowCount - 1) * style.rankRowGap)
    : 0;
  const contentHeight = 20
    + (style.labelFontSize * 1.05)
    + style.labelRateGap
    + (style.valueFontSize * 0.96)
    + (rowCount ? style.valueRankGap + rankRowsHeight : 0);
  const height = Math.max(54, Math.ceil(contentHeight + 24));
  return [width, height];
}

function zoomMarkerAnchor(level = "", design = activeRegionMarkerDesign(level)) {
  const [width, height] = zoomMarkerSize(level, design);
  return [width / 2, height / 2];
}

function growthColor(rate) {
  if (!Number.isFinite(rate)) return "#667085";
  if (rate >= 1) return "#b42318";
  if (rate >= 0.5) return "#c24132";
  if (rate >= 0.2) return "#d97706";
  if (rate >= 0) return "#16805f";
  return "#2367d1";
}

function sortableRate(rate) {
  return Number.isFinite(rate) ? Number(rate) : -Infinity;
}

function rateClass(rate) {
  if (!Number.isFinite(rate)) return "no-data";
  return rate >= 0 ? "positive" : "negative";
}
