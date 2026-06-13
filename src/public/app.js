const tabRoutes = {
  map: "/map",
  neighborhood: "/neighborhood",
  apartment: "/apartments",
  formula: "/formula",
  design: "/design",
  crawl: "/crawl"
};

const routeTabs = {
  "/": "map",
  "/map": "map",
  "/neighborhood": "neighborhood",
  "/apartments": "apartment",
  "/formula": "formula",
  "/design": "design",
  "/crawl": "crawl"
};

const state = {
  regions: [],
  regionStats: [],
  months: [],
  neighborhoods: [],
  activeTab: tabFromLocation(),
  clientConfig: { maps: { provider: "leaflet", naverKeyId: "" } },
  zoomMap: null,
  zoomMapLayer: null,
  zoomNaverMap: null,
  zoomNaverOverlays: [],
  zoomNaverInfoWindow: null,
  zoomMapTimer: null,
  zoomMapRequestId: 0,
  mapPopupRequestId: 0,
  mapSearchTimer: null,
  mapSearchRequestId: 0,
  mapSearchItems: [],
  mapSearchActiveIndex: -1,
  mapApartmentDetails: new Map(),
  mapPopupDetail: null,
  mapPopupPeriodYears: 3,
  activeGraphDesignId: null,
  naverSdkPromise: null,
  latestStatus: null,
  latestMolitStatus: null
};

const colors = ["#2367d1", "#c24132", "#16805f", "#9a5b13", "#7c3aed", "#0f766e", "#b42318", "#475467"];
const defaultGraphDesignId = "clean-line";
const graphDesignStorageKey = "orulzip.graphDesignId";
const graphPalettes = {
  market: ["#2367d1", "#c24132", "#16805f", "#9a5b13", "#7c3aed", "#0f766e", "#b42318", "#475467"],
  naver: ["#03c75a", "#2f80ed", "#f2994a", "#9b51e0", "#eb5757", "#219653", "#56ccf2", "#6b7280"],
  kb: ["#0b5cab", "#e04f39", "#22a06b", "#f5a623", "#6941c6", "#0086c9", "#c4320a", "#475467"],
  mono: ["#111827", "#4b5563", "#6b7280", "#9ca3af", "#374151", "#1f2937", "#52525b", "#71717a"],
  forest: ["#087443", "#0e9384", "#4e5ba6", "#dc6803", "#c11574", "#175cd3", "#669f2a", "#667085"],
  slate: ["#175cd3", "#3538cd", "#155eef", "#0086c9", "#0e9384", "#7a2e0e", "#c01048", "#344054"],
  warm: ["#c2410c", "#b42318", "#ca8504", "#b54708", "#a15c07", "#9f1f63", "#6941c6", "#475467"],
  dusk: ["#7c3aed", "#2563eb", "#0891b2", "#16a34a", "#ea580c", "#dc2626", "#9333ea", "#475569"]
};
const graphDesignVariants = [
  graphDesign("clean-line", "01 클린 라인", { curve: "linear", fillOpacity: 0, pointMode: "end", labelMode: "end", palette: "market", background: "#ffffff", plotBackground: "#ffffff", shadow: false }),
  graphDesign("soft-line", "02 소프트 라인", { curve: "smooth", fillOpacity: 0, pointMode: "end", labelMode: "end", palette: "market", background: "#ffffff", plotBackground: "#fbfdff", shadow: false }),
  graphDesign("finance-blue", "03 금융 블루", { curve: "smooth", fillOpacity: 0.035, pointMode: "end", labelMode: "end", palette: "kb", background: "#ffffff", plotBackground: "#f8fbff", shadow: false }),
  graphDesign("naver-fresh", "04 네이버 그린", { curve: "smooth", fillOpacity: 0.035, pointMode: "end", labelMode: "none", palette: "naver", background: "#ffffff", plotBackground: "#fbfefc", shadow: false }),
  graphDesign("mono-report", "05 리포트 모노", { curve: "linear", fillOpacity: 0, pointMode: "none", labelMode: "end", palette: "mono", background: "#ffffff", plotBackground: "#ffffff", gridMode: "solid", shadow: false }),
  graphDesign("forest-clean", "06 포레스트", { curve: "smooth", fillOpacity: 0, pointMode: "end", labelMode: "end", palette: "forest", background: "#ffffff", plotBackground: "#fbfffd", shadow: false }),
  graphDesign("slate-focus", "07 슬레이트", { curve: "smooth", fillOpacity: 0.025, pointMode: "end", labelMode: "none", palette: "slate", background: "#ffffff", plotBackground: "#f8fafc", shadow: false }),
  graphDesign("warm-index", "08 웜 인덱스", { curve: "smooth", fillOpacity: 0.025, pointMode: "end", labelMode: "end", palette: "warm", background: "#fffdfb", plotBackground: "#fffaf5", shadow: false }),
  graphDesign("thin-grid", "09 씬 그리드", { curve: "linear", fillOpacity: 0, pointMode: "none", labelMode: "end", palette: "market", gridMode: "thin", lineWidth: 2.1, shadow: false }),
  graphDesign("no-grid", "10 노 그리드", { curve: "smooth", fillOpacity: 0, pointMode: "end", labelMode: "end", palette: "market", gridMode: "none", background: "#ffffff", plotBackground: "#ffffff", shadow: false }),
  graphDesign("soft-area", "11 소프트 에어리어", { curve: "smooth", fillOpacity: 0.06, pointMode: "end", labelMode: "end", palette: "market", shadow: false }),
  graphDesign("paper-area", "12 페이퍼 에어리어", { curve: "smooth", fillOpacity: 0.045, pointMode: "none", labelMode: "end", palette: "kb", background: "#fbfcfe", plotBackground: "#ffffff", gridMode: "solid", shadow: false }),
  graphDesign("bold-end", "13 볼드 엔드", { curve: "smooth", fillOpacity: 0, pointMode: "end", labelMode: "end", palette: "slate", lineWidth: 3.4, shadow: true }),
  graphDesign("compact-label", "14 컴팩트 라벨", { curve: "linear", fillOpacity: 0, pointMode: "end", labelMode: "none", palette: "market", lineWidth: 2.5, shadow: false }),
  graphDesign("all-points", "15 포인트 라인", { curve: "linear", fillOpacity: 0, pointMode: "all", labelMode: "none", palette: "kb", lineWidth: 2.2, shadow: false }),
  graphDesign("dotted-line", "16 도트 라인", { curve: "smooth", fillOpacity: 0, pointMode: "end", labelMode: "end", palette: "forest", dash: "2 6", lineWidth: 3, shadow: false }),
  graphDesign("dashed-report", "17 대시 리포트", { curve: "linear", fillOpacity: 0, pointMode: "none", labelMode: "end", palette: "mono", dash: "8 5", gridMode: "solid", shadow: false }),
  graphDesign("step-market", "18 스텝 마켓", { curve: "step", fillOpacity: 0, pointMode: "end", labelMode: "end", palette: "market", lineWidth: 2.8, shadow: false }),
  graphDesign("step-area", "19 스텝 에어리어", { curve: "step", fillOpacity: 0.04, pointMode: "none", labelMode: "none", palette: "naver", lineWidth: 2.5, shadow: false }),
  graphDesign("dark-board", "20 다크 보드", { curve: "smooth", fillOpacity: 0.055, pointMode: "end", labelMode: "end", palette: "dusk", background: "#101828", plotBackground: "#111c2f", textColor: "#d0d5dd", axisColor: "#475467", gridColor: "#344054", shadow: false }),
  graphDesign("midnight", "21 미드나이트", { curve: "linear", fillOpacity: 0, pointMode: "end", labelMode: "end", palette: "naver", background: "#0f172a", plotBackground: "#111827", textColor: "#cbd5e1", axisColor: "#475569", gridColor: "#334155", shadow: false }),
  graphDesign("ink-card", "22 잉크 카드", { curve: "smooth", fillOpacity: 0, pointMode: "none", labelMode: "end", palette: "mono", background: "#f8fafc", plotBackground: "#ffffff", gridMode: "solid", shadow: false }),
  graphDesign("glass-light", "23 글래스 라이트", { curve: "smooth", fillOpacity: 0.03, pointMode: "end", labelMode: "end", palette: "slate", background: "#f8fbff", plotBackground: "#ffffff", shadow: true }),
  graphDesign("calm-green", "24 캄 그린", { curve: "smooth", fillOpacity: 0.025, pointMode: "end", labelMode: "none", palette: "forest", background: "#fbfffd", plotBackground: "#ffffff", gridMode: "thin", shadow: false }),
  graphDesign("executive", "25 임원 보고", { curve: "linear", fillOpacity: 0, pointMode: "none", labelMode: "end", palette: "kb", background: "#ffffff", plotBackground: "#ffffff", gridMode: "solid", lineWidth: 2.4, shadow: false }),
  graphDesign("signal", "26 시그널", { curve: "smooth", fillOpacity: 0, pointMode: "all", labelMode: "end", palette: "dusk", background: "#ffffff", plotBackground: "#fbfbff", lineWidth: 2.6, shadow: false }),
  graphDesign("minimal-axis", "27 미니멀 축", { curve: "smooth", fillOpacity: 0, pointMode: "none", labelMode: "none", palette: "market", gridMode: "minimal", background: "#ffffff", plotBackground: "#ffffff", shadow: false }),
  graphDesign("soft-shadow", "28 소프트 섀도", { curve: "smooth", fillOpacity: 0.02, pointMode: "end", labelMode: "end", palette: "kb", background: "#ffffff", plotBackground: "#fbfdff", shadow: true }),
  graphDesign("warm-paper", "29 웜 페이퍼", { curve: "linear", fillOpacity: 0.02, pointMode: "end", labelMode: "end", palette: "warm", background: "#fffaf5", plotBackground: "#fffefd", gridMode: "thin", shadow: false }),
  graphDesign("presentation", "30 프레젠테이션", { curve: "smooth", fillOpacity: 0.04, pointMode: "end", labelMode: "end", palette: "dusk", background: "#ffffff", plotBackground: "#ffffff", gridMode: "none", lineWidth: 3.2, shadow: true })
];
const graphDesignVariantMap = new Map(graphDesignVariants.map((item) => [item.id, item]));
const homeMapView = {
  center: [37.48, 127.18],
  zoom: 12
};
const apartmentMapZoom = 16;
const animatedMapMoveDuration = 0.9;

