const mapPopupTradeComparisonMonths = [3, 6, 12, 36, 60];

async function openMapApartmentDetail(apartmentId, seedItem = null) {
  const requestId = ++state.mapPopupRequestId;
  const source = currentMapSource();
  const period = currentMapPeriodParams();
  const minHouseholdCount = activeMinHouseholdCount();
  if (state.mapPopupPreferredApartmentId && String(state.mapPopupPreferredApartmentId) !== String(apartmentId)) {
    state.mapPopupPreferredApartmentId = null;
    state.mapPopupPreferredAreaM2 = null;
  }
  if (typeof trackAnalyticsEvent === "function") {
    trackAnalyticsEvent("apartment_detail_opened", {
      apartmentId,
      apartmentName: seedItem?.name || "",
      dongName: seedItem?.dongName || seedItem?.neighborhoodName || "",
      mapSource: source,
      periodStart: period.start,
      periodEnd: period.end,
      periodLabel: typeof mapAnalyticsPeriodLabel === "function" ? mapAnalyticsPeriodLabel() : ""
    });
  }
  const cacheKey = `${source}:${apartmentId}:${period.start}:${period.end}:${minHouseholdCount}`;
  state.mapPopupDetail = null;
  state.mapPopupSelectedAreaTypeId = null;
  if (state.mapApartmentDetails.has(cacheKey)) {
    renderMapApartmentDetail(state.mapApartmentDetails.get(cacheKey));
    return;
  }

  renderMapApartmentLoading(seedItem);

  try {
    const endpoint = source === "molit" ? "/api/molit-apartment-detail" : "/api/apartment-detail";
    const params = new URLSearchParams({
      apartmentId,
      start: period.start,
      end: period.end,
      minHouseholdCount: String(minHouseholdCount)
    });
    const detail = await api(`${endpoint}?${params}`);
    if (requestId !== state.mapPopupRequestId) return;
    state.mapApartmentDetails.set(cacheKey, detail);
    renderMapApartmentDetail(detail);
  } catch (error) {
    if (requestId !== state.mapPopupRequestId) return;
    renderMapApartmentError(seedItem, error);
  }
}

function closeMapApartmentPopup() {
  setMapApartmentPopupVisible(false);
  if (els.mapPopupTooltip) els.mapPopupTooltip.hidden = true;
}

function setMapApartmentPopupVisible(visible) {
  if (!els.mapApartmentPopup) return;
  els.mapApartmentPopup.hidden = !visible;
  els.mapCanvasWrap?.classList.toggle("popup-active", visible);
  if (!visible && typeof clearMapRankingPopupOverlay === "function") {
    clearMapRankingPopupOverlay();
  }
  if (els.mapLocateBtn) {
    els.mapLocateBtn.hidden = visible;
    els.mapLocateBtn.setAttribute("aria-hidden", visible ? "true" : "false");
  }
}

function renderMapApartmentLoading(seedItem = null) {
  setMapApartmentPopupVisible(true);
  els.mapApartmentPopup.classList.add("loading");
  els.mapPopupTitle.textContent = seedItem?.name || "아파트 시세";
  if (els.mapPopupPyeongGrowth) els.mapPopupPyeongGrowth.innerHTML = "";
  if (els.mapPopupRanks) els.mapPopupRanks.innerHTML = "";
  els.mapPopupMeta.textContent = `${seedItem?.neighborhoodName || "-"} / 최근 5년 그래프`;
  if (els.mapPopupTooltip) els.mapPopupTooltip.hidden = true;
  clearMapPopupTradeHistory();
  els.mapPopupStats.innerHTML = `
    <div class="map-popup-loading-card"></div>
    <div class="map-popup-loading-card"></div>
  `;
  els.mapPopupChart.innerHTML = `
    <div class="map-popup-loading">
      <span class="map-popup-spinner" aria-hidden="true"></span>
      <strong>시세 그래프를 불러오는 중</strong>
      <em>선택 평형의 월별 데이터를 준비하고 있습니다.</em>
    </div>
  `;
}

