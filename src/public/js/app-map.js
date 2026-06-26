function useNaverMap() {
  return state.clientConfig?.maps?.provider === "naver" && state.clientConfig.maps.naverKeyId;
}

const mobileMapControlsQuery = "(max-width: 820px)";
const markerHoverWindowMarginPx = 12;
const markerHoverWindowOffsetPx = 12;
const mapRankingTargetLevels = ["sido", "sigungu", "dong", "apartment"];
const progressiveMarkerThreshold = 500;
const progressiveMarkerInitialDesktop = 260;
const progressiveMarkerInitialMobile = 180;
const progressiveMarkerBatchDesktop = 180;
const progressiveMarkerBatchMobile = 100;

function isMobileMapControlsViewport() {
  if (window.matchMedia) return window.matchMedia(mobileMapControlsQuery).matches;
  return window.innerWidth <= 820;
}

function shouldShowNaverZoomControl() {
  return !isMobileMapControlsViewport();
}

function syncNaverZoomControl() {
  if (!state.zoomNaverMap || typeof state.zoomNaverMap.setOptions !== "function") return;
  state.zoomNaverMap.setOptions("zoomControl", shouldShowNaverZoomControl());
}

function bindNaverZoomControlSync() {
  if (state.naverZoomControlSyncBound) return;
  state.naverZoomControlSyncBound = true;
  const mediaQuery = window.matchMedia?.(mobileMapControlsQuery);
  if (mediaQuery?.addEventListener) {
    mediaQuery.addEventListener("change", syncNaverZoomControl);
    return;
  }
  if (mediaQuery?.addListener) {
    mediaQuery.addListener(syncNaverZoomControl);
    return;
  }
  window.addEventListener("resize", syncNaverZoomControl);
}

async function hasNaverAuthFailure(container = els.zoomMap) {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  return container.textContent.includes("네이버 지도 Open API 인증이 실패");
}