const els = {
  regionSelect: document.querySelector("#regionSelect"),
  neighborhoodSelect: document.querySelector("#neighborhoodSelect"),
  startInput: document.querySelector("#startInput"),
  endInput: document.querySelector("#endInput"),
  statusLine: document.querySelector("#statusLine"),
  syncBtn: document.querySelector("#syncBtn"),
  crawlSummary: document.querySelector("#crawlSummary"),
  progressBar: document.querySelector("#progressBar"),
  progressText: document.querySelector("#progressText"),
  currentComplex: document.querySelector("#currentComplex"),
  crawlCounts: document.querySelector("#crawlCounts"),
  crawlDelay: document.querySelector("#crawlDelay"),
  crawlTrackedJobs: document.querySelector("#crawlTrackedJobs"),
  crawlLogs: document.querySelector("#crawlLogs"),
  collectionSummaryKb: document.querySelector("#collectionSummaryKb"),
  collectionSummaryKbMeta: document.querySelector("#collectionSummaryKbMeta"),
  collectionSummaryMolit: document.querySelector("#collectionSummaryMolit"),
  collectionSummaryMolitMeta: document.querySelector("#collectionSummaryMolitMeta"),
  collectionSummaryFailure: document.querySelector("#collectionSummaryFailure"),
  collectionSummaryFailureMeta: document.querySelector("#collectionSummaryFailureMeta"),
  collectionSummaryCache: document.querySelector("#collectionSummaryCache"),
  collectionSummaryCacheMeta: document.querySelector("#collectionSummaryCacheMeta"),
  crawlView: document.querySelector("#crawlView"),
  formulaView: document.querySelector("#formulaView"),
  formulaTargetSelect: document.querySelector("#formulaTargetSelect"),
  formulaStartInput: document.querySelector("#formulaStartInput"),
  formulaEndInput: document.querySelector("#formulaEndInput"),
  formulaLimitSelect: document.querySelector("#formulaLimitSelect"),
  formulaRunBtn: document.querySelector("#formulaRunBtn"),
  formulaSummary: document.querySelector("#formulaSummary"),
  formulaMatchedRows: document.querySelector("#formulaMatchedRows"),
  formulaTrainRows: document.querySelector("#formulaTrainRows"),
  formulaTestRows: document.querySelector("#formulaTestRows"),
  formulaBestName: document.querySelector("#formulaBestName"),
  formulaPeriod: document.querySelector("#formulaPeriod"),
  formulaRows: document.querySelector("#formulaRows"),
  formulaExampleRows: document.querySelector("#formulaExampleRows"),
  designView: document.querySelector("#designView"),
  designGraphSelected: document.querySelector("#designGraphSelected"),
  graphDesignGrid: document.querySelector("#graphDesignGrid"),
  molitSummary: document.querySelector("#molitSummary"),
  molitCompletionList: document.querySelector("#molitCompletionList"),
  mapView: document.querySelector("#mapView"),
  zoomMapTitle: document.querySelector("#zoomMapTitle"),
  zoomMapPeriod: document.querySelector("#zoomMapPeriod"),
  zoomMapLevel: document.querySelector("#zoomMapLevel"),
  zoomMapCount: document.querySelector("#zoomMapCount"),
  zoomMap: document.querySelector("#zoomMap"),
  mapApartmentRanking: document.querySelector("#mapApartmentRanking"),
  mapRankingSection: document.querySelector("#mapRankingSection"),
  mapRankingCount: document.querySelector("#mapRankingCount"),
  mapRankingRows: document.querySelector("#mapRankingRows"),
  mapSearchInput: document.querySelector("#mapSearchInput"),
  mapSearchResults: document.querySelector("#mapSearchResults"),
  mapApartmentPopup: document.querySelector("#mapApartmentPopup"),
  mapPopupTitle: document.querySelector("#mapPopupTitle"),
  mapPopupMeta: document.querySelector("#mapPopupMeta"),
  mapPopupCloseBtn: document.querySelector("#mapPopupCloseBtn"),
  mapPopupStats: document.querySelector("#mapPopupStats"),
  mapPopupChart: document.querySelector("#mapPopupChart"),
  mapPopupTooltip: document.querySelector("#mapPopupTooltip"),
  chart: document.querySelector("#chart"),
  chartPeriod: document.querySelector("#chartPeriod"),
  neighborhoodRows: document.querySelector("#neighborhoodRows"),
  neighborhoodCount: document.querySelector("#neighborhoodCount"),
  apartmentRows: document.querySelector("#apartmentRows"),
  apartmentCount: document.querySelector("#apartmentCount"),
  apartmentDetailPanel: document.querySelector("#apartmentDetailPanel"),
  detailTitle: document.querySelector("#detailTitle"),
  detailMeta: document.querySelector("#detailMeta"),
  detailChart: document.querySelector("#detailChart"),
  detailTooltip: document.querySelector("#detailTooltip")
};

init();

async function init() {
  state.activeGraphDesignId = readStoredGraphDesignId();
  setActiveTab(tabFromLocation());
  bindEvents();
  await loadClientConfig();
  await loadFilters();
  await refresh();
  setInterval(refreshStatusOnly, 5000);
}

