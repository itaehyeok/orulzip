function apartmentMarkerHtml(item, design = activeApartmentMarkerDesign()) {
  if (activeApartmentMarkerMode() === "legacy") return apartmentMarkerLegacyHtml(item, design);
  return apartmentMarkerRegionLikeHtml(item, design);
}

function apartmentMarkerLegacyHtml(item, design = activeApartmentMarkerDesign()) {
  const hasData = item.hasData !== false;
  if (!hasData) return apartmentMarkerNoDataHtml(item);
  const display = activeApartmentMarkerDisplay();
  const style = activeApartmentMarkerStyle(design);
  const rankLines = apartmentMarkerRankLines(item);
  const isSelected = item.id && item.id === state.focusedMapApartmentId;
  const name = String(item.name || "").trim();
  const area = apartmentMarkerAreaLabel(item);
  const detailRows = [
    display.name && name ? `<small class="apartment-marker-name-row" data-apartment-marker-info="name">${escapeHtml(name)}</small>` : "",
    display.area && area ? `<small class="apartment-marker-area-row" data-apartment-marker-info="area">${escapeHtml(area)}</small>` : "",
    display.rate ? `<strong class="apartment-marker-rate-row ${growthRateToneClass(item.growthRate, item.countryRank, item.countryRankTotal)}" data-apartment-marker-info="rate">${hasData ? formatPercent(item.growthRate) : "데이터없음"}</strong>` : ""
  ].filter(Boolean).join("");
  return `
    <div class="apartment-map-marker apartment-rank-marker ${escapeHtml(design.className)} ${hasData ? "" : "no-data"} ${isSelected ? "selected" : ""}" data-map-apartment-marker-id="${escapeHtml(item.id || "")}" data-selected-apartment-name="${escapeHtml(name)}" data-apartment-marker-border="${style.borderEnabled ? "on" : "off"}" data-apartment-marker-shadow="${style.shadowEnabled ? "on" : "off"}" style="--marker-color:${growthColor(item.growthRate)}; ${apartmentMarkerStyleInline(design)}">
      ${detailRows}
      ${rankLines.length ? `
        <span class="apartment-marker-rank-list">
          ${rankLines.map((line) => `
            <em data-rank-level="${escapeHtml(line.key)}"><b>${escapeHtml(line.label)}</b> ${escapeHtml(line.rank)}</em>
          `).join("")}
        </span>
      ` : ""}
    </div>
  `;
}

function apartmentMarkerRegionLikeHtml(item, design = activeApartmentMarkerDesign()) {
  const hasData = item.hasData !== false;
  if (!hasData) return apartmentMarkerNoDataHtml(item);
  const display = activeApartmentMarkerDisplay();
  const style = activeApartmentMarkerStyle(design);
  const rankLines = hasData ? apartmentMarkerRankLines(item) : [];
  const isSelected = item.id && item.id === state.focusedMapApartmentId;
  const name = String(item.name || "").trim();
  const area = apartmentMarkerAreaLabel(item);
  const markerClasses = [
    "apartment-map-marker",
    "apartment-rank-marker",
    "apartment-marker-region-like",
    "rank-chip-white",
    hasData ? "" : "no-data",
    isSelected ? "selected" : ""
  ].filter(Boolean).join(" ");
  const detailRows = [
    display.name && name ? `<small class="apartment-marker-name-row" data-apartment-marker-info="name">${escapeHtml(name)}</small>` : "",
    display.area && area ? `<small class="apartment-marker-area-row" data-apartment-marker-info="area">${escapeHtml(area)}</small>` : "",
    display.rate ? `<strong class="apartment-marker-rate-row ${hasData ? growthRateToneClass(item.growthRate, item.countryRank, item.countryRankTotal) : ""}" data-apartment-marker-info="rate">${hasData ? formatPercent(item.growthRate) : "데이터없음"}</strong>` : ""
  ].filter(Boolean).join("");
  return `
    <div class="${markerClasses}" data-map-apartment-marker-id="${escapeHtml(item.id || "")}" data-selected-apartment-name="${escapeHtml(name)}" data-apartment-marker-border="off" data-apartment-marker-shadow="off" style="--marker-color:${growthColor(item.growthRate)}; ${apartmentMarkerRegionStyleInline(item, design)}">
      ${detailRows}
      ${rankLines.length ? `
        <span class="apartment-marker-rank-list">
          ${rankLines.map((line) => `
            <em data-rank-level="${escapeHtml(line.key)}" data-rank-has-label="${line.label ? "true" : "false"}" style="${apartmentMarkerRankRowStyle(line, style)}">
              ${line.label ? `<b>${escapeHtml(line.label)}</b>` : ""}
              <span class="apartment-marker-rank-value">${escapeHtml(line.rank)}</span>
            </em>
          `).join("")}
        </span>
      ` : ""}
    </div>
  `;
}

