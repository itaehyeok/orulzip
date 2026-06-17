const apartmentMarkerDesignStorageKey = "orulzip.apartmentMarkerDesignId";
const apartmentMarkerDisplayStorageKey = "orulzip.apartmentMarkerDisplay.v2";
const apartmentMarkerStyleStorageKey = "orulzip.apartmentMarkerStyle.v2";
const apartmentMarkerStylePresetStorageKey = "orulzip.apartmentMarkerStylePresets.v2";

const apartmentMarkerDesignOptions = [
  { id: "white", name: "화이트 데이터칩", className: "rank-chip-white" },
  { id: "stack", name: "데이터칩 스택", className: "rank-chip-stack" },
  { id: "table", name: "미니 테이블", className: "rank-chip-table" },
  { id: "dark", name: "다크 데이터칩", className: "rank-chip-dark" }
];
const apartmentMarkerDesignOptionMap = new Map(apartmentMarkerDesignOptions.map((item) => [item.id, item]));
const defaultApartmentMarkerDesignId = "white";

const apartmentMarkerDisplayOptions = [
  { key: "name", label: "아파트명" },
  { key: "area", label: "면적/평형" },
  { key: "rate", label: "상승률" },
  { key: "dong", label: "동 순위" },
  { key: "sigungu", label: "시군구 순위" },
  { key: "sido", label: "시도 순위" },
  { key: "national", label: "전국 순위" },
  { key: "nationalPercent", label: "전국 퍼센트" }
];
const defaultApartmentMarkerDisplay = {
  name: false,
  area: false,
  rate: true,
  dong: true,
  sigungu: false,
  sido: false,
  national: false,
  nationalPercent: true
};
const apartmentMarkerRankKeys = ["dong", "sigungu", "sido", "national", "nationalPercent"];

const apartmentMarkerStyleControls = [
  { key: "outerBoxWidth", label: "외부 박스 너비", group: "박스", min: 92, max: 240, step: 1 },
  { key: "rankBoxWidth", label: "순위 박스 너비", group: "박스", min: 70, max: 224, step: 1 },
  { key: "nameFontSize", label: "아파트명 글자", group: "글자", min: 8, max: 18, step: 1 },
  { key: "areaFontSize", label: "면적/평형 글자", group: "글자", min: 7, max: 17, step: 1 },
  { key: "valueFontSize", label: "상승률 글자", group: "글자", min: 14, max: 38, step: 1 },
  { key: "dongFontSize", label: "동 글자", group: "글자", min: 7, max: 17, step: 1 },
  { key: "sigunguFontSize", label: "시군구 글자", group: "글자", min: 7, max: 17, step: 1 },
  { key: "sidoFontSize", label: "시도 글자", group: "글자", min: 7, max: 17, step: 1 },
  { key: "nationalFontSize", label: "전국 글자", group: "글자", min: 7, max: 17, step: 1 },
  { key: "nationalPercentFontSize", label: "전국 퍼센트 글자", group: "글자", min: 7, max: 17, step: 1 },
  { key: "rankValueFontSize", label: "등수 글자", group: "글자", min: 8, max: 18, step: 1 },
  { key: "nameAreaGap", label: "아파트명-면적 간격", group: "행간", min: 0, max: 14, step: 1 },
  { key: "areaRateGap", label: "면적-상승률 간격", group: "행간", min: 0, max: 16, step: 1 },
  { key: "valueRankGap", label: "상승률-순위박스 간격", group: "행간", min: 0, max: 18, step: 1 },
  { key: "rankRowGap", label: "순위 행간", group: "행간", min: 0, max: 12, step: 1 },
  { key: "rankRowHeight", label: "순위 행 높이", group: "행간", min: 14, max: 32, step: 1 },
  { key: "borderEnabled", label: "테두리", group: "도형", type: "boolean" },
  { key: "shadowEnabled", label: "그림자", group: "도형", type: "boolean" },
  { key: "tailOffset", label: "삼각형 세로 위치", group: "도형", min: -12, max: 12, step: 1 }
];
const apartmentMarkerStyleControlMap = new Map(apartmentMarkerStyleControls.map((item) => [item.key, item]));
const apartmentMarkerDesignDefaultWidths = {
  white: 138,
  stack: 130,
  table: 148,
  dark: 138
};

