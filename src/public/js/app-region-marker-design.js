const regionMarkerDesignStorageKey = "orulzip.regionMarkerDesignByLevel";
const regionMarkerDisplayStorageKey = "orulzip.regionMarkerDisplayByLevel";
const regionMarkerTemplateStorageKey = "orulzip.regionMarkerTemplateByLevel.v1";
const regionMarkerStyleStorageKey = "orulzip.regionMarkerStyleByLevel";
const regionMarkerStylePresetStorageKey = "orulzip.regionMarkerStylePresets";
const regionMarkerLevels = ["dong", "sigungu", "sido"];
const regionMarkerTemplateStyleOptions = [
  { token: "작게", label: "작게", className: "region-template-size-sm", group: "size" },
  { token: "보통", label: "보통", className: "region-template-size-md", group: "size" },
  { token: "크게", label: "크게", className: "region-template-size-lg", group: "size" },
  { token: "아주크게", label: "아주크게", className: "region-template-size-xl", group: "size" },
  { token: "굵게", label: "굵게", className: "region-template-weight-bold", group: "weight" },
  { token: "얇게", label: "얇게", className: "region-template-weight-regular", group: "weight" },
  { token: "기본색", label: "기본색", className: "region-template-color-default", group: "color" },
  { token: "회색", label: "회색", className: "region-template-color-muted", group: "color" },
  { token: "파랑", label: "파랑", className: "region-template-color-blue", group: "color" },
  { token: "빨강", label: "빨강", className: "region-template-color-red", group: "color" },
  { token: "상승색", label: "상승색", className: "region-template-color-growth", group: "color" },
  { token: "하락색", label: "하락색", className: "region-template-color-drop", group: "color" }
];
const regionMarkerTemplateStyleOptionMap = new Map(regionMarkerTemplateStyleOptions.map((option) => [option.token, option]));
const regionMarkerLevelLabels = {
  all: "공통",
  dong: "동",
  sigungu: "시군구",
  sido: "시도"
};
const regionMarkerRankLevelsByLevel = {
  dong: ["sigungu", "sido", "national"],
  sigungu: ["sido", "national"],
  sido: ["national"]
};
const defaultRegionMarkerDesignByLevel = {
  dong: "white",
  sigungu: "white",
  sido: "white"
};
const defaultRegionMarkerDisplayByLevel = {
  dong: { sigungu: true, sido: true, national: true },
  sigungu: { sido: true, national: true },
  sido: { national: true }
};
const defaultRegionMarkerTemplateByLevel = {
  dong: {
    label: "{{동명}}",
    value: "{{상승률}}",
    rankRows: {
      sigungu: "{{시군구명}} {{시군구내순위}}",
      sido: "{{시도명}} {{시도내순위}}",
      national: "전국 {{전국순위}}"
    }
  },
  sigungu: {
    label: "{{시군구명}}",
    value: "{{상승률}}",
    rankRows: {
      sido: "{{시도명}} {{시도내순위}}",
      national: "전국 {{전국순위}}"
    }
  },
  sido: {
    label: "{{시도명}}",
    value: "{{상승률}}",
    rankRows: {
      national: "전국 {{전국순위}}"
    }
  }
};
const regionMarkerTemplateTokensByLevel = {
  dong: [
    ["동명", "동 지역명"],
    ["시군구명", "상위 시군구"],
    ["시도명", "상위 시도"],
    ["기간", "선택 기간"],
    ["상승률", "상승률"],
    ["시군구내순위", "시군구 내 순위"],
    ["시군구내등수", "시군구 내 등수"],
    ["시군구내전체", "시군구 내 전체"],
    ["시군구내상위퍼센트", "시군구 내 상위 %"],
    ["시도내순위", "시도 내 순위"],
    ["시도내등수", "시도 내 등수"],
    ["시도내전체", "시도 내 전체"],
    ["시도내상위퍼센트", "시도 내 상위 %"],
    ["전국순위", "전국 순위"],
    ["전국등수", "전국 등수"],
    ["전국전체", "전국 전체"],
    ["전국상위퍼센트", "전국 상위 %"]
  ],
  sigungu: [
    ["시군구명", "시군구 지역명"],
    ["시도명", "상위 시도"],
    ["기간", "선택 기간"],
    ["상승률", "상승률"],
    ["시도내순위", "시도 내 순위"],
    ["시도내등수", "시도 내 등수"],
    ["시도내전체", "시도 내 전체"],
    ["시도내상위퍼센트", "시도 내 상위 %"],
    ["전국순위", "전국 순위"],
    ["전국등수", "전국 등수"],
    ["전국전체", "전국 전체"],
    ["전국상위퍼센트", "전국 상위 %"]
  ],
  sido: [
    ["시도명", "시도 지역명"],
    ["기간", "선택 기간"],
    ["상승률", "상승률"],
    ["전국순위", "전국 순위"],
    ["전국등수", "전국 등수"],
    ["전국전체", "전국 전체"],
    ["전국상위퍼센트", "전국 상위 %"]
  ]
};
const regionMarkerDesignOptions = [
  { id: "white", name: "화이트 데이터칩", className: "rank-chip-white" },
  { id: "stack", name: "데이터칩 스택", className: "rank-chip-stack" },
  { id: "table", name: "미니 테이블", className: "rank-chip-table" },
  { id: "dark", name: "다크 데이터칩", className: "rank-chip-dark" }
];
const regionMarkerDesignOptionMap = new Map(regionMarkerDesignOptions.map((item) => [item.id, item]));
const regionMarkerStyleControls = [
  { key: "rankBoxEnabled", label: "순위 둥근 박스", group: "박스", type: "boolean" },
  { key: "outerBoxWidth", label: "외부 박스 너비", group: "박스", min: 88, max: 220, step: 1 },
  { key: "rankBoxWidth", label: "순위 박스 너비", group: "박스", min: 70, max: 204, step: 1 },
  { key: "markerPaddingX", label: "전체 좌우 여백", group: "박스", min: 4, max: 20, step: 1 },
  { key: "markerPaddingY", label: "전체 상하 여백", group: "박스", min: 4, max: 18, step: 1 },
  { key: "markerBorderRadius", label: "전체 라운드", group: "박스", min: 0, max: 18, step: 1 },
  { key: "rankPaddingX", label: "순위 좌우 여백", group: "박스", min: 0, max: 16, step: 1 },
  { key: "rankPaddingY", label: "순위 상하 여백", group: "박스", min: 0, max: 12, step: 1 },
  { key: "rankBorderRadius", label: "순위 라운드", group: "박스", min: 0, max: 18, step: 1 },
  { key: "labelFontSize", label: "지역명 글자", group: "글자", min: 8, max: 18, step: 1 },
  { key: "valueFontSize", label: "상승률 글자", group: "글자", min: 16, max: 38, step: 1 },
  { key: "sigunguFontSize", label: "수정구 글자", group: "글자", min: 7, max: 17, step: 1 },
  { key: "sidoFontSize", label: "경기 글자", group: "글자", min: 7, max: 17, step: 1 },
  { key: "nationalFontSize", label: "전국 글자", group: "글자", min: 7, max: 17, step: 1 },
  { key: "rankValueFontSize", label: "등수 글자", group: "글자", min: 8, max: 18, step: 1 },
  { key: "labelRateGap", label: "지역명-상승률 간격", group: "행간", min: 0, max: 18, step: 1 },
  { key: "valueRankGap", label: "상승률-순위박스 간격", group: "행간", min: 0, max: 18, step: 1 },
  { key: "rankRowGap", label: "순위 행간", group: "행간", min: 0, max: 12, step: 1 },
  { key: "rankRowHeight", label: "순위 행 높이", group: "행간", min: 14, max: 32, step: 1 }
];
const regionMarkerStyleControlMap = new Map(regionMarkerStyleControls.map((item) => [item.key, item]));
const regionMarkerDesignDefaultWidths = {
  white: 126,
  stack: 118,
  table: 138,
  dark: 130
};

