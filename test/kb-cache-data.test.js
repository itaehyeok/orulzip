import assert from "node:assert/strict";
import test from "node:test";

import { resolveKbCachePeriod } from "../src/services/kb-cache-data.js";

test("resolves KB cache periods against available months", () => {
  const months = ["202401", "202402", "202404", "202405"];

  assert.deepEqual(resolveKbCachePeriod(months, "202403", "202405"), {
    startMonth: "202404",
    endMonth: "202405"
  });
  assert.deepEqual(resolveKbCachePeriod(months, "202301", "202403"), {
    startMonth: "202401",
    endMonth: "202402"
  });
});

test("returns an empty KB cache period when no months exist", () => {
  assert.deepEqual(resolveKbCachePeriod([], "202401", "202405"), {
    startMonth: null,
    endMonth: null
  });
});
