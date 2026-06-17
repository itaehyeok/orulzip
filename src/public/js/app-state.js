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

const tabTitles = {
  molitMap: "오를집 - 아파트 실거래가 상승률 지도",
  map: "KB시세 지도 - 오를집",
  priceBands: "가격대별 아파트 상승률 랭킹 - 오를집",
  apartment: "아파트별 평균 평당가 랭킹 - 오를집",
  neighborhood: "동네별 아파트 상승률 랭킹 - 오를집",
  formula: "시세식 분석 - 오를집",
  terms: "용어 - 오를집",
  design: "디자인 - 오를집",
  crawl: "수집현황 - 오를집"
};

const state = {
  regions: [],
  regionStats: [],
  months: [],
  neighborhoods: [],
  isAdmin: false,
  activeTab: tabFromLocation(),
  clientConfig: { maps: { provider: "leaflet", naverKeyId: "" } },
  zoomMap: null,
  zoomMapLayer: null,
  zoomNaverMap: null,
  zoomNaverOverlays: [],
  zoomNaverInfoWindow: null,
  mapTransitionTimer: null,
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
  focusedMapApartmentId: null,
  activeGraphDesignId: null,
  activePyeongGraphDesignId: null,
  activeMarkerDesignId: null,
  markerVerbosityByLevel: null,
  markerRankDisplayOptions: null,
  apartmentMarkerDesignId: null,
  apartmentMarkerDisplay: null,
  apartmentMarkerStyle: null,
  apartmentMarkerStylePresets: null,
  selectedApartmentMarkerStylePresetId: "",
  activeLogoDesignId: null,
  activeMapHeaderDesignId: null,
  activeGrowthRateColorDesignId: null,
  apartmentRankMode: "averagePyeong",
  apartmentRankPage: 1,
  apartmentRankPageSize: 50,
  priceBandBasis: "start",
  priceBandKey: "",
  priceBandPage: 1,
  priceBandPageSize: 50,
  markerLineGapPx: null,
  regionMarkerDesignByLevel: null,
  regionMarkerDisplayByLevel: null,
  regionMarkerStyleByLevel: null,
  regionMarkerStylePresets: null,
  selectedRegionMarkerStylePresetId: "",
  activeRegionMarkerStyleLevel: "dong",
  activeTransitionDesignId: "current",
  latestZoomMapData: null,
  lastZoomMapRenderZoom: null,
  naverSdkPromise: null,
  latestStatus: null,
  latestMolitStatus: null
};