function readStoredRegionMarkerDesignByLevel() {
  const result = { ...defaultRegionMarkerDesignByLevel };
  try {
    const stored = JSON.parse(window.localStorage.getItem(regionMarkerDesignStorageKey) || "{}");
    for (const level of regionMarkerLevels) {
      if (regionMarkerDesignOptionMap.has(stored?.[level])) result[level] = stored[level];
    }
  } catch {
    // Ignore malformed localStorage and use defaults.
  }
  return result;
}

function readStoredRegionMarkerDisplayByLevel() {
  const result = cloneDefaultRegionMarkerDisplay();
  try {
    const stored = JSON.parse(window.localStorage.getItem(regionMarkerDisplayStorageKey) || "{}");
    for (const level of regionMarkerLevels) {
      for (const rankLevel of regionMarkerRankLevelsByLevel[level] || []) {
        if (typeof stored?.[level]?.[rankLevel] === "boolean") {
          result[level][rankLevel] = stored[level][rankLevel];
        }
      }
    }
  } catch {
    // Ignore malformed localStorage and use defaults.
  }
  return result;
}

function readStoredRegionMarkerTemplateByLevel() {
  const result = cloneDefaultRegionMarkerTemplate();
  try {
    const stored = JSON.parse(window.localStorage.getItem(regionMarkerTemplateStorageKey) || "{}");
    for (const level of regionMarkerLevels) {
      result[level] = sanitizeRegionMarkerTemplate(level, stored?.[level], result[level]);
    }
  } catch {
    // Ignore malformed localStorage and use defaults.
  }
  return result;
}

function readStoredRegionMarkerStyleByLevel() {
  const result = {};
  try {
    const stored = JSON.parse(window.localStorage.getItem(regionMarkerStyleStorageKey) || "{}");
    for (const level of regionMarkerLevels) {
      const style = sanitizeRegionMarkerStyle(stored?.[level]);
      if (style) result[level] = style;
    }
  } catch {
    // Ignore malformed localStorage and use defaults.
  }
  return result;
}

function readStoredRegionMarkerStylePresets() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(regionMarkerStylePresetStorageKey) || "[]");
    if (!Array.isArray(stored)) return [];
    return stored
      .map((preset) => {
        const style = sanitizeRegionMarkerStyle(preset?.style);
        if (!style) return null;
        return {
          id: String(preset.id || `preset-${Date.now()}`),
          name: String(preset.name || "프리셋"),
          sourceLevel: preset.sourceLevel === "all" ? "all" : normalizeRegionMarkerLevel(preset.sourceLevel),
          style
        };
      })
      .filter(Boolean)
      .slice(0, 24);
  } catch {
    return [];
  }
}

function cloneDefaultRegionMarkerDisplay() {
  return Object.fromEntries(
    Object.entries(defaultRegionMarkerDisplayByLevel).map(([level, ranks]) => [level, { ...ranks }])
  );
}

function cloneDefaultRegionMarkerTemplate() {
  return Object.fromEntries(
    Object.entries(defaultRegionMarkerTemplateByLevel).map(([level, template]) => [
      level,
      {
        label: template.label,
        value: template.value,
        rankRows: { ...template.rankRows }
      }
    ])
  );
}

function activeRegionMarkerDesign(level = "dong") {
  const normalizedLevel = normalizeRegionMarkerLevel(level);
  const id = state.regionMarkerDesignByLevel?.[normalizedLevel] || defaultRegionMarkerDesignByLevel[normalizedLevel];
  return regionMarkerDesignOptionMap.get(id) || regionMarkerDesignOptionMap.get(defaultRegionMarkerDesignByLevel[normalizedLevel]);
}

function activeRegionMarkerDisplay(level = "dong") {
  const normalizedLevel = normalizeRegionMarkerLevel(level);
  return {
    ...(defaultRegionMarkerDisplayByLevel[normalizedLevel] || {}),
    ...(state.regionMarkerDisplayByLevel?.[normalizedLevel] || {})
  };
}

function activeRegionMarkerRankLevels(level = "dong") {
  const normalizedLevel = normalizeRegionMarkerLevel(level);
  const display = activeRegionMarkerDisplay(normalizedLevel);
  return (regionMarkerRankLevelsByLevel[normalizedLevel] || []).filter((rankLevel) => display[rankLevel]);
}

function activeRegionMarkerTemplate(level = "dong") {
  const normalizedLevel = normalizeRegionMarkerLevel(level);
  return sanitizeRegionMarkerTemplate(
    normalizedLevel,
    state.regionMarkerTemplateByLevel?.[normalizedLevel],
    defaultRegionMarkerTemplateByLevel[normalizedLevel]
  );
}

