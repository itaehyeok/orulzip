function activeGraphDesign() {
  return graphDesignVariantMap.get(state.activeGraphDesignId)
    || graphDesignVariantMap.get(defaultGraphDesignId)
    || graphDesignVariants[0];
}

function activePyeongGraphDesign() {
  return pyeongGraphDesignVariantMap.get(state.activePyeongGraphDesignId)
    || pyeongGraphDesignVariantMap.get(defaultPyeongGraphDesignId)
    || pyeongGraphDesignVariants[0];
}

function readStoredGraphDesignId() {
  try {
    const stored = window.localStorage.getItem(graphDesignStorageKey);
    return graphDesignVariantMap.has(stored) ? stored : defaultGraphDesignId;
  } catch {
    return defaultGraphDesignId;
  }
}

function readStoredPyeongGraphDesignId() {
  try {
    const stored = window.localStorage.getItem(pyeongGraphDesignStorageKey);
    return pyeongGraphDesignVariantMap.has(stored) ? stored : defaultPyeongGraphDesignId;
  } catch {
    return defaultPyeongGraphDesignId;
  }
}

function setActiveGraphDesign(id) {
  if (!graphDesignVariantMap.has(id)) return;
  state.activeGraphDesignId = id;
  try {
    window.localStorage.setItem(graphDesignStorageKey, id);
  } catch {
    // localStorage may be disabled in private contexts.
  }
  renderGraphDesignGallery();
  renderPyeongGraphDesignGallery();
  if (state.mapPopupDetail && !els.mapApartmentPopup.hidden) {
    renderMapApartmentDetail(state.mapPopupDetail);
  }
}

function setActivePyeongGraphDesign(id) {
  if (!pyeongGraphDesignVariantMap.has(id)) return;
  state.activePyeongGraphDesignId = id;
  try {
    window.localStorage.setItem(pyeongGraphDesignStorageKey, id);
  } catch {
    // localStorage may be disabled in private contexts.
  }
  renderPyeongGraphDesignGallery();
  renderGraphDesignGallery();
  if (state.mapPopupDetail && !els.mapApartmentPopup.hidden) {
    renderMapApartmentDetail(state.mapPopupDetail);
  }
}

function activeMarkerDesign(level = "apartment") {
  const normalizedLevel = normalizeMarkerLevel(level);
  const levelDesignId = normalizeMarkerDesignIdForLevel(state.markerVerbosityByLevel?.[normalizedLevel], normalizedLevel);
  return markerDesignVariantMap.get(levelDesignId)
    || markerDesignVariantMap.get(state.activeMarkerDesignId)
    || markerDesignVariantMap.get(defaultMarkerDesignId)
    || markerDesignVariants[0];
}

function readStoredMarkerDesignId() {
  try {
    const stored = window.localStorage.getItem(markerDesignStorageKey);
    return markerDesignVariantMap.has(stored) ? stored : defaultMarkerDesignId;
  } catch {
    return defaultMarkerDesignId;
  }
}

function readStoredMarkerVerbosityByLevel(fallbackId = defaultMarkerDesignId) {
  const result = { ...defaultMarkerVerbosityByLevel };
  let hasStoredLevelValue = false;
  try {
    const stored = JSON.parse(window.localStorage.getItem(markerVerbosityStorageKey) || "{}");
    for (const level of markerLevelConfigs) {
      if (markerDesignVariantMap.has(stored?.[level.id])) {
        result[level.id] = normalizeMarkerDesignIdForLevel(stored[level.id], level.id);
        hasStoredLevelValue = true;
      }
    }
  } catch {
    // Ignore malformed localStorage and use defaults.
  }
  if (!hasStoredLevelValue && markerDesignVariantMap.has(fallbackId)) {
    for (const level of markerLevelConfigs) {
      result[level.id] = fallbackId;
    }
  }
  return result;
}

function writeStoredMarkerVerbosityByLevel() {
  try {
    window.localStorage.setItem(markerVerbosityStorageKey, JSON.stringify(state.markerVerbosityByLevel || defaultMarkerVerbosityByLevel));
    window.localStorage.setItem(markerDesignStorageKey, state.markerVerbosityByLevel?.apartment || defaultMarkerDesignId);
  } catch {
    // localStorage may be disabled in private contexts.
  }
}

function setActiveMarkerDesign(id, level = "all") {
  if (!markerDesignVariantMap.has(id)) return;
  const targetLevel = normalizeMarkerLevel(level);
  if (!state.markerVerbosityByLevel) state.markerVerbosityByLevel = { ...defaultMarkerVerbosityByLevel };
  if (level === "all") {
    for (const item of markerLevelConfigs) {
      state.markerVerbosityByLevel[item.id] = normalizeMarkerDesignIdForLevel(id, item.id);
    }
    state.activeMarkerDesignId = id;
  } else {
    if (!isMarkerDesignAllowedForLevel(id, targetLevel)) return;
    state.markerVerbosityByLevel[targetLevel] = id;
    if (targetLevel === "apartment") state.activeMarkerDesignId = id;
  }
  writeStoredMarkerVerbosityByLevel();
  if (state.latestZoomMapData) {
    renderZoomMapSummary(state.latestZoomMapData);
  }
}

