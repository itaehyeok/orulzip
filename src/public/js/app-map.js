function useNaverMap() {
  return state.clientConfig?.maps?.provider === "naver" && state.clientConfig.maps.naverKeyId;
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

function openZoomNaverInfoWindow(position, html) {
  cancelZoomNaverInfoWindowClose();
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

function cancelZoomNaverInfoWindowClose() {
  if (!state.zoomNaverInfoWindowCloseTimer) return;
  clearTimeout(state.zoomNaverInfoWindowCloseTimer);
  state.zoomNaverInfoWindowCloseTimer = null;
}

function scheduleZoomNaverInfoWindowClose(delay = 120) {
  cancelZoomNaverInfoWindowClose();
  state.zoomNaverInfoWindowCloseTimer = setTimeout(() => {
    state.zoomNaverInfoWindowCloseTimer = null;
    if (state.zoomNaverInfoWindow) state.zoomNaverInfoWindow.close();
  }, delay);
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
    watchNaverAuthFailure();
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

  const endpoint = currentMapSource() === "molit" ? "/api/molit-zoom-map-summary" : "/api/zoom-map-summary";
  const data = await api(`${endpoint}?${params}`);
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

function renderZoomMapSummary(data) {
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
  renderZoomMapItemsWithTransition(items, data.level, { mode: transitionMode });
  state.lastZoomMapRenderZoom = Number.isFinite(renderZoom) ? renderZoom : null;
  state.lastZoomMapRenderLevel = data.level || null;
}

function mapTransitionModeForRender(level) {
  if (!state.lastZoomMapRenderLevel || state.lastZoomMapRenderLevel === level) return "current";
  const configuredMode = activeMapTransitionDesignId();
  return configuredMode === "current" ? "fade" : configuredMode;
}

function renderZoomMapItemsWithTransition(items, level, { mode = "current" } = {}) {
  clearTimeout(state.mapTransitionTimer);
  if (mode === "current" || !hasZoomMapOverlays()) {
    resetMapTransitionState();
    replaceZoomMapItems(items, level, "");
    return;
  }

  const delay = mode === "fade" ? 180 : 260;
  beginMapTransition(mode, level);
  state.mapTransitionTimer = setTimeout(() => {
    replaceZoomMapItems(items, level, mode);
  }, delay);
}

function replaceZoomMapItems(items, level, mode = "") {
  clearZoomMapOverlays();
  if (mode === "fade") {
    setMapTransitionClass("map-transition-entering");
  } else if (mode === "dim" || mode === "badge") {
    setMapTransitionClass("map-transition-arrived");
  }

  for (const item of items) {
    if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) continue;
    if (level === "apartment") {
      renderZoomApartmentMarker(item);
    } else {
      renderZoomGroupMarker(item, level);
    }
  }

  if (mode) {
    clearTimeout(state.mapTransitionTimer);
    state.mapTransitionTimer = setTimeout(resetMapTransitionState, 360);
  }
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
  if (els.mapTransitionStatus) {
    els.mapTransitionStatus.hidden = true;
  }
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
  if (level !== "apartment") {
    state.mapRankingRequestId += 1;
    state.mapRankingDongScope = null;
    state.mapRankingScopes = null;
    state.mapRankingMobileOpen = false;
    els.mapApartmentRanking.classList.remove("ranking-active");
    els.mapApartmentRanking.classList.remove("ranking-open");
    els.mapApartmentRanking.hidden = true;
    els.mapRankingSection.hidden = true;
    els.mapRankingRows.innerHTML = "";
    els.mapRankingCount.textContent = "";
    if (els.mapRankingTabs) els.mapRankingTabs.innerHTML = "";
    updateMobileMapRankingToggle(false);
    return;
  }

  const viewportRows = sortedMapRankingRows(items);
  const scopes = closestMapRankingScopes(viewportRows);
  state.mapRankingScopes = scopes;
  state.mapRankingDongScope = scopes.dong;
  if (!isMapRankingModeAvailable(state.mapRankingMode, scopes)) {
    state.mapRankingMode = "viewport";
  }
  const mode = state.mapRankingMode;

  els.mapApartmentRanking.classList.add("ranking-active");
  els.mapApartmentRanking.hidden = false;
  els.mapRankingSection.hidden = false;
  updateMobileMapRankingToggle(true);
  renderMapRankingTabs(scopes, mode);
  if (mode !== "viewport" && scopes[mode]) {
    loadMapScopedRankingRows(scopes[mode]);
    return;
  }

  state.mapRankingRequestId += 1;
  renderMapRankingRows(viewportRows, {
    title: "현재 지도 랭킹",
    countText: `${formatInt(viewportRows.length)}개`,
    emptyText: "현재 지도에 표시할 아파트가 없습니다."
  });
}

function toggleMobileMapRanking() {
  setMobileMapRankingOpen(!state.mapRankingMobileOpen);
}

function closeMobileMapRanking() {
  if (!state.mapRankingMobileOpen) return;
  setMobileMapRankingOpen(false);
}

function setMobileMapRankingOpen(open) {
  state.mapRankingMobileOpen = Boolean(open);
  els.mapApartmentRanking?.classList.toggle("ranking-open", state.mapRankingMobileOpen);
  updateMobileMapRankingToggle(Boolean(els.mapApartmentRanking && !els.mapApartmentRanking.hidden));
}

function updateMobileMapRankingToggle(available) {
  if (!els.mapRankingToggleBtn) return;
  els.mapRankingToggleBtn.hidden = !available;
  els.mapRankingToggleBtn.textContent = state.mapRankingMobileOpen ? "랭킹 접기" : "랭킹 보기";
  els.mapRankingToggleBtn.setAttribute("aria-expanded", String(state.mapRankingMobileOpen));
  els.mapApartmentRanking?.classList.toggle("ranking-open", state.mapRankingMobileOpen && available);
}

function sortedMapRankingRows(items) {
  return [...items]
    .filter((item) => item.type === "apartment" && item.id)
    .sort(compareMapRankingRows);
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

function renderMapRankingRows(rows, { title, countText, emptyText, rankMode = "viewport", rankTotal = rows.length } = {}) {
  if (els.mapRankingTitle) els.mapRankingTitle.textContent = title || "현재 지도 랭킹";
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
      focusMapApartmentFromRanking(item);
    });
    button.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      const item = itemById.get(button.dataset.apartmentId);
      if (!item) return;
      focusMapApartmentFromRanking(item);
    });
  });
  els.mapRankingRows.querySelectorAll("[data-apartment-detail-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const item = itemById.get(button.dataset.apartmentDetailId);
      if (!item) return;
      setFocusedMapApartment(item);
      focusMapApartment(item);
      openMapApartmentDetail(item.id, item);
    });
  });
}

