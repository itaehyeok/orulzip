import { createNeighborhoodMapProvider } from "./neighborhood-map-provider.js";
import { createNeighborhoodRenderer } from "./neighborhood-map-renderer.js";
import { renderNeighborhoodEvidence, renderNeighborhoodHover } from "./neighborhood-map-evidence.js";

const monthText = month => {
  const value = String(month ?? "").replace("-", "");
  return /^\d{6}$/.test(value) ? value.slice(0, 4) + "." + value.slice(4) : "기준월 없음";
};
const defaultAreas = [
  { id: "dongtan-station", label: "동탄역 주변" },
  { id: "dongtan-mokdong", label: "동탄 목동" },
  { id: "songpa", label: "송파파인타운" }
];

export async function installNeighborhoodMap({ elements, config, initializeNaver, getNaverMap, hideLoading }) {
  await new Promise((resolve, reject) => {
    const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "/css/neighborhood-map.css";
    link.onload = resolve; link.onerror = () => reject(new Error("지도 표시 파일을 읽지 못했습니다.")); document.head.append(link);
  });
  // The private credential has already been stripped by the entry redirect.
  let referrer = document.querySelector('meta[name="referrer"]');
  if (!referrer) { referrer = document.createElement("meta"); referrer.name = "referrer"; document.head.append(referrer); }
  referrer.content = "origin";
  document.body.classList.add("neighborhood-map-mode");
  const logo = document.querySelector(".map-top-logo");
  const wrap = elements.mapCanvasWrap, container = elements.zoomMap;
  const overlay = document.createElement("div"); overlay.className = "nn-overlay";
  const controls = document.createElement("section"); controls.className = "nn-controls"; controls.setAttribute("aria-label", "동네 가격 흐름 표시 설정");
  controls.innerHTML = `<div class="nn-control-head"><label class="nn-toggle"><input type="checkbox" data-nn-toggle checked><span>동네 흐름</span></label><span class="nn-development">개발</span><button type="button" data-nn-reset>선택 지역 보기</button></div>
    <div class="nn-area-row"><label for="nn-area">지도 이동</label><select id="nn-area" data-nn-area aria-label="이동해서 볼 지역"></select></div>
    <div class="nn-dataset-row"><label>자료 <select data-nn-dataset><option value="validated">검증 자료</option><option value="development">개발 DB</option></select></label><span data-nn-source></span></div>
    <div class="nn-time-row"><label for="nn-month">과거 움직임</label><output for="nn-month" data-nn-date></output></div><input id="nn-month" type="range" min="0" max="6" value="6" step="1" aria-label="과거 관측월 선택"><div class="nn-time-ends"><span data-nn-start></span><span data-nn-end></span></div>
    <div class="nn-key"><span>조용함</span><i></i><span>먼저 상승</span><span class="nn-ring-key">○ 상대 부진</span></div><p class="nn-scope" data-nn-scope role="status">선택 지역 자료를 준비하고 있습니다.</p>`;
  const status = document.createElement("div"); status.className = "nn-map-status"; status.setAttribute("role", "status"); status.textContent = "실제 지도에 가격 흐름을 연결하는 중…";
  const tip = document.createElement("div"); tip.className = "nn-hover"; tip.id = "nn-hover"; tip.hidden = true; tip.setAttribute("role", "tooltip");
  const details = document.createElement("aside"); details.className = "nn-details"; details.hidden = true; details.tabIndex = -1;
  details.setAttribute("role", "dialog"); details.setAttribute("aria-label", "선택 단지의 가격 비교 근거");
  details.innerHTML = '<header class="nn-detail-head"><strong>가격 비교 근거</strong><button type="button" data-nn-close aria-label="가격 비교 근거 닫기">닫기 ×</button></header><div class="nn-detail-body"></div>';
  wrap.append(overlay, controls, status, tip, details);
  const initialParams = new URLSearchParams(location.search);
  const mode = initialParams.get("dataset") === "development" ? "development" : "validated";
  const area = controls.querySelector("[data-nn-area]");
  function populateAreas(list, selectedArea) {
    const available = Array.isArray(list) ? list.filter(entry => entry?.id && entry?.label) : [];
    const options = available.length ? [...available].sort((a, b) => defaultAreas.findIndex(entry => entry.id === a.id) - defaultAreas.findIndex(entry => entry.id === b.id)) : defaultAreas;
    area.replaceChildren(...options.map(entry => new Option(entry.label, entry.id)));
    if (![...area.options].some(option => option.value === selectedArea)) area.add(new Option("알 수 없는 지역", selectedArea));
    area.value = selectedArea;
  }
  populateAreas(defaultAreas, initialParams.get("area") ?? "songpa");
  const dataset = controls.querySelector("[data-nn-dataset]"); dataset.value = mode;
  const slider = controls.querySelector("#nn-month"), toggle = controls.querySelector("[data-nn-toggle]");
  let data = null, items = [], selectedId = "", monthIndex = 6, provider, renderer, destroyed = false, mapFailed = false, requestId = 0, resizeObserver;
  let hoverItem = null, hoverNode = null, lastSize = "";
  const selected = () => items.find(item => item.apt_id === selectedId);

  function hideTip() { tip.hidden = true; hoverNode?.removeAttribute("aria-describedby"); hoverItem = null; hoverNode = null; }
  function placeTip(item, button) {
    if (details.contains(document.activeElement)) return;
    tip.innerHTML = renderNeighborhoodHover({ data, item, monthIndex }); tip.hidden = false;
    const anchor = button.getBoundingClientRect(), bounds = wrap.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(wrap.clientWidth - tip.offsetWidth - 8, anchor.left - bounds.left - tip.offsetWidth / 2 + anchor.width / 2)) + "px";
    tip.style.top = Math.max(8, Math.min(wrap.clientHeight - tip.offsetHeight - 8, anchor.top - bounds.top - tip.offsetHeight - 12)) + "px";
    button.setAttribute("aria-describedby", tip.id); hoverItem = item; hoverNode = button;
  }
  function updateDetails() { if (!details.hidden && data && selected()) details.querySelector(".nn-detail-body").innerHTML = renderNeighborhoodEvidence({ data, item: selected(), monthIndex }); }
  function select(item) {
    if (!data || !items.includes(item) || mapFailed) return;
    selectedId = item.apt_id; hideTip(); details.hidden = false; wrap.classList.add("nn-detail-open"); updateDetails(); update();
    details.querySelector("[data-nn-close]").focus({ preventScroll: true });
  }
  function closeDetails() { details.hidden = true; wrap.classList.remove("nn-detail-open"); overlay.querySelector(`[data-apt="${CSS.escape(selectedId)}"]`)?.focus({ preventScroll: true }); }
  function setScope() {
    if (!provider || !data) return;
    const width = overlay.clientWidth, height = overlay.clientHeight;
    const visible = items.some(item => { const p = provider.project(item); return p.x >= 0 && p.y >= 0 && p.x <= width && p.y <= height; });
    controls.querySelector("[data-nn-scope]").textContent = !toggle.checked ? "표시 꺼짐 · 지도 이동과 확대는 계속 사용할 수 있습니다."
      : !items.length ? "선택 지역에 표시할 월별 시세 자료가 없습니다."
      : !visible ? "현재 화면 밖에 선택 지역 자료가 있습니다. ‘선택 지역 보기’를 누르세요."
      : provider.getView().zoom < 14 ? "단지 위치를 확인하려면 지도를 더 확대해 주세요."
      : areaSummary();
  }
  function areaSummary() {
    const label = data?.area?.display_label || data?.area?.label || area.selectedOptions[0]?.textContent || "선택 지역";
    const poolCount = Number.isInteger(data?.area?.pool_count) ? data.area.pool_count : items.length;
    const ids = new Set(items.map(item => String(item.apt_id)));
    const relationships = Object.entries(data?.models || {}).filter(([id, model]) => ids.has(id) && ids.has(String(model?.leader_id))).length;
    const missingHistory = Number(data?.coverage?.missing_history_count) || 0;
    return label + " · " + poolCount + "개 단지 · " +
      (relationships ? "선정 비교 관계 " + relationships + "개" : "비교 관계 0개 · 선정 기준을 충족하지 못했습니다.") +
      (missingHistory > 0 ? " · 과거 월별 변화 자료 부족 " + missingHistory + "개" : "") +
      " · 과거 시세 비교 · 미래 상승 확률 아님";
  }
  function update(immediate = false) {
    if (!renderer || !data || destroyed) return;
    renderer.update({ items, models: data.models, monthIndex, baseMonth: data.timeline.start, months: data.timeline.months, selectedId, enabled: toggle.checked, zoom: provider.getView().zoom });
    if (immediate) renderer.draw({ immediate: true });
    setScope();
  }
  function onView() { if (destroyed) return; update(true); hideTip(); }
  function sizeOverlay() {
    const a = container.getBoundingClientRect(), b = wrap.getBoundingClientRect();
    Object.assign(overlay.style, { left: a.left - b.left + "px", top: a.top - b.top + "px", width: a.width + "px", height: a.height + "px" });
    const size = a.width + ":" + a.height;
    if (size !== lastSize) { lastSize = size; provider?.resize(); }
    renderer?.draw();
  }
  function fitRegion() {
    if (!items.length || !provider) return;
    hideTip(); details.hidden = true; wrap.classList.remove("nn-detail-open");
    controls.querySelector("[data-nn-scope]").textContent = areaSummary();
    const bounds = container.getBoundingClientRect(), panel = controls.getBoundingClientRect();
    const narrow = bounds.width <= 820;
    const focusIds = data.focus_ids && new Set(data.focus_ids);
    const focusItems = focusIds ? items.filter(item => focusIds.has(item.apt_id)) : items;
    provider.fit(focusItems, narrow
      ? { top: Math.min(bounds.height * .6, panel.bottom - bounds.top + 32), left: 42, right: 42, bottom: 90 }
      : { top: 70, left: panel.right - bounds.left + 45, right: 90, bottom: 90 });
  }
  function entryUrl() {
    return "/map?lab=neighborhood&" + new URLSearchParams({ dataset: dataset.value, area: area.value });
  }
  function syncUrl() {
    const url = new URL(location.href);
    url.searchParams.set("dataset", dataset.value); url.searchParams.set("area", area.value);
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    if (logo) logo.href = entryUrl();
  }
  function clearData(message) {
    hideTip(); details.hidden = true; wrap.classList.remove("nn-detail-open");
    details.querySelector(".nn-detail-body").replaceChildren();
    data = null; items = []; selectedId = "";
    renderer?.update({ items: [], models: {}, selectedId: null, enabled: false });
    slider.disabled = true;
    for (const key of ["source", "start", "end", "date"]) controls.querySelector("[data-nn-" + key + "]").textContent = "";
    controls.querySelector("[data-nn-scope]").textContent = message;
    elements.mapSearchInput.placeholder = "선택 지역 단지 찾기";
    if (elements.zoomMapCount) elements.zoomMapCount.textContent = "";
    if (elements.zoomMapPeriod) elements.zoomMapPeriod.textContent = "";
  }
  async function loadData({ fit = false } = {}) {
    const current = ++requestId, requestedArea = area.value, requestedDataset = dataset.value;
    syncUrl(); clearData("선택 지역 자료를 불러오는 중…");
    status.hidden = false; status.textContent = "가격 자료를 불러오는 중…";
    try {
      if (mapFailed) throw new Error("네이버 지도 연결을 확인한 뒤 새로고침해 주세요.");
      const query = new URLSearchParams({ dataset: requestedDataset, area: requestedArea, scope: "nearby" });
      const response = await fetch("/api/neighborhood-lab?" + query, { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 401 ? "개인 확인 링크로 다시 접속해 주세요." : response.status === 400 ? "지원하지 않는 지역 또는 자료 선택입니다." : "가격 자료를 읽지 못했습니다.");
      const next = await response.json();
      if (current !== requestId || destroyed || mapFailed) return;
      if (next.environment !== "development" || !next.timeline?.months?.length) throw new Error("개발 자료를 확인할 수 없습니다.");
      if (next.area?.id && next.area.id !== requestedArea) throw new Error("선택한 지역과 응답 자료가 다릅니다.");
      if (!next.area?.id && requestedArea !== "songpa") throw new Error("선택 지역 자료를 확인할 수 없습니다.");
      data = next; items = [data.benchmark, ...(Array.isArray(data.current_peers) ? data.current_peers : [])].filter(Boolean);
      populateAreas(data.areas, requestedArea);
      monthIndex = data.timeline.months.length - 1;
      selectedId = items[0]?.apt_id || "";
      slider.max = String(monthIndex); slider.value = String(monthIndex); slider.disabled = false;
      controls.querySelector("[data-nn-source]").textContent = `${data.source} · ${monthText(data.asOf)}`;
      controls.querySelector("[data-nn-start]").textContent = monthText(data.timeline.start);
      controls.querySelector("[data-nn-end]").textContent = monthText(data.timeline.end);
      controls.querySelector("[data-nn-date]").textContent = monthText(data.timeline.months[monthIndex]);
      if (elements.zoomMapTitle) elements.zoomMapTitle.textContent = "동네 가격 흐름 지도 · 개발";
      if (elements.zoomMapCount) elements.zoomMapCount.textContent = `${items.length}개 관측 단지`;
      if (elements.zoomMapPeriod) elements.zoomMapPeriod.textContent = `${monthText(data.timeline.start)}~${monthText(data.timeline.end)}`;
      elements.mapSearchInput.placeholder = (data.area?.display_label || data.area?.label || area.selectedOptions[0]?.textContent || "선택 지역") + " 단지 찾기";
      status.hidden = true; update(); if (fit) fitRegion(); syncUrl();
    } catch (error) {
      if (current === requestId && !destroyed) {
        clearData("선택 지역 자료를 불러오지 못했습니다.");
        status.hidden = false; status.textContent = error.message;
      }
    } finally { if (current === requestId && !destroyed) hideLoading(); }
  }
  slider.disabled = true; syncUrl();
  function changeSelection(fit) {
    if (provider) loadData({ fit });
    else { syncUrl(); clearData("선택 지역 지도를 준비하고 있습니다."); }
  }
  dataset.addEventListener("change", () => changeSelection(false));
  area.addEventListener("change", () => changeSelection(true));
  try {
    provider = await createNeighborhoodMapProvider({ container, config, initializeNaver, getNaverMap, onView, onFailure: error => { mapFailed = true; requestId++; toggle.checked = false; clearData("네이버 지도 연결을 확인해 주세요."); status.hidden = false; status.textContent = error.message; hideLoading(); } });
    renderer = createNeighborhoodRenderer({ container: overlay, project: provider.project, metersToPixels: provider.metersToPixels, onSelect: select, onHover: placeTip, onLeave: hideTip });
    sizeOverlay(); resizeObserver = new ResizeObserver(sizeOverlay); resizeObserver.observe(container);
    await loadData({ fit: true });
  } catch (error) { status.hidden = false; status.textContent = error.message; hideLoading(); }
  slider.addEventListener("input", () => { if (!data) return; monthIndex = Number(slider.value); controls.querySelector("[data-nn-date]").textContent = monthText(data.timeline.months[monthIndex]); hideTip(); update(); updateDetails(); });
  toggle.addEventListener("change", () => { hideTip(); if (!toggle.checked) { details.hidden = true; wrap.classList.remove("nn-detail-open"); } update(); });
  controls.querySelector("[data-nn-reset]").addEventListener("click", fitRegion);
  details.querySelector("[data-nn-close]").addEventListener("click", closeDetails);
  const onKeyDown = event => { if (event.key === "Escape") { hideTip(); if (!details.hidden) closeDetails(); } };
  document.addEventListener("keydown", onKeyDown);
  if (!data) elements.mapSearchInput.placeholder = "선택 지역 단지 찾기";
  const onPageShow = () => provider?.resize(); window.addEventListener("pageshow", onPageShow);
  return {
    provider,
    entryUrl,
    refresh() { provider?.resize(); update(); hideLoading(); },
    search(keyword) { return items.filter(item => String(item.name || "").includes(keyword) || String(item.short_name || item.name || "").startsWith(keyword)).map(item => ({ ...item, id: item.apt_id, type: "apartment", meta: "동네 흐름 관측 자료 · 전용 " + item.area_m2 + "㎡" })); },
    focus(item) { const found = items.find(apartment => apartment.apt_id === (item.apt_id || item.id)); if (found) { provider?.focus(found); select(found); } },
    destroy() { destroyed = true; requestId++; resizeObserver?.disconnect(); renderer?.destroy(); provider?.destroy(); document.removeEventListener("keydown", onKeyDown); window.removeEventListener("pageshow", onPageShow); [overlay, controls, status, tip, details].forEach(node => node.remove()); wrap.classList.remove("nn-detail-open"); document.body.classList.remove("neighborhood-map-mode"); }
  };
}