function readStoredApartmentMarkerDesignId() {
  try {
    const stored = window.localStorage.getItem(apartmentMarkerDesignStorageKey);
    return apartmentMarkerDesignOptionMap.has(stored) ? stored : defaultApartmentMarkerDesignId;
  } catch {
    return defaultApartmentMarkerDesignId;
  }
}

function readStoredApartmentMarkerDisplay() {
  const result = { ...defaultApartmentMarkerDisplay };
  try {
    const stored = JSON.parse(window.localStorage.getItem(apartmentMarkerDisplayStorageKey) || "{}");
    for (const option of apartmentMarkerDisplayOptions) {
      if (typeof stored?.[option.key] === "boolean") result[option.key] = stored[option.key];
    }
  } catch {
    // Ignore malformed localStorage and use defaults.
  }
  return result;
}

function readStoredApartmentMarkerStyle() {
  try {
    const stored = sanitizeApartmentMarkerStyle(JSON.parse(window.localStorage.getItem(apartmentMarkerStyleStorageKey) || "{}"));
    if (stored) return stored;
  } catch {
    // Ignore malformed localStorage and use defaults.
  }
  return {};
}

function readStoredApartmentMarkerStylePresets() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(apartmentMarkerStylePresetStorageKey) || "[]");
    if (!Array.isArray(stored)) return [];
    return stored
      .map((preset) => {
        const style = sanitizeApartmentMarkerStyle(preset?.style);
        if (!style) return null;
        return {
          id: String(preset.id || `apartment-preset-${Date.now()}`),
          name: String(preset.name || "프리셋"),
          style
        };
      })
      .filter(Boolean)
      .slice(0, 24);
  } catch {
    return [];
  }
}

function activeApartmentMarkerDesign() {
  const id = state.apartmentMarkerDesignId || defaultApartmentMarkerDesignId;
  return apartmentMarkerDesignOptionMap.get(id) || apartmentMarkerDesignOptionMap.get(defaultApartmentMarkerDesignId);
}

function activeApartmentMarkerDisplay() {
  return {
    ...defaultApartmentMarkerDisplay,
    ...(state.apartmentMarkerDisplay || {})
  };
}

function activeApartmentMarkerRankKeys() {
  const display = activeApartmentMarkerDisplay();
  return apartmentMarkerRankKeys.filter((key) => display[key]);
}

function activeApartmentMarkerStyle(design = activeApartmentMarkerDesign()) {
  return {
    ...defaultApartmentMarkerStyle(design),
    ...(state.apartmentMarkerStyle || {})
  };
}

function defaultApartmentMarkerStyle(design = activeApartmentMarkerDesign()) {
  const designId = design?.id || defaultApartmentMarkerDesignId;
  const outerBoxWidth = apartmentMarkerDesignDefaultWidths[designId] || apartmentMarkerDesignDefaultWidths.white;
  return {
    outerBoxWidth,
    rankBoxWidth: Math.max(72, outerBoxWidth - 22),
    nameFontSize: 10,
    areaFontSize: 9,
    valueFontSize: 24,
    dongFontSize: 9,
    sigunguFontSize: 9,
    sidoFontSize: 9,
    nationalFontSize: 9,
    nationalPercentFontSize: 9,
    rankValueFontSize: 10,
    nameAreaGap: 3,
    areaRateGap: 4,
    valueRankGap: 5,
    rankRowGap: designId === "table" ? 0 : 4,
    rankRowHeight: 18,
    borderEnabled: false,
    shadowEnabled: false,
    tailOffset: 0
  };
}