function normalizeMarkerLevel(level = "apartment") {
  return markerLevelConfigs.some((item) => item.id === level) ? level : "apartment";
}

function markerVerbosityOptionsForLevel(level = "apartment") {
  return markerVerbosityOptionsByLevel[normalizeMarkerLevel(level)] || markerVerbosityOptionsByLevel.apartment;
}

function isMarkerDesignAllowedForLevel(id, level = "apartment") {
  return markerVerbosityOptionsForLevel(level).some((item) => item.id === id);
}

function normalizeMarkerDesignIdForLevel(id, level = "apartment") {
  if (isMarkerDesignAllowedForLevel(id, level)) return id;
  const fallback = markerVerbosityOptionsForLevel(level)[0]?.id || defaultMarkerDesignId;
  return markerDesignVariantMap.has(fallback) ? fallback : defaultMarkerDesignId;
}

function markerVerbosityOptionForLevel(level, id) {
  return markerVerbosityOptionsForLevel(level).find((item) => item.id === id)
    || markerVerbosityOptionsForLevel(level)[0]
    || { id: defaultMarkerDesignId, label: "기본", note: "" };
}

function activeLogoDesign() {
  return logoDesignVariantMap.get(state.activeLogoDesignId)
    || logoDesignVariantMap.get(defaultLogoDesignId)
    || logoDesignVariants[0];
}

function readStoredLogoDesignId() {
  try {
    const stored = window.localStorage.getItem(logoDesignStorageKey);
    return logoDesignVariantMap.has(stored) ? stored : defaultLogoDesignId;
  } catch {
    return defaultLogoDesignId;
  }
}

function setActiveLogoDesign(id) {
  if (!logoDesignVariantMap.has(id)) return;
  state.activeLogoDesignId = id;
  try {
    window.localStorage.setItem(logoDesignStorageKey, id);
  } catch {
    // localStorage may be disabled in private contexts.
  }
  renderLogoDesignGallery();
}

function activeMapHeaderDesign() {
  return mapHeaderDesignVariantMap.get(state.activeMapHeaderDesignId)
    || mapHeaderDesignVariantMap.get(defaultMapHeaderDesignId)
    || mapHeaderDesignVariants[0];
}

function readStoredMapHeaderDesignId() {
  try {
    const stored = window.localStorage.getItem(mapHeaderDesignStorageKey);
    return mapHeaderDesignVariantMap.has(stored) ? stored : defaultMapHeaderDesignId;
  } catch {
    return defaultMapHeaderDesignId;
  }
}

function setActiveMapHeaderDesign(id) {
  if (!mapHeaderDesignVariantMap.has(id)) return;
  state.activeMapHeaderDesignId = id;
  try {
    window.localStorage.setItem(mapHeaderDesignStorageKey, id);
  } catch {
    // localStorage may be disabled in private contexts.
  }
  applyMapHeaderDesign();
  renderMapHeaderDesignGallery();
}

function applyMapHeaderDesign() {
  const design = activeMapHeaderDesign();
  const root = document.documentElement;
  root.style.setProperty("--map-header-bg", design.headerBg);
  root.style.setProperty("--map-header-text", design.headerText);
  root.style.setProperty("--map-header-search-bg", design.searchBg);
  root.style.setProperty("--map-header-search-text", design.searchText);
  root.style.setProperty("--map-header-search-placeholder", design.searchPlaceholder);
  root.style.setProperty("--map-header-search-icon", design.searchIcon);
  root.style.setProperty("--map-header-chip-bg", design.chipBg);
  root.style.setProperty("--map-header-chip-active-bg", design.chipActiveBg);
  root.style.setProperty("--map-header-chip-active-border", design.chipActiveBorder);
  root.style.setProperty("--map-header-chip-active-text", design.chipActiveText);
  root.style.setProperty("--map-header-period-bg", design.periodBg);
}

function readStoredMarkerLineGapPx() {
  try {
    return normalizeMarkerLineGapPx(window.localStorage.getItem(markerLineGapStorageKey));
  } catch {
    return defaultMarkerLineGapPx;
  }
}

function setMarkerLineGapPx(value) {
  const next = normalizeMarkerLineGapPx(value);
  state.markerLineGapPx = next;
  applyMarkerLineGap();
  try {
    window.localStorage.setItem(markerLineGapStorageKey, String(next));
  } catch {
    // localStorage may be disabled in private contexts.
  }
}

function applyMarkerLineGap() {
  document.documentElement.style.setProperty("--marker-line-gap", `${normalizeMarkerLineGapPx(state.markerLineGapPx)}px`);
}

function normalizeMarkerLineGapPx(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return defaultMarkerLineGapPx;
  return Math.max(0, Math.min(10, Math.round(number)));
}

function readStoredTransitionDesignId() {
  try {
    const stored = window.localStorage.getItem(transitionDesignStorageKey);
    return transitionDesignLabels[stored] ? stored : "current";
  } catch {
    return "current";
  }
}