async function loadClientConfig() {
  state.clientConfig = await api("/api/client-config").catch(() => ({
    maps: { provider: "leaflet", naverKeyId: "" }
  }));
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
  els.mapPopupCloseBtn.addEventListener("click", closeMapApartmentPopup);
  els.mapSearchInput.addEventListener("input", () => scheduleMapSearch());
  els.mapSearchInput.addEventListener("focus", () => {
    if (els.mapSearchInput.value.trim()) scheduleMapSearch(0);
  });
  els.mapSearchInput.addEventListener("keydown", handleMapSearchKeydown);
  els.graphDesignGrid?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-graph-design-id]");
    if (!card) return;
    setActiveGraphDesign(card.dataset.graphDesignId);
  });

  document.querySelectorAll("[data-period-years]").forEach((button) => {
    button.addEventListener("click", () => {
      setPeriodYears(Number(button.dataset.periodYears));
      refresh();
    });
  });

  document.querySelectorAll("[data-map-popup-years]").forEach((button) => {
    button.addEventListener("click", () => {
      setMapPopupPeriodYears(Number(button.dataset.mapPopupYears));
    });
  });

  document.querySelectorAll(".tabs [data-tab]").forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      activateTab(item.dataset.tab, { push: true });
    });
  });

  window.addEventListener("popstate", () => {
    activateTab(tabFromLocation(), { push: false });
  });

  document.addEventListener("click", (event) => {
    if (!els.mapApartmentRanking.contains(event.target)) hideMapSearchResults();
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
    renderGraphDesignGallery();
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

  if (state.activeTab === "map") {
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
    renderApartmentTable(await api(`/api/apartment-rankings?${params}`));
    return;
  }

  if (state.activeTab === "formula") {
    await loadFormulaAnalysis();
    return;
  }

  if (state.activeTab === "design") {
    renderGraphDesignGallery();
    return;
  }

  if (state.activeTab === "crawl") {
    renderMolitStatus(await api("/api/molit/status"));
  }
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

  document.querySelector("#mapView").classList.toggle("active", nextTab === "map");
  document.querySelector("#neighborhoodView").classList.toggle("active", nextTab === "neighborhood");
  document.querySelector("#apartmentView").classList.toggle("active", nextTab === "apartment");
  document.querySelector("#formulaView").classList.toggle("active", nextTab === "formula");
  document.querySelector("#designView").classList.toggle("active", nextTab === "design");
  document.querySelector("#crawlView").classList.toggle("active", nextTab === "crawl");

  const nextRoute = tabRoutes[nextTab];
  if (push && normalizeRoute(window.location.pathname) !== nextRoute) {
    window.history.pushState({ tab: nextTab }, "", nextRoute);
  }
}

function tabFromLocation() {
  return routeTabs[normalizeRoute(window.location.pathname)] || "map";
}

function normalizeRoute(pathname) {
  const normalized = String(pathname || "/").replace(/\/+$/, "");
  return normalized || "/";
}

async function syncCurrentRegion() {
  const regionId = els.regionSelect.value || "bundang";
  els.syncBtn.disabled = true;
  els.syncBtn.textContent = "동기화 중";
  els.statusLine.textContent = "수집 작업을 등록 중입니다. 실제 수집은 별도 worker가 천천히 처리합니다.";

  try {
    await api(`/api/crawl/start?regionId=${encodeURIComponent(regionId)}&maxComplexes=200&yearsBack=10&maxAreaTypesPerComplex=2&maxTiles=80&delayMinMs=15000&delayMaxMs=60000`);
    await refreshStatusOnly();
  } finally {
    els.syncBtn.disabled = false;
    els.syncBtn.textContent = `${selectedRegionName()} 샘플 동기화`;
  }
}

async function refreshStatusOnly() {
  const status = await api("/api/status");
  state.latestStatus = status;
  renderCollectionSummary();
  renderCrawlStatus(status.crawl);
  const months = status.months || [];
  if (months.length) state.months = months;
  els.statusLine.textContent = status.counts.monthlyPrices
    ? `아파트 ${formatInt(status.counts.apartments)}개, 면적 ${formatInt(status.counts.areaTypes)}개, 월별 시세 ${formatInt(status.counts.monthlyPrices)}건. 최근 저장: ${status.meta.syncedAt || "-"}`
    : "아직 저장된 시세 데이터가 없습니다. 수집 작업을 등록하고 worker가 처리할 때까지 기다려주세요.";
  if (state.activeTab === "crawl") {
    renderMolitStatus(await api("/api/molit/status"));
  }
}

function renderCollectionSummary() {
  const status = state.latestStatus || {};
  const crawl = status.crawl || {};
  const molit = state.latestMolitStatus;
  const jobs = crawl.jobProgress || [];
  const runningJobs = jobs.filter((item) => ["discovering", "running"].includes(item.job?.status)).length;
  const pendingJobs = jobs.filter((item) => item.job?.status === "requested").length;
  const kbFailed = jobs.reduce((sum, item) => sum + Number(item.job?.failedComplexes || 0), 0);
  const molitProgress = molit?.progress || {};
  const mapCache = status.mapCache || {};

  if (els.collectionSummaryKb) {
    els.collectionSummaryKb.textContent = `${formatInt(runningJobs)}개 진행 중`;
    els.collectionSummaryKbMeta.textContent = `${formatInt(pendingJobs)}개 대기 · ${formatInt(jobs.length)}개 주요 작업 추적`;
  }
  if (els.collectionSummaryMolit) {
    const completion = molitCompletionSummary(molit);
    els.collectionSummaryMolit.textContent = completion.isComplete ? "완료" : completion.title;
    els.collectionSummaryMolitMeta.textContent = completion.title;
  }
  if (els.collectionSummaryFailure) {
    const molitFailed = Number(molitProgress.failed || 0);
    els.collectionSummaryFailure.textContent = `${formatInt(kbFailed + molitFailed)}개`;
    els.collectionSummaryFailureMeta.textContent = `KB 실패 ${formatInt(kbFailed)} · 실거래 API 실패 ${formatInt(molitFailed)}`;
  }
  if (els.collectionSummaryCache) {
    els.collectionSummaryCache.textContent = mapCache.updatedAt ? formatDateTime(mapCache.updatedAt) : "-";
    els.collectionSummaryCacheMeta.textContent = mapCache.snapshots
      ? `${formatInt(mapCache.snapshots)}개 기간 캐시 · ${formatMonthRange(mapCache.startMonth, mapCache.endMonth)}`
      : "지도 캐시 없음";
  }
}

function renderCrawlStatus(crawl) {
  if (!crawl) {
    els.crawlSummary.textContent = "작업 없음";
    els.progressBar.style.width = "0%";
    els.progressText.textContent = "0%";
    els.currentComplex.textContent = "-";
    els.crawlCounts.textContent = "-";
    els.crawlDelay.textContent = "-";
    els.crawlTrackedJobs.innerHTML = "";
    els.crawlLogs.innerHTML = "";
    return;
  }

  const job = crawl.job;
  const activeProgress = crawlJobProgress({ job, queueCounts: crawl.queueCounts || {}, progress: crawl.progress || 0 });
  els.crawlSummary.textContent = `${crawlRegionLabel(job.regionId)} ${job.yearsBack}년치 / ${statusLabel(job.status)}`;
  els.progressBar.style.width = `${activeProgress.percent}%`;
  els.progressText.textContent = `${activeProgress.percent.toFixed(1)}%`;
  els.currentComplex.textContent = job.currentComplexName || "-";
  els.crawlCounts.textContent = `${job.completedComplexes} / ${job.failedComplexes} / ${job.totalComplexes}`;
  els.crawlDelay.textContent = `${Math.round(job.delayMinMs / 1000)}-${Math.round(job.delayMaxMs / 1000)}초`;
  els.crawlTrackedJobs.innerHTML = renderCrawlJobProgress(crawl.jobProgress || []);
  els.crawlLogs.innerHTML = (crawl.logs || []).map((log) => {
    const time = new Date(log.createdAt).toLocaleTimeString("ko-KR");
    return `<div>[${time}] ${escapeHtml(log.level)} ${escapeHtml(log.message)}</div>`;
  }).join("");
}

function crawlJobProgress(item) {
  const job = item.job || {};
  const counts = item.queueCounts || {};
  const completed = Number(counts.completed || 0);
  const failed = Number(counts.failed || 0);
  const done = completed + failed;
  const total = Number(job.totalComplexes || 0);
  const discovery = parseDiscoveryProgress(job.currentComplexName || "");

  if (job.status === "discovering" && discovery) {
    return {
      percent: discovery.total ? (discovery.current / discovery.total) * 100 : 0,
      label: `탐색 ${formatInt(discovery.current)} / ${formatInt(discovery.total)} 타일 · 발견 ${formatInt(discovery.found)}개`
    };
  }

  if (total) {
    return {
      percent: Number(item.progress || ((done / total) * 100)),
      label: `${formatInt(done)} / ${formatInt(total)} 단지`
    };
  }

  if (job.status === "requested") {
    return {
      percent: 0,
      label: job.sourceJobId ? "선행 작업 완료 후 대기" : "대기 중"
    };
  }

  return {
    percent: 0,
    label: "대상 준비 중"
  };
}

function parseDiscoveryProgress(value) {
  const match = String(value || "").match(/단지 탐색\s+([\d,]+)\/([\d,]+)\s*타일,\s*발견\s*([\d,]+)개/);
  if (!match) return null;
  return {
    current: Number(match[1].replaceAll(",", "")),
    total: Number(match[2].replaceAll(",", "")),
    found: Number(match[3].replaceAll(",", ""))
  };
}

function renderCrawlJobProgress(items) {
  if (!items.length) return `<div class="empty crawl-job-empty">진행 중이거나 대기 중인 주요 작업이 없습니다.</div>`;
  return items.map((item) => {
    const job = item.job;
    const counts = item.queueCounts || {};
    const failed = Number(counts.failed || 0);
    const status = job.status || "requested";
    const progress = crawlJobProgress(item);
    const activity = crawlJobActivity(item, progress);
    const label = `${crawlRegionLabel(job.regionId)} ${job.yearsBack}년치`;
    return `
      <article class="crawl-job-card">
        <div class="crawl-job-card-head">
          <strong>${escapeHtml(label)}</strong>
          <span class="status-pill ${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>
        </div>
        <div class="crawl-job-percent">${progress.percent.toFixed(1)}%</div>
        <div class="crawl-job-track" aria-hidden="true">
          <span style="width: ${Math.max(0, Math.min(progress.percent, 100))}%"></span>
        </div>
        <div class="crawl-job-meta">
          <span>${escapeHtml(progress.label)}</span>
          <span>실패 ${formatInt(failed)}</span>
        </div>
        <div class="crawl-job-activity">
          ${activity.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
        </div>
        ${job.currentComplexName ? `<div class="crawl-job-current">${escapeHtml(job.currentComplexName)}</div>` : ""}
      </article>
    `;
  }).join("");
}

function crawlJobActivity(item, progress) {
  const job = item.job || {};
  const recent = item.recent || {};
  const completedLastHour = Number(recent.completedLastHour || 0);
  const completedLast10Minutes = Number(recent.completedLast10Minutes || 0);
  const hourlyRate = completedLastHour;
  const lines = [
    `최근 1시간 완료 ${formatInt(completedLastHour)}개 · ${formatInt(hourlyRate)}개/시간`
  ];

  if (completedLast10Minutes) {
    lines.push(`최근 10분 ${formatInt(completedLast10Minutes)}개 · 단기속도 ${formatInt(completedLast10Minutes * 6)}개/시간`);
  }

  const topLabels = (recent.topLabels || [])
    .filter((item) => item.label)
    .map((item) => `${formatRecentLabel(item.label)} ${formatInt(item.count)}개`)
    .join(" · ");
  if (topLabels) {
    lines.push(`최근 지역 ${topLabels}`);
  }

  const discovery = parseDiscoveryProgress(job.currentComplexName || "");
  if (job.status === "discovering" && discovery && job.startedAt) {
    const elapsedHours = Math.max((Date.now() - new Date(job.startedAt).getTime()) / 3600000, 0.01);
    lines.push(`탐색 속도 ${formatInt(discovery.current / elapsedHours)}타일/시간 · 발견 ${formatInt(discovery.found / elapsedHours)}개/시간`);
  }

  if (job.status === "requested" && job.sourceJobId) {
    lines.push("선행 작업 완료 후 자동 시작");
  }

  if (progress.percent >= 100 && job.status === "completed") {
    lines.push(`최근 24시간 완료 ${formatInt(recent.completedLastDay || 0)}개`);
  }

  return lines;
}

function renderMolitStatus(status) {
  if (!status) return;
  state.latestMolitStatus = status;
  renderCollectionSummary();

  const completion = molitCompletionSummary(status);
  els.molitSummary.textContent = completion.title;
  els.molitCompletionList.innerHTML = completion.items.length
    ? completion.items.map((item) => `
      <div class="completion-item">
        <strong>${escapeHtml(item.title)}</strong>
        <span class="status-pill ${escapeHtml(item.status)}">${escapeHtml(statusLabel(item.status))}</span>
      </div>
    `).join("")
    : `<div class="empty">${escapeHtml(completion.title)}</div>`;
}

function molitCompletionSummary(status) {
  if (!status) {
    return { title: "실거래가 확인 중", items: [], isComplete: false };
  }

  const rows = status?.lawdRows || [];
  const progress = status?.progress || {};
  const completedTargets = new Set();
  const targetRows = new Map();

  for (const row of rows) {
    const target = row.target_region_id || "";
    const grouped = targetRows.get(target) || [];
    grouped.push(row);
    targetRows.set(target, grouped);
  }

  for (const [target, grouped] of targetRows.entries()) {
    if (grouped.length && grouped.every(isMolitTargetRowComplete) && molitTargetSavedCount(grouped) > 0) {
      completedTargets.add(target);
    }
  }

  const items = [];
  if (completedTargets.has("seoul")) {
    items.push({ title: "서울시 완료", status: "completed" });
  }

  if (completedTargets.has("gyeonggi")) {
    items.push({ title: "경기도 완료", status: "completed" });
  } else {
    const gyeonggiParts = ["dongtan", "bundang"].filter((target) => completedTargets.has(target));
    if (gyeonggiParts.length) {
      items.push({
        title: `경기도 ${gyeonggiParts.map(targetLabel).join("·")} 완료`,
        status: "completed"
      });
    }
  }

  for (const target of completedTargets) {
    if (!["seoul", "gyeonggi", "dongtan", "bundang"].includes(target)) {
      items.push({ title: `${targetLabel(target)} 완료`, status: "completed" });
    }
  }

  const failed = Number(progress.failed || 0);
  const running = Number(progress.running || 0);
  if (!items.length) {
    if (failed) return { title: "실거래가 수집 실패 항목 있음", items, isComplete: false };
    if (running) return { title: "실거래가 수집 중", items, isComplete: false };
    return { title: "완료된 실거래가 수집 없음", items, isComplete: false };
  }

  return {
    title: items.map((item) => item.title).join(" · "),
    items,
    isComplete: !failed && !running
  };
}

function isMolitTargetRowComplete(row) {
  const fetches = Number(row.fetches || 0);
  const completed = Number(row.completed_fetches || 0);
  const running = Number(row.running_fetches || 0);
  const failed = Number(row.failed_fetches || 0);
  return fetches > 0 && completed >= fetches && running === 0 && failed === 0;
}

function molitTargetSavedCount(rows) {
  return rows.reduce((sum, row) => sum + Number(row.saved_count || 0), 0);
}

async function loadFormulaAnalysis() {
  if (!els.formulaRunBtn) return;
  els.formulaRunBtn.disabled = true;
  els.formulaRunBtn.textContent = "분석 중";
  els.formulaSummary.textContent = "KB 시세와 실거래가 표본을 매칭 중입니다.";

  try {
    const params = new URLSearchParams();
    params.set("target", els.formulaTargetSelect.value || "seoul");
    if (els.formulaStartInput.value) params.set("start", els.formulaStartInput.value.replace("-", ""));
    if (els.formulaEndInput.value) params.set("end", els.formulaEndInput.value.replace("-", ""));
    params.set("limit", els.formulaLimitSelect.value || "15000");
    renderFormulaAnalysis(await api(`/api/formula-analysis?${params}`));
  } catch (error) {
    els.formulaSummary.textContent = `분석 실패: ${error.message}`;
  } finally {
    els.formulaRunBtn.disabled = false;
    els.formulaRunBtn.textContent = "분석";
  }
}

function renderFormulaAnalysis(result) {
  const samples = result.samples || {};
  const formulas = result.formulas || [];
  const best = formulas[0];
  els.formulaMatchedRows.textContent = formatInt(samples.matchedRows || 0);
  els.formulaTrainRows.textContent = formatInt(samples.trainRows || 0);
  els.formulaTestRows.textContent = formatInt(samples.testRows || 0);
  els.formulaBestName.textContent = best ? best.name : "-";
  els.formulaPeriod.textContent = result.period?.startMonth && result.period?.endMonth
    ? `${formatMonth(result.period.startMonth)} - ${formatMonth(result.period.endMonth)}`
    : "-";
  els.formulaSummary.textContent = result.reason
    ? result.reason
    : `KB ${formatInt(samples.kbRows || 0)}건 / 실거래 ${formatInt(samples.tradeRows || 0)}건에서 ${formatInt(samples.matchedRows || 0)}건 매칭`;

  els.formulaRows.innerHTML = formulas.length
    ? formulas.map((formula) => `
      <tr>
        <td><strong>${escapeHtml(formula.name)}</strong></td>
        <td>${escapeHtml(formula.description)}</td>
        <td>${formatDecimal(formula.scale, 3)}</td>
        <td>${formatPercentValue(formula.trainRawMape)}</td>
        <td>${formatPercentValue(formula.trainCalibratedMape)}</td>
        <td>${formatPercentValue(formula.testRawMape)}</td>
        <td class="${formula.testCalibratedMape <= 0.08 ? "positive" : ""}">${formatPercentValue(formula.testCalibratedMape)}</td>
        <td class="${Number(formula.testBias || 0) >= 0 ? "positive" : "negative"}">${formatSignedPercent(formula.testBias)}</td>
        <td>${formatInt(formula.totalCount)} / 검증 ${formatInt(formula.testCount)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="9" class="empty">매칭된 계산식 표본이 없습니다. 수집이 더 진행된 뒤 다시 실행하세요.</td></tr>`;

  els.formulaExampleRows.innerHTML = (result.examples || []).length
    ? result.examples.map((row) => `
      <tr>
        <td>${escapeHtml(row.apartmentName)}</td>
        <td>${escapeHtml(row.neighborhoodName)}</td>
        <td>${escapeHtml(row.areaLabel || "-")}</td>
        <td>${formatMonth(row.yearMonth)}</td>
        <td>${formatMoney(row.kbPyeongPrice)}</td>
        <td>${formatMoney(row.predictedPyeongPrice)}</td>
        <td>${formatInt(row.dealCount)}</td>
        <td class="${Number(row.errorRate || 0) >= 0 ? "positive" : "negative"}">${formatSignedPercent(row.errorRate)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="8" class="empty">표시할 매칭 예시가 없습니다.</td></tr>`;
}

function applyFormulaDefaultPeriod() {
  if (!state.months.length || !els.formulaStartInput || !els.formulaEndInput) return;
  if (!els.formulaEndInput.value) {
    els.formulaEndInput.value = toMonthInput(state.months.at(-1));
  }
  if (!els.formulaStartInput.value) {
    const index = Math.max(0, state.months.length - 37);
    els.formulaStartInput.value = toMonthInput(state.months[index]);
  }
}

function statusLabel(status) {
  return {
    requested: "대기",
    discovering: "단지 탐색 중",
    completed: "완료",
    failed: "실패",
    running: "수집 중",
    pending: "대기"
  }[status] || status;
}

function crawlRegionLabel(regionId) {
  return {
    bundang: "분당",
    dongtan: "동탄",
    seoul: "서울",
    gyeonggi: "경기"
  }[regionId] || regionId || "-";
}

function formatRecentLabel(label) {
  return crawlRegionLabel(label);
}

function targetLabel(target) {
  return {
    seoul: "서울",
    bundang: "분당",
    dongtan: "동탄"
  }[target] || target || "-";
}

function useNaverMap() {
  return state.clientConfig?.maps?.provider === "naver" && state.clientConfig.maps.naverKeyId;
}

async function hasNaverAuthFailure(container = els.zoomMap) {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  return container.textContent.includes("네이버 지도 Open API 인증이 실패");
}

function loadNaverSdk() {
  if (window.naver?.maps) return Promise.resolve(true);
  if (state.naverSdkPromise) return state.naverSdkPromise;

  const keyId = state.clientConfig?.maps?.naverKeyId;
  if (!keyId) return Promise.resolve(false);

  state.naverSdkPromise = new Promise((resolve, reject) => {
    const callbackName = "__orulzipNaverMapReady";
    const timeout = setTimeout(() => {
      reject(new Error("NAVER Maps SDK auth or load timeout"));
    }, 6000);
    window[callbackName] = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    const script = document.createElement("script");
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(keyId)}&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("NAVER Maps SDK load failed"));
    };
    document.head.appendChild(script);
  });

  return state.naverSdkPromise;
}