function renderMapApartmentError(seedItem = null, error = null) {
  setMapApartmentPopupVisible(true);
  els.mapApartmentPopup.classList.remove("loading");
  state.mapPopupDetail = null;
  els.mapPopupTitle.textContent = seedItem?.name || "아파트 시세";
  if (els.mapPopupPyeongGrowth) els.mapPopupPyeongGrowth.innerHTML = "";
  if (els.mapPopupRanks) els.mapPopupRanks.innerHTML = "";
  els.mapPopupMeta.textContent = "불러오기 실패";
  els.mapPopupStats.innerHTML = "";
  els.mapPopupChart.innerHTML = `<div class="empty">시세 데이터를 불러오지 못했습니다.${error?.message ? ` ${escapeHtml(error.message)}` : ""}</div>`;
  clearMapPopupTradeHistory();
}

function renderMapApartmentDetail(detail) {
  els.mapApartmentPopup.classList.remove("loading");
  state.mapPopupDetail = detail;
  if (!detail.apartment) {
    setMapApartmentPopupVisible(true);
    els.mapPopupTitle.textContent = "아파트 시세";
    if (els.mapPopupPyeongGrowth) els.mapPopupPyeongGrowth.innerHTML = "";
    if (els.mapPopupRanks) els.mapPopupRanks.innerHTML = "";
    els.mapPopupMeta.textContent = "정보 없음";
    els.mapPopupStats.innerHTML = "";
    els.mapPopupChart.innerHTML = `<div class="empty">아파트 정보를 찾지 못했습니다.</div>`;
    clearMapPopupTradeHistory();
    return;
  }

  setMapApartmentPopupVisible(true);
  els.mapPopupTitle.textContent = detail.apartment.name;
  if (els.mapPopupPyeongGrowth) els.mapPopupPyeongGrowth.innerHTML = "";
  renderMapPopupRanks(detail.rankSummary, detail.apartment);

  const latestMonth = detail.months.at(-1);
  if (!latestMonth) {
    if (els.mapPopupPyeongGrowth) els.mapPopupPyeongGrowth.innerHTML = "";
    els.mapPopupMeta.textContent = `${detail.apartment.neighborhoodName || "-"} / 시세 정보 없음`;
    els.mapPopupStats.innerHTML = "";
    els.mapPopupChart.innerHTML = `<div class="empty">표시할 시세 데이터가 없습니다.</div>`;
    clearMapPopupTradeHistory();
    return;
  }

  const startMonth = periodStartMonth(latestMonth, 5);
  const months = detail.months.filter((month) => month >= startMonth && month <= latestMonth);
  const graphDesign = activeGraphDesign();
  els.mapPopupMeta.textContent = `${detail.apartment.neighborhoodName || "-"} / ${formatMonth(startMonth)} - ${formatMonth(latestMonth)} / 최근 5년 그래프`;
  const allSeries = detail.areaTypes
    .map((areaType, index) => ({
      ...areaType,
      color: graphDesignColor(graphDesign, index, colors[index % colors.length]),
      allPrices: areaType.prices,
      prices: areaType.prices.filter((price) => price.yearMonth >= startMonth && price.yearMonth <= latestMonth)
    }))
    .filter((areaType) => areaType.prices.length);

  if (!allSeries.length) {
    if (els.mapPopupPyeongGrowth) els.mapPopupPyeongGrowth.innerHTML = "";
    els.mapPopupStats.innerHTML = "";
    els.mapPopupChart.innerHTML = `<div class="empty">선택 기간의 시세 데이터가 없습니다.</div>`;
    clearMapPopupTradeHistory();
    return;
  }

  const selected = selectedMapPopupSeries(allSeries, detail.apartment.id);
  const selectedSeries = selected ? [selected] : [];
  els.mapPopupStats.innerHTML = `
    ${renderMapPopupAreaPicker(allSeries, selected)}
    ${selected ? renderMapPopupAreaSummary(selected, latestMonth) : ""}
  `;

  renderMapPopupChart({ months, series: selectedSeries });
  renderMapPopupTradeHistory(selected);
}

