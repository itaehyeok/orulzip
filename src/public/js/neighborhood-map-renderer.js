import { compareNeighborhood, relativeSignalPaint, relativeSignalLabel } from "./neighborhood-map-signal.js";

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const num = (v) => Number.isFinite(Number(v)) ? Number(v) : NaN;
const month = (v) => {
  const m = String(v ?? "").match(/^(\d{4})-?(\d{2})/);
  return m ? m[1] + m[2] : "";
};
export function createNeighborhoodRenderer({ container, project, metersToPixels, onSelect = () => {}, onHover = () => {}, onLeave = () => {} }) {
  if (!container || typeof project !== "function" || typeof metersToPixels !== "function") throw new TypeError("container, project, and metersToPixels are required");
  const doc = container.ownerDocument || document;
  const canvas = doc.createElement("canvas"), ctx = canvas.getContext("2d"), buttons = new Map();
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1";
  container.append(canvas);
  let state = { items: [], models: {}, monthIndex: 0, baseMonth: "", months: [], selectedId: null, enabled: false };
  let frame = 0, destroyed = false, size = [0, 0, 0];

  const getMonth = () => month(state.months[clamp(Math.trunc(num(state.monthIndex) || 0), 0, Math.max(0, state.months.length - 1))]) || month(state.baseMonth);
  const schedule = () => {
    if (!frame && !destroyed) frame = requestAnimationFrame(() => { frame = 0; render(); });
  };
  function points() {
    const monthKey = getMonth(), byId = new Map(state.items.map((x) => [String(x.apt_id), x]));
    return state.items.map((item) => {
      const p = project({ lat: Number(item.lat), lng: Number(item.lng) });
      const model = state.models?.[String(item.apt_id)];
      const leader = model ? byId.get(String(model.leader_id)) : null;
      const comparison = compareNeighborhood({ item, peer: leader, model, baseline: state.baseMonth, selected: monthKey });
      return {
        item, id: String(item.apt_id), x: num(p?.x), y: num(p?.y), leader,
        comparison, paint: relativeSignalPaint(comparison), candidate: comparison.triggered,
      };
    }).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  }
  function field(pts, w, h, dpr) {
    const observed = pts.filter((p) => p.paint.strength > 0);
    if (!observed.length) return;
    const sigma = num(metersToPixels(90, observed[0].item));
    if (!(sigma >= 3)) return;
    const cell = Math.max(8, Math.sqrt(w * h / 20000)), cols = Math.max(1, Math.ceil(w / cell)), rows = Math.max(1, Math.ceil(h / cell));
    const grid = doc.createElement("canvas"); grid.width = cols; grid.height = rows;
    const g = grid.getContext("2d"), image = g.createImageData(cols, rows), reach2 = 4 * sigma * sigma;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const px = (x + .5) * w / cols, py = (y + .5) * h / rows;
      let sum = 0; const rgbSum = [0, 0, 0];
      for (const p of observed) {
        const dx = px - p.x, dy = py - p.y, d2 = dx * dx + dy * dy;
        if (d2 > reach2) continue;
        const weight = Math.exp(-d2 / (2 * sigma * sigma)) * p.paint.strength;
        sum += weight; p.paint.rgb.forEach((value, index) => { rgbSum[index] += weight * value; });
      }
      if (sum < .045) continue;
      const rgb = rgbSum.map(value => Math.round(value / sum)), at = (y * cols + x) * 4;
      image.data[at] = rgb[0]; image.data[at + 1] = rgb[1]; image.data[at + 2] = rgb[2];
      image.data[at + 3] = Math.round(175 * clamp(sum, 0, 1));
    }
    g.putImageData(image, 0, 0); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(grid, 0, 0, cols, rows, 0, 0, w, h);
  }
  function setupButton(button, item) {
    button.type = "button"; button.className = "nn-map-marker";
    const mark = doc.createElement("span"), label = doc.createElement("span");
    mark.className = "nn-marker-mark";
    label.className = "nn-marker-name";
    button.append(mark, label);
    button.addEventListener("click", () => { const current = state.items.find((x) => String(x.apt_id) === button.dataset.apt); if (current) onSelect(current); });
    const hover = () => { const current = state.items.find((x) => String(x.apt_id) === button.dataset.apt); if (current) onHover(current, button); };
    button.addEventListener("pointerenter", hover); button.addEventListener("focus", hover);
    const leave = () => { const current = state.items.find((x) => String(x.apt_id) === button.dataset.apt); if (current) onLeave(current, button); };
    button.addEventListener("pointerleave", leave); button.addEventListener("blur", leave);
  }
  function render() {
    if (destroyed) return;
    const rect = container.getBoundingClientRect(), w = rect.width || container.clientWidth, h = rect.height || container.clientHeight;
    const dpr = clamp(num(window.devicePixelRatio) || 1, 1, 2);
    if (size[0] !== w || size[1] !== h || size[2] !== dpr) { canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr)); size = [w, h, dpr]; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const pts = points();
    if (state.enabled && Number(state.monthIndex) > 0 && w > 0 && h > 0 && num(metersToPixels(120, pts[0]?.item)) >= 10) {
      field(pts, w, h, dpr);
      const selected = pts.find((p) => p.id === String(state.selectedId)), leader = pts.find((p) => p.id === String(selected?.leader?.apt_id));
      if (selected && leader) { ctx.save(); ctx.beginPath(); ctx.moveTo(selected.x, selected.y); ctx.lineTo(leader.x, leader.y); ctx.setLineDash([4, 5]); ctx.strokeStyle = "rgba(54,111,126,.8)"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); }
    }
    const detailScale = pts.length ? num(metersToPixels(120, pts[0].item)) : 0;
    const active = new Set(), focusedId = doc.activeElement?.dataset?.apt;
    for (const p of pts) {
      active.add(p.id);
      let b = buttons.get(p.id);
      if (!b) { b = doc.createElement("button"); setupButton(b, p.item); buttons.set(p.id, b); }
      const selected = p.id === String(state.selectedId);
      b.dataset.apt = p.id; b.dataset.candidate = String(p.candidate); b.dataset.selected = String(selected);
      b.dataset.relativeStatus = p.comparison.status;
      if (p.comparison.available) b.dataset.relativeGap = String(p.comparison.adjustedGap); else delete b.dataset.relativeGap;
      b.setAttribute("aria-pressed", String(selected));
      b.setAttribute("aria-label", p.item.name + ", " + relativeSignalLabel(p.comparison) + (p.leader ? ", 비교 상대 " + p.leader.name : ""));
      b.style.left = p.x + "px"; b.style.top = p.y + "px"; b.hidden = !state.enabled || detailScale < 10 || p.x < -30 || p.y < -30 || p.x > w+30 || p.y > h+30;
      b.style.setProperty("--nn-color", "rgb(" + p.paint.rgb.join(" ") + ")");
      const mark = b.querySelector(".nn-marker-mark");
      mark.style.width = mark.style.height = selected ? "26px" : p.candidate ? "23px" : p.comparison.available ? "13px" : "10px";
      mark.style.borderStyle = p.comparison.available ? "solid" : "dashed";
      mark.style.borderWidth = selected || p.candidate ? "2.5px" : "1.5px";
      mark.style.borderColor = selected ? "#334e60" : p.candidate || !p.comparison.available ? "var(--nn-color)" : "white";
      mark.style.background = p.candidate || !p.comparison.available ? "white" : "var(--nn-color)";
      mark.style.boxShadow = selected ? "0 0 0 3px white, 0 1px 5px #0004" : "0 1px 4px #0003";
      b.querySelector(".nn-marker-name").textContent = String(p.item.short_name || p.item.name || "");
      b.querySelector(".nn-marker-name").hidden = Number(state.zoom) < 16 && !selected && !p.candidate;
      if (b.parentNode !== container) container.append(b);
    }
    for (const [id, b] of buttons) if (!active.has(id)) { b.remove(); buttons.delete(id); }
    if (focusedId && !buttons.has(focusedId)) container.focus?.({ preventScroll: true });
  }
  function update(next = {}) { state = { ...state, ...next }; if (!Array.isArray(state.items)) state.items = []; if (!Array.isArray(state.months)) state.months = []; if (!state.models || typeof state.models !== "object") state.models = {}; if (!state.items.length || !state.enabled) { if (frame) cancelAnimationFrame(frame); frame = 0; render(); } else schedule(); }
  function draw({ immediate = false } = {}) { if (immediate) { if (frame) cancelAnimationFrame(frame); frame = 0; render(); } else schedule(); }
  function destroy() { if (destroyed) return; destroyed = true; if (frame) cancelAnimationFrame(frame); frame = 0; for (const b of buttons.values()) b.remove(); buttons.clear(); canvas.remove(); }
  return { update, draw, destroy };
}
