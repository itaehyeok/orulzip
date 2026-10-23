import test from "node:test";
import assert from "node:assert/strict";
import { buildMonthCodeCoverage, monthSequence } from "../src/services/data-health/coverage.js";

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

test("month sequence includes both endpoints and crosses years", () => {
  assert.deepEqual(monthSequence("202611", "202702"), ["202611", "202612", "202701", "202702"]);
});