function selectedMapPopupSeries(series, apartmentId = "") {
  if (!series.length) {
    state.mapPopupPreferredApartmentId = null;
    state.mapPopupPreferredAreaM2 = null;
    return null;
  }
  const selected = series.find((item) => item.id === state.mapPopupSelectedAreaTypeId);
  if (selected) return selected;
  const preferred = selectedMapPopupPreferredAreaSeries(series, apartmentId);
  if (preferred) {
    state.mapPopupSelectedAreaTypeId = preferred.id;
    return preferred;
  }
  const fallback = [...series].sort((a, b) =>
    areaTypeDealCount(b) - areaTypeDealCount(a)
    || Number(b.exclusiveAreaPyeong || 0) - Number(a.exclusiveAreaPyeong || 0)
  )[0];
  state.mapPopupSelectedAreaTypeId = fallback?.id || null;
  return fallback || null;
}

function selectedMapPopupPreferredAreaSeries(series, apartmentId = "") {
  const preferredAreaM2 = Number(state.mapPopupPreferredAreaM2);
  if (!Number.isFinite(preferredAreaM2) || preferredAreaM2 <= 0) return null;
  if (state.mapPopupPreferredApartmentId && String(state.mapPopupPreferredApartmentId) !== String(apartmentId)) {
    state.mapPopupPreferredApartmentId = null;
    state.mapPopupPreferredAreaM2 = null;
    return null;
  }
  state.mapPopupPreferredApartmentId = null;
  state.mapPopupPreferredAreaM2 = null;
  const scored = series
    .map((item) => ({
      item,
      diff: Math.abs(mapPopupAreaM2(item) - preferredAreaM2)
    }))
    .filter((entry) => Number.isFinite(entry.diff))
    .sort((a, b) => a.diff - b.diff);
  const best = scored[0];
  return best && best.diff <= 0.35 ? best.item : null;
}

function mapPopupAreaM2(item) {
  const direct = Number(item?.exclusiveAreaM2);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const pyeong = Number(item?.exclusiveAreaPyeong || item?.supplyAreaPyeong);
  if (Number.isFinite(pyeong) && pyeong > 0) return pyeong * 3.305785;
  const idMatch = String(item?.id || "").match(/:([0-9]+(?:\.[0-9]+)?)$/);
  if (idMatch) {
    const fromId = Number(idMatch[1]);
    if (Number.isFinite(fromId) && fromId > 0) return fromId;
  }
  const labelMatch = String(item?.label || "").match(/([0-9]+(?:\.[0-9]+)?)\s*㎡/);
  if (!labelMatch) return NaN;
  const fromLabel = Number(labelMatch[1]);
  return Number.isFinite(fromLabel) && fromLabel > 0 ? fromLabel : NaN;
}

function areaTypeDealCount(areaType) {
  const explicit = Number(areaType?.totalDealCount);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return (areaType?.prices || []).reduce((sum, price) => sum + Number(price.dealCount || 0), 0);
}

function renderMapPopupAreaPicker(series, selected) {
  if (!series.length) return "";
  return `
    <div class="map-popup-area-picker">
      <label for="mapPopupAreaSelect">
        <span>평형 선택</span>
        <select id="mapPopupAreaSelect" data-map-popup-area-select>
          ${series.map((item) => `
            <option value="${escapeHtml(item.id)}" ${item.id === selected?.id ? "selected" : ""}>
              ${escapeHtml(mapPopupAreaOptionLabel(item))} · 거래 ${formatInt(areaTypeDealCount(item))}건
            </option>
          `).join("")}
        </select>
      </label>
      <em>선택 평형 실거래가 그래프</em>
    </div>
  `;
}

function mapPopupAreaOptionLabel(item) {
  const label = item?.label || "-";
  const pyeong = Number(item?.exclusiveAreaPyeong || item?.supplyAreaPyeong);
  if (!Number.isFinite(pyeong) || pyeong <= 0) return label;
  return `${label} (${pyeong.toFixed(1)}평)`;
}

function renderMapPopupRanks(rankSummary, apartment = null) {
  if (!els.mapPopupRanks) return;
  if (!rankSummary) {
    els.mapPopupRanks.innerHTML = "";
    return;
  }
  const rows = mapPopupRankRows(rankSummary, apartment);
  els.mapPopupRanks.innerHTML = rows.length
    ? rows.map(renderMapPopupRankChip).join("")
    : "";
  bindMapPopupRankEvents();
}