function sanitizeApartmentMarkerStyle(style) {
  if (!style || typeof style !== "object") return null;
  const result = {};
  for (const control of apartmentMarkerStyleControls) {
    const value = normalizeApartmentMarkerStyleValue(control.key, style[control.key]);
    if (value !== null) result[control.key] = value;
  }
  return Object.keys(result).length ? result : null;
}

function normalizeApartmentMarkerStyleValue(key, value) {
  const control = apartmentMarkerStyleControlMap.get(key);
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

function setActiveApartmentMarkerDesign(designId) {
  if (!apartmentMarkerDesignOptionMap.has(designId)) return;
  state.apartmentMarkerDesignId = designId;
  writeApartmentMarkerDesignState();
  syncApartmentMarkerDesignControls();
  rerenderApartmentMarkers();
}

function setApartmentMarkerDisplayVisible(key, visible) {
  if (!apartmentMarkerDisplayOptions.some((item) => item.key === key)) return;
  state.apartmentMarkerDisplay = {
    ...activeApartmentMarkerDisplay(),
    [key]: Boolean(visible)
  };
  writeApartmentMarkerDisplayState();
  syncApartmentMarkerDesignControls();
  rerenderApartmentMarkers();
}

function setApartmentMarkerStyleValue(key, value) {
  const normalizedValue = normalizeApartmentMarkerStyleValue(key, value);
  if (normalizedValue === null) return;
  state.apartmentMarkerStyle = {
    ...activeApartmentMarkerStyle(),
    [key]: normalizedValue
  };
  writeApartmentMarkerStyleState();
  syncApartmentMarkerStyleEditor();
  syncApartmentMarkerDesignControls();
  rerenderApartmentMarkers();
}

function resetApartmentMarkerStyle() {
  state.apartmentMarkerStyle = {};
  writeApartmentMarkerStyleState();
  syncApartmentMarkerStyleEditor();
  syncApartmentMarkerDesignControls();
  rerenderApartmentMarkers();
}

function saveApartmentMarkerStylePreset() {
  const input = document.querySelector("[data-apartment-marker-preset-name]");
  const name = input?.value.trim() || `아파트 프리셋 ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
  const preset = {
    id: `apartment-preset-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    style: activeApartmentMarkerStyle()
  };
  state.apartmentMarkerStylePresets = [preset, ...(state.apartmentMarkerStylePresets || [])].slice(0, 24);
  state.selectedApartmentMarkerStylePresetId = preset.id;
  if (input) input.value = "";
  writeApartmentMarkerStylePresetState();
  renderApartmentMarkerStyleEditor();
}

function selectApartmentMarkerStylePreset(presetId) {
  const preset = (state.apartmentMarkerStylePresets || []).find((item) => item.id === presetId);
  if (!preset) return;
  state.selectedApartmentMarkerStylePresetId = preset.id;
  applyApartmentMarkerStylePreset(preset.id);
}

function applySelectedApartmentMarkerStylePreset() {
  applyApartmentMarkerStylePreset(state.selectedApartmentMarkerStylePresetId);
}

function applyApartmentMarkerStylePreset(presetId) {
  const preset = (state.apartmentMarkerStylePresets || []).find((item) => item.id === presetId);
  if (!preset) return;
  state.selectedApartmentMarkerStylePresetId = preset.id;
  state.apartmentMarkerStyle = { ...activeApartmentMarkerStyle(), ...preset.style };
  writeApartmentMarkerStyleState();
  syncApartmentMarkerStyleEditor();
  syncApartmentMarkerDesignControls();
  rerenderApartmentMarkers();
}

