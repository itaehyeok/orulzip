async function init() {
  state.activeGraphDesignId = readStoredGraphDesignId();
  state.activePyeongGraphDesignId = readStoredPyeongGraphDesignId();
  state.activeMarkerDesignId = readStoredMarkerDesignId();
  state.markerVerbosityByLevel = readStoredMarkerVerbosityByLevel(state.activeMarkerDesignId);
  state.markerRankDisplayOptions = readStoredMarkerRankDisplayOptions();
  state.apartmentMarkerDesignId = readStoredApartmentMarkerDesignId();
  state.apartmentMarkerDisplay = readStoredApartmentMarkerDisplay();
  state.apartmentMarkerStyle = readStoredApartmentMarkerStyle();
  state.apartmentMarkerStylePresets = readStoredApartmentMarkerStylePresets();
  state.regionMarkerDesignByLevel = readStoredRegionMarkerDesignByLevel();
  state.regionMarkerDisplayByLevel = readStoredRegionMarkerDisplayByLevel();
  state.regionMarkerStyleByLevel = readStoredRegionMarkerStyleByLevel();
  state.regionMarkerStylePresets = readStoredRegionMarkerStylePresets();
  state.activeLogoDesignId = readStoredLogoDesignId();
  state.activeMapHeaderDesignId = readStoredMapHeaderDesignId();
  state.activeGrowthRateColorDesignId = readStoredGrowthRateColorDesignId();
  state.markerLineGapPx = readStoredMarkerLineGapPx();
  state.activeTransitionDesignId = readStoredTransitionDesignId();
  applyMarkerLineGap();
  applyMapHeaderDesign();
  applyGrowthRateColorDesign();
  setActiveTab(tabFromLocation());
  renderApartmentMarkerStyleEditor();
  renderRegionMarkerStyleEditor();
  bindEvents();
  syncApartmentMarkerDesignControls();
  syncRegionMarkerDesignControls();
  await Promise.all([
    loadClientConfig(),
    loadFilters(),
    loadAdminSession()
  ]);
  renderAdminNavigation();
  await refresh();
  setInterval(refreshStatusOnly, 5000);
}

async function loadClientConfig() {
  state.clientConfig = await api("/api/client-config").catch(() => ({
    maps: { provider: "leaflet", naverKeyId: "" }
  }));
}

async function loadAdminSession() {
  const session = await api("/api/admin/session").catch(() => ({ authenticated: false }));
  state.isAdmin = Boolean(session.authenticated);
}

function renderAdminNavigation() {
  document.querySelectorAll("[data-admin-only]").forEach((item) => {
    item.hidden = !state.isAdmin;
  });
}