function activeRegionMarkerStyle(level = "dong", design = activeRegionMarkerDesign(level)) {
  const normalizedLevel = normalizeRegionMarkerLevel(level);
  return {
    ...defaultRegionMarkerStyle(normalizedLevel, design),
    ...(state.regionMarkerStyleByLevel?.[normalizedLevel] || {})
  };
}

function defaultRegionMarkerStyle(level = "dong", design = activeRegionMarkerDesign(level)) {
  const normalizedLevel = normalizeRegionMarkerLevel(level);
  const designId = design?.id || activeRegionMarkerDesign(normalizedLevel)?.id || "white";
  const outerBoxWidth = defaultRegionMarkerOuterWidth(normalizedLevel, designId);
  return {
    outerBoxWidth,
    rankBoxWidth: Math.max(70, outerBoxWidth - 16),
    labelFontSize: 10,
    valueFontSize: 25,
    sigunguFontSize: 9,
    sidoFontSize: 9,
    nationalFontSize: 9,
    rankValueFontSize: 10,
    labelRateGap: 5,
    valueRankGap: 5,
    rankRowGap: designId === "table" ? 0 : 4,
    rankRowHeight: 18,
    rankBoxEnabled: true,
    markerPaddingX: 8,
    markerPaddingY: 8,
    markerBorderRadius: 7,
    rankPaddingX: 7,
    rankPaddingY: 4,
    rankBorderRadius: 18
  };
}

function defaultRegionMarkerOuterWidth(level, designId) {
  if (level === "sido") return 110;
  if (level === "sigungu") return 122;
  return regionMarkerDesignDefaultWidths[designId] || regionMarkerDesignDefaultWidths.white;
}

function sanitizeRegionMarkerStyle(style) {
  if (!style || typeof style !== "object") return null;
  const result = {};
  for (const control of regionMarkerStyleControls) {
    const value = normalizeRegionMarkerStyleValue(control.key, style[control.key]);
    if (value !== null) result[control.key] = value;
  }
  return Object.keys(result).length ? result : null;
}

function sanitizeRegionMarkerTemplate(level, template, fallback = defaultRegionMarkerTemplateByLevel[normalizeRegionMarkerLevel(level)]) {
  const normalizedLevel = normalizeRegionMarkerLevel(level);
  const defaultTemplate = fallback || defaultRegionMarkerTemplateByLevel[normalizedLevel];
  const result = {
    label: normalizeRegionMarkerTemplateText(template?.label, defaultTemplate.label),
    value: normalizeRegionMarkerTemplateText(template?.value, defaultTemplate.value),
    rankRows: {}
  };
  for (const rankLevel of regionMarkerRankLevelsByLevel[normalizedLevel] || []) {
    result.rankRows[rankLevel] = normalizeRegionMarkerTemplateText(
      template?.rankRows?.[rankLevel],
      defaultTemplate.rankRows?.[rankLevel] || ""
    );
  }
  return result;
}

function normalizeRegionMarkerTemplateText(value, fallback = "") {
  const text = typeof value === "string" ? value : fallback;
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, 240);
}

function normalizeRegionMarkerStyleValue(key, value) {
  const control = regionMarkerStyleControlMap.get(key);
  if (!control) return null;
  if (control.type === "boolean") {
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "1" || value === 1) return true;
    if (value === "false" || value === "0" || value === 0) return false;
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const clamped = Math.min(control.max, Math.max(control.min, number));
  return Math.round(clamped / control.step) * control.step;
}

function setActiveRegionMarkerDesign(level, designId) {
  const normalizedLevel = normalizeRegionMarkerLevel(level);
  if (!regionMarkerDesignOptionMap.has(designId)) return;
  if (!state.regionMarkerDesignByLevel) state.regionMarkerDesignByLevel = { ...defaultRegionMarkerDesignByLevel };
  state.regionMarkerDesignByLevel[normalizedLevel] = designId;
  writeRegionMarkerDesignState();
  syncRegionMarkerDesignControls();
  rerenderRegionMarkers();
}

function setRegionMarkerRankVisible(level, rankLevel, visible) {
  const normalizedLevel = normalizeRegionMarkerLevel(level);
  if (!(regionMarkerRankLevelsByLevel[normalizedLevel] || []).includes(rankLevel)) return;
  if (!state.regionMarkerDisplayByLevel) state.regionMarkerDisplayByLevel = cloneDefaultRegionMarkerDisplay();
  if (!state.regionMarkerDisplayByLevel[normalizedLevel]) {
    state.regionMarkerDisplayByLevel[normalizedLevel] = { ...defaultRegionMarkerDisplayByLevel[normalizedLevel] };
  }
  state.regionMarkerDisplayByLevel[normalizedLevel][rankLevel] = Boolean(visible);
  writeRegionMarkerDisplayState();
  syncRegionMarkerDesignControls();
  rerenderRegionMarkers();
}

function setRegionMarkerTemplateValue(level, field, rankLevel, value) {
  const normalizedLevel = normalizeRegionMarkerLevel(level);
  const current = activeRegionMarkerTemplate(normalizedLevel);
  const next = {
    label: current.label,
    value: current.value,
    rankRows: { ...current.rankRows }
  };
  if (field === "label" || field === "value") {
    next[field] = normalizeRegionMarkerTemplateText(value, defaultRegionMarkerTemplateByLevel[normalizedLevel][field]);
  } else if (field === "rankRow" && (regionMarkerRankLevelsByLevel[normalizedLevel] || []).includes(rankLevel)) {
    next.rankRows[rankLevel] = normalizeRegionMarkerTemplateText(value, defaultRegionMarkerTemplateByLevel[normalizedLevel].rankRows[rankLevel]);
  } else {
    return;
  }
  if (!state.regionMarkerTemplateByLevel) state.regionMarkerTemplateByLevel = cloneDefaultRegionMarkerTemplate();
  state.regionMarkerTemplateByLevel[normalizedLevel] = next;
  writeRegionMarkerTemplateState();
  syncRegionMarkerTemplatePreview();
  rerenderRegionMarkers();
}