function renderDesignTab() {
  syncApartmentMarkerDesignControls();
  syncRegionMarkerDesignControls();
}

function renderGraphDesignGallery() {
  if (!els.graphDesignGrid) return;
  const sample = graphDesignSampleData();
  const active = activeGraphDesign();
  els.designGraphSelected.textContent = `${active.name} / ${graphDesignVariants.length}개`;
  els.graphDesignGrid.innerHTML = graphDesignVariants.map((design, index) => {
    const previewSeries = sample.series.map((item, seriesIndex) => ({
      ...item,
      color: graphDesignColor(design, seriesIndex, item.color)
    }));
    const result = renderGraphSvg({
      design,
      interactive: false,
      mode: "preview",
      months: sample.months,
      series: previewSeries
    });
    const isActive = design.id === active.id;
    return `
      <button class="graph-design-card ${isActive ? "active" : ""}" type="button" data-graph-design-id="${escapeHtml(design.id)}" aria-pressed="${isActive}">
        <span class="graph-design-card-head">
          <strong>${escapeHtml(design.name)}</strong>
          <em>${isActive ? "선택됨" : `${String(index + 1).padStart(2, "0")}/${graphDesignVariants.length}`}</em>
        </span>
        <span class="graph-design-preview">${result.html}</span>
      </button>
    `;
  }).join("");
}

function renderPyeongGraphDesignGallery() {
  if (!els.pyeongGraphDesignGrid) return;
  const sample = graphDesignSampleData();
  const active = activePyeongGraphDesign();
  els.designPyeongGraphSelected.textContent = `${active.name} / ${pyeongGraphDesignVariants.length}개`;
  els.pyeongGraphDesignGrid.innerHTML = pyeongGraphDesignVariants.map((design, index) => {
    const result = renderGraphSvg({
      design: activeGraphDesign(),
      pyeongDesign: design,
      interactive: false,
      mode: "preview",
      months: sample.months,
      series: sample.series.map((item, seriesIndex) => ({
        ...item,
        color: graphDesignColor(activeGraphDesign(), seriesIndex, item.color)
      }))
    });
    const isActive = design.id === active.id;
    return `
      <button class="graph-design-card ${isActive ? "active" : ""}" type="button" data-pyeong-graph-design-id="${escapeHtml(design.id)}" aria-pressed="${isActive}">
        <span class="graph-design-card-head">
          <strong>${escapeHtml(design.name)}</strong>
          <em>${isActive ? "선택됨" : `${String(index + 1).padStart(2, "0")}/${pyeongGraphDesignVariants.length}`}</em>
        </span>
        <span class="graph-design-preview">${result.html}</span>
      </button>
    `;
  }).join("");
}

function renderMapHeaderDesignGallery() {
  if (!els.mapHeaderDesignGrid) return;
  const active = activeMapHeaderDesign();
  if (els.designMapHeaderSelected) {
    els.designMapHeaderSelected.textContent = `${active.name} / ${mapHeaderDesignVariants.length}개`;
  }
  els.mapHeaderDesignGrid.innerHTML = mapHeaderDesignVariants.map((design, index) => {
    const isActive = design.id === active.id;
    return `
      <button class="map-header-design-card ${isActive ? "active" : ""}" type="button" data-map-header-design-id="${escapeHtml(design.id)}" aria-pressed="${isActive}">
        <span class="graph-design-card-head">
          <strong>${escapeHtml(design.name)}</strong>
          <em>${isActive ? "선택됨" : `${String(index + 1).padStart(2, "0")}/${mapHeaderDesignVariants.length}`}</em>
        </span>
        <span class="map-header-design-preview" style="${mapHeaderPreviewStyle(design)}">
          <span class="map-header-preview-top">
            <span class="map-header-preview-logo">${logoSymbolSvg("roof-up-open")}</span>
            <span class="map-header-preview-search">동 또는 아파트</span>
          </span>
          <span class="map-header-preview-tabs">
            <span class="active">지도</span>
            <span>가격대별</span>
            <span>디자인</span>
            <span>더보기</span>
          </span>
          <span class="map-header-preview-periods">
            <span>3개월전</span>
            <span>6개월전</span>
            <span class="active">1년전</span>
            <span>3년전</span>
          </span>
          <span class="map-header-preview-map">
            <span class="preview-road road-a"></span>
            <span class="preview-road road-b"></span>
            <span class="preview-water"></span>
            <span class="preview-marker marker-a">12.4%</span>
            <span class="preview-marker marker-b">8.7%</span>
          </span>
        </span>
      </button>
    `;
  }).join("");
}

function mapHeaderPreviewStyle(design) {
  return [
    `--preview-header-bg:${design.headerBg}`,
    `--preview-header-text:${design.headerText}`,
    `--preview-search-bg:${design.searchBg}`,
    `--preview-search-text:${design.searchText}`,
    `--preview-search-placeholder:${design.searchPlaceholder}`,
    `--preview-search-icon:${design.searchIcon}`,
    `--preview-chip-bg:${design.chipBg}`,
    `--preview-chip-active-bg:${design.chipActiveBg}`,
    `--preview-chip-active-border:${design.chipActiveBorder}`,
    `--preview-chip-active-text:${design.chipActiveText}`,
    `--preview-period-bg:${design.periodBg}`,
    `--preview-map-water:${design.mapWater}`,
    `--preview-map-land:${design.mapLand}`,
    `--preview-map-road:${design.mapRoad}`
  ].join(";");
}

