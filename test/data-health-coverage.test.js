import test from "node:test";
import assert from "node:assert/strict";
import { buildMonthCodeCoverage, monthSequence } from "../src/services/data-health/coverage.js";
import { parseRepairMonthArgument, planRepairCachePeriods } from "../scripts/molit-repair-options.js";

test("historical coverage requires each expected lawd code in every month", () => {
  const details = buildMonthCodeCoverage({
    months: ["202606", "202607"],
    lawdCodes: ["11110", "11140", "11200"],
    completedRows: [
      { year_month: "202606", lawd_cd: "11110" },
      { year_month: "202606", lawd_cd: "11140" },
      { year_month: "202606", lawd_cd: "11200" },
      { year_month: "202607", lawd_cd: "11110" },
      { year_month: "202607", lawd_cd: "11140" },
      // An extra legacy code must not compensate for the missing expected code.
      { year_month: "202607", lawd_cd: "99999" }
    ]
  });

  assert.deepEqual(details.map(({ status, missingLawdCodes }) => ({ status, missingLawdCodes })), [
    { status: "pass", missingLawdCodes: [] },
    { status: "fail", missingLawdCodes: ["11200"] }
  ]);
});

test("recent coverage marks an old completed code stale instead of letting it pass", () => {
  const now = Date.parse("2026-10-23T12:00:00Z");
  const details = buildMonthCodeCoverage({
    months: ["202610"],
    lawdCodes: ["11110", "11140"],
    completedRows: [
      { year_month: "202610", lawd_cd: "11110", completed_at: new Date(now - 37 * 60 * 60 * 1000) },
      { year_month: "202610", lawd_cd: "11140", completed_at: new Date(now - 2 * 60 * 60 * 1000) }
    ],
    maxAgeHours: 36,
    now
  });

  assert.equal(details[0].status, "fail");
  assert.equal(details[0].missingLawdCount, 1);
  assert.deepEqual(details[0].staleLawdCodes, ["11110"]);
});

test("month sequence includes both endpoints and crosses years", () => {
  assert.deepEqual(monthSequence("202611", "202702"), ["202611", "202612", "202701", "202702"]);
});

test("repair month argument validates YYYYMM", () => {
  assert.equal(parseRepairMonthArgument(["--repair-month", "202607"]), "202607");
  assert.equal(parseRepairMonthArgument([]), null);
  assert.throws(() => parseRepairMonthArgument(["--repair-month", "202613"]), /valid YYYYMM/);
  assert.throws(() => parseRepairMonthArgument(["--repair-month"]), /requires a valid YYYYMM/);
});

test("repair selects only cache periods whose starts match the repaired month", () => {
  const plan = planRepairCachePeriods({
    repairMonth: "202607",
    endMonth: "202610",
    mapPeriodYears: [0.25, 0.5, 1, 2],
    pricePeriodMonths: [3, 6, 12, 36]
  });
  assert.deepEqual(plan, { monthDelta: 3, mapPeriodYears: [0.25], pricePeriodMonths: [3] });
});

test("repair falls back to complete cache refreshes when no required period starts there", () => {
  const plan = planRepairCachePeriods({
    repairMonth: "202608",
    endMonth: "202610",
    mapPeriodYears: [0.25, 0.5, 1, 2],
    pricePeriodMonths: [3, 6, 12, 36]
  });
  assert.deepEqual(plan, { monthDelta: 2, mapPeriodYears: null, pricePeriodMonths: null });
});
