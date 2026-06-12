const state = {
  regions: [],
  regionStats: [],
  months: [],
  neighborhoods: [],
  activeTab: "map",
  crawlStatusFilter: "failed",
  mapColorMode: "hover",
  mapLevel: "sido",
  selectedSidoCode: "",
  selectedSidoName: "",
  selectedSigunguCode: "",
  selectedSigunguName: "",
  clientConfig: { maps: { provider: "leaflet", naverKeyId: "" } },
  map: null,
  mapLayer: null,
  naverMap: null,
  naverOverlays: [],
  naverInfoWindow: null,
  naverSdkPromise: null,
  boundaryCache: new Map()
};

const colors = ["#2367d1", "#c24132", "#16805f", "#9a5b13", "#7c3aed", "#0f766e", "#b42318", "#475467"];
const homeSidoCodes = ["11", "41"];
const homeSidoColors = {
  11: "#2563eb",
  41: "#16a34a"
};
const homeMapView = {
  center: [37.48, 127.18],
  zoom: 9
};
const boundarySources = {
  sido: {
    url: "https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-provinces-2018-topo-simple.json",
    objectName: "skorea_provinces_2018_geo"
  },
  sigungu: {
    url: "https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-municipalities-2018-topo-simple.json",
    objectName: "skorea_municipalities_2018_geo"
  }
};

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
  crawlLogs: document.querySelector("#crawlLogs"),
  crawlView: document.querySelector("#crawlView"),
  crawlDetailSummary: document.querySelector("#crawlDetailSummary"),
  crawlStats: document.querySelector("#crawlStats"),
  crawlDetailRows: document.querySelector("#crawlDetailRows"),
  mapView: document.querySelector("#mapView"),
  mapTitle: document.querySelector("#mapTitle"),
  mapPeriod: document.querySelector("#mapPeriod"),
  mapBackBtn: document.querySelector("#mapBackBtn"),
  mapBreadcrumb: document.querySelector("#mapBreadcrumb"),
  growthMap: document.querySelector("#growthMap"),
  mapTableTitle: document.querySelector("#mapTableTitle"),
  mapCount: document.querySelector("#mapCount"),
  mapRows: document.querySelector("#mapRows"),
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
  els.startInput.addEventListener("change", refresh);
  els.endInput.addEventListener("change", refresh);
  els.syncBtn.addEventListener("click", syncCurrentRegion);
  els.mapBackBtn.addEventListener("click", drillMapUp);

  document.querySelectorAll("[data-map-color-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mapColorMode = button.dataset.mapColorMode;
      document.querySelectorAll("[data-map-color-mode]").forEach((item) => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-selected", String(active));
      });
      if (state.activeTab === "map") loadMapSummary();
    });
  });

  document.querySelectorAll(".quick-buttons button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".quick-buttons button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      applyQuickPeriod(Number(button.dataset.years));
      refresh();
    });
  });

  document.querySelectorAll(".tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = button.dataset.tab;
      document.querySelectorAll(".tabs button").forEach((item) => item.classList.toggle("active", item === button));
      document.querySelector("#neighborhoodView").classList.toggle("active", state.activeTab === "neighborhood");
      document.querySelector("#apartmentView").classList.toggle("active", state.activeTab === "apartment");
      document.querySelector("#crawlView").classList.toggle("active", state.activeTab === "crawl");
      document.querySelector("#mapView").classList.toggle("active", state.activeTab === "map");
      if (state.activeTab === "crawl") loadCrawlDetails();
      if (state.activeTab === "map") loadMapSummary();
    });
  });

  document.querySelectorAll("[data-crawl-status]").forEach((button) => {
    button.addEventListener("click", () => {
      state.crawlStatusFilter = button.dataset.crawlStatus;
      document.querySelectorAll("[data-crawl-status]").forEach((item) => item.classList.toggle("active", item === button));
      loadCrawlDetails();
    });
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
    const end = state.months.at(-1);
    const start = state.months[Math.max(0, state.months.length - 13)];
    if (!els.endInput.value) els.endInput.value = toMonthInput(end);
    if (!els.startInput.value) els.startInput.value = toMonthInput(start);
  }
}