function renderMapRankingTabs(scopes, mode) {
  if (!els.mapRankingTabs) return;
  const tabs = [
    { mode: "viewport", label: "지도 내" },
    scopes.dong,
    scopes.sigungu,
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
      const nextMode = isMapRankingModeAvailable(requestedMode, scopes) ? requestedMode : "viewport";
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

async function loadMapScopedRankingRows(scope) {
  const requestId = ++state.mapRankingRequestId;
  if (els.mapRankingTitle) els.mapRankingTitle.textContent = scope.title;
  els.mapRankingCount.textContent = "불러오는 중";
  els.mapRankingRows.innerHTML = `<div class="map-ranking-empty">${escapeHtml(scope.title)}를 불러오는 중입니다.</div>`;

  try {
    const params = new URLSearchParams();
    params.set("zoom", String(apartmentMapZoom));
    params.set("rankingScope", scope.mode);
    if (scope.mode === "dong") params.set("dongKey", scope.key);
    if (scope.mode === "sigungu") params.set("sigunguCode", scope.key);
    if (els.startInput.value) params.set("start", els.startInput.value.replace("-", ""));
    if (els.endInput.value) params.set("end", els.endInput.value.replace("-", ""));
    const endpoint = currentMapSource() === "molit" ? "/api/molit-zoom-map-summary" : "/api/zoom-map-summary";
    const data = await api(`${endpoint}?${params}`);
    if (requestId !== state.mapRankingRequestId || state.mapRankingMode !== scope.mode || state.mapRankingScopes?.[scope.mode]?.key !== scope.key) return;
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
      title: scope.title,
      countText: rankTotal && rankTotal !== rows.length ? `${formatInt(rows.length)}/${formatInt(rankTotal)}개` : `${formatInt(rows.length)}개`,
      emptyText: `${scope.scopeLabel}에 표시할 아파트가 없습니다.`,
      rankMode: scope.mode,
      rankTotal: rankTotal || rows.length
    });
    scrollFocusedMapRankingRow({ behavior: "auto" });
  } catch (error) {
    if (requestId !== state.mapRankingRequestId) return;
    if (els.mapRankingTitle) els.mapRankingTitle.textContent = scope.title;
    els.mapRankingCount.textContent = "";
    els.mapRankingRows.innerHTML = `<div class="map-ranking-empty">${escapeHtml(scope.title)}를 불러오지 못했습니다.</div>`;
  }
}

