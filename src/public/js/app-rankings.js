function applyQuickPeriod(years) {
  applyQuickPeriodMonths(Math.max(1, Math.round(Number(years || 1) * 12)));
}

const priceBandPeriodOptions = [
  { value: 3, label: "3개월 전" },
  { value: 6, label: "6개월 전" },
  { value: 12, label: "1년 전" },
  { value: 36, label: "3년 전" },
  { value: 60, label: "5년 전" }
];

function applyQuickPeriodMonths(months) {
  if (!state.months.length) return;
  const end = state.months.at(-1);
  const endDate = parseMonth(end);
  const target = new Date(endDate);
  target.setMonth(target.getMonth() - Math.max(1, Number(months) || 12));
  els.endInput.value = toMonthInput(end);
  els.startInput.value = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
}

function setPeriodYears(years) {
  setPeriodMonths(Math.max(1, Math.round(Number(years || 1) * 12)));
}

function setPeriodMonths(months) {
  applyQuickPeriodMonths(months);
  syncPeriodButtons(months);
}

function syncPeriodButtons(activeMonths = currentPeriodMonths()) {
  document.querySelectorAll("[data-period-months], [data-period-years]").forEach((button) => {
    button.classList.toggle("active", periodButtonMonths(button) === activeMonths);
  });
  document.querySelectorAll("[data-period-select], [data-price-band-period-select]").forEach((select) => {
    if (select.value !== String(activeMonths)) select.value = String(activeMonths);
  });
}

function currentPeriodMonths() {
  if (!els.startInput.value || !els.endInput.value) return 12;
  const start = new Date(`${els.startInput.value}-01`);
  const end = new Date(`${els.endInput.value}-01`);
  const monthDiff = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
  if (monthDiff >= 54) return 60;
  if (monthDiff >= 30) return 36;
  if (monthDiff >= 9) return 12;
  if (monthDiff >= 5) return 6;
  return 3;
}

function periodButtonMonths(button) {
  const months = Number(button.dataset.periodMonths);
  if (Number.isFinite(months) && months > 0) return Math.round(months);
  const years = Number(button.dataset.periodYears);
  return Math.max(1, Math.round((Number.isFinite(years) && years > 0 ? years : 1) * 12));
}

function currentMapPeriodParams() {
  return {
    start: els.startInput.value ? els.startInput.value.replace("-", "") : "",
    end: els.endInput.value ? els.endInput.value.replace("-", "") : ""
  };
}

function visiblePageNumbers(page, totalPages) {
  const pages = new Set([1, totalPages]);
  for (let value = page - 2; value <= page + 2; value += 1) {
    if (value >= 1 && value <= totalPages) pages.add(value);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];
  for (const value of sorted) {
    if (result.length && value - result.at(-1) > 1) result.push("...");
    result.push(value);
  }
  return result;
}

function periodStartMonth(endMonth, years) {
  const startDate = parseMonth(endMonth);
  startDate.setFullYear(startDate.getFullYear() - years);
  return `${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, "0")}`;
}