function apartmentMarkerNoDataHtml(item = {}) {
  const isSelected = item.id && item.id === state.focusedMapApartmentId;
  const name = String(item.name || "").trim();
  return `
    <div class="apartment-map-marker apartment-rank-marker apartment-marker-no-data no-data ${isSelected ? "selected" : ""}" data-map-apartment-marker-id="${escapeHtml(item.id || "")}" data-selected-apartment-name="${escapeHtml(name)}" data-apartment-marker-border="off" data-apartment-marker-shadow="off" style="--marker-color:${growthColor(item.growthRate)};">
      <span class="apartment-marker-no-data-period">${escapeHtml(apartmentMarkerNoDataPeriodLabel())}</span>
      <strong class="apartment-marker-no-data-message">거래 없음</strong>
    </div>
  `;
}

function apartmentMarkerNoDataPeriodLabel() {
  const label = typeof activeMarkerPeriodLabel === "function" ? activeMarkerPeriodLabel() : "1년";
  return `${String(label || "1년").replace(/전$/, "")}전`;
}

function apartmentMarkerRankLines(item) {
  const activeRankKeys = new Set(activeApartmentMarkerRankKeys());
  return apartmentMarkerAllRankRows(item)
    .filter((row) => activeRankKeys.has(row.key))
    .filter((row) => row.rank !== "-");
}

function apartmentMarkerAllRankRows(item) {
  const dongLabel = shortDongLabel(item.dongName || item.neighborhoodName || "동");
  const sigunguLabel = shortZoomLabel(item.sigunguName || item.address || "", "sigungu") || "구";
  const sidoLabel = zoomRankSidoLabel(item);
  return [
    apartmentRankRow("dong", dongLabel, item.dongRank, item.dongRankTotal, item.growthRate),
    apartmentRankRow("sigungu", sigunguLabel, item.sigunguRank, item.sigunguRankTotal, item.growthRate),
    apartmentRankRow("sido", sidoLabel, item.sidoRank, item.sidoRankTotal, item.growthRate),
    apartmentRankRow("national", "전국", item.countryRank, item.countryRankTotal, item.growthRate),
    apartmentRankPercentRow("nationalPercent", "전국", item.countryRank, item.countryRankTotal)
  ];
}

function apartmentRankRow(key, label, rank, total, growthRate = null) {
  return {
    key,
    label,
    rank: formatMarkerRankText(rank, total, "apartment", growthRate)
  };
}

function apartmentRankPercentRow(key, label, rank, total) {
  return {
    key,
    label,
    rank: activeApartmentMarkerMode() === "legacy" ? formatApartmentRankPercent(rank, total) : formatApartmentRankPercentShort(rank, total)
  };
}

function formatApartmentRankPercent(rank, total) {
  return formatRankTopPercent(rank, total, { prefix: "상위 " });
}

function formatApartmentRankPercentShort(rank, total) {
  return formatRankTopPercent(rank, total);
}

function apartmentMarkerAreaLabel(item = {}) {
  const value = String(item.areaSummary || "").trim();
  return value;
}

function apartmentMarkerIconSize(design = activeApartmentMarkerDesign(), item = null) {
  if (item?.hasData === false) return apartmentMarkerNoDataIconSize();
  if (activeApartmentMarkerMode() !== "legacy") return apartmentMarkerRegionIconSize(item, design);
  const style = activeApartmentMarkerStyle(design);
  const display = activeApartmentMarkerDisplay();
  const rankCount = activeApartmentMarkerRankKeys().length;
  const lineGap = (display.name ? style.nameAreaGap : 0) + (display.area ? style.areaRateGap : 0);
  const textHeight =
    (display.name ? style.nameFontSize + 4 : 0)
    + (display.area ? style.areaFontSize + 4 : 0)
    + (display.rate ? style.valueFontSize + 4 : 0)
    + lineGap;
  const rankHeight = rankCount
    ? style.valueRankGap + (rankCount * style.rankRowHeight) + Math.max(0, rankCount - 1) * style.rankRowGap
    : 0;
  const height = Math.ceil(18 + textHeight + rankHeight + 24 + 18);
  return [style.outerBoxWidth + markerRankWidthExtra("apartment"), Math.max(52, height)];
}

function apartmentMarkerIconAnchor(size, design = activeApartmentMarkerDesign(), item = null) {
  if (item?.hasData === false) return [size[0] / 2, size[1] / 2];
  if (activeApartmentMarkerMode() !== "legacy") return [size[0] / 2, size[1] / 2];
  const style = activeApartmentMarkerStyle(design);
  const [, height] = size;
  const y = Math.max(10, Math.min(height - 4, height - 18 + style.tailOffset));
  return [0, y];
}