function bindEvents() {
  els.regionSelect.addEventListener("change", async () => {
    await loadFilters();
    await refresh();
  });
  els.neighborhoodSelect.addEventListener("change", refresh);
  els.startInput.addEventListener("change", () => {
    syncPeriodButtons();
    refresh();
  });
  els.endInput.addEventListener("change", () => {
    syncPeriodButtons();
    refresh();
  });
  els.syncBtn.addEventListener("click", syncCurrentRegion);
  els.formulaRunBtn.addEventListener("click", loadFormulaAnalysis);
  document.querySelectorAll(".tab-more-menu").forEach((menu) => {
    menu.addEventListener("toggle", () => positionTabMoreMenu(menu));
  });
  window.addEventListener("resize", positionOpenTabMoreMenus);
  window.addEventListener("scroll", positionOpenTabMoreMenus, { passive: true });
  els.mapPopupCloseBtn.addEventListener("click", closeMapApartmentPopup);
  els.mapPopupStats.addEventListener("change", (event) => {
    const select = event.target.closest("[data-map-popup-area-select]");
    if (!select || !state.mapPopupDetail) return;
    state.mapPopupSelectedAreaTypeId = select.value;
    renderMapApartmentDetail(state.mapPopupDetail);
  });
  els.mapSearchInput.addEventListener("input", () => scheduleMapSearch());
  els.mapSearchInput.addEventListener("focus", () => {
    if (els.mapSearchInput.value.trim()) scheduleMapSearch(0);
  });
  els.mapSearchInput.addEventListener("keydown", handleMapSearchKeydown);
  els.mapHeaderDesignGrid?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-map-header-design-id]");
    if (!card) return;
    setActiveMapHeaderDesign(card.dataset.mapHeaderDesignId);
  });
  els.logoDesignGrid?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-logo-design-id]");
    if (!card) return;
    setActiveLogoDesign(card.dataset.logoDesignId);
  });
  els.graphDesignGrid?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-graph-design-id]");
    if (!card) return;
    setActiveGraphDesign(card.dataset.graphDesignId);
  });
  els.pyeongGraphDesignGrid?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-pyeong-graph-design-id]");
    if (!card) return;
    setActivePyeongGraphDesign(card.dataset.pyeongGraphDesignId);
  });
  els.growthRateColorDesignGrid?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-growth-rate-color-design-id]");
    if (!card) return;
    setActiveGrowthRateColorDesign(card.dataset.growthRateColorDesignId);
  });
  els.mapLocateBtn?.addEventListener("click", goToCurrentLocation);
  document.addEventListener("change", handleMarkerRankDisplayOptionChange);
  bindApartmentMarkerDesignControls();
  bindRegionMarkerDesignControls();

  document.querySelectorAll("[data-period-months], [data-period-years]").forEach((button) => {
    button.addEventListener("click", () => {
      state.apartmentRankPage = 1;
      state.priceBandKey = "";
      state.priceBandPage = 1;
      setPeriodMonths(periodButtonMonths(button));
      refresh();
    });
  });
  document.querySelectorAll("[data-apartment-rank-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.apartmentRankMode = button.dataset.apartmentRankMode || "averagePyeong";
      state.apartmentRankPage = 1;
      syncApartmentRankModeButtons();
      refresh();
    });
  });
  els.apartmentPageSizeSelect?.addEventListener("change", () => {
    state.apartmentRankPageSize = Number(els.apartmentPageSizeSelect.value) || 50;
    state.apartmentRankPage = 1;
    refresh();
  });
  els.apartmentPagination?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-apartment-page]");
    if (!button) return;
    state.apartmentRankPage = Number(button.dataset.apartmentPage) || 1;
    refresh();
  });
  els.priceBandSummary?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-price-band-key]");
    if (!button) return;
    state.priceBandBasis = button.dataset.priceBandBasis === "end" ? "end" : "start";
    state.priceBandKey = button.dataset.priceBandKey || "";
    state.priceBandPage = 1;
    refresh();
  });
  els.priceBandPageSizeSelect?.addEventListener("change", () => {
    state.priceBandPageSize = Number(els.priceBandPageSizeSelect.value) || 50;
    state.priceBandPage = 1;
    refresh();
  });
  els.priceBandPagination?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-price-band-page]");
    if (!button) return;
    state.priceBandPage = Number(button.dataset.priceBandPage) || 1;
    refresh();
  });

  document.querySelectorAll(".tabs [data-tab]").forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      const menu = item.closest(".tab-more-menu");
      activateTab(item.dataset.tab, { push: true });
      if (menu) menu.open = false;
    });
  });

  window.addEventListener("popstate", () => {
    activateTab(tabFromLocation(), { push: false });
  });

  document.addEventListener("click", (event) => {
    const isSearchClick = els.mapSearchPanel?.contains(event.target);
    const isRankingClick = els.mapApartmentRanking?.contains(event.target);
    const isTabMoreClick = event.target.closest(".tab-more-menu");
    if (!isSearchClick && !isRankingClick) hideMapSearchResults();
    if (!isTabMoreClick) closeTabMoreMenus();
  });
}

function closeTabMoreMenus() {
  document.querySelectorAll(".tab-more-menu[open]").forEach((menu) => {
    menu.open = false;
  });
}

function positionOpenTabMoreMenus() {
  document.querySelectorAll(".tab-more-menu[open]").forEach(positionTabMoreMenu);
}