function naverLabelIcon(content, width, height) {
  return {
    content,
    size: new window.naver.maps.Size(width, height),
    anchor: new window.naver.maps.Point(width / 2, height / 2)
  };
}

function openZoomNaverInfoWindow(position, html) {
  if (!state.zoomNaverInfoWindow) {
    state.zoomNaverInfoWindow = new window.naver.maps.InfoWindow({
      borderWidth: 0,
      backgroundColor: "transparent",
      disableAnchor: false
    });
  }
  state.zoomNaverInfoWindow.setContent(`<div class="naver-info-window">${html}</div>`);
  state.zoomNaverInfoWindow.open(state.zoomNaverMap, position);
}

function shortRegionLabel(name) {
  return String(name || "")
    .replace("특별자치도", "")
    .replace("특별자치시", "")
    .replace("특별시", "")
    .replace("광역시", "")
    .replace("경기도", "경기")
    .replace("강원도", "강원")
    .replace("충청북도", "충북")
    .replace("충청남도", "충남")
    .replace("전라북도", "전북")
    .replace("전라남도", "전남")
    .replace("경상북도", "경북")
    .replace("경상남도", "경남");
}

function mapGroupPopup(group) {
  return `
    <strong>${escapeHtml(group.name)}</strong><br>
    아파트 ${formatInt(group.apartmentCount)}개 / 면적 ${formatInt(group.areaCount)}개<br>
    평균 상승액 ${formatMoney(group.growthAmount)}<br>
    평균 상승률 ${formatPercent(group.growthRate)}
  `;
}

