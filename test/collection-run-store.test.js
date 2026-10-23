import test from "node:test";
import assert from "node:assert/strict";
import { boundedErrorMessage, finishCollectionRun, normalizeProvider, scheduledDateKst, startCollectionRun } from "../src/services/collection-run-store.js";
test("stale history is recovered only after advisory lock ownership", async () => {
  const calls = [];
  const client = { async query(sql, params = []) {
    calls.push({ sql, params });
    if (sql.includes("pg_try_advisory_lock")) return { rows: [{ locked: true }] };
    if (sql.includes("insert into collection_runs")) return { rows: [{ id: "42", started_at: "now" }] };
    return { rows: [] };
  } };
  const run = await startCollectionRun(client, "molit", "2026-10-23");
  assert.equal(run.id, "42");
  assert.match(calls[1].sql, /where provider = \$1\s+and status = 'running'/);
  assert.equal(calls[2].params[1], "2026-10-23");
});
test("a held lock skips without recovering or inserting", async () => {
  let count = 0;
  const client = { async query() { count++; return { rows: [{ locked: false }] }; } };
  assert.equal(await startCollectionRun(client, "kb", "2026-10-23"), null); assert.equal(count, 1);
});
test("failed exits are persisted with bounded redacted error text", async () => {
  let saved;
  const client = { async query(sql, params) { saved = { sql, params }; return { rows: [] }; } };
  await finishCollectionRun(client, 7, { status: "failed", summary: { exitCode: 75 }, errorMessage: "token=secret-value\nquota exhausted" });
  assert.equal(saved.params[1], "failed"); assert.deepEqual(JSON.parse(saved.params[2]), { exitCode: 75 });
  assert.doesNotMatch(saved.params[3], /secret-value/); assert.ok(saved.params[3].length <= 1000);
});
test("KST date and provider validation", () => {
  assert.equal(scheduledDateKst(new Date("2026-10-22T16:00:00Z")), "2026-10-23");
  assert.throws(() => normalizeProvider("other"), /molit or kb/); assert.ok(boundedErrorMessage("x".repeat(2000)).length <= 1000);
});
