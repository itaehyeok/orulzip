import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const coreSource = readFileSync(new URL("../src/public/js/app-core.js", import.meta.url), "utf8");
const startupSource = readFileSync(new URL("../src/public/js/app-startup.js", import.meta.url), "utf8");
const mapSource = readFileSync(new URL("../src/public/js/app-map.js", import.meta.url), "utf8");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function createClient({ mapTab = true, config, filters, admin, mapInit } = {}) {
  const state = { activeTab: mapTab ? "molitMap" : "neighborhood", mapStartupPending: false };
  const calls = { mapInit: 0, activeViews: 0, adminRendered: 0 };
  const timers = [];
  const context = vm.createContext({
    state,
    window: { naver: null },
    document: { querySelector: () => null },
    console,
    Date,
    Promise,
    URLSearchParams,
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    clearTimeout: () => {},
    setInterval: () => 1,
    requestAnimationFrame: (callback) => callback(),
    fetch: async () => ({ ok: true, json: async () => ({}) })
  });
  vm.runInContext(`${coreSource}\n${startupSource}\n${mapSource}`, context);
  Object.assign(context, {
    isMapTab: () => state.activeTab === "map" || state.activeTab === "molitMap",
    loadClientConfig: config || (() => Promise.resolve()),
    loadFilters: filters || (() => Promise.resolve()),
    loadAdminSession: admin || (() => Promise.resolve()),
    renderAdminNavigation: () => { calls.adminRendered += 1; },
    initZoomMap: async () => { calls.mapInit += 1; return mapInit ? mapInit() : true; },
    loadActiveViewData: async () => { calls.activeViews += 1; },
    refreshStatusOnly: async () => {},
    refresh: async () => {},
    readStoredGraphDesignId: () => "",
    readStoredPyeongGraphDesignId: () => "",
    readStoredMarkerDesignId: () => "",
    readStoredMarkerVerbosityByLevel: () => ({}),
    readStoredMarkerRankDisplayOptions: () => ({}),
    readStoredApartmentMarkerDesignId: () => "",
    readStoredApartmentMarkerDisplay: () => ({}),
    readStoredApartmentMarkerStyle: () => "",
    readStoredApartmentMarkerStylePresets: () => ({}),
    readStoredApartmentMarkerMode: () => "",
    readStoredRegionMarkerDesignByLevel: () => ({}),
    readStoredRegionMarkerDisplayByLevel: () => ({}),
    readStoredRegionMarkerStyleByLevel: () => ({}),
    readStoredRegionMarkerStylePresets: () => ({}),
    readStoredLogoDesignId: () => "",
    readStoredMapHeaderDesignId: () => "",
    readStoredGrowthRateColorDesignId: () => "",
    readStoredGrowthRateBandMode: () => "",
    readStoredMapGrowthMetric: () => "",
    readStoredMarkerLineGapPx: () => 0,
    readStoredTransitionDesignId: () => "",
    applyMarkerLineGap: () => {},
    applyMapHeaderDesign: () => {},
    applyGrowthRateColorDesign: () => {},
    syncGrowthRateBandModeControls: () => {},
    syncMapGrowthMetricControls: () => {},
    syncMobileViewportInsets: () => {},
    tabFromLocation: () => mapTab ? "molitMap" : "neighborhood",
    setActiveTab: (tab) => { state.activeTab = tab; },
    renderApartmentMarkerStyleEditor: () => {},
    renderRegionMarkerStyleEditor: () => {},
    bindEvents: () => {},
    syncApartmentMarkerDesignControls: () => {},
    syncRegionMarkerDesignControls: () => {},
    syncHouseholdFilterToggles: () => {}
  });
  return { state, calls, timers, context };
}

test("map initializes after config while slow filters and admin remain pending; completion still waits for filters", async () => {
  const config = deferred();
  const filters = deferred();
  const admin = deferred();
  const c = createClient({ config: () => config.promise, filters: () => filters.promise, admin: () => admin.promise });

  const startup = c.context.loadStartupResources();
  assert.equal(c.state.mapStartupPending, true);
  config.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(c.calls.mapInit, 1);
  assert.equal(c.state.mapStartupPending, true);
  let finished = false;
  startup.then(() => { finished = true; });
  await Promise.resolve();
  assert.equal(finished, false);

  filters.resolve();
  const result = await startup;
  assert.equal(result.mapInitialized, true);
  assert.equal(c.state.mapStartupPending, false);
  assert.equal(finished, true);
  admin.resolve();
  await Promise.resolve();
  assert.equal(c.calls.adminRendered, 1);
});

test("non-map startup waits for admin and never initializes the map", async () => {
  const admin = deferred();
  const c = createClient({ mapTab: false, admin: () => admin.promise });
  let finished = false;
  const startup = c.context.loadStartupResources().then(() => { finished = true; });
  await Promise.resolve();
  assert.equal(finished, false);
  assert.equal(c.calls.mapInit, 0);
  admin.resolve();
  await startup;
  assert.equal(c.calls.adminRendered, 1);
  assert.equal(c.calls.mapInit, 0);
});

test("map init failure prevents duplicate map data loading during init", async () => {
  const c = createClient({ mapInit: () => false });
  await c.context.init();
  assert.equal(c.calls.mapInit, 1);
  assert.equal(c.calls.activeViews, 0);
});

test("filter rejection leaves map startup guarded", async () => {
  const c = createClient({ filters: () => Promise.reject(new Error("filters unavailable")) });
  await assert.rejects(c.context.loadStartupResources(), /filters unavailable/);
  assert.equal(c.state.mapStartupPending, true);
});

test("navigation away before config resolves skips map initialization", async () => {
  const config = deferred();
  const c = createClient({ config: () => config.promise });
  const startup = c.context.loadStartupResources();
  c.state.activeTab = "neighborhood";
  config.resolve();
  await startup;
  assert.equal(c.calls.mapInit, 0);
});

test("map scheduling and summary guards suppress requests during startup", async () => {
  const c = createClient();
  c.state.mapStartupPending = true;
  c.context.scheduleZoomMapLoad();
  await c.context.loadZoomMapSummary();
  assert.equal(c.timers.length, 0);
});