async function initZoomMap() {
  if (useNaverMap()) {
    const ready = await initNaverZoomMap();
    if (ready) return true;
  }
  return initLeafletZoomMap();
}

async function initNaverZoomMap() {
  const loaded = await loadNaverSdk().catch(() => false);
  if (!loaded || !window.naver?.maps) return false;

  if (state.zoomNaverMap) {
    setTimeout(() => {
      window.naver.maps.Event.trigger(state.zoomNaverMap, "resize");
      updateZoomMapLevelLabel();
    }, 0);
    if (await hasNaverAuthFailure(els.zoomMap)) return fallbackFromNaverZoomMap();
    return true;
  }

  state.zoomNaverMap = new window.naver.maps.Map(els.zoomMap, {
    center: new window.naver.maps.LatLng(homeMapView.center[0], homeMapView.center[1]),
    zoom: homeMapView.zoom,
    zoomControl: true,
    scaleControl: true,
    mapDataControl: false
  });
  window.naver.maps.Event.addListener(state.zoomNaverMap, "zoom_changed", updateZoomMapLevelLabel);
  window.naver.maps.Event.addListener(state.zoomNaverMap, "idle", () => {
    updateZoomMapLevelLabel();
    scheduleZoomMapLoad();
  });
  setTimeout(() => window.naver.maps.Event.trigger(state.zoomNaverMap, "resize"), 0);
  updateZoomMapLevelLabel();
  if (await hasNaverAuthFailure(els.zoomMap)) return fallbackFromNaverZoomMap();
  return true;
}

function fallbackFromNaverZoomMap() {
  clearZoomNaverOverlays();
  state.zoomNaverMap = null;
  state.clientConfig.maps.provider = "leaflet";
  els.zoomMap.innerHTML = "";
  return false;
}

function initLeafletZoomMap() {
  if (!window.L) {
    els.zoomMap.innerHTML = `<div class="empty">지도 라이브러리를 불러오지 못했습니다.</div>`;
    return false;
  }

  if (state.zoomMap) {
    setTimeout(() => {
      state.zoomMap.invalidateSize();
      updateZoomMapLevelLabel();
    }, 0);
    return true;
  }

  state.zoomMap = L.map(els.zoomMap, {
    scrollWheelZoom: true
  }).setView(homeMapView.center, homeMapView.zoom);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(state.zoomMap);
  state.zoomMapLayer = L.layerGroup().addTo(state.zoomMap);
  state.zoomMap.on("moveend zoomend", () => {
    updateZoomMapLevelLabel();
    scheduleZoomMapLoad();
  });
  updateZoomMapLevelLabel();
  return true;
}

function scheduleZoomMapLoad() {
  if (state.activeTab !== "map") return;
  clearTimeout(state.zoomMapTimer);
  state.zoomMapTimer = setTimeout(loadZoomMapSummary, 180);
}

async function loadZoomMapSummary() {
  if (!(await initZoomMap())) return;
  const requestId = ++state.zoomMapRequestId;
  const params = new URLSearchParams();
  const view = currentZoomMapView();
  if (!view) return;
  const { zoom, bounds } = view;
  params.set("zoom", String(zoom));
  params.set("north", String(bounds.north));
  params.set("south", String(bounds.south));
  params.set("east", String(bounds.east));
  params.set("west", String(bounds.west));
  if (els.startInput.value) params.set("start", els.startInput.value.replace("-", ""));
  if (els.endInput.value) params.set("end", els.endInput.value.replace("-", ""));

  const data = await api(`/api/zoom-map-summary?${params}`);
  if (requestId !== state.zoomMapRequestId) return;
  renderZoomMapSummary(data);
}

function currentZoomMapView() {
  if (state.zoomNaverMap && window.naver?.maps) {
    const bounds = state.zoomNaverMap.getBounds();
    const ne = bounds.getNE ? bounds.getNE() : bounds.getMax();
    const sw = bounds.getSW ? bounds.getSW() : bounds.getMin();
    return {
      zoom: state.zoomNaverMap.getZoom(),
      bounds: {
        north: naverCoordLat(ne),
        south: naverCoordLat(sw),
        east: naverCoordLng(ne),
        west: naverCoordLng(sw)
      }
    };
  }

  if (!state.zoomMap) return null;
  const bounds = state.zoomMap.getBounds();
  return {
    zoom: state.zoomMap.getZoom(),
    bounds: {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest()
    }
  };
}

function updateZoomMapLevelLabel(level = null) {
  const view = currentZoomMapView();
  if (!view) {
    return;
  }
  const zoom = formatZoomValue(view.zoom);
  const levelLabel = zoomLevelLabel(level || zoomAggregationLevel(view.zoom));
  if (els.zoomMapLevel) els.zoomMapLevel.textContent = `${levelLabel} 단위 · 줌 ${zoom}`;
}

function zoomAggregationLevel(zoom) {
  if (zoom >= 16) return "apartment";
  if (zoom >= 13) return "dong";
  if (zoom >= 11) return "sigungu";
  return "sido";
}

function formatZoomValue(zoom) {
  const value = Number(zoom);
  if (!Number.isFinite(value)) return "-";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function naverCoordLat(coord) {
  return typeof coord.lat === "function" ? coord.lat() : Number(coord.y ?? coord._lat ?? coord.lat);
}

function naverCoordLng(coord) {
  return typeof coord.lng === "function" ? coord.lng() : Number(coord.x ?? coord._lng ?? coord.lng);
}

function renderZoomMapSummary(data) {
  const items = data.items || [];
  const levelLabel = zoomLevelLabel(data.level);
  const cacheLabel = formatMapCacheLabel(data.cache);
  els.zoomMapPeriod.textContent = data.period?.startMonth && data.period?.endMonth
    ? `${formatMonth(data.period.startMonth)} - ${formatMonth(data.period.endMonth)}${cacheLabel ? ` · ${cacheLabel}` : ""}`
    : "";
  updateZoomMapLevelLabel(data.level);
  els.zoomMapCount.textContent = `${formatInt(items.length)}개 표시`;
  els.zoomMapTitle.textContent = `${levelLabel} 상승률 지도`;
  renderMapApartmentRanking(data.level, items);
  clearZoomMapOverlays();

  for (const item of items) {
    if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) continue;
    if (data.level === "apartment") {
      renderZoomApartmentMarker(item);
    } else {
      renderZoomGroupMarker(item, data.level);
    }
  }
}

function scheduleMapSearch(delay = 160) {
  clearTimeout(state.mapSearchTimer);
  state.mapSearchRequestId += 1;
  state.mapSearchItems = [];
  state.mapSearchActiveIndex = -1;
  const keyword = els.mapSearchInput.value.trim();
  if (!keyword) {
    hideMapSearchResults();
    return;
  }
  hideMapSearchResults();
  state.mapSearchTimer = setTimeout(loadMapSearchResults, delay);
}

async function loadMapSearchResults() {
  const keyword = els.mapSearchInput.value.trim();
  if (!keyword) {
    hideMapSearchResults();
    return;
  }

  const requestId = ++state.mapSearchRequestId;
  try {
    const result = await api(`/api/map-search?q=${encodeURIComponent(keyword)}&limit=12`);
    if (requestId !== state.mapSearchRequestId) return;
    state.mapSearchItems = result.items || [];
    state.mapSearchActiveIndex = state.mapSearchItems.length ? 0 : -1;
    renderMapSearchResults(state.mapSearchItems);
  } catch (error) {
    if (requestId !== state.mapSearchRequestId) return;
    state.mapSearchItems = [];
    state.mapSearchActiveIndex = -1;
    els.mapSearchInput.setAttribute("aria-expanded", "true");
    els.mapSearchInput.removeAttribute("aria-activedescendant");
    els.mapSearchResults.hidden = false;
    els.mapSearchResults.innerHTML = `<div class="map-search-empty">검색 실패</div>`;
  }
}

function renderMapSearchResults(items) {
  els.mapSearchResults.hidden = false;
  els.mapSearchInput.setAttribute("aria-expanded", "true");
  els.mapSearchResults.innerHTML = items.length
    ? items.map((item, index) => `
      <button id="map-search-result-${index}" class="map-search-result ${index === state.mapSearchActiveIndex ? "active" : ""}" type="button" role="option" data-index="${index}" aria-selected="${index === state.mapSearchActiveIndex}">
        <span class="map-search-type">${item.type === "dong" ? "동" : "APT"}</span>
        <span class="map-search-main">
          <strong>${escapeHtml(item.name)}</strong>
          <em>${escapeHtml(item.meta || item.address || "")}</em>
        </span>
      </button>
    `).join("")
    : `<div class="map-search-empty">검색 결과가 없습니다.</div>`;

  els.mapSearchResults.querySelectorAll("[data-index]").forEach((button) => {
    button.addEventListener("mouseenter", () => {
      setMapSearchActiveIndex(Number(button.dataset.index), { scroll: false });
    });
    button.addEventListener("click", () => {
      const item = state.mapSearchItems[Number(button.dataset.index)];
      if (item) selectMapSearchResult(item);
    });
  });
  updateMapSearchActiveDescendant();
}