function watchNaverAuthFailure(container = els.zoomMap) {
  if (state.naverAuthFailureWatch) return;
  const watchedMap = state.zoomNaverMap;
  state.naverAuthFailureWatch = hasNaverAuthFailure(container)
    .then((failed) => {
      state.naverAuthFailureWatch = null;
      if (!failed || !watchedMap || state.zoomNaverMap !== watchedMap) return;
      fallbackFromNaverZoomMap();
      if (isMapTab()) loadZoomMapSummary();
    })
    .catch(() => {
      state.naverAuthFailureWatch = null;
    });
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

function naverLabelIcon(content, width, height, anchor = [width / 2, height / 2]) {
  return {
    content,
    size: new window.naver.maps.Size(width, height),
    anchor: new window.naver.maps.Point(anchor[0], anchor[1])
  };
}

function openZoomNaverInfoWindow(position, html, { pinned = false, disableAutoPan = !pinned } = {}) {
  cancelZoomNaverInfoWindowClose();
  state.zoomNaverInfoWindowPinned = Boolean(pinned);
  if (!state.zoomNaverInfoWindow) {
    state.zoomNaverInfoWindow = new window.naver.maps.InfoWindow({
      borderWidth: 0,
      backgroundColor: "transparent",
      disableAnchor: false,
      disableAutoPan
    });
  }
  state.zoomNaverInfoWindow.setOptions({ disableAutoPan });
  state.zoomNaverInfoWindow.setContent(`<div class="naver-info-window">${html}</div>`);
  state.zoomNaverInfoWindow.open(state.zoomNaverMap, position);
}

function openZoomNaverHoverWindow(position, html, options = {}) {
  const pointerAnchor = naverHoverWindowPointerAnchorPoint(options.event) || recentZoomMapPointerAnchorPoint();
  if (pointerAnchor) {
    if (state.zoomNaverInfoWindow && !state.zoomNaverInfoWindowPinned) {
      state.zoomNaverInfoWindow.close();
    }
    openZoomMarkerHoverWindow(html, markerHoverRectFromPointerPoint(pointerAnchor));
    return;
  }

  const anchor = naverHoverWindowAnchorPoint(position);
  if (!anchor) {
    openZoomNaverInfoWindow(position, html, { disableAutoPan: true });
    return;
  }
  if (state.zoomNaverInfoWindow && !state.zoomNaverInfoWindowPinned) {
    state.zoomNaverInfoWindow.close();
  }
  openZoomMarkerHoverWindow(html, markerHoverRectFromAnchorPoint(anchor, options.size, options.anchor));
}

function openLeafletMarkerHoverWindow(marker, html) {
  const markerRect = leafletMarkerHoverRect(marker);
  if (!markerRect) return;
  openZoomMarkerHoverWindow(html, markerRect);
}

function openZoomMarkerHoverWindow(html, markerRect) {
  cancelZoomNaverHoverWindowClose();
  const hoverWindow = ensureZoomNaverHoverWindow();
  hoverWindow.innerHTML = `<div class="naver-info-window">${html}</div>`;
  hoverWindow.hidden = false;
  hoverWindow.style.left = "0px";
  hoverWindow.style.top = "0px";
  hoverWindow.style.maxWidth = "";
  hoverWindow.dataset.placement = "top";

  const bounds = zoomMarkerHoverBounds();
  if (bounds) {
    hoverWindow.style.maxWidth = `${Math.max(160, Math.floor(bounds.right - bounds.left))}px`;
  }
  const hoverRect = hoverWindow.getBoundingClientRect();
  const width = Math.ceil(hoverRect.width);
  const height = Math.ceil(hoverRect.height);
  const placement = zoomMarkerHoverPlacement(markerRect, width, height);
  hoverWindow.dataset.placement = placement.placement;

  hoverWindow.style.left = `${Math.round(placement.left)}px`;
  hoverWindow.style.top = `${Math.round(placement.top)}px`;
}

function ensureZoomNaverHoverWindow() {
  if (state.zoomNaverHoverWindow?.isConnected) return state.zoomNaverHoverWindow;
  const hoverWindow = document.createElement("div");
  hoverWindow.className = "naver-hover-info-window";
  hoverWindow.hidden = true;
  els.mapCanvasWrap.appendChild(hoverWindow);
  state.zoomNaverHoverWindow = hoverWindow;
  return hoverWindow;
}

function naverHoverWindowAnchorPoint(position) {
  const map = state.zoomNaverMap;
  const projection = map?.getProjection?.();
  if (!projection?.fromCoordToOffset || !els.zoomMap || !els.mapCanvasWrap) return null;
  const offset = projection.fromCoordToOffset(position);
  if (!offset || !Number.isFinite(Number(offset.x)) || !Number.isFinite(Number(offset.y))) return null;
  const mapRect = els.zoomMap.getBoundingClientRect();
  const wrapRect = els.mapCanvasWrap.getBoundingClientRect();
  return {
    x: Number(offset.x) + mapRect.left - wrapRect.left,
    y: Number(offset.y) + mapRect.top - wrapRect.top
  };
}

function bindZoomMapPointerTracking() {
  if (state.zoomMapPointerTrackingBound || !els.mapCanvasWrap) return;
  state.zoomMapPointerTrackingBound = true;
  const updatePointer = (event) => {
    updateZoomMapPointerFromEvent(event);
  };
  els.mapCanvasWrap.addEventListener("pointermove", updatePointer, { capture: true, passive: true });
  els.mapCanvasWrap.addEventListener("mousemove", updatePointer, { capture: true, passive: true });
}

function updateZoomMapPointerFromEvent(event) {
  const pointer = zoomMapClientPointFromEvent(event);
  if (!pointer) return null;
  if (event?.target?.closest?.("#mapApartmentRanking") || isClientPointInsideVisibleMapRanking(pointer.clientX, pointer.clientY)) {
    state.zoomMapLastPointer = null;
    return null;
  }
  state.zoomMapLastPointer = {
    clientX: pointer.clientX,
    clientY: pointer.clientY,
    time: Date.now()
  };
  return state.zoomMapLastPointer;
}

function zoomMapClientPointFromEvent(event) {
  const source = event?.domEvent || event?.pointerEvent || event?.originalEvent || event?.event || event;
  const clientX = Number(source?.clientX);
  const clientY = Number(source?.clientY);
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
  return { clientX, clientY };
}

function naverHoverWindowPointerAnchorPoint(event) {
  const pointer = updateZoomMapPointerFromEvent(event);
  return pointer ? zoomMapPointerAnchorPoint(pointer) : null;
}

function recentZoomMapPointerAnchorPoint(maxAgeMs = 600) {
  const pointer = state.zoomMapLastPointer;
  if (!pointer || Date.now() - Number(pointer.time || 0) > maxAgeMs) return null;
  return zoomMapPointerAnchorPoint(pointer);
}

function zoomMapPointerAnchorPoint(pointer) {
  if (!pointer || !els.mapCanvasWrap || !els.zoomMap) return null;
  const mapRect = els.zoomMap.getBoundingClientRect();
  const wrapRect = els.mapCanvasWrap.getBoundingClientRect();
  const clientX = Number(pointer.clientX);
  const clientY = Number(pointer.clientY);
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
  if (isClientPointInsideVisibleMapRanking(clientX, clientY)) return null;
  if (clientX < mapRect.left || clientX > mapRect.right || clientY < mapRect.top || clientY > mapRect.bottom) return null;
  return {
    x: clientX - wrapRect.left,
    y: clientY - wrapRect.top
  };
}

function isClientPointInsideVisibleMapRanking(clientX, clientY) {
  const ranking = els.mapApartmentRanking;
  if (!ranking || ranking.hidden) return false;
  const style = window.getComputedStyle(ranking);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = ranking.getBoundingClientRect();
  if (rect.width <= 1 || rect.height <= 1) return false;
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function markerHoverRectFromAnchorPoint(point, size = null, anchor = null) {
  const width = Math.max(1, Number(size?.[0]) || 1);
  const height = Math.max(1, Number(size?.[1]) || 1);
  const anchorX = Number.isFinite(Number(anchor?.[0])) ? Number(anchor[0]) : width / 2;
  const anchorY = Number.isFinite(Number(anchor?.[1])) ? Number(anchor[1]) : height / 2;
  const left = Number(point.x) - anchorX;
  const top = Number(point.y) - anchorY;
  return {
    left,
    top,
    right: left + width,
    bottom: top + height
  };
}

function markerHoverRectFromPointerPoint(point) {
  return {
    left: Number(point.x) - 0.5,
    top: Number(point.y) - 0.5,
    right: Number(point.x) + 0.5,
    bottom: Number(point.y) + 0.5
  };
}

function leafletMarkerHoverRect(marker) {
  const element = marker?.getElement?.();
  if (!element || !els.mapCanvasWrap) return null;
  const markerRect = element.getBoundingClientRect();
  const wrapRect = els.mapCanvasWrap.getBoundingClientRect();
  return {
    left: markerRect.left - wrapRect.left,
    top: markerRect.top - wrapRect.top,
    right: markerRect.right - wrapRect.left,
    bottom: markerRect.bottom - wrapRect.top
  };
}

function zoomMarkerHoverBounds() {
  if (!els.mapCanvasWrap || !els.zoomMap) return null;
  const wrapRect = els.mapCanvasWrap.getBoundingClientRect();
  const mapRect = els.zoomMap.getBoundingClientRect();
  return {
    left: mapRect.left - wrapRect.left + markerHoverWindowMarginPx,
    right: mapRect.right - wrapRect.left - markerHoverWindowMarginPx,
    top: mapRect.top - wrapRect.top + markerHoverWindowMarginPx,
    bottom: mapRect.bottom - wrapRect.top - markerHoverWindowMarginPx
  };
}

function zoomMarkerHoverPlacement(markerRect, width, height) {
  const bounds = zoomMarkerHoverBounds();
  if (!bounds || !markerRect) {
    return {
      left: markerHoverWindowMarginPx,
      top: markerHoverWindowMarginPx,
      placement: "top"
    };
  }
  const clampWithin = (value, min, max) => max < min ? min : clampNumber(value, min, max);
  const maxLeft = bounds.right - width;
  const maxTop = bounds.bottom - height;
  const markerCenterX = (markerRect.left + markerRect.right) / 2;
  const markerCenterY = (markerRect.top + markerRect.bottom) / 2;
  const topPlacementTop = markerRect.top - height - markerHoverWindowOffsetPx;
  const centeredLeft = markerCenterX - width / 2;

  if (topPlacementTop >= bounds.top) {
    return {
      left: clampWithin(centeredLeft, bounds.left, maxLeft),
      top: clampWithin(topPlacementTop, bounds.top, maxTop),
      placement: "top"
    };
  }

  const bottomPlacementTop = markerRect.bottom + markerHoverWindowOffsetPx;
  if (bottomPlacementTop + height <= bounds.bottom) {
    return {
      left: clampWithin(centeredLeft, bounds.left, maxLeft),
      top: clampWithin(bottomPlacementTop, bounds.top, maxTop),
      placement: "bottom"
    };
  }

  const rightSpace = bounds.right - markerRect.right - markerHoverWindowOffsetPx;
  const leftSpace = markerRect.left - bounds.left - markerHoverWindowOffsetPx;
  const useRight = rightSpace >= width || rightSpace >= leftSpace;
  const sideLeft = useRight
    ? markerRect.right + markerHoverWindowOffsetPx
    : markerRect.left - width - markerHoverWindowOffsetPx;

  return {
    left: clampWithin(sideLeft, bounds.left, maxLeft),
    top: clampWithin(markerCenterY - height / 2, bounds.top, maxTop),
    placement: useRight ? "right" : "left"
  };
}

function cancelZoomNaverInfoWindowClose() {
  if (!state.zoomNaverInfoWindowCloseTimer) return;
  clearTimeout(state.zoomNaverInfoWindowCloseTimer);
  state.zoomNaverInfoWindowCloseTimer = null;
}

function scheduleZoomNaverInfoWindowClose(delay = 120) {
  cancelZoomNaverInfoWindowClose();
  state.zoomNaverInfoWindowCloseTimer = setTimeout(() => {
    state.zoomNaverInfoWindowCloseTimer = null;
    if (state.zoomNaverInfoWindowPinned) return;
    if (state.zoomNaverInfoWindow) state.zoomNaverInfoWindow.close();
  }, delay);
}

function cancelZoomNaverHoverWindowClose() {
  if (!state.zoomNaverHoverWindowCloseTimer) return;
  clearTimeout(state.zoomNaverHoverWindowCloseTimer);
  state.zoomNaverHoverWindowCloseTimer = null;
}

function scheduleZoomNaverHoverWindowClose(delay = 120) {
  cancelZoomNaverHoverWindowClose();
  state.zoomNaverHoverWindowCloseTimer = setTimeout(() => {
    state.zoomNaverHoverWindowCloseTimer = null;
    if (state.zoomNaverHoverWindow) state.zoomNaverHoverWindow.hidden = true;
    if (state.zoomNaverInfoWindow && !state.zoomNaverInfoWindowPinned) state.zoomNaverInfoWindow.close();
  }, delay);
}

function closeZoomNaverHoverWindow() {
  cancelZoomNaverHoverWindowClose();
  if (state.zoomNaverHoverWindow) state.zoomNaverHoverWindow.hidden = true;
  if (state.zoomNaverInfoWindow && !state.zoomNaverInfoWindowPinned) state.zoomNaverInfoWindow.close();
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
    .replace("전북특별자치도", "전북")
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
    평균 상승률 ${renderGrowthRateText(group.growthRate)}
  `;
}

async function initZoomMap() {
  bindZoomMapPointerTracking();
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
      syncNaverZoomControl();
      updateZoomMapLevelLabel();
    }, 0);
    watchNaverAuthFailure();
    return true;
  }

  const initialView = initialZoomMapView();
  state.zoomNaverMap = new window.naver.maps.Map(els.zoomMap, {
    center: new window.naver.maps.LatLng(initialView.center[0], initialView.center[1]),
    zoom: initialView.zoom,
    zoomControl: shouldShowNaverZoomControl(),
    scaleControl: true,
    mapDataControl: false
  });
  bindNaverZoomControlSync();
  window.naver.maps.Event.addListener(state.zoomNaverMap, "zoom_changed", updateZoomMapLevelLabel);
  window.naver.maps.Event.addListener(state.zoomNaverMap, "idle", () => {
    updateZoomMapLevelLabel();
    scheduleZoomMapLoad();
  });
  window.naver.maps.Event.addListener(state.zoomNaverMap, "click", closeMapApartmentPopupFromMap);
  setTimeout(() => window.naver.maps.Event.trigger(state.zoomNaverMap, "resize"), 0);
  updateZoomMapLevelLabel();
  watchNaverAuthFailure();
  return true;
}

function fallbackFromNaverZoomMap() {
  clearZoomNaverOverlays();
  clearNaverUserLocationMarker();
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

  const initialView = initialZoomMapView();
  state.zoomMap = L.map(els.zoomMap, {
    scrollWheelZoom: true
  }).setView(initialView.center, initialView.zoom);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(state.zoomMap);
  state.zoomMapLayer = L.layerGroup().addTo(state.zoomMap);
  state.zoomMap.on("moveend zoomend", () => {
    updateZoomMapLevelLabel();
    scheduleZoomMapLoad();
  });
  state.zoomMap.on("click", closeMapApartmentPopupFromMap);
  updateZoomMapLevelLabel();
  return true;
}

function scheduleZoomMapLoad() {
  if (!isMapTab()) return;
  clearTimeout(state.zoomMapTimer);
  if (shouldSuppressZoomMapLoad()) return;
  state.zoomMapTimer = setTimeout(loadZoomMapSummary, 180);
}

function shouldSuppressZoomMapLoad() {
  const suppressedUntil = Number(state.zoomMapLoadSuppressedUntil || 0);
  if (!suppressedUntil) return false;
  if (Date.now() < suppressedUntil) return true;
  state.zoomMapLoadSuppressedUntil = 0;
  return false;
}

function initialZoomMapView() {
  const routeSlug = regionRouteSlugFromPath();
  return regionRouteMapViews[routeSlug] || homeMapView;
}

function regionRouteSlugFromPath() {
  const match = normalizeRoute(window.location.pathname).match(/^\/regions\/([^/]+)$/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]).trim();
  } catch {
    return match[1].trim();
  }
}

async function prepareMapApartmentFocusFromUrl() {
  if (!isMapTab() || currentMapSource() !== "molit") return false;
  const focus = mapApartmentFocusFromUrl();
  if (!focus?.apartmentId) return false;
  if (
    state.pendingMapApartmentFocus?.id === focus.apartmentId
    && state.pendingMapApartmentFocus?.areaM2 === focus.areaM2
    && state.pendingMapApartmentFocus?.openDetail === focus.openDetail
    && !state.pendingMapApartmentFocus.resolved
  ) {
    return false;
  }
  showMapFocusStatus(focus.openDetail ? "아파트 상세를 불러오는 중..." : "아파트 위치로 이동 중...");
  state.mapPopupPreferredAreaM2 = focus.areaM2;
  state.mapPopupPreferredApartmentId = focus.areaM2 ? focus.apartmentId : null;

  const params = new URLSearchParams({
    apartmentId: focus.apartmentId
  });
  if (els.startInput.value) params.set("start", els.startInput.value.replace("-", ""));
  if (els.endInput.value) params.set("end", els.endInput.value.replace("-", ""));
  appendHouseholdFilterParam(params);

  const detail = await api(`/api/molit-apartment-detail?${params}`).catch(() => null);
  const apartment = detail?.apartment;
  if (!apartment || !Number.isFinite(Number(apartment.lat)) || !Number.isFinite(Number(apartment.lng))) {
    finishMapFocusStatus("위치를 찾지 못했습니다.", { delay: 1200 });
    clearMapApartmentFocusUrl();
    return false;
  }

  const item = {
    ...apartment,
    id: apartment.id || focus.apartmentId,
    name: apartment.name || focus.apartmentId,
    lat: Number(apartment.lat),
    lng: Number(apartment.lng)
  };
  state.mapPopupPreferredApartmentId = focus.areaM2 ? item.id : null;
  state.pendingMapApartmentFocus = {
    id: item.id,
    item,
    areaM2: focus.areaM2,
    openDetail: focus.openDetail,
    resolved: false
  };

  if (!(await initZoomMap())) {
    finishMapFocusStatus("지도를 불러오지 못했습니다.", { delay: 1200 });
    return false;
  }
  closeMapApartmentPopup();
  setFocusedMapApartment(item);
  const period = currentMapPeriodParams();
  const detailCacheKey = `molit:${item.id}:${period.start}:${period.end}:${activeMinHouseholdCount()}`;
  state.mapApartmentDetails.set(detailCacheKey, detail);
  if (focus.openDetail) openMapApartmentDetail(item.id, item);
  moveZoomMapTo(item, apartmentMapZoom, { exactZoom: true });
  finishMapFocusStatus("", { delay: Math.round(animatedMapMoveDuration * 1000) + 450 });
  setTimeout(() => {
    if (state.pendingMapApartmentFocus?.id === item.id && !state.pendingMapApartmentFocus.resolved && isMapTab()) {
      loadZoomMapSummary();
    }
  }, Math.round(animatedMapMoveDuration * 1000) + 300);
  return true;
}

function mapApartmentFocusFromUrl() {
  const params = new URLSearchParams(window.location.search || "");
  const apartmentId = apartmentRouteFocusIdFromPath() || String(params.get("focusApartmentId") || "").trim();
  const areaM2 = nullableMapFocusNumber(params.get("focusAreaM2"));
  const openDetail = params.get("openDetail") !== "0";
  return apartmentId ? { apartmentId, areaM2, openDetail } : null;
}

function apartmentRouteFocusIdFromPath() {
  const match = normalizeRoute(window.location.pathname).match(/^\/apartments\/([^/]+)$/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]).trim();
  } catch {
    return match[1].trim();
  }
}

function nullableMapFocusNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function resolvePendingMapApartmentFocus(items = []) {
  const pending = state.pendingMapApartmentFocus;
  if (!pending?.id || pending.resolved) return;
  const item = items.find((entry) => entry?.id === pending.id) || pending.item;
  if (!item || !state.mapApartmentMarkerRefs.has(pending.id)) return;
  setFocusedMapApartment(item);
  state.pendingMapApartmentFocus = { ...pending, item, resolved: true };
  clearMapApartmentFocusUrl();
}

function clearMapApartmentFocusUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("focusApartmentId") && !url.searchParams.has("focusAreaM2") && !url.searchParams.has("openDetail")) return;
  url.searchParams.delete("focusApartmentId");
  url.searchParams.delete("focusAreaM2");
  url.searchParams.delete("openDetail");
  window.history.replaceState({ tab: state.activeTab }, "", `${url.pathname}${url.search}${url.hash}`);
}

async function loadZoomMapSummary() {
  const requestId = ++state.zoomMapRequestId;
  showMapLoadingOverlay("지도를 준비하는 중...", { requestId, delay: 0 });
  if (!(await initZoomMap())) {
    hideMapLoadingOverlay({
      requestId,
      message: "지도를 불러오지 못했습니다.",
      delay: 1400
    });
    return;
  }
  if (requestId !== state.zoomMapRequestId) return;
  const params = new URLSearchParams();
  const view = currentZoomMapView();
  if (!view) {
    hideMapLoadingOverlay({ requestId });
    return;
  }
  const { zoom, bounds } = view;
  params.set("zoom", String(zoom));
  params.set("north", String(bounds.north));
  params.set("south", String(bounds.south));
  params.set("east", String(bounds.east));
  params.set("west", String(bounds.west));
  if (els.startInput.value) params.set("start", els.startInput.value.replace("-", ""));
  if (els.endInput.value) params.set("end", els.endInput.value.replace("-", ""));
  appendHouseholdFilterParam(params);

  const endpoint = currentMapSource() === "molit" ? "/api/molit-zoom-map-summary" : "/api/zoom-map-summary";
  showMapLoadingOverlay("지도 데이터를 가져오는 중...", { requestId });
  try {
    const data = await api(`${endpoint}?${params}`);
    if (requestId !== state.zoomMapRequestId) return;
    const itemCount = Array.isArray(data.items) ? data.items.length : 0;
    if (itemCount >= 500) {
      showMapLoadingOverlay(`가까운 마커부터 그리는 중... ${formatInt(itemCount)}개`, { requestId, delay: 0 });
      await waitForNextFrame();
      if (requestId !== state.zoomMapRequestId) return;
    }
    await renderZoomMapSummary(data);
    await waitForZoomMapVisualReady(requestId);
    hideMapLoadingOverlay({ requestId });
  } catch (error) {
    if (requestId !== state.zoomMapRequestId) return;
    hideMapLoadingOverlay({
      requestId,
      message: "지도를 불러오지 못했습니다.",
      delay: 1400
    });
  }
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

function currentZoomMapCenter() {
  if (state.zoomNaverMap && window.naver?.maps) {
    const center = state.zoomNaverMap.getCenter();
    return {
      lat: naverCoordLat(center),
      lng: naverCoordLng(center)
    };
  }

  if (!state.zoomMap) return null;
  const center = state.zoomMap.getCenter();
  return {
    lat: Number(center.lat),
    lng: Number(center.lng)
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

async function renderZoomMapSummary(data) {
  const items = data.items || [];
  state.latestZoomMapData = { ...data, items };
  const levelLabel = zoomLevelLabel(data.level);
  const cacheLabel = formatMapCacheLabel(data.cache);
  els.zoomMapPeriod.textContent = data.period?.startMonth && data.period?.endMonth
    ? `${formatMonth(data.period.startMonth)} - ${formatMonth(data.period.endMonth)}${cacheLabel ? ` · ${cacheLabel}` : ""}`
    : "";
  updateZoomMapLevelLabel(data.level);
  els.zoomMapCount.textContent = `${formatInt(items.length)}개 표시`;
  els.zoomMapTitle.textContent = currentMapSource() === "molit"
    ? `${levelLabel} 실거래가 상승률 지도`
    : `${levelLabel} 상승률 지도`;
  if (!shouldPreserveMapRankingRender(data.level)) {
    renderMapApartmentRanking(data.level, items);
  }
  const renderZoom = Number(currentZoomMapView()?.zoom);
  const transitionMode = mapTransitionModeForRender(data.level);
  const renderReady = renderZoomMapItemsWithTransition(items, data.level, { mode: transitionMode });
  const focusResolveDelay = transitionMode === "current" ? 0 : 340;
  setTimeout(() => resolvePendingMapApartmentFocus(items), focusResolveDelay);
  state.lastZoomMapRenderZoom = Number.isFinite(renderZoom) ? renderZoom : null;
  state.lastZoomMapRenderLevel = data.level || null;
  await renderReady;
}

function mapTransitionModeForRender(level) {
  if (!state.lastZoomMapRenderLevel || state.lastZoomMapRenderLevel === level) return "current";
  const configuredMode = activeMapTransitionDesignId();
  return configuredMode === "current" ? "fade" : configuredMode;
}

function renderZoomMapItemsWithTransition(items, level, { mode = "current" } = {}) {
  clearTimeout(state.mapTransitionTimer);
  cancelProgressiveMarkerRender();
  if (mode === "current" || !hasZoomMapOverlays()) {
    resetMapTransitionState();
    return replaceZoomMapItems(items, level, "");
  }

  const delay = mode === "fade" ? 180 : 260;
  beginMapTransition(mode, level);
  return new Promise((resolve) => {
    state.mapTransitionTimer = setTimeout(() => {
      resolve(replaceZoomMapItems(items, level, mode));
    }, delay);
  });
}

function replaceZoomMapItems(items, level, mode = "") {
  clearZoomMapOverlays();
  if (mode === "fade") {
    setMapTransitionClass("map-transition-entering");
  } else if (mode === "dim" || mode === "badge") {
    setMapTransitionClass("map-transition-arrived");
  }

  const renderableItems = items.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
  if (shouldProgressivelyRenderMarkers(renderableItems, level)) {
    return renderZoomMapItemsProgressively(renderableItems, level, mode);
  }

  renderZoomMapItemBatch(renderableItems, level, 0, renderableItems.length);
  if (mode) {
    finishZoomMapTransitionAfterRender();
  }
  return Promise.resolve();
}

function shouldProgressivelyRenderMarkers(items, level) {
  return level === "apartment" && items.length >= progressiveMarkerThreshold;
}

function renderZoomMapItemsProgressively(items, level, mode = "") {
  const renderId = nextMapMarkerRenderId();
  const sortedItems = sortZoomMapItemsByDistance(items, currentZoomMapCenter());
  const firstEnd = renderZoomMapItemBatch(sortedItems, level, 0, progressiveMarkerInitialBatchSize());
  updateProgressiveMarkerCount(firstEnd, sortedItems.length);
  resolvePendingMapApartmentFocus(sortedItems);

  if (firstEnd >= sortedItems.length) {
    finishProgressiveMarkerRender(renderId, sortedItems.length, mode);
    return Promise.resolve();
  }

  scheduleProgressiveMarkerBatch(renderId, sortedItems, level, firstEnd, mode);
  return Promise.resolve();
}

function renderZoomMapItemBatch(items, level, startIndex, endIndex) {
  const end = Math.min(items.length, Math.max(startIndex, endIndex));
  for (let index = startIndex; index < end; index += 1) {
    const item = items[index];
    if (level === "apartment") {
      renderZoomApartmentMarker(item);
    } else {
      renderZoomGroupMarker(item, level);
    }
  }
  return end;
}

function scheduleProgressiveMarkerBatch(renderId, items, level, startIndex, mode = "") {
  state.mapMarkerRenderFrame = scheduleMapMarkerRenderFrame(() => {
    if (state.mapMarkerRenderId !== renderId) return;
    const nextIndex = renderZoomMapItemBatch(items, level, startIndex, startIndex + progressiveMarkerBatchSize());
    updateProgressiveMarkerCount(nextIndex, items.length);
    resolvePendingMapApartmentFocus(items);
    if (nextIndex < items.length) {
      scheduleProgressiveMarkerBatch(renderId, items, level, nextIndex, mode);
      return;
    }
    finishProgressiveMarkerRender(renderId, items.length, mode);
  });
}

function finishProgressiveMarkerRender(renderId, total, mode = "") {
  if (state.mapMarkerRenderId !== renderId) return;
  state.mapMarkerRenderFrame = null;
  updateProgressiveMarkerCount(total, total);
  if (mode) {
    finishZoomMapTransitionAfterRender();
  }
}

function nextMapMarkerRenderId() {
  state.mapMarkerRenderId += 1;
  return state.mapMarkerRenderId;
}

function cancelProgressiveMarkerRender() {
  state.mapMarkerRenderId += 1;
  if (state.mapMarkerRenderFrame) {
    cancelScheduledMapMarkerRenderFrame(state.mapMarkerRenderFrame);
    state.mapMarkerRenderFrame = null;
  }
}

function scheduleMapMarkerRenderFrame(callback) {
  if (typeof requestAnimationFrame === "function") {
    return { type: "raf", id: requestAnimationFrame(callback) };
  }
  return { type: "timeout", id: setTimeout(callback, 16) };
}

function cancelScheduledMapMarkerRenderFrame(frame) {
  if (!frame) return;
  if (frame.type === "raf" && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(frame.id);
    return;
  }
  clearTimeout(frame.id);
}

function progressiveMarkerInitialBatchSize() {
  return isMobileMapControlsViewport() ? progressiveMarkerInitialMobile : progressiveMarkerInitialDesktop;
}

function progressiveMarkerBatchSize() {
  return isMobileMapControlsViewport() ? progressiveMarkerBatchMobile : progressiveMarkerBatchDesktop;
}

function updateProgressiveMarkerCount(rendered, total) {
  if (!els.zoomMapCount) return;
  const safeRendered = Math.max(0, Math.min(Number(rendered) || 0, Number(total) || 0));
  const safeTotal = Math.max(0, Number(total) || 0);
  els.zoomMapCount.textContent = safeRendered < safeTotal
    ? `${formatInt(safeRendered)} / ${formatInt(safeTotal)}개 표시 중`
    : `${formatInt(safeTotal)}개 표시`;
}

function sortZoomMapItemsByDistance(items, center) {
  const centerLat = Number(center?.lat);
  const centerLng = Number(center?.lng);
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) return [...items];
  const lngWeight = Math.max(0.2, Math.cos(centerLat * Math.PI / 180));
  return items
    .map((item, index) => {
      const latDelta = Number(item.lat) - centerLat;
      const lngDelta = (Number(item.lng) - centerLng) * lngWeight;
      return {
        item,
        index,
        distance: latDelta * latDelta + lngDelta * lngDelta
      };
    })
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .map((entry) => entry.item);
}

function finishZoomMapTransitionAfterRender() {
  clearTimeout(state.mapTransitionTimer);
  state.mapTransitionTimer = setTimeout(resetMapTransitionState, 360);
}

function beginMapTransition(mode, level) {
  setMapTransitionClass(`map-transition-${mode}`);
  if (mode === "badge" && els.mapTransitionStatus) {
    els.mapTransitionStatus.textContent = `${zoomLevelLabel(level)} 단위로 전환 중...`;
    els.mapTransitionStatus.hidden = false;
  }
}

function resetMapTransitionState() {
  clearTimeout(state.mapTransitionTimer);
  setMapTransitionClass("");
  if (els.mapTransitionStatus && !state.mapFocusStatusActive) {
    els.mapTransitionStatus.hidden = true;
    els.mapTransitionStatus.removeAttribute("aria-busy");
    els.mapTransitionStatus.removeAttribute("data-busy");
  }
}

function showMapLoadingOverlay(label = "지도 데이터를 가져오는 중...", { requestId = state.zoomMapRequestId, delay = 180 } = {}) {
  if (!els.mapLoadingOverlay) return;
  clearTimeout(state.mapLoadingTimer);
  state.mapLoadingRequestId = requestId;
  setMapLoadingOverlayLabel(label);
  els.mapLoadingOverlay.dataset.state = "loading";
  els.mapLoadingOverlay.setAttribute("aria-busy", "true");

  const show = () => {
    if (state.mapLoadingRequestId !== requestId) return;
    els.mapLoadingOverlay.hidden = false;
  };

  if (!els.mapLoadingOverlay.hidden || Number(delay) <= 0) {
    show();
    return;
  }

  state.mapLoadingTimer = setTimeout(show, Math.max(0, Number(delay) || 0));
}

function hideMapLoadingOverlay({ requestId = state.mapLoadingRequestId, message = "", delay = 0 } = {}) {
  if (!els.mapLoadingOverlay || state.mapLoadingRequestId !== requestId) return;
  clearTimeout(state.mapLoadingTimer);

  if (message) {
    setMapLoadingOverlayLabel(message);
    els.mapLoadingOverlay.dataset.state = "error";
    els.mapLoadingOverlay.removeAttribute("aria-busy");
    els.mapLoadingOverlay.hidden = false;
    state.mapLoadingTimer = setTimeout(() => {
      if (state.mapLoadingRequestId !== requestId) return;
      state.mapLoadingRequestId = 0;
      els.mapLoadingOverlay.hidden = true;
      els.mapLoadingOverlay.dataset.state = "loading";
      els.mapLoadingOverlay.setAttribute("aria-busy", "true");
    }, Math.max(0, Number(delay) || 0));
    return;
  }

  state.mapLoadingRequestId = 0;
  els.mapLoadingOverlay.hidden = true;
  els.mapLoadingOverlay.dataset.state = "loading";
  els.mapLoadingOverlay.setAttribute("aria-busy", "true");
}

function setMapLoadingOverlayLabel(label) {
  if (els.mapLoadingLabel) {
    els.mapLoadingLabel.textContent = label || "지도 데이터를 가져오는 중...";
  }
}

function waitForNextFrame() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 16);
  });
}

async function waitForZoomMapVisualReady(requestId, timeoutMs = 1600) {
  await waitForNextFrame();
  if (requestId !== state.zoomMapRequestId || !els.zoomMap) return;
  if (hasLoadedZoomMapTile()) return;

  await new Promise((resolve) => {
    let settled = false;
    let observer = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      observer?.disconnect();
      resolve();
    };
    const check = () => {
      if (requestId !== state.zoomMapRequestId || hasLoadedZoomMapTile()) finish();
    };
    const timer = setTimeout(finish, Math.max(0, Number(timeoutMs) || 0));
    observer = new MutationObserver(check);
    observer.observe(els.zoomMap, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "src", "style"]
    });
    for (const image of els.zoomMap.querySelectorAll("img")) {
      image.addEventListener("load", check, { once: true });
      image.addEventListener("error", check, { once: true });
    }
    check();
  });
}

function hasLoadedZoomMapTile() {
  if (!els.zoomMap) return true;
  const loadedLeafletTile = els.zoomMap.querySelector(".leaflet-tile-loaded");
  if (loadedLeafletTile) return true;

  for (const image of els.zoomMap.querySelectorAll("img")) {
    const rect = image.getBoundingClientRect();
    if (rect.width < 16 || rect.height < 16) continue;
    if (image.complete && image.naturalWidth > 0) return true;
  }
  return false;
}

function showMapFocusStatus(label) {
  if (!els.mapTransitionStatus) return;
  clearTimeout(state.mapFocusStatusTimer);
  state.mapFocusStatusActive = true;
  els.mapTransitionStatus.textContent = label || "아파트 위치로 이동 중...";
  els.mapTransitionStatus.hidden = false;
  els.mapTransitionStatus.setAttribute("aria-busy", "true");
  els.mapTransitionStatus.dataset.busy = "true";
}

function finishMapFocusStatus(label = "", { delay = 650 } = {}) {
  if (!els.mapTransitionStatus) return;
  clearTimeout(state.mapFocusStatusTimer);
  if (label) {
    els.mapTransitionStatus.textContent = label;
    els.mapTransitionStatus.removeAttribute("aria-busy");
    delete els.mapTransitionStatus.dataset.busy;
  }
  state.mapFocusStatusTimer = setTimeout(() => {
    state.mapFocusStatusActive = false;
    els.mapTransitionStatus.hidden = true;
    els.mapTransitionStatus.removeAttribute("aria-busy");
    els.mapTransitionStatus.removeAttribute("data-busy");
  }, Math.max(0, Number(delay) || 0));
}

function setMapTransitionClass(className) {
  if (!els.mapCanvasWrap) return;
  els.mapCanvasWrap.classList.remove(
    "map-transition-dim",
    "map-transition-badge",
    "map-transition-fade",
    "map-transition-entering",
    "map-transition-arrived"
  );
  if (className) els.mapCanvasWrap.classList.add(className);
}

function activeMapTransitionDesignId() {
  return transitionDesignLabels[state.activeTransitionDesignId] ? state.activeTransitionDesignId : "current";
}

function hasZoomMapOverlays() {
  if (state.zoomNaverMap) return state.zoomNaverOverlays.length > 0;
  if (!state.zoomMapLayer) return false;
  if (typeof state.zoomMapLayer.getLayers === "function") return state.zoomMapLayer.getLayers().length > 0;
  return false;
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
  if (typeof trackAnalyticsEvent === "function") {
    trackAnalyticsEvent("map_search_selected", {
      targetType: item.type || item.targetType || "",
      targetName: item.name || "",
      targetZoom: Number(item.targetZoom || 0) || null,
      mapSource: currentMapSource()
    });
  }
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
  const sourceLevel = normalizeMapRankingTargetLevel(level);
  const targetLevel = currentMapRankingTargetLevel(sourceLevel);
  syncMapRankingTargetSelect(targetLevel);

  if (isMapGroupRankingLevel(targetLevel)) {
    clearMapScopedRankingSignatures();
    renderMapGroupRanking(targetLevel, items, { sourceLevel });
    return;
  }
  clearMapGroupRankingSignatures();
  if (targetLevel !== "apartment") {
    state.mapRankingRequestId += 1;
    state.mapRankingDongScope = null;
    state.mapRankingScopes = null;
    state.mapRankingMobileOpen = false;
    state.mapRankingOverPopup = false;
    els.mapApartmentRanking.classList.remove("ranking-active");
    els.mapApartmentRanking.classList.remove("ranking-open");
    els.mapApartmentRanking.classList.remove("ranking-over-popup");
    els.mapApartmentRanking.hidden = true;
    els.mapRankingSection.hidden = true;
    els.mapRankingRows.innerHTML = "";
    els.mapRankingCount.textContent = "";
    if (els.mapRankingTabs) els.mapRankingTabs.innerHTML = "";
    updateMobileMapRankingToggle(false);
    return;
  }

  const includeViewport = sourceLevel === "apartment";
  const viewportRows = includeViewport ? sortedMapRankingRows(items) : [];
  const scopes = includeViewport
    ? closestMapRankingScopes(viewportRows)
    : closestMapApartmentRankingScopes(sourceLevel, items);
  state.mapRankingScopes = scopes;
  state.mapRankingDongScope = scopes.dong;
  if (!isMapRankingModeAvailable(state.mapRankingMode, scopes, { includeViewport })) {
    state.mapRankingMode = defaultMapRankingMode(scopes, { includeViewport });
  }
  const mode = state.mapRankingMode;

  els.mapApartmentRanking.classList.add("ranking-active");
  els.mapApartmentRanking.hidden = false;
  els.mapRankingSection.hidden = false;
  updateMobileMapRankingToggle(true);
  renderMapRankingTabs(scopes, mode, { includeViewport });
  if (mode !== "viewport" && scopes[mode]) {
    const signature = mapScopedRankingSignature(scopes[mode]);
    if (shouldReuseMapScopedRanking(signature)) return;
    loadMapScopedRankingRows(scopes[mode], signature);
    return;
  }

  clearMapScopedRankingSignatures();
  state.mapRankingRequestId += 1;
  renderMapRankingRows(viewportRows, {
    titlePrefix: "현재 지도",
    titleTargetLevel: "apartment",
    titleSuffix: "랭킹",
    countText: `${formatInt(viewportRows.length)}개`,
    emptyText: "현재 지도에 표시할 아파트가 없습니다."
  });
}

function renderMapGroupRanking(level, items, { sourceLevel = level } = {}) {
  const scopes = closestMapGroupRankingScopesForContext(level, sourceLevel, items);
  const mode = mapGroupRankingMode(level, state.mapGroupRankingMode, scopes);
  const scope = scopes[mode] || scopes.country;

  state.mapRankingScopes = scopes;
  state.mapRankingDongScope = null;
  state.mapGroupRankingMode = scope?.mode || mode;

  els.mapApartmentRanking.classList.add("ranking-active");
  els.mapApartmentRanking.hidden = false;
  els.mapRankingSection.hidden = false;
  updateMobileMapRankingToggle(true);
  renderMapGroupRankingTabs(scopes, state.mapGroupRankingMode, level);

  if (scope) {
    const signature = mapGroupRankingSignature(level, scope);
    if (shouldReuseMapGroupRanking(signature)) return;
    loadMapGroupRankingRows(level, scope, signature);
    return;
  }

  clearMapGroupRankingSignatures();
  state.mapRankingRequestId += 1;
  renderMapGroupRankingRows([], level, {
    titlePrefix: "전국",
    countText: "",
    emptyText: "표시할 지역이 없습니다.",
    rankMode: "country"
  });
}

function toggleMobileMapRanking() {
  setMobileMapRankingOpen(!state.mapRankingMobileOpen);
}

function closeMobileMapRanking() {
  if (!state.mapRankingMobileOpen) return;
  setMobileMapRankingOpen(false);
}

function clearMapRankingPopupOverlay() {
  if (!state.mapRankingOverPopup) return;
  state.mapRankingOverPopup = false;
  syncMapRankingOverlayClasses(Boolean(els.mapApartmentRanking && !els.mapApartmentRanking.hidden));
}

function setMobileMapRankingOpen(open, { overPopup = false } = {}) {
  state.mapRankingMobileOpen = Boolean(open);
  state.mapRankingOverPopup = Boolean(state.mapRankingMobileOpen && overPopup);
  updateMobileMapRankingToggle(Boolean(els.mapApartmentRanking && !els.mapApartmentRanking.hidden));
}

function updateMobileMapRankingToggle(available) {
  if (!els.mapRankingToggleBtn) return;
  els.mapRankingToggleBtn.hidden = !available;
  els.mapRankingToggleBtn.textContent = "랭킹 보기";
  els.mapRankingToggleBtn.setAttribute("aria-expanded", String(state.mapRankingMobileOpen));
  syncMapRankingOverlayClasses(available);
}

function syncMapRankingOverlayClasses(available) {
  const isOpen = Boolean(state.mapRankingMobileOpen && available);
  const isOverPopup = Boolean(isOpen && state.mapRankingOverPopup);
  els.mapApartmentRanking?.classList.toggle("ranking-open", isOpen);
  els.mapApartmentRanking?.classList.toggle("ranking-over-popup", isOverPopup);
  els.mapRankingToggleBtn?.classList.toggle("ranking-open", isOpen);
  els.mapRankingToggleBtn?.classList.toggle("ranking-over-popup", isOverPopup);
}

function handleMapRankingTargetChange() {
  const nextLevel = normalizeMapRankingTargetLevel(els.mapRankingTargetSelect?.value || "");
  state.mapRankingTargetManual = true;
  state.mapRankingTargetLevel = nextLevel;
  state.mapRankingRequestId += 1;
  clearMapScopedRankingSignatures();
  clearMapGroupRankingSignatures();

  if (typeof trackAnalyticsEvent === "function") {
    trackAnalyticsEvent("map_ranking_target_changed", {
      targetLevel: nextLevel,
      mapLevel: state.latestZoomMapData?.level || "",
      mapSource: currentMapSource(),
      periodLabel: mapAnalyticsPeriodLabel()
    });
  }

  const latest = state.latestZoomMapData;
  renderMapApartmentRanking(latest?.level, latest?.items || []);
}

function openMapRankingFromPopupScope({ mode, key, label, total } = {}) {
  const normalizedMode = ["dong", "sigungu", "sido", "country"].includes(mode) ? mode : "";
  const normalizedKey = normalizedMode === "country" ? "country" : String(key || "").trim();
  if (!normalizedMode || !normalizedKey || !els.mapApartmentRanking || !els.mapRankingSection) return;

  const latest = state.latestZoomMapData;
  const viewportRows = latest?.level === "apartment" ? sortedMapRankingRows(latest.items || []) : [];
  const existingScopes = state.mapRankingScopes || closestMapRankingScopes(viewportRows);
  const scopeLabel = label || (normalizedMode === "country" ? "전국" : normalizedKey);
  const scope = mapRankingScope(normalizedMode, normalizedKey, scopeLabel, total);
  const scopes = {
    ...existingScopes,
    [normalizedMode]: scope,
    country: existingScopes?.country || mapRankingScope("country", "country", "전국", total)
  };

  state.mapRankingMode = normalizedMode;
  state.mapRankingTargetManual = true;
  state.mapRankingTargetLevel = "apartment";
  syncMapRankingTargetSelect("apartment");
  state.mapRankingScopes = scopes;
  state.mapRankingDongScope = scopes.dong || null;
  if (state.mapPopupDetail?.apartment?.id) {
    setFocusedMapApartment(state.mapPopupDetail.apartment);
  }

  els.mapApartmentRanking.classList.add("ranking-active");
  els.mapApartmentRanking.hidden = false;
  els.mapRankingSection.hidden = false;
  renderMapRankingTabs(scopes, normalizedMode);
  setMobileMapRankingOpen(true, { overPopup: true });
  loadMapScopedRankingRows(scope);

  if (typeof trackAnalyticsEvent === "function") {
    trackAnalyticsEvent("map_popup_rank_clicked", {
      rankMode: normalizedMode,
      scopeKey: normalizedKey,
      scopeName: scopeLabel,
      apartmentId: state.mapPopupDetail?.apartment?.id || "",
      apartmentName: state.mapPopupDetail?.apartment?.name || "",
      mapSource: currentMapSource(),
      periodLabel: mapAnalyticsPeriodLabel()
    });
  }
}

function sortedMapRankingRows(items) {
  return [...items]
    .filter((item) => item.type === "apartment" && item.id)
    .sort(compareMapRankingRows);
}

function sortedMapGroupRankingRows(items) {
  return [...items]
    .filter((item) => item.type === "group" && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)))
    .sort((a, b) => compareMapScopeRankingRows(a, b, "country"));
}

function compareMapRankingRows(a, b) {
  if ((a.hasData !== false) !== (b.hasData !== false)) return a.hasData === false ? 1 : -1;
  const rateDiff = sortableRate(b.growthRate) - sortableRate(a.growthRate);
  if (rateDiff) return rateDiff;
  return String(a.name || "").localeCompare(String(b.name || ""), "ko");
}

function compareMapDongRankingRows(a, b) {
  return compareMapScopeRankingRows(a, b, "dong");
}

function compareMapScopeRankingRows(a, b, rankMode) {
  const rankA = Number(mapRankingRankValue(a, rankMode, Infinity));
  const rankB = Number(mapRankingRankValue(b, rankMode, Infinity));
  if (Number.isFinite(rankA) && Number.isFinite(rankB) && rankA !== rankB) return rankA - rankB;
  if (Number.isFinite(rankA) !== Number.isFinite(rankB)) return Number.isFinite(rankA) ? -1 : 1;
  return compareMapRankingRows(a, b);
}

function setMapRankingTitle({ prefix = "현재 지도", targetLevel = "apartment", suffix = "랭킹" } = {}) {
  const normalizedLevel = normalizeMapRankingTargetLevel(targetLevel);
  syncMapRankingTargetSelect(normalizedLevel);
  if (!els.mapRankingTitle) return;

  if (!els.mapRankingTitlePrefix || !els.mapRankingTitleSuffix || !els.mapRankingTargetSelect) {
    const fallbackTitle = [prefix, mapRankingTargetLabel(normalizedLevel), suffix].filter(Boolean).join(" ");
    els.mapRankingTitle.textContent = fallbackTitle;
    return;
  }

  els.mapRankingTitlePrefix.textContent = prefix || "";
  els.mapRankingTitleSuffix.textContent = suffix || "";
}

function renderMapRankingRows(rows, {
  titlePrefix = "현재 지도",
  titleTargetLevel = "apartment",
  titleSuffix = "랭킹",
  countText,
  emptyText,
  rankMode = "viewport",
  rankTotal = rows.length
} = {}) {
  setMapRankingTitle({
    prefix: titlePrefix,
    targetLevel: titleTargetLevel,
    suffix: titleSuffix
  });
  els.mapRankingCount.textContent = countText || `${formatInt(rows.length)}개`;
  els.mapRankingRows.innerHTML = rows.length
    ? rows.map((item, index) => {
      const rank = mapRankingRankValue(item, rankMode, index + 1);
      return `
        <div class="map-ranking-row ${item.id === state.focusedMapApartmentId ? "selected" : ""}" role="button" tabindex="0" data-apartment-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.name)} 위치로 이동">
          <span class="map-ranking-rank">${formatInt(rank)}</span>
          <span class="map-ranking-main">
            <strong>${escapeHtml(item.name)}</strong>
            <em>${escapeHtml(item.neighborhoodName || item.dongName || "-")}${item.areaSummary ? ` · ${escapeHtml(item.areaSummary)}` : ""}</em>
          </span>
          <span class="map-ranking-actions">
            <span class="map-ranking-rate ${rateClass(item.growthRate, rank, rankTotal)}">${item.hasData === false ? "데이터없음" : formatPercent(item.growthRate)}</span>
            <button class="map-ranking-detail-btn" type="button" data-apartment-detail-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.name)} 상세 보기">상세</button>
          </span>
        </div>
      `;
    }).join("")
    : `<div class="map-ranking-empty">${escapeHtml(emptyText || "표시할 아파트가 없습니다.")}</div>`;
  bindMapRankingRowEvents(rows);
}

function bindMapRankingRowEvents(rows) {
  const itemById = new Map(rows.map((item) => [item.id, item]));
  els.mapRankingRows.querySelectorAll("[data-apartment-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (event.target.closest("[data-apartment-detail-id]")) return;
      const item = itemById.get(button.dataset.apartmentId);
      if (!item) return;
      if (isMobileMapControlsViewport()) {
        openMapApartmentDetailFromRanking(item);
      } else {
        focusMapApartmentFromRanking(item);
      }
    });
    button.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      const item = itemById.get(button.dataset.apartmentId);
      if (!item) return;
      if (isMobileMapControlsViewport()) {
        openMapApartmentDetailFromRanking(item);
      } else {
        focusMapApartmentFromRanking(item);
      }
    });
  });
  els.mapRankingRows.querySelectorAll("[data-apartment-detail-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const item = itemById.get(button.dataset.apartmentDetailId);
      if (!item) return;
      openMapApartmentDetailFromRanking(item);
    });
  });
}

function renderMapGroupRankingRows(rows, level, {
  titlePrefix = "전국",
  countText,
  emptyText,
  rankMode = "country",
  rankTotal = rows.length
} = {}) {
  setMapRankingTitle({
    prefix: titlePrefix,
    targetLevel: level,
    suffix: "상승률 랭킹"
  });
  els.mapRankingCount.textContent = countText || `${formatInt(rows.length)}개`;
  els.mapRankingRows.innerHTML = rows.length
    ? rows.map((item, index) => {
      const rank = mapRankingRankValue(item, rankMode, index + 1);
      return `
        <div class="map-ranking-row" role="button" tabindex="0" data-map-group-index="${index}" aria-label="${escapeHtml(item.name)} 지역으로 이동">
          <span class="map-ranking-rank">${formatInt(rank)}</span>
          <span class="map-ranking-main">
            <strong>${escapeHtml(mapGroupRankingRowTitle(item, level))}</strong>
            <em>${escapeHtml(mapGroupRankingRowSubtitle(item, level))}</em>
          </span>
          <span class="map-ranking-actions">
            <span class="map-ranking-rate ${rateClass(item.growthRate, rank, rankTotal)}">${item.hasData === false ? "데이터없음" : formatPercent(item.growthRate)}</span>
          </span>
        </div>
      `;
    }).join("")
    : `<div class="map-ranking-empty">${escapeHtml(emptyText || "표시할 지역이 없습니다.")}</div>`;
  bindMapGroupRankingRowEvents(rows, level);
}

function bindMapGroupRankingRowEvents(rows, level) {
  els.mapRankingRows.querySelectorAll("[data-map-group-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = rows[Number(button.dataset.mapGroupIndex)];
      if (!item) return;
      focusMapGroupFromRanking(item, level);
    });
    button.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      const item = rows[Number(button.dataset.mapGroupIndex)];
      if (!item) return;
      focusMapGroupFromRanking(item, level);
    });
  });
}

function focusMapGroupFromRanking(item, level) {
  closeMapApartmentPopup();
  const currentZoom = Number(currentZoomMapView()?.zoom || 0);
  moveZoomMapTo(item, zoomGroupTargetZoom(level, currentZoom), { exactZoom: true });
}

function mapGroupRankingRowTitle(item, level) {
  return shortZoomLabel(item?.name || "", level) || String(item?.name || "").trim() || mapGroupRankingLevelLabel(level);
}

function mapGroupRankingRowSubtitle(item, level) {
  const parts = [];
  if (level === "dong") {
    const sigunguLabel = mapGroupSigunguLabel(item);
    if (sigunguLabel) parts.push(sigunguLabel);
  } else if (level === "sigungu") {
    const sidoLabel = mapGroupSidoLabel(item);
    if (sidoLabel) parts.push(sidoLabel);
  }

  const apartmentCount = Number(item?.apartmentCount);
  if (Number.isFinite(apartmentCount)) parts.push(`아파트 ${formatInt(apartmentCount)}개`);
  return parts.join(" · ") || `${mapGroupRankingLevelLabel(level)} 단위`;
}

function renderMapRankingTabs(scopes, mode, { includeViewport = true } = {}) {
  if (!els.mapRankingTabs) return;
  const tabs = [
    includeViewport ? { mode: "viewport", label: "지도 내" } : null,
    scopes.dong,
    scopes.sigungu,
    scopes.sido,
    scopes.country
  ].filter(Boolean);
  els.mapRankingTabs.innerHTML = `
    ${tabs.map((tab) => `
      <button class="map-ranking-tab ${mode === tab.mode ? "active" : ""}" type="button" data-map-ranking-mode="${escapeHtml(tab.mode)}" role="tab" aria-selected="${mode === tab.mode}">${escapeHtml(tab.label)}</button>
    `).join("")}
  `;
  els.mapRankingTabs.querySelectorAll("[data-map-ranking-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const requestedMode = button.dataset.mapRankingMode || "viewport";
      const nextMode = isMapRankingModeAvailable(requestedMode, scopes, { includeViewport })
        ? requestedMode
        : defaultMapRankingMode(scopes, { includeViewport });
      if (state.mapRankingMode === nextMode) return;
      state.mapRankingMode = nextMode;
      const nextScope = scopes[nextMode] || null;
      if (typeof trackAnalyticsEvent === "function") {
        trackAnalyticsEvent("map_ranking_mode_changed", {
          rankMode: nextMode,
          dongKey: scopes.dong?.key || "",
          dongName: scopes.dong?.scopeLabel || "",
          sigunguCode: scopes.sigungu?.key || "",
          sigunguName: scopes.sigungu?.scopeLabel || "",
          sidoCode: scopes.sido?.key || "",
          sidoName: scopes.sido?.scopeLabel || "",
          scopeName: nextScope?.scopeLabel || "",
          mapSource: currentMapSource(),
          periodLabel: mapAnalyticsPeriodLabel()
        });
      }
      const latest = state.latestZoomMapData;
      renderMapApartmentRanking(latest?.level, latest?.items || []);
    });
  });
}

function renderMapGroupRankingTabs(scopes, mode, level) {
  if (!els.mapRankingTabs) return;
  const tabs = mapGroupRankingModes(level)
    .map((tabMode) => scopes[tabMode])
    .filter(Boolean);
  els.mapRankingTabs.innerHTML = `
    ${tabs.map((tab) => `
      <button class="map-ranking-tab ${mode === tab.mode ? "active" : ""}" type="button" data-map-ranking-mode="${escapeHtml(tab.mode)}" role="tab" aria-selected="${mode === tab.mode}">${escapeHtml(tab.label)}</button>
    `).join("")}
  `;
  els.mapRankingTabs.querySelectorAll("[data-map-ranking-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const requestedMode = button.dataset.mapRankingMode || "country";
      const nextMode = mapGroupRankingMode(level, requestedMode, scopes);
      if (state.mapGroupRankingMode === nextMode) return;
      state.mapGroupRankingMode = nextMode;
      const nextScope = scopes[nextMode] || null;
      if (typeof trackAnalyticsEvent === "function") {
        trackAnalyticsEvent("map_group_ranking_mode_changed", {
          level,
          rankMode: nextMode,
          sigunguCode: scopes.sigungu?.key || "",
          sigunguName: scopes.sigungu?.scopeLabel || "",
          sidoCode: scopes.sido?.key || "",
          sidoName: scopes.sido?.scopeLabel || "",
          scopeName: nextScope?.scopeLabel || "",
          mapSource: currentMapSource(),
          periodLabel: mapAnalyticsPeriodLabel()
        });
      }
      const latest = state.latestZoomMapData;
      renderMapApartmentRanking(latest?.level, latest?.items || []);
    });
  });
}

async function loadMapScopedRankingRows(scope, signature = mapScopedRankingSignature(scope)) {
  const requestId = ++state.mapRankingRequestId;
  state.mapScopedRankingPendingSignature = signature;
  setMapRankingTitle({
    prefix: scope.scopeLabel,
    targetLevel: "apartment",
    suffix: "순위"
  });
  els.mapRankingCount.textContent = "불러오는 중";
  els.mapRankingRows.innerHTML = `<div class="map-ranking-empty">${escapeHtml(scope.title)}를 불러오는 중입니다.</div>`;

  try {
    const params = new URLSearchParams();
    params.set("zoom", String(apartmentMapZoom));
    params.set("rankingScope", scope.mode);
    if (scope.mode === "dong") params.set("dongKey", scope.key);
    if (scope.mode === "sigungu") params.set("sigunguCode", scope.key);
    if (scope.mode === "sido") params.set("sidoCode", scope.key);
    if (els.startInput.value) params.set("start", els.startInput.value.replace("-", ""));
    if (els.endInput.value) params.set("end", els.endInput.value.replace("-", ""));
    appendHouseholdFilterParam(params);
    const endpoint = currentMapSource() === "molit" ? "/api/molit-zoom-map-summary" : "/api/zoom-map-summary";
    const data = await api(`${endpoint}?${params}`);
    if (
      requestId !== state.mapRankingRequestId
      || currentMapRankingTargetLevel(state.latestZoomMapData?.level) !== "apartment"
      || state.mapRankingMode !== scope.mode
      || state.mapRankingScopes?.[scope.mode]?.key !== scope.key
      || signature !== mapScopedRankingSignature(scope)
    ) return;
    const rows = scopedMapRankingRows(data.items || [], scope);
    const rankTotal = mapScopedRankingTotal(rows, scope);
    if (typeof trackAnalyticsEvent === "function") {
      trackAnalyticsEvent("map_scoped_ranking_opened", {
        rankMode: scope.mode,
        scopeKey: scope.key,
        scopeName: scope.scopeLabel,
        rowCount: rows.length,
        rankTotal,
        mapSource: currentMapSource(),
        periodLabel: mapAnalyticsPeriodLabel()
      });
    }
    renderMapRankingRows(rows, {
      titlePrefix: scope.scopeLabel,
      titleTargetLevel: "apartment",
      titleSuffix: "순위",
      countText: rankTotal && rankTotal !== rows.length ? `${formatInt(rows.length)}/${formatInt(rankTotal)}개` : `${formatInt(rows.length)}개`,
      emptyText: `${scope.scopeLabel}에 표시할 아파트가 없습니다.`,
      rankMode: scope.mode,
      rankTotal: rankTotal || rows.length
    });
    state.mapScopedRankingActiveSignature = signature;
    if (state.mapScopedRankingPendingSignature === signature) state.mapScopedRankingPendingSignature = "";
    scrollFocusedMapRankingRow({ behavior: "auto" });
  } catch (error) {
    if (requestId !== state.mapRankingRequestId) return;
    if (state.mapScopedRankingPendingSignature === signature) state.mapScopedRankingPendingSignature = "";
    setMapRankingTitle({
      prefix: scope.scopeLabel,
      targetLevel: "apartment",
      suffix: "순위"
    });
    els.mapRankingCount.textContent = "";
    els.mapRankingRows.innerHTML = `<div class="map-ranking-empty">${escapeHtml(scope.title)}를 불러오지 못했습니다.</div>`;
  }
}

async function loadMapGroupRankingRows(level, scope, signature = mapGroupRankingSignature(level, scope)) {
  const requestId = ++state.mapRankingRequestId;
  state.mapGroupRankingPendingSignature = signature;
  setMapRankingTitle({
    prefix: scope.scopeLabel,
    targetLevel: level,
    suffix: "상승률 랭킹"
  });
  els.mapRankingCount.textContent = "불러오는 중";
  els.mapRankingRows.innerHTML = `<div class="map-ranking-empty">${escapeHtml(scope.title)}를 불러오는 중입니다.</div>`;

  try {
    const params = new URLSearchParams();
    params.set("zoom", String(mapGroupRankingRequestZoom(level)));
    if (els.startInput.value) params.set("start", els.startInput.value.replace("-", ""));
    if (els.endInput.value) params.set("end", els.endInput.value.replace("-", ""));
    appendHouseholdFilterParam(params);
    const endpoint = currentMapSource() === "molit" ? "/api/molit-zoom-map-summary" : "/api/zoom-map-summary";
    const data = await api(`${endpoint}?${params}`);
    const activeScope = state.mapRankingScopes?.[scope.mode];
    if (
      requestId !== state.mapRankingRequestId
      || currentMapRankingTargetLevel(state.latestZoomMapData?.level) !== level
      || state.mapGroupRankingMode !== scope.mode
      || activeScope?.key !== scope.key
      || activeScope?.targetLevel !== level
      || signature !== mapGroupRankingSignature(level, scope)
    ) return;

    const rows = scopedMapGroupRankingRows(data.items || [], level, scope);
    const rankTotal = mapScopedRankingTotal(rows, scope);
    if (typeof trackAnalyticsEvent === "function") {
      trackAnalyticsEvent("map_group_ranking_opened", {
        level,
        rankMode: scope.mode,
        scopeKey: scope.key,
        scopeName: scope.scopeLabel,
        rowCount: rows.length,
        rankTotal,
        mapSource: currentMapSource(),
        periodLabel: mapAnalyticsPeriodLabel()
      });
    }
    renderMapGroupRankingRows(rows, level, {
      titlePrefix: scope.scopeLabel,
      countText: rankTotal && rankTotal !== rows.length ? `${formatInt(rows.length)}/${formatInt(rankTotal)}개` : `${formatInt(rows.length)}개`,
      emptyText: `${scope.scopeLabel}에 표시할 ${mapGroupRankingLevelLabel(level)}가 없습니다.`,
      rankMode: scope.mode,
      rankTotal: rankTotal || rows.length
    });
    state.mapGroupRankingActiveSignature = signature;
    if (state.mapGroupRankingPendingSignature === signature) state.mapGroupRankingPendingSignature = "";
  } catch (error) {
    if (requestId !== state.mapRankingRequestId) return;
    if (state.mapGroupRankingPendingSignature === signature) state.mapGroupRankingPendingSignature = "";
    setMapRankingTitle({
      prefix: scope.scopeLabel,
      targetLevel: level,
      suffix: "상승률 랭킹"
    });
    els.mapRankingCount.textContent = "";
    els.mapRankingRows.innerHTML = `<div class="map-ranking-empty">${escapeHtml(scope.title)}를 불러오지 못했습니다.</div>`;
  }
}

function normalizeMapRankingTargetLevel(level) {
  const value = String(level || "").trim();
  return mapRankingTargetLevels.includes(value) ? value : "sido";
}

function mapRankingTargetLabel(level) {
  return {
    sido: "시도",
    sigungu: "시군구",
    dong: "동",
    apartment: "아파트"
  }[normalizeMapRankingTargetLevel(level)] || "시도";
}

function currentMapRankingTargetLevel(sourceLevel = state.latestZoomMapData?.level) {
  const normalizedSource = normalizeMapRankingTargetLevel(sourceLevel);
  if (!state.mapRankingTargetManual) {
    state.mapRankingTargetLevel = normalizedSource;
    return normalizedSource;
  }
  const normalizedTarget = normalizeMapRankingTargetLevel(state.mapRankingTargetLevel || normalizedSource);
  state.mapRankingTargetLevel = normalizedTarget;
  return normalizedTarget;
}

function syncMapRankingTargetSelect(level) {
  if (!els.mapRankingTargetSelect) return;
  const normalizedLevel = normalizeMapRankingTargetLevel(level);
  if (els.mapRankingTargetSelect.value !== normalizedLevel) {
    els.mapRankingTargetSelect.value = normalizedLevel;
  }
}

function defaultMapRankingMode(scopes, { includeViewport = true } = {}) {
  if (includeViewport) return "viewport";
  return ["dong", "sigungu", "sido", "country"].find((mode) => scopes?.[mode]) || "country";
}

function closestMapApartmentRankingScopes(sourceLevel, items) {
  const closest = closestMapRankingItem(sortedMapGroupRankingRows(items));
  const scopes = {
    country: mapRankingScope("country", "country", "전국", closest?.countryRankTotal)
  };
  if (!closest) return scopes;

  const sidoCode = mapGroupSidoCode(closest);
  const sidoLabel = mapGroupSidoLabel(closest);
  if (sidoCode && sidoLabel) {
    scopes.sido = mapRankingScope("sido", sidoCode, sidoLabel, closest.sidoRankTotal);
  }

  if (sourceLevel === "sigungu" || sourceLevel === "dong") {
    const sigunguCode = mapGroupSigunguCode(closest);
    const sigunguLabel = mapGroupSigunguLabel(closest);
    if (sigunguCode && sigunguLabel) {
      scopes.sigungu = mapRankingScope("sigungu", sigunguCode, sigunguLabel, closest.sigunguRankTotal);
    }
  }

  if (sourceLevel === "dong") {
    const dongKey = mapGroupDongKey(closest);
    const dongLabel = mapGroupDongLabel(closest);
    if (dongKey && dongLabel) {
      scopes.dong = mapRankingScope("dong", dongKey, dongLabel, closest.dongRankTotal);
    }
  }

  return scopes;
}

function closestMapGroupRankingScopesForContext(level, sourceLevel, items) {
  if (sourceLevel === "apartment") {
    return closestMapGroupRankingScopesFromApartment(level, sortedMapRankingRows(items));
  }
  return closestMapGroupRankingScopes(level, sortedMapGroupRankingRows(items));
}

function closestMapGroupRankingScopesFromApartment(level, rows) {
  const closest = closestMapRankingItem(rows);
  const scopes = {
    country: mapGroupRankingScope("country", "country", "전국", closest?.countryRankTotal, level)
  };
  if (!closest) return scopes;

  if (level === "sigungu" || level === "dong") {
    const sidoCode = mapApartmentSidoCode(closest);
    const sidoLabel = mapApartmentSidoLabel(closest);
    if (sidoCode && sidoLabel) {
      scopes.sido = mapGroupRankingScope("sido", sidoCode, sidoLabel, closest.sidoRankTotal, level);
    }
  }

  if (level === "dong") {
    const sigunguCode = mapApartmentSigunguCode(closest);
    const sigunguLabel = mapApartmentSigunguLabel(closest);
    if (sigunguCode && sigunguLabel) {
      scopes.sigungu = mapGroupRankingScope("sigungu", sigunguCode, sigunguLabel, closest.sigunguRankTotal, level);
    }
  }

  return scopes;
}

function closestMapRankingScopes(rows) {
  const candidates = rows.filter((item) => item.id);
  if (!candidates.length) return { dong: null, sigungu: null, sido: null, country: null };
  const center = currentZoomMapCenter();
  const closest = center
    ? candidates.reduce((best, item) => {
      const distance = mapCoordinateDistance(center, item);
      return distance < best.distance ? { item, distance } : best;
    }, { item: candidates[0], distance: Infinity }).item
    : candidates[0];
  const dongKey = mapApartmentDongKey(closest);
  const dongLabel = mapApartmentDongLabel(closest);
  const sigunguCode = mapApartmentSigunguCode(closest);
  const sigunguLabel = mapApartmentSigunguLabel(closest);
  const sidoCode = mapApartmentSidoCode(closest);
  const sidoLabel = mapApartmentSidoLabel(closest);
  return {
    dong: dongKey && dongLabel ? mapRankingScope("dong", dongKey, dongLabel, closest.dongRankTotal) : null,
    sigungu: sigunguCode && sigunguLabel ? mapRankingScope("sigungu", sigunguCode, sigunguLabel, closest.sigunguRankTotal) : null,
    sido: sidoCode && sidoLabel ? mapRankingScope("sido", sidoCode, sidoLabel, closest.sidoRankTotal) : null,
    country: mapRankingScope("country", "country", "전국", closest.countryRankTotal)
  };
}

function closestMapGroupRankingScopes(level, rows) {
  const candidates = rows.filter((item) => item.type === "group");
  const closest = closestMapRankingItem(candidates);
  const scopes = {
    country: mapGroupRankingScope("country", "country", "전국", closest?.countryRankTotal, level)
  };

  if (level === "sigungu" || level === "dong") {
    const sidoCode = mapGroupSidoCode(closest);
    const sidoLabel = mapGroupSidoLabel(closest);
    if (sidoCode && sidoLabel) {
      scopes.sido = mapGroupRankingScope("sido", sidoCode, sidoLabel, closest?.sidoRankTotal, level);
    }
  }

  if (level === "dong") {
    const sigunguCode = mapGroupSigunguCode(closest);
    const sigunguLabel = mapGroupSigunguLabel(closest);
    if (sigunguCode && sigunguLabel) {
      scopes.sigungu = mapGroupRankingScope("sigungu", sigunguCode, sigunguLabel, closest?.sigunguRankTotal, level);
    }
  }

  return scopes;
}

function closestMapRankingItem(candidates) {
  if (!candidates.length) return null;
  const center = currentZoomMapCenter();
  return center
    ? candidates.reduce((best, item) => {
      const distance = mapCoordinateDistance(center, item);
      return distance < best.distance ? { item, distance } : best;
    }, { item: candidates[0], distance: Infinity }).item
    : candidates[0];
}

function mapRankingScope(mode, key, label, total = null) {
  return {
    mode,
    key,
    scopeLabel: label,
    label: `${label} 순위`,
    title: `${label} 순위`,
    total: Number(total) || null
  };
}

function mapGroupRankingScope(mode, key, label, total = null, targetLevel = "sido") {
  return {
    mode,
    key,
    targetLevel,
    scopeLabel: label,
    label: mapGroupRankingTabLabel(mode, targetLevel),
    title: `${label} ${mapGroupRankingLevelLabel(targetLevel)} 상승률 랭킹`,
    total: Number(total) || null
  };
}

function mapGroupRankingLevelLabel(level) {
  return level === "sigungu" ? "시군구" : zoomLevelLabel(level);
}

function mapGroupRankingTabLabel(mode, targetLevel) {
  if (mode === "country") return "전국";
  if (mode === "sigungu" && targetLevel === "dong") return "시군구 내";
  if (mode === "sido") return "시도 내";
  return "지역 내";
}

function isMapRankingModeAvailable(mode, scopes, { includeViewport = true } = {}) {
  return (includeViewport && mode === "viewport") || Boolean(scopes?.[mode]);
}

function mapRankingPeriodSignature() {
  return {
    source: currentMapSource(),
    start: els.startInput.value || "",
    end: els.endInput.value || "",
    minHouseholdCount: activeMinHouseholdCount()
  };
}

function mapScopedRankingSignature(scope) {
  if (!scope) return "";
  return JSON.stringify({
    kind: "apartment",
    mode: scope.mode,
    key: scope.key,
    ...mapRankingPeriodSignature()
  });
}

function mapGroupRankingSignature(level, scope) {
  if (!scope) return "";
  return JSON.stringify({
    kind: "group",
    level,
    mode: scope.mode,
    key: scope.key,
    targetLevel: scope.targetLevel || level,
    ...mapRankingPeriodSignature()
  });
}

function shouldReuseMapScopedRanking(signature) {
  return Boolean(signature && (
    state.mapScopedRankingActiveSignature === signature
    || state.mapScopedRankingPendingSignature === signature
  ));
}

function shouldReuseMapGroupRanking(signature) {
  return Boolean(signature && (
    state.mapGroupRankingActiveSignature === signature
    || state.mapGroupRankingPendingSignature === signature
  ));
}

function clearMapScopedRankingSignatures() {
  state.mapScopedRankingActiveSignature = "";
  state.mapScopedRankingPendingSignature = "";
}

function clearMapGroupRankingSignatures() {
  state.mapGroupRankingActiveSignature = "";
  state.mapGroupRankingPendingSignature = "";
}

function isMapGroupRankingLevel(level) {
  return ["sido", "sigungu", "dong"].includes(level);
}

function mapGroupRankingModes(level) {
  if (level === "dong") return ["sigungu", "sido", "country"];
  if (level === "sigungu") return ["sido", "country"];
  if (level === "sido") return ["country"];
  return ["country"];
}

function mapGroupRankingMode(level, mode, scopes) {
  const modes = mapGroupRankingModes(level);
  if (modes.includes(mode) && scopes?.[mode]) return mode;
  return modes.find((candidate) => scopes?.[candidate]) || "country";
}

function mapGroupRankingRequestZoom(level) {
  if (level === "dong") return 13;
  if (level === "sigungu") return 11;
  return 10;
}

function mapApartmentDongKey(item) {
  return String(item?.dongKey || item?.legalDongCode || "").trim();
}

function mapApartmentDongLabel(item) {
  return String(item?.dongName || item?.neighborhoodName || "").trim();
}

function mapApartmentSigunguCode(item) {
  return String(item?.sigunguCode || "").trim() || String(item?.dongKey || item?.legalDongCode || "").slice(0, 5);
}

function mapApartmentSigunguLabel(item) {
  return shortZoomLabel(item?.sigunguName || item?.address || "", "sigungu") || String(item?.sigunguName || "").trim();
}

function mapApartmentSidoCode(item) {
  return String(item?.sidoCode || "").trim()
    || String(item?.sigunguCode || item?.dongKey || item?.legalDongCode || "").slice(0, 2);
}

function mapApartmentSidoLabel(item) {
  return shortRegionLabel(item?.sidoName || "") || String(item?.sidoName || "").trim();
}

function mapGroupSidoCode(item) {
  return String(item?.sidoCode || "").trim()
    || String(item?.code || item?.sigunguCode || item?.dongKey || "").slice(0, 2);
}

function mapGroupSidoLabel(item) {
  const name = item?.sidoName || (String(item?.code || "").length <= 2 ? item?.name : "");
  return shortRegionLabel(name || "") || String(name || "").trim();
}

function mapGroupSigunguCode(item) {
  return String(item?.sigunguCode || "").trim()
    || String(item?.code || item?.dongKey || "").slice(0, 5);
}

function mapGroupSigunguLabel(item) {
  const name = item?.sigunguName || (String(item?.code || "").length === 5 ? item?.name : "");
  return shortZoomLabel(name || "", "sigungu") || String(name || "").trim();
}

function mapGroupDongKey(item) {
  const code = String(item?.dongKey || item?.legalDongCode || item?.code || "").trim();
  return code.length >= 8 ? code : "";
}

function mapGroupDongLabel(item) {
  const code = String(item?.code || "").trim();
  const name = item?.dongName || (code.length >= 8 ? item?.name : "");
  return shortZoomLabel(name || "", "dong") || String(name || "").trim();
}

function scopedMapRankingRows(items, scope) {
  return (items || [])
    .filter((item) => item.type === "apartment" && item.id)
    .filter((item) => {
      if (scope.mode === "dong") return mapApartmentDongKey(item) === scope.key;
      if (scope.mode === "sigungu") return mapApartmentSigunguCode(item) === scope.key;
      if (scope.mode === "sido") return mapApartmentSidoCode(item) === scope.key;
      return scope.mode === "country";
    })
    .sort((a, b) => compareMapScopeRankingRows(a, b, scope.mode));
}

function scopedMapGroupRankingRows(items, level, scope) {
  return (items || [])
    .filter((item) => item.type === "group" && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)))
    .filter((item) => {
      if (scope.mode === "sigungu") return level === "dong" && mapGroupSigunguCode(item) === scope.key;
      if (scope.mode === "sido") return mapGroupSidoCode(item) === scope.key;
      return scope.mode === "country";
    })
    .sort((a, b) => compareMapScopeRankingRows(a, b, scope.mode));
}

function mapRankingRankValue(item, rankMode, fallbackRank) {
  const rankField = {
    dong: "dongRank",
    sigungu: "sigunguRank",
    sido: "sidoRank",
    country: "countryRank"
  }[rankMode];
  const rawRank = rankField ? item?.[rankField] : fallbackRank;
  const rank = Number(rawRank);
  return Number.isFinite(rank) && rank > 0 ? rank : fallbackRank;
}

function mapRankingTotalValue(item, rankMode) {
  const totalField = {
    dong: "dongRankTotal",
    sigungu: "sigunguRankTotal",
    sido: "sidoRankTotal",
    country: "countryRankTotal"
  }[rankMode];
  const total = Number(totalField ? item?.[totalField] : 0);
  return Number.isFinite(total) && total > 0 ? total : null;
}

function mapCoordinateDistance(center, item) {
  const lat = Number(item.lat);
  const lng = Number(item.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Infinity;
  const latDiff = lat - center.lat;
  const lngDiff = lng - center.lng;
  return latDiff * latDiff + lngDiff * lngDiff;
}

function mapDongRankingTotal(rows, fallbackScope) {
  return mapScopedRankingTotal(rows, { mode: "dong", total: fallbackScope?.total });
}

function mapScopedRankingTotal(rows, scope) {
  const fromRows = rows
    .map((item) => mapRankingTotalValue(item, scope.mode))
    .find((value) => Number.isFinite(value) && value > 0);
  return fromRows || Number(scope?.total) || rows.length;
}

function mapAnalyticsPeriodLabel() {
  if (typeof activeMarkerPeriodLabel === "function") return activeMarkerPeriodLabel();
  const months = typeof currentPeriodMonths === "function" ? currentPeriodMonths() : 12;
  return months >= 12 ? `${Math.round(months / 12)}년` : `${months}개월`;
}

function focusMapApartmentFromRanking(item) {
  setFocusedMapApartment(item);
  closeMapApartmentPopup();
  focusMapApartment(item);
}

function openMapApartmentDetailFromRanking(item) {
  setFocusedMapApartment(item);
  focusMapApartment(item);
  openMapApartmentDetail(item.id, item);
}

function focusMapApartment(item) {
  preserveMapRankingDuringFocusNavigation(item);
  suppressZoomMapReloadForVisibleApartment(item);
  moveZoomMapTo(item, apartmentMapZoom);
}

function preserveMapRankingDuringFocusNavigation(item) {
  if (!item?.id || !els.mapRankingSection || els.mapRankingSection.hidden) return;
  state.mapRankingPreserveUntil = Date.now() + 5000;
}

function shouldPreserveMapRankingRender(level) {
  const preserveUntil = Number(state.mapRankingPreserveUntil || 0);
  if (!preserveUntil) return false;
  if (level !== "apartment" || Date.now() >= preserveUntil) {
    state.mapRankingPreserveUntil = 0;
    return false;
  }
  return true;
}

function suppressZoomMapReloadForVisibleApartment(item) {
  if (!item?.id || !state.mapApartmentMarkerRefs.has(item.id)) return;
  clearTimeout(state.zoomMapTimer);
  state.zoomMapTimer = null;
  state.zoomMapRequestId += 1;
  state.zoomMapLoadSuppressedUntil = Date.now() + Math.round(animatedMapMoveDuration * 1000) + 700;
}

function setFocusedMapApartment(item) {
  const previousId = state.focusedMapApartmentId;
  const nextId = item?.id || null;
  state.focusedMapApartmentId = nextId;
  els.mapRankingRows?.querySelectorAll("[data-apartment-id]").forEach((row) => {
    row.classList.toggle("selected", row.dataset.apartmentId === state.focusedMapApartmentId);
  });
  scrollFocusedMapRankingRow();
  updateFocusedMapApartmentMarker(previousId, false);
  updateFocusedMapApartmentMarker(nextId, true);
}

function scrollFocusedMapRankingRow({ behavior = "smooth" } = {}) {
  if (!state.focusedMapApartmentId || !els.mapRankingRows) return;
  const row = [...els.mapRankingRows.querySelectorAll("[data-apartment-id]")]
    .find((item) => item.dataset.apartmentId === state.focusedMapApartmentId);
  if (!row) return;
  row.scrollIntoView({ block: "center", behavior });
}

function updateFocusedMapApartmentMarker(apartmentId, selected) {
  if (!apartmentId) return;
  const ref = state.mapApartmentMarkerRefs.get(apartmentId);
  if (!ref) return;
  if (ref.provider === "leaflet") {
    const markerElement = ref.marker.getElement?.();
    markerElement?.querySelector(".apartment-map-marker")?.classList.toggle("selected", selected);
    ref.marker.setZIndexOffset(selected ? nextZoomMarkerTopZIndex() : ref.baseZIndex);
    return;
  }
  if (ref.provider === "naver") {
    if (typeof ref.marker.setIcon === "function") {
      ref.marker.setIcon(naverLabelIcon(
        apartmentMarkerHtml(ref.item, ref.design),
        ref.size[0],
        ref.size[1],
        apartmentMarkerIconAnchor(ref.size, ref.design, ref.item)
      ));
    }
    setNaverMarkerZIndex(ref.marker, selected ? nextZoomMarkerTopZIndex() : ref.baseZIndex);
  }
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

async function goToCurrentLocation() {
  if (state.mapLocateInProgress) return;
  if (!navigator.geolocation) {
    setMapLocateStatus("error", "위치 불가");
    return;
  }

  if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    setMapLocateStatus("error", "HTTPS 필요");
    return;
  }

  state.mapLocateInProgress = true;
  setMapLocateStatus("loading", "찾는 중");

  try {
    if (!(await initZoomMap())) throw new Error("map-unavailable");
    const position = await getCurrentPosition({
      enableHighAccuracy: true,
      maximumAge: 60000,
      timeout: 10000
    });
    const lat = Number(position.coords.latitude);
    const lng = Number(position.coords.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("invalid-position");

    const currentLocation = { lat, lng };
    renderUserLocationMarker(currentLocation);
    moveZoomMapTo(currentLocation, apartmentMapZoom, { exactZoom: false });
    setMapLocateStatus("active", "현재위치");
  } catch (error) {
    setMapLocateStatus("error", mapLocateErrorLabel(error));
  } finally {
    state.mapLocateInProgress = false;
  }
}

function getCurrentPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function mapLocateErrorLabel(error) {
  if (error?.code === 1) return "권한 필요";
  if (error?.code === 2) return "위치 실패";
  if (error?.code === 3) return "시간 초과";
  return "위치 실패";
}

function setMapLocateStatus(status, label) {
  if (!els.mapLocateBtn) return;
  clearTimeout(state.mapLocateResetTimer);
  els.mapLocateBtn.dataset.status = status;
  els.mapLocateBtn.disabled = status === "loading";
  els.mapLocateBtn.setAttribute("aria-busy", status === "loading" ? "true" : "false");
  const labelEl = els.mapLocateBtn.querySelector(".map-location-text");
  if (labelEl) labelEl.textContent = label || "현재위치";

  if (status === "active" || status === "error") {
    state.mapLocateResetTimer = setTimeout(() => {
      if (!els.mapLocateBtn) return;
      els.mapLocateBtn.dataset.status = "idle";
      els.mapLocateBtn.disabled = false;
      els.mapLocateBtn.setAttribute("aria-busy", "false");
      if (labelEl) labelEl.textContent = "현재위치";
    }, 2400);
  }
}

function renderUserLocationMarker(item) {
  if (state.zoomNaverMap && window.naver?.maps) {
    renderNaverUserLocationMarker(item);
    return;
  }
  if (!state.zoomMap || !window.L) return;

  const position = [item.lat, item.lng];
  if (state.userLocationMarker) {
    state.userLocationMarker.setLatLng(position);
    return;
  }

  state.userLocationMarker = L.marker(position, {
    zIndexOffset: 50000,
    icon: L.divIcon({
      className: "map-user-location-marker",
      html: `<span class="map-user-location-dot" aria-hidden="true"></span>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    })
  }).addTo(state.zoomMap);
}

