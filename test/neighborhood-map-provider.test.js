import test from "node:test";
import assert from "node:assert/strict";
import { createNeighborhoodMapProvider } from "../src/public/js/neighborhood-map-provider.js";

test("missing Naver configuration reports the original map requirement without substituting another map", async () => {
  let initialized = 0;
  for (const maps of [{ disabled: true, naverKeyId: "public-id" }, {}]) {
    await assert.rejects(createNeighborhoodMapProvider({ config: { maps }, initializeNaver: () => { initialized++; } }), /기존 오를집의 네이버 지도 설정/);
  }
  assert.equal(initialized, 0);
});

test("a failed native initializer remains an explicit failure", async () => {
  await assert.rejects(createNeighborhoodMapProvider({ config: { maps: { naverKeyId: "public-id" } }, initializeNaver: async () => false }), /기존 네이버 지도를 시작하지 못했습니다/);
});

test("the adapter waits for native projection, coalesces view events and stops using a disconnected map", async t => {
  const original = { window: globalThis.window, raf: globalThis.requestAnimationFrame, cancel: globalThis.cancelAnimationFrame };
  const callbacks = new Map(), listeners = [], removed = [], positions = [];
  let sequence = 0, readyReads = 0, views = 0, failures = 0;
  class LatLng { constructor(lat, lng) { this.latitude = lat; this.longitude = lng; } lat() { return this.latitude; } lng() { return this.longitude; } }
  class LatLngBounds { constructor(a, b) { positions.push([a, b]); } extend(point) { positions.push(point); } }
  const map = {
    setOptions() {}, setCenter() {}, setZoom() {}, fitBounds() {}, getCenter() { return new LatLng(37.48, 127.13); }, getZoom() { return 16; },
    getProjection() { readyReads++; return readyReads < 3 ? undefined : { fromCoordToOffset(point) { return { x: point.lng() * 10, y: point.lat() * 10 }; } }; }
  };
  let currentMap = map, provider;
  globalThis.requestAnimationFrame = callback => { callbacks.set(++sequence, callback); return sequence; };
  globalThis.cancelAnimationFrame = id => callbacks.delete(id);
  globalThis.window = { naver: { maps: { LatLng, LatLngBounds, Position: { TOP_RIGHT: 3 }, Event: {
    addListener(target, name, callback) { const listener = { target, name, callback }; listeners.push(listener); return listener; },
    removeListener(listener) { removed.push(listener); }, trigger() {}
  } } } };
  t.after(() => { provider?.destroy(); globalThis.window = original.window; globalThis.requestAnimationFrame = original.raf; globalThis.cancelAnimationFrame = original.cancel; });
  provider = await createNeighborhoodMapProvider({ config: { maps: { naverKeyId: "public-id" } }, initializeNaver: async () => true, getNaverMap: () => currentMap, onView: () => views++, onFailure: () => failures++ });
  assert.ok(readyReads >= 3);
  assert.equal(provider.name, "naver"); assert.equal(provider.map, map);
  assert.deepEqual(provider.project({ lat: 37, lng: 127 }), { x: 1270, y: 370 });
  listeners.forEach(listener => listener.callback());
  assert.equal(callbacks.size, 1);
  for (const [id, callback] of [...callbacks]) { callbacks.delete(id); callback(); }
  assert.equal(views, 1);
  provider.fit([{ lat: 37, lng: 127 }, { lat: 38, lng: 128 }]);
  assert.equal(positions.length, 2);
  currentMap = null;
  assert.ok(Number.isNaN(provider.project({ lat: 37, lng: 127 }).x));
  assert.equal(failures, 1); assert.equal(removed.length, 4);
  provider.getView(); assert.equal(failures, 1);
});