function mapPopupRankRows(rankSummary, apartment = {}) {
  const dongLabel = shortDongLabel(rankSummary.dongName || apartment?.dongName || apartment?.neighborhoodName || "동네");
  const sigunguLabel = shortZoomLabel(rankSummary.sigunguName || apartment?.sigunguName || apartment?.address || "", "sigungu") || "구";
  return [
    {
      mode: "dong",
      key: mapPopupApartmentDongKey(apartment),
      label: dongLabel,
      rank: rankSummary.dongRank,
      total: rankSummary.dongRankTotal
    },
    {
      mode: "sigungu",
      key: mapPopupApartmentSigunguCode(apartment),
      label: sigunguLabel,
      rank: rankSummary.sigunguRank,
      total: rankSummary.sigunguRankTotal
    },
    {
      mode: "sido",
      key: mapPopupApartmentSidoCode(apartment),
      label: shortRegionLabel(rankSummary.sidoName || apartment?.sidoName || "") || "시",
      rank: rankSummary.sidoRank,
      total: rankSummary.sidoRankTotal
    },
    {
      mode: "country",
      key: "country",
      label: "전국",
      rank: rankSummary.countryRank,
      total: rankSummary.countryRankTotal
    }
  ].filter((item) => Number.isFinite(Number(item.rank)));
}

function renderMapPopupRankChip(item) {
  const content = `
    <b>${escapeHtml(item.label)}</b>
    ${formatRankText(item.rank, item.total)}
  `;
  if (!item.mode || !item.key) {
    return `<span>${content}</span>`;
  }
  return `
    <button class="map-popup-rank-btn" type="button"
      data-map-popup-rank-mode="${escapeHtml(item.mode)}"
      data-map-popup-rank-key="${escapeHtml(item.key)}"
      data-map-popup-rank-label="${escapeHtml(item.label)}"
      data-map-popup-rank-total="${Number(item.total) || ""}"
      aria-label="${escapeHtml(item.label)} 랭킹 보기">
      ${content}
    </button>
  `;
}

function bindMapPopupRankEvents() {
  els.mapPopupRanks?.querySelectorAll("[data-map-popup-rank-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      if (typeof openMapRankingFromPopupScope !== "function") return;
      openMapRankingFromPopupScope({
        mode: button.dataset.mapPopupRankMode || "",
        key: button.dataset.mapPopupRankKey || "",
        label: button.dataset.mapPopupRankLabel || "",
        total: Number(button.dataset.mapPopupRankTotal || 0) || null
      });
    });
  });
}

function mapPopupApartmentDongKey(apartment = {}) {
  const dongKey = String(apartment?.dongKey || "").trim();
  if (dongKey) return dongKey;
  return String(apartment?.legalDongCode || "").slice(0, 8);
}

function mapPopupApartmentSigunguCode(apartment = {}) {
  return String(apartment?.sigunguCode || apartment?.legalDongCode || "").slice(0, 5);
}

function mapPopupApartmentSidoCode(apartment = {}) {
  return String(apartment?.sidoCode || apartment?.sigunguCode || apartment?.legalDongCode || apartment?.dongKey || "").slice(0, 2);
}

function renderMapPopupAreaSummary(item, latestMonth) {
  const latest = latestPriceAtOrBefore(item.prices, latestMonth);
  const latestLabel = latest ? formatKoreanPrice(latest.saleMid) : "실거래가 없음";
  return `
    <div class="map-popup-stat map-popup-stat-wide">
      <strong><i style="background:${item.color}"></i>${escapeHtml(item.label || "-")}</strong>
      <span>현재 ${latestLabel}</span>
      <div class="map-popup-change-list">
        ${[1, 3, 5].map((years) => renderMapPopupChangeRow(item, latest, latestMonth, years)).join("")}
      </div>
    </div>
  `;
}