function deleteApartmentMarkerStylePreset(presetId) {
  state.apartmentMarkerStylePresets = (state.apartmentMarkerStylePresets || []).filter((item) => item.id !== presetId);
  if (state.selectedApartmentMarkerStylePresetId === presetId) {
    state.selectedApartmentMarkerStylePresetId = "";
  }
  writeApartmentMarkerStylePresetState();
  renderApartmentMarkerStyleEditor();
}

function writeApartmentMarkerDesignState() {
  try {
    window.localStorage.setItem(apartmentMarkerDesignStorageKey, state.apartmentMarkerDesignId || defaultApartmentMarkerDesignId);
  } catch {
    // localStorage may be disabled in private contexts.
  }
}

function writeApartmentMarkerDisplayState() {
  try {
    window.localStorage.setItem(apartmentMarkerDisplayStorageKey, JSON.stringify(state.apartmentMarkerDisplay || defaultApartmentMarkerDisplay));
  } catch {
    // localStorage may be disabled in private contexts.
  }
}

function writeApartmentMarkerStyleState() {
  try {
    window.localStorage.setItem(apartmentMarkerStyleStorageKey, JSON.stringify(state.apartmentMarkerStyle || {}));
  } catch {
    // localStorage may be disabled in private contexts.
  }
}

function writeApartmentMarkerStylePresetState() {
  try {
    window.localStorage.setItem(apartmentMarkerStylePresetStorageKey, JSON.stringify(state.apartmentMarkerStylePresets || []));
  } catch {
    // localStorage may be disabled in private contexts.
  }
}

function apartmentMarkerStyleCssVars(design = activeApartmentMarkerDesign()) {
  const style = activeApartmentMarkerStyle(design);
  return {
    "--apartment-marker-outer-width": `${style.outerBoxWidth}px`,
    "--apartment-marker-rank-box-width": `${style.rankBoxWidth}px`,
    "--apartment-marker-name-font-size": `${style.nameFontSize}px`,
    "--apartment-marker-area-font-size": `${style.areaFontSize}px`,
    "--apartment-marker-value-font-size": `${style.valueFontSize}px`,
    "--apartment-marker-rank-dong-font-size": `${style.dongFontSize}px`,
    "--apartment-marker-rank-sigungu-font-size": `${style.sigunguFontSize}px`,
    "--apartment-marker-rank-sido-font-size": `${style.sidoFontSize}px`,
    "--apartment-marker-rank-national-font-size": `${style.nationalFontSize}px`,
    "--apartment-marker-rank-national-percent-font-size": `${style.nationalPercentFontSize}px`,
    "--apartment-marker-rank-value-font-size": `${style.rankValueFontSize}px`,
    "--apartment-marker-name-area-gap": `${style.nameAreaGap}px`,
    "--apartment-marker-area-rate-gap": `${style.areaRateGap}px`,
    "--apartment-marker-value-rank-gap": `${style.valueRankGap}px`,
    "--apartment-marker-rank-row-gap": `${style.rankRowGap}px`,
    "--apartment-marker-rank-row-height": `${style.rankRowHeight}px`,
    "--apartment-marker-tail-offset": `${style.tailOffset}px`
  };
}

function apartmentMarkerStyleInline(design = activeApartmentMarkerDesign()) {
  return Object.entries(apartmentMarkerStyleCssVars(design))
    .map(([property, value]) => `${property}: ${value}`)
    .join("; ");
}

function applyApartmentMarkerStyleToElement(element, design = activeApartmentMarkerDesign()) {
  if (!element) return;
  const style = activeApartmentMarkerStyle(design);
  const vars = apartmentMarkerStyleCssVars(design);
  for (const [property, value] of Object.entries(vars)) {
    element.style.setProperty(property, value);
  }
  element.dataset.apartmentMarkerBorder = style.borderEnabled ? "on" : "off";
  element.dataset.apartmentMarkerShadow = style.shadowEnabled ? "on" : "off";
}