async function handleMapSearchKeydown(event) {
  if (event.key === "Escape") {
    hideMapSearchResults();
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveMapSearchActiveIndex(1);
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    moveMapSearchActiveIndex(-1);
    return;
  }
  if (event.key !== "Enter") return;

  event.preventDefault();
  if (!state.mapSearchItems.length && els.mapSearchInput.value.trim()) {
    clearTimeout(state.mapSearchTimer);
    await loadMapSearchResults();
  }
  const item = state.mapSearchItems[state.mapSearchActiveIndex] || state.mapSearchItems[0];
  if (!item) return;
  selectMapSearchResult(item);
}

function moveMapSearchActiveIndex(delta) {
  if (!state.mapSearchItems.length) return;
  if (els.mapSearchResults.hidden) renderMapSearchResults(state.mapSearchItems);
  const current = state.mapSearchActiveIndex < 0 ? (delta > 0 ? -1 : 0) : state.mapSearchActiveIndex;
  const next = (current + delta + state.mapSearchItems.length) % state.mapSearchItems.length;
  setMapSearchActiveIndex(next);
}

function setMapSearchActiveIndex(index, { scroll = true } = {}) {
  if (!state.mapSearchItems.length) return;
  state.mapSearchActiveIndex = Math.max(0, Math.min(index, state.mapSearchItems.length - 1));
  els.mapSearchResults.querySelectorAll("[data-index]").forEach((button) => {
    const isActive = Number(button.dataset.index) === state.mapSearchActiveIndex;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    if (isActive && scroll) {
      button.scrollIntoView({ block: "nearest" });
    }
  });
  updateMapSearchActiveDescendant();
}

async function selectMapSearchResult(item) {
  els.mapSearchInput.value = item.name || "";
  hideMapSearchResults();
  if (!(await initZoomMap())) return;
  focusMapTarget(item, Number(item.targetZoom || 16));
}

function focusMapTarget(item, zoom = 16) {
  moveZoomMapTo(item, zoom);
}

function hideMapSearchResults() {
  els.mapSearchResults.hidden = true;
  els.mapSearchResults.innerHTML = "";
  state.mapSearchActiveIndex = -1;
  els.mapSearchInput.setAttribute("aria-expanded", "false");
  els.mapSearchInput.removeAttribute("aria-activedescendant");
}

function updateMapSearchActiveDescendant() {
  if (state.mapSearchActiveIndex < 0) {
    els.mapSearchInput.removeAttribute("aria-activedescendant");
    return;
  }
  els.mapSearchInput.setAttribute("aria-activedescendant", `map-search-result-${state.mapSearchActiveIndex}`);
}

function renderMapApartmentRanking(level, items) {
  if (!els.mapApartmentRanking || !els.mapRankingSection || !els.mapRankingRows || !els.mapRankingCount) return;
  if (level !== "apartment") {
    els.mapApartmentRanking.classList.remove("ranking-active");
    els.mapRankingSection.hidden = true;
    els.mapRankingRows.innerHTML = "";
    els.mapRankingCount.textContent = "";
    return;
  }

  const rows = [...items]
    .filter((item) => item.type === "apartment" && item.id)
    .sort((a, b) => {
      if ((a.hasData !== false) !== (b.hasData !== false)) return a.hasData === false ? 1 : -1;
      const rateDiff = sortableRate(b.growthRate) - sortableRate(a.growthRate);
      if (rateDiff) return rateDiff;
      return String(a.name || "").localeCompare(String(b.name || ""), "ko");
    });

  els.mapApartmentRanking.classList.add("ranking-active");
  els.mapRankingSection.hidden = false;
  els.mapRankingCount.textContent = `${formatInt(rows.length)}개`;
  els.mapRankingRows.innerHTML = rows.length
    ? rows.map((item, index) => `
      <button class="map-ranking-row" type="button" data-apartment-id="${escapeHtml(item.id)}">
        <span class="map-ranking-rank">${index + 1}</span>
        <span class="map-ranking-main">
          <strong>${escapeHtml(item.name)}</strong>
          <em>${escapeHtml(item.neighborhoodName || "-")}${item.areaSummary ? ` · ${escapeHtml(item.areaSummary)}` : ""}</em>
        </span>
        <span class="map-ranking-rate ${rateClass(item.growthRate)}">${item.hasData === false ? "데이터없음" : formatPercent(item.growthRate)}</span>
      </button>
    `).join("")
    : `<div class="map-ranking-empty">현재 지도에 표시할 아파트가 없습니다.</div>`;

  const itemById = new Map(rows.map((item) => [item.id, item]));
  els.mapRankingRows.querySelectorAll("[data-apartment-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = itemById.get(button.dataset.apartmentId);
      if (!item) return;
      focusMapApartment(item);
      openMapApartmentDetail(item.id, item);
    });
  });
}

function focusMapApartment(item) {
  moveZoomMapTo(item, apartmentMapZoom);
}

function moveZoomMapTo(item, zoom, { exactZoom = false } = {}) {
  if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return;
  if (state.zoomNaverMap && window.naver?.maps) {
    moveNaverZoomMapTo(item, zoom, { exactZoom });
    return;
  }
  if (state.zoomMap) {
    moveLeafletZoomMapTo(item, zoom, { exactZoom });
  }
}

function moveLeafletZoomMapTo(item, zoom, { exactZoom = false } = {}) {
  const currentZoom = Number(state.zoomMap.getZoom() || 0);
  const targetZoom = exactZoom ? zoom : Math.max(currentZoom, zoom);
  if (typeof state.zoomMap.flyTo === "function") {
    state.zoomMap.flyTo([item.lat, item.lng], targetZoom, {
      animate: true,
      duration: animatedMapMoveDuration,
      easeLinearity: 0.25
    });
    return;
  }
  state.zoomMap.setView([item.lat, item.lng], targetZoom, { animate: true });
}

function moveNaverZoomMapTo(item, zoom, { exactZoom = false } = {}) {
  const map = state.zoomNaverMap;
  const currentZoom = Number(map.getZoom?.() || 0);
  const targetZoom = exactZoom ? zoom : Math.max(currentZoom, zoom);
  const position = new window.naver.maps.LatLng(item.lat, item.lng);

  if (typeof map.morph === "function") {
    try {
      map.morph(position, targetZoom, { duration: animatedMapMoveDuration * 1000 });
      return;
    } catch (error) {
      try {
        map.morph(position, targetZoom);
        return;
      } catch (fallbackError) {
        // Fall through to panTo/setCenter when morph is unavailable in this SDK build.
      }
    }
  }

  if (typeof map.panTo === "function") {
    try {
      map.panTo(position, { duration: animatedMapMoveDuration * 1000 });
    } catch (error) {
      map.panTo(position);
    }
    if (targetZoom !== currentZoom && typeof map.setZoom === "function") {
      setTimeout(() => map.setZoom(targetZoom), 260);
    }
    return;
  }

  map.setCenter(position);
  if (typeof map.setZoom === "function") map.setZoom(targetZoom);
}

function zoomGroupTargetZoom(level, currentZoom) {
  if (level === "sido") return Math.max(Number(currentZoom || 0) + 1, 11);
  if (level === "sigungu") return Math.max(Number(currentZoom || 0) + 1, 13);
  if (level === "dong") return apartmentMapZoom;
  return Math.max(Number(currentZoom || 0) + 1, apartmentMapZoom);
}

function clearZoomMapOverlays() {
  if (state.zoomNaverMap) {
    clearZoomNaverOverlays();
    return;
  }
  state.zoomMapLayer?.clearLayers();
}

function clearZoomNaverOverlays() {
  for (const overlay of state.zoomNaverOverlays) {
    overlay.setMap(null);
  }
  state.zoomNaverOverlays = [];
  if (state.zoomNaverInfoWindow) state.zoomNaverInfoWindow.close();
}

function renderZoomGroupMarker(item, level) {
  if (state.zoomNaverMap && window.naver?.maps) {
    renderNaverZoomGroupMarker(item, level);
    return;
  }
  const marker = L.marker([item.lat, item.lng], {
    icon: L.divIcon({
      className: "zoom-cluster-marker",
      html: `
        <div style="--zoom-color: ${growthColor(item.growthRate)}">
        <strong>${escapeHtml(shortZoomLabel(item.name, level))}</strong>
        <span>${formatPercent(item.growthRate)}</span>
        <em>${formatInt(item.apartmentCount)}</em>
        </div>
      `,
      iconSize: zoomMarkerSize(item.apartmentCount),
      iconAnchor: zoomMarkerAnchor(item.apartmentCount)
    })
  }).addTo(state.zoomMapLayer);
  marker.bindPopup(zoomGroupPopup(item));
  marker.on("click", () => {
    moveZoomMapTo(item, zoomGroupTargetZoom(level, state.zoomMap.getZoom()), { exactZoom: true });
  });
}

