import { closeDb, withClient } from "./db.js";
const LOCK_IDS = Object.freeze({ molit: 731042011, kb: 731042012 });
const MAX_ERROR_LENGTH = 1000;
export function normalizeProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  if (!Object.hasOwn(LOCK_IDS, provider)) throw new Error("Provider must be either molit or kb.");
  return provider;
}
export function scheduledDateKst(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}
export function boundedErrorMessage(value) {
  const message = String(value || "Collection process failed.")
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-url]")
    .replace(/(token|secret|password|service[_-]?key)\s*[=:]\s*[^\s,;]+/gi, "$1=[redacted]")
    .replace(/[\r\n\t]+/g, " ").trim();
  return (message || "Collection process failed.").slice(0, MAX_ERROR_LENGTH);
}
export async function startCollectionRun(client, provider, scheduledDate) {
  const normalized = normalizeProvider(provider);
  const lockId = LOCK_IDS[normalized];
  const lock = await client.query("select pg_try_advisory_lock($1) as locked", [lockId]);
  if (!lock.rows[0]?.locked) return null;
  try {
    await client.query(`update collection_runs set status = 'failed', finished_at = now(),
      error_message = 'Previous run ended before completion; recovered after provider lock acquisition.',
      summary = coalesce(summary, '{}'::jsonb) || '{"recoveredAfterCrash":true}'::jsonb
      where provider = $1 and status = 'running'`, [normalized]);
    const inserted = await client.query(`insert into collection_runs (provider, scheduled_date, status, summary)
      values ($1, $2::date, 'running', '{}'::jsonb) returning id, started_at`, [normalized, scheduledDate]);
    return { id: inserted.rows[0].id, startedAt: inserted.rows[0].started_at, lockId };
  } catch (error) {
    await client.query("select pg_advisory_unlock($1)", [lockId]);
    throw error;
  }
}
export async function finishCollectionRun(client, id, { status, summary = {}, errorMessage = null }) {
  if (!["succeeded", "failed"].includes(status)) throw new Error("Final status must be succeeded or failed.");
  await client.query(`update collection_runs set status = $2, finished_at = now(),
    summary = $3::jsonb, error_message = $4 where id = $1`,
  [id, status, JSON.stringify(summary), errorMessage ? boundedErrorMessage(errorMessage) : null]);
}
export async function withCollectionRun(provider, execute, { scheduledDate = scheduledDateKst() } = {}) {
  const normalized = normalizeProvider(provider);
  try {
    return await withClient(async (client) => {
      const run = await startCollectionRun(client, normalized, scheduledDate);
      if (!run) return { skipped: true, reason: "provider_locked" };
      try {
        const result = await execute();
        await finishCollectionRun(client, run.id, { status: "succeeded", summary: result?.summary || {} });
        return { skipped: false, runId: run.id, ...result };
      } catch (error) {
        await finishCollectionRun(client, run.id, { status: "failed", summary: error?.summary || {}, errorMessage: error?.message || error });
        throw error;
      } finally {
        await client.query("select pg_advisory_unlock($1)", [run.lockId]);
      }
    });
  } finally { await closeDb(); }
}