function bindApartmentMarkerDesignControls() {
  document.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-apartment-marker-style-action]");
    if (actionButton) {
      const action = actionButton.dataset.apartmentMarkerStyleAction;
      if (action === "reset") resetApartmentMarkerStyle();
      if (action === "savePreset") saveApartmentMarkerStylePreset();
      if (action === "applyPreset") applySelectedApartmentMarkerStylePreset();
      return;
    }
    const presetDeleteButton = event.target.closest("[data-apartment-marker-preset-delete]");
    if (presetDeleteButton) {
      deleteApartmentMarkerStylePreset(presetDeleteButton.dataset.apartmentMarkerPresetDelete);
      return;
    }
    const presetButton = event.target.closest("[data-apartment-marker-preset-id]");
    if (presetButton) {
      selectApartmentMarkerStylePreset(presetButton.dataset.apartmentMarkerPresetId);
      return;
    }
    const card = event.target.closest("[data-apartment-marker-design-id]");
    if (!card) return;
    setActiveApartmentMarkerDesign(card.dataset.apartmentMarkerDesignId);
  });
  document.addEventListener("keydown", (event) => {
    const card = event.target.closest("[data-apartment-marker-design-id]");
    if (!card || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    setActiveApartmentMarkerDesign(card.dataset.apartmentMarkerDesignId);
  });
  document.addEventListener("change", (event) => {
    const input = event.target.closest("[data-apartment-marker-display-key]");
    if (!input) return;
    setApartmentMarkerDisplayVisible(input.dataset.apartmentMarkerDisplayKey, input.checked);
  });
  document.addEventListener("input", (event) => {
    const input = event.target.closest("[data-apartment-marker-style-key]");
    if (!input) return;
    const value = input.type === "checkbox" ? input.checked : input.value;
    setApartmentMarkerStyleValue(input.dataset.apartmentMarkerStyleKey, value);
  });
}

function syncApartmentMarkerDesignControls() {
  const activeDesign = activeApartmentMarkerDesign();
  const display = activeApartmentMarkerDisplay();
  document.querySelectorAll("[data-apartment-marker-design-id]").forEach((card) => {
    const isActive = card.dataset.apartmentMarkerDesignId === activeDesign.id;
    card.classList.toggle("active", isActive);
    card.setAttribute("aria-pressed", String(isActive));
  });
  document.querySelectorAll("[data-apartment-marker-display-key]").forEach((input) => {
    const key = input.dataset.apartmentMarkerDisplayKey;
    input.checked = Boolean(display[key]);
  });
  document.querySelectorAll("[data-apartment-marker-design-id]").forEach((card) => {
    const design = apartmentMarkerDesignOptionMap.get(card.dataset.apartmentMarkerDesignId) || activeDesign;
    card.querySelectorAll(".apartment-rank-demo").forEach((marker) => {
      applyApartmentMarkerStyleToElement(marker, design);
    });
  });
  syncApartmentMarkerStyleEditor();
}

function rerenderApartmentMarkers() {
  if (state.latestZoomMapData) {
    renderZoomMapSummary(state.latestZoomMapData);
    return;
  }
  if (typeof isMapTab === "function" && isMapTab() && typeof scheduleZoomMapLoad === "function") {
    scheduleZoomMapLoad();
  }
}