function renderNaverUserLocationMarker(item) {
  const position = new window.naver.maps.LatLng(item.lat, item.lng);
  if (state.userLocationNaverMarker) {
    state.userLocationNaverMarker.setPosition(position);
    state.userLocationNaverMarker.setMap(state.zoomNaverMap);
    return;
  }

  state.userLocationNaverMarker = new window.naver.maps.Marker({
    position,
    map: state.zoomNaverMap,
    zIndex: 50000,
    icon: naverLabelIcon(`<span class="map-user-location-dot" aria-hidden="true"></span>`, 34, 34)
  });
}

function clearNaverUserLocationMarker() {
  if (!state.userLocationNaverMarker) return;
  state.userLocationNaverMarker.setMap(null);
  state.userLocationNaverMarker = null;
}

function zoomGroupTargetZoom(level, currentZoom) {
  if (level === "sido") return Math.max(Number(currentZoom || 0) + 1, 11);
  if (level === "sigungu") return Math.max(Number(currentZoom || 0) + 1, 13);
  if (level === "dong") return apartmentMapZoom;
  return Math.max(Number(currentZoom || 0) + 1, apartmentMapZoom);
}

function zoomMarkerBaseZIndex(level) {
  return {
    sido: 100,
    sigungu: 200,
    dong: 300,
    apartment: 400
  }[level] || 100;
}

