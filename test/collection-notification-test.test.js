import test from "node:test";
import assert from "node:assert/strict";
import { notificationTestPlan } from "../scripts/verify-collection-notification.js";
test("notification test always forces one current KST district without heavy caches", () => {
  const plan = notificationTestPlan("telegram-20261024", new Date("2026-10-31T16:00:00Z"));
  assert.equal(plan.month,"202611");
  assert.equal(plan.args[plan.args.indexOf("--limit")+1],"1");
  assert.equal(plan.args[plan.args.indexOf("--start")+1],"202611");
  assert.equal(plan.args[plan.args.indexOf("--end")+1],"202611");
  assert.ok(plan.args.includes("--force"));
  assert.ok(plan.args.includes("--skip-map-cache-refresh"));
});
test("notification test refuses missing, oversized or unsafe identities", () => {
  for (const id of [undefined,"","x".repeat(65),"../path","x;echo unsafe","x y"]) assert.throws(() => notificationTestPlan(id));
});
