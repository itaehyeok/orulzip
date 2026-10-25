const leafletAssets = "/assets/neighborhood-map-leaflet";

function loadAsset(url, stylesheet = false) {
  return new Promise((resolve, reject) => {
    const element = document.createElement(stylesheet ? "link" : "script");
    if (stylesheet) { element.rel = "stylesheet"; element.href = url; }
    else element.src = url;
    const timer = setTimeout(() => { element.remove(); reject(new Error("지도 파일 응답이 지연되고 있습니다.")); }, 12000);
    element.onload = () => { clearTimeout(timer); resolve(); };
    element.onerror = () => { clearTimeout(timer); element.remove(); reject(new Error("지도 파일을 읽지 못했습니다.")); };
    document.head.append(element);
  });
}

export async function createNeighborhoodMapProvider({ container, config, initializeNaver, getNaverMap, onView, onTileError }) {
  const center = [37.4805, 127.1311];
  if (config.maps?.naverKeyId && !config.maps.disabled) {
    if (!(await initializeNaver())) throw new Error("개발용 네이버 지도를 시작하지 못했습니다.");
    const map = getNaverMap(), api = window.naver.maps;
    map.setCenter(new api.LatLng(...center));
    map.setZoom(16);
    const project = point => map.getProjection().fromCoordToOffset(new api.LatLng(point.lat, point.lng));
    const events = ["center_changed", "zoom_changed", "bounds_changed", "idle"].map(name => api.Event.addListener(map, name, onView));
    return {
      name: "naver", map, project,
      metersToPixels(meters, point) {
        const a = project(point), b = project({ ...point, lng: point.lng + meters / (111195 * Math.cos(point.lat * Math.PI / 180)) });
        return Math.abs(a.x - b.x);
      },
      getView() { const c = map.getCenter(); return { lat: c.lat(), lng: c.lng(), zoom: map.getZoom() }; },
      fit(items) { if (!items.length) return; const first = new api.LatLng(items[0].lat, items[0].lng); const bounds = new api.LatLngBounds(first, first); items.slice(1).forEach(item => bounds.extend(new api.LatLng(item.lat, item.lng))); map.fitBounds(bounds, { top: 120, right: 100, bottom: 130, left: 100, maxZoom: 16 }); },
      focus(item, zoom = 17) { map.setCenter(new api.LatLng(item.lat, item.lng)); map.setZoom(zoom); },
      resize() { api.Event.trigger(map, "resize"); onView(); },
      destroy() { events.forEach(event => api.Event.removeListener(event)); }
    };
  }

  await Promise.all([loadAsset(leafletAssets + ".css", true), window.L ? Promise.resolve() : loadAsset(leafletAssets + ".js")]);
  const L = window.L;
  const map = L.map(container, { center, zoom: 16, minZoom: 5, maxZoom: 19, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false, zoomControl: false });
  L.control.zoom({ position: "topright" }).addTo(map);
  L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
  const tiles = L.tileLayer(config.neighborhoodLab.tileUrl, {
    maxZoom: 19, updateWhenIdle: true, keepBuffer: 1,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">https://www.openstreetmap.org/copyright</a>'
  }).addTo(map);
  let failed = false;
  tiles.on("tileerror", () => { if (!failed) { failed = true; onTileError(); } });
  map.on("move zoom viewreset resize", onView);
  const project = point => map.latLngToContainerPoint([point.lat, point.lng]);
  return {
    name: "openstreetmap", map, project,
    metersToPixels(meters, point) {
      const a = project(point), b = project({ ...point, lng: point.lng + meters / (111195 * Math.cos(point.lat * Math.PI / 180)) });
      return Math.abs(a.x - b.x);
    },
    getView() { const c = map.getCenter(); return { lat: c.lat, lng: c.lng, zoom: map.getZoom() }; },
    fit(items) { map.fitBounds(items.map(item => [item.lat, item.lng]), { paddingTopLeft: [75, 120], paddingBottomRight: [75, 130], maxZoom: 16, animate: false }); },
    focus(item, zoom = 17) { map.setView([item.lat, item.lng], zoom, { animate: false }); },
    resize() { map.invalidateSize({ animate: false }); onView(); },
    destroy() { tiles.off(); map.off(); map.remove(); }
  };
}