function zoomApartmentMarkerBaseZIndex(item) {
  return item?.hasData === false ? 350 : zoomMarkerBaseZIndex("apartment");
}

function setNaverMarkerZIndex(marker, zIndex) {
  if (typeof marker.setZIndex === "function") marker.setZIndex(zIndex);
}

function nextZoomMarkerTopZIndex() {
  state.zoomMarkerTopZIndex += 1;
  return state.zoomMarkerTopZIndex;
}

function clearZoomMapOverlays() {
  cancelProgressiveMarkerRender();
  state.zoomMarkerTopZIndex = 10000;
  state.mapApartmentMarkerRefs.clear();
  closeZoomNaverHoverWindow();
  if (state.zoomNaverMap) {
    clearZoomNaverOverlays();
    return;
  }
  state.zoomMapLayer?.clearLayers();
}

function clearZoomNaverOverlays() {
  cancelZoomNaverInfoWindowClose();
  closeZoomNaverHoverWindow();
  for (const overlay of state.zoomNaverOverlays) {
    try {
      overlay.setMap(null);
    } catch {
      // Naver's SDK can throw while detaching already-invalid custom markers.
    }
  }
  state.zoomNaverOverlays = [];
  state.zoomNaverInfoWindowPinned = false;
  if (state.zoomNaverInfoWindow) state.zoomNaverInfoWindow.close();
}