function renderLogoDesignGallery() {
  if (!els.logoDesignGrid) return;
  const active = activeLogoDesign();
  if (els.designLogoSelected) els.designLogoSelected.textContent = `${active.name} / ${logoDesignVariants.length}개`;
  els.logoDesignGrid.innerHTML = logoDesignVariants.map((design, index) => {
    const isActive = design.id === active.id;
    return `
      <button class="logo-design-card ${isActive ? "active" : ""}" type="button" data-logo-design-id="${escapeHtml(design.id)}" aria-pressed="${isActive}">
        <span class="graph-design-card-head">
          <strong>${escapeHtml(design.name)}</strong>
          <em>${isActive ? "선택됨" : `${String(index + 1).padStart(2, "0")}/${logoDesignVariants.length}`}</em>
        </span>
        <span class="logo-design-preview">${logoPreviewHtml(design)}</span>
        <span class="logo-design-note">${escapeHtml(design.tagline)}</span>
      </button>
    `;
  }).join("");
}

function logoPreviewHtml(design) {
  return `
    <span class="orulzip-logo tone-${escapeHtml(design.tone)} style-${escapeHtml(design.style)}">
      <span class="orulzip-logo-mark">${logoSymbolSvg(design.symbol)}</span>
      <span class="orulzip-logo-word">오를집</span>
    </span>
  `;
}

function logoSymbolSvg(symbol) {
  const common = `viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false"`;
  const svgs = {
    "minimal-roof": `
      <svg ${common}>
        <path class="logo-stroke" d="M8 25 24 11l16 14"/>
        <path class="logo-stroke" d="M14 42V25h20v17"/>
        <path class="logo-accent" d="M18 34l6-7 4 4 7-11"/>
      </svg>
    `,
    "roof-up-short": `
      <svg ${common}>
        <path class="logo-stroke" d="M9 25 24 12l15 13"/>
        <path class="logo-stroke" d="M15 42V26h18v16"/>
        <path class="logo-accent" d="M19 34l5-6 4 4 5-8"/>
      </svg>
    `,
    "roof-up-long": `
      <svg ${common}>
        <path class="logo-stroke" d="M8 25 24 11l16 14"/>
        <path class="logo-stroke" d="M14 42V25h20v17"/>
        <path class="logo-accent" d="M17 35l6-7 5 4 9-13"/>
        <path class="logo-accent" d="M33 19h4v4"/>
      </svg>
    `,
    "roof-up-corner": `
      <svg ${common}>
        <path class="logo-stroke" d="M8 25 24 11l16 14"/>
        <path class="logo-stroke" d="M14 42V25h20v17"/>
        <path class="logo-accent" d="M18 35h9c4 0 7-3 7-7v-7"/>
        <path class="logo-accent" d="M30 21h4v4"/>
      </svg>
    `,
    "roof-up-window": `
      <svg ${common}>
        <path class="logo-stroke" d="M8 25 24 11l16 14"/>
        <path class="logo-stroke" d="M14 42V25h20v17"/>
        <path class="logo-stroke" d="M18 30h5v5h-5z"/>
        <path class="logo-accent" d="M25 35l4-5 3 3 4-8"/>
      </svg>
    `,
    "roof-up-door": `
      <svg ${common}>
        <path class="logo-stroke" d="M8 25 24 11l16 14"/>
        <path class="logo-stroke" d="M14 42V25h20v17"/>
        <path class="logo-stroke" d="M20 42V31h8v11"/>
        <path class="logo-accent" d="M29 34l3-4 3 2 3-7"/>
      </svg>
    `,
    "roof-up-dot": `
      <svg ${common}>
        <path class="logo-stroke" d="M8 25 24 11l16 14"/>
        <path class="logo-stroke" d="M14 42V25h20v17"/>
        <path class="logo-accent" d="M18 34l6-7 4 4 6-9"/>
        <circle class="logo-accent-fill" cx="35" cy="21" r="2.6"/>
      </svg>
    `,
    "roof-up-peak": `
      <svg ${common}>
        <path class="logo-stroke" d="M8 25 24 11l16 14"/>
        <path class="logo-stroke" d="M14 42V25h20v17"/>
        <path class="logo-accent" d="M18 35l5-8 5 6 5-12"/>
      </svg>
    `,
    "roof-up-open": `
      <svg ${common}>
        <path class="logo-stroke" d="M8 25 24 11l16 14"/>
        <path class="logo-stroke" d="M15 42V29"/>
        <path class="logo-stroke" d="M33 42V29"/>
        <path class="logo-accent" d="M18 34l6-7 4 4 7-11"/>
      </svg>
    `,
    "roof-up-rounded": `
      <svg ${common}>
        <path class="logo-stroke logo-stroke-rounded" d="M8 25C13 21 18 16 24 11c6 5 11 10 16 14"/>
        <path class="logo-stroke logo-stroke-rounded" d="M14 42V25h20v17"/>
        <path class="logo-accent logo-stroke-rounded" d="M18 34c2-2 4-5 6-7 2 1 3 3 4 4 3-3 5-7 7-11"/>
      </svg>
    `,
    "roof-up-bold": `
      <svg ${common}>
        <path class="logo-stroke logo-stroke-bold" d="M8 25 24 11l16 14"/>
        <path class="logo-stroke logo-stroke-bold" d="M14 42V25h20v17"/>
        <path class="logo-accent logo-stroke-bold" d="M18 34l6-7 4 4 7-11"/>
      </svg>
    `
  };
  return svgs[symbol] || svgs["minimal-roof"];
}