function renderNeighborhoodTable(result) {
  els.neighborhoodCount.textContent = `${result.rows.length}개 동`;
  els.neighborhoodRows.innerHTML = result.rows.length
    ? result.rows.map((row) => `
      <tr>
        <td>${row.rank}</td>
        <td>${escapeHtml(row.neighborhoodName)}</td>
        <td>${formatInt(row.apartmentAreaCount)}</td>
        <td>${formatMoney(row.startPyeongPrice)}</td>
        <td>${formatMoney(row.endPyeongPrice)}</td>
        <td class="${row.growthAmount >= 0 ? "positive" : "negative"}">${formatMoney(row.growthAmount)}</td>
        <td>${renderGrowthRateText(row.growthRate, row.rank, result.rows.length)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="7" class="empty">표시할 동네 데이터가 없습니다.</td></tr>`;
}

function renderPriceBandTable(result, basisBands = null) {
  els.priceBandView?.removeAttribute("aria-busy");
  state.priceBandStartKey = result.selection?.startBandKey === null || result.selection?.startBandKey === undefined
    ? ""
    : String(result.selection.startBandKey);
  state.priceBandEndKey = result.selection?.endBandKey === null || result.selection?.endBandKey === undefined
    ? ""
    : String(result.selection.endBandKey);
  state.priceBandAreaKey = result.selection?.areaBandKey || state.priceBandAreaKey || "all";
  const rows = Array.isArray(result.rows) ? result.rows : [];
  const bands = Array.isArray(result.bands) ? result.bands : [];
  const areaBands = Array.isArray(result.areaBands) ? result.areaBands : [];
  const summaryBands = basisBands || {
    start: result.basis === "start" ? bands : [],
    end: result.basis === "end" ? bands : []
  };
  const pagination = result.pagination || {
    page: 1,
    pageSize: rows.length || state.priceBandPageSize,
    totalRows: rows.length,
    totalPages: 1
  };
  state.priceBandPage = pagination.page;
  const start = pagination.totalRows ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const end = pagination.totalRows ? Math.min(pagination.page * pagination.pageSize, pagination.totalRows) : 0;
  const selectedStartBand = findPriceBand(summaryBands.start, state.priceBandStartKey) || fallbackPriceBand(state.priceBandStartKey);
  const selectedEndBand = findPriceBand(summaryBands.end, state.priceBandEndKey) || fallbackPriceBand(state.priceBandEndKey);
  const selectedAreaBand = findPriceAreaBand(areaBands, state.priceBandAreaKey);
  const periodLabel = result.period?.startMonth && result.period?.endMonth
    ? `${formatMonth(result.period.startMonth)} - ${formatMonth(result.period.endMonth)}`
    : "";
  const cacheLabel = formatPriceBandCacheLabel(result.cache);
  const householdLabel = householdFilterLabel();
  const selectionLabel = priceBandSelectionLabel(selectedStartBand, selectedEndBand);
  els.priceBandCount.textContent = `${selectionLabel} · ${selectedAreaBand?.label || "전체 평형"} · ${householdLabel} · ${formatInt(pagination.totalRows)}개${periodLabel ? ` · ${periodLabel}` : ""}${pagination.totalRows ? ` · ${formatInt(start)}-${formatInt(end)}` : ""}${cacheLabel ? ` · ${cacheLabel}` : ""}`;
  renderPriceBandSummary(summaryBands, areaBands, state.priceBandStartKey, state.priceBandEndKey, state.priceBandAreaKey, pagination.totalRows);
  els.priceBandRows.innerHTML = rows.length
    ? rows.map((row) => {
      const mapLink = priceBandMapApartmentLink(row);
      const isSelected = state.priceBandDetailApartmentId && String(state.priceBandDetailApartmentId) === String(row.apartmentId || "");
      return `
      <tr class="clickable-row${isSelected ? " selected" : ""}" data-price-band-detail-row data-price-band-apartment-id="${escapeHtml(row.apartmentId || "")}">
        <td>${row.rank}</td>
        <td>
          <strong class="table-main">${escapeHtml(row.apartmentName)}</strong>
          <span class="muted-cell">${escapeHtml(priceBandApartmentMeta(row))}</span>
          <span class="table-links">
            <a href="${escapeHtml(mapLink)}" data-price-band-map-link>지도에서 보기</a>
            <a href="${escapeHtml(naverApartmentLink(row))}" target="_blank" rel="noopener noreferrer">네이버지도</a>
            <a href="${escapeHtml(hogangnonoApartmentLink(row))}" target="_blank" rel="noopener noreferrer">호갱노노</a>
          </span>
        </td>
        <td>${escapeHtml(formatPriceBandLocation(row))}</td>
        <td>${renderPriceBandAreaBreakdownCell(row)}</td>
      </tr>
    `;
    }).join("")
    : `<tr><td colspan="4" class="empty">선택한 가격대에 표시할 아파트 데이터가 없습니다.</td></tr>`;
  renderPriceBandPagination(pagination);
  bindPriceBandAreaMoreToggles();
  bindPriceBandMapLinks(rows);
}

function bindPriceBandAreaMoreToggles() {
  els.priceBandRows?.querySelectorAll(".price-band-area-more-toggle").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const rows = button.closest(".price-band-area-breakdown")?.querySelector(".price-band-area-more-rows");
      if (!rows) return;
      const isOpen = button.getAttribute("aria-expanded") === "true";
      rows.hidden = isOpen;
      button.setAttribute("aria-expanded", isOpen ? "false" : "true");
      const action = button.querySelector(".price-band-area-more-action");
      if (action) action.textContent = isOpen ? "보기" : "접기";
    });
  });
}

