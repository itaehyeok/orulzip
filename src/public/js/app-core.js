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
  state.apartmentMarkerMode = readStoredApartmentMarkerMode();
  state.regionMarkerDesignByLevel = readStoredRegionMarkerDesignByLevel();
  state.regionMarkerDisplayByLevel = readStoredRegionMarkerDisplayByLevel();
  state.regionMarkerStyleByLevel = readStoredRegionMarkerStyleByLevel();
  state.regionMarkerStylePresets = readStoredRegionMarkerStylePresets();
  state.activeLogoDesignId = readStoredLogoDesignId();
  state.activeMapHeaderDesignId = readStoredMapHeaderDesignId();
  state.activeGrowthRateColorDesignId = readStoredGrowthRateColorDesignId();
  state.growthRateBandMode = readStoredGrowthRateBandMode();
  state.markerLineGapPx = readStoredMarkerLineGapPx();
  state.activeTransitionDesignId = readStoredTransitionDesignId();
  applyMarkerLineGap();
  applyMapHeaderDesign();
  applyGrowthRateColorDesign();
  syncGrowthRateBandModeControls();
  syncMobileViewportInsets();
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
  syncHouseholdFilterToggles();
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
  const showAdminNav = Boolean(state.isAdmin);
  document.querySelectorAll("[data-admin-only]").forEach((item) => {
    item.hidden = !showAdminNav;
  });
  if (!showAdminNav) {
    closeTabMoreMenus();
    closeMapSettingsMenus();
  }
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
  window.addEventListener("resize", syncMobileViewportInsets);
  window.addEventListener("scroll", positionOpenTabMoreMenus, { passive: true });
  window.visualViewport?.addEventListener("resize", syncMobileViewportInsets);
  window.visualViewport?.addEventListener("scroll", syncMobileViewportInsets, { passive: true });
  window.addEventListener("pageshow", async () => {
    syncMobileViewportInsets();
    await loadAdminSession();
    renderAdminNavigation();
  });
  document.querySelector(".deploy-version-copy")?.addEventListener("click", copyDeployVersion);
  document.querySelector(".deploy-version-commit")?.addEventListener("click", toggleDeployCommitPopover);
  document.querySelector("[data-display-settings-open]")?.addEventListener("click", openMapDisplaySettingsPanel);
  document.querySelector("[data-display-settings-close]")?.addEventListener("click", closeMapDisplaySettingsPanels);
  els.growthRateBandModeButtons.forEach((button) => {
    button.addEventListener("click", () => setGrowthRateBandMode(button.dataset.growthRateBandMode));
  });
  els.mapPopupCloseBtn.addEventListener("click", closeMapApartmentPopup);
  els.mapPopupStats.addEventListener("change", (event) => {
    const select = event.target.closest("[data-map-popup-area-select]");
    if (!select || !state.mapPopupDetail) return;
    state.mapPopupSelectedAreaTypeId = select.value;
    renderMapApartmentDetail(state.mapPopupDetail);
  });
  els.priceBandDetailCloseBtn?.addEventListener("click", closePriceBandApartmentDetail);
  els.priceBandDetailStats?.addEventListener("change", (event) => {
    const select = event.target.closest("[data-map-popup-area-select]");
    if (!select || !state.mapPopupDetail) return;
    state.mapPopupSelectedAreaTypeId = select.value;
    renderPriceBandApartmentDetail(state.mapPopupDetail);
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
  document.querySelectorAll("a[href='/logout'], a[href='/admin-logout']").forEach((link) => {
    link.addEventListener("click", () => {
      state.isAdmin = false;
      renderAdminNavigation();
    });
  });
  els.mapLocateBtn?.addEventListener("click", goToCurrentLocation);
  els.mapRankingTargetSelect?.addEventListener("change", handleMapRankingTargetChange);
  els.mapRankingToggleBtn?.addEventListener("click", toggleMobileMapRanking);
  els.mapRankingCloseBtn?.addEventListener("click", closeMobileMapRanking);
  document.addEventListener("change", handleMarkerRankDisplayOptionChange);
  bindApartmentMarkerDesignControls();
  bindRegionMarkerDesignControls();

  document.querySelectorAll("[data-period-months], [data-period-years]").forEach((button) => {
    button.addEventListener("click", () => {
      state.priceBandStartKey = "";
      state.priceBandEndKey = "";
      state.priceBandAreaKey = "all";
      state.priceBandPage = 1;
      setPeriodMonths(periodButtonMonths(button));
      refresh();
    });
  });
  document.querySelectorAll("[data-period-select]").forEach((select) => {
    select.addEventListener("change", () => {
      state.priceBandStartKey = "";
      state.priceBandEndKey = "";
      state.priceBandAreaKey = "all";
      state.priceBandPage = 1;
      setPeriodMonths(Number(select.value) || 12);
      refresh();
    });
  });
  els.householdFilterToggles?.forEach((button) => {
    button.addEventListener("click", () => {
      state.minHouseholdCount = activeMinHouseholdCount() > 0 ? 0 : 100;
      state.priceBandStartKey = "";
      state.priceBandEndKey = "";
      state.priceBandAreaKey = "all";
      state.priceBandPage = 1;
      state.mapApartmentDetails.clear();
      syncHouseholdFilterToggles();
      closeMapSettingsMenus();
      if (state.activeTab === "priceBands") renderPriceBandLoadingState();
      refresh();
    });
  });
  els.priceBandSummary?.addEventListener("change", (event) => {
    const periodSelect = event.target.closest("[data-price-band-period-select]");
    if (periodSelect) {
      state.priceBandPage = 1;
      setPeriodMonths(Number(periodSelect.value) || 12);
      renderPriceBandLoadingState();
      refresh();
      return;
    }
    const select = event.target.closest("[data-price-band-filter]");
    if (!select) return;
    if (select.dataset.priceBandFilter === "area") {
      state.priceBandAreaKey = select.value || "all";
    } else if (select.dataset.priceBandFilter === "end") {
      state.priceBandEndKey = select.value || "";
    } else {
      state.priceBandStartKey = select.value || "";
    }
    state.priceBandPage = 1;
    renderPriceBandLoadingState();
    refresh();
  });
  els.analyticsDaysSelect?.addEventListener("change", () => {
    state.analyticsDays = Number(els.analyticsDaysSelect.value) || 7;
    loadAnalyticsDashboard();
  });
  els.analyticsEnvironmentSelect?.addEventListener("change", () => {
    state.analyticsEnvironment = String(els.analyticsEnvironmentSelect.value || "");
    loadAnalyticsDashboard();
  });
  els.analyticsIncludeAdminToggle?.addEventListener("change", () => {
    state.analyticsIncludeAdmin = Boolean(els.analyticsIncludeAdminToggle.checked);
    loadAnalyticsDashboard();
  });
  els.analyticsIncludeInternalToggle?.addEventListener("change", () => {
    state.analyticsIncludeInternal = Boolean(els.analyticsIncludeInternalToggle.checked);
    loadAnalyticsDashboard();
  });
  els.priceBandPagination?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-price-band-page]");
    if (!button) return;
    state.priceBandPage = Number(button.dataset.priceBandPage) || 1;
    renderPriceBandLoadingState();
    refresh();
  });

  document.querySelectorAll("[data-tab]").forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      const menu = item.closest(".tab-more-menu");
      activateTab(item.dataset.tab, { push: true });
      if (menu) menu.open = false;
      if (item.closest(".map-settings-menu")) closeMapSettingsMenus();
    });
  });

  window.addEventListener("popstate", () => {
    activateTab(tabFromLocation(), { push: false });
  });

  document.addEventListener("click", (event) => {
    const isSearchClick = els.mapSearchPanel?.contains(event.target);
    const isRankingClick = els.mapApartmentRanking?.contains(event.target);
    const isRankingToggleClick = els.mapRankingToggleBtn?.contains(event.target);
    const isTabMoreClick = event.target.closest(".tab-more-menu");
    const isMapSettingsClick = event.target.closest(".map-settings-menu");
    const isDeployVersionClick = event.target.closest(".deploy-version-badge");
    if (!isSearchClick && !isRankingClick && !isRankingToggleClick) hideMapSearchResults();
    if (!isTabMoreClick) closeTabMoreMenus();
    if (!isMapSettingsClick) closeMapSettingsMenus();
    if (!isDeployVersionClick) closeDeployCommitPopover();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMapSettingsMenus();
      closeDeployCommitPopover();
      closeMobileMapRanking();
    }
  });
}