function graphDesignSampleData() {
  const start = new Date(2023, 5, 1);
  const months = Array.from({ length: 38 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
  const buildPrices = (base, slope, wave, bump = 0, pyeongBase = 3200) => months.map((yearMonth, index) => ({
    yearMonth,
    saleMid: Math.round(base + slope * index + Math.sin(index / 3.2) * wave + Math.max(0, index - 24) * bump),
    pyeongPrice: Math.round(pyeongBase + slope * 0.08 * index + Math.sin(index / 4) * wave * 0.06 + Math.max(0, index - 24) * bump * 0.08)
  }));
  return {
    months,
    series: [
      { label: "59A", color: colors[0], prices: buildPrices(72000, 520, 1600, 160, 3600) },
      { label: "84A", color: colors[1], prices: buildPrices(98000, 760, 2100, 220, 4100) },
      { label: "101", color: colors[2], prices: buildPrices(124000, 640, 2500, 120, 4450) },
      { label: "114", color: colors[3], prices: buildPrices(148000, 830, 2800, 260, 4700) }
    ]
  };
}

function renderGraphSvg({ design, pyeongDesign = activePyeongGraphDesign(), interactive, mode, months, series, pyeongSeriesSource = series }) {
  const geometry = graphChartGeometry({ mode, months, series });
  const { width, height, padding, chartRight, chartBottom, x, y, yMin, yMax } = geometry;
  const svgId = `graph-${mode}-${design.id}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  const grid = renderGraphGrid({ design, y, yMin, yMax, padding, chartRight });
  const monthLabels = renderGraphMonthLabels({ design, mode, months, x, height });
  const periodMarkers = renderGraphPeriodMarkers({ months, series, x, y, padding, chartBottom });
  const pyeongSeries = averagePyeongGraphSeries({ months, series: pyeongSeriesSource });
  const pyeongGeometry = graphPyeongGeometry({ pyeongSeries, padding, chartBottom });
  const pyeongAxis = renderPyeongGraphAxis({ design, pyeongDesign, pyeongGeometry, padding, chartBottom, chartRight });
  const pyeongSeriesMarkup = renderPyeongGraphSeries({ design: pyeongDesign, pyeongSeries, x, y: pyeongGeometry?.y });
  const seriesMarkup = series.map((item, index) => renderGraphSeries({
    chartBottom,
    design,
    index,
    item,
    mode,
    svgId,
    x,
    y
  })).join("");
  const defs = series.map((item, index) => renderGraphGradient({ design, item, index, svgId })).join("");
  const hover = interactive
    ? `
      <line class="chart-hover-line map-popup-hover-line" x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${chartBottom}" style="stroke:${design.textColor};" hidden></line>
      <rect class="chart-hover-hit" x="${padding.left}" y="${padding.top}" width="${chartRight - padding.left}" height="${chartBottom - padding.top}" fill="transparent"></rect>
    `
    : "";

  return {
    geometry: {
      ...geometry,
      pyeongY: pyeongGeometry?.y,
      pyeongSeries
    },
    html: `
      <svg class="map-popup-chart-svg graph-design-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="평형별 시세 그래프">
        <defs>${defs}</defs>
        <rect x="0" y="0" width="${width}" height="${height}" rx="${mode === "preview" ? 12 : 0}" fill="${design.background}"></rect>
        <rect class="map-popup-plot-bg" x="${padding.left}" y="${padding.top}" width="${chartRight - padding.left}" height="${chartBottom - padding.top}" rx="${design.plotRadius}" style="fill:${design.plotBackground};stroke:${design.gridMode === "none" ? "transparent" : design.gridColor};"></rect>
        ${grid}
        ${pyeongAxis}
        ${pyeongSeriesMarkup}
        ${seriesMarkup}
        ${periodMarkers}
        ${monthLabels}
        <line class="map-popup-axis-line" x1="${padding.left}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}" style="stroke:${design.axisColor};"></line>
        <line class="map-popup-axis-line" x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${chartBottom}" style="stroke:${design.axisColor};"></line>
        ${pyeongGeometry ? `<line class="map-popup-pyeong-axis-line" x1="${chartRight}" y1="${padding.top}" x2="${chartRight}" y2="${chartBottom}"></line>` : ""}
        ${hover}
      </svg>
    `
  };
}

function averagePyeongGraphSeries({ months, series }) {
  return months.map((yearMonth) => {
    const pyeongPrice = average(series.flatMap((item) => {
      const price = item.prices.find((entry) => entry.yearMonth === yearMonth);
      return Number.isFinite(Number(price?.pyeongPrice)) ? [Number(price.pyeongPrice)] : [];
    }));
    return Number.isFinite(pyeongPrice) ? { yearMonth, pyeongPrice } : null;
  }).filter(Boolean);
}

function graphPyeongGeometry({ pyeongSeries, padding, chartBottom }) {
  const values = pyeongSeries.map((price) => Number(price.pyeongPrice)).filter(Number.isFinite);
  if (!values.length) return null;
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = Math.max(rawMax - rawMin, 500);
  const yMin = Math.max(0, Math.floor((rawMin - span * 0.14) / 500) * 500);
  const yMax = Math.ceil((rawMax + span * 0.14) / 500) * 500;
  const separationOffset = 10;
  const y = (value) => Math.min(
    chartBottom - 2,
    padding.top + separationOffset + (1 - (value - yMin) / (yMax - yMin || 1)) * (chartBottom - padding.top - separationOffset)
  );
  return { y, yMin, yMax };
}

function renderPyeongGraphAxis({ design, pyeongDesign, pyeongGeometry, padding, chartBottom, chartRight }) {
  if (!pyeongGeometry || pyeongDesign.labelMode === "none") return "";
  const ratios = [0, 0.5, 1];
  const titleText = "계산식: 모든 평형의 해당 월 평당 거래가를 평균낸 값입니다.";
  return ratios.map((ratio) => {
    const value = Math.round((pyeongGeometry.yMin + (pyeongGeometry.yMax - pyeongGeometry.yMin) * ratio) / 100) * 100;
    const yPos = pyeongGeometry.y(value).toFixed(1);
    return `
      <text class="map-popup-pyeong-axis-label" x="${chartRight + 10}" y="${(Number(yPos) + 4).toFixed(1)}" text-anchor="start">${formatMoney(value)}</text>
    `;
  }).join("") + `
    <g class="map-popup-pyeong-axis-help">
      <title>${escapeHtml(titleText)}</title>
      <text class="map-popup-pyeong-axis-title" x="${chartRight + 10}" y="${Math.max(13, padding.top - 9)}" text-anchor="start">평당가격</text>
    </g>
  `;
}

function renderPyeongGraphSeries({ design, pyeongSeries, x, y }) {
  if (!y) return "";
  const color = design.monochrome ? "#98a2b3" : "#475467";
  const points = pyeongSeries
    .filter((price) => Number.isFinite(Number(price.pyeongPrice)))
    .map((price) => ({
      x: x(price.yearMonth),
      y: y(Number(price.pyeongPrice)),
      price
    }));
  if (!points.length) return "";
  const path = graphLinePath(points, "linear");
  const style = [
    `stroke-width:${design.lineWidth}px`,
    `opacity:${design.opacity}`,
    `stroke-linecap:${design.linecap}`,
    design.dash ? `stroke-dasharray:${design.dash}` : ""
  ].filter(Boolean).join(";");
  return `<path class="map-popup-pyeong-line" d="${path}" stroke="${color}" style="${style}"></path>`;
}

function renderGraphPeriodMarkers({ months, series, x, y, padding, chartBottom }) {
  if (!months.length) return "";
  const latestMonth = months.at(-1);
  return [1, 3, 5].map((years) => {
    const yearMonth = periodStartMonth(latestMonth, years);
    if (!months.includes(yearMonth)) return "";
    const xPos = x(yearMonth);
    const labelX = Math.min(xPos + 7, x(months.at(-1)) - 16);
    const dots = series.map((item) => {
      const yPos = interpolatedSeriesYAtMonth(item, yearMonth, x, y);
      if (!Number.isFinite(yPos)) return "";
      return `<circle class="map-popup-period-dot" cx="${xPos.toFixed(1)}" cy="${yPos.toFixed(1)}" r="4" fill="${item.color}" stroke="#ffffff"></circle>`;
    }).join("");
    return `
      <g class="map-popup-period-marker">
        <line x1="${xPos.toFixed(1)}" y1="${padding.top}" x2="${xPos.toFixed(1)}" y2="${chartBottom}"></line>
        ${dots}
        <text x="${labelX.toFixed(1)}" y="${padding.top + 14}" text-anchor="start">${years}년</text>
      </g>
    `;
  }).join("");
}

function interpolatedSeriesYAtMonth(item, yearMonth, x, y) {
  const points = (item.prices || [])
    .filter((price) => Number.isFinite(Number(price.saleMid)) && String(price.yearMonth || "") <= yearMonth)
    .map((price) => ({
      x: x(price.yearMonth),
      y: y(Number(price.saleMid)),
      yearMonth: price.yearMonth
    }))
    .sort((a, b) => a.x - b.x);
  const after = (item.prices || [])
    .filter((price) => Number.isFinite(Number(price.saleMid)) && String(price.yearMonth || "") >= yearMonth)
    .map((price) => ({
      x: x(price.yearMonth),
      y: y(Number(price.saleMid)),
      yearMonth: price.yearMonth
    }))
    .sort((a, b) => a.x - b.x)[0];
  const before = points.at(-1);
  if (!before && !after) return NaN;
  if (!before) return after.y;
  if (!after) return before.y;
  const targetX = x(yearMonth);
  if (Math.abs(after.x - before.x) < 0.001) return before.y;
  const ratio = (targetX - before.x) / (after.x - before.x);
  return before.y + (after.y - before.y) * ratio;
}

function graphChartGeometry({ mode, months, series }) {
  const width = mode === "preview" ? 360 : 680;
  const height = mode === "preview" ? 190 : 300;
  const padding = mode === "preview"
    ? { top: 18, right: 68, bottom: 30, left: 60 }
    : { top: 26, right: 92, bottom: 42, left: 96 };
  const chartBottom = height - padding.bottom;
  const chartRight = width - padding.right;
  const values = series.flatMap((item) => item.prices.map((price) => price.saleMid).filter(Number.isFinite));
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const valueSpan = Math.max(rawMax - rawMin, 10000);
  const yMin = Math.max(0, Math.floor((rawMin - valueSpan * 0.12) / 5000) * 5000);
  const yMax = Math.ceil((rawMax + valueSpan * 0.12) / 5000) * 5000;
  const x = (month) => {
    const index = months.indexOf(month);
    if (months.length <= 1) return padding.left;
    return padding.left + (index / (months.length - 1)) * (chartRight - padding.left);
  };
  const y = (value) => padding.top + (1 - (value - yMin) / (yMax - yMin || 1)) * (chartBottom - padding.top);
  return { width, height, padding, chartBottom, chartRight, x, y, yMin, yMax };
}

function renderGraphGrid({ design, y, yMin, yMax, padding, chartRight }) {
  if (design.gridMode === "none") return "";
  const ratios = design.gridMode === "minimal" ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1];
  const dash = design.gridMode === "solid" ? "" : design.gridMode === "thin" ? "2 8" : "3 5";
  return ratios.map((ratio) => {
    const value = Math.round((yMin + (yMax - yMin) * ratio) / 1000) * 1000;
    const yPos = y(value).toFixed(1);
    return `
      <line class="map-popup-grid-line" x1="${padding.left}" y1="${yPos}" x2="${chartRight}" y2="${yPos}" style="stroke:${design.gridColor};stroke-dasharray:${dash};"></line>
      <text class="map-popup-axis-label" x="${padding.left - 10}" y="${(Number(yPos) + 4).toFixed(1)}" text-anchor="end" style="fill:${design.textColor};">${formatKoreanPrice(value)}</text>
    `;
  }).join("");
}

function renderGraphMonthLabels({ design, mode, months, x, height }) {
  const step = Math.ceil(months.length / (mode === "preview" ? 3 : 4));
  return months
    .filter((_, index) => index === 0 || index === months.length - 1 || index % step === 0)
    .map((month) => `<text class="map-popup-axis-label" x="${x(month).toFixed(1)}" y="${height - 12}" text-anchor="middle" style="fill:${design.textColor};">${formatMonth(month)}</text>`)
    .join("");
}

function renderGraphSeries({ chartBottom, design, index, item, mode, svgId, x, y }) {
  const points = item.prices.map((price) => ({
    x: x(price.yearMonth),
    y: y(price.saleMid),
    price
  }));
  if (!points.length) return "";
  const linePath = graphLinePath(points, design.curve);
  const first = points[0];
  const last = points.at(-1);
  const areaPath = `${linePath} L ${last.x.toFixed(1)} ${chartBottom} L ${first.x.toFixed(1)} ${chartBottom} Z`;
  const labelLimit = mode === "preview" ? 2 : design.labelMode === "end" ? 5 : 0;
  const labelY = Math.max(22, Math.min(chartBottom - 8, last.y));
  const endLabel = index < labelLimit
    ? `<text class="map-popup-end-label" x="${(last.x + 9).toFixed(1)}" y="${(labelY + 4).toFixed(1)}" fill="${item.color}" style="stroke:${design.background};">${escapeHtml(item.label || "-")} ${formatKoreanPrice(last.price.saleMid)}</text>`
    : "";
  const area = design.fillOpacity > 0
    ? `<path class="map-popup-area" d="${areaPath}" fill="url(#${svgId}-area-${index})"></path>`
    : "";
  const pointsMarkup = renderGraphPoints({ design, first, item, last, points });
  const lineStyle = [
    `stroke-width:${design.lineWidth}px`,
    `filter:${design.shadow ? "drop-shadow(0 2px 2px rgba(16, 24, 40, 0.18))" : "none"}`,
    design.dash ? `stroke-dasharray:${design.dash}` : ""
  ].filter(Boolean).join(";");

  return `
    ${area}
    <path class="map-popup-line" d="${linePath}" stroke="${item.color}" style="${lineStyle}"></path>
    ${pointsMarkup}
    ${endLabel}
  `;
}

function renderGraphPoints({ design, first, item, last, points }) {
  if (design.pointMode === "none") return "";
  const fill = design.background === "#ffffff" ? "#ffffff" : design.plotBackground;
  if (design.pointMode === "all") {
    return points.map((point) => `<circle class="map-popup-point" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="2.4" fill="${fill}" stroke="${item.color}"></circle>`).join("");
  }
  return `
    <circle class="map-popup-point start" cx="${first.x.toFixed(1)}" cy="${first.y.toFixed(1)}" r="3.2" fill="${fill}" stroke="${item.color}"></circle>
    <circle class="map-popup-point end" cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="4.2" fill="${fill}" stroke="${item.color}"></circle>
  `;
}

function renderGraphGradient({ design, item, index, svgId }) {
  if (design.fillOpacity <= 0) return "";
  return `
    <linearGradient id="${svgId}-area-${index}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${item.color}" stop-opacity="${design.fillOpacity}"></stop>
      <stop offset="74%" stop-color="${item.color}" stop-opacity="${Math.max(design.fillOpacity / 4, 0.01)}"></stop>
      <stop offset="100%" stop-color="${item.color}" stop-opacity="0"></stop>
    </linearGradient>
  `;
}

function graphLinePath(points, curve) {
  if (curve === "linear") return straightSvgPath(points);
  if (curve === "step") return steppedSvgPath(points);
  return smoothSvgPath(points);
}

function straightSvgPath(points) {
  if (!points.length) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
}

function steppedSvgPath(points) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const midX = (previous.x + point.x) / 2;
    return `${path} H ${midX.toFixed(1)} V ${point.y.toFixed(1)} H ${point.x.toFixed(1)}`;
  }, `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`);
}

function smoothSvgPath(points) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const midX = (previous.x + point.x) / 2;
    return `${path} C ${midX.toFixed(1)} ${previous.y.toFixed(1)}, ${midX.toFixed(1)} ${point.y.toFixed(1)}, ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }, `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`);
}

