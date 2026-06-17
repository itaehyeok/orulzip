const regionMarkerDesignStorageKey = "orulzip.regionMarkerDesignByLevel";
const regionMarkerDisplayStorageKey = "orulzip.regionMarkerDisplayByLevel";
const regionMarkerStyleStorageKey = "orulzip.regionMarkerStyleByLevel";
const regionMarkerStylePresetStorageKey = "orulzip.regionMarkerStylePresets";
const regionMarkerLevels = ["dong", "sigungu", "sido"];
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
const regionMarkerDesignOptions = [
  { id: "white", name: "화이트 데이터칩", className: "rank-chip-white" },
  { id: "stack", name: "데이터칩 스택", className: "rank-chip-stack" },
  { id: "table", name: "미니 테이블", className: "rank-chip-table" },
  { id: "dark", name: "다크 데이터칩", className: "rank-chip-dark" }
];
const regionMarkerDesignOptionMap = new Map(regionMarkerDesignOptions.map((item) => [item.id, item]));
const regionMarkerStyleControls = [
  { key: "outerBoxWidth", label: "외부 박스 너비", group: "박스", min: 88, max: 220, step: 1 },
  { key: "rankBoxWidth", label: "순위 박스 너비", group: "박스", min: 70, max: 204, step: 1 },
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
    rankRowHeight: 18
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

function normalizeRegionMarkerStyleValue(key, value) {
  const control = regionMarkerStyleControlMap.get(key);
  if (!control) return null;
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
  return {
    "--region-marker-outer-width": `${style.outerBoxWidth + rankWidthExtra}px`,
    "--region-marker-rank-box-width": `${style.rankBoxWidth + rankWidthExtra}px`,
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
      if (action === "savePreset") saveRegionMarkerStylePreset();
      if (action === "applyPreset") applySelectedRegionMarkerStylePreset();
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
    const input = event.target.closest("[data-region-marker-style-key]");
    if (!input) return;
    setRegionMarkerStyleValue(activeRegionMarkerStyleEditorLevel(), input.dataset.regionMarkerStyleKey, input.value);
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
  const groupedControls = groupRegionMarkerStyleControls();
  const presets = state.regionMarkerStylePresets || [];
  container.innerHTML = `
    <div class="panel-head">
      <h2>지역 마커 세부 편집</h2>
      <span>동 · 시군구 · 시도 공통 적용</span>
    </div>
    <div class="region-marker-editor-body">
      <div class="region-marker-editor-toolbar">
        <div class="region-marker-common-badge">세 단위 동시 편집</div>
        <div class="region-marker-editor-actions">
          <button type="button" data-region-marker-style-action="reset">전체 리셋</button>
          <input type="text" maxlength="20" placeholder="프리셋 이름" data-region-marker-preset-name>
          <button type="button" data-region-marker-style-action="savePreset">저장</button>
          <button type="button" data-region-marker-style-action="applyPreset" ${selectedRegionMarkerStylePreset() ? "" : "disabled"}>선택 프리셋 적용</button>
        </div>
      </div>
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

function groupRegionMarkerStyleControls() {
  return regionMarkerStyleControls.reduce((groups, control) => {
    if (!groups[control.group]) groups[control.group] = [];
    groups[control.group].push(control);
    return groups;
  }, {});
}

function regionMarkerStyleControlHtml(control, value) {
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
  const selectedPreset = selectedRegionMarkerStylePreset();
  container.querySelectorAll("[data-region-marker-style-level-option]").forEach((button) => {
    const isActive = normalizeRegionMarkerLevel(button.dataset.regionMarkerStyleLevelOption) === level;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  container.querySelectorAll("[data-region-marker-style-key]").forEach((input) => {
    const value = style[input.dataset.regionMarkerStyleKey];
    if (String(input.value) !== String(value)) input.value = value;
  });
  container.querySelectorAll("[data-region-marker-preset-id]").forEach((button) => {
    const isSelected = button.dataset.regionMarkerPresetId === selectedPreset?.id;
    button.closest(".region-marker-preset-chip")?.classList.toggle("active", isSelected);
  });
  container.querySelectorAll("[data-region-marker-style-action='applyPreset']").forEach((button) => {
    button.disabled = !selectedPreset;
  });
  syncMarkerRankDisplayOptionControls();
}

function activeRegionMarkerStyleEditorLevel() {
  return normalizeRegionMarkerLevel(state.activeRegionMarkerStyleLevel || "dong");
}

function selectedRegionMarkerStylePreset() {
  return (state.regionMarkerStylePresets || []).find((item) => item.id === state.selectedRegionMarkerStylePresetId) || null;
}
