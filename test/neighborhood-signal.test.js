import test from "node:test";
import assert from "node:assert/strict";
import { readNeighborhoodLab } from "../src/services/neighborhood-lab.js";
import { compareNeighborhood, neighborhoodComparison, relativeSignalPaint } from "../src/public/js/neighborhood-map-signal.js";
import { renderNeighborhoodHover } from "../src/public/js/neighborhood-map-evidence.js";
import { handleNeighborhoodLab } from "../src/routes/neighborhood-lab.js";

const apt = (id, end) => ({ apt_id: id, monthly_prices: { start: 202601, values: [100, end] } });
const compare = (own, peer, beta = 1) => compareNeighborhood({ item: apt("own", own), peer: apt("peer", peer), model: { alpha: 0, beta }, baseline: "202601", selected: "202602" });

test("large equal rises have no relative signal and no colored field", () => {
  for (const end of [120, 150, 200]) {
    const c = compare(end, end);
    assert.equal(c.status, "similar");
    assert.equal(c.triggered, false);
    assert.ok(Math.abs(c.adjustedGap) < 1e-10);
    assert.equal(relativeSignalPaint(c).strength, 0);
  }
});

test("paint follows prior-relationship gaps rather than absolute growth", () => {
  const lagging = compare(105, 120), ahead = compare(140, 120), small = compare(119, 120);
  assert.equal(lagging.status, "lagging"); assert.equal(ahead.status, "ahead"); assert.equal(small.status, "similar");
  const purple = relativeSignalPaint(lagging), blue = relativeSignalPaint(ahead);
  assert.ok(purple.rgb[2] > purple.rgb[0] && purple.rgb[0] > purple.rgb[1]);
  assert.ok(blue.rgb[2] > blue.rgb[0]); assert.notDeepEqual(blue.rgb, purple.rgb);
  assert.ok(purple.strength > 0 && blue.strength > 0);
  assert.equal(relativeSignalPaint(small).strength, 0);
  const insufficientPeerRise = compare(100, 104);
  assert.equal(insufficientPeerRise.status, "reference-gap");
  assert.equal(relativeSignalPaint(insufficientPeerRise).strength, 0);
});

test("unknown and missing prices never become a zero gap or a potential signal", () => {
  const unknown = compareNeighborhood({ item: apt("own", 150), baseline: "202601", selected: "202602" });
  assert.equal(unknown.status, "unknown"); assert.ok(Number.isNaN(unknown.adjustedGap));
  assert.equal(relativeSignalPaint(unknown).strength, 0);
  const missing = compareNeighborhood({ item: apt("own", null), peer: apt("peer", 120), model: { alpha: 0, beta: 1 }, baseline: "202601", selected: "202602" });
  assert.equal(missing.available, false); assert.equal(missing.status, "unknown"); assert.equal(missing.triggered, false);
});

test("real fixtures preserve raw vs adjusted distinctions and honest regional coverage", async () => {
  const songpa = await readNeighborhoodLab("validated", "songpa");
  const items = [songpa.benchmark, ...songpa.current_peers];
  const compareAt = id => neighborhoodComparison({ data: songpa, item: items.find(item => item.apt_id === id), monthIndex: 6 });
  const three = compareAt("kb:15663"), two = compareAt("kb:15738");
  assert.equal(three.peer.apt_id, "kb:15699"); assert.equal(three.status, "lagging");
  assert.ok(Math.abs(three.adjustedGap - 12.20) < .01);
  assert.ok(two.rawGap >= 5 && two.adjustedGap < 0); assert.equal(two.triggered, false);
  const first = neighborhoodComparison({ data: songpa, item: items.find(item => item.apt_id === "kb:15663"), monthIndex: 0 });
  assert.equal(first.status, "baseline"); assert.equal(first.available, true); assert.equal(relativeSignalPaint(first).strength, 0);
  assert.equal(items.filter(item => neighborhoodComparison({ data: songpa, item, monthIndex: 6 }).triggered).length, 2);
  const dongtan = await readNeighborhoodLab("validated", "dongtan-station", "nearby");
  const dongtanItems = [dongtan.benchmark, ...dongtan.current_peers];
  const states = dongtanItems.map(item => ({ item, c: neighborhoodComparison({ data: dongtan, item, monthIndex: 6 }) }));
  assert.equal(states.filter(row => row.c.status === "ahead").length, 2);
  assert.equal(states.filter(row => row.c.status === "lagging").length, 0);
  assert.equal(states.filter(row => row.c.status === "unknown").length, 20);
  const mok = states.filter(row => row.item.comparison_area_id === "dongtan-mokdong");
  assert.equal(mok.length, 4); assert.ok(mok.every(row => row.c.status === "unknown"));
  const lyn = states.find(row => row.item.apt_id === "kb:30989");
  const hover = renderNeighborhoodHover({ data: dongtan, item: lyn.item, monthIndex: 6 });
  assert.ok(hover.includes("동탄역롯데캐슬")); assert.ok(hover.includes("-5.8%p"));
});

test("shared signal module remains private and fails closed in production", async () => {
  for (const [environment, status] of [["production", 404], ["development", 401]]) {
    const res = { writeHead(code) { this.status = code; }, end() {} };
    await handleNeighborhoodLab({ method: "GET", headers: {}, socket: {} }, res, new URL("http://test/js/neighborhood-map-signal.js"), { environment, secret: "private-secret-with-at-least-32-characters" });
    assert.equal(res.status, status);
  }
});