function graphDesignColor(design, index, fallback) {
  const palette = graphPalettes[design.palette] || graphPalettes.market;
  return palette[index % palette.length] || fallback || colors[index % colors.length];
}

function bindMapPopupChartHover({ width, months, series, pyeongSeriesSource = series, x, y, pyeongY }) {
  const svg = els.mapPopupChart.querySelector("svg");
  const hit = els.mapPopupChart.querySelector(".chart-hover-hit");
  const line = els.mapPopupChart.querySelector(".map-popup-hover-line");
  if (!svg || !hit || !line || !els.mapPopupTooltip || !months.length) return;
  const hideHover = () => {
    line.hidden = true;
    els.mapPopupTooltip.hidden = true;
  };

  hit.addEventListener("mousemove", (event) => {
    const svgPoint = svgPointFromEvent(event, svg, width);
    const month = nearestMonthFromSvgX(svgPoint.x, months, x);
    const xPos = x(month);
    line.setAttribute("x1", xPos);
    line.setAttribute("x2", xPos);
    line.hidden = false;

    const priceRows = series.map((item) => {
      const price = item.prices.find((entry) => entry.yearMonth === month);
      if (!price) return null;
      return { item, price, y: y(Number(price.saleMid)) };
    }).filter(Boolean);
    const pyeongAverage = averagePyeongAtMonth(pyeongSeriesSource, month);
    const priceRow = priceRows[0];
    const priceDistance = priceRow
      ? Math.abs(priceRow.y - svgPoint.y)
      : Infinity;
    const pyeongYValue = Number.isFinite(pyeongAverage) && pyeongY ? pyeongY(Number(pyeongAverage)) : NaN;
    const pyeongDistance = Number.isFinite(pyeongYValue) ? Math.abs(pyeongYValue - svgPoint.y) : Infinity;
    const isPyeongPrimary = pyeongDistance < priceDistance;
    const priceMarkup = priceRows.map(({ item, price }) =>
      `<span><i style="background:${item.color}"></i>${escapeHtml(item.label || "-")} ${formatKoreanPrice(price.saleMid)}</span>`
    ).join("");
    const pyeongMarkup = Number.isFinite(pyeongAverage)
      ? `<span class="map-popup-tooltip-secondary">평당가격 ${formatMoney(pyeongAverage)}</span>`
      : "";
    const rows = isPyeongPrimary
      ? `${pyeongMarkup || "<span>데이터 없음</span>"}`
      : `${priceMarkup || "<span>데이터 없음</span>"}`;

    showFloatingTooltip(els.mapPopupChart.parentElement, els.mapPopupTooltip, event, `
      <strong>${formatMonth(month)}</strong>
      ${rows || "<span>데이터 없음</span>"}
    `);
  });

  hit.addEventListener("mouseleave", hideHover);
  svg.addEventListener("mouseleave", hideHover);
  els.mapPopupChart.addEventListener("mouseleave", hideHover);
}