async function refresh() {
  const status = await api("/api/status");
  renderCrawlStatus(status.crawl);
  const months = status.months || [];
  state.months = months;
  els.statusLine.textContent = status.counts.monthlyPrices
    ? `아파트 ${formatInt(status.counts.apartments)}개, 면적 ${formatInt(status.counts.areaTypes)}개, 월별 시세 ${formatInt(status.counts.monthlyPrices)}건. 최근 동기화: ${status.meta.syncedAt || "-"}`
    : "아직 수집된 데이터가 없습니다. 상단의 샘플 동기화 버튼을 눌러 시작하세요.";

  if (!status.counts.monthlyPrices) {
    renderEmpty();
    return;
  }

  const params = queryParams();
  const [neighborhoodRanking, chartData, apartmentRanking] = await Promise.all([
    api(`/api/neighborhood-rankings?${params}`),
    api(`/api/neighborhood-chart?${params}`),
    api(`/api/apartment-rankings?${params}`)
  ]);

  renderNeighborhoodTable(neighborhoodRanking);
  renderChart(chartData);
  renderApartmentTable(apartmentRanking);
  if (state.activeTab === "crawl") await loadCrawlDetails();
  if (state.activeTab === "map") await loadMapSummary();
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
  renderCrawlStatus(status.crawl);
  els.statusLine.textContent = status.counts.monthlyPrices
    ? `아파트 ${formatInt(status.counts.apartments)}개, 면적 ${formatInt(status.counts.areaTypes)}개, 월별 시세 ${formatInt(status.counts.monthlyPrices)}건. 최근 저장: ${status.meta.syncedAt || "-"}`
    : "아직 저장된 시세 데이터가 없습니다. 수집 작업을 등록하고 worker가 처리할 때까지 기다려주세요.";
  if (state.activeTab === "crawl") await loadCrawlDetails();
}

function renderCrawlStatus(crawl) {
  if (!crawl) {
    els.crawlSummary.textContent = "작업 없음";
    els.progressBar.style.width = "0%";
    els.progressText.textContent = "0%";
    els.currentComplex.textContent = "-";
    els.crawlCounts.textContent = "-";
    els.crawlDelay.textContent = "-";
    els.crawlLogs.innerHTML = "";
    return;
  }

  const job = crawl.job;
  const progress = crawl.progress || 0;
  els.crawlSummary.textContent = `#${job.id} ${job.regionId} / ${job.status}`;
  els.progressBar.style.width = `${progress}%`;
  els.progressText.textContent = `${progress}%`;
  els.currentComplex.textContent = job.currentComplexName || "-";
  els.crawlCounts.textContent = `${job.completedComplexes} / ${job.failedComplexes} / ${job.totalComplexes}`;
  els.crawlDelay.textContent = `${Math.round(job.delayMinMs / 1000)}-${Math.round(job.delayMaxMs / 1000)}초`;
  els.crawlLogs.innerHTML = (crawl.logs || []).map((log) => {
    const time = new Date(log.createdAt).toLocaleTimeString("ko-KR");
    return `<div>[${time}] ${escapeHtml(log.level)} ${escapeHtml(log.message)}</div>`;
  }).join("");
}

async function loadCrawlDetails() {
  const params = new URLSearchParams();
  params.set("limit", "200");
  if (state.crawlStatusFilter) params.set("status", state.crawlStatusFilter);
  const details = await api(`/api/crawl/details?${params}`);
  renderCrawlDetails(details);
}

