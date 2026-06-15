const tabRoutes = {
  map: "/kb-map",
  molitMap: "/map",
  neighborhood: "/neighborhood",
  apartment: "/apartments",
  priceBands: "/price-bands",
  formula: "/formula",
  terms: "/terms",
  design: "/design",
  crawl: "/crawl"
};

const routeTabs = {
  "/": "molitMap",
  "/map": "molitMap",
  "/molit-map": "molitMap",
  "/kb-map": "map",
  "/neighborhood": "neighborhood",
  "/apartments": "apartment",
  "/price-bands": "priceBands",
  "/formula": "formula",
  "/terms": "terms",
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
  userLocationMarker: null,
  userLocationNaverMarker: null,
  zoomMarkerTopZIndex: 10000,
  zoomMapTimer: null,
  zoomMapRequestId: 0,
  mapLocateInProgress: false,
  mapLocateResetTimer: null,
  mapPopupRequestId: 0,
  mapSearchTimer: null,
  mapSearchRequestId: 0,
  mapSearchItems: [],
  mapSearchActiveIndex: -1,
  mapApartmentDetails: new Map(),
  mapPopupDetail: null,
  mapPopupSelectedAreaTypeId: null,
  mapPopupCloseSuppressedUntil: 0,
  activeGraphDesignId: null,
  activePyeongGraphDesignId: null,
  activeMarkerDesignId: null,
  markerVerbosityByLevel: null,
  activeLogoDesignId: null,
  activeMapHeaderDesignId: null,
  apartmentRankMode: "averagePyeong",
  apartmentRankPage: 1,
  apartmentRankPageSize: 50,
  priceBandBasis: "start",
  priceBandKey: "",
  priceBandPage: 1,
  priceBandPageSize: 50,
  markerLineGapPx: null,
  mapDesignCollapsed: true,
  latestZoomMapData: null,
  naverSdkPromise: null,
  latestStatus: null,
  latestMolitStatus: null
};

const colors = ["#2367d1", "#c24132", "#16805f", "#9a5b13", "#7c3aed", "#0f766e", "#b42318", "#475467"];
const defaultGraphDesignId = "clean-line";
const graphDesignStorageKey = "orulzip.graphDesignId";
const defaultPyeongGraphDesignId = "pyeong-soft";
const pyeongGraphDesignStorageKey = "orulzip.pyeongGraphDesignId";
const defaultMarkerDesignId = "verbosity-dong";
const markerDesignStorageKey = "orulzip.markerDesignId";
const markerVerbosityStorageKey = "orulzip.markerVerbosityByLevel";
const markerLevelConfigs = [
  { id: "sido", name: "도시", fullName: "도시 마커", description: "서울, 경기처럼 가장 넓은 단위" },
  { id: "sigungu", name: "시군구", fullName: "시군구 마커", description: "구, 시, 군 단위" },
  { id: "dong", name: "동", fullName: "동 마커", description: "동네 단위" },
  { id: "apartment", name: "아파트", fullName: "아파트 마커", description: "개별 아파트 단위" }
];
const defaultMarkerVerbosityByLevel = Object.fromEntries(markerLevelConfigs.map((level) => [level.id, defaultMarkerDesignId]));
const defaultLogoDesignId = "roof-up-open";
const logoDesignStorageKey = "orulzip.logoDesignId";
const defaultMapHeaderDesignId = "musinsa-black";
const mapHeaderDesignStorageKey = "orulzip.mapHeaderDesignId";
const defaultMarkerLineGapPx = 3;
const markerLineGapStorageKey = "orulzip.markerLineGapPx";
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
  graphDesign("compact-label", "02 컴팩트 라벨", { curve: "linear", fillOpacity: 0, pointMode: "end", labelMode: "none", palette: "market", lineWidth: 2.5, shadow: false })
];
const graphDesignVariantMap = new Map(graphDesignVariants.map((item) => [item.id, item]));
const pyeongGraphDesignVariants = [
  pyeongGraphDesign("pyeong-soft", "01 연한 실선", { opacity: 0.26, lineWidth: 1.7, dash: "" }),
  pyeongGraphDesign("pyeong-dashed", "02 점선", { opacity: 0.34, lineWidth: 1.8, dash: "6 7" }),
  pyeongGraphDesign("pyeong-hairline", "03 얇은 선", { opacity: 0.22, lineWidth: 1.1, dash: "" }),
  pyeongGraphDesign("pyeong-dot", "04 도트", { opacity: 0.34, lineWidth: 2, dash: "1 6", linecap: "round" }),
  pyeongGraphDesign("pyeong-muted", "05 회색 보조", { opacity: 0.3, lineWidth: 1.5, dash: "4 6", monochrome: true })
];
const pyeongGraphDesignVariantMap = new Map(pyeongGraphDesignVariants.map((item) => [item.id, item]));
const markerDesignVariants = [
  markerDesign("verbosity-rate", "01 최소", { group: "정보량 낮음", showRank: false, size: "small", groupRankMode: "none", apartmentRankMode: "none", note: "상승률만 표시" }),
  markerDesign("verbosity-dong", "02 기본", { group: "정보량 낮음", showRank: true, size: "wide", groupRankMode: "parent", apartmentRankMode: "dong", rankLabelMode: "short", note: "바로 위 지역 순위까지" }),
  markerDesign("verbosity-local", "03 지역 2줄", { group: "정보량 중간", showRank: true, size: "medium", groupRankMode: "regional", apartmentRankMode: "local", rankLabelMode: "short", note: "가까운 상위 지역 2개까지" }),
  markerDesign("verbosity-region", "04 지역 3줄", { group: "정보량 중간", showRank: true, size: "tall", groupRankMode: "regional", apartmentRankMode: "regional", rankLabelMode: "short", note: "시도 순위까지 압축 표시" }),
  markerDesign("verbosity-full", "05 전체 순위", { group: "정보량 높음", showRank: true, size: "full", groupRankMode: "all", apartmentRankMode: "full", rankLabelMode: "short", note: "동/구/시/전국 순위" }),
  markerDesign("verbosity-named", "06 지역명 포함", { group: "정보량 높음", showRank: true, size: "full", groupRankMode: "all", apartmentRankMode: "full", rankLabelMode: "named", note: "지역명을 넣은 전체 순위" }),
  markerDesign("verbosity-phrase", "07 문장형", { group: "정보량 높음", showRank: true, size: "sentence", groupRankMode: "full", apartmentRankMode: "full", rankLabelMode: "phrase", note: "목동 상승률 1/14등 형태" }),
  markerDesign("verbosity-compact-full", "08 압축 전체", { group: "정보량 높음", showRank: true, size: "dense", groupRankMode: "all", apartmentRankMode: "full", rankLabelMode: "abbr", note: "짧은 라벨로 전체 순위" })
];
const markerDesignVariantMap = new Map(markerDesignVariants.map((item) => [item.id, item]));
const markerVerbosityOptionsByLevel = {
  sido: [
    markerVerbosityOption("verbosity-rate", "상승률만", "도시명과 상승률만 표시"),
    markerVerbosityOption("verbosity-dong", "전국 순위", "전국 도시 중 순위 표시"),
    markerVerbosityOption("verbosity-phrase", "아파트수 포함", "아파트수와 전국 순위까지 표시")
  ],
  sigungu: [
    markerVerbosityOption("verbosity-rate", "상승률만", "시군구명과 상승률만 표시"),
    markerVerbosityOption("verbosity-dong", "시도 순위", "해당 시도 안 순위 표시"),
    markerVerbosityOption("verbosity-local", "시도+전국", "시도 순위와 전국 순위 표시"),
    markerVerbosityOption("verbosity-phrase", "아파트수 포함", "아파트수와 시도/전국 순위 표시")
  ],
  dong: [
    markerVerbosityOption("verbosity-rate", "상승률만", "동 이름과 상승률만 표시"),
    markerVerbosityOption("verbosity-dong", "구 순위", "해당 구 안 순위 표시"),
    markerVerbosityOption("verbosity-local", "구+시도", "구 순위와 시도 순위 표시"),
    markerVerbosityOption("verbosity-full", "구+시도+전국", "상위 지역 순위를 모두 표시"),
    markerVerbosityOption("verbosity-phrase", "아파트수 포함", "아파트수와 전체 순위 표시")
  ],
  apartment: [
    markerVerbosityOption("verbosity-rate", "상승률만", "상승률만 표시"),
    markerVerbosityOption("verbosity-dong", "동 순위", "해당 동 안 순위 표시"),
    markerVerbosityOption("verbosity-local", "동+구", "동 순위와 구 순위 표시"),
    markerVerbosityOption("verbosity-region", "동+구+시도", "시도 순위까지 표시"),
    markerVerbosityOption("verbosity-full", "동+구+시도+전국", "전체 순위 표시"),
    markerVerbosityOption("verbosity-named", "지역명 포함", "양천구, 서울시처럼 지역명까지 표시")
  ]
};
const logoDesignVariants = [
  logoDesign("minimal-roof", "01 미니멀 루프", { symbol: "minimal-roof", tone: "black", style: "line", tagline: "12번 원안. 상단 헤더에 넣기 좋은 절제된 워드마크" }),
  logoDesign("minimal-roof-blue", "02 블루 포인트", { symbol: "minimal-roof", tone: "blue", style: "line", tagline: "원안 구조에 브랜드 블루 상승선만 더 강조" }),
  logoDesign("roof-up-short", "03 짧은 상승선", { symbol: "roof-up-short", tone: "black", style: "line", tagline: "상승선을 짧게 줄여 더 담백하게 보이는 버전" }),
  logoDesign("roof-up-long", "04 긴 상승선", { symbol: "roof-up-long", tone: "black", style: "line", tagline: "상승 방향을 조금 더 분명하게 보여주는 버전" }),
  logoDesign("roof-up-corner", "05 코너 상승", { symbol: "roof-up-corner", tone: "black", style: "line", tagline: "지붕 안쪽에서 우상향 코너가 올라가는 형태" }),
  logoDesign("roof-up-window", "06 창문 포인트", { symbol: "roof-up-window", tone: "black", style: "line", tagline: "작은 창문을 넣어 집 느낌을 조금 보강" }),
  logoDesign("roof-up-door", "07 문 포인트", { symbol: "roof-up-door", tone: "black", style: "line", tagline: "아주 작은 문 라인으로 주거 이미지를 보강" }),
  logoDesign("roof-up-dot", "08 점 포인트", { symbol: "roof-up-dot", tone: "black", style: "line", tagline: "상승선 끝에 점을 둬 데이터 포인트처럼 보이게 한 버전" }),
  logoDesign("roof-up-peak", "09 피크 라인", { symbol: "roof-up-peak", tone: "black", style: "line", tagline: "차트의 피크를 지붕 아래에 녹인 버전" }),
  logoDesign("roof-up-open", "10 오픈 루프", { symbol: "roof-up-open", tone: "black", style: "line", tagline: "집 박스를 줄이고 지붕과 상승선만 남긴 가장 가벼운 버전" }),
  logoDesign("roof-up-rounded", "11 라운드 루프", { symbol: "roof-up-rounded", tone: "black", style: "line", tagline: "획 끝을 둥글게 살려 모바일에서 부드럽게 보이는 버전" }),
  logoDesign("roof-up-bold", "12 볼드 루프", { symbol: "roof-up-bold", tone: "black", style: "line", tagline: "작은 헤더에서도 잘 보이도록 획을 살짝 굵힌 버전" })
];
const logoDesignVariantMap = new Map(logoDesignVariants.map((item) => [item.id, item]));
const mapHeaderDesignVariants = [
  mapHeaderDesign("musinsa-black", "01 무신사 스타일", { headerBg: "#111111", headerText: "#ffffff", searchBg: "rgba(255,255,255,0.13)", searchText: "#ffffff", searchPlaceholder: "rgba(255,255,255,0.68)", searchIcon: "#e5e7eb", chipBg: "#ffffff", chipActiveBg: "#f3f4f6", chipActiveBorder: "#111111", chipActiveText: "#111111", periodBg: "#ffffff", mapWater: "#ccdfea", mapLand: "#e6ecdf", mapRoad: "#dfb86f" })
];
const mapHeaderDesignVariantMap = new Map(mapHeaderDesignVariants.map((item) => [item.id, item]));
const homeMapView = {
  center: [37.48, 127.18],
  zoom: 12
};
const apartmentMapZoom = 16;
const sidoLabelByCode = {
  11: "서울시",
  26: "부산시",
  27: "대구시",
  28: "인천시",
  29: "광주시",
  30: "대전시",
  31: "울산시",
  36: "세종시",
  41: "경기도",
  42: "강원도",
  43: "충청북도",
  44: "충청남도",
  45: "전라북도",
  46: "전라남도",
  47: "경상북도",
  48: "경상남도",
  50: "제주도"
};
const sigunguLabelByCode = {
  11110: "종로구",
  11140: "중구",
  11170: "용산구",
  11200: "성동구",
  11215: "광진구",
  11230: "동대문구",
  11260: "중랑구",
  11290: "성북구",
  11305: "강북구",
  11320: "도봉구",
  11350: "노원구",
  11380: "은평구",
  11410: "서대문구",
  11440: "마포구",
  11470: "양천구",
  11500: "강서구",
  11530: "구로구",
  11545: "금천구",
  11560: "영등포구",
  11590: "동작구",
  11620: "관악구",
  11650: "서초구",
  11680: "강남구",
  11710: "송파구",
  11740: "강동구",
  41111: "수원시 장안구",
  41113: "수원시 권선구",
  41115: "수원시 팔달구",
  41117: "수원시 영통구",
  41131: "성남시 수정구",
  41133: "성남시 중원구",
  41135: "성남시 분당구",
  41150: "의정부시",
  41171: "안양시 만안구",
  41173: "안양시 동안구",
  41192: "부천시 원미구",
  41194: "부천시 소사구",
  41196: "부천시 오정구",
  41210: "광명시",
  41220: "평택시",
  41250: "동두천시",
  41271: "안산시 상록구",
  41273: "안산시 단원구",
  41281: "고양시 덕양구",
  41285: "고양시 일산동구",
  41287: "고양시 일산서구",
  41290: "과천시",
  41310: "구리시",
  41360: "남양주시",
  41370: "오산시",
  41390: "시흥시",
  41410: "군포시",
  41430: "의왕시",
  41450: "하남시",
  41461: "용인시 처인구",
  41463: "용인시 기흥구",
  41465: "용인시 수지구",
  41480: "파주시",
  41500: "이천시",
  41550: "안성시",
  41570: "김포시",
  41590: "화성시",
  41591: "화성시 만세구",
  41593: "화성시 효행구",
  41595: "화성시 병점구",
  41597: "화성시 동탄구",
  41610: "광주시",
  41630: "양주시",
  41650: "포천시",
  41670: "여주시",
  41800: "연천군",
  41820: "가평군",
  41830: "양평군"
};
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
  designMapHeaderSelected: document.querySelector("#designMapHeaderSelected"),
  mapHeaderDesignGrid: document.querySelector("#mapHeaderDesignGrid"),
  designLogoSelected: document.querySelector("#designLogoSelected"),
  logoDesignGrid: document.querySelector("#logoDesignGrid"),
  designGraphSelected: document.querySelector("#designGraphSelected"),
  graphDesignGrid: document.querySelector("#graphDesignGrid"),
  designPyeongGraphSelected: document.querySelector("#designPyeongGraphSelected"),
  pyeongGraphDesignGrid: document.querySelector("#pyeongGraphDesignGrid"),
  designMarkerSelected: document.querySelector("#designMarkerSelected"),
  markerDesignGrid: document.querySelector("#markerDesignGrid"),
  molitSummary: document.querySelector("#molitSummary"),
  molitCompletionList: document.querySelector("#molitCompletionList"),
  molitCoordinateSummary: document.querySelector("#molitCoordinateSummary"),
  molitCoordinateRows: document.querySelector("#molitCoordinateRows"),
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
  mapSearchPanel: document.querySelector(".map-search-panel"),
  mapSearchInput: document.querySelector("#mapSearchInput"),
  mapSearchResults: document.querySelector("#mapSearchResults"),
  mapLocateBtn: document.querySelector("#mapLocateBtn"),
  mapApartmentPopup: document.querySelector("#mapApartmentPopup"),
  mapPopupTitle: document.querySelector("#mapPopupTitle"),
  mapPopupMeta: document.querySelector("#mapPopupMeta"),
  mapPopupRanks: document.querySelector("#mapPopupRanks"),
  mapPopupPyeongGrowth: document.querySelector("#mapPopupPyeongGrowth"),
  mapPopupCloseBtn: document.querySelector("#mapPopupCloseBtn"),
  mapPopupStats: document.querySelector("#mapPopupStats"),
  mapPopupChart: document.querySelector("#mapPopupChart"),
  mapPopupTooltip: document.querySelector("#mapPopupTooltip"),
  mapDesignPanel: document.querySelector("#mapDesignPanel"),
  mapDesignToggleBtn: document.querySelector("#mapDesignToggleBtn"),
  mapDesignBody: document.querySelector("#mapDesignBody"),
  mapDesignMarkerSelected: document.querySelector("#mapDesignMarkerSelected"),
  mapDesignGraphSelected: document.querySelector("#mapDesignGraphSelected"),
  mapDesignPyeongSelected: document.querySelector("#mapDesignPyeongSelected"),
  mapMarkerDesignGrid: document.querySelector("#mapMarkerDesignGrid"),
  mapMarkerLineGapInput: document.querySelector("#mapMarkerLineGapInput"),
  mapGraphDesignGrid: document.querySelector("#mapGraphDesignGrid"),
  mapPyeongGraphDesignGrid: document.querySelector("#mapPyeongGraphDesignGrid"),
  chart: document.querySelector("#chart"),
  chartPeriod: document.querySelector("#chartPeriod"),
  neighborhoodRows: document.querySelector("#neighborhoodRows"),
  neighborhoodCount: document.querySelector("#neighborhoodCount"),
  apartmentRows: document.querySelector("#apartmentRows"),
  apartmentCount: document.querySelector("#apartmentCount"),
  apartmentHeadRow: document.querySelector("#apartmentHeadRow"),
  apartmentPagination: document.querySelector("#apartmentPagination"),
  apartmentPageSizeSelect: document.querySelector("#apartmentPageSizeSelect"),
  apartmentDetailPanel: document.querySelector("#apartmentDetailPanel"),
  detailTitle: document.querySelector("#detailTitle"),
  detailMeta: document.querySelector("#detailMeta"),
  detailChart: document.querySelector("#detailChart"),
  detailTooltip: document.querySelector("#detailTooltip"),
  priceBandView: document.querySelector("#priceBandView"),
  priceBandRows: document.querySelector("#priceBandRows"),
  priceBandCount: document.querySelector("#priceBandCount"),
  priceBandSummary: document.querySelector("#priceBandSummary"),
  priceBandPagination: document.querySelector("#priceBandPagination"),
  priceBandPageSizeSelect: document.querySelector("#priceBandPageSizeSelect")
};

