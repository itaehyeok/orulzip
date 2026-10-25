import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildLabPayload } from "../src/services/neighborhood-lab-model.js";
import { renderNeighborhoodEvidence, renderNeighborhoodHover } from "../src/public/js/neighborhood-map-evidence.js";
import { createLabSession, hasNeighborhoodLabAccess, handleNeighborhoodLab } from "../src/routes/neighborhood-lab.js";

const snapshot = JSON.parse(await readFile(new URL("../src/fixtures/neighborhood-lab-snapshot.json", import.meta.url), "utf8"));
const data = buildLabPayload(snapshot.apartments, snapshot.asOf, { dataset: "validated", source: "검증용 KB 발췌 자료" });
const item = data.current_peers.find(row => row.apt_id === "kb:15663");

test("native drawer shows raw observed gaps and the opposite prior-period evidence", () => {
  const html = renderNeighborhoodEvidence({ data, item, monthIndex: 6 });
  for (const value of ["475m", "84.93", "2008년", "0.68", "2023.04–2026.03", "36개월", "16/36", "12/36", "+12.7%p", "+12.2%p", "17.25억원", "19.25억원", "+36.4%", "+21.1%", "+40.3%", "+40.0%", "18개월", "반대 근거", "실거래 교차 확인 미완료", "시점별 당시 자료만으로"]) assert.ok(html.includes(value), value);
});

test("native hover uses the selected month and displays no future probability", () => {
  const html = renderNeighborhoodHover({ data, item, monthIndex: 6 });
  assert.ok(html.includes("2026.03 → 2026.09"));
  assert.ok(html.includes("+2.9%")); assert.ok(html.includes("+15.6%"));
  assert.ok(html.includes("송파파인타운5단지 대비")); assert.ok(html.includes("12.7%p 덜 상승"));
  assert.ok(html.includes("+12.2%p")); assert.ok(html.includes("미래 가격 예측이 아닙니다"));
});

test("shorter replay labels the actual 12+k month range", () => {
  const html = renderNeighborhoodEvidence({ data, item, monthIndex: 2 });
  assert.ok(html.includes("2026.03 → 2026.05"));
  assert.ok(html.includes("14개월")); assert.ok(!html.includes("18개월"));
});

test("source month offsets work when the complete series is shifted", () => {
  const shifted = structuredClone(data);
  for (const row of [shifted.benchmark, ...shifted.current_peers]) {
    row.monthly_prices.start = 202201;
    row.monthly_prices.values = [...Array(12).fill(null), ...row.monthly_prices.values];
  }
  assert.equal(renderNeighborhoodEvidence({ data: shifted, item: shifted.current_peers.find(row => row.apt_id === item.apt_id), monthIndex: 6 }), renderNeighborhoodEvidence({ data, item, monthIndex: 6 }));
});

test("unselected relationship and missing prices are explicit, and names are escaped", () => {
  const unknown = { ...structuredClone(item), name: '<img src=x onerror="x()">', apt_id: "unknown" };
  unknown.monthly_prices.values = unknown.monthly_prices.values.map(() => null);
  const html = renderNeighborhoodEvidence({ data, item: unknown, monthIndex: 6 });
  assert.ok(html.includes("&lt;img")); assert.ok(!html.includes("<img"));
  assert.ok(html.includes("선정된 비교 관계가 없어")); assert.ok(html.includes("자료 없음")); assert.ok(!html.includes("NaN"));
});

test("new native map authorization requires both development and a signed private session", async () => {
  const secret = "native-test-secret-with-at-least-32-characters";
  const req = { method: "GET", headers: { cookie: "orulzip_lab_review=" + createLabSession(secret) }, socket: {} };
  assert.equal(hasNeighborhoodLabAccess(req, { environment: "development", secret }), true);
  assert.equal(hasNeighborhoodLabAccess(req, { environment: "production", secret }), false);
  assert.equal(hasNeighborhoodLabAccess({ headers: {} }, { environment: "development", secret }), false);
  const res = { headers: {}, setHeader(name, value) { this.headers[name] = value; } };
  assert.equal(await handleNeighborhoodLab(req, res, new URL("http://test/map?lab=neighborhood"), { environment: "development", secret }), false);
  assert.equal(res.headers["X-Robots-Tag"], "noindex, nofollow");
  assert.equal(res.headers["Referrer-Policy"], "origin");
});