function renderZoomGroupMarker(item, level) {
  if (state.zoomNaverMap && window.naver?.maps) {
    renderNaverZoomGroupMarker(item, level);
    return;
  }
  const design = activeRegionMarkerDesign(level);
  const [width, height] = zoomMarkerSize(level, design, item);
  const baseZIndex = zoomMarkerBaseZIndex(level);
  const marker = L.marker([item.lat, item.lng], {
    zIndexOffset: baseZIndex,
    icon: L.divIcon({
      className: "zoom-cluster-marker",
      html: zoomGroupMarkerContentHtml(item, level, design),
      iconSize: [width, height],
      iconAnchor: zoomMarkerAnchor(level, design, item)
    })
  }).addTo(state.zoomMapLayer);
  marker.bindPopup(zoomGroupPopup(item));
  marker.on("mouseover", () => {
    marker.setZIndexOffset(nextZoomMarkerTopZIndex());
    openLeafletMarkerHoverWindow(marker, regionHoverHtml(item, level));
  });
  marker.on("mouseout", () => scheduleZoomNaverHoverWindowClose());
  marker.on("click", (event) => {
    suppressMapPopupClose();
    stopLeafletClick(event);
    closeZoomNaverHoverWindow();
    closeMapApartmentPopup();
    moveZoomMapTo(item, zoomGroupTargetZoom(level, state.zoomMap.getZoom()), { exactZoom: true });
  });
}