function resetRegionMarkerTemplate(level) {
  const normalizedLevel = normalizeRegionMarkerLevel(level);
  if (!state.regionMarkerTemplateByLevel) state.regionMarkerTemplateByLevel = cloneDefaultRegionMarkerTemplate();
  state.regionMarkerTemplateByLevel[normalizedLevel] = sanitizeRegionMarkerTemplate(normalizedLevel, defaultRegionMarkerTemplateByLevel[normalizedLevel]);
  writeRegionMarkerTemplateState();
  renderRegionMarkerStyleEditor();
  rerenderRegionMarkers();
}

function setRegionMarkerStyleValue(level, key, value) {
  const normalizedValue = normalizeRegionMarkerStyleValue(key, value);
  if (normalizedValue === null) return;
  if (!state.regionMarkerStyleByLevel) state.regionMarkerStyleByLevel = {};
  for (const markerLevel of regionMarkerLevels) {
    state.regionMarkerStyleByLevel[markerLevel] = {
      ...(state.regionMarkerStyleByLevel[markerLevel] || {}),
      [key]: normalizedValue
    };
  }
  writeRegionMarkerStyleState();
  syncRegionMarkerStyleEditor();
  syncRegionMarkerDesignControls();
  rerenderRegionMarkers();
}

function resetRegionMarkerStyle(level) {
  if (!state.regionMarkerStyleByLevel) state.regionMarkerStyleByLevel = {};
  for (const markerLevel of regionMarkerLevels) {
    delete state.regionMarkerStyleByLevel[markerLevel];
  }
  writeRegionMarkerStyleState();
  syncRegionMarkerStyleEditor();
  syncRegionMarkerDesignControls();
  rerenderRegionMarkers();
}

function saveRegionMarkerStylePreset() {
  const level = activeRegionMarkerStyleEditorLevel();
  const input = document.querySelector("[data-region-marker-preset-name]");
  const name = input?.value.trim() || `공통 프리셋 ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
  const style = activeRegionMarkerStyle(level);
  const preset = {
    id: `preset-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    sourceLevel: "all",
    style
  };
  state.regionMarkerStylePresets = [preset, ...(state.regionMarkerStylePresets || [])].slice(0, 24);
  state.selectedRegionMarkerStylePresetId = preset.id;
  if (input) input.value = "";
  writeRegionMarkerStylePresetState();
  renderRegionMarkerStyleEditor();
}

function selectRegionMarkerStylePreset(presetId) {
  const preset = (state.regionMarkerStylePresets || []).find((item) => item.id === presetId);
  if (!preset) return;
  state.selectedRegionMarkerStylePresetId = preset.id;
  applyRegionMarkerStylePreset(preset.id);
}

function applySelectedRegionMarkerStylePreset() {
  applyRegionMarkerStylePreset(state.selectedRegionMarkerStylePresetId);
}

function applyRegionMarkerStylePreset(presetId) {
  const preset = (state.regionMarkerStylePresets || []).find((item) => item.id === presetId);
  if (!preset) return;
  state.selectedRegionMarkerStylePresetId = preset.id;
  if (!state.regionMarkerStyleByLevel) state.regionMarkerStyleByLevel = {};
  for (const level of regionMarkerLevels) {
    state.regionMarkerStyleByLevel[level] = { ...activeRegionMarkerStyle(level), ...preset.style };
  }
  writeRegionMarkerStyleState();
  syncRegionMarkerStyleEditor();
  syncRegionMarkerDesignControls();
  rerenderRegionMarkers();
}

function deleteRegionMarkerStylePreset(presetId) {
  state.regionMarkerStylePresets = (state.regionMarkerStylePresets || []).filter((item) => item.id !== presetId);
  if (state.selectedRegionMarkerStylePresetId === presetId) {
    state.selectedRegionMarkerStylePresetId = "";
  }
  writeRegionMarkerStylePresetState();
  renderRegionMarkerStyleEditor();
}

function writeRegionMarkerDesignState() {
  try {
    window.localStorage.setItem(regionMarkerDesignStorageKey, JSON.stringify(state.regionMarkerDesignByLevel || defaultRegionMarkerDesignByLevel));
  } catch {
    // localStorage may be disabled in private contexts.
  }
}

function writeRegionMarkerDisplayState() {
  try {
    window.localStorage.setItem(regionMarkerDisplayStorageKey, JSON.stringify(state.regionMarkerDisplayByLevel || defaultRegionMarkerDisplayByLevel));
  } catch {
    // localStorage may be disabled in private contexts.
  }
}

function writeRegionMarkerTemplateState() {
  try {
    window.localStorage.setItem(regionMarkerTemplateStorageKey, JSON.stringify(state.regionMarkerTemplateByLevel || defaultRegionMarkerTemplateByLevel));
  } catch {
    // localStorage may be disabled in private contexts.
  }
}

function writeRegionMarkerStyleState() {
  try {
    window.localStorage.setItem(regionMarkerStyleStorageKey, JSON.stringify(state.regionMarkerStyleByLevel || {}));
  } catch {
    // localStorage may be disabled in private contexts.
  }
}

function writeRegionMarkerStylePresetState() {
  try {
    window.localStorage.setItem(regionMarkerStylePresetStorageKey, JSON.stringify(state.regionMarkerStylePresets || []));
  } catch {
    // localStorage may be disabled in private contexts.
  }
}

function regionMarkerStyleCssVars(level = "dong", design = activeRegionMarkerDesign(level)) {
  const style = activeRegionMarkerStyle(level, design);
  const rankWidthExtra = typeof markerRankWidthExtra === "function" ? markerRankWidthExtra("region") : 0;
  const rankBoxEnabled = style.rankBoxEnabled !== false;
  return {
    "--region-marker-outer-width": `${style.outerBoxWidth + rankWidthExtra}px`,
    "--region-marker-rank-box-width": `${style.rankBoxWidth + rankWidthExtra}px`,
    "--region-marker-padding-x": `${style.markerPaddingX}px`,
    "--region-marker-padding-y": `${style.markerPaddingY}px`,
    "--region-marker-border-radius": `${style.markerBorderRadius}px`,
    "--region-marker-rank-padding-x": `${style.rankPaddingX}px`,
    "--region-marker-rank-padding-y": `${style.rankPaddingY}px`,
    "--region-marker-rank-border-radius": `${style.rankBorderRadius}px`,
    "--region-marker-rank-box-bg": rankBoxEnabled ? "var(--rank-badge-bg)" : "transparent",
    "--region-marker-rank-box-border-width": rankBoxEnabled ? "1px" : "0px",
    "--region-marker-label-font-size": `${style.labelFontSize}px`,
    "--region-marker-value-font-size": `${style.valueFontSize}px`,
    "--region-marker-rank-sigungu-font-size": `${style.sigunguFontSize}px`,
    "--region-marker-rank-sido-font-size": `${style.sidoFontSize}px`,
    "--region-marker-rank-national-font-size": `${style.nationalFontSize}px`,
    "--region-marker-rank-value-font-size": `${style.rankValueFontSize}px`,
    "--region-marker-label-rate-gap": `${style.labelRateGap}px`,
    "--region-marker-value-rank-gap": `${style.valueRankGap}px`,
    "--region-marker-rank-row-gap": `${style.rankRowGap}px`,
    "--region-marker-rank-row-height": `${style.rankRowHeight}px`
  };
}

