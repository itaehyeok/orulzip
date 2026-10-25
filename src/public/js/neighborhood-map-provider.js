function projectedPoint(map, api, point) {
  const projection = map?.getProjection?.();
  if (!projection?.fromCoordToOffset) return { x: NaN, y: NaN };
  const offset = projection.fromCoordToOffset(new api.LatLng(point.lat, point.lng));
  return { x: Number(offset?.x), y: Number(offset?.y) };
}

export async function createNeighborhoodMapProvider({ config, initializeNaver, getNaverMap, onView, onFailure = () => {} }) {
  if (config.maps?.disabled || !config.maps?.naverKeyId) {
    throw new Error("기존 오를집의 네이버 지도 설정을 연결해 주세요.");
  }
  if (!(await initializeNaver())) throw new Error("기존 네이버 지도를 시작하지 못했습니다.");
  const map = getNaverMap(), api = window.naver?.maps;
  if (!map || !api) throw new Error("기존 네이버 지도 인스턴스를 찾지 못했습니다.");
  map.setOptions("zoomControlOptions", { position: api.Position.TOP_RIGHT });
  const center = { lat: 37.4805, lng: 127.1311 };
  const started = Date.now();
  while (true) {
    if (getNaverMap() !== map) throw new Error("네이버 지도 연결을 확인하지 못했습니다.");
    const point = projectedPoint(map, api, center);
    if (Number.isFinite(point.x) && Number.isFinite(point.y)) break;
    if (Date.now() - started >= 6000) throw new Error("네이버 지도의 좌표 준비가 지연되고 있습니다.");
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  let destroyed = false, failed = false, frame = 0, monitor;
  const listeners = [];
  const cleanup = () => {
    listeners.splice(0).forEach(listener => api.Event.removeListener(listener));
    clearInterval(monitor);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };
  function live() {
    if (destroyed || failed) return false;
    if (getNaverMap() === map) return true;
    failed = true; cleanup();
    onFailure(new Error("네이버 지도 연결이 끊겼습니다. 지도 설정을 확인한 뒤 새로고침해 주세요."));
    return false;
  }
  function queueView() {
    if (!live() || frame) return;
    frame = requestAnimationFrame(() => { frame = 0; if (live()) onView(); });
  }
  for (const event of ["center_changed", "zoom_changed", "bounds_changed", "idle"]) {
    listeners.push(api.Event.addListener(map, event, queueView));
  }
  monitor = setInterval(live, 500);
  map.setCenter(new api.LatLng(center.lat, center.lng));
  map.setZoom(16);
  const project = point => live() ? projectedPoint(map, api, point) : { x: NaN, y: NaN };
  return {
    name: "naver", map, project,
    metersToPixels(meters, point) {
      if (!point) return NaN;
      const a = project(point), b = project({ ...point, lng: point.lng + meters / (111195 * Math.cos(point.lat * Math.PI / 180)) });
      return Math.abs(a.x - b.x);
    },
    getView() {
      if (!live()) return { lat: NaN, lng: NaN, zoom: NaN };
      const point = map.getCenter();
      return { lat: point.lat(), lng: point.lng(), zoom: map.getZoom() };
    },
    fit(items, padding = {}) {
      if (!items.length || !live()) return;
      const first = new api.LatLng(items[0].lat, items[0].lng);
      const bounds = new api.LatLngBounds(first, first);
      items.slice(1).forEach(item => bounds.extend(new api.LatLng(item.lat, item.lng)));
      map.fitBounds(bounds, { top: 120, right: 100, bottom: 130, left: 100, ...padding, maxZoom: 16 });
    },
    focus(item, zoom = 17) { if (live()) { map.setCenter(new api.LatLng(item.lat, item.lng)); map.setZoom(zoom); } },
    resize() { if (live()) { api.Event.trigger(map, "resize"); queueView(); } },
    destroy() { if (!destroyed) { destroyed = true; cleanup(); } }
  };
}