function renderZoomApartmentMarker(item) {
  if (state.zoomNaverMap && window.naver?.maps) {
    renderNaverZoomApartmentMarker(item);
    return;
  }
  const design = activeApartmentMarkerDesign();
  const [width, height] = apartmentMarkerIconSize(design, item);
  const baseZIndex = zoomApartmentMarkerBaseZIndex(item);
  const marker = L.marker([item.lat, item.lng], {
    zIndexOffset: item.id === state.focusedMapApartmentId ? nextZoomMarkerTopZIndex() : baseZIndex,
    icon: L.divIcon({
      className: "apartment-map-marker-shell",
      html: apartmentMarkerHtml(item, design),
      iconSize: [width, height],
      iconAnchor: apartmentMarkerIconAnchor([width, height], design, item)
    })
  }).addTo(state.zoomMapLayer);
  registerMapApartmentMarkerRef(item, {
    provider: "leaflet",
    marker,
    item,
    design,
    baseZIndex
  });
  marker.on("mouseover", () => {
    marker.setZIndexOffset(nextZoomMarkerTopZIndex());
    openLeafletMarkerHoverWindow(marker, apartmentHoverHtml(item));
  });
  marker.on("mouseout", () => scheduleZoomNaverHoverWindowClose());
  marker.on("click", (event) => {
    suppressMapPopupClose();
    stopLeafletClick(event);
    closeZoomNaverHoverWindow();
    setFocusedMapApartment(item);
    openMapApartmentDetail(item.id, item);
  });
}

