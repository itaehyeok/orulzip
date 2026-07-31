import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMolitMapOptions,
  resolveAvailableMinHouseholdCount
} from "../src/services/molit-map-options.js";

test("uses the latest non-empty all-household cache period", () => {
  const result = buildMolitMapOptions([
    row("202506", "202606", 0, 16000),
    row("202507", "202607", 0, 17000),
    row("202604", "202607", 0, 12000),
    row("202507", "202607", 100, 0),
    row("202604", "202607", 100, 0)
  ]);

  assert.equal(result.months[0], "202507");
  assert.equal(result.months.at(-1), "202607");
  assert.deepEqual(result.availableMinHouseholdCounts, [0]);
  assert.equal(result.defaultMinHouseholdCount, 0);
  assert.equal(result.periods.length, 2);
});

test("keeps 100 households as the default only when every current period has data", () => {
  const result = buildMolitMapOptions([
    row("202507", "202607", 0, 17000),
    row("202604", "202607", 0, 12000),
    row("202507", "202607", 100, 9000),
    row("202604", "202607", 100, 7000)
  ], {
    priceBandRows: [
      priceBandRow("202507", "202607", 0, 17000),
      priceBandRow("202604", "202607", 0, 12000),
      priceBandRow("202507", "202607", 100, 9000),
      priceBandRow("202604", "202607", 100, 7000)
    ]
  });

  assert.deepEqual(result.availableMinHouseholdCounts, [0, 100]);
  assert.equal(result.defaultMinHouseholdCount, 100);
});

test("requires ranking cache coverage before restoring the 100 household default", () => {
  const result = buildMolitMapOptions([
    row("202507", "202607", 0, 17000),
    row("202507", "202607", 100, 9000)
  ], {
    priceBandRows: [
      priceBandRow("202507", "202607", 0, 17000),
      priceBandRow("202507", "202607", 100, 0)
    ]
  });

  assert.deepEqual(result.availableMinHouseholdCounts, [0]);
  assert.equal(result.defaultMinHouseholdCount, 0);
});

test("disables unavailable filters when there is no usable map snapshot", () => {
  const result = buildMolitMapOptions([
    row("202507", "202607", 0, 0),
    row("202507", "202607", 100, 0)
  ]);

  assert.deepEqual(result.months, []);
  assert.deepEqual(result.availableMinHouseholdCounts, []);
  assert.equal(result.defaultMinHouseholdCount, 0);
});

test("resolves explicit filters only when their cache is available", () => {
  const options = {
    availableMinHouseholdCounts: [0, 100],
    defaultMinHouseholdCount: 100
  };
  assert.equal(resolveAvailableMinHouseholdCount(options), 100);
  assert.equal(resolveAvailableMinHouseholdCount(options, "0"), 0);
  assert.equal(resolveAvailableMinHouseholdCount(options, "500"), 100);
});

function row(startMonth, endMonth, minHouseholdCount, apartmentCount) {
  return {
    start_month: startMonth,
    end_month: endMonth,
    min_household_count: minHouseholdCount,
    apartment_count: apartmentCount,
    updated_at: "2026-07-31T00:00:00.000Z"
  };
}

function priceBandRow(startMonth, endMonth, minHouseholdCount, itemCount) {
  return {
    start_month: startMonth,
    end_month: endMonth,
    min_household_count: minHouseholdCount,
    item_count: itemCount,
    updated_at: "2026-07-31T00:00:00.000Z"
  };
}
