import assert from "node:assert/strict";
import test from "node:test";
import { resolvePerformanceMinHouseholdCount } from "../src/services/performance-measurements.js";

test("measures the currently available public household filter", () => {
  assert.equal(resolvePerformanceMinHouseholdCount({
    availableMinHouseholdCounts: [0],
    defaultMinHouseholdCount: 0
  }, {}), 0);

  assert.equal(resolvePerformanceMinHouseholdCount({
    availableMinHouseholdCounts: [0, 100],
    defaultMinHouseholdCount: 100
  }, {}), 100);
});

test("accepts an available explicit measurement override", () => {
  const options = {
    availableMinHouseholdCounts: [0, 100],
    defaultMinHouseholdCount: 100
  };
  assert.equal(resolvePerformanceMinHouseholdCount(options, {
    PERFORMANCE_MEASUREMENT_MIN_HOUSEHOLD_COUNT: "0"
  }), 0);
  assert.equal(resolvePerformanceMinHouseholdCount(options, {
    PERFORMANCE_MEASUREMENT_MIN_HOUSEHOLD_COUNT: "500"
  }), 100);
});