init();

async function init() {
  state.activeGraphDesignId = readStoredGraphDesignId();
  state.activePyeongGraphDesignId = readStoredPyeongGraphDesignId();
  state.activeMarkerDesignId = readStoredMarkerDesignId();
  state.markerVerbosityByLevel = readStoredMarkerVerbosityByLevel(state.activeMarkerDesignId);
  state.activeLogoDesignId = readStoredLogoDesignId();
  state.activeMapHeaderDesignId = readStoredMapHeaderDesignId();
  state.markerLineGapPx = readStoredMarkerLineGapPx();
  applyMarkerLineGap();
  applyMapHeaderDesign();
  setActiveTab(tabFromLocation());
  bindEvents();
  renderMapDesignPanel();
  await Promise.all([
    loadClientConfig(),
    loadFilters()
  ]);
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
  els.markerDesignGrid?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-marker-design-id]");
    if (!card) return;
    setActiveMarkerDesign(card.dataset.markerDesignId, card.dataset.markerLevel || "all");
  });
  els.mapGraphDesignGrid?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-graph-design-id]");
    if (!card) return;
    setActiveGraphDesign(card.dataset.graphDesignId);
  });
  els.mapPyeongGraphDesignGrid?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-pyeong-graph-design-id]");
    if (!card) return;
    setActivePyeongGraphDesign(card.dataset.pyeongGraphDesignId);
  });
  els.mapMarkerDesignGrid?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-marker-design-id]");
    if (!card) return;
    setActiveMarkerDesign(card.dataset.markerDesignId, card.dataset.markerLevel || "all");
  });
  els.mapMarkerLineGapInput?.addEventListener("input", () => {
    setMarkerLineGapPx(els.mapMarkerLineGapInput.value);
  });
  els.mapDesignToggleBtn?.addEventListener("click", toggleMapDesignPanel);
  els.mapLocateBtn?.addEventListener("click", goToCurrentLocation);

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
    if (!isSearchClick && !isRankingClick) hideMapSearchResults();
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
  const [molitStatus, coordinateAudit] = await Promise.all([
    api("/api/molit/status"),
    api("/api/molit/coordinate-audit?limit=80")
  ]);
  renderMolitStatus(molitStatus);
  renderMolitCoordinateAudit(coordinateAudit);
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
    await loadCrawlTabData();
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

