const regionMarkerDesignStorageKey = "orulzip.regionMarkerDesignByLevel";
const regionMarkerDisplayStorageKey = "orulzip.regionMarkerDisplayByLevel";
const regionMarkerTemplateStorageKey = "orulzip.regionMarkerTemplateByLevel.v1";
const regionMarkerStyleStorageKey = "orulzip.regionMarkerStyleByLevel";
const regionMarkerStylePresetStorageKey = "orulzip.regionMarkerStylePresets";
const regionMarkerConfig = window.orulzipRegionMarkerConfig || {};
const regionMarkerLevels = regionMarkerConfig.levels || ["dong", "sigungu", "sido"];
const regionMarkerLevelLabels = regionMarkerConfig.levelLabels || { all: "공통", dong: "동", sigungu: "시군구", sido: "시도" };
const regionMarkerRankLevelsByLevel = regionMarkerConfig.rankLevelsByLevel || {};
const defaultRegionMarkerDesignByLevel = regionMarkerConfig.defaultDesignByLevel || {};
const defaultRegionMarkerDisplayByLevel = regionMarkerConfig.defaultDisplayByLevel || {};
const defaultRegionMarkerTemplateByLevel = regionMarkerConfig.defaultTemplateByLevel || {};
const regionMarkerTemplateTokensByLevel = regionMarkerConfig.templateTokensByLevel || {};
const regionMarkerDesignOptions = regionMarkerConfig.designOptions || [];
const regionMarkerDesignOptionMap = new Map(regionMarkerDesignOptions.map((item) => [item.id, item]));
const regionMarkerStyleControls = regionMarkerConfig.styleControls || [];
const regionMarkerStyleControlMap = new Map(regionMarkerStyleControls.map((item) => [item.key, item]));
const regionMarkerDesignDefaultWidths = regionMarkerConfig.defaultWidthsByDesign || {};

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
  const defaultStyle = regionMarkerConfig.defaultStyle || {};
  return {
    outerBoxWidth,
    rankBoxWidth: Math.max(70, outerBoxWidth - 16),
    labelFontSize: defaultStyle.labelFontSize ?? 10,
    valueFontSize: defaultStyle.valueFontSize ?? 25,
    sigunguFontSize: defaultStyle.sigunguFontSize ?? 9,
    sidoFontSize: defaultStyle.sidoFontSize ?? 9,
    nationalFontSize: defaultStyle.nationalFontSize ?? 9,
    rankValueFontSize: defaultStyle.rankValueFontSize ?? 10,
    labelRateGap: defaultStyle.labelRateGap ?? 5,
    valueRankGap: defaultStyle.valueRankGap ?? 5,
    rankRowGap: designId === "table" ? (defaultStyle.tableRankRowGap ?? 0) : (defaultStyle.rankRowGap ?? 4),
    rankRowHeight: defaultStyle.rankRowHeight ?? 18
  };
}

function defaultRegionMarkerOuterWidth(level, designId) {
  if (regionMarkerConfig.defaultOuterWidthByLevel?.[level]) {
    return regionMarkerConfig.defaultOuterWidthByLevel[level];
  }
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
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, 80);
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
      setRegionMarkerStyleValue(activeRegionMarkerStyleEditorLevel(), styleInput.dataset.regionMarkerStyleKey, styleInput.value);
      return;
    }
    const templateInput = event.target.closest("[data-region-marker-template-field]");
    if (templateInput) {
      setRegionMarkerTemplateValue(
        activeRegionMarkerStyleEditorLevel(),
        templateInput.dataset.regionMarkerTemplateField,
        templateInput.dataset.regionMarkerTemplateRank || "",
        templateInput.value
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
  const activeInput = document.activeElement?.matches?.("[data-region-marker-template-field]")
    ? document.activeElement
    : container.querySelector("[data-region-marker-template-field='label']");
  if (!activeInput) return;
  const insertText = `{{${token}}}`;
  const start = Number.isFinite(activeInput.selectionStart) ? activeInput.selectionStart : activeInput.value.length;
  const end = Number.isFinite(activeInput.selectionEnd) ? activeInput.selectionEnd : activeInput.value.length;
  activeInput.value = `${activeInput.value.slice(0, start)}${insertText}${activeInput.value.slice(end)}`;
  activeInput.focus();
  activeInput.setSelectionRange(start + insertText.length, start + insertText.length);
  activeInput.dispatchEvent(new Event("input", { bubbles: true }));
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
      <input type="text" value="${escapeHtml(value)}" data-region-marker-template-field="${escapeHtml(field)}" data-region-marker-template-rank="${escapeHtml(rankLevel)}" spellcheck="false">
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
  const design = activeRegionMarkerDesign(sample.level);
  const isActive = sample.level === activeLevel;
  return `
    <span class="region-marker-preview-marker level-${escapeHtml(sample.level)} ${isActive ? "active" : ""}" style="left:${sample.x}%;top:${sample.y}%;">
      ${zoomGroupMarkerContentHtml(sample.item, sample.level, design)}
    </span>
  `;
}

function regionMarkerTemplatePreviewSamples() {
  return regionMarkerConfig.previewSamples || [];
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
  const template = activeRegionMarkerTemplate(level);
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
  container.querySelectorAll("[data-region-marker-template-field]").forEach((input) => {
    const field = input.dataset.regionMarkerTemplateField;
    const rankLevel = input.dataset.regionMarkerTemplateRank || "";
    const value = field === "rankRow" ? template.rankRows[rankLevel] : template[field];
    if (String(input.value) !== String(value || "")) input.value = value || "";
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
