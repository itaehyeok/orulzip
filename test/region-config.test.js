import assert from "node:assert/strict";
import test from "node:test";
import { NATIONWIDE_LAWD_CODES } from "../scripts/molit-lawd-codes.js";
import {
  getRegion,
  legalDongCodeMatchesRegion,
  legalDongCodePrefixes,
  listTiles,
  MAX_KB_MAP_TILE_SIZE
} from "../src/services/region-config.js";

const gwangju = getRegion("gwangju");
const jeonnam = getRegion("jeonnam");

test("separates current Gwangju districts from current Jeonnam cities and counties", () => {
  assert.equal(legalDongCodeMatchesRegion(gwangju, "1224012000"), true);
  assert.equal(legalDongCodeMatchesRegion(jeonnam, "1224012000"), false);
  assert.equal(legalDongCodeMatchesRegion(gwangju, "1276025021"), false);
  assert.equal(legalDongCodeMatchesRegion(jeonnam, "1276025021"), true);
});

test("continues to recognize legacy Gwangju and Jeonnam codes", () => {
  assert.equal(legalDongCodeMatchesRegion(gwangju, "2914010100"), true);
  assert.equal(legalDongCodeMatchesRegion(jeonnam, "4679025021"), true);
});

test("partitions every current integrated-city LAWD code into one logical region", () => {
  const currentCodes = NATIONWIDE_LAWD_CODES.filter(([code]) => code.startsWith("12"));
  const gwangjuCodes = currentCodes.filter(([code]) => legalDongCodeMatchesRegion(gwangju, code));
  const jeonnamCodes = currentCodes.filter(([code]) => legalDongCodeMatchesRegion(jeonnam, code));

  assert.equal(currentCodes.length, 27);
  assert.equal(gwangjuCodes.length, 5);
  assert.equal(jeonnamCodes.length, 22);
  assert.deepEqual(
    new Set([...gwangjuCodes, ...jeonnamCodes].map(([code]) => code)),
    new Set(currentCodes.map(([code]) => code))
  );
  assert.deepEqual(
    legalDongCodePrefixes(gwangju).filter((prefix) => prefix.startsWith("12")),
    ["12210", "12240", "12270", "12300", "12330"]
  );
});

test("uses the current Incheon district codes", () => {
  const incheonCodes = new Set(
    NATIONWIDE_LAWD_CODES.filter(([code]) => code.startsWith("28")).map(([code]) => code)
  );

  for (const code of ["28125", "28155", "28275", "28290"]) {
    assert.equal(incheonCodes.has(code), true);
  }
  for (const code of ["28110", "28140", "28260"]) {
    assert.equal(incheonCodes.has(code), false);
  }
});

test("caps large regional tiles below the KB empty-response threshold", () => {
  const jeju = getRegion("jeju");
  const tiles = listTiles(jeju);

  assert.equal(tiles.length, 540);
  assert.equal(Math.min(...tiles.map((tile) => tile.startLat)), jeju.bbox.startLat);
  assert.equal(Math.max(...tiles.map((tile) => tile.endLat)), jeju.bbox.endLat);
  assert.equal(Math.min(...tiles.map((tile) => tile.startLng)), jeju.bbox.startLng);
  assert.equal(Math.max(...tiles.map((tile) => tile.endLng)), jeju.bbox.endLng);
  assert.ok(tiles.every((tile) => tile.endLat - tile.startLat <= MAX_KB_MAP_TILE_SIZE + 1e-7));
  assert.ok(tiles.every((tile) => tile.endLng - tile.startLng <= MAX_KB_MAP_TILE_SIZE + 1e-7));
  assert.ok(tiles.every((tile) => tile.endLat - tile.startLat < 0.03));
  assert.ok(tiles.every((tile) => tile.endLng - tile.startLng < 0.03));
});