function renderZoomApartmentMarker(item) {
  if (state.zoomNaverMap && window.naver?.maps) {
    renderNaverZoomApartmentMarker(item);
    return;
  }
  const marker = L.marker([item.lat, item.lng], {
    icon: L.divIcon({
      className: "apartment-map-marker-shell",
      html: apartmentMarkerHtml(item),
      iconSize: [54, 34],
      iconAnchor: [27, 17]
    })
  }).addTo(state.zoomMapLayer);
  marker.bindTooltip(apartmentHoverHtml(item), {
    className: "apartment-hover-tooltip",
    direction: "top",
    opacity: 1,
    sticky: true
  });
  marker.on("click", () => openMapApartmentDetail(item.id, item));
}

function renderNaverZoomGroupMarker(item, level) {
  const position = new window.naver.maps.LatLng(item.lat, item.lng);
  const [width, height] = zoomMarkerSize(item.apartmentCount);
  const marker = new window.naver.maps.Marker({
    position,
    map: state.zoomNaverMap,
    icon: naverLabelIcon(`
      <div class="zoom-cluster-marker" style="width:${width}px;height:${height}px">
        <div style="--zoom-color: ${growthColor(item.growthRate)}">
          <strong>${escapeHtml(shortZoomLabel(item.name, level))}</strong>
          <span>${formatPercent(item.growthRate)}</span>
          <em>${formatInt(item.apartmentCount)}</em>
        </div>
      </div>
    `, width, height)
  });
  window.naver.maps.Event.addListener(marker, "click", () => {
    openZoomNaverInfoWindow(position, zoomGroupPopup(item));
    moveZoomMapTo(item, zoomGroupTargetZoom(level, state.zoomNaverMap.getZoom()), { exactZoom: true });
  });
  state.zoomNaverOverlays.push(marker);
}

function renderNaverZoomApartmentMarker(item) {
  const position = new window.naver.maps.LatLng(item.lat, item.lng);
  const marker = new window.naver.maps.Marker({
    position,
    map: state.zoomNaverMap,
    icon: naverLabelIcon(apartmentMarkerHtml(item), 54, 34)
  });
  window.naver.maps.Event.addListener(marker, "mouseover", () => {
    openZoomNaverInfoWindow(position, apartmentHoverHtml(item));
  });
  window.naver.maps.Event.addListener(marker, "mouseout", () => {
    if (state.zoomNaverInfoWindow) state.zoomNaverInfoWindow.close();
  });
  window.naver.maps.Event.addListener(marker, "click", () => {
    openMapApartmentDetail(item.id, item);
  });
  state.zoomNaverOverlays.push(marker);
}

function apartmentMarkerHtml(item) {
  const hasData = item.hasData !== false;
  return `
    <div class="apartment-map-marker ${hasData ? "" : "no-data"}" style="--marker-color:${growthColor(item.growthRate)}">
      <span>${hasData ? formatPercent(item.growthRate) : "데이터없음"}</span>
    </div>
  `;
}

function apartmentHoverHtml(item) {
  const hasData = item.hasData !== false;
  return `
    <strong>${escapeHtml(item.name)}</strong><br>
    ${escapeHtml(item.neighborhoodName || "-")}<br>
    상승률 ${hasData ? formatPercent(item.growthRate) : "데이터없음"}
  `;
}

async function openMapApartmentDetail(apartmentId, seedItem = null) {
  const requestId = ++state.mapPopupRequestId;
  syncMapPopupPeriodButtons();
  state.mapPopupDetail = null;
  if (state.mapApartmentDetails.has(apartmentId)) {
    renderMapApartmentDetail(state.mapApartmentDetails.get(apartmentId));
    return;
  }

  renderMapApartmentLoading(seedItem);

  try {
    const detail = await api(`/api/apartment-detail?apartmentId=${encodeURIComponent(apartmentId)}`);
    if (requestId !== state.mapPopupRequestId) return;
    state.mapApartmentDetails.set(apartmentId, detail);
    renderMapApartmentDetail(detail);
  } catch (error) {
    if (requestId !== state.mapPopupRequestId) return;
    renderMapApartmentError(seedItem, error);
  }
}

function closeMapApartmentPopup() {
  els.mapApartmentPopup.hidden = true;
  if (els.mapPopupTooltip) els.mapPopupTooltip.hidden = true;
}

function setMapPopupPeriodYears(years) {
  state.mapPopupPeriodYears = [1, 3, 5].includes(years) ? years : 3;
  syncMapPopupPeriodButtons();
  if (state.mapPopupDetail) {
    renderMapApartmentDetail(state.mapPopupDetail);
  }
}

function syncMapPopupPeriodButtons() {
  document.querySelectorAll("[data-map-popup-years]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.mapPopupYears) === state.mapPopupPeriodYears);
  });
}

function renderMapApartmentLoading(seedItem = null) {
  els.mapApartmentPopup.hidden = false;
  els.mapApartmentPopup.classList.add("loading");
  els.mapPopupTitle.textContent = seedItem?.name || "아파트 시세";
  els.mapPopupMeta.textContent = `${seedItem?.neighborhoodName || "-"} / ${state.mapPopupPeriodYears}년전 기준`;
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
  els.mapApartmentPopup.hidden = false;
  els.mapApartmentPopup.classList.remove("loading");
  state.mapPopupDetail = null;
  els.mapPopupTitle.textContent = seedItem?.name || "아파트 시세";
  els.mapPopupMeta.textContent = "불러오기 실패";
  els.mapPopupStats.innerHTML = "";
  els.mapPopupChart.innerHTML = `<div class="empty">시세 데이터를 불러오지 못했습니다.${error?.message ? ` ${escapeHtml(error.message)}` : ""}</div>`;
}

function renderMapApartmentDetail(detail) {
  els.mapApartmentPopup.classList.remove("loading");
  state.mapPopupDetail = detail;
  const years = state.mapPopupPeriodYears || 3;
  if (!detail.apartment) {
    els.mapApartmentPopup.hidden = false;
    els.mapPopupTitle.textContent = "아파트 시세";
    els.mapPopupMeta.textContent = "정보 없음";
    els.mapPopupStats.innerHTML = "";
    els.mapPopupChart.innerHTML = `<div class="empty">아파트 정보를 찾지 못했습니다.</div>`;
    return;
  }

  els.mapApartmentPopup.hidden = false;
  els.mapPopupTitle.textContent = detail.apartment.name;

  const latestMonth = detail.months.at(-1);
  if (!latestMonth) {
    els.mapPopupMeta.textContent = `${detail.apartment.neighborhoodName || "-"} / ${years}년전 기준`;
    els.mapPopupStats.innerHTML = "";
    els.mapPopupChart.innerHTML = `<div class="empty">표시할 시세 데이터가 없습니다.</div>`;
    return;
  }

  const startMonth = periodStartMonth(latestMonth, years);
  const months = detail.months.filter((month) => month >= startMonth && month <= latestMonth);
  const graphDesign = activeGraphDesign();
  els.mapPopupMeta.textContent = `${detail.apartment.neighborhoodName || "-"} / ${formatMonth(startMonth)} - ${formatMonth(latestMonth)} / ${years}년전 기준`;
  const series = detail.areaTypes
    .map((areaType, index) => ({
      ...areaType,
      color: graphDesignColor(graphDesign, index, colors[index % colors.length]),
      prices: areaType.prices.filter((price) => price.yearMonth >= startMonth && price.yearMonth <= latestMonth)
    }))
    .filter((areaType) => areaType.prices.length)
    .slice(0, 8);

  if (!series.length) {
    els.mapPopupStats.innerHTML = "";
    els.mapPopupChart.innerHTML = `<div class="empty">선택 기간의 시세 데이터가 없습니다.</div>`;
    return;
  }

  els.mapPopupStats.innerHTML = series.map((item) => {
    const first = item.prices[0];
    const last = item.prices.at(-1);
    const growthAmount = last.saleMid - first.saleMid;
    const growthRate = first.saleMid ? growthAmount / first.saleMid : null;
    return `
      <div class="map-popup-stat">
        <strong><i style="background:${item.color}"></i>${escapeHtml(item.label || "-")}</strong>
        <span>${formatKoreanPrice(first.saleMid)} → ${formatKoreanPrice(last.saleMid)}</span>
        <em class="${growthAmount >= 0 ? "positive" : "negative"}">${formatPercent(growthRate)}</em>
      </div>
    `;
  }).join("");

  renderMapPopupChart({ months, series });
}

function renderMapPopupChart({ months, series }) {
  const result = renderGraphSvg({
    design: activeGraphDesign(),
    interactive: true,
    mode: "popup",
    months,
    series
  });
  els.mapPopupChart.innerHTML = result.html;
  bindMapPopupChartHover({ width: result.geometry.width, months, series, x: result.geometry.x });
}

function graphDesign(id, name, overrides = {}) {
  return {
    id,
    name,
    palette: "market",
    curve: "smooth",
    fillOpacity: 0,
    pointMode: "end",
    labelMode: "end",
    gridMode: "soft",
    background: "#ffffff",
    plotBackground: "#fbfdff",
    textColor: "#667085",
    axisColor: "#cfd7e3",
    gridColor: "#e7edf5",
    lineWidth: 2.7,
    dash: "",
    shadow: false,
    plotRadius: 8,
    ...overrides
  };
}

function activeGraphDesign() {
  return graphDesignVariantMap.get(state.activeGraphDesignId)
    || graphDesignVariantMap.get(defaultGraphDesignId)
    || graphDesignVariants[0];
}