function renderNaverZoomGroupMarker(item, level) {
  const position = new window.naver.maps.LatLng(item.lat, item.lng);
  const design = activeRegionMarkerDesign(level);
  const [width, height] = zoomMarkerSize(level, design, item);
  const iconAnchor = [width / 2, height / 2];
  const baseZIndex = zoomMarkerBaseZIndex(level);
  const marker = new window.naver.maps.Marker({
    position,
    map: state.zoomNaverMap,
    zIndex: baseZIndex,
    icon: naverLabelIcon(`
      <div class="zoom-cluster-marker" style="width:${width}px;height:${height}px">
        ${zoomGroupMarkerContentHtml(item, level, design)}
      </div>
    `, width, height, iconAnchor)
  });
  window.naver.maps.Event.addListener(marker, "mouseover", (event) => {
    setNaverMarkerZIndex(marker, nextZoomMarkerTopZIndex());
    openZoomNaverHoverWindow(position, regionHoverHtml(item, level), { size: [width, height], anchor: iconAnchor, event });
  });
  window.naver.maps.Event.addListener(marker, "mouseout", () => {
    scheduleZoomNaverHoverWindowClose();
  });
  window.naver.maps.Event.addListener(marker, "click", () => {
    suppressMapPopupClose();
    closeZoomNaverHoverWindow();
    cancelZoomNaverInfoWindowClose();
    closeMapApartmentPopup();
    openZoomNaverInfoWindow(position, zoomGroupPopup(item), { pinned: true });
    moveZoomMapTo(item, zoomGroupTargetZoom(level, state.zoomNaverMap.getZoom()), { exactZoom: true });
  });
  state.zoomNaverOverlays.push(marker);
}