function renderMapPopupChangeRow(item, latest, latestMonth, years) {
  const startMonth = periodStartMonth(latestMonth, years);
  const start = latestPriceAtOrBefore(item.prices, startMonth);
  if (!latest || !start) {
    return `
      <div class="map-popup-change-row no-data">
        <span>${years}년전</span>
        <strong>실거래가 없음</strong>
      </div>
    `;
  }
  const growthAmount = latest.saleMid - start.saleMid;
  const growthRate = start.saleMid ? growthAmount / start.saleMid : null;
  return `
    <div class="map-popup-change-row">
      <span>${years}년전</span>
      <strong>${formatKoreanPrice(start.saleMid)} → ${formatKoreanPrice(latest.saleMid)}</strong>
      <em>${renderGrowthRateText(growthRate)}</em>
    </div>
  `;
}

function latestPriceAtOrBefore(prices, yearMonth) {
  return [...prices]
    .filter((price) => price.yearMonth <= yearMonth)
    .sort((a, b) => String(a.yearMonth).localeCompare(String(b.yearMonth)))
    .at(-1) || null;
}

function clearMapPopupTradeHistory() {
  if (!els.mapPopupTradeHistory) return;
  els.mapPopupTradeHistory.innerHTML = "";
}

function renderMapPopupTradeHistory(item) {
  if (!els.mapPopupTradeHistory) return;
  if (!item) {
    clearMapPopupTradeHistory();
    return;
  }
  const trades = [...(item.trades || [])].sort(compareMolitTradesDesc);
  const rows = trades.map((trade) => renderMapPopupTradeRow(item, trade)).join("");
  const comparisonLabel = mapPopupTradeHeaderComparisonLabel(item, trades);
  els.mapPopupTradeHistory.innerHTML = `
    <div class="map-popup-trade-head">
      <strong>거래기록</strong>
    </div>
    ${rows ? renderMapPopupTradeColumnHeader(comparisonLabel) : ""}
    ${rows || `<div class="map-popup-trade-empty">선택 평형의 거래기록이 없습니다.</div>`}
  `;
}

function renderMapPopupTradeColumnHeader(comparisonLabel) {
  return `
    <div class="map-popup-trade-column-head" aria-hidden="true">
      <span class="map-popup-trade-date">날짜</span>
      <strong class="map-popup-trade-summary">
        <span class="map-popup-trade-floor">층</span>
        <span class="map-popup-trade-deal">거래가</span>
        <span class="map-popup-trade-delta">
          <span>상승액</span>
          <small>${escapeHtml(comparisonLabel)}</small>
        </span>
        <span class="map-popup-trade-growth">상승률</span>
      </strong>
    </div>
  `;
}

function renderMapPopupTradeRow(item, trade) {
  const comparison = mapPopupTradeGrowthComparison(item, trade, mapPopupVisibleTradeComparisonMonth());
  const floorLabel = Number.isFinite(Number(trade.floor)) ? `${formatInt(trade.floor)}층` : "-";
  return `
    <div class="map-popup-trade-row">
      <span class="map-popup-trade-date">${escapeHtml(mapPopupTradeDateLabel(trade))}</span>
      <strong class="map-popup-trade-summary">
        <span class="map-popup-trade-floor">${escapeHtml(floorLabel)}</span>
        <span class="map-popup-trade-deal">${escapeHtml(formatKoreanPrice(trade.dealAmount))}</span>
        ${renderMapPopupTradeGrowth(comparison)}
      </strong>
    </div>
  `;
}

function mapPopupTradeDateLabel(trade) {
  if (trade.dealDate) return trade.dealDate;
  if (trade.yearMonth && String(trade.yearMonth).length >= 6) return formatMonth(String(trade.yearMonth));
  return "-";
}

function renderMapPopupTradeGrowth(comparison) {
  if (!comparison || !Number.isFinite(comparison.growthRate)) {
    return `
      <b class="map-popup-trade-delta no-data">-</b>
      <b class="map-popup-trade-growth no-data">-</b>
    `;
  }
  const tone = mapPopupTradeGrowthTone(comparison.growthRate);
  return `
    <b class="map-popup-trade-delta ${tone}" title="${escapeHtml(formatMonth(comparison.baseMonth))} 기준 평균가 ${escapeHtml(formatKoreanPrice(comparison.baseSaleMid))}">
      ${escapeHtml(mapPopupSignedKoreanPrice(comparison.growthAmount))}
    </b>
    <b class="map-popup-trade-growth ${tone}">
      ${escapeHtml(mapPopupTradeGrowthText(comparison.growthRate))}
    </b>
  `;
}