function closestMapRankingScopes(rows) {
  const candidates = rows.filter((item) => item.id);
  if (!candidates.length) return { dong: null, sigungu: null, country: null };
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
  return {
    dong: dongKey && dongLabel ? mapRankingScope("dong", dongKey, dongLabel, closest.dongRankTotal) : null,
    sigungu: sigunguCode && sigunguLabel ? mapRankingScope("sigungu", sigunguCode, sigunguLabel, closest.sigunguRankTotal) : null,
    country: mapRankingScope("country", "country", "전국", closest.countryRankTotal)
  };
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

function isMapRankingModeAvailable(mode, scopes) {
  return mode === "viewport" || Boolean(scopes?.[mode]);
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

function scopedMapRankingRows(items, scope) {
  return (items || [])
    .filter((item) => item.type === "apartment" && item.id)
    .filter((item) => {
      if (scope.mode === "dong") return mapApartmentDongKey(item) === scope.key;
      if (scope.mode === "sigungu") return mapApartmentSigunguCode(item) === scope.key;
      return scope.mode === "country";
    })
    .sort((a, b) => compareMapScopeRankingRows(a, b, scope.mode));
}

function mapRankingRankValue(item, rankMode, fallbackRank) {
  const rankField = {
    dong: "dongRank",
    sigungu: "sigunguRank",
    country: "countryRank"
  }[rankMode];
  const rank = Number(rankField ? item?.[rankField] : fallbackRank);
  return Number.isFinite(rank) ? rank : fallbackRank;
}

function mapRankingTotalValue(item, rankMode) {
  const totalField = {
    dong: "dongRankTotal",
    sigungu: "sigunguRankTotal",
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
        apartmentMarkerIconAnchor(ref.size, ref.design)
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

function setNaverMarkerZIndex(marker, zIndex) {
  if (typeof marker.setZIndex === "function") marker.setZIndex(zIndex);
}

function nextZoomMarkerTopZIndex() {
  state.zoomMarkerTopZIndex += 1;
  return state.zoomMarkerTopZIndex;
}

function clearZoomMapOverlays() {
  state.zoomMarkerTopZIndex = 10000;
  state.mapApartmentMarkerRefs.clear();
  if (state.zoomNaverMap) {
    clearZoomNaverOverlays();
    return;
  }
  state.zoomMapLayer?.clearLayers();
}

function clearZoomNaverOverlays() {
  cancelZoomNaverInfoWindowClose();
  for (const overlay of state.zoomNaverOverlays) {
    try {
      overlay.setMap(null);
    } catch {
      // Naver's SDK can throw while detaching already-invalid custom markers.
    }
  }
  state.zoomNaverOverlays = [];
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
  marker.on("mouseover", () => marker.setZIndexOffset(nextZoomMarkerTopZIndex()));
  marker.on("click", (event) => {
    suppressMapPopupClose();
    stopLeafletClick(event);
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
  const baseZIndex = zoomMarkerBaseZIndex("apartment");
  const marker = L.marker([item.lat, item.lng], {
    zIndexOffset: item.id === state.focusedMapApartmentId ? nextZoomMarkerTopZIndex() : baseZIndex,
    icon: L.divIcon({
      className: "apartment-map-marker-shell",
      html: apartmentMarkerHtml(item, design),
      iconSize: [width, height],
      iconAnchor: apartmentMarkerIconAnchor([width, height], design)
    })
  }).addTo(state.zoomMapLayer);
  registerMapApartmentMarkerRef(item, {
    provider: "leaflet",
    marker,
    item,
    design,
    baseZIndex
  });
  marker.bindTooltip(apartmentHoverHtml(item), {
    className: "apartment-hover-tooltip",
    direction: "top",
    opacity: 1,
    sticky: true
  });
  marker.on("mouseover", () => marker.setZIndexOffset(nextZoomMarkerTopZIndex()));
  marker.on("click", (event) => {
    suppressMapPopupClose();
    stopLeafletClick(event);
    setFocusedMapApartment(item);
    openMapApartmentDetail(item.id, item);
  });
}

function renderNaverZoomGroupMarker(item, level) {
  const position = new window.naver.maps.LatLng(item.lat, item.lng);
  const design = activeRegionMarkerDesign(level);
  const [width, height] = zoomMarkerSize(level, design, item);
  const baseZIndex = zoomMarkerBaseZIndex(level);
  const marker = new window.naver.maps.Marker({
    position,
    map: state.zoomNaverMap,
    zIndex: baseZIndex,
    icon: naverLabelIcon(`
      <div class="zoom-cluster-marker" style="width:${width}px;height:${height}px">
        ${zoomGroupMarkerContentHtml(item, level, design)}
      </div>
    `, width, height)
  });
  window.naver.maps.Event.addListener(marker, "mouseover", () => {
    setNaverMarkerZIndex(marker, nextZoomMarkerTopZIndex());
  });
  window.naver.maps.Event.addListener(marker, "click", () => {
    suppressMapPopupClose();
    closeMapApartmentPopup();
    openZoomNaverInfoWindow(position, zoomGroupPopup(item));
    moveZoomMapTo(item, zoomGroupTargetZoom(level, state.zoomNaverMap.getZoom()), { exactZoom: true });
  });
  state.zoomNaverOverlays.push(marker);
}

function renderNaverZoomApartmentMarker(item) {
  const position = new window.naver.maps.LatLng(item.lat, item.lng);
  const design = activeApartmentMarkerDesign();
  const [width, height] = apartmentMarkerIconSize(design, item);
  const baseZIndex = zoomMarkerBaseZIndex("apartment");
  const marker = new window.naver.maps.Marker({
    position,
    map: state.zoomNaverMap,
    zIndex: item.id === state.focusedMapApartmentId ? nextZoomMarkerTopZIndex() : baseZIndex,
    icon: naverLabelIcon(apartmentMarkerHtml(item, design), width, height, apartmentMarkerIconAnchor([width, height], design))
  });
  registerMapApartmentMarkerRef(item, {
    provider: "naver",
    marker,
    item,
    design,
    size: [width, height],
    baseZIndex
  });
  window.naver.maps.Event.addListener(marker, "mouseover", () => {
    setNaverMarkerZIndex(marker, nextZoomMarkerTopZIndex());
    openZoomNaverInfoWindow(position, apartmentHoverHtml(item));
  });
  window.naver.maps.Event.addListener(marker, "mouseout", () => {
    scheduleZoomNaverInfoWindowClose();
  });
  window.naver.maps.Event.addListener(marker, "click", () => {
    suppressMapPopupClose();
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