function renderCrawlDetails(details) {
  const counts = details.queueCounts || {};
  const job = details.job;
  els.crawlDetailSummary.textContent = job
    ? `#${job.id} ${job.regionId} / ${job.status}`
    : "작업 없음";

  const statItems = [
    ["성공", counts.completed || 0, "completed"],
    ["실패", counts.failed || 0, "failed"],
    ["진행 중", counts.running || 0, "running"],
    ["대기", counts.pending || 0, "pending"]
  ];
  els.crawlStats.innerHTML = statItems.map(([label, value, status]) => `
    <button class="stat-card ${state.crawlStatusFilter === status ? "active" : ""}" data-crawl-status="${status}">
      <strong>${formatInt(value)}</strong>
      <span>${label}</span>
    </button>
  `).join("");
  els.crawlStats.querySelectorAll("[data-crawl-status]").forEach((button) => {
    button.addEventListener("click", () => {
      state.crawlStatusFilter = button.dataset.crawlStatus;
      document.querySelectorAll("[data-crawl-status]").forEach((item) => {
        item.classList.toggle("active", item.dataset.crawlStatus === state.crawlStatusFilter);
      });
      loadCrawlDetails();
    });
  });

  els.crawlDetailRows.innerHTML = details.rows.length
    ? details.rows.map((row) => `
      <tr>
        <td>${row.id}</td>
        <td><span class="status-pill ${escapeHtml(row.status)}">${statusLabel(row.status)}</span></td>
        <td>${escapeHtml(row.complexName || `#${row.sourceComplexId}`)}</td>
        <td>${escapeHtml(row.pyeong || "-")}</td>
        <td>${escapeHtml(formatMarkerPrice(row))}</td>
        <td>${formatInt(row.attempts)}</td>
        <td class="error-cell">${escapeHtml(row.errorMessage || "-")}</td>
        <td>${formatDateTime(row.updatedAt)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="8" class="empty">표시할 수집 항목이 없습니다.</td></tr>`;
}

function statusLabel(status) {
  return {
    completed: "성공",
    failed: "실패",
    running: "진행 중",
    pending: "대기"
  }[status] || status;
}

function formatMarkerPrice(row) {
  const parts = [];
  if (row.markerSaleAvg) parts.push(`매매 ${row.markerSaleAvg}`);
  if (row.markerPyeongPrice) parts.push(row.markerPyeongPrice);
  if (row.markerBaseDate) parts.push(row.markerBaseDate);
  return parts.join(" / ") || "-";
}

async function loadMapSummary() {
  const params = new URLSearchParams();
  params.set("level", state.mapLevel);
  if (state.mapLevel === "sido") params.set("sidoCodes", homeSidoCodes.join(","));
  if (state.selectedSidoCode) params.set("sidoCode", state.selectedSidoCode);
  if (state.selectedSigunguCode) params.set("sigunguCode", state.selectedSigunguCode);
  if (els.startInput.value) params.set("start", els.startInput.value.replace("-", ""));
  if (els.endInput.value) params.set("end", els.endInput.value.replace("-", ""));
  const data = await api(`/api/map-summary?${params}`);
  await renderMapSummary(data);
}

async function renderMapSummary(data) {
  els.mapPeriod.textContent = data.period?.startMonth && data.period?.endMonth
    ? `${formatMonth(data.period.startMonth)} - ${formatMonth(data.period.endMonth)}`
    : "";
  els.mapBackBtn.disabled = data.level === "sido";
  els.mapBreadcrumb.textContent = [
    state.mapLevel === "sido" ? "서울/경기" : "전국",
    state.selectedSidoName,
    state.selectedSigunguName
  ].filter(Boolean).join(" / ");
  els.mapTitle.textContent = {
    sido: "서울/경기 평균 상승률 지도",
    sigungu: `${state.selectedSidoName} 구별 평균 상승률`,
    apartment: `${state.selectedSigunguName} 아파트 상승률 지도`
  }[data.level] || "평균 상승률 지도";
  els.mapTableTitle.textContent = {
    sido: "서울/경기 평균 상승률",
    sigungu: "구별 평균 상승률",
    apartment: "아파트별 평균 상승률"
  }[data.level] || "평균 상승률";

  els.growthMap.dataset.level = data.level;

  if (useNaverMap()) {
    const rendered = await renderNaverMapSummary(data);
    if (rendered) return;
  }

  initGrowthMap();
  state.mapLayer.clearLayers();

  if (data.level === "apartment") {
    renderApartmentMap(data.apartments || []);
    renderMapApartmentRows(data.apartments || []);
  } else {
    await renderGroupMap(data.groups || [], data.level);
    renderMapGroupRows(data.groups || [], data.level);
  }
}

function useNaverMap() {
  return state.clientConfig?.maps?.provider === "naver" && state.clientConfig.maps.naverKeyId;
}

async function renderNaverMapSummary(data) {
  const ready = await initNaverGrowthMap();
  if (!ready) return false;

  clearNaverOverlays();
  if (data.level === "apartment") {
    renderNaverApartmentMap(data.apartments || []);
    renderMapApartmentRows(data.apartments || []);
  } else {
    await renderNaverGroupMap(data.groups || [], data.level);
    renderMapGroupRows(data.groups || [], data.level);
  }
  return true;
}

async function initNaverGrowthMap() {
  const loaded = await loadNaverSdk().catch(() => false);
  if (!loaded || !window.naver?.maps) {
    return false;
  }

  if (state.naverMap) {
    setTimeout(() => window.naver.maps.Event.trigger(state.naverMap, "resize"), 0);
    if (await hasNaverAuthFailure()) return fallbackFromNaverMap();
    return true;
  }

  state.naverMap = new window.naver.maps.Map(els.growthMap, {
    center: new window.naver.maps.LatLng(36.4, 127.8),
    zoom: 7,
    zoomControl: true,
    scaleControl: true,
    mapDataControl: false
  });
  setTimeout(() => window.naver.maps.Event.trigger(state.naverMap, "resize"), 0);
  if (await hasNaverAuthFailure()) return fallbackFromNaverMap();
  return true;
}

async function hasNaverAuthFailure() {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  return els.growthMap.textContent.includes("네이버 지도 Open API 인증이 실패");
}

function fallbackFromNaverMap() {
  clearNaverOverlays();
  state.naverMap = null;
  state.clientConfig.maps.provider = "leaflet";
  els.growthMap.innerHTML = "";
  return false;
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

function clearNaverOverlays() {
  for (const overlay of state.naverOverlays) {
    overlay.setMap(null);
  }
  state.naverOverlays = [];
  if (state.naverInfoWindow) state.naverInfoWindow.close();
}

async function renderNaverGroupMap(groups, level) {
  if (await renderNaverBoundaryGroupMap(groups, level)) return;

  const positions = [];
  for (const group of groups) {
    if (!Number.isFinite(group.lat) || !Number.isFinite(group.lng)) continue;
    const position = new window.naver.maps.LatLng(group.lat, group.lng);
    positions.push(position);
    const marker = new window.naver.maps.Marker({
      position,
      map: state.naverMap,
      icon: naverLabelIcon(`
        <div class="naver-map-marker" style="--marker-color:${growthColor(group.growthRate)}">
          <strong>${escapeHtml(shortRegionLabel(group.name))}</strong>
          <span>${formatPercent(group.growthRate)}</span>
        </div>
      `, 92, 48)
    });
    window.naver.maps.Event.addListener(marker, "click", () => {
      openNaverInfoWindow(position, mapGroupPopup(group));
      drillMapDown(group, level);
    });
    state.naverOverlays.push(marker);
  }
  if (level === "sido") {
    focusNaverHomeMap();
  } else {
    fitNaverPositions(positions, 11);
  }
}

async function renderNaverBoundaryGroupMap(groups, level) {
  if (!["sido", "sigungu"].includes(level) || !window.topojson) return false;

  const geoJson = await loadBoundaryGeoJson(level).catch(() => null);
  if (!geoJson?.features?.length) return false;

  const groupLookup = buildBoundaryGroupLookup(groups, level);
  const features = geoJson.features.filter((feature) => {
    if (level === "sido") return Boolean(findBoundaryGroup(feature, groupLookup, level));
    return featureBoundarySidoCode(feature) === state.selectedSidoCode || Boolean(findBoundaryGroup(feature, groupLookup, level));
  });
  if (!features.length) return false;

  const boundsPositions = [];
  const labelPositions = [];
  for (const feature of features) {
    const group = findBoundaryGroup(feature, groupLookup, level);
    boundsPositions.push(...featurePositions(feature));
    const polygons = createNaverFeaturePolygons(feature, group);
    const setHovered = (hovered) => {
      polygons.forEach((polygon) => {
        polygon.setOptions(hovered ? naverBoundaryHoverStyle(group) : naverBoundaryStyle(group));
      });
    };
    for (const polygon of polygons) {
      window.naver.maps.Event.addListener(polygon, "mouseover", () => setHovered(true));
      window.naver.maps.Event.addListener(polygon, "mouseout", () => setHovered(false));
      if (group) {
        window.naver.maps.Event.addListener(polygon, "click", () => {
          const center = boundaryLabelCenter(feature, group);
          if (center) openNaverInfoWindow(new window.naver.maps.LatLng(center[0], center[1]), mapGroupPopup(group));
          drillMapDown(group, level);
        });
      }
      state.naverOverlays.push(polygon);
    }

    if (!group) continue;
    const center = boundaryLabelCenter(feature, group);
    if (!center) continue;
    labelPositions.push(center);
    const label = new window.naver.maps.Marker({
      position: new window.naver.maps.LatLng(center[0], center[1]),
      map: state.naverMap,
      clickable: true,
      icon: naverLabelIcon(`
        <div class="boundary-label naver-boundary-label">
          <strong>${escapeHtml(shortRegionLabel(group.name))}</strong>
          <span>${formatPercent(group.growthRate)}</span>
        </div>
      `, 92, 42)
    });
    window.naver.maps.Event.addListener(label, "mouseover", () => setHovered(true));
    window.naver.maps.Event.addListener(label, "mouseout", () => setHovered(false));
    window.naver.maps.Event.addListener(label, "click", () => drillMapDown(group, level));
    state.naverOverlays.push(label);
  }

  if (level === "sido") {
    focusNaverHomeMap();
  } else {
    fitNaverPositions(toNaverLatLngs(labelPositions.length ? labelPositions : boundsPositions), 11);
  }
  return true;
}

function toNaverLatLngs(positions) {
  return positions
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))
    .map(([lat, lng]) => new window.naver.maps.LatLng(lat, lng));
}

function createNaverFeaturePolygons(feature, group) {
  const geometry = feature.geometry || {};
  const polygons = geometry.type === "Polygon"
    ? [geometry.coordinates]
    : geometry.type === "MultiPolygon"
      ? geometry.coordinates
      : [];

  return polygons.map((rings) => new window.naver.maps.Polygon({
    map: state.naverMap,
    paths: rings.map((ring) => ring
      .filter((coord) => Number.isFinite(coord[0]) && Number.isFinite(coord[1]))
      .map((coord) => new window.naver.maps.LatLng(coord[1], coord[0]))),
    ...naverBoundaryStyle(group)
  }));
}

function naverBoundaryStyle(group) {
  const style = mapBoundaryStyle(group);
  return {
    strokeColor: style.color,
    strokeOpacity: 1,
    strokeWeight: style.weight,
    fillColor: style.fillColor,
    fillOpacity: style.fillOpacity,
    clickable: Boolean(group)
  };
}

function naverBoundaryHoverStyle(group) {
  const style = mapBoundaryStyle(group, true);
  return {
    strokeColor: style.color,
    strokeOpacity: 1,
    strokeWeight: style.weight,
    fillColor: style.fillColor,
    fillOpacity: style.fillOpacity,
    clickable: Boolean(group)
  };
}

function renderNaverApartmentMap(apartments) {
  const positions = [];
  for (const apartment of apartments) {
    if (!Number.isFinite(apartment.lat) || !Number.isFinite(apartment.lng)) continue;
    const position = new window.naver.maps.LatLng(apartment.lat, apartment.lng);
    positions.push(position);
    const marker = new window.naver.maps.Marker({
      position,
      map: state.naverMap,
      icon: naverLabelIcon(`
        <div class="apartment-map-marker" style="--marker-color:${growthColor(apartment.growthRate)}">
          <span>${formatPercent(apartment.growthRate)}</span>
        </div>
      `, 54, 34)
    });
    window.naver.maps.Event.addListener(marker, "click", () => {
      openNaverInfoWindow(position, `
        <strong>${escapeHtml(apartment.name)}</strong><br>
        ${escapeHtml(apartment.neighborhoodName || "-")} / ${escapeHtml(apartment.areaSummary || "-")}<br>
        ${formatMoney(apartment.startPyeongPrice)} → ${formatMoney(apartment.endPyeongPrice)}<br>
        상승률 ${formatPercent(apartment.growthRate)}
      `);
    });
    state.naverOverlays.push(marker);
  }
  fitNaverPositions(positions, 13);
}

function naverLabelIcon(content, width, height) {
  return {
    content,
    size: new window.naver.maps.Size(width, height),
    anchor: new window.naver.maps.Point(width / 2, height / 2)
  };
}

function openNaverInfoWindow(position, html) {
  if (!state.naverInfoWindow) {
    state.naverInfoWindow = new window.naver.maps.InfoWindow({
      borderWidth: 0,
      backgroundColor: "transparent",
      disableAnchor: false
    });
  }
  state.naverInfoWindow.setContent(`<div class="naver-info-window">${html}</div>`);
  state.naverInfoWindow.open(state.naverMap, position);
}

function fitNaverPositions(positions, maxZoom) {
  if (!state.naverMap || !positions.length) {
    state.naverMap?.setCenter(new window.naver.maps.LatLng(36.4, 127.8));
    state.naverMap?.setZoom(7);
    return;
  }

  const bounds = positions.reduce((current, position) => {
    if (!current) return new window.naver.maps.LatLngBounds(position, position);
    current.extend(position);
    return current;
  }, null);

  state.naverMap.fitBounds(bounds);
  setTimeout(() => {
    if (state.naverMap.getZoom() > maxZoom) state.naverMap.setZoom(maxZoom);
  }, 0);
}

function focusNaverHomeMap() {
  if (!state.naverMap) return;
  setTimeout(() => {
    window.naver.maps.Event.trigger(state.naverMap, "resize");
    state.naverMap.setCenter(new window.naver.maps.LatLng(homeMapView.center[0], homeMapView.center[1]));
    state.naverMap.setZoom(homeMapView.zoom);
  }, 0);
}

function initGrowthMap() {
  if (!window.L) {
    els.growthMap.innerHTML = `<div class="empty">지도 라이브러리를 불러오지 못했습니다.</div>`;
    return;
  }

  if (state.map) {
    setTimeout(() => state.map.invalidateSize(), 0);
    return;
  }

  state.map = L.map(els.growthMap, {
    scrollWheelZoom: false
  }).setView([36.4, 127.8], 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(state.map);
  state.mapLayer = L.layerGroup().addTo(state.map);
}

async function renderGroupMap(groups, level) {
  if (!state.map || !state.mapLayer) return;
  if (await renderBoundaryGroupMap(groups, level)) return;

  const bounds = [];
  for (const group of groups) {
    if (!Number.isFinite(group.lat) || !Number.isFinite(group.lng)) continue;
    bounds.push([group.lat, group.lng]);
    const marker = L.circleMarker([group.lat, group.lng], {
      radius: markerRadius(group.apartmentCount),
      color: growthColor(group.growthRate),
      fillColor: growthColor(group.growthRate),
      fillOpacity: 0.72,
      weight: 2
    }).addTo(state.mapLayer);
    marker.bindTooltip(`${group.name} ${formatPercent(group.growthRate)}`, {
      direction: "top",
      sticky: true
    });
    marker.bindPopup(mapGroupPopup(group));
    marker.on("click", () => drillMapDown(group, level));
  }
  fitMapBounds(bounds, level === "sido" ? 7 : 11);
}

async function renderBoundaryGroupMap(groups, level) {
  if (!["sido", "sigungu"].includes(level) || !window.topojson) return false;

  const geoJson = await loadBoundaryGeoJson(level).catch(() => null);
  if (!geoJson?.features?.length) return false;

  const groupLookup = buildBoundaryGroupLookup(groups, level);
  const features = geoJson.features.filter((feature) => {
    if (level === "sido") return Boolean(findBoundaryGroup(feature, groupLookup, level));
    return featureBoundarySidoCode(feature) === state.selectedSidoCode || Boolean(findBoundaryGroup(feature, groupLookup, level));
  });
  if (!features.length) return false;

  const boundaryLayer = L.geoJSON({ type: "FeatureCollection", features }, {
    style: (feature) => boundaryStyle(findBoundaryGroup(feature, groupLookup, level)),
    onEachFeature: (feature, layer) => {
      const group = findBoundaryGroup(feature, groupLookup, level);
      if (!group) {
        layer.bindTooltip(featureName(feature), { direction: "center", permanent: false });
        return;
      }

      layer.bindPopup(mapGroupPopup(group));
      layer.on({
        mouseover: () => {
          layer.setStyle(boundaryHoverStyle(group));
          layer.bringToFront();
        },
        mouseout: () => {
          layer.setStyle(boundaryStyle(group));
        },
        click: () => drillMapDown(group, level)
      });
    }
  }).addTo(state.mapLayer);

  for (const feature of features) {
    const group = findBoundaryGroup(feature, groupLookup, level);
    if (!group) continue;
    const center = boundaryLabelCenter(feature, group);
    if (!center) continue;
    const targetLayer = Object.values(boundaryLayer._layers || {}).find((layer) => {
      return findBoundaryGroup(layer.feature, groupLookup, level)?.code === group.code;
    });
    const setHovered = (hovered) => {
      if (!targetLayer) return;
      targetLayer.setStyle(hovered ? boundaryHoverStyle(group) : boundaryStyle(group));
      if (hovered) targetLayer.bringToFront();
    };
    const label = L.marker(center, {
      interactive: true,
      icon: L.divIcon({
        className: "boundary-label",
        html: `<strong>${escapeHtml(shortRegionLabel(group.name))}</strong><span>${formatPercent(group.growthRate)}</span>`,
        iconSize: [92, 42],
        iconAnchor: [46, 21]
      })
    }).addTo(state.mapLayer);
    label.on({
      mouseover: () => setHovered(true),
      mouseout: () => setHovered(false),
      click: () => drillMapDown(group, level)
    });
  }

  fitBoundaryLayer(boundaryLayer, level, groups);
  return true;
}

function fitBoundaryLayer(boundaryLayer, level, groups = []) {
  const bounds = boundaryLayer.getBounds();
  if (!bounds.isValid()) return;

  if (level === "sido") {
    setTimeout(() => {
      state.map.invalidateSize();
      state.map.setView(homeMapView.center, homeMapView.zoom, { animate: true });
    }, 0);
    return;
  }

  const groupPositions = groups
    .filter((group) => Number.isFinite(group.lat) && Number.isFinite(group.lng))
    .map((group) => [group.lat, group.lng]);
  if (level === "sigungu" && groupPositions.length) {
    fitMapBounds(groupPositions, 11);
    return;
  }

  const options = {
    animate: true,
    duration: 0.45,
    padding: [4, 4],
    maxZoom: 10
  };

  setTimeout(() => {
    state.map.invalidateSize();
    state.map.flyToBounds(bounds, options);
  }, 0);
}

function renderApartmentMap(apartments) {
  if (!state.map || !state.mapLayer) return;
  const bounds = [];
  for (const apartment of apartments) {
    if (!Number.isFinite(apartment.lat) || !Number.isFinite(apartment.lng)) continue;
    bounds.push([apartment.lat, apartment.lng]);
    const marker = L.circleMarker([apartment.lat, apartment.lng], {
      radius: 8,
      color: growthColor(apartment.growthRate),
      fillColor: growthColor(apartment.growthRate),
      fillOpacity: 0.78,
      weight: 2
    }).addTo(state.mapLayer);
    marker.bindTooltip(`${apartment.name} ${formatPercent(apartment.growthRate)}`, {
      direction: "top",
      sticky: true
    });
    marker.bindPopup(`
      <strong>${escapeHtml(apartment.name)}</strong><br>
      ${escapeHtml(apartment.neighborhoodName || "-")} / ${escapeHtml(apartment.areaSummary || "-")}<br>
      ${formatMoney(apartment.startPyeongPrice)} → ${formatMoney(apartment.endPyeongPrice)}<br>
      상승률 ${formatPercent(apartment.growthRate)}
    `);
  }
  fitMapBounds(bounds, 13);
}

async function loadBoundaryGeoJson(level) {
  if (state.boundaryCache.has(level)) return state.boundaryCache.get(level);
  const source = boundarySources[level];
  const topology = await fetch(source.url).then((response) => {
    if (!response.ok) throw new Error("boundary load failed");
    return response.json();
  });
  const geoJson = topojson.feature(topology, topology.objects[source.objectName]);
  state.boundaryCache.set(level, geoJson);
  return geoJson;
}

function buildBoundaryGroupLookup(groups, level) {
  const lookup = new Map();
  for (const group of groups) {
    lookup.set(`code:${group.code}`, group);
    lookup.set(`name:${normalizeBoundaryName(group.name)}`, group);
    lookup.set(`name:${normalizeBoundaryName(shortRegionLabel(group.name))}`, group);
    if (level === "sido") lookup.set(`kostat:${legalSidoToKostatCode(group.code)}`, group);
  }
  return lookup;
}

function findBoundaryGroup(feature, lookup, level) {
  const code = featureCode(feature);
  const name = normalizeBoundaryName(featureName(feature));
  if (lookup.has(`code:${code}`)) return lookup.get(`code:${code}`);
  if (lookup.has(`name:${name}`)) return lookup.get(`name:${name}`);
  if (level === "sido" && lookup.has(`kostat:${code}`)) return lookup.get(`kostat:${code}`);

  const candidates = new Map();
  for (const [key, group] of lookup) {
    if (!key.startsWith("name:")) continue;
    const candidate = key.slice(5);
    if (candidate.length >= 2 && name.length >= 2 && (candidate.includes(name) || name.includes(candidate))) {
      candidates.set(group.code, group);
    }
  }
  const matches = [...candidates.values()];
  if (matches.length > 1) return combineBoundaryGroups(featureName(feature), matches);
  if (matches.length === 1) return matches[0];
  return null;
}

function combineBoundaryGroups(name, groups) {
  const totalAreaCount = groups.reduce((sum, group) => sum + group.areaCount, 0) || groups.length;
  const weightedAverage = (key) => groups.reduce((sum, group) => {
    const weight = group.areaCount || 1;
    return sum + Number(group[key] || 0) * weight;
  }, 0) / totalAreaCount;

  return {
    code: commonPrefix(groups.map((group) => group.code)),
    name: shortRegionLabel(name),
    lat: weightedAverage("lat"),
    lng: weightedAverage("lng"),
    apartmentCount: groups.reduce((sum, group) => sum + group.apartmentCount, 0),
    areaCount: groups.reduce((sum, group) => sum + group.areaCount, 0),
    growthRate: weightedAverage("growthRate"),
    growthAmount: Math.round(weightedAverage("growthAmount"))
  };
}

function commonPrefix(values) {
  if (!values.length) return "";
  let prefix = String(values[0] || "");
  for (const value of values.slice(1)) {
    while (prefix && !String(value || "").startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
    }
  }
  return prefix;
}

function boundaryStyle(group) {
  return {
    ...mapBoundaryStyle(group),
    opacity: 1,
    dashArray: group ? "" : "4"
  };
}

function boundaryHoverStyle(group) {
  return {
    ...mapBoundaryStyle(group, true),
    opacity: 1,
    dashArray: ""
  };
}

function mapBoundaryStyle(group, hovered = false) {
  if (!group) {
    return {
      color: "#cbd5e1",
      fillColor: "#e4e7ec",
      fillOpacity: 0.24,
      weight: 1
    };
  }

  if (state.mapColorMode === "hover" && ["sido", "sigungu"].includes(state.mapLevel)) {
    return {
      color: hovered ? "#1d2939" : "#ffffff",
      fillColor: hovered ? regionFillColor(group) : "#c5d2e3",
      fillOpacity: hovered ? 0.86 : 0.52,
      weight: hovered ? 3 : 1.5
    };
  }

  if (state.mapLevel === "sido" && state.mapColorMode === "distinct") {
    return {
      color: hovered ? "#1d2939" : "#ffffff",
      fillColor: homeSidoColor(group),
      fillOpacity: hovered ? 0.82 : 0.68,
      weight: hovered ? 3 : 1.5
    };
  }

  return {
    color: hovered ? "#1d2939" : "#ffffff",
    fillColor: growthColor(group.growthRate),
    fillOpacity: hovered ? 0.78 : 0.64,
    weight: hovered ? 3 : 1.5
  };
}

function homeSidoColor(group) {
  return homeSidoColors[group?.code] || growthColor(group?.growthRate);
}

function regionFillColor(group) {
  if (state.mapLevel === "sido") return homeSidoColor(group);
  return growthColor(group?.growthRate);
}

function featureCode(feature) {
  return String(feature.properties?.code || feature.properties?.SIG_CD || feature.properties?.CTPRVN_CD || "");
}

function featureName(feature) {
  return String(feature.properties?.name || feature.properties?.SIG_KOR_NM || feature.properties?.CTP_KOR_NM || "");
}

function featureBoundarySidoCode(feature) {
  return kostatSidoToLegalCode(featureCode(feature).slice(0, 2));
}

function legalSidoToKostatCode(code) {
  return {
    11: "11",
    26: "21",
    27: "22",
    28: "23",
    29: "24",
    30: "25",
    31: "26",
    36: "29",
    41: "31",
    42: "32",
    43: "33",
    44: "34",
    45: "35",
    46: "36",
    47: "37",
    48: "38",
    50: "39"
  }[code] || code;
}

function kostatSidoToLegalCode(code) {
  return {
    11: "11",
    21: "26",
    22: "27",
    23: "28",
    24: "29",
    25: "30",
    26: "31",
    29: "36",
    31: "41",
    32: "42",
    33: "43",
    34: "44",
    35: "45",
    36: "46",
    37: "47",
    38: "48",
    39: "50"
  }[code] || code;
}

function normalizeBoundaryName(value) {
  const name = String(value || "")
    .replace(/\s/g, "")
    .replace(/특별자치시|특별자치도|특별시|광역시|자치시|자치도/g, "")
    .replace(/(시|도|군|구)$/g, "");
  return name.startsWith("시") ? name : name.replace(/시(?=.+$)/g, "");
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

function boundaryLabelCenter(feature, group = null) {
  if (Number.isFinite(group?.lat) && Number.isFinite(group?.lng)) {
    return [group.lat, group.lng];
  }
  const positions = featurePositions(feature);
  if (!positions.length) return null;
  const lats = positions.map((position) => position[0]);
  const lngs = positions.map((position) => position[1]);
  return [
    (Math.min(...lats) + Math.max(...lats)) / 2,
    (Math.min(...lngs) + Math.max(...lngs)) / 2
  ];
}

function featurePositions(feature) {
  const positions = [];
  collectFeaturePositions(feature.geometry?.coordinates, positions);
  return positions;
}

function collectFeaturePositions(value, positions) {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1])) {
    positions.push([value[1], value[0]]);
    return;
  }
  for (const item of value) {
    collectFeaturePositions(item, positions);
  }
}

function drillMapDown(group, level) {
  if (level === "sido") {
    state.mapLevel = "sigungu";
    state.selectedSidoCode = group.code;
    state.selectedSidoName = group.name;
    state.selectedSigunguCode = "";
    state.selectedSigunguName = "";
  } else {
    state.mapLevel = "apartment";
    state.selectedSigunguCode = group.code;
    state.selectedSigunguName = group.name;
  }
  loadMapSummary();
}

function fitMapBounds(bounds, fallbackZoom) {
  if (!state.map) return;
  if (bounds.length) {
    state.map.fitBounds(bounds, { padding: [28, 28], maxZoom: fallbackZoom });
  } else {
    state.map.setView([36.4, 127.8], 7);
  }
}

function renderMapGroupRows(groups, level) {
  els.mapCount.textContent = `${groups.length}개 지역`;
  els.mapRows.innerHTML = groups.length
    ? groups.map((group, index) => `
      <tr class="clickable-row" data-map-code="${escapeHtml(group.code)}" data-map-name="${escapeHtml(group.name)}">
        <td>${index + 1}</td>
        <td>${escapeHtml(group.name)}</td>
        <td>${formatInt(group.apartmentCount)}</td>
        <td>${formatInt(group.areaCount)}</td>
        <td class="${group.growthAmount >= 0 ? "positive" : "negative"}">${formatMoney(group.growthAmount)}</td>
        <td class="${group.growthRate >= 0 ? "positive" : "negative"}">${formatPercent(group.growthRate)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="6" class="empty">표시할 지역 데이터가 없습니다.</td></tr>`;

  els.mapRows.querySelectorAll("[data-map-code]").forEach((row) => {
    row.addEventListener("click", () => {
      if (level === "sido") {
        state.mapLevel = "sigungu";
        state.selectedSidoCode = row.dataset.mapCode;
        state.selectedSidoName = row.dataset.mapName;
        state.selectedSigunguCode = "";
        state.selectedSigunguName = "";
      } else {
        state.mapLevel = "apartment";
        state.selectedSigunguCode = row.dataset.mapCode;
        state.selectedSigunguName = row.dataset.mapName;
      }
      loadMapSummary();
    });
  });
}

function renderMapApartmentRows(apartments) {
  els.mapCount.textContent = `${apartments.length}개 아파트`;
  els.mapRows.innerHTML = apartments.length
    ? apartments.map((apartment, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(apartment.name)}</td>
        <td>${formatInt(1)}</td>
        <td>${formatInt(apartment.areaCount)}</td>
        <td class="${apartment.growthAmount >= 0 ? "positive" : "negative"}">${formatMoney(apartment.growthAmount)}</td>
        <td class="${apartment.growthRate >= 0 ? "positive" : "negative"}">${formatPercent(apartment.growthRate)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="6" class="empty">표시할 아파트 데이터가 없습니다.</td></tr>`;
}

function drillMapUp() {
  if (state.mapLevel === "apartment") {
    state.mapLevel = "sigungu";
    state.selectedSigunguCode = "";
    state.selectedSigunguName = "";
  } else if (state.mapLevel === "sigungu") {
    state.mapLevel = "sido";
    state.selectedSidoCode = "";
    state.selectedSidoName = "";
  }
  loadMapSummary();
}

function mapGroupPopup(group) {
  return `
    <strong>${escapeHtml(group.name)}</strong><br>
    아파트 ${formatInt(group.apartmentCount)}개 / 면적 ${formatInt(group.areaCount)}개<br>
    평균 상승액 ${formatMoney(group.growthAmount)}<br>
    평균 상승률 ${formatPercent(group.growthRate)}
  `;
}

function markerRadius(count) {
  return Math.max(9, Math.min(26, 7 + Math.sqrt(Number(count || 0)) * 2.4));
}

function growthColor(rate) {
  if (rate >= 1) return "#b42318";
  if (rate >= 0.5) return "#c24132";
  if (rate >= 0.2) return "#d97706";
  if (rate >= 0) return "#16805f";
  return "#2367d1";
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
  return `${(value * 100).toFixed(1)}%`;
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

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