function bindPriceBandMapLinks(rows = []) {
  const rowByApartmentId = new Map(rows.map((row) => [String(row.apartmentId || ""), row]).filter(([id]) => id));
  els.priceBandRows?.querySelectorAll("[data-price-band-map-link]").forEach((link) => {
    link.addEventListener("click", async (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      await openPriceBandMapDetailLink(link.getAttribute("href") || "");
    });
  });
  els.priceBandRows?.querySelectorAll("[data-price-band-detail-row]").forEach((row) => {
    row.addEventListener("click", async (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      if (event.target.closest("a, button, select, input, textarea, [role='button']")) return;
      const item = rowByApartmentId.get(String(row.dataset.priceBandApartmentId || ""));
      if (!item) return;
      await openPriceBandApartmentDetail(item);
    });
  });
}

async function openPriceBandMapDetailLink(href) {
  const normalizedHref = String(href || "").trim();
  if (!normalizedHref) return;
  closePriceBandApartmentDetail();
  window.history.pushState({ tab: "molitMap" }, "", normalizedHref);
  await activateTab("molitMap", { push: false });
}

async function openPriceBandApartmentDetail(row) {
  const apartmentId = String(row?.apartmentId || "").trim();
  if (!apartmentId || !els.priceBandDetailPanel) return;
  const requestId = ++state.priceBandDetailRequestId;
  state.priceBandDetailApartmentId = apartmentId;
  state.mapPopupDetail = null;
  state.mapPopupSelectedAreaTypeId = null;
  state.mapPopupPreferredAreaM2 = priceBandRepresentativeAreaM2(row);
  state.mapPopupPreferredApartmentId = state.mapPopupPreferredAreaM2 ? apartmentId : null;
  updatePriceBandSelectedRow(apartmentId);
  renderPriceBandApartmentLoading(row);

  const period = currentMapPeriodParams();
  const minHouseholdCount = activeMinHouseholdCount();
  const cacheKey = `molit:${apartmentId}:${period.start}:${period.end}:${minHouseholdCount}`;
  if (state.mapApartmentDetails.has(cacheKey)) {
    if (requestId !== state.priceBandDetailRequestId) return;
    renderPriceBandApartmentDetail(state.mapApartmentDetails.get(cacheKey));
    return;
  }

  try {
    const params = new URLSearchParams({
      apartmentId,
      start: period.start,
      end: period.end,
      minHouseholdCount: String(minHouseholdCount)
    });
    const detail = await api(`/api/molit-apartment-detail?${params}`);
    if (requestId !== state.priceBandDetailRequestId) return;
    state.mapApartmentDetails.set(cacheKey, detail);
    renderPriceBandApartmentDetail(detail);
  } catch (error) {
    if (requestId !== state.priceBandDetailRequestId) return;
    renderPriceBandApartmentError(row, error);
  }
}

function renderPriceBandApartmentLoading(row) {
  withPriceBandDetailElements(() => renderMapApartmentLoading(priceBandDetailSeedItem(row)));
}

function renderPriceBandApartmentError(row, error) {
  withPriceBandDetailElements(() => renderMapApartmentError(priceBandDetailSeedItem(row), error));
}

function renderPriceBandApartmentDetail(detail) {
  withPriceBandDetailElements(() => renderMapApartmentDetail(detail));
}

function closePriceBandApartmentDetail() {
  state.priceBandDetailRequestId += 1;
  state.priceBandDetailApartmentId = null;
  if (els.priceBandDetailPanel) {
    els.priceBandDetailPanel.hidden = true;
    els.priceBandDetailPanel.classList.remove("loading");
  }
  if (els.priceBandDetailTooltip) els.priceBandDetailTooltip.hidden = true;
  updatePriceBandSelectedRow("");
}

function withPriceBandDetailElements(callback) {
  if (!els.priceBandDetailPanel) return callback();
  const previous = {
    mapApartmentPopup: els.mapApartmentPopup,
    mapPopupTitle: els.mapPopupTitle,
    mapPopupMeta: els.mapPopupMeta,
    mapPopupRanks: els.mapPopupRanks,
    mapPopupPyeongGrowth: els.mapPopupPyeongGrowth,
    mapPopupStats: els.mapPopupStats,
    mapPopupChart: els.mapPopupChart,
    mapPopupTooltip: els.mapPopupTooltip,
    mapPopupTradeHistory: els.mapPopupTradeHistory,
    mapCanvasWrap: els.mapCanvasWrap,
    mapLocateBtn: els.mapLocateBtn
  };
  const previousRankLinksEnabled = state.mapPopupRankLinksEnabled;
  Object.assign(els, {
    mapApartmentPopup: els.priceBandDetailPanel,
    mapPopupTitle: els.priceBandDetailTitle,
    mapPopupMeta: els.priceBandDetailMeta,
    mapPopupRanks: els.priceBandDetailRanks,
    mapPopupPyeongGrowth: els.priceBandDetailPyeongGrowth,
    mapPopupStats: els.priceBandDetailStats,
    mapPopupChart: els.priceBandDetailChart,
    mapPopupTooltip: els.priceBandDetailTooltip,
    mapPopupTradeHistory: els.priceBandDetailTradeHistory,
    mapCanvasWrap: null,
    mapLocateBtn: null
  });
  state.mapPopupRankLinksEnabled = false;
  try {
    return callback();
  } finally {
    Object.assign(els, previous);
    state.mapPopupRankLinksEnabled = previousRankLinksEnabled;
  }
}