function mapPopupTradeHeaderComparisonLabel(item, trades) {
  const latestTrade = trades[0];
  const monthCount = mapPopupVisibleTradeComparisonMonth();
  if (!latestTrade) return "기준 평균가 대비";
  const comparison = mapPopupTradeGrowthComparison(item, latestTrade, monthCount);
  const month = comparison?.requestedMonth || shiftCompactMonth(latestTrade.yearMonth, -monthCount);
  return month ? `기준 평균가(${formatKoreanYearMonth(month)}) 대비` : "기준 평균가 대비";
}

function mapPopupVisibleTradeComparisonMonth() {
  const months = typeof currentPeriodMonths === "function" ? Number(currentPeriodMonths()) : 12;
  return mapPopupTradeComparisonMonths.includes(months) ? months : 12;
}

function mapPopupTradeGrowthTone(rate) {
  const value = Number(rate);
  if (!Number.isFinite(value) || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

function mapPopupTradeGrowthText(rate) {
  const value = Number(rate);
  if (!Number.isFinite(value)) return "-";
  const percent = `${(Math.abs(value) * 100).toFixed(1)}%`;
  if (value > 0) return `${percent} 상승`;
  if (value < 0) return `${percent} 하락`;
  return percent;
}

function mapPopupSignedKoreanPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  if (number === 0) return "0만";
  return `${number > 0 ? "+" : ""}${formatSignedKoreanPrice(number)}`;
}

function formatKoreanYearMonth(yearMonth) {
  if (!yearMonth || String(yearMonth).length < 6) return "";
  return `${String(yearMonth).slice(2, 4)}년 ${String(yearMonth).slice(4, 6)}월`;
}

function mapPopupTradeGrowthComparison(item, trade, monthCount) {
  const comparisons = mapPopupTradeGrowthComparisons(item, trade);
  return comparisons[String(monthCount)] || null;
}

function mapPopupTradeGrowthComparisons(item, trade) {
  const prices = item.allPrices || item.prices || [];
  return Object.fromEntries(mapPopupTradeComparisonMonths.map((monthCount) => {
    const baseMonth = shiftCompactMonth(trade.yearMonth, -monthCount);
    const base = latestPriceAtOrBefore(prices, baseMonth);
    const baseSaleMid = Number(base?.saleMid);
    const dealAmount = Number(trade.dealAmount);
    if (!baseMonth || !Number.isFinite(baseSaleMid) || !baseSaleMid || !Number.isFinite(dealAmount)) {
      return [String(monthCount), null];
    }
    return [String(monthCount), {
      requestedMonth: baseMonth,
      baseMonth: base.yearMonth,
      baseSaleMid,
      dealAmount,
      growthAmount: dealAmount - baseSaleMid,
      growthRate: (dealAmount - baseSaleMid) / baseSaleMid
    }];
  }));
}

function shiftCompactMonth(yearMonth, offset) {
  if (!yearMonth || String(yearMonth).length < 6) return "";
  const date = parseMonth(String(yearMonth));
  date.setMonth(date.getMonth() + offset);
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function compareMolitTradesDesc(a, b) {
  return String(b.dealDate || "").localeCompare(String(a.dealDate || ""))
    || String(b.id || "").localeCompare(String(a.id || ""));
}

function renderMapPopupChart({ months, series }) {
  const result = renderGraphSvg({
    design: activeGraphDesign(),
    interactive: true,
    mode: "popup",
    months,
    series,
    showPyeong: false
  });
  els.mapPopupChart.innerHTML = result.html;
  bindMapPopupChartHover({
    width: result.geometry.width,
    months,
    series,
    x: result.geometry.x,
    y: result.geometry.y
  });
}