async function copyDeployVersion() {
  const badge = document.querySelector(".deploy-version-badge");
  const button = document.querySelector(".deploy-version-copy");
  const text = badge?.dataset.deployVersion || badge?.textContent?.trim() || "";
  if (!text) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopyText(text);
    }
  } catch {
    fallbackCopyText(text);
  }
  badge.classList.add("copied");
  if (button) button.setAttribute("aria-label", "복사됨");
  window.setTimeout(() => {
    badge.classList.remove("copied");
    if (button) button.setAttribute("aria-label", "배포 버전 복사");
  }, 1200);
}

function fallbackCopyText(text) {
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function toggleDeployCommitPopover() {
  const popover = document.querySelector(".deploy-commit-popover");
  const button = document.querySelector(".deploy-version-commit");
  if (!popover || !button) return;
  const willOpen = popover.hidden;
  if (willOpen) renderDeployCommitList();
  popover.hidden = !willOpen;
  button.setAttribute("aria-expanded", String(willOpen));
}

function closeDeployCommitPopover() {
  const popover = document.querySelector(".deploy-commit-popover");
  const button = document.querySelector(".deploy-version-commit");
  if (!popover || popover.hidden) return;
  popover.hidden = true;
  button?.setAttribute("aria-expanded", "false");
}

function renderDeployCommitList() {
  const badge = document.querySelector(".deploy-version-badge");
  const list = document.querySelector(".deploy-commit-list");
  if (!badge || !list) return;
  const commits = parseDeployCommitData(badge.dataset.deployCommits);
  list.innerHTML = commits.length
    ? commits.map((commit) => `
      <div class="deploy-commit-item">
        <span class="deploy-commit-sha">${escapeHtml(commit.sha)}</span>
        <span class="deploy-commit-subject">${escapeHtml(commit.subject || "-")}</span>
        <span class="deploy-commit-time">${escapeHtml(relativeCommitTime(commit.committedAt))}</span>
      </div>
    `).join("")
    : `<div class="deploy-commit-empty">커밋 정보 없음</div>`;
}

function parseDeployCommitData(value) {
  try {
    const commits = JSON.parse(value || "[]");
    if (!Array.isArray(commits)) return [];
    return commits
      .map((commit) => ({
        sha: String(commit?.sha || "").slice(0, 7),
        subject: String(commit?.subject || ""),
        committedAt: String(commit?.committedAt || "")
      }))
      .filter((commit) => commit.sha)
      .slice(0, 5);
  } catch {
    return [];
  }
}

function relativeCommitTime(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "-";
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return "방금 전";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}개월 전`;
  return `${Math.floor(months / 12)}년 전`;
}

function closeTabMoreMenus() {
  document.querySelectorAll(".tab-more-menu[open]").forEach((menu) => {
    menu.open = false;
  });
}

function closeMapSettingsMenus() {
  document.querySelectorAll(".map-settings-menu[open]").forEach((menu) => {
    menu.open = false;
    menu.classList.remove("display-settings-open");
  });
  closeMapDisplaySettingsPanels();
}

function openMapDisplaySettingsPanel() {
  const menu = document.querySelector(".map-settings-menu");
  const panel = document.querySelector("[data-display-settings-panel]");
  if (!menu || !panel) return;
  menu.open = true;
  menu.classList.add("display-settings-open");
  panel.hidden = false;
}

function closeMapDisplaySettingsPanels() {
  document.querySelectorAll("[data-display-settings-panel]").forEach((panel) => {
    panel.hidden = true;
  });
  document.querySelectorAll(".map-settings-menu.display-settings-open").forEach((menu) => {
    menu.classList.remove("display-settings-open");
  });
}

function setGrowthRateBandMode(mode) {
  const nextMode = normalizeGrowthRateBandMode(mode);
  if (state.growthRateBandMode === nextMode) {
    syncGrowthRateBandModeControls();
    return;
  }
  state.growthRateBandMode = nextMode;
  try {
    window.localStorage.setItem(growthRateBandModeStorageKey, nextMode);
  } catch {
    // localStorage may be disabled in private contexts.
  }
  syncGrowthRateBandModeControls();
  refreshGrowthRateBandModeViews();
}

function syncGrowthRateBandModeControls() {
  const activeMode = activeGrowthRateBandMode();
  els.growthRateBandModeButtons.forEach((button) => {
    const isActive = normalizeGrowthRateBandMode(button.dataset.growthRateBandMode) === activeMode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function refreshGrowthRateBandModeViews() {
  if (state.activeTab === "design") {
    renderDesignTab();
    return;
  }
  void refresh();
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

  if (state.activeTab === "analytics") {
    await loadAnalyticsDashboard();
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
    if (await prepareMapApartmentFocusFromUrl()) return;
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

  if (state.activeTab === "priceBands") {
    const requestId = ++state.priceBandRequestId;
    renderPriceBandLoadingState();
    const priceBandParams = new URLSearchParams(params);
    priceBandParams.set("basis", "start");
    if (state.priceBandStartKey !== "") priceBandParams.set("startBandKey", state.priceBandStartKey);
    if (state.priceBandEndKey !== "") priceBandParams.set("endBandKey", state.priceBandEndKey);
    if (state.priceBandAreaKey && state.priceBandAreaKey !== "all") priceBandParams.set("areaBandKey", state.priceBandAreaKey);
    priceBandParams.set("page", String(state.priceBandPage));
    priceBandParams.set("pageSize", String(state.priceBandPageSize));
    let result;
    try {
      result = await api(`/api/price-band-rankings?${priceBandParams}`);
    } catch (error) {
      if (state.activeTab !== "priceBands" || requestId !== state.priceBandRequestId) return;
      renderPriceBandLoadError(error);
      return;
    }
    if (state.activeTab !== "priceBands" || requestId !== state.priceBandRequestId) return;
    renderPriceBandTable(result, result.basisBands);
    await preparePriceBandApartmentDetailFromUrl(result.rows || []);
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

  if (state.activeTab === "analytics") {
    await loadAnalyticsDashboard();
    return;
  }

  if (state.activeTab === "dataHealth") {
    await loadDataHealthDashboard();
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

  document.querySelectorAll("[data-tab]").forEach((item) => {
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
  document.querySelector("#priceBandView").classList.toggle("active", nextTab === "priceBands");
  document.querySelector("#formulaView").classList.toggle("active", nextTab === "formula");
  document.querySelector("#termsView").classList.toggle("active", nextTab === "terms");
  document.querySelector("#designView").classList.toggle("active", nextTab === "design");
  document.querySelector("#crawlView").classList.toggle("active", nextTab === "crawl");
  document.querySelector("#analyticsView").classList.toggle("active", nextTab === "analytics");
  document.querySelector("#dataHealthView").classList.toggle("active", nextTab === "dataHealth");
  document.body.classList.toggle("map-shell-mode", isMapTab(nextTab));
  syncMobileViewportInsets();
  document.title = tabTitles[nextTab] || tabTitles.molitMap;

  const nextRoute = tabRoutes[nextTab];
  if (push && normalizeRoute(window.location.pathname) !== nextRoute) {
    window.history.pushState({ tab: nextTab }, "", nextRoute);
  }
  if (typeof trackAnalyticsPageView === "function") trackAnalyticsPageView();
}

function tabFromLocation() {
  const route = normalizeRoute(window.location.pathname);
  if (route.startsWith("/apartments/")) return "priceBands";
  if (route.startsWith("/regions/")) return "molitMap";
  return routeTabs[route] || "molitMap";
}

function isMapTab(tab = state.activeTab) {
  return tab === "map" || tab === "molitMap";
}

function syncMobileViewportInsets() {
  const root = document.documentElement;
  if (!root) return;
  const viewport = window.visualViewport;
  const isMobileWidth = window.matchMedia?.("(max-width: 820px)")?.matches ?? window.innerWidth <= 820;
  let bottomInset = 0;
  if (viewport && isMobileWidth) {
    const layoutHeight = window.innerHeight || root.clientHeight || 0;
    bottomInset = Math.max(0, Math.ceil(layoutHeight - viewport.height - viewport.offsetTop));
  }
  root.style.setProperty("--map-mobile-browser-bottom-inset", `${bottomInset}px`);
}

function currentMapSource() {
  return state.activeTab === "molitMap" ? "molit" : "kb";
}

function normalizeRoute(pathname) {
  const normalized = String(pathname || "/").replace(/\/+$/, "");
  return normalized || "/";
}
