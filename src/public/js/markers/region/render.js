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