function readStoredGraphDesignId() {
  try {
    const stored = window.localStorage.getItem(graphDesignStorageKey);
    return graphDesignVariantMap.has(stored) ? stored : defaultGraphDesignId;
  } catch {
    return defaultGraphDesignId;
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
  if (state.mapPopupDetail && !els.mapApartmentPopup.hidden) {
    renderMapApartmentDetail(state.mapPopupDetail);
  }
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
          <em>${isActive ? "선택됨" : `${String(index + 1).padStart(2, "0")}/30`}</em>
        </span>
        <span class="graph-design-preview">${result.html}</span>
      </button>
    `;
  }).join("");
}

function graphDesignSampleData() {
  const start = new Date(2023, 5, 1);
  const months = Array.from({ length: 38 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
  const buildPrices = (base, slope, wave, bump = 0) => months.map((yearMonth, index) => ({
    yearMonth,
    saleMid: Math.round(base + slope * index + Math.sin(index / 3.2) * wave + Math.max(0, index - 24) * bump)
  }));
  return {
    months,
    series: [
      { label: "59A", color: colors[0], prices: buildPrices(72000, 520, 1600, 160) },
      { label: "84A", color: colors[1], prices: buildPrices(98000, 760, 2100, 220) },
      { label: "101", color: colors[2], prices: buildPrices(124000, 640, 2500, 120) },
      { label: "114", color: colors[3], prices: buildPrices(148000, 830, 2800, 260) }
    ]
  };
}

function renderGraphSvg({ design, interactive, mode, months, series }) {
  const geometry = graphChartGeometry({ mode, months, series });
  const { width, height, padding, chartRight, chartBottom, x, y, yMin, yMax } = geometry;
  const svgId = `graph-${mode}-${design.id}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  const grid = renderGraphGrid({ design, y, yMin, yMax, padding, chartRight });
  const monthLabels = renderGraphMonthLabels({ design, mode, months, x, height });
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
    geometry,
    html: `
      <svg class="map-popup-chart-svg graph-design-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="평형별 시세 그래프">
        <defs>${defs}</defs>
        <rect x="0" y="0" width="${width}" height="${height}" rx="${mode === "preview" ? 12 : 0}" fill="${design.background}"></rect>
        <rect class="map-popup-plot-bg" x="${padding.left}" y="${padding.top}" width="${chartRight - padding.left}" height="${chartBottom - padding.top}" rx="${design.plotRadius}" style="fill:${design.plotBackground};stroke:${design.gridMode === "none" ? "transparent" : design.gridColor};"></rect>
        ${grid}
        ${seriesMarkup}
        ${monthLabels}
        <line class="map-popup-axis-line" x1="${padding.left}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}" style="stroke:${design.axisColor};"></line>
        <line class="map-popup-axis-line" x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${chartBottom}" style="stroke:${design.axisColor};"></line>
        ${hover}
      </svg>
    `
  };
}

function graphChartGeometry({ mode, months, series }) {
  const width = mode === "preview" ? 360 : 680;
  const height = mode === "preview" ? 190 : 300;
  const padding = mode === "preview"
    ? { top: 18, right: 68, bottom: 30, left: 54 }
    : { top: 26, right: 92, bottom: 42, left: 72 };
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

function bindMapPopupChartHover({ width, months, series, x }) {
  const svg = els.mapPopupChart.querySelector("svg");
  const hit = els.mapPopupChart.querySelector(".chart-hover-hit");
  const line = els.mapPopupChart.querySelector(".map-popup-hover-line");
  if (!svg || !hit || !line || !els.mapPopupTooltip || !months.length) return;

  hit.addEventListener("mousemove", (event) => {
    const month = nearestMonthFromEvent(event, svg, width, months, x);
    const xPos = x(month);
    line.setAttribute("x1", xPos);
    line.setAttribute("x2", xPos);
    line.hidden = false;

    const rows = series.map((item) => {
      const price = item.prices.find((entry) => entry.yearMonth === month);
      if (!price) return "";
      return `<span><i style="background:${item.color}"></i>${escapeHtml(item.label || "-")} ${formatKoreanPrice(price.saleMid)}</span>`;
    }).filter(Boolean).join("");

    showFloatingTooltip(els.mapPopupChart.parentElement, els.mapPopupTooltip, event, `
      <strong>${formatMonth(month)}</strong>
      ${rows || "<span>데이터 없음</span>"}
    `);
  });

  hit.addEventListener("mouseleave", () => {
    line.hidden = true;
    els.mapPopupTooltip.hidden = true;
  });
}

function zoomGroupPopup(item) {
  return `
    <strong>${escapeHtml(item.name)}</strong><br>
    아파트 ${formatInt(item.apartmentCount)}개 / 면적 ${formatInt(item.areaCount)}개<br>
    평균 상승액 ${formatMoney(item.growthAmount)}<br>
    평균 상승률 ${formatPercent(item.growthRate)}
  `;
}

function zoomLevelLabel(level) {
  return {
    sido: "시도",
    sigungu: "구/시군",
    dong: "동",
    apartment: "아파트"
  }[level] || "지역";
}

function shortZoomLabel(name, level) {
  if (level === "sido") return shortRegionLabel(name);
  return String(name || "").replace(/^.+\s([^\s]+)$/g, "$1");
}

function zoomMarkerSize() {
  return [72, 72];
}

function zoomMarkerAnchor() {
  const [width, height] = zoomMarkerSize();
  return [width / 2, height / 2];
}

function growthColor(rate) {
  if (!Number.isFinite(rate)) return "#667085";
  if (rate >= 1) return "#b42318";
  if (rate >= 0.5) return "#c24132";
  if (rate >= 0.2) return "#d97706";
  if (rate >= 0) return "#16805f";
  return "#2367d1";
}

function sortableRate(rate) {
  return Number.isFinite(rate) ? Number(rate) : -Infinity;
}

function rateClass(rate) {
  if (!Number.isFinite(rate)) return "no-data";
  return rate >= 0 ? "positive" : "negative";
}

function applyQuickPeriod(years) {
  if (!state.months.length) return;
  const end = state.months.at(-1);
  const endDate = parseMonth(end);
  const target = new Date(endDate);
  target.setFullYear(target.getFullYear() - years);
  els.endInput.value = toMonthInput(end);
  els.startInput.value = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
}

function setPeriodYears(years) {
  applyQuickPeriod(years);
  syncPeriodButtons(years);
}

function syncPeriodButtons(activeYears = currentPeriodYears()) {
  document.querySelectorAll("[data-period-years]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.periodYears) === activeYears);
  });
}

function currentPeriodYears() {
  if (!els.startInput.value || !els.endInput.value) return 1;
  const start = new Date(`${els.startInput.value}-01`);
  const end = new Date(`${els.endInput.value}-01`);
  const monthDiff = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
  if (monthDiff >= 54) return 5;
  if (monthDiff >= 30) return 3;
  return 1;
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
  els.apartmentCount.textContent = `${result.rows.length}개 아파트`;
  els.apartmentRows.innerHTML = result.rows.length
    ? result.rows.map((row) => `
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

  els.apartmentRows.querySelectorAll("[data-apartment-id]").forEach((row) => {
    row.addEventListener("click", () => loadApartmentDetail(row.dataset.apartmentId));
  });
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
  const rect = svg.getBoundingClientRect();
  const svgX = ((event.clientX - rect.left) / rect.width) * width;
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
}

function queryParams() {
  const params = new URLSearchParams();
  params.set("regionId", els.regionSelect.value);
  if (els.neighborhoodSelect.value) params.set("neighborhood", els.neighborhoodSelect.value);
  if (els.startInput.value) params.set("start", els.startInput.value.replace("-", ""));
  if (els.endInput.value) params.set("end", els.endInput.value.replace("-", ""));
  return params.toString();
}

async function api(path) {
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "API request failed");
  return data;
}

function selectedRegionName() {
  return state.regions.find((region) => region.id === els.regionSelect.value)?.name || "분당";
}

function parseMonth(value) {
  return new Date(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, 1);
}

function toMonthInput(value) {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}`;
}

function formatMonth(value) {
  return `${value.slice(2, 4)}.${value.slice(4, 6)}`;
}

function formatMonthRange(start, end) {
  if (!start || !end) return "-";
  return `${formatMonth(start)} - ${formatMonth(end)}`;
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return "-";
  return `${formatInt(value)}만`;
}

function formatKoreanPrice(value) {
  const amount = Number(value || 0);
  if (!amount) return "-";
  if (amount >= 10000) {
    const eok = Math.floor(amount / 10000);
    const rest = amount % 10000;
    return rest ? `${eok}억 ${formatInt(rest)}만` : `${eok}억`;
  }
  return `${formatInt(amount)}만`;
}

function formatInt(value) {
  return Math.round(Number(value || 0)).toLocaleString("ko-KR");
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "데이터없음";
  return `${(value * 100).toFixed(1)}%`;
}

function formatPercentValue(value) {
  if (!Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(2)}%`;
}

function formatSignedPercent(value) {
  if (!Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(2)}%`;
}

function formatDecimal(value, digits = 2) {
  if (!Number.isFinite(value)) return "-";
  return Number(value).toFixed(digits);
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatMapCacheLabel(cache) {
  if (!cache) return "";
  if (cache.hit === false) return "실시간 계산";
  if (!cache.updatedAt) return "";
  const updatedAt = new Date(cache.updatedAt);
  const today = new Date();
  const sameDay = updatedAt.getFullYear() === today.getFullYear()
    && updatedAt.getMonth() === today.getMonth()
    && updatedAt.getDate() === today.getDate();
  const time = updatedAt.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  });
  if (sameDay) return `오늘 ${time} 업데이트 기준`;
  return `${formatDateTime(cache.updatedAt)} 업데이트 기준`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
