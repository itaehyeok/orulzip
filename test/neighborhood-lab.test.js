import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildLabPayload, shiftMonth, fitRelationship } from "../src/services/neighborhood-lab-model.js";
import { createLabSession, isLabSessionValid, handleNeighborhoodLab } from "../src/routes/neighborhood-lab.js";

const snapshot = JSON.parse(await readFile(new URL("../src/fixtures/neighborhood-lab-snapshot.json", import.meta.url), "utf8"));
const clone = () => structuredClone(snapshot.apartments);
const secret = "test-review-secret-with-at-least-32-characters";
function mockResponse() {
  return { writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.body = body; } };
}
function mockRequest(cookie = "", method = "GET") { return { method, headers: { cookie }, socket: {} }; }

test("calendar arithmetic crosses years without approximating month lengths", () => {
  assert.equal(shiftMonth("202603", -6), "202509");
  assert.equal(shiftMonth("202609", -6), "202603");
  assert.equal(shiftMonth("202601", -1), "202512");
  assert.throws(() => shiftMonth("202613", -1));
});

test("validated fixture reproduces independently checked 36-month relationships", () => {
  const result = buildLabPayload(clone(), snapshot.asOf);
  const model = result.models["kb:15663"];
  assert.equal(model.leader_id, "kb:15699");
  assert.equal(model.training_start, "202304");
  assert.equal(model.training_end, "202603");
  assert.equal(model.training_n, 36);
  assert.equal(model.changed_target, 16);
  assert.equal(model.changed_peer, 12);
  assert.ok(Math.abs(model.corr - .6844763514323347) < 1e-10);
  assert.ok(Math.abs(model.beta - .7461668762864738) < 1e-10);
  assert.ok(Math.abs(result.models["kb:15449"].corr - .443591218491372) < 1e-10);
  assert.equal(result.timeline.start, "202603");
  assert.equal(result.timeline.months.length, 7);
  const target = result.current_peers.find(apartment => apartment.apt_id === "kb:15663");
  assert.ok(Math.abs(target.return_6m_pct - 2.8985507246376545) < 1e-10);
  assert.ok(!Object.hasOwn(result, "probability"));
});

test("leader and training do not change when post-baseline prices change", () => {
  const original = buildLabPayload(clone(), snapshot.asOf);
  const modified = clone();
  for (const apartment of modified) {
    for (const month of Object.keys(apartment.prices)) {
      if (month > "202603") apartment.prices[month] *= apartment.apt_id === "kb:15699" ? 2 : .5;
    }
  }
  assert.deepEqual(buildLabPayload(modified, snapshot.asOf).models, original.models);
});

test("missing prices remain null and insufficient/flat training has no model", () => {
  const apartments = clone();
  const target = apartments.find(apartment => apartment.apt_id === "kb:15663");
  const leader = apartments.find(apartment => apartment.apt_id === "kb:15699");
  delete target.prices["202605"];
  const result = buildLabPayload(apartments, snapshot.asOf);
  assert.equal(result.models[target.apt_id], undefined);
  const row = result.current_peers.find(apartment => apartment.apt_id === target.apt_id);
  assert.equal(row.monthly_prices.values[40], null);
  for (const month of Object.keys(leader.prices)) leader.prices[month] = 100000;
  assert.equal(fitRelationship(target, leader, "202603"), null);
});

test("signed review session rejects tampering, expiry and future-dated cookies", () => {
  const now = 1792848000000;
  const session = createLabSession(secret, now);
  assert.equal(isLabSessionValid(session, secret, now), true);
  assert.equal(isLabSessionValid(session, secret + "x", now), false);
  assert.equal(isLabSessionValid(session, secret, now + 86400000), false);
  assert.equal(isLabSessionValid(createLabSession(secret, now + 1000), secret, now), false);
});

test("page, API, static and encoded aliases fail closed outside development", async () => {
  let reads = 0;
  for (const path of ["/neighborhood-lab", "/neighborhood-lab.html", "/api/neighborhood-lab", "/map?lab=neighborhood", "/js/app-neighborhood-map.js", "/js/neighborhood-map-provider.js", "/js/neighborhood-map-renderer.js", "/js/neighborhood-map-evidence.js", "/css/neighborhood-map.css", "/js//neighborhood-map-provider.js", "/%6eeighborhood-lab.html"]) {
    const res = mockResponse();
    assert.equal(await handleNeighborhoodLab(mockRequest(), res, new URL("http://test"+path), { environment: "production", secret, readData: () => { reads++; } }), true);
    assert.equal(res.status, 404, path);
  }
  assert.equal(reads, 0);
});

test("private API requires a valid cookie and rejects query credential bypass", async () => {
  const unauthenticated = mockResponse();
  await handleNeighborhoodLab(mockRequest(), unauthenticated, new URL(`/api/neighborhood-lab?access=${secret}`, "http://test"), { environment: "development", secret });
  assert.equal(unauthenticated.status, 401);
  const authorised = mockResponse();
  await handleNeighborhoodLab(mockRequest(`orulzip_lab_review=${createLabSession(secret)}`), authorised, new URL("/api/neighborhood-lab?dataset=development", "http://test"), {
    environment: "development", secret, readData: async dataset => ({ dataset })
  });
  assert.equal(authorised.status, 200);
  assert.deepEqual(JSON.parse(authorised.body), { dataset: "development" });
});

test("bootstrap removes private credential from URL and issues an HttpOnly session", async () => {
  const res = mockResponse();
  await handleNeighborhoodLab(mockRequest(), res, new URL(`/neighborhood-lab?access=${secret}`, "http://test"), { environment: "development", secret });
  assert.equal(res.status, 302);
  assert.equal(res.headers.Location, "/map?lab=neighborhood");
  assert.ok(res.headers["Set-Cookie"].includes("HttpOnly; SameSite=Strict"));
  assert.equal(res.headers["Referrer-Policy"], "no-referrer");
  assert.ok(!res.headers["Set-Cookie"].includes(secret));
});
