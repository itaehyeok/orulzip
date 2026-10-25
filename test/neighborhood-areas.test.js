import test from "node:test";
import assert from "node:assert/strict";
import { readNeighborhoodLab, combineNeighborhoodPayloads } from "../src/services/neighborhood-lab.js";
import { getNeighborhoodArea } from "../src/services/neighborhood-lab-areas.js";
import { buildLabPayload, distanceMeters } from "../src/services/neighborhood-lab-model.js";
import { handleNeighborhoodLab, createLabSession } from "../src/routes/neighborhood-lab.js";
import { renderNeighborhoodEvidence } from "../src/public/js/neighborhood-map-evidence.js";

const secret = "regional-review-test-secret-at-least-32-characters";
const response = () => ({ writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.body = body; } });
const request = () => ({ method: "GET", headers: { cookie: "orulzip_lab_review=" + createLabSession(secret) }, socket: {} });

test("region and dataset are bounded before any database query or file lookup", async () => {
  for (const id of ["../package.json", "mokdong", "seoul-mokdong", "", "dongtan-station/../../"]) {
    assert.throws(() => getNeighborhoodArea(id), { statusCode: 400 });
    await assert.rejects(readNeighborhoodLab("validated", id), { statusCode: 400 });
  }
  await assert.rejects(readNeighborhoodLab("unknown", "songpa"), { statusCode: 400 });
});

test("all three validated regions remain isolated when read concurrently and from cache", async () => {
  const ids = ["songpa", "dongtan-station", "dongtan-mokdong"];
  const results = await Promise.all(ids.map(id => readNeighborhoodLab("validated", id)));
  assert.deepEqual(results.map(data => data.area.id), ids);
  const pools = results.map(data => [data.benchmark, ...data.current_peers]);
  for (let i = 0; i < ids.length; i++) {
    const data = results[i], items = pools[i];
    assert.equal(data.asOf, "202609");
    assert.equal(data.area.pool_count, items.length);
    assert.equal(new Set(items.map(item => item.apt_id)).size, items.length);
    assert.equal(data.areas.length, 3);
    assert.equal(data.snapshot.developmentDatabaseRefreshed, false);
    assert.equal((await readNeighborhoodLab("validated", ids[i])).area.id, ids[i]);
    for (const [targetId, model] of Object.entries(data.models)) {
      const target = items.find(item => item.apt_id === targetId), peer = items.find(item => item.apt_id === model.leader_id);
      assert.ok(target && peer);
      assert.equal(target.legal_dong_code, peer.legal_dong_code);
      assert.ok(distanceMeters(target, peer) <= 500);
      assert.ok(model.historical_premium >= 1.05 && model.historical_premium <= 1.8);
      assert.ok(model.training_n >= 30 && model.corr >= .4);
      assert.ok(model.training_end <= data.timeline.start);
    }
    if (i > 0) {
      assert.ok(items.every(item => item.lat > 37.17 && item.lat < 37.23 && item.lng > 127.07 && item.lng < 127.15));
      assert.ok(!items.some(item => item.apt_id === "kb:15699"));
      assert.ok(!data.filters.legal_dong_codes.includes("1171010900"));
      assert.ok(!renderNeighborhoodEvidence({ data, item: items[0], monthIndex: 6 }).includes("이번 지도에 표시한 9개 단지"));
    }
  }
  const stationIds = new Set(pools[1].map(item => item.apt_id));
  assert.ok(pools[2].every(item => !stationIds.has(item.apt_id)));
  assert.equal(results[0].models["kb:15663"].leader_id, "kb:15699");
});

test("an apartment with no monthly observations has nulls and no fitted relationship", () => {
  const apt = { apt_id: "empty", name: "관측 없음", area_m2: 84, lat: 37.2, lng: 127.1, prices: {}, legal_dong_code: "test", households: 100, built_year: 2020 };
  const data = buildLabPayload([apt], "202609", { area: { id: "test", reference_id: "empty" } });
  assert.equal(data.benchmark.return_6m_pct, null);
  assert.ok(data.benchmark.monthly_prices.values.every(value => value === null));
  assert.deepEqual(data.models, {});
});

test("panning across Dongtan keeps both pools while comparison models and focus stay regional", async () => {
  const [station, mokdong] = await Promise.all([readNeighborhoodLab("validated", "dongtan-station"), readNeighborhoodLab("validated", "dongtan-mokdong")]);
  for (const focus of [station, mokdong]) {
    const data = await readNeighborhoodLab("validated", focus.area.id, "nearby");
    const items = [data.benchmark, ...data.current_peers];
    assert.equal(data.area.id, focus.area.id);
    assert.equal(items.length, 22);
    assert.equal(data.asOf, "202609");
    assert.equal(data.focus_ids.length, focus.area.pool_count);
    assert.deepEqual(data.models, { ...station.models, ...mokdong.models });
    assert.equal(items.filter(item => item.comparison_area_id === "dongtan-mokdong").length, 4);
    const han = items.find(item => item.apt_id === "kb:34348");
    const html = renderNeighborhoodEvidence({ data, item: han, monthIndex: 6 });
    assert.ok(html.includes("동탄 목동 4개 단지"));
    assert.ok(!html.includes("지역 자료 중 4개 단지는"), "station history gaps must not be attributed to Mokdong");
    assert.ok(data.focus_ids.includes(data.benchmark.apt_id));
  }
  assert.equal((await readNeighborhoodLab("validated", "dongtan-station")).area.pool_count, 18, "nearby cache must not replace selected scope");
  assert.equal((await readNeighborhoodLab("validated", "songpa", "nearby")).area.pool_count, 9);
  assert.throws(() => combineNeighborhoodPayloads([station, { ...mokdong, asOf: "202608" }], "dongtan-station"));
  await assert.rejects(readNeighborhoodLab("validated", "songpa", "nationwide"), { statusCode: 400 });
});

test("private entry preserves only the requested supported area and data source", async () => {
  const res = response();
  await handleNeighborhoodLab(request(), res, new URL("http://test/neighborhood-lab?access=" + secret + "&area=dongtan-station&dataset=development&view=reference"), { environment: "development", secret });
  assert.equal(res.status, 302);
  assert.equal(res.headers.Location, "/map?lab=neighborhood&area=dongtan-station&dataset=development");
  assert.ok(!res.headers.Location.includes(secret));
  const bad = response();
  await handleNeighborhoodLab(request(), bad, new URL("http://test/neighborhood-lab?access=" + secret + "&area=../package.json"), { environment: "development", secret });
  assert.equal(bad.status, 400);
  assert.equal(bad.headers["Set-Cookie"], undefined);
});

test("private API forwards both area and source without broadening the scope", async () => {
  const res = response();
  await handleNeighborhoodLab(request(), res, new URL("http://test/api/neighborhood-lab?area=dongtan-mokdong&dataset=development"), {
    environment: "development", secret, readData: async (dataset, area) => ({ dataset, area })
  });
  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(res.body), { dataset: "development", area: "dongtan-mokdong" });
});