function priceBandDetailSeedItem(row) {
  return {
    id: row?.apartmentId || "",
    name: row?.apartmentName || "아파트 시세",
    neighborhoodName: row?.neighborhoodName || formatPriceBandLocation(row || {}) || "-"
  };
}

function updatePriceBandSelectedRow(apartmentId) {
  els.priceBandRows?.querySelectorAll("[data-price-band-detail-row]").forEach((row) => {
    row.classList.toggle("selected", Boolean(apartmentId) && row.dataset.priceBandApartmentId === String(apartmentId));
  });
}

function renderPriceBandLoadingState() {
  closePriceBandApartmentDetail();
  syncPriceBandFilterControls(state.priceBandStartKey, state.priceBandEndKey, state.priceBandAreaKey);
  updatePriceBandTotalBadge("불러오는 중");
  const selectionLabel = currentPriceBandSelectionLabel() || "과거 전체 → 현재 전체";
  if (els.priceBandView) els.priceBandView.setAttribute("aria-busy", "true");
  if (els.priceBandCount) els.priceBandCount.textContent = `${selectionLabel} · 불러오는 중`;
  if (els.priceBandRows) {
    els.priceBandRows.innerHTML = `
      <tr>
        <td colspan="4" class="empty price-band-loading-cell">
          <div class="price-band-loading">
            <span class="price-band-loading-spinner" aria-hidden="true"></span>
            <strong>랭킹을 불러오는 중입니다.</strong>
          </div>
        </td>
      </tr>
    `;
  }
  if (els.priceBandPagination) els.priceBandPagination.innerHTML = "";
}

function renderPriceBandSummary(basisBands, areaBands, selectedStartBandKey, selectedEndBandKey, selectedAreaBandKey, totalRows = 0) {
  if (!els.priceBandSummary) return;
  const startBands = Array.isArray(basisBands?.start) ? basisBands.start : [];
  const endBands = Array.isArray(basisBands?.end) ? basisBands.end : [];
  const areaBandOptions = Array.isArray(areaBands) ? areaBands : [];
  if (!startBands.length && !endBands.length && !areaBandOptions.length) {
    els.priceBandSummary.innerHTML = `<div class="empty">표시할 가격대가 없습니다.</div>`;
    return;
  }
  els.priceBandSummary.innerHTML = `
    <div class="price-band-filter-row" aria-label="가격대 랭킹 조건">
      ${renderPriceBandPeriodSelect()}
      ${renderPriceBandSelect("start", "과거", startBands, selectedStartBandKey)}
      <span class="price-band-filter-arrow" aria-hidden="true">→</span>
      ${renderPriceBandSelect("end", "현재", endBands, selectedEndBandKey)}
      <span class="price-band-filter-total" data-price-band-total>${formatPriceBandTotal(totalRows)}</span>
      ${renderPriceAreaBandSelect(areaBandOptions, selectedAreaBandKey)}
    </div>
  `;
}

function renderPriceBandPeriodSelect() {
  const activeMonths = currentPeriodMonths();
  return `
    <label class="price-band-filter-control price-band-period-filter-control">
      <span>과거 기준</span>
      <select data-price-band-period-select aria-label="가격대 랭킹 과거 기준 기간">
        ${priceBandPeriodOptions.map((option) => `
          <option value="${option.value}" ${option.value === activeMonths ? "selected" : ""}>${escapeHtml(option.label)}</option>
        `).join("")}
      </select>
    </label>
  `;
}