function apartmentMarkerNoDataIconSize() {
  return [68, 38];
}

function apartmentMarkerRegionStyleInline(item, design = activeApartmentMarkerDesign()) {
  return Object.entries(apartmentMarkerRegionStyleVars(item, design))
    .map(([property, value]) => `${property}: ${value}`)
    .join("; ");
}

function apartmentMarkerRegionStyleVars(item, design = activeApartmentMarkerDesign()) {
  const style = activeApartmentMarkerStyle(design);
  const layout = apartmentMarkerRegionLayout(item, style);
  return {
    "--apartment-marker-outer-width": `${layout.outerBoxWidth}px`,
    "--apartment-marker-rank-box-width": `${layout.rankBoxWidth}px`,
    "--apartment-marker-name-font-size": "8px",
    "--apartment-marker-area-font-size": "7px",
    "--apartment-marker-value-font-size": "14px",
    "--apartment-marker-rank-dong-font-size": "7px",
    "--apartment-marker-rank-sigungu-font-size": "7px",
    "--apartment-marker-rank-sido-font-size": "7px",
    "--apartment-marker-rank-national-font-size": "7px",
    "--apartment-marker-rank-national-percent-font-size": "7px",
    "--apartment-marker-rank-value-font-size": "7px",
    "--apartment-marker-name-area-gap": "2px",
    "--apartment-marker-area-rate-gap": "4px",
    "--apartment-marker-value-rank-gap": "5px",
    "--apartment-marker-rank-row-gap": "3px",
    "--apartment-marker-rank-row-height": "16px"
  };
}

function apartmentMarkerRegionLayout(item, style = activeApartmentMarkerStyle()) {
  const hasData = item?.hasData !== false;
  const display = activeApartmentMarkerDisplay();
  const rows = hasData ? apartmentMarkerRankLines(item) : [];
  const rateText = hasData ? formatPercent(item?.growthRate) : "데이터없음";
  const topTextWidth = Math.max(
    display.name ? estimateRegionMarkerTextWidth(String(item?.name || ""), 8) : 0,
    display.area ? estimateRegionMarkerTextWidth(apartmentMarkerAreaLabel(item), 7) : 0,
    display.rate ? estimateRegionMarkerTextWidth(rateText, 14) : 0
  );
  const rankBoxWidth = apartmentMarkerRegionRankBoxWidth(rows, style);
  const outerBoxWidth = clampNumber(Math.ceil(Math.max(topTextWidth + 16, rankBoxWidth + 16)), 88, 126);
  return {
    outerBoxWidth,
    rankBoxWidth: Math.min(rankBoxWidth, Math.max(0, outerBoxWidth - 16))
  };
}

function apartmentMarkerRegionRankBoxWidth(rows, style) {
  const rowWidth = Math.max(0, ...rows.map((row) => {
    const labelWidth = estimateRegionMarkerTextWidth(row.label, 7);
    const valueWidth = estimateRegionMarkerTextWidth(row.rank, 7);
    return labelWidth + valueWidth + (row.label ? 5 : 0) + 18;
  }));
  return clampNumber(Math.ceil(rowWidth), 62, 128);
}

function apartmentMarkerRankRowStyle(line, style) {
  const rowWidth = estimateRegionMarkerTextWidth(line.label, 7) + estimateRegionMarkerTextWidth(line.rank, 7) + (line.label ? 5 : 0);
  const availableWidth = Math.max(1, apartmentMarkerRegionRankBoxWidth([line], style) - 12);
  const fontSize = rowWidth > availableWidth
    ? clampNumber(Math.floor((7 * availableWidth / rowWidth) * 10) / 10, 5, 7)
    : 7;
  return `--apartment-marker-row-font-size:${fontSize}px`;
}

function apartmentMarkerRegionIconSize(item, design = activeApartmentMarkerDesign()) {
  const layout = apartmentMarkerRegionLayout(item, activeApartmentMarkerStyle(design));
  const display = activeApartmentMarkerDisplay();
  const rankCount = item?.hasData === false ? 0 : apartmentMarkerRankLines(item || {}).length;
  const nameHeight = display.name ? 10 : 0;
  const areaHeight = display.area ? 9 : 0;
  const rateHeight = display.rate ? 14 : 0;
  const rankHeight = rankCount ? 5 + (rankCount * 16) + Math.max(0, rankCount - 1) * 3 : 0;
  const height = Math.max(54, Math.ceil(20 + nameHeight + areaHeight + rateHeight + rankHeight + 18));
  return [layout.outerBoxWidth + 22, height];
}