function positionTabMoreMenu(menu) {
  if (!menu?.open) return;
  const summary = menu.querySelector("summary");
  const list = menu.querySelector(".tab-more-list");
  if (!summary || !list) return;
  requestAnimationFrame(() => {
    const rect = summary.getBoundingClientRect();
    const width = Math.max(170, list.offsetWidth || 170);
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const left = Math.max(8, Math.min(rect.right - width, viewportWidth - width - 8));
    menu.style.setProperty("--tab-more-left", `${Math.round(left)}px`);
    menu.style.setProperty("--tab-more-top", `${Math.round(rect.bottom + 6)}px`);
  });
}

async function loadFilters() {
  const regionId = els.regionSelect.value;
  const data = await api(`/api/filters${regionId ? `?regionId=${encodeURIComponent(regionId)}` : ""}`);
  state.regions = data.regions;
  state.regionStats = data.regionStats || [];
  state.months = data.months;
  state.neighborhoods = data.neighborhoods;

  if (!els.regionSelect.options.length) {
    els.regionSelect.innerHTML = state.regions
      .map((region) => `<option value="${region.id}">${region.name}</option>`)
      .join("");
    const populatedRegion = state.regionStats.find((item) => item.monthlyPrices > 0);
    if (populatedRegion) els.regionSelect.value = populatedRegion.regionId;
  }

  const currentNeighborhood = els.neighborhoodSelect.value;
  els.neighborhoodSelect.innerHTML = `<option value="">전체</option>${state.neighborhoods
    .map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`)
    .join("")}`;
  if (state.neighborhoods.some((item) => item.name === currentNeighborhood)) {
    els.neighborhoodSelect.value = currentNeighborhood;
  }

  if (state.months.length) {
    if (!els.endInput.value || !els.startInput.value) {
      applyQuickPeriod(1);
    }
    applyFormulaDefaultPeriod();
    syncPeriodButtons();
  }
}

async function refresh() {
  const status = await api("/api/status");
  state.latestStatus = status;
  renderCollectionSummary();
  renderCrawlStatus(status.crawl);
  const months = status.months || [];
  state.months = months;
  els.statusLine.textContent = status.counts.monthlyPrices
    ? `아파트 ${formatInt(status.counts.apartments)}개, 면적 ${formatInt(status.counts.areaTypes)}개, 월별 시세 ${formatInt(status.counts.monthlyPrices)}건. 최근 동기화: ${status.meta.syncedAt || "-"}`
    : "아직 수집된 데이터가 없습니다. 상단의 샘플 동기화 버튼을 눌러 시작하세요.";

  if (state.activeTab === "design") {
    renderDesignTab();
    return;
  }

  if (state.activeTab === "terms") {
    return;
  }

  if (!status.counts.monthlyPrices) {
    renderEmpty();
    return;
  }

  await loadActiveViewData();
}

async function loadActiveViewData() {
  const params = queryParams();

  if (isMapTab()) {
    await loadZoomMapSummary();
    return;
  }

  if (state.activeTab === "neighborhood") {
    const [neighborhoodRanking, chartData] = await Promise.all([
      api(`/api/neighborhood-rankings?${params}`),
      api(`/api/neighborhood-chart?${params}`)
    ]);
    renderNeighborhoodTable(neighborhoodRanking);
    renderChart(chartData);
    return;
  }

  if (state.activeTab === "apartment") {
    const apartmentParams = new URLSearchParams(params);
    apartmentParams.set("rankMode", state.apartmentRankMode);
    apartmentParams.set("page", String(state.apartmentRankPage));
    apartmentParams.set("pageSize", String(state.apartmentRankPageSize));
    renderApartmentTable(await api(`/api/apartment-rankings?${apartmentParams}`));
    return;
  }

  if (state.activeTab === "priceBands") {
    const priceBandParams = new URLSearchParams(params);
    priceBandParams.set("basis", state.priceBandBasis);
    if (state.priceBandKey !== "") priceBandParams.set("bandKey", state.priceBandKey);
    priceBandParams.set("page", String(state.priceBandPage));
    priceBandParams.set("pageSize", String(state.priceBandPageSize));
    const otherBasis = state.priceBandBasis === "end" ? "start" : "end";
    const otherPriceBandParams = new URLSearchParams(params);
    otherPriceBandParams.set("basis", otherBasis);
    otherPriceBandParams.set("page", "1");
    otherPriceBandParams.set("pageSize", "10");
    const [result, otherResult] = await Promise.all([
      api(`/api/price-band-rankings?${priceBandParams}`),
      api(`/api/price-band-rankings?${otherPriceBandParams}`)
    ]);
    renderPriceBandTable(result, {
      start: result.basis === "start" ? result.bands : otherResult.bands,
      end: result.basis === "end" ? result.bands : otherResult.bands
    });
    return;
  }

  if (state.activeTab === "formula") {
    await loadFormulaAnalysis();
    return;
  }

  if (state.activeTab === "design") {
    renderDesignTab();
    return;
  }

  if (state.activeTab === "terms") {
    return;
  }

  if (state.activeTab === "crawl") {
    await loadCrawlTabData();
  }
}

async function loadCrawlTabData() {
  const [molitStatus, coordinateAudit, duplicateAudit] = await Promise.all([
    api("/api/molit/status"),
    api("/api/molit/coordinate-audit?limit=80"),
    api("/api/molit/duplicate-audit?limit=80")
  ]);
  renderMolitStatus(molitStatus);
  renderMolitCoordinateAudit(coordinateAudit);
  renderMolitDuplicateAudit(duplicateAudit);
}

async function activateTab(tab, { push = false } = {}) {
  setActiveTab(tab, { push });
  await loadActiveViewData();
}

function setActiveTab(tab, { push = false } = {}) {
  const nextTab = tabRoutes[tab] ? tab : "map";
  state.activeTab = nextTab;

  document.querySelectorAll(".tabs [data-tab]").forEach((item) => {
    const isActive = item.dataset.tab === nextTab;
    item.classList.toggle("active", isActive);
    if (isActive) {
      item.setAttribute("aria-current", "page");
    } else {
      item.removeAttribute("aria-current");
    }
  });
  document.querySelectorAll(".tab-more-menu").forEach((menu) => {
    const hasActiveItem = Boolean(menu.querySelector("[data-tab].active"));
    menu.classList.toggle("active", hasActiveItem);
    if (!hasActiveItem) menu.open = false;
  });

  document.querySelector("#mapView").classList.toggle("active", isMapTab(nextTab));
  document.querySelector("#neighborhoodView").classList.toggle("active", nextTab === "neighborhood");
  document.querySelector("#apartmentView").classList.toggle("active", nextTab === "apartment");
  document.querySelector("#priceBandView").classList.toggle("active", nextTab === "priceBands");
  document.querySelector("#formulaView").classList.toggle("active", nextTab === "formula");
  document.querySelector("#termsView").classList.toggle("active", nextTab === "terms");
  document.querySelector("#designView").classList.toggle("active", nextTab === "design");
  document.querySelector("#crawlView").classList.toggle("active", nextTab === "crawl");
  document.body.classList.toggle("map-shell-mode", isMapTab(nextTab));
  document.title = tabTitles[nextTab] || tabTitles.molitMap;

  const nextRoute = tabRoutes[nextTab];
  if (push && normalizeRoute(window.location.pathname) !== nextRoute) {
    window.history.pushState({ tab: nextTab }, "", nextRoute);
  }
}

function tabFromLocation() {
  return routeTabs[normalizeRoute(window.location.pathname)] || "map";
}

function isMapTab(tab = state.activeTab) {
  return tab === "map" || tab === "molitMap";
}

function currentMapSource() {
  return state.activeTab === "molitMap" ? "molit" : "kb";
}

function normalizeRoute(pathname) {
  const normalized = String(pathname || "/").replace(/\/+$/, "");
  return normalized || "/";
}