function renderNaverZoomApartmentMarker(item) {
  const position = new window.naver.maps.LatLng(item.lat, item.lng);
  const design = activeApartmentMarkerDesign();
  const [width, height] = apartmentMarkerIconSize(design, item);
  const iconAnchor = apartmentMarkerIconAnchor([width, height], design, item);
  const baseZIndex = zoomApartmentMarkerBaseZIndex(item);
  const marker = new window.naver.maps.Marker({
    position,
    map: state.zoomNaverMap,
    zIndex: item.id === state.focusedMapApartmentId ? nextZoomMarkerTopZIndex() : baseZIndex,
    icon: naverLabelIcon(apartmentMarkerHtml(item, design), width, height, iconAnchor)
  });
  registerMapApartmentMarkerRef(item, {
    provider: "naver",
    marker,
    item,
    design,
    size: [width, height],
    baseZIndex
  });
  window.naver.maps.Event.addListener(marker, "mouseover", (event) => {
    setNaverMarkerZIndex(marker, nextZoomMarkerTopZIndex());
    openZoomNaverHoverWindow(position, apartmentHoverHtml(item), { size: [width, height], anchor: iconAnchor, event });
  });
  window.naver.maps.Event.addListener(marker, "mouseout", () => {
    scheduleZoomNaverHoverWindowClose();
  });
  window.naver.maps.Event.addListener(marker, "click", () => {
    suppressMapPopupClose();
    closeZoomNaverHoverWindow();
    setFocusedMapApartment(item);
    openMapApartmentDetail(item.id, item);
  });
  state.zoomNaverOverlays.push(marker);
}

function registerMapApartmentMarkerRef(item, ref) {
  if (!item?.id) return;
  state.mapApartmentMarkerRefs.set(item.id, ref);
}

function suppressMapPopupClose() {
  state.mapPopupCloseSuppressedUntil = Date.now() + 160;
}

function closeMapApartmentPopupFromMap() {
  if (Date.now() < state.mapPopupCloseSuppressedUntil) return;
  closeMapApartmentPopup();
}

function stopLeafletClick(event) {
  if (event?.originalEvent && window.L?.DomEvent) {
    L.DomEvent.stopPropagation(event.originalEvent);
  }
}

function shortDongLabel(value) {
  return String(value || "-")
    .replace(/^.+\s([^\s]+)$/g, "$1");
}

function apartmentHoverHtml(item) {
  const hasData = item.hasData !== false;
  const rankRows = apartmentHoverRankRows(item);
  const rankHtml = rankRows.length
    ? `
      <div class="apartment-hover-ranks">
        ${rankRows.map((row) => `
          <span>
            <b>${escapeHtml(row.label)}</b>
            ${escapeHtml(row.rank)}
          </span>
        `).join("")}
      </div>
    `
    : "";
  return `
    <strong>${escapeHtml(item.name)}</strong><br>
    ${escapeHtml(apartmentRegionPath(item) || "-")}<br>
    상승률 ${hasData ? renderGrowthRateText(item.growthRate, item.countryRank, item.countryRankTotal) : `<span class="growth-rate-tone growth-rate-no-data">데이터없음</span>`}
    ${rankHtml}
  `;
}

function regionHoverHtml(item, level = "") {
  const hasData = item.hasData !== false;
  const rankRows = regionHoverRankRows(item, level);
  const rankHtml = rankRows.length
    ? `
      <div class="apartment-hover-ranks">
        ${rankRows.map((row) => `
          <span>
            <b>${escapeHtml(row.label)}</b>
            ${escapeHtml(row.rank)}
          </span>
        `).join("")}
      </div>
    `
    : "";
  const parent = regionHoverParentLabel(item, level);
  return `
    <strong>${escapeHtml(regionHoverTitle(item, level))}</strong><br>
    ${escapeHtml([parent, `${mapAnalyticsPeriodLabel()} 상승률`].filter(Boolean).join(" · "))}<br>
    상승률 ${hasData ? renderGrowthRateText(item.growthRate, ...regionHoverToneRank(item, level)) : `<span class="growth-rate-tone growth-rate-no-data">데이터없음</span>`}
    ${rankHtml}
    ${Number(item.apartmentCount) > 0 ? `<div class="region-hover-count">아파트 ${formatInt(item.apartmentCount)}개</div>` : ""}
  `;
}

function regionHoverTitle(item = {}, level = "") {
  return zoomGroupCurrentLabel(item, level) || item.name || "지역";
}

function regionHoverParentLabel(item = {}, level = "") {
  if (level === "sido") return "";
  if (level === "sigungu") return zoomRankSidoLabel(item);
  if (level === "dong") {
    return [zoomRankSidoLabel(item), zoomRankSigunguLabel(item)]
      .filter((part) => part && !["시도", "시군구"].includes(part))
      .join(" ");
  }
  return "";
}

function regionHoverRankRows(item = {}, level = "") {
  const rows = level === "sido" ? [
    regionHoverRankRow("전국", item.countryRank, item.countryRankTotal)
  ] : level === "sigungu" ? [
    regionHoverRankRow(zoomRankSidoLabel(item), item.sidoRank, item.sidoRankTotal),
    regionHoverRankRow("전국", item.countryRank, item.countryRankTotal)
  ] : level === "dong" ? [
    regionHoverRankRow(zoomRankSigunguLabel(item), item.sigunguRank, item.sigunguRankTotal),
    regionHoverRankRow(zoomRankSidoLabel(item), item.sidoRank, item.sidoRankTotal),
    regionHoverRankRow("전국", item.countryRank, item.countryRankTotal, { includePercent: true })
  ] : [];
  return rows.filter(Boolean);
}

function regionHoverRankRow(label, rank, total, { includePercent = false } = {}) {
  const rankText = formatRankText(rank, total);
  if (rankText === "-") return null;
  const percentText = includePercent ? formatMarkerTopPercentShort(rank, total) : "";
  return {
    label: label || "순위",
    rank: percentText && percentText !== "-" ? `${rankText}(${percentText})` : rankText
  };
}

function regionHoverToneRank(item = {}, level = "") {
  if (level === "sido") return [item.countryRank, item.countryRankTotal];
  if (level === "sigungu") return [item.sidoRank, item.sidoRankTotal];
  if (level === "dong") return [item.sigunguRank, item.sigunguRankTotal];
  return [item.countryRank, item.countryRankTotal];
}

function apartmentRegionPath(item = {}) {
  const sido = zoomRankSidoLabel(item);
  const sigungu = shortZoomLabel(item.sigunguName || item.address || "", "sigungu");
  const dong = shortDongLabel(item.dongName || item.neighborhoodName || "");
  return [sido, sigungu, dong]
    .filter((part) => part && !["시도", "시군구", "동", "-"].includes(part))
    .filter((part, index, parts) => parts.indexOf(part) === index)
    .join(" ");
}

function apartmentHoverRankRows(item = {}) {
  const rows = [
    {
      label: shortDongLabel(item.dongName || item.neighborhoodName || "동"),
      rank: item.dongRank,
      total: item.dongRankTotal
    },
    {
      label: shortZoomLabel(item.sigunguName || item.address || "", "sigungu") || "시군구",
      rank: item.sigunguRank,
      total: item.sigunguRankTotal
    },
    {
      label: zoomRankSidoLabel(item),
      rank: item.sidoRank,
      total: item.sidoRankTotal
    },
    {
      label: "전국",
      rank: item.countryRank,
      total: item.countryRankTotal
    }
  ];
  return rows
    .filter((row) => Number.isFinite(Number(row.rank)))
    .map((row) => ({
      label: row.label,
      rank: formatRankText(row.rank, row.total)
    }));
}
