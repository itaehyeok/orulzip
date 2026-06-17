function normalizeRoute(pathname) {
  const normalized = String(pathname || "/").replace(/\/+$/, "");
  return normalized || "/";
}

function tabFromLocation() {
  return routeTabs[normalizeRoute(window.location.pathname)] || "map";
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

function pyeongGraphDesign(id, name, overrides = {}) {
  return {
    id,
    name,
    opacity: 0.28,
    lineWidth: 1.5,
    dash: "",
    linecap: "round",
    monochrome: false,
    labelMode: "axis",
    ...overrides
  };
}

function markerDesign(id, name, overrides = {}) {
  return {
    id,
    name,
    group: "기본형",
    showRank: true,
    shape: "card",
    size: "wide",
    rankStyle: "plain",
    rankFormat: "compact",
    rankLabelMode: "short",
    groupRankMode: "parent",
    apartmentRankMode: "dong",
    tone: "solid",
    note: "",
    ...overrides
  };
}

function markerVerbosityOption(id, label, note = "") {
  return { id, label, note };
}

function logoDesign(id, name, overrides = {}) {
  return {
    id,
    name,
    symbol: "minimal-roof",
    tone: "blue",
    style: "line",
    tagline: "",
    ...overrides
  };
}

function mapHeaderDesign(id, name, overrides = {}) {
  return {
    id,
    name,
    headerBg: "#ffffff",
    headerText: "#111827",
    searchBg: "#f3f4f6",
    searchText: "#111827",
    searchPlaceholder: "#667085",
    searchIcon: "#374151",
    chipBg: "#ffffff",
    chipActiveBg: "#e8f0ff",
    chipActiveBorder: "#2367d1",
    chipActiveText: "#2367d1",
    periodBg: "#ffffff",
    mapWater: "#d7e6ef",
    mapLand: "#e8eee2",
    mapRoad: "#e7c88c",
    ...overrides
  };
}
