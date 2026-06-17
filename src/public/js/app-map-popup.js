async function openMapApartmentDetail(apartmentId, seedItem = null) {
  const requestId = ++state.mapPopupRequestId;
  const source = currentMapSource();
  const period = currentMapPeriodParams();
  const cacheKey = `${source}:${apartmentId}:${period.start}:${period.end}`;
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
      end: period.end
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
  els.mapPopupStats.innerHTML = `
    <div class="map-popup-loading-card"></div>
    <div class="map-popup-loading-card"></div>
  `;
  els.mapPopupChart.innerHTML = `
    <div class="map-popup-loading">
      <span class="map-popup-spinner" aria-hidden="true"></span>
      <strong>시세 그래프를 불러오는 중</strong>
      <em>평형별 월별 데이터를 준비하고 있습니다.</em>
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
    return;
  }

  setMapApartmentPopupVisible(true);
  els.mapPopupTitle.textContent = detail.apartment.name;
  if (els.mapPopupPyeongGrowth) els.mapPopupPyeongGrowth.innerHTML = "";
  renderMapPopupRanks(detail.rankSummary);

  const latestMonth = detail.months.at(-1);
  if (!latestMonth) {
    if (els.mapPopupPyeongGrowth) els.mapPopupPyeongGrowth.innerHTML = "";
    els.mapPopupMeta.textContent = `${detail.apartment.neighborhoodName || "-"} / 시세 정보 없음`;
    els.mapPopupStats.innerHTML = "";
    els.mapPopupChart.innerHTML = `<div class="empty">표시할 시세 데이터가 없습니다.</div>`;
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
      prices: areaType.prices.filter((price) => price.yearMonth >= startMonth && price.yearMonth <= latestMonth)
    }))
    .filter((areaType) => areaType.prices.length);

  if (!allSeries.length) {
    if (els.mapPopupPyeongGrowth) els.mapPopupPyeongGrowth.innerHTML = "";
    els.mapPopupStats.innerHTML = "";
    els.mapPopupChart.innerHTML = `<div class="empty">선택 기간의 시세 데이터가 없습니다.</div>`;
    return;
  }

  const selected = selectedMapPopupSeries(allSeries);
  const selectedSeries = selected ? [selected] : [];
  renderMapPopupPyeongGrowth(allSeries, latestMonth);
  els.mapPopupStats.innerHTML = `
    ${renderMapPopupAreaPicker(allSeries, selected)}
    ${selected ? renderMapPopupAreaSummary(selected, latestMonth) : ""}
  `;

  renderMapPopupChart({ months, series: selectedSeries, pyeongSeriesSource: allSeries });
}

function selectedMapPopupSeries(series) {
  if (!series.length) return null;
  const selected = series.find((item) => item.id === state.mapPopupSelectedAreaTypeId);
  if (selected) return selected;
  const fallback = [...series].sort((a, b) =>
    areaTypeDealCount(b) - areaTypeDealCount(a)
    || Number(b.exclusiveAreaPyeong || 0) - Number(a.exclusiveAreaPyeong || 0)
  )[0];
  state.mapPopupSelectedAreaTypeId = fallback?.id || null;
  return fallback || null;
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
              ${escapeHtml(item.label || "-")} · 거래 ${formatInt(areaTypeDealCount(item))}건
            </option>
          `).join("")}
        </select>
      </label>
      <em>선택 평형 실거래가 + 평당가격</em>
    </div>
  `;
}

function renderMapPopupPyeongGrowth(series, latestMonth) {
  if (!els.mapPopupPyeongGrowth) return;
  const latest = averageLatestPyeongAtOrBefore(series, latestMonth);
  const rows = [1, 3, 5].map((years) => {
    const start = averageLatestPyeongAtOrBefore(series, periodStartMonth(latestMonth, years));
    if (!Number.isFinite(latest) || !Number.isFinite(start) || !start) {
      return `<em class="no-data">${years}년 없음</em>`;
    }
    const growthRate = (latest - start) / start;
    return `<em class="${growthRate >= 0 ? "positive" : "negative"}">${years}년 ${formatPercent(growthRate)}</em>`;
  }).join("");
  els.mapPopupPyeongGrowth.innerHTML = `
    <span>평당 상승률</span>
    ${rows}
  `;
}

function renderMapPopupRanks(rankSummary) {
  if (!els.mapPopupRanks) return;
  if (!rankSummary) {
    els.mapPopupRanks.innerHTML = "";
    return;
  }
  const rows = [
    {
      label: shortDongLabel(rankSummary.dongName || "동네"),
      rank: rankSummary.dongRank,
      total: rankSummary.dongRankTotal
    },
    {
      label: shortZoomLabel(rankSummary.sigunguName || "", "sigungu") || "구",
      rank: rankSummary.sigunguRank,
      total: rankSummary.sigunguRankTotal
    },
    {
      label: shortRegionLabel(rankSummary.sidoName || "") || "시",
      rank: rankSummary.sidoRank,
      total: rankSummary.sidoRankTotal
    },
    {
      label: "전국",
      rank: rankSummary.countryRank,
      total: rankSummary.countryRankTotal
    }
  ].filter((item) => Number.isFinite(Number(item.rank)));
  els.mapPopupRanks.innerHTML = rows.length
    ? rows.map((item) => `
      <span>
        <b>${escapeHtml(item.label)}</b>
        ${formatRankText(item.rank, item.total)}
      </span>
    `).join("")
    : "";
}

function averagePyeongAtMonth(series, yearMonth) {
  return average(series.flatMap((item) => {
    const price = item.prices.find((entry) => entry.yearMonth === yearMonth);
    return Number.isFinite(Number(price?.pyeongPrice)) ? [Number(price.pyeongPrice)] : [];
  }));
}

function averageLatestPyeongAtOrBefore(series, yearMonth) {
  return average(series.flatMap((item) => {
    const price = latestPriceAtOrBefore(item.prices, yearMonth);
    return Number.isFinite(Number(price?.pyeongPrice)) ? [Number(price.pyeongPrice)] : [];
  }));
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
  const directionClass = growthAmount >= 0 ? "positive" : "negative";
  return `
    <div class="map-popup-change-row">
      <span>${years}년전</span>
      <strong>${formatKoreanPrice(start.saleMid)} → ${formatKoreanPrice(latest.saleMid)}</strong>
      <em class="${directionClass}">${formatPercent(growthRate)}</em>
    </div>
  `;
}

function latestPriceAtOrBefore(prices, yearMonth) {
  return [...prices]
    .filter((price) => price.yearMonth <= yearMonth)
    .sort((a, b) => String(a.yearMonth).localeCompare(String(b.yearMonth)))
    .at(-1) || null;
}

function renderMapPopupChart({ months, series, pyeongSeriesSource = series }) {
  const result = renderGraphSvg({
    design: activeGraphDesign(),
    interactive: true,
    mode: "popup",
    months,
    series,
    pyeongSeriesSource
  });
  els.mapPopupChart.innerHTML = result.html;
  bindMapPopupChartHover({
    width: result.geometry.width,
    months,
    series,
    pyeongSeriesSource,
    x: result.geometry.x,
    y: result.geometry.y,
    pyeongY: result.geometry.pyeongY
  });
}