const colors = ["#2367d1", "#c24132", "#16805f", "#9a5b13", "#7c3aed", "#0f766e", "#b42318", "#475467"];
const defaultGraphDesignId = "clean-line";
const graphDesignStorageKey = "orulzip.graphDesignId";
const defaultPyeongGraphDesignId = "pyeong-soft";
const pyeongGraphDesignStorageKey = "orulzip.pyeongGraphDesignId";
const defaultMarkerDesignId = "theme-forest-card";
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
const markerRankDisplayStorageKey = "orulzip.markerRankDisplayOptions.v2";
const defaultMarkerRankDisplayOptions = {
  region: { showTotal: false, showSuffix: true, showPercent: false },
  apartment: { showTotal: false, showSuffix: true, showPercent: false }
};
const transitionDesignStorageKey = "orulzip.transitionDesignId";
const transitionDesignLabels = {
  current: "01 현재모드",
  dim: "02 반투명 유지",
  badge: "03 상태 배지",
  fade: "04 페이드 교체"
};
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
  markerDesign("theme-forest-card", "01 포레스트 카드", { group: "통합 테마", shape: "card", tone: "solid", size: "medium", rankStyle: "box", groupRankMode: "regional", apartmentRankMode: "local", note: "현재 지도와 가장 가까운 녹색 카드형" }),
  markerDesign("theme-graphite-pill", "02 그래파이트 필", { group: "통합 테마", shape: "pill", tone: "solid", size: "wide", rankStyle: "plain", groupRankMode: "parent", apartmentRankMode: "dong", note: "검정 헤더와 어울리는 절제된 필형" }),
  markerDesign("theme-blueprint", "03 블루프린트", { group: "통합 테마", shape: "card", tone: "outline", size: "medium", rankStyle: "box", groupRankMode: "regional", apartmentRankMode: "local", note: "청사진 느낌의 선명한 라인형" }),
  markerDesign("theme-ivory-line", "04 아이보리 라인", { group: "통합 테마", shape: "card", tone: "white", size: "medium", rankStyle: "plain", groupRankMode: "regional", apartmentRankMode: "local", note: "밝은 배경 위에서 단정한 흰색 라벨" }),
  markerDesign("theme-mint-chip", "05 민트 칩", { group: "통합 테마", shape: "card", tone: "soft", size: "medium", rankStyle: "circle", groupRankMode: "regional", apartmentRankMode: "local", note: "부드럽지만 데이터 값이 잘 보이는 칩형" }),
  markerDesign("theme-coral-badge", "06 코랄 배지", { group: "통합 테마", shape: "pill", tone: "solid", size: "wide", rankStyle: "circle", groupRankMode: "parent", apartmentRankMode: "dong", note: "상승 지역을 강하게 보여주는 배지형" }),
  markerDesign("theme-indigo-stack", "07 인디고 스택", { group: "통합 테마", shape: "card", tone: "solid", size: "tall", rankStyle: "box", groupRankMode: "all", apartmentRankMode: "regional", note: "순위 정보가 조금 더 많은 스택형" }),
  markerDesign("theme-slate-minimal", "08 슬레이트 미니멀", { group: "통합 테마", shape: "pill", tone: "outline", size: "small", rankStyle: "plain", groupRankMode: "none", apartmentRankMode: "none", showRank: false, note: "지도 자체를 많이 보이게 하는 최소형" }),
  markerDesign("theme-paper-tag", "09 페이퍼 태그", { group: "통합 테마", shape: "card", tone: "white", size: "wide", rankStyle: "box", groupRankMode: "parent", apartmentRankMode: "dong", note: "종이 태그처럼 가볍게 얹히는 형태" }),
  markerDesign("theme-emerald-glow", "10 에메랄드 글로우", { group: "통합 테마", shape: "pill", tone: "solid", size: "medium", rankStyle: "circle", groupRankMode: "regional", apartmentRankMode: "local", note: "살짝 빛나는 고급형" }),
  markerDesign("theme-cocoa-label", "11 코코아 라벨", { group: "통합 테마", shape: "card", tone: "solid", size: "medium", rankStyle: "plain", groupRankMode: "regional", apartmentRankMode: "local", note: "따뜻한 라벨 느낌의 차분한 테마" }),
  markerDesign("theme-sky-glass", "12 스카이 글래스", { group: "통합 테마", shape: "card", tone: "soft", size: "medium", rankStyle: "box", groupRankMode: "regional", apartmentRankMode: "local", note: "지도 위에 반투명하게 뜨는 유리 느낌" }),
  markerDesign("theme-navy-ticket", "13 네이비 티켓", { group: "통합 테마", shape: "card", tone: "solid", size: "tall", rankStyle: "box", groupRankMode: "all", apartmentRankMode: "regional", note: "티켓처럼 정돈된 정보형" }),
  markerDesign("theme-ruby-dot", "14 루비 도트", { group: "통합 테마", shape: "pill", tone: "solid", size: "wide", rankStyle: "circle", groupRankMode: "parent", apartmentRankMode: "dong", note: "강한 색 대비로 빠르게 읽히는 테마" }),
  markerDesign("theme-olive-map", "15 올리브 맵", { group: "통합 테마", shape: "card", tone: "soft", size: "medium", rankStyle: "plain", groupRankMode: "regional", apartmentRankMode: "local", note: "지도 색감과 자연스럽게 섞이는 테마" }),
  markerDesign("theme-cyan-pin", "16 시안 핀", { group: "통합 테마", shape: "pill", tone: "outline", size: "wide", rankStyle: "box", groupRankMode: "parent", apartmentRankMode: "dong", note: "핀처럼 또렷한 테두리형" }),
  markerDesign("theme-plum-soft", "17 플럼 소프트", { group: "통합 테마", shape: "card", tone: "soft", size: "medium", rankStyle: "circle", groupRankMode: "regional", apartmentRankMode: "local", note: "부드러운 보라 계열 포인트" }),
  markerDesign("theme-steel-data", "18 스틸 데이터", { group: "통합 테마", shape: "card", tone: "outline", size: "tall", rankStyle: "box", groupRankMode: "all", apartmentRankMode: "regional", note: "대시보드처럼 정확한 정보형" }),
  markerDesign("theme-black-price", "19 블랙 프라이스", { group: "통합 테마", shape: "pill", tone: "solid", size: "medium", rankStyle: "plain", groupRankMode: "regional", apartmentRankMode: "local", note: "가격 앱처럼 굵고 강한 블랙 테마" }),
  markerDesign("theme-white-compact", "20 화이트 컴팩트", { group: "통합 테마", shape: "card", tone: "white", size: "dense", rankStyle: "box", groupRankMode: "all", apartmentRankMode: "full", rankLabelMode: "abbr", note: "작은 공간에 많은 정보를 담는 흰색 테마" })
];
const markerDesignVariantMap = new Map(markerDesignVariants.map((item) => [item.id, item]));
const markerThemeOptions = markerDesignVariants.map((item) => markerVerbosityOption(item.id, item.name.replace(/^\d+\s*/, ""), item.note));
const markerVerbosityOptionsByLevel = Object.fromEntries(markerLevelConfigs.map((level) => [level.id, markerThemeOptions]));
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
  11: "서울",
  26: "부산",
  27: "대구",
  28: "인천",
  29: "광주",
  30: "대전",
  31: "울산",
  36: "세종",
  41: "경기",
  42: "강원",
  43: "충북",
  44: "충남",
  45: "전북",
  46: "전남",
  47: "경북",
  48: "경남",
  50: "제주"
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
  growthRateColorSelected: document.querySelector("#growthRateColorSelected"),
  growthRateColorDesignGrid: document.querySelector("#growthRateColorDesignGrid"),
  designLogoSelected: document.querySelector("#designLogoSelected"),
  logoDesignGrid: document.querySelector("#logoDesignGrid"),
  designGraphSelected: document.querySelector("#designGraphSelected"),
  graphDesignGrid: document.querySelector("#graphDesignGrid"),
  designPyeongGraphSelected: document.querySelector("#designPyeongGraphSelected"),
  pyeongGraphDesignGrid: document.querySelector("#pyeongGraphDesignGrid"),
  molitSummary: document.querySelector("#molitSummary"),
  molitCompletionList: document.querySelector("#molitCompletionList"),
  molitCoordinateSummary: document.querySelector("#molitCoordinateSummary"),
  molitCoordinateRows: document.querySelector("#molitCoordinateRows"),
  molitDuplicateSummary: document.querySelector("#molitDuplicateSummary"),
  molitDuplicateRows: document.querySelector("#molitDuplicateRows"),
  mapView: document.querySelector("#mapView"),
  zoomMapTitle: document.querySelector("#zoomMapTitle"),
  zoomMapPeriod: document.querySelector("#zoomMapPeriod"),
  zoomMapLevel: document.querySelector("#zoomMapLevel"),
  zoomMapCount: document.querySelector("#zoomMapCount"),
  zoomMap: document.querySelector("#zoomMap"),
  mapCanvasWrap: document.querySelector(".map-canvas-wrap"),
  mapTransitionStatus: document.querySelector("#mapTransitionStatus"),
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
