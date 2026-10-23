import test from "node:test";
import assert from "node:assert/strict";
import { NATIONWIDE_LAWD_CODES } from "../scripts/molit-lawd-codes.js";
import {
  LEGACY_MOLIT_LAWD_CODES,
  buildMolitMonthCoverage,
  isMolitFetchComplete
} from "../scripts/molit-lawd-code-history.js";

const newIncheonCodes = ["28125", "28155", "28275", "28290"];
const changedCurrentCodes = NATIONWIDE_LAWD_CODES
  .filter(([code]) => code.startsWith("12") || newIncheonCodes.includes(code))
  .map(([code]) => code);
const legacySnapshot = [
  ...NATIONWIDE_LAWD_CODES.filter(([code]) => !changedCurrentCodes.includes(code)),
  ...LEGACY_MOLIT_LAWD_CODES
];
const rowsFor = (entries, yearMonth, completedAt) => entries.map(([lawdCd]) => ({
  lawd_cd: lawdCd,
  year_month: yearMonth,
  completed_at: completedAt
}));
const complete = (lawdCd, yearMonth, codes) => isMolitFetchComplete({
  lawdCd,
  yearMonth,
  completedKeys: new Set(codes.map((code) => `${code}:${yearMonth}`))
});

test("API request inventory remains current for historical collection", () => {
  assert.equal(NATIONWIDE_LAWD_CODES.length, 255);
  assert.equal(legacySnapshot.length, 254);
  assert.equal(LEGACY_MOLIT_LAWD_CODES.length, 30);
  const requestCodes = new Set(NATIONWIDE_LAWD_CODES.map(([code]) => code));
  assert.ok(changedCurrentCodes.every((code) => requestCodes.has(code)));
  assert.ok(LEGACY_MOLIT_LAWD_CODES.every(([code]) => !requestCodes.has(code)));
  assert.ok(!requestCodes.has("41590"));
  assert.equal(buildMolitMonthCoverage({
    months: ["201601"], completedRows: rowsFor(NATIONWIDE_LAWD_CODES, "201601")
  })[0].status, "pass");
});

test("verified legacy history covers current districts through June, never July onward", () => {
  const months = ["201601", "202606", "202607", "202609", "202610"];
  const coverage = buildMolitMonthCoverage({
    months, completedRows: months.flatMap((month) => rowsFor(legacySnapshot, month))
  });
  for (const row of coverage.slice(0, 2)) {
    assert.equal(row.status, "pass");
    assert.equal(row.expectedLawdCount, 255);
    assert.equal(row.completedLawdCount, 255);
  }
  for (const row of coverage.slice(2)) {
    assert.equal(row.status, "fail");
    assert.deepEqual(row.missingLawdCodes, changedCurrentCodes);
    assert.equal(row.missingLawdCount, 31);
  }
  assert.equal(complete("12110", "202606", ["46110"]), true);
  assert.equal(complete("12110", "202607", ["46110"]), false);
  assert.equal(complete("12110", "202607", ["12110"]), true);
});

test("historical Incheon aliases require complete boundary groups", () => {
  for (const current of ["28125", "28155"]) {
    assert.equal(complete(current, "202606", ["28110"]), false);
    assert.equal(complete(current, "202606", ["28140"]), false);
    assert.equal(complete(current, "202606", ["28110", "28140"]), true);
    assert.equal(complete(current, "202607", ["28110", "28140"]), false);
    assert.equal(complete(current, "202606", [current]), true);
  }
  for (const current of ["28275", "28290"]) {
    assert.equal(complete(current, "202606", ["28260"]), true);
    assert.equal(complete(current, "202607", ["28260"]), false);
  }
  // A partial old group plus the other new district is still incomplete.
  assert.equal(complete("28125", "202606", ["28110", "28155"]), false);
});

test("unrelated checkpoints and other months cannot hide missing districts", () => {
  const rows = rowsFor(legacySnapshot.filter(([code]) => code !== "28140" && code !== "46110"), "202606");
  rows.push({ lawd_cd: "99999", year_month: "202606" });
  rows.push({ lawd_cd: "46110", year_month: "202605" });
  const [coverage] = buildMolitMonthCoverage({ months: ["202606"], completedRows: rows });
  assert.deepEqual(coverage.missingLawdCodes, ["12110", "28125", "28155"]);
  assert.equal(coverage.missingLawdCount, 3);
  assert.equal(complete("12210", "202606", ["46110"]), false);
});

test("current checkpoints independently repair incomplete legacy coverage", () => {
  const rows = rowsFor(legacySnapshot.filter(([code]) => code !== "28140"), "202606");
  rows.push({ lawd_cd: "28155", year_month: "202606" });
  const [coverage] = buildMolitMonthCoverage({ months: ["202606"], completedRows: rows });
  assert.deepEqual(coverage.missingLawdCodes, ["28125"]);
});

test("freshness uses the latest checkpoint and all members of legacy groups", () => {
  const now = Date.parse("2026-10-23T12:00:00Z");
  const fresh = new Date(now - 2 * 60 * 60 * 1000);
  const stale = new Date(now - 37 * 60 * 60 * 1000);
  const rows = rowsFor(legacySnapshot, "202606", fresh);
  rows.find((row) => row.lawd_cd === "28140").completed_at = stale;
  rows.find((row) => row.lawd_cd === "46110").completed_at = stale;
  // A direct fresh current checkpoint takes precedence over its stale alias.
  rows.push({ lawd_cd: "12110", year_month: "202606", completed_at: fresh });
  // Duplicate targets cannot let an older completion replace a fresher one.
  rows.push({ lawd_cd: "11110", year_month: "202606", completed_at: stale });
  const [coverage] = buildMolitMonthCoverage({ months: ["202606"], completedRows: rows, maxAgeHours: 36, now });
  assert.deepEqual(coverage.missingLawdCodes, []);
  assert.deepEqual(coverage.staleLawdCodes, ["28125", "28155"]);
  assert.equal(coverage.completedLawdCount, 253);
});

test("freshness fails completed checkpoints without a valid timestamp", () => {
  const rows = rowsFor(NATIONWIDE_LAWD_CODES, "202610", "2026-10-23T12:00:00Z");
  rows.find((row) => row.lawd_cd === "12110").completed_at = "invalid";
  const [coverage] = buildMolitMonthCoverage({
    months: ["202610"], completedRows: rows, maxAgeHours: 36, now: Date.parse("2026-10-23T13:00:00Z")
  });
  assert.deepEqual(coverage.staleLawdCodes, ["12110"]);
  assert.equal(coverage.status, "fail");
});

test("invalid months cannot silently select historical aliases", () => {
  assert.throws(() => complete("12110", "202613", ["46110"]), /expected YYYYMM/);
  assert.throws(() => complete("12110", "2026-06", ["46110"]), /expected YYYYMM/);
});