function renderMolitCoordinateAudit(audit) {
  if (!els.molitCoordinateSummary || !els.molitCoordinateRows) return;
  const overview = audit?.overview || {};
  const rows = audit?.rows || [];
  const ready = Number(overview.with_coordinates || 0);
  const total = Number(overview.complexes || 0);
  const review = Number(overview.needs_review || 0);
  const missing = Number(overview.missing_coordinates || 0);

  els.molitCoordinateSummary.textContent = `${formatInt(ready)} / ${formatInt(total)} 좌표 확보 · 점검 ${formatInt(review)}개 · 미확보 ${formatInt(missing)}개`;
  els.molitCoordinateRows.innerHTML = rows.length
    ? rows.map((row) => `
      <tr>
        <td>${row.needsReview ? `<span class="status-pill failed">점검</span>` : coordinateStatusPill(row)}</td>
        <td>
          <strong>${escapeHtml(row.aptName || "-")}</strong><br>
          <span class="muted-cell">${escapeHtml(row.legalDong || "-")}${row.jibun ? ` ${escapeHtml(row.jibun)}` : ""}</span>
        </td>
        <td>${escapeHtml(row.address || "-")}</td>
        <td>
          ${row.kbName ? `<strong>${escapeHtml(row.kbName)}</strong><br><span class="muted-cell">${escapeHtml(row.kbAddress || "-")}</span>` : "-"}
        </td>
        <td>${escapeHtml(coordinateSourceLabel(row.coordSource || row.geocodeStatus || "-"))}</td>
        <td>${row.distanceToKbM === null ? "-" : `${formatInt(row.distanceToKbM)}m`}</td>
        <td>${formatInt(row.dealCount || 0)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="7" class="empty">점검할 좌표 차이 항목이 없습니다.</td></tr>`;
}

function coordinateStatusPill(row) {
  if (row.coordStatus === "ready") return `<span class="status-pill completed">정상</span>`;
  if (row.geocodeStatus === "failed" || row.geocodeStatus === "no_result") return `<span class="status-pill failed">${escapeHtml(coordinateSourceLabel(row.geocodeStatus))}</span>`;
  return `<span class="status-pill pending">미확보</span>`;
}

function coordinateSourceLabel(value) {
  return {
    kb_match: "KB 좌표",
    naver_geocode: "네이버 지오코딩",
    geocoded: "지오코딩 완료",
    no_result: "검색결과 없음",
    failed: "지오코딩 실패",
    pending: "대기"
  }[value] || value || "-";
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
        <td>${escapeHtml(formatPriceBandLocation(row))}</td>
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
    gyeonggi: "경기",
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
    els.mapApartmentRanking.hidden = true;
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
  els.mapApartmentRanking.hidden = false;
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
  const design = activeMarkerDesign(level);
  const [width, height] = zoomMarkerSize(level, design);
  const baseZIndex = zoomMarkerBaseZIndex(level);
  const marker = L.marker([item.lat, item.lng], {
    zIndexOffset: baseZIndex,
    icon: L.divIcon({
      className: "zoom-cluster-marker",
      html: zoomGroupMarkerContentHtml(item, level, design),
      iconSize: [width, height],
      iconAnchor: zoomMarkerAnchor(level, design)
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
  const [width, height] = markerIconSize(activeMarkerDesign("apartment"));
  const baseZIndex = zoomMarkerBaseZIndex("apartment");
  const marker = L.marker([item.lat, item.lng], {
    zIndexOffset: baseZIndex,
    icon: L.divIcon({
      className: "apartment-map-marker-shell",
      html: apartmentMarkerHtml(item),
      iconSize: [width, height],
      iconAnchor: [width / 2, height / 2]
    })
  }).addTo(state.zoomMapLayer);
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
    openMapApartmentDetail(item.id, item);
  });
}

function renderNaverZoomGroupMarker(item, level) {
  const position = new window.naver.maps.LatLng(item.lat, item.lng);
  const design = activeMarkerDesign(level);
  const [width, height] = zoomMarkerSize(level, design);
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
  const [width, height] = markerIconSize(activeMarkerDesign("apartment"));
  const baseZIndex = zoomMarkerBaseZIndex("apartment");
  const marker = new window.naver.maps.Marker({
    position,
    map: state.zoomNaverMap,
    zIndex: baseZIndex,
    icon: naverLabelIcon(apartmentMarkerHtml(item), width, height)
  });
  window.naver.maps.Event.addListener(marker, "mouseover", () => {
    setNaverMarkerZIndex(marker, nextZoomMarkerTopZIndex());
    openZoomNaverInfoWindow(position, apartmentHoverHtml(item));
  });
  window.naver.maps.Event.addListener(marker, "mouseout", () => {
    if (state.zoomNaverInfoWindow) state.zoomNaverInfoWindow.close();
  });
  window.naver.maps.Event.addListener(marker, "click", () => {
    suppressMapPopupClose();
    openMapApartmentDetail(item.id, item);
  });
  state.zoomNaverOverlays.push(marker);
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

function apartmentMarkerHtml(item, design = activeMarkerDesign("apartment")) {
  const hasData = item.hasData !== false;
  const rankLines = design.showRank ? apartmentMarkerRankLines(item, design) : [];
  return `
    <div class="apartment-map-marker marker-${escapeHtml(design.id)} marker-shape-${escapeHtml(design.shape)} marker-tone-${escapeHtml(design.tone)} marker-size-${escapeHtml(design.size)} marker-rank-${escapeHtml(design.rankStyle || "plain")} ${hasData ? "" : "no-data"}" style="--marker-color:${growthColor(item.growthRate)}">
      <span class="marker-rate">${hasData ? formatPercent(item.growthRate) : "데이터없음"}</span>
      ${rankLines.length ? `
        <small class="marker-rank-list marker-rank-label-${escapeHtml(design.rankLabelMode)}">
          ${rankLines.map((line) => `
            <span class="marker-rank-line">
              <span class="marker-rank-label">${escapeHtml(line.label)}</span>
              <b>${escapeHtml(line.rank)}</b>
            </span>
          `).join("")}
        </small>
      ` : ""}
    </div>
  `;
}

function apartmentMarkerRankLines(item, design = activeMarkerDesign("apartment")) {
  const allRows = apartmentMarkerAllRankRows(item, design).filter((row) => row.rank !== "-");
  const mode = design.apartmentRankMode || "dong";
  if (mode === "none") return [];
  if (mode === "dong") return allRows.slice(0, 1);
  if (mode === "local") return allRows.slice(0, 2);
  if (mode === "regional") return allRows.slice(0, 3);
  return allRows;
}

function apartmentMarkerAllRankRows(item, design = activeMarkerDesign("apartment")) {
  const dongLabel = shortDongLabel(item.dongName || item.neighborhoodName || "동");
  const sigunguLabel = shortZoomLabel(item.sigunguName || "", "sigungu") || "구";
  const sidoLabel = zoomRankSidoLabel(item);
  const rows = [
    apartmentRankRow(dongLabel, "동", item.dongRank, item.dongRankTotal, design),
    apartmentRankRow(sigunguLabel, "구", item.sigunguRank, item.sigunguRankTotal, design),
    apartmentRankRow(sidoLabel, "시", item.sidoRank, item.sidoRankTotal, design),
    apartmentRankRow("전국", "전국", item.countryRank, item.countryRankTotal, design)
  ];
  if (design.rankLabelMode !== "phrase") return rows;
  return rows.map((row, index) => ({
    ...row,
    label: index === 0 ? `${row.label} 상승률` : row.label
  }));
}

function apartmentRankRow(label, shortLabel, rank, total, design = activeMarkerDesign("apartment")) {
  return {
    label: compactRankLabel(label, shortLabel, design),
    rank: formatRankText(rank, total)
  };
}

function markerIconSize(design) {
  if (!design.showRank) return [54, 34];
  if (design.size === "sentence") return [116, 48];
  if (design.size === "dense") return [94, 76];
  if (design.size === "medium") return [96, 64];
  if (design.size === "tall") return [104, 78];
  if (design.size === "full") return [116, 92];
  if (design.size === "small") return [70, 42];
  if (design.size === "large") return [92, 58];
  return [82, 48];
}

function shortDongLabel(value) {
  return String(value || "-")
    .replace(/^.+\s([^\s]+)$/g, "$1");
}

function apartmentHoverHtml(item) {
  const hasData = item.hasData !== false;
  return `
    <strong>${escapeHtml(item.name)}</strong><br>
    ${escapeHtml(item.dongName || item.neighborhoodName || "-")}<br>
    상승률 ${hasData ? formatPercent(item.growthRate) : "데이터없음"}
  `;
}

async function openMapApartmentDetail(apartmentId, seedItem = null) {
  const requestId = ++state.mapPopupRequestId;
  const source = currentMapSource();
  const period = currentMapPeriodParams();
  const cacheKey = `${source}:${apartmentId}:${period.start}:${period.end}`;
  state.mapPopupDetail = null;
  state.mapPopupSelectedAreaTypeId = null;
  if (state.mapApartmentDetails.has(cacheKey)) {
    renderMapApartmentDetail(state.mapApartmentDetails.get(cacheKey));
    return;
  }

  renderMapApartmentLoading(seedItem);

  try {
    const endpoint = source === "molit" ? "/api/molit-apartment-detail" : "/api/apartment-detail";
    const params = new URLSearchParams({
      apartmentId,
      start: period.start,
      end: period.end
    });
    const detail = await api(`${endpoint}?${params}`);
    if (requestId !== state.mapPopupRequestId) return;
    state.mapApartmentDetails.set(cacheKey, detail);
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

function renderMapApartmentLoading(seedItem = null) {
  els.mapApartmentPopup.hidden = false;
  els.mapApartmentPopup.classList.add("loading");
  els.mapPopupTitle.textContent = seedItem?.name || "아파트 시세";
  if (els.mapPopupPyeongGrowth) els.mapPopupPyeongGrowth.innerHTML = "";
  if (els.mapPopupRanks) els.mapPopupRanks.innerHTML = "";
  els.mapPopupMeta.textContent = `${seedItem?.neighborhoodName || "-"} / 최근 5년 그래프`;
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
  if (els.mapPopupPyeongGrowth) els.mapPopupPyeongGrowth.innerHTML = "";
  if (els.mapPopupRanks) els.mapPopupRanks.innerHTML = "";
  els.mapPopupMeta.textContent = "불러오기 실패";
  els.mapPopupStats.innerHTML = "";
  els.mapPopupChart.innerHTML = `<div class="empty">시세 데이터를 불러오지 못했습니다.${error?.message ? ` ${escapeHtml(error.message)}` : ""}</div>`;
}

function renderMapApartmentDetail(detail) {
  els.mapApartmentPopup.classList.remove("loading");
  state.mapPopupDetail = detail;
  if (!detail.apartment) {
    els.mapApartmentPopup.hidden = false;
    els.mapPopupTitle.textContent = "아파트 시세";
    if (els.mapPopupPyeongGrowth) els.mapPopupPyeongGrowth.innerHTML = "";
    if (els.mapPopupRanks) els.mapPopupRanks.innerHTML = "";
    els.mapPopupMeta.textContent = "정보 없음";
    els.mapPopupStats.innerHTML = "";
    els.mapPopupChart.innerHTML = `<div class="empty">아파트 정보를 찾지 못했습니다.</div>`;
    return;
  }

  els.mapApartmentPopup.hidden = false;
  els.mapPopupTitle.textContent = detail.apartment.name;
  if (els.mapPopupPyeongGrowth) els.mapPopupPyeongGrowth.innerHTML = "";
  renderMapPopupRanks(detail.rankSummary);

  const latestMonth = detail.months.at(-1);
  if (!latestMonth) {
    if (els.mapPopupPyeongGrowth) els.mapPopupPyeongGrowth.innerHTML = "";
    els.mapPopupMeta.textContent = `${detail.apartment.neighborhoodName || "-"} / 시세 정보 없음`;
    els.mapPopupStats.innerHTML = "";
    els.mapPopupChart.innerHTML = `<div class="empty">표시할 시세 데이터가 없습니다.</div>`;
    return;
  }

  const startMonth = periodStartMonth(latestMonth, 5);
  const months = detail.months.filter((month) => month >= startMonth && month <= latestMonth);
  const graphDesign = activeGraphDesign();
  els.mapPopupMeta.textContent = `${detail.apartment.neighborhoodName || "-"} / ${formatMonth(startMonth)} - ${formatMonth(latestMonth)} / 최근 5년 그래프`;
  const allSeries = detail.areaTypes
    .map((areaType, index) => ({
      ...areaType,
      color: graphDesignColor(graphDesign, index, colors[index % colors.length]),
      prices: areaType.prices.filter((price) => price.yearMonth >= startMonth && price.yearMonth <= latestMonth)
    }))
    .filter((areaType) => areaType.prices.length);

  if (!allSeries.length) {
    if (els.mapPopupPyeongGrowth) els.mapPopupPyeongGrowth.innerHTML = "";
    els.mapPopupStats.innerHTML = "";
    els.mapPopupChart.innerHTML = `<div class="empty">선택 기간의 시세 데이터가 없습니다.</div>`;
    return;
  }

  const selected = selectedMapPopupSeries(allSeries);
  const selectedSeries = selected ? [selected] : [];
  renderMapPopupPyeongGrowth(allSeries, latestMonth);
  els.mapPopupStats.innerHTML = `
    ${renderMapPopupAreaPicker(allSeries, selected)}
    ${selected ? renderMapPopupAreaSummary(selected, latestMonth) : ""}
  `;

  renderMapPopupChart({ months, series: selectedSeries, pyeongSeriesSource: allSeries });
}

function selectedMapPopupSeries(series) {
  if (!series.length) return null;
  const selected = series.find((item) => item.id === state.mapPopupSelectedAreaTypeId);
  if (selected) return selected;
  const fallback = [...series].sort((a, b) =>
    areaTypeDealCount(b) - areaTypeDealCount(a)
    || Number(b.exclusiveAreaPyeong || 0) - Number(a.exclusiveAreaPyeong || 0)
  )[0];
  state.mapPopupSelectedAreaTypeId = fallback?.id || null;
  return fallback || null;
}

function areaTypeDealCount(areaType) {
  const explicit = Number(areaType?.totalDealCount);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return (areaType?.prices || []).reduce((sum, price) => sum + Number(price.dealCount || 0), 0);
}

function renderMapPopupAreaPicker(series, selected) {
  if (!series.length) return "";
  return `
    <div class="map-popup-area-picker">
      <label for="mapPopupAreaSelect">
        <span>평형 선택</span>
        <select id="mapPopupAreaSelect" data-map-popup-area-select>
          ${series.map((item) => `
            <option value="${escapeHtml(item.id)}" ${item.id === selected?.id ? "selected" : ""}>
              ${escapeHtml(item.label || "-")} · 거래 ${formatInt(areaTypeDealCount(item))}건
            </option>
          `).join("")}
        </select>
      </label>
      <em>선택 평형 실거래가 + 평당가격</em>
    </div>
  `;
}

function renderMapPopupPyeongGrowth(series, latestMonth) {
  if (!els.mapPopupPyeongGrowth) return;
  const latest = averageLatestPyeongAtOrBefore(series, latestMonth);
  const rows = [1, 3, 5].map((years) => {
    const start = averageLatestPyeongAtOrBefore(series, periodStartMonth(latestMonth, years));
    if (!Number.isFinite(latest) || !Number.isFinite(start) || !start) {
      return `<em class="no-data">${years}년 없음</em>`;
    }
    const growthRate = (latest - start) / start;
    return `<em class="${growthRate >= 0 ? "positive" : "negative"}">${years}년 ${formatPercent(growthRate)}</em>`;
  }).join("");
  els.mapPopupPyeongGrowth.innerHTML = `
    <span>평당 상승률</span>
    ${rows}
  `;
}

function renderMapPopupRanks(rankSummary) {
  if (!els.mapPopupRanks) return;
  if (!rankSummary) {
    els.mapPopupRanks.innerHTML = "";
    return;
  }
  const rows = [
    {
      label: rankSummary.dongName || "동네",
      rank: rankSummary.dongRank,
      total: rankSummary.dongRankTotal
    },
    {
      label: rankSummary.sigunguName || "구",
      rank: rankSummary.sigunguRank,
      total: rankSummary.sigunguRankTotal
    },
    {
      label: rankSummary.sidoName || "시",
      rank: rankSummary.sidoRank,
      total: rankSummary.sidoRankTotal
    },
    {
      label: "전국",
      rank: rankSummary.countryRank,
      total: rankSummary.countryRankTotal
    }
  ].filter((item) => Number.isFinite(Number(item.rank)));
  els.mapPopupRanks.innerHTML = rows.length
    ? rows.map((item) => `
      <span>
        <b>${escapeHtml(item.label)}</b>
        ${formatRankText(item.rank, item.total)}
      </span>
    `).join("")
    : "";
}

function averagePyeongAtMonth(series, yearMonth) {
  return average(series.flatMap((item) => {
    const price = item.prices.find((entry) => entry.yearMonth === yearMonth);
    return Number.isFinite(Number(price?.pyeongPrice)) ? [Number(price.pyeongPrice)] : [];
  }));
}

function averageLatestPyeongAtOrBefore(series, yearMonth) {
  return average(series.flatMap((item) => {
    const price = latestPriceAtOrBefore(item.prices, yearMonth);
    return Number.isFinite(Number(price?.pyeongPrice)) ? [Number(price.pyeongPrice)] : [];
  }));
}

function renderMapPopupAreaSummary(item, latestMonth) {
  const latest = latestPriceAtOrBefore(item.prices, latestMonth);
  const latestLabel = latest ? formatKoreanPrice(latest.saleMid) : "실거래가 없음";
  return `
    <div class="map-popup-stat map-popup-stat-wide">
      <strong><i style="background:${item.color}"></i>${escapeHtml(item.label || "-")}</strong>
      <span>현재 ${latestLabel}</span>
      <div class="map-popup-change-list">
        ${[1, 3, 5].map((years) => renderMapPopupChangeRow(item, latest, latestMonth, years)).join("")}
      </div>
    </div>
  `;
}

function renderMapPopupChangeRow(item, latest, latestMonth, years) {
  const startMonth = periodStartMonth(latestMonth, years);
  const start = latestPriceAtOrBefore(item.prices, startMonth);
  if (!latest || !start) {
    return `
      <div class="map-popup-change-row no-data">
        <span>${years}년전</span>
        <strong>실거래가 없음</strong>
      </div>
    `;
  }
  const growthAmount = latest.saleMid - start.saleMid;
  const growthRate = start.saleMid ? growthAmount / start.saleMid : null;
  const directionClass = growthAmount >= 0 ? "positive" : "negative";
  return `
    <div class="map-popup-change-row">
      <span>${years}년전</span>
      <strong>${formatKoreanPrice(start.saleMid)} → ${formatKoreanPrice(latest.saleMid)}</strong>
      <em class="${directionClass}">${formatPercent(growthRate)}</em>
    </div>
  `;
}

function latestPriceAtOrBefore(prices, yearMonth) {
  return [...prices]
    .filter((price) => price.yearMonth <= yearMonth)
    .sort((a, b) => String(a.yearMonth).localeCompare(String(b.yearMonth)))
    .at(-1) || null;
}

function renderMapPopupChart({ months, series, pyeongSeriesSource = series }) {
  const result = renderGraphSvg({
    design: activeGraphDesign(),
    interactive: true,
    mode: "popup",
    months,
    series,
    pyeongSeriesSource
  });
  els.mapPopupChart.innerHTML = result.html;
  bindMapPopupChartHover({
    width: result.geometry.width,
    months,
    series,
    pyeongSeriesSource,
    x: result.geometry.x,
    y: result.geometry.y,
    pyeongY: result.geometry.pyeongY
  });
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

function activeGraphDesign() {
  return graphDesignVariantMap.get(state.activeGraphDesignId)
    || graphDesignVariantMap.get(defaultGraphDesignId)
    || graphDesignVariants[0];
}

function activePyeongGraphDesign() {
  return pyeongGraphDesignVariantMap.get(state.activePyeongGraphDesignId)
    || pyeongGraphDesignVariantMap.get(defaultPyeongGraphDesignId)
    || pyeongGraphDesignVariants[0];
}

function readStoredGraphDesignId() {
  try {
    const stored = window.localStorage.getItem(graphDesignStorageKey);
    return graphDesignVariantMap.has(stored) ? stored : defaultGraphDesignId;
  } catch {
    return defaultGraphDesignId;
  }
}

function readStoredPyeongGraphDesignId() {
  try {
    const stored = window.localStorage.getItem(pyeongGraphDesignStorageKey);
    return pyeongGraphDesignVariantMap.has(stored) ? stored : defaultPyeongGraphDesignId;
  } catch {
    return defaultPyeongGraphDesignId;
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
  renderPyeongGraphDesignGallery();
  renderMapDesignPanel();
  if (state.mapPopupDetail && !els.mapApartmentPopup.hidden) {
    renderMapApartmentDetail(state.mapPopupDetail);
  }
}

function setActivePyeongGraphDesign(id) {
  if (!pyeongGraphDesignVariantMap.has(id)) return;
  state.activePyeongGraphDesignId = id;
  try {
    window.localStorage.setItem(pyeongGraphDesignStorageKey, id);
  } catch {
    // localStorage may be disabled in private contexts.
  }
  renderPyeongGraphDesignGallery();
  renderMapDesignPanel();
  renderGraphDesignGallery();
  if (state.mapPopupDetail && !els.mapApartmentPopup.hidden) {
    renderMapApartmentDetail(state.mapPopupDetail);
  }
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

function activeMarkerDesign(level = "apartment") {
  const normalizedLevel = normalizeMarkerLevel(level);
  const levelDesignId = normalizeMarkerDesignIdForLevel(state.markerVerbosityByLevel?.[normalizedLevel], normalizedLevel);
  return markerDesignVariantMap.get(levelDesignId)
    || markerDesignVariantMap.get(state.activeMarkerDesignId)
    || markerDesignVariantMap.get(defaultMarkerDesignId)
    || markerDesignVariants[0];
}

function readStoredMarkerDesignId() {
  try {
    const stored = window.localStorage.getItem(markerDesignStorageKey);
    return markerDesignVariantMap.has(stored) ? stored : defaultMarkerDesignId;
  } catch {
    return defaultMarkerDesignId;
  }
}

function readStoredMarkerVerbosityByLevel(fallbackId = defaultMarkerDesignId) {
  const result = { ...defaultMarkerVerbosityByLevel };
  let hasStoredLevelValue = false;
  try {
    const stored = JSON.parse(window.localStorage.getItem(markerVerbosityStorageKey) || "{}");
    for (const level of markerLevelConfigs) {
      if (markerDesignVariantMap.has(stored?.[level.id])) {
        result[level.id] = normalizeMarkerDesignIdForLevel(stored[level.id], level.id);
        hasStoredLevelValue = true;
      }
    }
  } catch {
    // Ignore malformed localStorage and use defaults.
  }
  if (!hasStoredLevelValue && markerDesignVariantMap.has(fallbackId)) {
    for (const level of markerLevelConfigs) {
      result[level.id] = fallbackId;
    }
  }
  return result;
}

function writeStoredMarkerVerbosityByLevel() {
  try {
    window.localStorage.setItem(markerVerbosityStorageKey, JSON.stringify(state.markerVerbosityByLevel || defaultMarkerVerbosityByLevel));
    window.localStorage.setItem(markerDesignStorageKey, state.markerVerbosityByLevel?.apartment || defaultMarkerDesignId);
  } catch {
    // localStorage may be disabled in private contexts.
  }
}

function setActiveMarkerDesign(id, level = "all") {
  if (!markerDesignVariantMap.has(id)) return;
  const targetLevel = normalizeMarkerLevel(level);
  if (!state.markerVerbosityByLevel) state.markerVerbosityByLevel = { ...defaultMarkerVerbosityByLevel };
  if (level === "all") {
    for (const item of markerLevelConfigs) {
      state.markerVerbosityByLevel[item.id] = normalizeMarkerDesignIdForLevel(id, item.id);
    }
    state.activeMarkerDesignId = id;
  } else {
    if (!isMarkerDesignAllowedForLevel(id, targetLevel)) return;
    state.markerVerbosityByLevel[targetLevel] = id;
    if (targetLevel === "apartment") state.activeMarkerDesignId = id;
  }
  writeStoredMarkerVerbosityByLevel();
  renderMarkerDesignGallery();
  renderMapDesignPanel();
  if (state.latestZoomMapData) {
    renderZoomMapSummary(state.latestZoomMapData);
  }
}

function normalizeMarkerLevel(level = "apartment") {
  return markerLevelConfigs.some((item) => item.id === level) ? level : "apartment";
}

function markerVerbosityOptionsForLevel(level = "apartment") {
  return markerVerbosityOptionsByLevel[normalizeMarkerLevel(level)] || markerVerbosityOptionsByLevel.apartment;
}

function isMarkerDesignAllowedForLevel(id, level = "apartment") {
  return markerVerbosityOptionsForLevel(level).some((item) => item.id === id);
}

function normalizeMarkerDesignIdForLevel(id, level = "apartment") {
  if (isMarkerDesignAllowedForLevel(id, level)) return id;
  const fallback = markerVerbosityOptionsForLevel(level)[0]?.id || defaultMarkerDesignId;
  return markerDesignVariantMap.has(fallback) ? fallback : defaultMarkerDesignId;
}

function markerVerbosityOptionForLevel(level, id) {
  return markerVerbosityOptionsForLevel(level).find((item) => item.id === id)
    || markerVerbosityOptionsForLevel(level)[0]
    || { id: defaultMarkerDesignId, label: "기본", note: "" };
}

function activeLogoDesign() {
  return logoDesignVariantMap.get(state.activeLogoDesignId)
    || logoDesignVariantMap.get(defaultLogoDesignId)
    || logoDesignVariants[0];
}

function readStoredLogoDesignId() {
  try {
    const stored = window.localStorage.getItem(logoDesignStorageKey);
    return logoDesignVariantMap.has(stored) ? stored : defaultLogoDesignId;
  } catch {
    return defaultLogoDesignId;
  }
}

function setActiveLogoDesign(id) {
  if (!logoDesignVariantMap.has(id)) return;
  state.activeLogoDesignId = id;
  try {
    window.localStorage.setItem(logoDesignStorageKey, id);
  } catch {
    // localStorage may be disabled in private contexts.
  }
  renderLogoDesignGallery();
}

function activeMapHeaderDesign() {
  return mapHeaderDesignVariantMap.get(state.activeMapHeaderDesignId)
    || mapHeaderDesignVariantMap.get(defaultMapHeaderDesignId)
    || mapHeaderDesignVariants[0];
}

function readStoredMapHeaderDesignId() {
  try {
    const stored = window.localStorage.getItem(mapHeaderDesignStorageKey);
    return mapHeaderDesignVariantMap.has(stored) ? stored : defaultMapHeaderDesignId;
  } catch {
    return defaultMapHeaderDesignId;
  }
}

function setActiveMapHeaderDesign(id) {
  if (!mapHeaderDesignVariantMap.has(id)) return;
  state.activeMapHeaderDesignId = id;
  try {
    window.localStorage.setItem(mapHeaderDesignStorageKey, id);
  } catch {
    // localStorage may be disabled in private contexts.
  }
  applyMapHeaderDesign();
  renderMapHeaderDesignGallery();
}

function applyMapHeaderDesign() {
  const design = activeMapHeaderDesign();
  const root = document.documentElement;
  root.style.setProperty("--map-header-bg", design.headerBg);
  root.style.setProperty("--map-header-text", design.headerText);
  root.style.setProperty("--map-header-search-bg", design.searchBg);
  root.style.setProperty("--map-header-search-text", design.searchText);
  root.style.setProperty("--map-header-search-placeholder", design.searchPlaceholder);
  root.style.setProperty("--map-header-search-icon", design.searchIcon);
  root.style.setProperty("--map-header-chip-bg", design.chipBg);
  root.style.setProperty("--map-header-chip-active-bg", design.chipActiveBg);
  root.style.setProperty("--map-header-chip-active-border", design.chipActiveBorder);
  root.style.setProperty("--map-header-chip-active-text", design.chipActiveText);
  root.style.setProperty("--map-header-period-bg", design.periodBg);
}

function readStoredMarkerLineGapPx() {
  try {
    return normalizeMarkerLineGapPx(window.localStorage.getItem(markerLineGapStorageKey));
  } catch {
    return defaultMarkerLineGapPx;
  }
}

function setMarkerLineGapPx(value) {
  const next = normalizeMarkerLineGapPx(value);
  state.markerLineGapPx = next;
  applyMarkerLineGap();
  if (els.mapMarkerLineGapInput && Number(els.mapMarkerLineGapInput.value) !== next) {
    els.mapMarkerLineGapInput.value = String(next);
  }
  try {
    window.localStorage.setItem(markerLineGapStorageKey, String(next));
  } catch {
    // localStorage may be disabled in private contexts.
  }
}

function applyMarkerLineGap() {
  document.documentElement.style.setProperty("--marker-line-gap", `${normalizeMarkerLineGapPx(state.markerLineGapPx)}px`);
}

function normalizeMarkerLineGapPx(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return defaultMarkerLineGapPx;
  return Math.max(0, Math.min(10, Math.round(number)));
}

function renderDesignTab() {
  renderMapHeaderDesignGallery();
  renderLogoDesignGallery();
  renderGraphDesignGallery();
  renderPyeongGraphDesignGallery();
  renderMarkerDesignGallery();
  renderMapDesignPanel();
}

function toggleMapDesignPanel() {
  state.mapDesignCollapsed = !state.mapDesignCollapsed;
  renderMapDesignPanel();
}

function renderMapDesignPanel() {
  if (!els.mapDesignPanel) return;
  const graph = activeGraphDesign();
  const pyeongGraph = activePyeongGraphDesign();
  els.mapDesignPanel.classList.toggle("collapsed", state.mapDesignCollapsed);
  if (els.mapDesignToggleBtn) {
    els.mapDesignToggleBtn.textContent = state.mapDesignCollapsed ? "디자인 펼치기" : "디자인 접기";
    els.mapDesignToggleBtn.setAttribute("aria-expanded", String(!state.mapDesignCollapsed));
  }
  if (els.mapDesignGraphSelected) els.mapDesignGraphSelected.textContent = graph.name.replace(/^\d+\s*/, "");
  if (els.mapDesignPyeongSelected) els.mapDesignPyeongSelected.textContent = pyeongGraph.name.replace(/^\d+\s*/, "");
  if (els.mapDesignMarkerSelected) els.mapDesignMarkerSelected.textContent = markerSelectionSummary();
  if (els.mapMarkerLineGapInput) {
    els.mapMarkerLineGapInput.value = String(normalizeMarkerLineGapPx(state.markerLineGapPx));
  }
  if (els.mapGraphDesignGrid) {
    els.mapGraphDesignGrid.innerHTML = graphDesignVariants.map((item) => {
      const isActive = item.id === graph.id;
      return `
        <button class="map-design-option ${isActive ? "active" : ""}" type="button" data-graph-design-id="${escapeHtml(item.id)}" aria-pressed="${isActive}">
          ${escapeHtml(item.name.replace(/^\d+\s*/, ""))}
        </button>
      `;
    }).join("");
  }
  if (els.mapPyeongGraphDesignGrid) {
    els.mapPyeongGraphDesignGrid.innerHTML = pyeongGraphDesignVariants.map((item) => {
      const isActive = item.id === pyeongGraph.id;
      return `
        <button class="map-design-option ${isActive ? "active" : ""}" type="button" data-pyeong-graph-design-id="${escapeHtml(item.id)}" aria-pressed="${isActive}">
          ${escapeHtml(item.name.replace(/^\d+\s*/, ""))}
        </button>
      `;
    }).join("");
  }
  if (els.mapMarkerDesignGrid) {
    els.mapMarkerDesignGrid.innerHTML = renderMarkerVerbosityControls({ mode: "compact" });
  }
}

function groupedMarkerDesignVariants() {
  const groups = [];
  const byName = new Map();
  for (const item of markerDesignVariants) {
    const name = item.group || "기본형";
    if (!byName.has(name)) {
      const group = { name, items: [] };
      byName.set(name, group);
      groups.push(group);
    }
    byName.get(name).items.push(item);
  }
  return groups;
}

function renderMarkerVerbosityControls({ mode = "full" } = {}) {
  return markerLevelConfigs.map((level) => {
    const active = activeMarkerDesign(level.id);
    const options = markerVerbosityOptionsForLevel(level.id);
    const activeOption = markerVerbosityOptionForLevel(level.id, active.id);
    return `
      <section class="marker-info-level marker-info-${escapeHtml(mode)}">
        <div class="marker-info-level-head">
          <div>
            <h3>${escapeHtml(level.fullName)}</h3>
            ${mode === "full" ? `<p>${escapeHtml(level.description)}</p>` : ""}
          </div>
          <span>${escapeHtml(activeOption.label)}</span>
        </div>
        <div class="marker-info-option-grid">
          ${options.map((option, index) => {
            const design = markerDesignVariantMap.get(option.id);
            if (!design) return "";
            const isActive = design.id === active.id;
            return `
              <button class="marker-info-option ${isActive ? "active" : ""}" type="button" data-marker-level="${escapeHtml(level.id)}" data-marker-design-id="${escapeHtml(design.id)}" aria-pressed="${isActive}">
                <span class="marker-info-option-head">
                  <strong>${escapeHtml(option.label)}</strong>
                  ${mode === "full" ? `<em>${isActive ? "선택됨" : `${String(index + 1).padStart(2, "0")}/${options.length}`}</em>` : ""}
                </span>
                ${mode === "full" && option.note ? `<small>${escapeHtml(option.note)}</small>` : ""}
                ${mode === "full" ? markerInfoPreviewHtml(level.id, design) : ""}
              </button>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }).join("");
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
          <em>${isActive ? "선택됨" : `${String(index + 1).padStart(2, "0")}/${graphDesignVariants.length}`}</em>
        </span>
        <span class="graph-design-preview">${result.html}</span>
      </button>
    `;
  }).join("");
}

function renderPyeongGraphDesignGallery() {
  if (!els.pyeongGraphDesignGrid) return;
  const sample = graphDesignSampleData();
  const active = activePyeongGraphDesign();
  els.designPyeongGraphSelected.textContent = `${active.name} / ${pyeongGraphDesignVariants.length}개`;
  els.pyeongGraphDesignGrid.innerHTML = pyeongGraphDesignVariants.map((design, index) => {
    const result = renderGraphSvg({
      design: activeGraphDesign(),
      pyeongDesign: design,
      interactive: false,
      mode: "preview",
      months: sample.months,
      series: sample.series.map((item, seriesIndex) => ({
        ...item,
        color: graphDesignColor(activeGraphDesign(), seriesIndex, item.color)
      }))
    });
    const isActive = design.id === active.id;
    return `
      <button class="graph-design-card ${isActive ? "active" : ""}" type="button" data-pyeong-graph-design-id="${escapeHtml(design.id)}" aria-pressed="${isActive}">
        <span class="graph-design-card-head">
          <strong>${escapeHtml(design.name)}</strong>
          <em>${isActive ? "선택됨" : `${String(index + 1).padStart(2, "0")}/${pyeongGraphDesignVariants.length}`}</em>
        </span>
        <span class="graph-design-preview">${result.html}</span>
      </button>
    `;
  }).join("");
}

function renderMarkerDesignGallery() {
  if (!els.markerDesignGrid) return;
  els.designMarkerSelected.textContent = markerSelectionSummary();
  els.markerDesignGrid.innerHTML = renderMarkerVerbosityControls({ mode: "full" });
}

function renderMapHeaderDesignGallery() {
  if (!els.mapHeaderDesignGrid) return;
  const active = activeMapHeaderDesign();
  if (els.designMapHeaderSelected) {
    els.designMapHeaderSelected.textContent = `${active.name} / ${mapHeaderDesignVariants.length}개`;
  }
  els.mapHeaderDesignGrid.innerHTML = mapHeaderDesignVariants.map((design, index) => {
    const isActive = design.id === active.id;
    return `
      <button class="map-header-design-card ${isActive ? "active" : ""}" type="button" data-map-header-design-id="${escapeHtml(design.id)}" aria-pressed="${isActive}">
        <span class="graph-design-card-head">
          <strong>${escapeHtml(design.name)}</strong>
          <em>${isActive ? "선택됨" : `${String(index + 1).padStart(2, "0")}/${mapHeaderDesignVariants.length}`}</em>
        </span>
        <span class="map-header-design-preview" style="${mapHeaderPreviewStyle(design)}">
          <span class="map-header-preview-top">
            <span class="map-header-preview-logo">${logoSymbolSvg("roof-up-open")}</span>
            <span class="map-header-preview-search">동 또는 아파트</span>
          </span>
          <span class="map-header-preview-tabs">
            <span class="active">지도</span>
            <span>가격대별</span>
            <span>디자인</span>
            <span>더보기</span>
          </span>
          <span class="map-header-preview-periods">
            <span>3개월전</span>
            <span>6개월전</span>
            <span class="active">1년전</span>
            <span>3년전</span>
          </span>
          <span class="map-header-preview-map">
            <span class="preview-road road-a"></span>
            <span class="preview-road road-b"></span>
            <span class="preview-water"></span>
            <span class="preview-marker marker-a">12.4%</span>
            <span class="preview-marker marker-b">8.7%</span>
          </span>
        </span>
      </button>
    `;
  }).join("");
}

function mapHeaderPreviewStyle(design) {
  return [
    `--preview-header-bg:${design.headerBg}`,
    `--preview-header-text:${design.headerText}`,
    `--preview-search-bg:${design.searchBg}`,
    `--preview-search-text:${design.searchText}`,
    `--preview-search-placeholder:${design.searchPlaceholder}`,
    `--preview-search-icon:${design.searchIcon}`,
    `--preview-chip-bg:${design.chipBg}`,
    `--preview-chip-active-bg:${design.chipActiveBg}`,
    `--preview-chip-active-border:${design.chipActiveBorder}`,
    `--preview-chip-active-text:${design.chipActiveText}`,
    `--preview-period-bg:${design.periodBg}`,
    `--preview-map-water:${design.mapWater}`,
    `--preview-map-land:${design.mapLand}`,
    `--preview-map-road:${design.mapRoad}`
  ].join(";");
}

function renderLogoDesignGallery() {
  if (!els.logoDesignGrid) return;
  const active = activeLogoDesign();
  if (els.designLogoSelected) els.designLogoSelected.textContent = `${active.name} / ${logoDesignVariants.length}개`;
  els.logoDesignGrid.innerHTML = logoDesignVariants.map((design, index) => {
    const isActive = design.id === active.id;
    return `
      <button class="logo-design-card ${isActive ? "active" : ""}" type="button" data-logo-design-id="${escapeHtml(design.id)}" aria-pressed="${isActive}">
        <span class="graph-design-card-head">
          <strong>${escapeHtml(design.name)}</strong>
          <em>${isActive ? "선택됨" : `${String(index + 1).padStart(2, "0")}/${logoDesignVariants.length}`}</em>
        </span>
        <span class="logo-design-preview">${logoPreviewHtml(design)}</span>
        <span class="logo-design-note">${escapeHtml(design.tagline)}</span>
      </button>
    `;
  }).join("");
}

function logoPreviewHtml(design) {
  return `
    <span class="orulzip-logo tone-${escapeHtml(design.tone)} style-${escapeHtml(design.style)}">
      <span class="orulzip-logo-mark">${logoSymbolSvg(design.symbol)}</span>
      <span class="orulzip-logo-word">오를집</span>
    </span>
  `;
}

function logoSymbolSvg(symbol) {
  const common = `viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false"`;
  const svgs = {
    "minimal-roof": `
      <svg ${common}>
        <path class="logo-stroke" d="M8 25 24 11l16 14"/>
        <path class="logo-stroke" d="M14 42V25h20v17"/>
        <path class="logo-accent" d="M18 34l6-7 4 4 7-11"/>
      </svg>
    `,
    "roof-up-short": `
      <svg ${common}>
        <path class="logo-stroke" d="M9 25 24 12l15 13"/>
        <path class="logo-stroke" d="M15 42V26h18v16"/>
        <path class="logo-accent" d="M19 34l5-6 4 4 5-8"/>
      </svg>
    `,
    "roof-up-long": `
      <svg ${common}>
        <path class="logo-stroke" d="M8 25 24 11l16 14"/>
        <path class="logo-stroke" d="M14 42V25h20v17"/>
        <path class="logo-accent" d="M17 35l6-7 5 4 9-13"/>
        <path class="logo-accent" d="M33 19h4v4"/>
      </svg>
    `,
    "roof-up-corner": `
      <svg ${common}>
        <path class="logo-stroke" d="M8 25 24 11l16 14"/>
        <path class="logo-stroke" d="M14 42V25h20v17"/>
        <path class="logo-accent" d="M18 35h9c4 0 7-3 7-7v-7"/>
        <path class="logo-accent" d="M30 21h4v4"/>
      </svg>
    `,
    "roof-up-window": `
      <svg ${common}>
        <path class="logo-stroke" d="M8 25 24 11l16 14"/>
        <path class="logo-stroke" d="M14 42V25h20v17"/>
        <path class="logo-stroke" d="M18 30h5v5h-5z"/>
        <path class="logo-accent" d="M25 35l4-5 3 3 4-8"/>
      </svg>
    `,
    "roof-up-door": `
      <svg ${common}>
        <path class="logo-stroke" d="M8 25 24 11l16 14"/>
        <path class="logo-stroke" d="M14 42V25h20v17"/>
        <path class="logo-stroke" d="M20 42V31h8v11"/>
        <path class="logo-accent" d="M29 34l3-4 3 2 3-7"/>
      </svg>
    `,
    "roof-up-dot": `
      <svg ${common}>
        <path class="logo-stroke" d="M8 25 24 11l16 14"/>
        <path class="logo-stroke" d="M14 42V25h20v17"/>
        <path class="logo-accent" d="M18 34l6-7 4 4 6-9"/>
        <circle class="logo-accent-fill" cx="35" cy="21" r="2.6"/>
      </svg>
    `,
    "roof-up-peak": `
      <svg ${common}>
        <path class="logo-stroke" d="M8 25 24 11l16 14"/>
        <path class="logo-stroke" d="M14 42V25h20v17"/>
        <path class="logo-accent" d="M18 35l5-8 5 6 5-12"/>
      </svg>
    `,
    "roof-up-open": `
      <svg ${common}>
        <path class="logo-stroke" d="M8 25 24 11l16 14"/>
        <path class="logo-stroke" d="M15 42V29"/>
        <path class="logo-stroke" d="M33 42V29"/>
        <path class="logo-accent" d="M18 34l6-7 4 4 7-11"/>
      </svg>
    `,
    "roof-up-rounded": `
      <svg ${common}>
        <path class="logo-stroke logo-stroke-rounded" d="M8 25C13 21 18 16 24 11c6 5 11 10 16 14"/>
        <path class="logo-stroke logo-stroke-rounded" d="M14 42V25h20v17"/>
        <path class="logo-accent logo-stroke-rounded" d="M18 34c2-2 4-5 6-7 2 1 3 3 4 4 3-3 5-7 7-11"/>
      </svg>
    `,
    "roof-up-bold": `
      <svg ${common}>
        <path class="logo-stroke logo-stroke-bold" d="M8 25 24 11l16 14"/>
        <path class="logo-stroke logo-stroke-bold" d="M14 42V25h20v17"/>
        <path class="logo-accent logo-stroke-bold" d="M18 34l6-7 4 4 7-11"/>
      </svg>
    `
  };
  return svgs[symbol] || svgs["minimal-roof"];
}

function markerDesignSampleItems() {
  return [
    { id: "sample-1", name: "래미안", neighborhoodName: "목동", dongName: "목동", sigunguName: "양천구", sidoName: "서울시", sidoCode: "11", growthRate: 0.158, dongRank: 1, dongRankTotal: 14, sigunguRank: 4, sigunguRankTotal: 52, sidoRank: 18, sidoRankTotal: 214, countryRank: 71, countryRankTotal: 1051, hasData: true },
    { id: "sample-2", name: "자이", neighborhoodName: "반포동", dongName: "반포동", sigunguName: "서초구", sidoName: "서울시", sidoCode: "11", growthRate: 0.083, dongRank: 3, dongRankTotal: 21, sigunguRank: 7, sigunguRankTotal: 44, sidoRank: 42, sidoRankTotal: 214, countryRank: 163, countryRankTotal: 1051, hasData: true },
    { id: "sample-3", name: "힐스테이트", neighborhoodName: "도곡동", dongName: "도곡동", sigunguName: "강남구", sidoName: "서울시", sidoCode: "11", growthRate: -0.012, dongRank: 8, dongRankTotal: 18, sigunguRank: 21, sigunguRankTotal: 61, sidoRank: 138, sidoRankTotal: 214, countryRank: 642, countryRankTotal: 1051, hasData: true }
  ];
}

function markerPreviewHtml(item, design) {
  return apartmentMarkerHtml(item, design);
}

function markerSelectionSummary() {
  return markerLevelConfigs
    .map((level) => {
      const active = activeMarkerDesign(level.id);
      return `${level.name} ${markerVerbosityOptionForLevel(level.id, active.id).label}`;
    })
    .join(" · ");
}

function markerInfoPreviewHtml(level, design) {
  const sample = level === "apartment"
    ? markerDesignSampleItems()[0]
    : markerDesignSampleGroups()[level] || markerDesignSampleGroups().dong;
  const markerHtml = level === "apartment"
    ? markerPreviewHtml(sample, design)
    : zoomGroupMarkerContentHtml(sample, level, design);
  const size = level === "apartment" ? markerIconSize(design) : zoomMarkerSize(level, design);
  return `
    <span class="marker-design-map-preview marker-info-preview-${escapeHtml(level)}">
      <span class="preview-road preview-road-a"></span>
      <span class="preview-road preview-road-b"></span>
      <span class="preview-water"></span>
      <span class="preview-map-label label-${escapeHtml(level)}">${escapeHtml(markerLevelLabel(level))}</span>
      ${markerDesignPreviewNode(markerHtml, level, size)}
    </span>
  `;
}

function markerLevelLabel(level) {
  return markerLevelConfigs.find((item) => item.id === level)?.name || "마커";
}

function markerDesignPreviewNode(html, level, size) {
  const [width, height] = size;
  const wrapperClass = level === "apartment" ? "preview-marker-node preview-apartment-marker" : "preview-marker-node zoom-cluster-marker";
  return `
    <span class="${wrapperClass} preview-${escapeHtml(level)}" style="width:${width}px;height:${height}px">
      ${html}
    </span>
  `;
}

function markerDesignSampleGroups() {
  return {
    sido: {
      name: "서울시",
      growthRate: 0.126,
      apartmentCount: 214,
      areaCount: 980,
      countryRank: 2,
      countryRankTotal: 17,
      sidoName: "서울시",
      sidoCode: "11"
    },
    sigungu: {
      name: "서울시 양천구",
      growthRate: 0.152,
      apartmentCount: 52,
      areaCount: 213,
      sidoRank: 4,
      sidoRankTotal: 25,
      countryRank: 19,
      countryRankTotal: 228,
      sidoName: "서울시",
      sidoCode: "11",
      sigunguName: "양천구",
      sigunguCode: "11470"
    },
    dong: {
      name: "서울시 양천구 목동",
      growthRate: 0.184,
      apartmentCount: 14,
      areaCount: 57,
      sigunguRank: 1,
      sigunguRankTotal: 18,
      sidoRank: 11,
      sidoRankTotal: 214,
      countryRank: 64,
      countryRankTotal: 1051,
      sidoName: "서울시",
      sidoCode: "11",
      sigunguName: "양천구",
      sigunguCode: "11470",
      dongName: "목동"
    }
  };
}

function graphDesignSampleData() {
  const start = new Date(2023, 5, 1);
  const months = Array.from({ length: 38 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
  const buildPrices = (base, slope, wave, bump = 0, pyeongBase = 3200) => months.map((yearMonth, index) => ({
    yearMonth,
    saleMid: Math.round(base + slope * index + Math.sin(index / 3.2) * wave + Math.max(0, index - 24) * bump),
    pyeongPrice: Math.round(pyeongBase + slope * 0.08 * index + Math.sin(index / 4) * wave * 0.06 + Math.max(0, index - 24) * bump * 0.08)
  }));
  return {
    months,
    series: [
      { label: "59A", color: colors[0], prices: buildPrices(72000, 520, 1600, 160, 3600) },
      { label: "84A", color: colors[1], prices: buildPrices(98000, 760, 2100, 220, 4100) },
      { label: "101", color: colors[2], prices: buildPrices(124000, 640, 2500, 120, 4450) },
      { label: "114", color: colors[3], prices: buildPrices(148000, 830, 2800, 260, 4700) }
    ]
  };
}

function renderGraphSvg({ design, pyeongDesign = activePyeongGraphDesign(), interactive, mode, months, series, pyeongSeriesSource = series }) {
  const geometry = graphChartGeometry({ mode, months, series });
  const { width, height, padding, chartRight, chartBottom, x, y, yMin, yMax } = geometry;
  const svgId = `graph-${mode}-${design.id}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  const grid = renderGraphGrid({ design, y, yMin, yMax, padding, chartRight });
  const monthLabels = renderGraphMonthLabels({ design, mode, months, x, height });
  const periodMarkers = renderGraphPeriodMarkers({ months, series, x, y, padding, chartBottom });
  const pyeongSeries = averagePyeongGraphSeries({ months, series: pyeongSeriesSource });
  const pyeongGeometry = graphPyeongGeometry({ pyeongSeries, padding, chartBottom });
  const pyeongAxis = renderPyeongGraphAxis({ design, pyeongDesign, pyeongGeometry, padding, chartBottom, chartRight });
  const pyeongSeriesMarkup = renderPyeongGraphSeries({ design: pyeongDesign, pyeongSeries, x, y: pyeongGeometry?.y });
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
    geometry: {
      ...geometry,
      pyeongY: pyeongGeometry?.y,
      pyeongSeries
    },
    html: `
      <svg class="map-popup-chart-svg graph-design-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="평형별 시세 그래프">
        <defs>${defs}</defs>
        <rect x="0" y="0" width="${width}" height="${height}" rx="${mode === "preview" ? 12 : 0}" fill="${design.background}"></rect>
        <rect class="map-popup-plot-bg" x="${padding.left}" y="${padding.top}" width="${chartRight - padding.left}" height="${chartBottom - padding.top}" rx="${design.plotRadius}" style="fill:${design.plotBackground};stroke:${design.gridMode === "none" ? "transparent" : design.gridColor};"></rect>
        ${grid}
        ${pyeongAxis}
        ${pyeongSeriesMarkup}
        ${seriesMarkup}
        ${periodMarkers}
        ${monthLabels}
        <line class="map-popup-axis-line" x1="${padding.left}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}" style="stroke:${design.axisColor};"></line>
        <line class="map-popup-axis-line" x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${chartBottom}" style="stroke:${design.axisColor};"></line>
        ${pyeongGeometry ? `<line class="map-popup-pyeong-axis-line" x1="${chartRight}" y1="${padding.top}" x2="${chartRight}" y2="${chartBottom}"></line>` : ""}
        ${hover}
      </svg>
    `
  };
}

function averagePyeongGraphSeries({ months, series }) {
  return months.map((yearMonth) => {
    const pyeongPrice = average(series.flatMap((item) => {
      const price = item.prices.find((entry) => entry.yearMonth === yearMonth);
      return Number.isFinite(Number(price?.pyeongPrice)) ? [Number(price.pyeongPrice)] : [];
    }));
    return Number.isFinite(pyeongPrice) ? { yearMonth, pyeongPrice } : null;
  }).filter(Boolean);
}

function graphPyeongGeometry({ pyeongSeries, padding, chartBottom }) {
  const values = pyeongSeries.map((price) => Number(price.pyeongPrice)).filter(Number.isFinite);
  if (!values.length) return null;
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = Math.max(rawMax - rawMin, 500);
  const yMin = Math.max(0, Math.floor((rawMin - span * 0.14) / 500) * 500);
  const yMax = Math.ceil((rawMax + span * 0.14) / 500) * 500;
  const separationOffset = 10;
  const y = (value) => Math.min(
    chartBottom - 2,
    padding.top + separationOffset + (1 - (value - yMin) / (yMax - yMin || 1)) * (chartBottom - padding.top - separationOffset)
  );
  return { y, yMin, yMax };
}

function renderPyeongGraphAxis({ design, pyeongDesign, pyeongGeometry, padding, chartBottom, chartRight }) {
  if (!pyeongGeometry || pyeongDesign.labelMode === "none") return "";
  const ratios = [0, 0.5, 1];
  const titleText = "계산식: 모든 평형의 해당 월 평당 거래가를 평균낸 값입니다.";
  return ratios.map((ratio) => {
    const value = Math.round((pyeongGeometry.yMin + (pyeongGeometry.yMax - pyeongGeometry.yMin) * ratio) / 100) * 100;
    const yPos = pyeongGeometry.y(value).toFixed(1);
    return `
      <text class="map-popup-pyeong-axis-label" x="${chartRight + 10}" y="${(Number(yPos) + 4).toFixed(1)}" text-anchor="start">${formatMoney(value)}</text>
    `;
  }).join("") + `
    <g class="map-popup-pyeong-axis-help">
      <title>${escapeHtml(titleText)}</title>
      <text class="map-popup-pyeong-axis-title" x="${chartRight + 10}" y="${Math.max(13, padding.top - 9)}" text-anchor="start">평당가격</text>
    </g>
  `;
}

function renderPyeongGraphSeries({ design, pyeongSeries, x, y }) {
  if (!y) return "";
  const color = design.monochrome ? "#98a2b3" : "#475467";
  const points = pyeongSeries
    .filter((price) => Number.isFinite(Number(price.pyeongPrice)))
    .map((price) => ({
      x: x(price.yearMonth),
      y: y(Number(price.pyeongPrice)),
      price
    }));
  if (!points.length) return "";
  const path = graphLinePath(points, "linear");
  const style = [
    `stroke-width:${design.lineWidth}px`,
    `opacity:${design.opacity}`,
    `stroke-linecap:${design.linecap}`,
    design.dash ? `stroke-dasharray:${design.dash}` : ""
  ].filter(Boolean).join(";");
  return `<path class="map-popup-pyeong-line" d="${path}" stroke="${color}" style="${style}"></path>`;
}

function renderGraphPeriodMarkers({ months, series, x, y, padding, chartBottom }) {
  if (!months.length) return "";
  const latestMonth = months.at(-1);
  return [1, 3, 5].map((years) => {
    const yearMonth = periodStartMonth(latestMonth, years);
    if (!months.includes(yearMonth)) return "";
    const xPos = x(yearMonth);
    const labelX = Math.min(xPos + 7, x(months.at(-1)) - 16);
    const dots = series.map((item) => {
      const yPos = interpolatedSeriesYAtMonth(item, yearMonth, x, y);
      if (!Number.isFinite(yPos)) return "";
      return `<circle class="map-popup-period-dot" cx="${xPos.toFixed(1)}" cy="${yPos.toFixed(1)}" r="4" fill="${item.color}" stroke="#ffffff"></circle>`;
    }).join("");
    return `
      <g class="map-popup-period-marker">
        <line x1="${xPos.toFixed(1)}" y1="${padding.top}" x2="${xPos.toFixed(1)}" y2="${chartBottom}"></line>
        ${dots}
        <text x="${labelX.toFixed(1)}" y="${padding.top + 14}" text-anchor="start">${years}년</text>
      </g>
    `;
  }).join("");
}

function interpolatedSeriesYAtMonth(item, yearMonth, x, y) {
  const points = (item.prices || [])
    .filter((price) => Number.isFinite(Number(price.saleMid)) && String(price.yearMonth || "") <= yearMonth)
    .map((price) => ({
      x: x(price.yearMonth),
      y: y(Number(price.saleMid)),
      yearMonth: price.yearMonth
    }))
    .sort((a, b) => a.x - b.x);
  const after = (item.prices || [])
    .filter((price) => Number.isFinite(Number(price.saleMid)) && String(price.yearMonth || "") >= yearMonth)
    .map((price) => ({
      x: x(price.yearMonth),
      y: y(Number(price.saleMid)),
      yearMonth: price.yearMonth
    }))
    .sort((a, b) => a.x - b.x)[0];
  const before = points.at(-1);
  if (!before && !after) return NaN;
  if (!before) return after.y;
  if (!after) return before.y;
  const targetX = x(yearMonth);
  if (Math.abs(after.x - before.x) < 0.001) return before.y;
  const ratio = (targetX - before.x) / (after.x - before.x);
  return before.y + (after.y - before.y) * ratio;
}

function graphChartGeometry({ mode, months, series }) {
  const width = mode === "preview" ? 360 : 680;
  const height = mode === "preview" ? 190 : 300;
  const padding = mode === "preview"
    ? { top: 18, right: 68, bottom: 30, left: 60 }
    : { top: 26, right: 92, bottom: 42, left: 96 };
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

function bindMapPopupChartHover({ width, months, series, pyeongSeriesSource = series, x, y, pyeongY }) {
  const svg = els.mapPopupChart.querySelector("svg");
  const hit = els.mapPopupChart.querySelector(".chart-hover-hit");
  const line = els.mapPopupChart.querySelector(".map-popup-hover-line");
  if (!svg || !hit || !line || !els.mapPopupTooltip || !months.length) return;
  const hideHover = () => {
    line.hidden = true;
    els.mapPopupTooltip.hidden = true;
  };

  hit.addEventListener("mousemove", (event) => {
    const svgPoint = svgPointFromEvent(event, svg, width);
    const month = nearestMonthFromSvgX(svgPoint.x, months, x);
    const xPos = x(month);
    line.setAttribute("x1", xPos);
    line.setAttribute("x2", xPos);
    line.hidden = false;

    const priceRows = series.map((item) => {
      const price = item.prices.find((entry) => entry.yearMonth === month);
      if (!price) return null;
      return { item, price, y: y(Number(price.saleMid)) };
    }).filter(Boolean);
    const pyeongAverage = averagePyeongAtMonth(pyeongSeriesSource, month);
    const priceRow = priceRows[0];
    const priceDistance = priceRow
      ? Math.abs(priceRow.y - svgPoint.y)
      : Infinity;
    const pyeongYValue = Number.isFinite(pyeongAverage) && pyeongY ? pyeongY(Number(pyeongAverage)) : NaN;
    const pyeongDistance = Number.isFinite(pyeongYValue) ? Math.abs(pyeongYValue - svgPoint.y) : Infinity;
    const isPyeongPrimary = pyeongDistance < priceDistance;
    const priceMarkup = priceRows.map(({ item, price }) =>
      `<span><i style="background:${item.color}"></i>${escapeHtml(item.label || "-")} ${formatKoreanPrice(price.saleMid)}</span>`
    ).join("");
    const pyeongMarkup = Number.isFinite(pyeongAverage)
      ? `<span class="map-popup-tooltip-secondary">평당가격 ${formatMoney(pyeongAverage)}</span>`
      : "";
    const rows = isPyeongPrimary
      ? `${pyeongMarkup || "<span>데이터 없음</span>"}`
      : `${priceMarkup || "<span>데이터 없음</span>"}`;

    showFloatingTooltip(els.mapPopupChart.parentElement, els.mapPopupTooltip, event, `
      <strong>${formatMonth(month)}</strong>
      ${rows || "<span>데이터 없음</span>"}
    `);
  });

  hit.addEventListener("mouseleave", hideHover);
  svg.addEventListener("mouseleave", hideHover);
  els.mapPopupChart.addEventListener("mouseleave", hideHover);
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
  const parts = String(name || "").split(/\s+/).filter(Boolean);
  if (!parts.length) return "";

  if (level === "sigungu") {
    const startIndex = isSidoLabelPart(parts[0]) ? 1 : 0;
    const first = parts[startIndex] || "";
    const second = parts[startIndex + 1] || "";
    if (/시$/.test(first) && /구$/.test(second)) return `${first} ${second}`;
    const sigungu = parts.slice(startIndex).find((part) => /구$|시$|군$/.test(part));
    if (sigungu) return sigungu;
  }

  if (level === "dong") {
    const dong = [...parts].reverse().find((part) => /동$|가$|읍$|면$|리$/.test(part));
    if (dong) return dong;
  }

  return [...parts].reverse().find((part) => !isJibunLike(part)) || parts.at(-1);
}

function isSidoLabelPart(value = "") {
  return /특별시$|광역시$|특별자치시$|특별자치도$|도$/.test(value)
    || ["서울", "서울시", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "경기도", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"].includes(value);
}

function isJibunLike(value = "") {
  return /^\d+(?:-\d+)?$/.test(String(value));
}

function zoomGroupMarkerContentHtml(item, level, design = activeMarkerDesign(level)) {
  const countHtml = design.groupRankMode === "full"
    ? `<small class="zoom-cluster-count">아파트 ${formatInt(item.apartmentCount)}개</small>`
    : "";
  return `
    <div class="zoom-cluster-content level-${escapeHtml(level)} marker-${escapeHtml(design.id)} zoom-rank-${escapeHtml(design.groupRankMode)} zoom-label-${escapeHtml(design.rankLabelMode)}" style="--zoom-color: ${growthColor(item.growthRate)}">
      <strong>${escapeHtml(shortZoomLabel(item.name, level))}</strong>
      <span>${formatPercent(item.growthRate)}</span>
      ${countHtml}
      ${zoomGroupMarkerRankHtml(item, level, design)}
    </div>
  `;
}

function zoomGroupMarkerRankHtml(item, level, design = activeMarkerDesign(level)) {
  const rows = zoomGroupMarkerRankRows(item, level, design);
  return rows.length
    ? `
      <small class="zoom-cluster-rank">
        ${rows.map((row) => `<b>${escapeHtml(row.label)} ${escapeHtml(row.rank)}</b>`).join("")}
      </small>
    `
    : "";
}

function zoomGroupMarkerRankRows(item, level, design = activeMarkerDesign(level)) {
  const mode = design.groupRankMode || "parent";
  if (mode === "none") return [];
  const rows = zoomGroupAllRankRows(item, level, design).filter((row) => row.rank !== "-");
  if (mode === "parent") return rows.slice(0, 1);
  if (mode === "regional") return level === "sido" ? rows.slice(0, 1) : rows.slice(0, 2);
  return rows;
}

function zoomGroupAllRankRows(item, level, design = activeMarkerDesign(level)) {
  if (level === "dong") {
    return [
      zoomRankRow(zoomRankSigunguLabel(item), "구", item.sigunguRank, item.sigunguRankTotal, design),
      zoomRankRow(zoomRankSidoLabel(item), "시", item.sidoRank, item.sidoRankTotal, design),
      zoomRankRow("전국", "전국", item.countryRank, item.countryRankTotal, design)
    ];
  }
  if (level === "sigungu") {
    return [
      zoomRankRow(zoomRankSidoLabel(item), "시", item.sidoRank, item.sidoRankTotal, design),
      zoomRankRow("전국", "전국", item.countryRank, item.countryRankTotal, design)
    ];
  }
  return [
    zoomRankRow("전국", "전국", item.countryRank, item.countryRankTotal, design)
  ];
}

function zoomRankRow(label, shortLabel, rank, total, design = activeMarkerDesign()) {
  return {
    label: compactRankLabel(label, shortLabel, design),
    rank: formatRankText(rank, total)
  };
}

function compactRankLabel(label, shortLabel, design = activeMarkerDesign()) {
  if (design.rankLabelMode === "abbr") return shortLabel;
  return label || shortLabel || "";
}

function zoomRankSigunguLabel(item) {
  const code = String(item.sigunguCode || item.code || "").slice(0, 5);
  if (sigunguLabelByCode[code]) return sigunguLabelByCode[code];
  if (item.sigunguName) return shortZoomLabel(item.sigunguName, "sigungu");
  const parts = String(item.name || "").split(/\s+/).filter(Boolean);
  if (parts.length > 1) return shortZoomLabel(parts.slice(0, -1).join(" "), "sigungu");
  return shortZoomLabel(item.name, "sigungu") || "시군구";
}

function zoomRankSidoLabel(item) {
  const code = String(item.sidoCode || item.code || "").slice(0, 2);
  return sidoLabelByCode[code] || fullSidoLabel(item.sidoName) || "시도";
}

function fullSidoLabel(name = "") {
  const compact = shortRegionLabel(name);
  if (!compact) return "";
  return {
    서울: "서울시",
    부산: "부산시",
    대구: "대구시",
    인천: "인천시",
    광주: "광주시",
    대전: "대전시",
    울산: "울산시",
    세종: "세종시",
    경기: "경기도",
    강원: "강원도",
    충북: "충청북도",
    충남: "충청남도",
    전북: "전라북도",
    전남: "전라남도",
    경북: "경상북도",
    경남: "경상남도",
    제주: "제주도"
  }[compact] || compact;
}

function formatRankText(rank, total) {
  const rankNumber = Number(rank);
  const totalNumber = Number(total);
  if (!Number.isFinite(rankNumber)) return "-";
  if (Number.isFinite(totalNumber) && totalNumber > 0) return `${formatInt(rankNumber)}/${formatInt(totalNumber)}등`;
  return `${formatInt(rankNumber)}등`;
}

function zoomMarkerSize(level = "", design = activeMarkerDesign(level)) {
  const mode = design.groupRankMode || "parent";
  const scale = {
    none: 0,
    parent: 1,
    regional: 2,
    all: 3,
    full: 4
  }[mode] ?? 1;
  if (level === "dong") return [
    [86, 66],
    [104, 82],
    [112, 92],
    [124, 104],
    [132, 112]
  ][scale];
  if (level === "sigungu") return [
    [82, 62],
    [96, 76],
    [104, 84],
    [112, 92],
    [120, 100]
  ][scale];
  return [
    [68, 58],
    [76, 68],
    [80, 72],
    [84, 76],
    [92, 84]
  ][scale];
}

function zoomMarkerAnchor(level = "", design = activeMarkerDesign(level)) {
  const [width, height] = zoomMarkerSize(level, design);
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
  applyQuickPeriodMonths(Math.max(1, Math.round(Number(years || 1) * 12)));
}

function applyQuickPeriodMonths(months) {
  if (!state.months.length) return;
  const end = state.months.at(-1);
  const endDate = parseMonth(end);
  const target = new Date(endDate);
  target.setMonth(target.getMonth() - Math.max(1, Number(months) || 12));
  els.endInput.value = toMonthInput(end);
  els.startInput.value = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
}

function setPeriodYears(years) {
  setPeriodMonths(Math.max(1, Math.round(Number(years || 1) * 12)));
}

function setPeriodMonths(months) {
  applyQuickPeriodMonths(months);
  syncPeriodButtons(months);
}

function syncPeriodButtons(activeMonths = currentPeriodMonths()) {
  document.querySelectorAll("[data-period-months], [data-period-years]").forEach((button) => {
    button.classList.toggle("active", periodButtonMonths(button) === activeMonths);
  });
}

function syncApartmentRankModeButtons() {
  document.querySelectorAll("[data-apartment-rank-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.apartmentRankMode === state.apartmentRankMode);
  });
  if (els.apartmentPageSizeSelect && Number(els.apartmentPageSizeSelect.value) !== state.apartmentRankPageSize) {
    els.apartmentPageSizeSelect.value = String(state.apartmentRankPageSize);
  }
}

function syncPriceBandBasisButtons() {
  if (els.priceBandPageSizeSelect && Number(els.priceBandPageSizeSelect.value) !== state.priceBandPageSize) {
    els.priceBandPageSizeSelect.value = String(state.priceBandPageSize);
  }
}

function currentPeriodMonths() {
  if (!els.startInput.value || !els.endInput.value) return 12;
  const start = new Date(`${els.startInput.value}-01`);
  const end = new Date(`${els.endInput.value}-01`);
  const monthDiff = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
  if (monthDiff >= 54) return 60;
  if (monthDiff >= 30) return 36;
  if (monthDiff >= 9) return 12;
  if (monthDiff >= 5) return 6;
  return 3;
}

function periodButtonMonths(button) {
  const months = Number(button.dataset.periodMonths);
  if (Number.isFinite(months) && months > 0) return Math.round(months);
  const years = Number(button.dataset.periodYears);
  return Math.max(1, Math.round((Number.isFinite(years) && years > 0 ? years : 1) * 12));
}

function currentMapPeriodParams() {
  return {
    start: els.startInput.value ? els.startInput.value.replace("-", "") : "",
    end: els.endInput.value ? els.endInput.value.replace("-", "") : ""
  };
}

function visiblePageNumbers(page, totalPages) {
  const pages = new Set([1, totalPages]);
  for (let value = page - 2; value <= page + 2; value += 1) {
    if (value >= 1 && value <= totalPages) pages.add(value);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];
  for (const value of sorted) {
    if (result.length && value - result.at(-1) > 1) result.push("...");
    result.push(value);
  }
  return result;
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
  syncApartmentRankModeButtons();
  const pagination = result.pagination || {
    page: 1,
    pageSize: result.rows.length || state.apartmentRankPageSize,
    totalRows: result.rows.length,
    totalPages: 1
  };
  state.apartmentRankPage = pagination.page;
  const start = pagination.totalRows ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const end = pagination.totalRows ? Math.min(pagination.page * pagination.pageSize, pagination.totalRows) : 0;
  const periodLabel = result.period?.startMonth && result.period?.endMonth
    ? `${formatMonth(result.period.startMonth)} - ${formatMonth(result.period.endMonth)}`
    : "";
  const metricLabel = state.apartmentRankMode === "averagePyeong" ? "평균평당가" : "상승률";
  els.apartmentCount.textContent = `${metricLabel} · ${formatInt(pagination.totalRows)}개${periodLabel ? ` · ${periodLabel}` : ""}${pagination.totalRows ? ` · ${formatInt(start)}-${formatInt(end)}` : ""}`;
  renderApartmentTableHead();
  els.apartmentRows.innerHTML = result.rows.length
    ? result.rows.map((row) => state.apartmentRankMode === "averagePyeong" ? `
      <tr class="clickable-row" data-apartment-id="${escapeHtml(row.apartmentId)}">
        <td>${row.rank}</td>
        <td>${escapeHtml(row.apartmentName)}</td>
        <td>${escapeHtml(row.neighborhoodName)}</td>
        <td>${escapeHtml(row.areaLabel)}</td>
        <td>${formatMoney(row.averagePyeongPrice)}</td>
        <td>${formatMoney(row.endPyeongPrice)}</td>
        <td>${formatInt(row.observedMonthCount)}개월</td>
        <td class="${row.growthRate >= 0 ? "positive" : "negative"}">${formatPercent(row.growthRate)}</td>
      </tr>
    ` : `
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
  renderApartmentPagination(pagination);

  els.apartmentRows.querySelectorAll("[data-apartment-id]").forEach((row) => {
    row.addEventListener("click", () => loadApartmentDetail(row.dataset.apartmentId));
  });
}

function renderApartmentTableHead() {
  if (!els.apartmentHeadRow) return;
  els.apartmentHeadRow.innerHTML = state.apartmentRankMode === "averagePyeong"
    ? `
      <th>순위</th>
      <th>아파트</th>
      <th>동</th>
      <th>면적 구성</th>
      <th>평균 평당가</th>
      <th>현재 평당가</th>
      <th>조사월</th>
      <th>상승률</th>
    `
    : `
      <th>순위</th>
      <th>아파트</th>
      <th>동</th>
      <th>면적 구성</th>
      <th>시작 평당가</th>
      <th>현재 평당가</th>
      <th>상승액</th>
      <th>상승률</th>
    `;
}

function renderApartmentPagination(pagination) {
  if (!els.apartmentPagination) return;
  if (!pagination || pagination.totalPages <= 1) {
    els.apartmentPagination.innerHTML = "";
    return;
  }
  const page = Number(pagination.page || 1);
  const totalPages = Number(pagination.totalPages || 1);
  const pageNumbers = visiblePageNumbers(page, totalPages);
  els.apartmentPagination.innerHTML = `
    <button type="button" data-apartment-page="1" ${page <= 1 ? "disabled" : ""}>처음</button>
    <button type="button" data-apartment-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>이전</button>
    ${pageNumbers.map((item) => item === "..."
      ? `<span>...</span>`
      : `<button type="button" data-apartment-page="${item}" class="${item === page ? "active" : ""}">${item}</button>`
    ).join("")}
    <button type="button" data-apartment-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>다음</button>
    <button type="button" data-apartment-page="${totalPages}" ${page >= totalPages ? "disabled" : ""}>마지막</button>
  `;
}

function renderPriceBandTable(result, basisBands = null) {
  syncPriceBandBasisButtons();
  if (result.basis === "start" || result.basis === "end") state.priceBandBasis = result.basis;
  state.priceBandKey = result.selectedBandKey === null || result.selectedBandKey === undefined
    ? ""
    : String(result.selectedBandKey);
  const rows = Array.isArray(result.rows) ? result.rows : [];
  const bands = Array.isArray(result.bands) ? result.bands : [];
  const summaryBands = basisBands || {
    start: result.basis === "start" ? bands : [],
    end: result.basis === "end" ? bands : []
  };
  const pagination = result.pagination || {
    page: 1,
    pageSize: rows.length || state.priceBandPageSize,
    totalRows: rows.length,
    totalPages: 1
  };
  state.priceBandPage = pagination.page;
  const start = pagination.totalRows ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const end = pagination.totalRows ? Math.min(pagination.page * pagination.pageSize, pagination.totalRows) : 0;
  const basisLabel = result.basis === "end" ? "현재 가격대" : "과거 가격대";
  const selectedBand = result.selectedBand || bands.find((band) => String(band.bandKey) === state.priceBandKey) || null;
  const selectedBandLabel = selectedBand?.bandLabel || "가격대";
  const periodLabel = result.period?.startMonth && result.period?.endMonth
    ? `${formatMonth(result.period.startMonth)} - ${formatMonth(result.period.endMonth)}`
    : "";
  const cacheLabel = formatPriceBandCacheLabel(result.cache);
  els.priceBandCount.textContent = `${basisLabel} · ${selectedBandLabel} · ${formatInt(pagination.totalRows)}개${periodLabel ? ` · ${periodLabel}` : ""}${pagination.totalRows ? ` · ${formatInt(start)}-${formatInt(end)}` : ""}${cacheLabel ? ` · ${cacheLabel}` : ""}`;
  renderPriceBandSummary(summaryBands, state.priceBandBasis, state.priceBandKey);
  els.priceBandRows.innerHTML = rows.length
    ? rows.map((row) => `
      <tr>
        <td>${row.rank}</td>
        <td>
          <strong class="table-main">${escapeHtml(row.apartmentName)}</strong>
          <span class="muted-cell">${escapeHtml(priceBandApartmentMeta(row))}</span>
          <span class="table-links">
            <a href="${escapeHtml(naverApartmentLink(row))}" target="_blank" rel="noopener noreferrer">네이버지도</a>
            <a href="${escapeHtml(hogangnonoApartmentLink(row))}" target="_blank" rel="noopener noreferrer">호갱노노</a>
          </span>
        </td>
        <td>${escapeHtml(formatPriceBandLocation(row))}</td>
        <td>${formatKoreanPrice(row.startSalePrice)}</td>
        <td>${formatKoreanPrice(row.endSalePrice)}</td>
        <td>${formatMoney(row.startPyeongPrice)}</td>
        <td>${formatMoney(row.endPyeongPrice)}</td>
        <td class="${row.growthRate >= 0 ? "positive" : "negative"}">${formatPercent(row.growthRate)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="8" class="empty">선택한 가격대에 표시할 아파트 데이터가 없습니다.</td></tr>`;
  renderPriceBandPagination(pagination);
}

function renderPriceBandSummary(basisBands, selectedBasis, selectedBandKey) {
  if (!els.priceBandSummary) return;
  const groups = [
    { basis: "start", label: "과거 가격대", prefix: "과거", bands: Array.isArray(basisBands?.start) ? basisBands.start : [] },
    { basis: "end", label: "현재 가격대", prefix: "현재", bands: Array.isArray(basisBands?.end) ? basisBands.end : [] }
  ];
  if (!groups.some((group) => group.bands.length)) {
    els.priceBandSummary.innerHTML = `<div class="empty">표시할 가격대가 없습니다.</div>`;
    return;
  }
  els.priceBandSummary.innerHTML = groups.map((group) => `
    <div class="price-band-row">
      <div class="price-band-row-label">${group.label}</div>
      <div class="price-band-chip-row">
        ${group.bands.length ? group.bands.map((band) => renderPriceBandChip(band, group, selectedBasis, selectedBandKey)).join("") : `<span class="price-band-empty">데이터 없음</span>`}
      </div>
    </div>
  `).join("");
}

function renderPriceBandChip(band, group, selectedBasis, selectedBandKey) {
  const isActive = group.basis === selectedBasis && String(band.bandKey) === String(selectedBandKey);
  return `
    <button
      type="button"
      class="price-band-chip ${isActive ? "active" : ""}"
      data-price-band-basis="${group.basis}"
      data-price-band-key="${escapeHtml(band.bandKey)}"
    >
      <strong>${group.prefix} ${escapeHtml(band.bandLabel)}</strong>
      <span>${formatInt(band.apartmentCount)}개</span>
      <em>최고 ${formatPercent(band.topGrowthRate)}</em>
    </button>
  `;
}

function formatPriceBandLocation(row) {
  const address = String(row.address || "").trim();
  const parts = address.split(/\s+/).filter(Boolean);
  if (parts.length >= 4 && /도$/.test(parts[0]) && /시$/.test(parts[1]) && /구$/.test(parts[2])) {
    return parts.slice(0, 4).join(" ");
  }
  if (parts.length >= 3) return parts.slice(0, 3).join(" ");
  return row.neighborhoodName || "-";
}

function naverApartmentLink(row) {
  const query = compactSearchQuery([row.address, row.apartmentName]) || row.apartmentName || "";
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
}

function hogangnonoApartmentLink(row) {
  const query = compactSearchQuery([row.apartmentName, formatPriceBandLocation(row)]);
  return `https://hogangnono.com/search?q=${encodeURIComponent(query)}`;
}

function priceBandApartmentMeta(row) {
  const parts = [
    row.areaLabel || "-",
    `${formatInt(row.areaTypeCount)}개 면적`
  ];
  const households = Number(row.householdCount);
  if (Number.isFinite(households) && households > 0) {
    parts.push(`${formatInt(households)}세대`);
  }
  return parts.join(" · ");
}

function compactSearchQuery(parts) {
  return parts.map((part) => String(part || "").trim()).filter(Boolean).join(" ");
}

function renderPriceBandPagination(pagination) {
  if (!els.priceBandPagination) return;
  if (!pagination || pagination.totalPages <= 1) {
    els.priceBandPagination.innerHTML = "";
    return;
  }
  const page = Number(pagination.page || 1);
  const totalPages = Number(pagination.totalPages || 1);
  const pageNumbers = visiblePageNumbers(page, totalPages);
  els.priceBandPagination.innerHTML = `
    <button type="button" data-price-band-page="1" ${page <= 1 ? "disabled" : ""}>처음</button>
    <button type="button" data-price-band-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>이전</button>
    ${pageNumbers.map((item) => item === "..."
      ? `<span>...</span>`
      : `<button type="button" data-price-band-page="${item}" class="${item === page ? "active" : ""}">${item}</button>`
    ).join("")}
    <button type="button" data-price-band-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>다음</button>
    <button type="button" data-price-band-page="${totalPages}" ${page >= totalPages ? "disabled" : ""}>마지막</button>
  `;
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
  return nearestMonthFromSvgX(svgPointFromEvent(event, svg, width).x, months, x);
}

function svgPointFromEvent(event, svg, width) {
  const rect = svg.getBoundingClientRect();
  const svgX = ((event.clientX - rect.left) / rect.width) * width;
  const viewBoxHeight = Number(svg.getAttribute("viewBox")?.split(/\s+/)[3]) || rect.height;
  const svgY = ((event.clientY - rect.top) / rect.height) * viewBoxHeight;
  return { x: svgX, y: svgY };
}

function nearestMonthFromSvgX(svgX, months, x) {
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
  if (els.priceBandRows) els.priceBandRows.innerHTML = `<tr><td colspan="8" class="empty">동기화 후 가격대별 랭킹이 표시됩니다.</td></tr>`;
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

function average(values) {
  const clean = values.map(Number).filter(Number.isFinite);
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return `${formatInt(number)}만`;
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

function formatSignedKoreanPrice(value) {
  const amount = Number(value || 0);
  if (!amount) return "-";
  const sign = amount < 0 ? "-" : "";
  return `${sign}${formatKoreanPrice(Math.abs(amount))}`;
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

function formatPriceBandCacheLabel(cache) {
  if (!cache) return "";
  if (cache.hit === false) return "실시간 계산";
  if (!cache.updatedAt) return "";
  const updatedAt = new Date(cache.updatedAt);
  const today = new Date();
  const sameDay = updatedAt.getFullYear() === today.getFullYear()
    && updatedAt.getMonth() === today.getMonth()
    && updatedAt.getDate() === today.getDate();
  const date = `${String(updatedAt.getMonth() + 1).padStart(2, "0")}월 ${String(updatedAt.getDate()).padStart(2, "0")}일`;
  const time = updatedAt.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  });
  return `${sameDay ? "오늘" : ""}(${date}) ${time} 기준`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