function regionMarkerStyleInline(level = "dong", design = activeRegionMarkerDesign(level)) {
  return Object.entries(regionMarkerStyleCssVars(level, design))
    .map(([property, value]) => `${property}: ${value}`)
    .join("; ");
}

function applyRegionMarkerStyleToElement(element, level, design = activeRegionMarkerDesign(level)) {
  if (!element) return;
  const vars = regionMarkerStyleCssVars(level, design);
  for (const [property, value] of Object.entries(vars)) {
    element.style.setProperty(property, value);
  }
}

function bindRegionMarkerDesignControls() {
  document.addEventListener("mousedown", (event) => {
    if (event.target.closest("[data-region-marker-template-style-token], [data-region-marker-template-token]")) {
      event.preventDefault();
    }
  });
  document.addEventListener("click", (event) => {
    const levelButton = event.target.closest("[data-region-marker-style-level-option]");
    if (levelButton) {
      state.activeRegionMarkerStyleLevel = normalizeRegionMarkerLevel(levelButton.dataset.regionMarkerStyleLevelOption);
      renderRegionMarkerStyleEditor();
      return;
    }
    const actionButton = event.target.closest("[data-region-marker-style-action]");
    if (actionButton) {
      const action = actionButton.dataset.regionMarkerStyleAction;
      if (action === "reset") resetRegionMarkerStyle();
      if (action === "resetTemplate") resetRegionMarkerTemplate(activeRegionMarkerStyleEditorLevel());
      if (action === "savePreset") saveRegionMarkerStylePreset();
      if (action === "applyPreset") applySelectedRegionMarkerStylePreset();
      return;
    }
    const tokenButton = event.target.closest("[data-region-marker-template-token]");
    if (tokenButton) {
      insertRegionMarkerTemplateToken(tokenButton.dataset.regionMarkerTemplateToken);
      return;
    }
    const styleButton = event.target.closest("[data-region-marker-template-style-token]");
    if (styleButton) {
      applyRegionMarkerTemplateStyle(styleButton.dataset.regionMarkerTemplateStyleToken);
      return;
    }
    const presetDeleteButton = event.target.closest("[data-region-marker-preset-delete]");
    if (presetDeleteButton) {
      deleteRegionMarkerStylePreset(presetDeleteButton.dataset.regionMarkerPresetDelete);
      return;
    }
    const presetButton = event.target.closest("[data-region-marker-preset-id]");
    if (presetButton) {
      selectRegionMarkerStylePreset(presetButton.dataset.regionMarkerPresetId);
      return;
    }
    const card = event.target.closest("[data-region-marker-design-id]");
    if (!card) return;
    const section = card.closest(".dong-rank-concept-panel[data-region-marker-level]");
    setActiveRegionMarkerDesign(section?.dataset.regionMarkerLevel, card.dataset.regionMarkerDesignId);
  });
  document.addEventListener("keydown", (event) => {
    const card = event.target.closest("[data-region-marker-design-id]");
    if (!card || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    const section = card.closest(".dong-rank-concept-panel[data-region-marker-level]");
    setActiveRegionMarkerDesign(section?.dataset.regionMarkerLevel, card.dataset.regionMarkerDesignId);
  });
  document.querySelectorAll("[data-region-marker-rank-level]").forEach((input) => {
    input.addEventListener("change", () => {
      setRegionMarkerRankVisible(input.dataset.regionMarkerLevel, input.dataset.regionMarkerRankLevel, input.checked);
    });
  });
  document.addEventListener("input", (event) => {
    const styleInput = event.target.closest("[data-region-marker-style-key]");
    if (styleInput) {
      const value = styleInput.type === "checkbox" ? styleInput.checked : styleInput.value;
      setRegionMarkerStyleValue(activeRegionMarkerStyleEditorLevel(), styleInput.dataset.regionMarkerStyleKey, value);
      return;
    }
    const templateInput = event.target.closest("[data-region-marker-template-field]");
    if (templateInput) {
      const markup = regionMarkerTemplateEditorToMarkup(templateInput);
      templateInput.dataset.regionMarkerTemplateRaw = markup;
      setRegionMarkerTemplateValue(
        activeRegionMarkerStyleEditorLevel(),
        templateInput.dataset.regionMarkerTemplateField,
        templateInput.dataset.regionMarkerTemplateRank || "",
        markup
      );
    }
  });
}

function syncRegionMarkerDesignControls() {
  document.querySelectorAll(".dong-rank-concept-panel[data-region-marker-level]").forEach((section) => {
    const level = normalizeRegionMarkerLevel(section.dataset.regionMarkerLevel);
    const activeDesign = activeRegionMarkerDesign(level);
    const display = activeRegionMarkerDisplay(level);
    section.querySelectorAll("[data-region-marker-design-id]").forEach((card) => {
      const isActive = card.dataset.regionMarkerDesignId === activeDesign.id;
      card.classList.toggle("active", isActive);
      card.setAttribute("aria-pressed", String(isActive));
    });
    section.querySelectorAll("[data-region-marker-rank-level]").forEach((input) => {
      const rankLevel = input.dataset.regionMarkerRankLevel;
      input.checked = Boolean(display[rankLevel]);
    });
    section.querySelectorAll("[data-region-marker-design-id]").forEach((card) => {
      const design = regionMarkerDesignOptionMap.get(card.dataset.regionMarkerDesignId) || activeDesign;
      card.querySelectorAll(".dong-rank-demo").forEach((marker) => {
        applyRegionMarkerStyleToElement(marker, level, design);
      });
    });
  });
  syncRegionMarkerStyleEditor();
}

function insertRegionMarkerTemplateToken(token) {
  const container = document.getElementById("regionMarkerStyleEditor");
  if (!container || !token) return;
  const activeInput = activeRegionMarkerTemplateEditor(container);
  if (!activeInput) return;
  const insertText = `{{${token}}}`;
  insertTextIntoRegionMarkerTemplateEditor(activeInput, insertText);
  activeInput.dispatchEvent(new Event("input", { bubbles: true }));
}

function activeRegionMarkerTemplateEditor(container = document.getElementById("regionMarkerStyleEditor")) {
  if (!container) return null;
  if (document.activeElement?.matches?.("[data-region-marker-template-field]")) return document.activeElement;
  const selection = window.getSelection?.();
  const selectedNode = selection?.rangeCount ? selection.getRangeAt(0).commonAncestorContainer : null;
  const selectedElement = selectedNode?.nodeType === Node.ELEMENT_NODE ? selectedNode : selectedNode?.parentElement;
  const selectedEditor = selectedElement?.closest?.("[data-region-marker-template-field]");
  if (selectedEditor && container.contains(selectedEditor)) return selectedEditor;
  return container.querySelector("[data-region-marker-template-field='value']")
    || container.querySelector("[data-region-marker-template-field='label']");
}

function insertTextIntoRegionMarkerTemplateEditor(editor, text) {
  editor.focus();
  const selection = window.getSelection?.();
  if (!selection) {
    editor.textContent += text;
    return;
  }
  let range = selection.rangeCount ? selection.getRangeAt(0) : null;
  if (!range || !editor.contains(range.commonAncestorContainer)) {
    range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
  }
  range.deleteContents();
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function applyRegionMarkerTemplateStyle(token) {
  const option = regionMarkerTemplateStyleOptionMap.get(token);
  const editor = activeRegionMarkerTemplateEditor();
  if (!option || !editor) return;
  editor.focus();
  const selection = window.getSelection?.();
  let range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (!range || !editor.contains(range.commonAncestorContainer)) {
    range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
  }
  const span = document.createElement("span");
  span.dataset.regionMarkerTemplateStyle = option.token;
  span.className = `region-template-style ${option.className}`;
  if (range.collapsed) {
    span.textContent = "텍스트";
    range.insertNode(span);
    range.selectNodeContents(span);
  } else {
    const contents = range.extractContents();
    span.appendChild(contents);
    range.insertNode(span);
    range.selectNodeContents(span);
  }
  selection.removeAllRanges();
  selection.addRange(range);
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

function rerenderRegionMarkers() {
  if (state.latestZoomMapData) {
    renderZoomMapSummary(state.latestZoomMapData);
    return;
  }
  if (typeof isMapTab === "function" && isMapTab() && typeof scheduleZoomMapLoad === "function") {
    scheduleZoomMapLoad();
  }
}

function normalizeRegionMarkerLevel(level = "dong") {
  return regionMarkerLevels.includes(level) ? level : "dong";
}

function renderRegionMarkerStyleEditor() {
  const container = document.getElementById("regionMarkerStyleEditor");
  if (!container) return;
  const level = activeRegionMarkerStyleEditorLevel();
  const style = activeRegionMarkerStyle(level);
  const template = activeRegionMarkerTemplate(level);
  const groupedControls = groupRegionMarkerStyleControls();
  const presets = state.regionMarkerStylePresets || [];
  container.innerHTML = `
    <div class="panel-head">
      <h2>지역 마커 디자인 에디터</h2>
      <span>${escapeHtml(regionMarkerLevelLabels[level])} 템플릿 · 공통 폰트 조절</span>
    </div>
    <div class="region-marker-editor-body">
      <div class="region-marker-editor-toolbar">
        <div class="region-marker-level-tabs" role="tablist" aria-label="지역 마커 종류">
          ${regionMarkerLevels.map((markerLevel) => `
            <button type="button" class="${markerLevel === level ? "active" : ""}" data-region-marker-style-level-option="${escapeHtml(markerLevel)}" aria-pressed="${markerLevel === level}">
              ${escapeHtml(regionMarkerLevelLabels[markerLevel])}
            </button>
          `).join("")}
        </div>
        <div class="region-marker-editor-actions">
          <button type="button" data-region-marker-style-action="resetTemplate">템플릿 리셋</button>
          <button type="button" data-region-marker-style-action="reset">전체 리셋</button>
          <input type="text" maxlength="20" placeholder="프리셋 이름" data-region-marker-preset-name>
          <button type="button" data-region-marker-style-action="savePreset">저장</button>
          <button type="button" data-region-marker-style-action="applyPreset" ${selectedRegionMarkerStylePreset() ? "" : "disabled"}>선택 프리셋 적용</button>
        </div>
      </div>
      <div class="region-marker-editor-layout">
        <div class="region-marker-editor-main">
          <fieldset class="region-marker-style-group region-marker-template-group">
            <legend>문구 템플릿</legend>
            <div class="region-marker-template-fields">
              ${regionMarkerTemplateInputHtml("지역명 줄", "label", "", template.label)}
              ${regionMarkerTemplateInputHtml("상승률 줄", "value", "", template.value)}
              ${(regionMarkerRankLevelsByLevel[level] || []).map((rankLevel) => regionMarkerTemplateInputHtml(
                `${regionMarkerRankLevelLabel(level, rankLevel)} 줄`,
                "rankRow",
                rankLevel,
                template.rankRows[rankLevel] || ""
              )).join("")}
            </div>
            <div class="region-marker-format-toolbar" aria-label="선택 텍스트 서식">
              ${regionMarkerTemplateStyleOptions.map((option) => `
                <button type="button" data-region-marker-template-style-token="${escapeHtml(option.token)}" data-style-group="${escapeHtml(option.group)}">
                  ${escapeHtml(option.label)}
                </button>
              `).join("")}
            </div>
            <div class="region-marker-token-list" aria-label="사용 가능한 변수">
              ${(regionMarkerTemplateTokensByLevel[level] || []).map(([token, label]) => `
                <button type="button" data-region-marker-template-token="${escapeHtml(token)}" title="${escapeHtml(label)}">{{${escapeHtml(token)}}}</button>
              `).join("")}
            </div>
          </fieldset>
          <div class="region-marker-style-groups">
            ${markerRankDisplayEditorHtml("region")}
            ${Object.entries(groupedControls).map(([group, controls]) => `
              <fieldset class="region-marker-style-group">
                <legend>${escapeHtml(group)}</legend>
                <div class="region-marker-style-fields">
                  ${controls.map((control) => regionMarkerStyleControlHtml(control, style[control.key])).join("")}
                </div>
              </fieldset>
            `).join("")}
          </div>
        </div>
        <aside class="region-marker-template-preview" aria-label="지도 미리보기">
          ${regionMarkerTemplatePreviewMapHtml(level)}
        </aside>
      </div>
      <div class="region-marker-preset-list">
        ${presets.length ? presets.map((preset) => `
          <span class="region-marker-preset-chip ${state.selectedRegionMarkerStylePresetId === preset.id ? "active" : ""}">
            <button type="button" data-region-marker-preset-id="${escapeHtml(preset.id)}">
              ${escapeHtml(preset.name)}
              <small>${escapeHtml(regionMarkerLevelLabels[preset.sourceLevel] || "마커")}</small>
            </button>
            <button type="button" aria-label="${escapeHtml(preset.name)} 삭제" data-region-marker-preset-delete="${escapeHtml(preset.id)}">x</button>
          </span>
        `).join("") : `<span class="region-marker-preset-empty">저장된 프리셋 없음</span>`}
      </div>
    </div>
  `;
}

function regionMarkerTemplateInputHtml(label, field, rankLevel, value) {
  return `
    <label class="region-marker-template-field">
      <span>${escapeHtml(label)}</span>
      <div class="region-marker-template-editor" contenteditable="true" role="textbox" aria-label="${escapeHtml(label)}" data-region-marker-template-field="${escapeHtml(field)}" data-region-marker-template-rank="${escapeHtml(rankLevel)}" data-region-marker-template-raw="${escapeHtml(value)}" spellcheck="false">${regionMarkerTemplateMarkupToEditorHtml(value)}</div>
    </label>
  `;
}

function regionMarkerRankLevelLabel(level, rankLevel) {
  if (level === "dong" && rankLevel === "sigungu") return "시군구 내 순위";
  if ((level === "dong" || level === "sigungu") && rankLevel === "sido") return "시도 내 순위";
  if (rankLevel === "national") return "전국 순위";
  return rankLevel;
}

function regionMarkerTemplatePreviewMapHtml(activeLevel = "dong") {
  const samples = regionMarkerTemplatePreviewSamples();
  return `
    <div class="region-marker-preview-card">
      <div class="region-marker-preview-top">
        <strong>지도 미리보기</strong>
        <span>${escapeHtml(regionMarkerLevelLabels[activeLevel])} 편집 중</span>
      </div>
      <div class="region-marker-preview-map">
        <span class="growth-rate-map-preview-road road-a"></span>
        <span class="growth-rate-map-preview-road road-b"></span>
        <span class="growth-rate-map-preview-river"></span>
        ${samples.map((sample) => regionMarkerTemplatePreviewMarkerHtml(sample, activeLevel)).join("")}
      </div>
    </div>
  `;
}

function regionMarkerTemplatePreviewMarkerHtml(sample, activeLevel) {
  if (sample.level === "apartment") {
    const apartmentHtml = typeof apartmentMarkerHtml === "function"
      ? apartmentMarkerHtml(sample.item, activeApartmentMarkerDesign())
      : `<span class="apartment-map-marker apartment-rank-marker rank-chip-white"><strong class="apartment-marker-rate-row">${escapeHtml(formatPercent(sample.item.growthRate))}</strong></span>`;
    return `
      <span class="region-marker-preview-marker level-apartment" style="left:${sample.x}%;top:${sample.y}%;">
        ${apartmentHtml}
      </span>
    `;
  }
  const design = activeRegionMarkerDesign(sample.level);
  const isActive = sample.level === activeLevel;
  return `
    <span class="region-marker-preview-marker level-${escapeHtml(sample.level)} ${isActive ? "active" : ""}" style="left:${sample.x}%;top:${sample.y}%;">
      ${zoomGroupMarkerContentHtml(sample.item, sample.level, design)}
    </span>
  `;
}

function regionMarkerTemplatePreviewSamples() {
  return [
    {
      level: "sido",
      x: 63,
      y: 25,
      item: {
        name: "서울",
        sidoName: "서울",
        sidoCode: "11",
        growthRate: 0.056,
        countryRank: 4,
        countryRankTotal: 17
      }
    },
    {
      level: "sigungu",
      x: 34,
      y: 54,
      item: {
        name: "서울 강남구",
        sigunguName: "서울 강남구",
        sidoName: "서울",
        sigunguCode: "11680",
        sidoCode: "11",
        growthRate: 0.072,
        sidoRank: 16,
        sidoRankTotal: 25,
        countryRank: 118,
        countryRankTotal: 250
      }
    },
    {
      level: "dong",
      x: 70,
      y: 63,
      item: {
        name: "서울 강남구 압구정동",
        dongName: "압구정동",
        sigunguName: "서울 강남구",
        sidoName: "서울",
        sigunguCode: "11680",
        sidoCode: "11",
        growthRate: 0.094,
        sigunguRank: 3,
        sigunguRankTotal: 14,
        sidoRank: 16,
        sidoRankTotal: 425,
        countryRank: 122,
        countryRankTotal: 3500
      }
    },
    {
      level: "apartment",
      x: 83,
      y: 50,
      item: {
        id: "preview-apartment",
        name: "한강래미안",
        address: "서울 강남구 압구정동",
        dongName: "압구정동",
        sigunguName: "서울 강남구",
        sidoName: "서울",
        sigunguCode: "11680",
        sidoCode: "11",
        supplyArea: 109,
        exclusiveArea: 84,
        growthRate: 0.118,
        dongRank: 2,
        dongRankTotal: 115,
        sigunguRank: 3,
        sigunguRankTotal: 14,
        sidoRank: 18,
        sidoRankTotal: 425,
        countryRank: 65,
        countryRankTotal: 3500
      }
    }
  ];
}

function groupRegionMarkerStyleControls() {
  return regionMarkerStyleControls.reduce((groups, control) => {
    if (!groups[control.group]) groups[control.group] = [];
    groups[control.group].push(control);
    return groups;
  }, {});
}

function regionMarkerStyleControlHtml(control, value) {
  if (control.type === "boolean") {
    return `
      <label class="region-marker-style-field-toggle">
        <input type="checkbox" ${value ? "checked" : ""} data-region-marker-style-key="${escapeHtml(control.key)}">
        <span>${escapeHtml(control.label)}</span>
      </label>
    `;
  }
  return `
    <label class="region-marker-style-field">
      <span>${escapeHtml(control.label)}</span>
      <input type="range" min="${control.min}" max="${control.max}" step="${control.step}" value="${value}" data-region-marker-style-key="${escapeHtml(control.key)}">
      <input type="number" min="${control.min}" max="${control.max}" step="${control.step}" value="${value}" data-region-marker-style-key="${escapeHtml(control.key)}">
    </label>
  `;
}

function syncRegionMarkerStyleEditor() {
  const container = document.getElementById("regionMarkerStyleEditor");
  if (!container) return;
  const level = activeRegionMarkerStyleEditorLevel();
  const style = activeRegionMarkerStyle(level);
  const template = activeRegionMarkerTemplate(level);
  const selectedPreset = selectedRegionMarkerStylePreset();
  container.querySelectorAll("[data-region-marker-style-level-option]").forEach((button) => {
    const isActive = normalizeRegionMarkerLevel(button.dataset.regionMarkerStyleLevelOption) === level;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  container.querySelectorAll("[data-region-marker-style-key]").forEach((input) => {
    const value = style[input.dataset.regionMarkerStyleKey];
    if (input.type === "checkbox") {
      input.checked = Boolean(value);
    } else if (String(input.value) !== String(value)) {
      input.value = value;
    }
  });
  container.querySelectorAll("[data-region-marker-template-field]").forEach((editor) => {
    const field = editor.dataset.regionMarkerTemplateField;
    const rankLevel = editor.dataset.regionMarkerTemplateRank || "";
    const value = field === "rankRow" ? template.rankRows[rankLevel] : template[field];
    if (String(editor.dataset.regionMarkerTemplateRaw || "") !== String(value || "")) {
      editor.dataset.regionMarkerTemplateRaw = value || "";
      editor.innerHTML = regionMarkerTemplateMarkupToEditorHtml(value || "");
    }
  });
  container.querySelectorAll("[data-region-marker-preset-id]").forEach((button) => {
    const isSelected = button.dataset.regionMarkerPresetId === selectedPreset?.id;
    button.closest(".region-marker-preset-chip")?.classList.toggle("active", isSelected);
  });
  container.querySelectorAll("[data-region-marker-style-action='applyPreset']").forEach((button) => {
    button.disabled = !selectedPreset;
  });
  syncMarkerRankDisplayOptionControls();
  syncRegionMarkerTemplatePreview();
}

function syncRegionMarkerTemplatePreview() {
  const container = document.getElementById("regionMarkerStyleEditor");
  const preview = container?.querySelector(".region-marker-template-preview");
  if (!preview) return;
  preview.innerHTML = regionMarkerTemplatePreviewMapHtml(activeRegionMarkerStyleEditorLevel());
}

function activeRegionMarkerStyleEditorLevel() {
  return normalizeRegionMarkerLevel(state.activeRegionMarkerStyleLevel || "dong");
}

function selectedRegionMarkerStylePreset() {
  return (state.regionMarkerStylePresets || []).find((item) => item.id === state.selectedRegionMarkerStylePresetId) || null;
}

function regionMarkerTemplateStyleClassName(token) {
  return regionMarkerTemplateStyleOptionMap.get(token)?.className || "";
}

function regionMarkerTemplateStyleTokens(markup = "") {
  return String(markup || "")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => regionMarkerTemplateStyleOptionMap.has(token));
}

function regionMarkerTemplateMarkupToEditorHtml(markup = "") {
  return regionMarkerTemplateMarkupToHtml(markup, {
    replaceVariables: false,
    editorSpans: true
  }).html;
}

function regionMarkerTemplateMarkupToHtml(markup = "", options = {}) {
  const replaceVariables = options.replaceVariables !== false;
  const values = options.values || {};
  const editorSpans = Boolean(options.editorSpans);
  const text = String(markup || "");
  let index = 0;
  let html = "";
  let plainText = "";
  const stack = [];

  const appendText = (chunk) => {
    if (!chunk) return;
    const rendered = replaceVariables
      ? chunk.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, token) => values[token.trim()] ?? "")
      : chunk;
    plainText += rendered;
    html += escapeHtml(rendered);
  };

  while (index < text.length) {
    if (text.startsWith("[/]", index) && stack.length) {
      html += "</span>";
      stack.pop();
      index += 3;
      continue;
    }
    if (text[index] === "[") {
      const closeIndex = text.indexOf("]", index + 1);
      if (closeIndex > index && closeIndex - index <= 48) {
        const styleText = text.slice(index + 1, closeIndex).trim();
        const tokens = regionMarkerTemplateStyleTokens(styleText);
        if (tokens.length && tokens.join(" ") === styleText) {
          const classNames = tokens
            .map(regionMarkerTemplateStyleClassName)
            .filter(Boolean)
            .join(" ");
          const styleAttr = tokens.join(" ");
          html += editorSpans
            ? `<span class="region-template-style ${escapeHtml(classNames)}" data-region-marker-template-style="${escapeHtml(styleAttr)}">`
            : `<span class="region-template-style ${escapeHtml(classNames)}">`;
          stack.push(tokens);
          index = closeIndex + 1;
          continue;
        }
      }
    }
    const nextIndex = text.indexOf("[", index + 1);
    const chunkEnd = nextIndex === -1 ? text.length : nextIndex;
    appendText(text.slice(index, chunkEnd));
    index = chunkEnd;
  }

  while (stack.length) {
    html += "</span>";
    stack.pop();
  }
  return {
    html,
    text: plainText.replace(/\s+/g, " ").trim()
  };
}

function regionMarkerTemplateEditorToMarkup(editor) {
  if (!editor) return "";
  const serializeNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    if (node.tagName === "BR") return " ";
    const content = Array.from(node.childNodes).map(serializeNode).join("");
    const style = regionMarkerTemplateStyleTokens(node.dataset?.regionMarkerTemplateStyle || "").join(" ");
    return style ? `[${style}]${content}[/]` : content;
  };
  return Array.from(editor.childNodes)
    .map(serializeNode)
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}
