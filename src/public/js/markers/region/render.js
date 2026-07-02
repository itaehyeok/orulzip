function zoomGroupMarkerContentHtml(item, level, design = activeRegionMarkerDesign(level)) {
  const markerDesign = activeRegionMarkerDesign(level) || design;
  const content = regionMarkerResolvedContent(item, level, markerDesign);
  const { rows, labelText, valuePrefixText, valueText, valueSuffixText } = content;
  const layout = regionMarkerAutoLayout(item, level, markerDesign, content);
  const sizeClass = regionMarkerSizeClass(level);
  const markerStyle = [
    mapGrowthMarkerStyleVars(item),
    regionMarkerStyleInline(level, markerDesign),
    regionMarkerAutoLayoutInline(layout)
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
      ${(valuePrefixText || valueText || valueSuffixText) ? `
        <strong class="${mapGrowthMetricToneClass(item, ...zoomGroupToneRank(item, level))}">
          ${valuePrefixText ? `<span class="region-marker-value-prefix">${escapeHtml(valuePrefixText)}</span>` : ""}
          ${valueText ? `<span class="region-marker-value-rate">${escapeHtml(valueText)}</span>` : ""}
          ${valueSuffixText ? `<span class="region-marker-value-suffix">${escapeHtml(valueSuffixText)}</span>` : ""}
        </strong>
      ` : ""}
      ${rows.length ? `
        <span>
          ${rows.map((row) => `
            <em data-rank-level="${escapeHtml(row.rankLevel)}" data-rank-has-label="${row.label ? "true" : "false"}" style="${regionMarkerRankRowStyle(row, layout, level, markerDesign)}">
              ${row.label ? `<b>${escapeHtml(row.label)}</b>` : ""}
              ${row.value ? `<span class="region-marker-rank-value">${escapeHtml(row.value)}</span>` : ""}
            </em>
          `).join("")}
        </span>
      ` : ""}
    </span>
  `;
}

function regionMarkerResolvedContent(item, level, design = activeRegionMarkerDesign(level)) {
  const textConfig = activeRegionMarkerText(level);
  const textContext = zoomGroupMarkerTextContext(item, level, design);
  return {
    rows: zoomGroupMarkerRankRows(item, level, design, textConfig, textContext),
    labelText: renderRegionMarkerText(textConfig.label, textContext),
    valuePrefixText: renderRegionMarkerText(textConfig.valuePrefix, textContext),
    valueText: renderRegionMarkerText(textConfig.value, textContext),
    valueSuffixText: renderRegionMarkerText(textConfig.valueSuffix, textContext)
  };
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

function zoomGroupMarkerRankRows(
  item,
  level,
  design = activeRegionMarkerDesign(level),
  textConfig = activeRegionMarkerText(level),
  textContext = zoomGroupMarkerTextContext(item, level, design)
) {
  const visibleRankLevels = new Set(activeRegionMarkerRankLevels(level));
  return zoomGroupAllRankRows(item, level, design)
    .map((row) => renderRegionMarkerRankRow(textConfig.rankRows?.[row.rankLevel], textContext, row))
    .filter((row) => visibleRankLevels.has(row.rankLevel) && row.rank !== "-" && (row.label || row.value));
}

function zoomGroupAllRankRows(item, level, design = activeRegionMarkerDesign(level)) {
  if (level === "dong") {
    return [
      zoomRankRow("sigungu", zoomRankSigunguLabel(item), "구", item.sigunguRank, item.sigunguRankTotal, design, mapGrowthMetricRankInlineValue(item)),
      zoomRankRow("sido", zoomRankSidoLabel(item), "시", item.sidoRank, item.sidoRankTotal, design, mapGrowthMetricRankInlineValue(item)),
      zoomRankRow("national", "전국", "전국", item.countryRank, item.countryRankTotal, design, mapGrowthMetricRankInlineValue(item))
    ];
  }
  if (level === "sigungu") {
    return [
      zoomRankRow("sido", zoomRankSidoLabel(item), "시", item.sidoRank, item.sidoRankTotal, design, mapGrowthMetricRankInlineValue(item)),
      zoomRankRow("national", "전국", "전국", item.countryRank, item.countryRankTotal, design, mapGrowthMetricRankInlineValue(item))
    ];
  }
  return [
    zoomRankRow("national", "전국", "전국", item.countryRank, item.countryRankTotal, design, mapGrowthMetricRankInlineValue(item))
  ];
}

function zoomRankRow(rankLevel, label, shortLabel, rank, total, design = activeRegionMarkerDesign(), growthRate = null) {
  const rankText = formatMarkerRankText(rank, total, "region", growthRate);
  return {
    rankLevel,
    label: compactRankLabel(label, shortLabel, design),
    rank: rankText,
    value: rankText,
    text: `${compactRankLabel(label, shortLabel, design)} ${rankText}`
  };
}

function zoomGroupMarkerTextContext(item, level, design = activeRegionMarkerDesign(level)) {
  const sigunguLabel = zoomRankSigunguLabel(item);
  const sidoLabel = zoomRankSidoLabel(item);
  return {
    item,
    level,
    design,
    dongName: level === "dong" ? zoomGroupCurrentLabel(item, "dong") : shortZoomLabel(item.dongName || item.name, "dong"),
    sigunguName: level === "sigungu" ? zoomGroupCurrentLabel(item, "sigungu") : sigunguLabel,
    sidoName: level === "sido" ? zoomGroupCurrentLabel(item, "sido") : sidoLabel,
    periodLabel: activeMarkerPeriodLabel(),
    metricLabel: mapGrowthMetricLabel(),
    metricValueText: formatMapGrowthMetricValue(item),
    growthRate: item.growthRate,
    growthRateText: formatPercent(item.growthRate),
    sigunguRankText: formatMarkerRankText(item.sigunguRank, item.sigunguRankTotal, "region", mapGrowthMetricRankInlineValue(item)),
    sigunguRankRatioText: formatMarkerRankRatioText(item.sigunguRank, item.sigunguRankTotal),
    sigunguRank: formatMarkerRankNumber(item.sigunguRank),
    sigunguRankTotal: formatMarkerRankNumber(item.sigunguRankTotal),
    sigunguTopPercent: formatMarkerTopPercent(item.sigunguRank, item.sigunguRankTotal),
    sigunguTopPercentShort: formatMarkerTopPercentShort(item.sigunguRank, item.sigunguRankTotal),
    sidoRankText: formatMarkerRankText(item.sidoRank, item.sidoRankTotal, "region", mapGrowthMetricRankInlineValue(item)),
    sidoRankRatioText: formatMarkerRankRatioText(item.sidoRank, item.sidoRankTotal),
    sidoRank: formatMarkerRankNumber(item.sidoRank),
    sidoRankTotal: formatMarkerRankNumber(item.sidoRankTotal),
    sidoTopPercent: formatMarkerTopPercent(item.sidoRank, item.sidoRankTotal),
    sidoTopPercentShort: formatMarkerTopPercentShort(item.sidoRank, item.sidoRankTotal),
    countryRankText: formatMarkerRankText(item.countryRank, item.countryRankTotal, "region", mapGrowthMetricRankInlineValue(item)),
    countryRankRatioText: formatMarkerRankRatioText(item.countryRank, item.countryRankTotal),
    countryRank: formatMarkerRankNumber(item.countryRank),
    countryRankTotal: formatMarkerRankNumber(item.countryRankTotal),
    countryTopPercent: formatMarkerTopPercent(item.countryRank, item.countryRankTotal),
    countryTopPercentShort: formatMarkerTopPercentShort(item.countryRank, item.countryRankTotal),
    countryTopPercentWithTopRankText: formatMarkerTopPercentWithTopRank(item.countryRank, item.countryRankTotal)
  };
}

function activeMarkerPeriodLabel() {
  const months = typeof currentPeriodMonths === "function" ? currentPeriodMonths() : 12;
  if (months >= 60) return "5년";
  if (months >= 36) return "3년";
  if (months >= 12) return "1년";
  if (months >= 6) return "6개월";
  return "3개월";
}

function renderRegionMarkerText(value, context, fallback = "") {
  const text = typeof value === "function" ? value(context) : (value ?? fallback);
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function renderRegionMarkerRankRow(value, context, fallbackRow) {
  const rendered = typeof value === "function" ? value(context) : value;
  if (rendered && typeof rendered === "object") {
    const label = rendered.label ?? fallbackRow.label ?? "";
    const rowValue = rendered.value ?? fallbackRow.value ?? fallbackRow.rank ?? "";
    return {
      ...fallbackRow,
      label: String(label || "").replace(/\s+/g, " ").trim(),
      value: String(rowValue || "").replace(/\s+/g, " ").trim(),
      text: [label, rowValue].filter(Boolean).join(" ")
    };
  }
  const text = renderRegionMarkerText(value, context, fallbackRow.text);
  return {
    ...fallbackRow,
    label: "",
    value: text,
    text
  };
}

function formatMarkerTopPercentWithTopRank(rank, total) {
  const percentText = formatMarkerTopPercentShort(rank, total);
  const rankNumber = Number(rank);
  if (!Number.isFinite(rankNumber) || rankNumber <= 0 || rankNumber > 20 || percentText === "-") {
    return percentText;
  }
  return `${percentText}(${formatInt(rankNumber)}등)`;
}

function regionMarkerAutoLayoutInline(layout) {
  return [
    `--region-marker-outer-width:${layout.outerBoxWidth}px`,
    `--region-marker-rank-box-width:${layout.rankBoxWidth}px`
  ].join(";");
}

function regionMarkerRankRowStyle(row, layout, level, design = activeRegionMarkerDesign(level)) {
  const style = activeRegionMarkerStyle(normalizeRegionMarkerLevel(level), design);
  const baseFontSize = Math.min(regionMarkerRankLabelFontSize(row.rankLevel, style), style.rankValueFontSize);
  const rowWidth = estimateRegionMarkerRankRowWidth(row, baseFontSize, baseFontSize);
  const availableWidth = Math.max(1, layout.rankBoxWidth - 12);
  const nextFontSize = rowWidth > availableWidth
    ? clampNumber(Math.floor((baseFontSize * availableWidth / rowWidth) * 10) / 10, 5, baseFontSize)
    : baseFontSize;
  return `--region-marker-row-font-size:${nextFontSize}px`;
}

function regionMarkerAutoLayout(item, level, design = activeRegionMarkerDesign(level), content = null) {
  const normalizedLevel = normalizeRegionMarkerLevel(level);
  const style = activeRegionMarkerStyle(normalizedLevel, design);
  const resolvedContent = content || regionMarkerResolvedContent(item, normalizedLevel, design);
  const rankBoxWidth = autoRegionMarkerRankBoxWidth(resolvedContent.rows, style);
  const topTextWidth = Math.max(
    estimateRegionMarkerTextWidth(resolvedContent.labelText, style.labelFontSize),
    estimateRegionMarkerTextWidth(resolvedContent.valuePrefixText, style.valuePrefixFontSize),
    estimateRegionMarkerTextWidth(resolvedContent.valueText, style.valueFontSize),
    estimateRegionMarkerTextWidth(resolvedContent.valueSuffixText, style.valueSuffixFontSize)
  );
  const outerBoxWidth = clampNumber(
    Math.ceil(Math.max(topTextWidth + 16, rankBoxWidth + 16)),
    autoRegionMarkerMinOuterWidth(normalizedLevel),
    autoRegionMarkerMaxOuterWidth(normalizedLevel)
  );
  return {
    outerBoxWidth,
    rankBoxWidth: Math.min(rankBoxWidth, Math.max(0, outerBoxWidth - 16))
  };
}

function autoRegionMarkerRankBoxWidth(rows, style) {
  const rowWidth = Math.max(0, ...rows.map((row) => {
    return estimateRegionMarkerRankRowWidth(
      row,
      regionMarkerRankLabelFontSize(row.rankLevel, style),
      style.rankValueFontSize
    ) + 18;
  }));
  return clampNumber(Math.ceil(rowWidth), 62, 128);
}

function estimateRegionMarkerRankRowWidth(row, labelFontSize, valueFontSize) {
  const labelWidth = estimateRegionMarkerTextWidth(row.label, labelFontSize);
  const valueWidth = estimateRegionMarkerTextWidth(row.value, valueFontSize);
  const gap = row.label && row.value ? 5 : 0;
  return labelWidth + valueWidth + gap;
}

function regionMarkerRankLabelFontSize(rankLevel, style) {
  if (rankLevel === "sigungu") return style.sigunguFontSize;
  if (rankLevel === "sido") return style.sidoFontSize;
  if (rankLevel === "national") return style.nationalFontSize;
  return style.rankValueFontSize;
}

function estimateRegionMarkerTextWidth(text, fontSize) {
  const size = Number(fontSize);
  if (!text || !Number.isFinite(size)) return 0;
  return Array.from(String(text)).reduce((sum, char) => {
    if (/\s/.test(char)) return sum + (size * 0.35);
    if (/[0-9]/.test(char)) return sum + (size * 0.58);
    if (/[a-zA-Z]/.test(char)) return sum + (size * 0.62);
    if (/[.%/()+-]/.test(char)) return sum + (size * 0.42);
    return sum + size;
  }, 0);
}

function autoRegionMarkerMinOuterWidth(level) {
  if (level === "sido") return 72;
  if (level === "sigungu") return 88;
  return 92;
}

function autoRegionMarkerMaxOuterWidth(level) {
  if (level === "sido") return 108;
  if (level === "sigungu") return 118;
  return 126;
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function zoomMarkerSize(level = "", design = activeRegionMarkerDesign(level), item = null) {
  const normalizedLevel = normalizeRegionMarkerLevel(level);
  const rowCount = activeRegionMarkerRankLevels(normalizedLevel).length;
  const style = activeRegionMarkerStyle(normalizedLevel, design);
  const textConfig = activeRegionMarkerText(normalizedLevel);
  const hasValuePrefix = Boolean(textConfig.valuePrefix);
  const hasValueSuffix = Boolean(textConfig.valueSuffix);
  const layout = item ? regionMarkerAutoLayout(item, normalizedLevel, design) : null;
  const rankWidthExtra = item ? 0 : markerRankWidthExtra("region");
  const rankBoxWidth = layout?.rankBoxWidth ?? (typeof effectiveRegionMarkerRankBoxWidth === "function"
    ? effectiveRegionMarkerRankBoxWidth(style, rankWidthExtra)
    : style.rankBoxWidth + rankWidthExtra);
  const outerBoxWidth = layout?.outerBoxWidth ?? (style.outerBoxWidth + rankWidthExtra);
  const width = Math.max(outerBoxWidth, rankBoxWidth + 16) + 22;
  const rankRowsHeight = rowCount
    ? (rowCount * style.rankRowHeight) + (Math.max(0, rowCount - 1) * style.rankRowGap)
    : 0;
  const valueBlockHeight =
    (hasValuePrefix ? (style.valuePrefixFontSize * 1.05) + 2 : 0)
    + (style.valueFontSize * 0.96)
    + (hasValueSuffix ? style.valueSuffixGap + (style.valueSuffixFontSize * 1.05) : 0);
  const contentHeight = 20
    + (style.labelFontSize * 1.05)
    + style.labelRateGap
    + valueBlockHeight
    + (rowCount ? style.valueRankGap + rankRowsHeight : 0);
  const height = Math.max(54, Math.ceil(contentHeight + 24));
  return [width, height];
}

function zoomMarkerAnchor(level = "", design = activeRegionMarkerDesign(level), item = null) {
  const [width, height] = zoomMarkerSize(level, design, item);
  return [width / 2, height / 2];
}

function zoomGroupToneRank(item, level = "") {
  if (level === "sido") return [item.countryRank, item.countryRankTotal];
  if (level === "sigungu") return [item.sidoRank, item.sidoRankTotal];
  if (level === "dong") return [item.sigunguRank, item.sigunguRankTotal];
  return [item.countryRank, item.countryRankTotal];
}
