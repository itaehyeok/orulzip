function applyQuickPeriod(years) {
  applyQuickPeriodMonths(Math.max(1, Math.round(Number(years || 1) * 12)));
}

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
}

function syncApartmentRankModeButtons() {
  document.querySelectorAll("[data-apartment-rank-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.apartmentRankMode === state.apartmentRankMode);
  });
  if (els.apartmentPageSizeSelect && Number(els.apartmentPageSizeSelect.value) !== state.apartmentRankPageSize) {
    els.apartmentPageSizeSelect.value = String(state.apartmentRankPageSize);
  }
}

function syncPriceBandBasisButtons() {
  if (els.priceBandPageSizeSelect && Number(els.priceBandPageSizeSelect.value) !== state.priceBandPageSize) {
    els.priceBandPageSizeSelect.value = String(state.priceBandPageSize);
  }
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
        <td class="${row.growthRate >= 0 ? "positive" : "negative"}">${formatPercent(row.growthRate)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="7" class="empty">표시할 동네 데이터가 없습니다.</td></tr>`;
}

function renderApartmentTable(result) {
  syncApartmentRankModeButtons();
  const pagination = result.pagination || {
    page: 1,
    pageSize: result.rows.length || state.apartmentRankPageSize,
    totalRows: result.rows.length,
    totalPages: 1
  };
  state.apartmentRankPage = pagination.page;
  const start = pagination.totalRows ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const end = pagination.totalRows ? Math.min(pagination.page * pagination.pageSize, pagination.totalRows) : 0;
  const periodLabel = result.period?.startMonth && result.period?.endMonth
    ? `${formatMonth(result.period.startMonth)} - ${formatMonth(result.period.endMonth)}`
    : "";
  const metricLabel = state.apartmentRankMode === "averagePyeong" ? "평균평당가" : "상승률";
  els.apartmentCount.textContent = `${metricLabel} · ${formatInt(pagination.totalRows)}개${periodLabel ? ` · ${periodLabel}` : ""}${pagination.totalRows ? ` · ${formatInt(start)}-${formatInt(end)}` : ""}`;
  renderApartmentTableHead();
  els.apartmentRows.innerHTML = result.rows.length
    ? result.rows.map((row) => state.apartmentRankMode === "averagePyeong" ? `
      <tr class="clickable-row" data-apartment-id="${escapeHtml(row.apartmentId)}">
        <td>${row.rank}</td>
        <td>${escapeHtml(row.apartmentName)}</td>
        <td>${escapeHtml(row.neighborhoodName)}</td>
        <td>${escapeHtml(row.areaLabel)}</td>
        <td>${formatMoney(row.averagePyeongPrice)}</td>
        <td>${formatMoney(row.endPyeongPrice)}</td>
        <td>${formatInt(row.observedMonthCount)}개월</td>
        <td class="${row.growthRate >= 0 ? "positive" : "negative"}">${formatPercent(row.growthRate)}</td>
      </tr>
    ` : `
      <tr class="clickable-row" data-apartment-id="${escapeHtml(row.apartmentId)}">
        <td>${row.rank}</td>
        <td>${escapeHtml(row.apartmentName)}</td>
        <td>${escapeHtml(row.neighborhoodName)}</td>
        <td>${escapeHtml(row.areaLabel)}</td>
        <td>${formatMoney(row.startPyeongPrice)}</td>
        <td>${formatMoney(row.endPyeongPrice)}</td>
        <td class="${row.growthAmount >= 0 ? "positive" : "negative"}">${formatMoney(row.growthAmount)}</td>
        <td class="${row.growthRate >= 0 ? "positive" : "negative"}">${formatPercent(row.growthRate)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="8" class="empty">표시할 아파트 데이터가 없습니다.</td></tr>`;
  renderApartmentPagination(pagination);

  els.apartmentRows.querySelectorAll("[data-apartment-id]").forEach((row) => {
    row.addEventListener("click", () => loadApartmentDetail(row.dataset.apartmentId));
  });
}

function renderApartmentTableHead() {
  if (!els.apartmentHeadRow) return;
  els.apartmentHeadRow.innerHTML = state.apartmentRankMode === "averagePyeong"
    ? `
      <th>순위</th>
      <th>아파트</th>
      <th>동</th>
      <th>면적 구성</th>
      <th>평균 평당가</th>
      <th>현재 평당가</th>
      <th>조사월</th>
      <th>상승률</th>
    `
    : `
      <th>순위</th>
      <th>아파트</th>
      <th>동</th>
      <th>면적 구성</th>
      <th>시작 평당가</th>
      <th>현재 평당가</th>
      <th>상승액</th>
      <th>상승률</th>
    `;
}

function renderApartmentPagination(pagination) {
  if (!els.apartmentPagination) return;
  if (!pagination || pagination.totalPages <= 1) {
    els.apartmentPagination.innerHTML = "";
    return;
  }
  const page = Number(pagination.page || 1);
  const totalPages = Number(pagination.totalPages || 1);
  const pageNumbers = visiblePageNumbers(page, totalPages);
  els.apartmentPagination.innerHTML = `
    <button type="button" data-apartment-page="1" ${page <= 1 ? "disabled" : ""}>처음</button>
    <button type="button" data-apartment-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>이전</button>
    ${pageNumbers.map((item) => item === "..."
      ? `<span>...</span>`
      : `<button type="button" data-apartment-page="${item}" class="${item === page ? "active" : ""}">${item}</button>`
    ).join("")}
    <button type="button" data-apartment-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>다음</button>
    <button type="button" data-apartment-page="${totalPages}" ${page >= totalPages ? "disabled" : ""}>마지막</button>
  `;
}

function renderPriceBandTable(result, basisBands = null) {
  syncPriceBandBasisButtons();
  if (result.basis === "start" || result.basis === "end") state.priceBandBasis = result.basis;
  state.priceBandKey = result.selectedBandKey === null || result.selectedBandKey === undefined
    ? ""
    : String(result.selectedBandKey);
  const rows = Array.isArray(result.rows) ? result.rows : [];
  const bands = Array.isArray(result.bands) ? result.bands : [];
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
  const basisLabel = result.basis === "end" ? "현재 가격대" : "과거 가격대";
  const selectedBand = result.selectedBand || bands.find((band) => String(band.bandKey) === state.priceBandKey) || null;
  const selectedBandLabel = selectedBand?.bandLabel || "가격대";
  const periodLabel = result.period?.startMonth && result.period?.endMonth
    ? `${formatMonth(result.period.startMonth)} - ${formatMonth(result.period.endMonth)}`
    : "";
  const cacheLabel = formatPriceBandCacheLabel(result.cache);
  els.priceBandCount.textContent = `${basisLabel} · ${selectedBandLabel} · ${formatInt(pagination.totalRows)}개${periodLabel ? ` · ${periodLabel}` : ""}${pagination.totalRows ? ` · ${formatInt(start)}-${formatInt(end)}` : ""}${cacheLabel ? ` · ${cacheLabel}` : ""}`;
  renderPriceBandSummary(summaryBands, state.priceBandBasis, state.priceBandKey);
  els.priceBandRows.innerHTML = rows.length
    ? rows.map((row) => `
      <tr>
        <td>${row.rank}</td>
        <td>
          <strong class="table-main">${escapeHtml(row.apartmentName)}</strong>
          <span class="muted-cell">${escapeHtml(priceBandApartmentMeta(row))}</span>
          <span class="table-links">
            <a href="${escapeHtml(naverApartmentLink(row))}" target="_blank" rel="noopener noreferrer">네이버지도</a>
            <a href="${escapeHtml(hogangnonoApartmentLink(row))}" target="_blank" rel="noopener noreferrer">호갱노노</a>
          </span>
        </td>
        <td>${escapeHtml(formatPriceBandLocation(row))}</td>
        <td>${formatKoreanPrice(row.startSalePrice)}</td>
        <td>${formatKoreanPrice(row.endSalePrice)}</td>
        <td>${formatMoney(row.startPyeongPrice)}</td>
        <td>${formatMoney(row.endPyeongPrice)}</td>
        <td class="${row.growthRate >= 0 ? "positive" : "negative"}">${formatPercent(row.growthRate)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="8" class="empty">선택한 가격대에 표시할 아파트 데이터가 없습니다.</td></tr>`;
  renderPriceBandPagination(pagination);
}

function renderPriceBandSummary(basisBands, selectedBasis, selectedBandKey) {
  if (!els.priceBandSummary) return;
  const groups = [
    { basis: "start", label: "과거 가격대", prefix: "과거", bands: Array.isArray(basisBands?.start) ? basisBands.start : [] },
    { basis: "end", label: "현재 가격대", prefix: "현재", bands: Array.isArray(basisBands?.end) ? basisBands.end : [] }
  ];
  if (!groups.some((group) => group.bands.length)) {
    els.priceBandSummary.innerHTML = `<div class="empty">표시할 가격대가 없습니다.</div>`;
    return;
  }
  els.priceBandSummary.innerHTML = groups.map((group) => `
    <div class="price-band-row">
      <div class="price-band-row-label">${group.label}</div>
      <div class="price-band-chip-row">
        ${group.bands.length ? group.bands.map((band) => renderPriceBandChip(band, group, selectedBasis, selectedBandKey)).join("") : `<span class="price-band-empty">데이터 없음</span>`}
      </div>
    </div>
  `).join("");
}

function renderPriceBandChip(band, group, selectedBasis, selectedBandKey) {
  const isActive = group.basis === selectedBasis && String(band.bandKey) === String(selectedBandKey);
  return `
    <button
      type="button"
      class="price-band-chip ${isActive ? "active" : ""}"
      data-price-band-basis="${group.basis}"
      data-price-band-key="${escapeHtml(band.bandKey)}"
    >
      <strong>${group.prefix} ${escapeHtml(band.bandLabel)}</strong>
      <span>${formatInt(band.apartmentCount)}개</span>
      <em>최고 ${formatPercent(band.topGrowthRate)}</em>
    </button>
  `;
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

async function loadApartmentDetail(apartmentId) {
  const detail = await api(`/api/apartment-detail?apartmentId=${encodeURIComponent(apartmentId)}`);
  renderApartmentDetail(detail);
}

function renderApartmentDetail(detail) {
  if (!detail.apartment) return;

  els.apartmentDetailPanel.hidden = false;
  els.detailTitle.textContent = `${detail.apartment.name} KB 월별 시세`;
  els.detailMeta.textContent = `${detail.apartment.neighborhoodName || "-"} / ${detail.areaTypes.length}개 면적`;

  const series = detail.areaTypes
    .filter((areaType) => areaType.prices.length)
    .slice(0, 6)
    .map((areaType, index) => ({
      ...areaType,
      color: colors[index % colors.length]
    }));

  if (!series.length) {
    els.detailChart.innerHTML = `<div class="empty">표시할 시세 데이터가 없습니다.</div>`;
    return;
  }

  const width = 1120;
  const height = 360;
  const padding = { top: 20, right: 40, bottom: 46, left: 82 };
  const months = detail.months;
  const prices = series.flatMap((item) => item.prices.map((price) => price.saleMid).filter(Number.isFinite));
  const yMin = Math.floor(Math.min(...prices) / 5000) * 5000;
  const yMax = Math.ceil(Math.max(...prices) / 5000) * 5000;

  const x = (month) => {
    const index = months.indexOf(month);
    if (months.length <= 1) return padding.left;
    return padding.left + (index / (months.length - 1)) * (width - padding.left - padding.right);
  };
  const y = (value) => {
    return padding.top + (1 - (value - yMin) / (yMax - yMin || 1)) * (height - padding.top - padding.bottom);
  };

  const gridValues = [yMin, Math.round((yMin + yMax) / 2), yMax];
  const grid = gridValues.map((value) => `
    <line x1="${padding.left}" y1="${y(value)}" x2="${width - padding.right}" y2="${y(value)}" stroke="#e5e8ef"></line>
    <text x="${padding.left - 10}" y="${y(value) + 4}" text-anchor="end" font-size="12" fill="#667085">${formatKoreanPrice(value)}</text>
  `).join("");

  const lines = series.map((item) => {
    const commands = item.prices
      .map((price, index) => `${index === 0 ? "M" : "L"} ${x(price.yearMonth).toFixed(1)} ${y(price.saleMid).toFixed(1)}`)
      .join(" ");
    return `<path d="${commands}" fill="none" stroke="${item.color}" stroke-width="2.5"></path>`;
  }).join("");

  const hitPoints = series.flatMap((item) => item.prices.map((price) => `
    <circle
      class="detail-point"
      cx="${x(price.yearMonth).toFixed(1)}"
      cy="${y(price.saleMid).toFixed(1)}"
      r="10"
      fill="transparent"
      data-label="${escapeHtml(item.label || "-")}"
      data-month="${escapeHtml(formatMonth(price.yearMonth))}"
      data-sale-mid="${escapeHtml(formatKoreanPrice(price.saleMid))}"
      data-sale-low="${escapeHtml(formatKoreanPrice(price.saleLow))}"
      data-sale-high="${escapeHtml(formatKoreanPrice(price.saleHigh))}"
      data-pyeong="${escapeHtml(formatMoney(price.pyeongPrice))}"
    ></circle>
  `)).join("");
  const hoverLine = `
    <line class="chart-hover-line detail-hover-line" x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" hidden></line>
    <rect class="chart-hover-hit" x="${padding.left}" y="${padding.top}" width="${width - padding.left - padding.right}" height="${height - padding.top - padding.bottom}" fill="transparent"></rect>
  `;

  const xLabels = months.filter((_, index) => index === 0 || index === months.length - 1 || index % Math.ceil(months.length / 6) === 0)
    .map((month) => `<text x="${x(month)}" y="${height - 10}" text-anchor="middle" font-size="12" fill="#667085">${formatMonth(month)}</text>`)
    .join("");

  const legend = series.map((item) => `
    <span><i style="background:${item.color}"></i>${escapeHtml(item.label || "-")}</span>
  `).join("");

  els.detailChart.innerHTML = `
    <div class="detail-chart-scroll">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="KB 월별 시세 그래프">
        ${grid}
        ${lines}
        ${hitPoints}
        ${xLabels}
        <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#98a2b3"></line>
        <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#98a2b3"></line>
        ${hoverLine}
      </svg>
    </div>
    <div class="legend">${legend}</div>
  `;

  bindDetailChartHover({ width, height, padding, months, series, x });

  els.apartmentDetailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
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

function bindDetailChartHover({ width, padding, months, series, x }) {
  const svg = els.detailChart.querySelector("svg");
  const hit = els.detailChart.querySelector(".chart-hover-hit");
  const line = els.detailChart.querySelector(".detail-hover-line");
  if (!svg || !hit || !line || !els.detailTooltip || !months.length) return;

  hit.addEventListener("mousemove", (event) => {
    const month = nearestMonthFromEvent(event, svg, width, months, x);
    const xPos = x(month);
    line.setAttribute("x1", xPos);
    line.setAttribute("x2", xPos);
    line.hidden = false;

    const rows = series.map((item) => {
      const price = item.prices.find((entry) => entry.yearMonth === month);
      if (!price) return "";
      return `<span><i style="background:${item.color}"></i>${escapeHtml(item.label || "-")} 일반가 ${formatKoreanPrice(price.saleMid)}</span>`;
    }).filter(Boolean).join("");

    showFloatingTooltip(els.detailChart, els.detailTooltip, event, `
      <strong>${formatMonth(month)}</strong>
      ${rows || "<span>데이터 없음</span>"}
    `);
  });

  hit.addEventListener("mouseleave", () => {
    line.hidden = true;
    els.detailTooltip.hidden = true;
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
  els.apartmentRows.innerHTML = `<tr><td colspan="8" class="empty">동기화 후 랭킹이 표시됩니다.</td></tr>`;
  if (els.priceBandRows) els.priceBandRows.innerHTML = `<tr><td colspan="8" class="empty">동기화 후 가격대별 랭킹이 표시됩니다.</td></tr>`;
}
