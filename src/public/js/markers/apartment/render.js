function apartmentMarkerHtml(item, design = activeApartmentMarkerDesign()) {
  const hasData = item.hasData !== false;
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
    <div class="apartment-map-marker apartment-rank-marker ${escapeHtml(design.className)} ${hasData ? "" : "no-data"} ${isSelected ? "selected" : ""}" data-map-apartment-marker-id="${escapeHtml(item.id || "")}" data-apartment-marker-border="${style.borderEnabled ? "on" : "off"}" data-apartment-marker-shadow="${style.shadowEnabled ? "on" : "off"}" style="--marker-color:${growthColor(item.growthRate)}; ${apartmentMarkerStyleInline(design)}">
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
    rank: formatApartmentRankPercent(rank, total)
  };
}

function formatApartmentRankPercent(rank, total) {
  const rankNumber = Number(rank);
  const totalNumber = Number(total);
  if (!Number.isFinite(rankNumber) || !Number.isFinite(totalNumber) || totalNumber <= 0) return "-";
  const percent = (rankNumber / totalNumber) * 100;
  const formatted = percent < 0.1 ? "<0.1" : percent < 10 ? percent.toFixed(1) : String(Math.round(percent));
  return `상위 ${formatted}%`;
}

function apartmentMarkerAreaLabel(item = {}) {
  const value = String(item.areaSummary || "").trim();
  return value;
}

function apartmentMarkerIconSize(design = activeApartmentMarkerDesign()) {
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

function apartmentMarkerIconAnchor(size, design = activeApartmentMarkerDesign()) {
  const style = activeApartmentMarkerStyle(design);
  const [, height] = size;
  const y = Math.max(10, Math.min(height - 4, height - 18 + style.tailOffset));
  return [0, y];
}