function renderPriceBandSelect(kind, label, bands, selectedBandKey) {
  const normalizedSelectedKey = selectedBandKey === null || selectedBandKey === undefined ? "" : String(selectedBandKey);
  const options = priceBandOptionsWithSelected(bands, normalizedSelectedKey);
  return `
    <label class="price-band-filter-control">
      <span>${label}</span>
      <select data-price-band-filter="${kind}">
        <option value="" ${normalizedSelectedKey === "" ? "selected" : ""}>전체</option>
        ${options.map((band) => renderPriceBandOption(band, normalizedSelectedKey)).join("")}
      </select>
    </label>
  `;
}

function priceBandOptionsWithSelected(bands, selectedBandKey) {
  const options = Array.isArray(bands) ? [...bands] : [];
  if (selectedBandKey !== "" && !options.some((band) => String(band.bandKey) === selectedBandKey)) {
    options.unshift(fallbackPriceBand(selectedBandKey));
  }
  return options.filter(Boolean);
}

function renderPriceBandOption(band, selectedBandKey) {
  const bandKey = String(band.bandKey);
  return `<option value="${escapeHtml(bandKey)}" ${bandKey === selectedBandKey ? "selected" : ""}>${escapeHtml(band.bandLabel || `${bandKey}억대`)}</option>`;
}

function renderPriceAreaBandSelect(areaBands, selectedAreaBandKey) {
  const bands = Array.isArray(areaBands) && areaBands.length
    ? areaBands
    : [{ key: "all", label: "전체 평형" }];
  const normalizedSelectedKey = selectedAreaBandKey || "all";
  return `
    <label class="price-band-filter-control price-band-area-filter-control">
      <span>평형</span>
      <select data-price-band-filter="area">
        ${bands.map((band) => {
          const key = String(band.key || "all");
          return `<option value="${escapeHtml(key)}" ${key === normalizedSelectedKey ? "selected" : ""}>${escapeHtml(band.label || "전체 평형")}</option>`;
        }).join("")}
      </select>
    </label>
  `;
}

function syncPriceBandFilterControls(selectedStartBandKey, selectedEndBandKey, selectedAreaBandKey) {
  if (!els.priceBandSummary) return;
  const startSelect = els.priceBandSummary.querySelector('[data-price-band-filter="start"]');
  const endSelect = els.priceBandSummary.querySelector('[data-price-band-filter="end"]');
  const areaSelect = els.priceBandSummary.querySelector('[data-price-band-filter="area"]');
  if (startSelect) startSelect.value = selectedStartBandKey === null || selectedStartBandKey === undefined ? "" : String(selectedStartBandKey);
  if (endSelect) endSelect.value = selectedEndBandKey === null || selectedEndBandKey === undefined ? "" : String(selectedEndBandKey);
  if (areaSelect) areaSelect.value = selectedAreaBandKey || "all";
}

function updatePriceBandTotalBadge(label) {
  const badge = els.priceBandSummary?.querySelector("[data-price-band-total]");
  if (badge) badge.textContent = label;
}

function currentPriceBandSelectionLabel() {
  if (!els.priceBandSummary) return "";
  const startSelect = els.priceBandSummary.querySelector('[data-price-band-filter="start"]');
  const endSelect = els.priceBandSummary.querySelector('[data-price-band-filter="end"]');
  return `과거 ${selectedPriceBandLabel(startSelect)} → 현재 ${selectedPriceBandLabel(endSelect)}`;
}

function priceBandSelectionLabel(startBand, endBand) {
  return `과거 ${startBand?.bandLabel || "전체"} → 현재 ${endBand?.bandLabel || "전체"}`;
}

function selectedPriceBandLabel(select) {
  if (!select) return "전체";
  return select.selectedOptions?.[0]?.textContent?.trim() || "전체";
}

function findPriceBand(bands, bandKey) {
  if (bandKey === null || bandKey === undefined || bandKey === "") return null;
  return (Array.isArray(bands) ? bands : []).find((band) => String(band.bandKey) === String(bandKey)) || null;
}

function fallbackPriceBand(bandKey) {
  if (bandKey === null || bandKey === undefined || bandKey === "") return null;
  const key = Number(bandKey);
  if (!Number.isFinite(key)) return null;
  if (key === 0) return { bandKey: key, bandLabel: "1억 미만" };
  return { bandKey: key, bandLabel: `${key}억대` };
}

function findPriceAreaBand(bands, bandKey) {
  const key = bandKey || "all";
  return (Array.isArray(bands) ? bands : []).find((band) => String(band.key) === String(key)) || null;
}

function formatPriceBandTotal(totalRows) {
  return `총 ${formatInt(totalRows || 0)}개 단지`;
}