function renderApartmentMarkerStyleEditor() {
  const container = document.getElementById("apartmentMarkerStyleEditor");
  if (!container) return;
  const style = activeApartmentMarkerStyle();
  const groupedControls = groupApartmentMarkerStyleControls();
  const presets = state.apartmentMarkerStylePresets || [];
  container.innerHTML = `
    <div class="panel-head">
      <h2>아파트 마커 세부 편집</h2>
      <span>아파트 마커 전용 프리셋</span>
    </div>
    <div class="region-marker-editor-body">
      <div class="region-marker-editor-toolbar">
        <div class="region-marker-common-badge">아파트 전용 편집</div>
        <div class="region-marker-editor-actions">
          <button type="button" data-apartment-marker-style-action="reset">전체 리셋</button>
          <input type="text" maxlength="20" placeholder="프리셋 이름" data-apartment-marker-preset-name>
          <button type="button" data-apartment-marker-style-action="savePreset">저장</button>
          <button type="button" data-apartment-marker-style-action="applyPreset" ${selectedApartmentMarkerStylePreset() ? "" : "disabled"}>선택 프리셋 적용</button>
        </div>
      </div>
      <div class="region-marker-style-groups">
        ${Object.entries(groupedControls).map(([group, controls]) => `
          <fieldset class="region-marker-style-group">
            <legend>${escapeHtml(group)}</legend>
            <div class="region-marker-style-fields">
              ${controls.map((control) => apartmentMarkerStyleControlHtml(control, style[control.key])).join("")}
            </div>
          </fieldset>
        `).join("")}
      </div>
      <div class="region-marker-preset-list">
        ${presets.length ? presets.map((preset) => `
          <span class="region-marker-preset-chip ${state.selectedApartmentMarkerStylePresetId === preset.id ? "active" : ""}">
            <button type="button" data-apartment-marker-preset-id="${escapeHtml(preset.id)}">
              ${escapeHtml(preset.name)}
              <small>아파트</small>
            </button>
            <button type="button" aria-label="${escapeHtml(preset.name)} 삭제" data-apartment-marker-preset-delete="${escapeHtml(preset.id)}">x</button>
          </span>
        `).join("") : `<span class="region-marker-preset-empty">저장된 프리셋 없음</span>`}
      </div>
    </div>
  `;
}

function groupApartmentMarkerStyleControls() {
  return apartmentMarkerStyleControls.reduce((groups, control) => {
    if (!groups[control.group]) groups[control.group] = [];
    groups[control.group].push(control);
    return groups;
  }, {});
}

function apartmentMarkerStyleControlHtml(control, value) {
  if (control.type === "boolean") {
    return `
      <label class="apartment-marker-style-field-toggle">
        <input type="checkbox" ${value ? "checked" : ""} data-apartment-marker-style-key="${escapeHtml(control.key)}">
        <span>${escapeHtml(control.label)}</span>
      </label>
    `;
  }
  return `
    <label class="region-marker-style-field">
      <span>${escapeHtml(control.label)}</span>
      <input type="range" min="${control.min}" max="${control.max}" step="${control.step}" value="${value}" data-apartment-marker-style-key="${escapeHtml(control.key)}">
      <input type="number" min="${control.min}" max="${control.max}" step="${control.step}" value="${value}" data-apartment-marker-style-key="${escapeHtml(control.key)}">
    </label>
  `;
}

function syncApartmentMarkerStyleEditor() {
  const container = document.getElementById("apartmentMarkerStyleEditor");
  if (!container) return;
  const style = activeApartmentMarkerStyle();
  const selectedPreset = selectedApartmentMarkerStylePreset();
  container.querySelectorAll("[data-apartment-marker-style-key]").forEach((input) => {
    const value = style[input.dataset.apartmentMarkerStyleKey];
    if (input.type === "checkbox") {
      input.checked = Boolean(value);
    } else if (String(input.value) !== String(value)) {
      input.value = value;
    }
  });
  container.querySelectorAll("[data-apartment-marker-preset-id]").forEach((button) => {
    const isSelected = button.dataset.apartmentMarkerPresetId === selectedPreset?.id;
    button.closest(".region-marker-preset-chip")?.classList.toggle("active", isSelected);
  });
  container.querySelectorAll("[data-apartment-marker-style-action='applyPreset']").forEach((button) => {
    button.disabled = !selectedPreset;
  });
}

function selectedApartmentMarkerStylePreset() {
  return (state.apartmentMarkerStylePresets || []).find((item) => item.id === state.selectedApartmentMarkerStylePresetId) || null;
}
