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
    || ["서울", "서울시", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "경기도", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"].includes(value);
}

function isJibunLike(value = "") {
  return /^\d+(?:-\d+)?$/.test(String(value));
}

function zoomGroupMarkerContentHtml(item, level, design = activeRegionMarkerDesign(level)) {
  const markerDesign = activeRegionMarkerDesign(level) || design;
  const rows = zoomGroupMarkerRankRows(item, level);
  const template = activeRegionMarkerTemplate(level);
  const values = zoomGroupMarkerTemplateValues(item, level, markerDesign);
  const labelText = renderRegionMarkerTemplateText(template.label, values);
  const valueText = renderRegionMarkerTemplateText(template.value, values);
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
      ${labelText ? `<small>${escapeHtml(labelText)}</small>` : ""}
      ${valueText ? `<strong class="${growthRateToneClass(item.growthRate, ...zoomGroupToneRank(item, level))}">${escapeHtml(valueText)}</strong>` : ""}
      ${rows.length ? `
        <span>
          ${rows.map((row) => `
            <em data-rank-level="${escapeHtml(row.rankLevel)}">${escapeHtml(row.text)}</em>
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
  const template = activeRegionMarkerTemplate(level);
  const values = zoomGroupMarkerTemplateValues(item, level, design);
  return zoomGroupAllRankRows(item, level, design)
    .map((row) => ({
      ...row,
      text: renderRegionMarkerTemplateText(template.rankRows?.[row.rankLevel] || row.template, values)
    }))
    .filter((row) => visibleRankLevels.has(row.rankLevel) && row.rank !== "-" && row.text);
}

function zoomGroupAllRankRows(item, level, design = activeRegionMarkerDesign(level)) {
  if (level === "dong") {
    return [
      zoomRankRow("sigungu", zoomRankSigunguLabel(item), "구", item.sigunguRank, item.sigunguRankTotal, design, item.growthRate),
      zoomRankRow("sido", zoomRankSidoLabel(item), "시", item.sidoRank, item.sidoRankTotal, design, item.growthRate),
      zoomRankRow("national", "전국", "전국", item.countryRank, item.countryRankTotal, design, item.growthRate)
    ];
  }
  if (level === "sigungu") {
    return [
      zoomRankRow("sido", zoomRankSidoLabel(item), "시", item.sidoRank, item.sidoRankTotal, design, item.growthRate),
      zoomRankRow("national", "전국", "전국", item.countryRank, item.countryRankTotal, design, item.growthRate)
    ];
  }
  return [
    zoomRankRow("national", "전국", "전국", item.countryRank, item.countryRankTotal, design, item.growthRate)
  ];
}

function zoomRankRow(rankLevel, label, shortLabel, rank, total, design = activeRegionMarkerDesign(), growthRate = null) {
  return {
    rankLevel,
    label: compactRankLabel(label, shortLabel, design),
    rank: formatMarkerRankText(rank, total, "region", growthRate),
    template: `${compactRankLabel(label, shortLabel, design)} ${formatMarkerRankText(rank, total, "region", growthRate)}`
  };
}

function zoomGroupMarkerTemplateValues(item, level, design = activeRegionMarkerDesign(level)) {
  const sigunguLabel = zoomRankSigunguLabel(item);
  const sidoLabel = zoomRankSidoLabel(item);
  const values = {
    "동명": level === "dong" ? zoomGroupCurrentLabel(item, "dong") : shortZoomLabel(item.dongName || item.name, "dong"),
    "시군구명": level === "sigungu" ? zoomGroupCurrentLabel(item, "sigungu") : sigunguLabel,
    "시도명": level === "sido" ? zoomGroupCurrentLabel(item, "sido") : sidoLabel,
    "기간": activeMarkerPeriodLabel(),
    "상승률": formatPercent(item.growthRate),
    "시군구내순위": formatMarkerRankText(item.sigunguRank, item.sigunguRankTotal, "region", item.growthRate),
    "시군구내등수": formatMarkerRankNumber(item.sigunguRank),
    "시군구내전체": formatMarkerRankNumber(item.sigunguRankTotal),
    "시군구내상위퍼센트": formatMarkerTopPercent(item.sigunguRank, item.sigunguRankTotal),
    "시도내순위": formatMarkerRankText(item.sidoRank, item.sidoRankTotal, "region", item.growthRate),
    "시도내등수": formatMarkerRankNumber(item.sidoRank),
    "시도내전체": formatMarkerRankNumber(item.sidoRankTotal),
    "시도내상위퍼센트": formatMarkerTopPercent(item.sidoRank, item.sidoRankTotal),
    "전국순위": formatMarkerRankText(item.countryRank, item.countryRankTotal, "region", item.growthRate),
    "전국등수": formatMarkerRankNumber(item.countryRank),
    "전국전체": formatMarkerRankNumber(item.countryRankTotal),
    "전국상위퍼센트": formatMarkerTopPercent(item.countryRank, item.countryRankTotal)
  };
  return values;
}

function activeMarkerPeriodLabel() {
  const months = typeof currentPeriodMonths === "function" ? currentPeriodMonths() : 12;
  if (months >= 60) return "5년";
  if (months >= 36) return "3년";
  if (months >= 12) return "1년";
  if (months >= 6) return "6개월";
  return "3개월";
}

function renderRegionMarkerTemplateText(template, values) {
  return String(template || "")
    .replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, token) => values[token.trim()] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMarkerRankNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? formatInt(number) : "-";
}

function formatMarkerTopPercent(rank, total) {
  const percentile = growthRankPercentile(rank, total);
  return percentile === null ? "-" : `상위 ${percentile.toFixed(1)}%`;
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

function formatMarkerRankText(rank, total, scope = "region", growthRate = null) {
  const rankNumber = Number(rank);
  const totalNumber = Number(total);
  if (!Number.isFinite(rankNumber)) return "-";
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

function zoomMarkerSize(level = "", design = activeRegionMarkerDesign(level)) {
  const normalizedLevel = normalizeRegionMarkerLevel(level);
  const rowCount = activeRegionMarkerRankLevels(normalizedLevel).length;
  const style = activeRegionMarkerStyle(normalizedLevel, design);
  const width = Math.max(style.outerBoxWidth, style.rankBoxWidth + 16) + 22 + markerRankWidthExtra("region");
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

function markerRankWidthExtra(scope = "region") {
  const options = markerRankDisplayOptions(scope);
  return (options.showTotal ? 18 : 0) + (options.showPercent ? 34 : 0) + (options.showSuffix ? 6 : 0);
}

function zoomMarkerAnchor(level = "", design = activeRegionMarkerDesign(level)) {
  const [width, height] = zoomMarkerSize(level, design);
  return [width / 2, height / 2];
}

function zoomGroupToneRank(item, level = "") {
  if (level === "sido") return [item.countryRank, item.countryRankTotal];
  if (level === "sigungu") return [item.sidoRank, item.sidoRankTotal];
  if (level === "dong") return [item.sigunguRank, item.sigunguRankTotal];
  return [item.countryRank, item.countryRankTotal];
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

function rateClass(rate, rank = null, total = null) {
  return growthRateToneClass(rate, rank, total);
}