function formatPriceBandLocation(row) {
  const address = String(row.address || "").trim();
  const parts = address.split(/\s+/).filter(Boolean);
  if (parts.length >= 4 && /도$/.test(parts[0]) && /시$/.test(parts[1]) && /구$/.test(parts[2])) {
    return parts.slice(0, 4).join(" ");
  }
  if (parts.length >= 3) return parts.slice(0, 3).join(" ");
  return row.neighborhoodName || "-";
}

function naverApartmentLink(row) {
  const query = compactSearchQuery([row.address, row.apartmentName]) || row.apartmentName || "";
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
}

function priceBandMapApartmentLink(row) {
  const params = new URLSearchParams();
  if (row.apartmentId) params.set("focusApartmentId", row.apartmentId);
  const areaM2 = priceBandRepresentativeAreaM2(row);
  if (areaM2 !== null) params.set("focusAreaM2", areaM2.toFixed(2));
  return `/map?${params}`;
}

function hogangnonoApartmentLink(row) {
  const query = compactSearchQuery([row.apartmentName, formatPriceBandLocation(row)]);
  return `https://hogangnono.com/search?q=${encodeURIComponent(query)}`;
}

function priceBandApartmentMeta(row) {
  const parts = [
    row.areaLabel || "-",
    `${formatInt(row.areaTypeCount)}개 면적`
  ];
  const households = Number(row.householdCount);
  if (Number.isFinite(households) && households > 0) {
    parts.push(`${formatInt(households)}세대`);
  }
  return parts.join(" · ");
}

function renderPriceBandAreaBreakdownCell(row) {
  const summaries = priceBandAreaSummaries(row);
  const primary = summaries[0];
  const secondary = summaries[1];
  const hidden = summaries.slice(2);
  if (!primary) return "-";

  return `
    <div class="price-band-area-breakdown">
      ${renderPriceBandAreaBreakdownLine(primary, "primary", { moreCount: hidden.length })}
      ${secondary ? renderPriceBandAreaBreakdownLine(secondary, "secondary") : ""}
      ${hidden.length ? `
        <div class="price-band-area-more-rows" hidden>
          ${hidden.map((item) => renderPriceBandAreaBreakdownLine(item, "secondary")).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function renderPriceBandAreaBreakdownLine(item, tone, options = {}) {
  const growthTone = Number(item.growthAmount || 0) >= 0 ? "positive" : "negative";
  const rateTone = Number(item.growthRate || 0) >= 0 ? "positive" : "negative";
  const metricMarkup = tone === "primary"
    ? `<span class="price-band-area-metric-chip"><b class="price-band-area-amount ${growthTone}">${escapeHtml(formatSignedKoreanPriceWithPlus(item.growthAmount))}</b><strong class="price-band-area-rate ${rateTone}">${formatPercent(item.growthRate)}</strong></span>`
    : `<b class="price-band-area-amount ${growthTone}">${escapeHtml(formatSignedKoreanPriceWithPlus(item.growthAmount))}</b><strong class="price-band-area-rate ${rateTone}">${formatPercent(item.growthRate)}</strong>`;
  const moreMarkup = options.moreCount
    ? `
      <span class="price-band-area-more-slot">
        <button type="button" class="price-band-area-more-toggle" aria-expanded="false">
          <span>다른 ${formatInt(options.moreCount)}개 평형</span><span class="price-band-area-more-action">보기</span>
        </button>
      </span>
    `
    : "";
  return `
    <span class="price-band-area-breakdown-line ${tone}">
      <strong class="price-band-area-label">${escapeHtml(item.areaLabel || "-")}</strong>
      <span class="price-band-area-range">${formatKoreanPrice(item.startSalePrice)} → ${formatKoreanPrice(item.endSalePrice)}</span>
      ${metricMarkup}
      ${moreMarkup}
    </span>
  `;
}

function priceBandAreaSummaries(row) {
  const summaries = Array.isArray(row.areaSummaries) && row.areaSummaries.length
    ? row.areaSummaries
    : [fallbackPriceBandAreaSummary(row)];
  return summaries
    .map((item) => ({
      exclusiveAreaM2: nullableNumber(item.exclusiveAreaM2),
      areaLabel: item.areaLabel || row.areaLabel || "-",
      startSalePrice: nullableNumber(item.startSalePrice),
      endSalePrice: nullableNumber(item.endSalePrice),
      growthAmount: nullableNumber(item.growthAmount),
      growthRate: nullableNumber(item.growthRate)
    }))
    .filter((item) => item.areaLabel && item.startSalePrice !== null && item.endSalePrice !== null);
}

function fallbackPriceBandAreaSummary(row) {
  const startSalePrice = nullableNumber(row.startSalePrice);
  const endSalePrice = nullableNumber(row.endSalePrice);
  const growthAmount = startSalePrice !== null && endSalePrice !== null ? endSalePrice - startSalePrice : nullableNumber(row.growthAmount);
  return {
    exclusiveAreaM2: nullableNumber(row.exclusiveAreaM2),
    areaLabel: row.areaLabel || `${formatInt(row.areaTypeCount || 0)}개 면적`,
    startSalePrice,
    endSalePrice,
    growthAmount,
    growthRate: nullableNumber(row.growthRate)
  };
}

function priceBandRepresentativeAreaM2(row) {
  const summary = priceBandAreaSummaries(row)[0];
  return nullableNumber(summary?.exclusiveAreaM2);
}

function nullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatSignedKoreanPriceWithPlus(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  if (number === 0) return "0만";
  return `${number > 0 ? "+" : ""}${formatSignedKoreanPrice(number)}`;
}

function compactSearchQuery(parts) {
  return parts.map((part) => String(part || "").trim()).filter(Boolean).join(" ");
}

function renderPriceBandPagination(pagination) {
  if (!els.priceBandPagination) return;
  if (!pagination || pagination.totalPages <= 1) {
    els.priceBandPagination.innerHTML = "";
    return;
  }
  const page = Number(pagination.page || 1);
  const totalPages = Number(pagination.totalPages || 1);
  const pageNumbers = visiblePageNumbers(page, totalPages);
  els.priceBandPagination.innerHTML = `
    <button type="button" data-price-band-page="1" ${page <= 1 ? "disabled" : ""}>처음</button>
    <button type="button" data-price-band-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>이전</button>
    ${pageNumbers.map((item) => item === "..."
      ? `<span>...</span>`
      : `<button type="button" data-price-band-page="${item}" class="${item === page ? "active" : ""}">${item}</button>`
    ).join("")}
    <button type="button" data-price-band-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>다음</button>
    <button type="button" data-price-band-page="${totalPages}" ${page >= totalPages ? "disabled" : ""}>마지막</button>
  `;
}

function renderChart(result) {
  els.chartPeriod.textContent = result.period.startMonth && result.period.endMonth
    ? `${formatMonth(result.period.startMonth)} - ${formatMonth(result.period.endMonth)}`
    : "";

  const series = result.series.slice(0, 8);
  if (!series.length) {
    els.chart.innerHTML = `<div class="empty">표시할 그래프 데이터가 없습니다.</div>`;
    return;
  }

  const width = 1000;
  const height = 300;
  const padding = { top: 20, right: 28, bottom: 34, left: 48 };
  const points = series.flatMap((item) => item.points.filter((point) => point.index !== null));
  const months = [...new Set(points.map((point) => point.month))].sort();
  const minValue = Math.min(...points.map((point) => point.index), 95);
  const maxValue = Math.max(...points.map((point) => point.index), 105);
  const yMin = Math.floor(minValue / 10) * 10;
  const yMax = Math.ceil(maxValue / 10) * 10;

  const x = (month) => {
    const index = months.indexOf(month);
    if (months.length <= 1) return padding.left;
    return padding.left + (index / (months.length - 1)) * (width - padding.left - padding.right);
  };
  const y = (value) => {
    return padding.top + (1 - (value - yMin) / (yMax - yMin || 1)) * (height - padding.top - padding.bottom);
  };

  const paths = series.map((item, index) => {
    const commands = item.points
      .filter((point) => point.index !== null)
      .map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${x(point.month).toFixed(1)} ${y(point.index).toFixed(1)}`)
      .join(" ");
    return `<path d="${commands}" fill="none" stroke="${colors[index % colors.length]}" stroke-width="2.5"></path>`;
  }).join("");

  const grid = [yMin, Math.round((yMin + yMax) / 2), yMax].map((value) => `
    <line x1="${padding.left}" y1="${y(value)}" x2="${width - padding.right}" y2="${y(value)}" stroke="#e5e8ef"></line>
    <text x="${padding.left - 8}" y="${y(value) + 4}" text-anchor="end" font-size="12" fill="#667085">${value}</text>
  `).join("");

  const xLabels = months.filter((_, index) => index === 0 || index === months.length - 1 || index % Math.ceil(months.length / 5) === 0)
    .map((month) => `<text x="${x(month)}" y="${height - 8}" text-anchor="middle" font-size="12" fill="#667085">${formatMonth(month)}</text>`)
    .join("");

  const legend = series.map((item, index) => `
    <span><i style="background:${colors[index % colors.length]}"></i>${escapeHtml(item.neighborhoodName)}</span>
  `).join("");

  els.chart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="동네별 평당가 지수 그래프">
      ${grid}
      ${paths}
      ${xLabels}
      <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#98a2b3"></line>
      <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#98a2b3"></line>
      <line class="chart-hover-line" x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" hidden></line>
      <rect class="chart-hover-hit" x="${padding.left}" y="${padding.top}" width="${width - padding.left - padding.right}" height="${height - padding.top - padding.bottom}" fill="transparent"></rect>
    </svg>
    <div class="chart-tooltip" hidden></div>
    <div class="legend">${legend}</div>
  `;
  bindNeighborhoodChartHover({ width, padding, months, series, x });
}

function bindNeighborhoodChartHover({ width, padding, months, series, x }) {
  const svg = els.chart.querySelector("svg");
  const hit = els.chart.querySelector(".chart-hover-hit");
  const line = els.chart.querySelector(".chart-hover-line");
  const tooltip = els.chart.querySelector(".chart-tooltip");
  if (!svg || !hit || !line || !tooltip || !months.length) return;

  hit.addEventListener("mousemove", (event) => {
    const month = nearestMonthFromEvent(event, svg, width, months, x);
    const xPos = x(month);
    line.setAttribute("x1", xPos);
    line.setAttribute("x2", xPos);
    line.hidden = false;

    const rows = series.map((item, index) => {
      const point = item.points.find((entry) => entry.month === month);
      const value = point?.index == null ? "-" : `${point.index}`;
      return `<span><i style="background:${colors[index % colors.length]}"></i>${escapeHtml(item.neighborhoodName)} ${escapeHtml(value)}</span>`;
    }).join("");

    showFloatingTooltip(els.chart, tooltip, event, `
      <strong>${formatMonth(month)}</strong>
      ${rows}
    `);
  });

  hit.addEventListener("mouseleave", () => {
    line.hidden = true;
    tooltip.hidden = true;
  });
}

function nearestMonthFromEvent(event, svg, width, months, x) {
  return nearestMonthFromSvgX(svgPointFromEvent(event, svg, width).x, months, x);
}

function svgPointFromEvent(event, svg, width) {
  const rect = svg.getBoundingClientRect();
  const svgX = ((event.clientX - rect.left) / rect.width) * width;
  const viewBoxHeight = Number(svg.getAttribute("viewBox")?.split(/\s+/)[3]) || rect.height;
  const svgY = ((event.clientY - rect.top) / rect.height) * viewBoxHeight;
  return { x: svgX, y: svgY };
}

function nearestMonthFromSvgX(svgX, months, x) {
  return months.reduce((nearest, month) => (
    Math.abs(x(month) - svgX) < Math.abs(x(nearest) - svgX) ? month : nearest
  ), months[0]);
}

function showFloatingTooltip(container, tooltip, event, html) {
  tooltip.hidden = false;
  tooltip.innerHTML = html;
  const rect = container.getBoundingClientRect();
  tooltip.style.left = `${event.clientX - rect.left + 12}px`;
  tooltip.style.top = `${event.clientY - rect.top + 12}px`;
  requestAnimationFrame(() => {
    const tipRect = tooltip.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const overflowRight = tipRect.right - containerRect.right;
    if (overflowRight > 0) {
      tooltip.style.left = `${event.clientX - containerRect.left - tipRect.width - 12}px`;
    }
    const overflowBottom = tipRect.bottom - containerRect.bottom;
    if (overflowBottom > 0) {
      tooltip.style.top = `${event.clientY - containerRect.top - tipRect.height - 12}px`;
    }
  });
}

function renderEmpty() {
  els.chart.innerHTML = `<div class="empty">동기화 후 그래프가 표시됩니다.</div>`;
  els.neighborhoodRows.innerHTML = `<tr><td colspan="7" class="empty">동기화 후 랭킹이 표시됩니다.</td></tr>`;
  if (els.priceBandRows) els.priceBandRows.innerHTML = `<tr><td colspan="4" class="empty">동기화 후 가격대별 랭킹이 표시됩니다.</td></tr>`;
}
