import { query } from "../db.js";

export async function readDataHealthStatus({ limit = 10 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50));
  try {
    const result = await query(`
      select id, environment, status, started_at, finished_at, issue_count, warning_count, summary, checks, created_at
      from data_health_runs
      order by created_at desc
      limit $1
    `, [safeLimit]);
    const runs = result.rows.map(serializeRun);
    return {
      latest: runs[0] || null,
      runs,
      schemaReady: true
    };
  } catch (error) {
    if (isMissingDataHealthTable(error)) {
      return {
        latest: null,
        runs: [],
        schemaReady: false,
        error: "data_health_runs_missing",
        message: "데이터 상태 테이블이 아직 준비되지 않았습니다."
      };
    }
    throw error;
  }
}

export async function saveDataHealthRun(run) {
  const result = await query(`
    insert into data_health_runs (
      environment, status, started_at, finished_at, issue_count, warning_count, summary, checks
    ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
    returning id, created_at
  `, [
    run.environment,
    run.status,
    run.startedAt,
    run.finishedAt,
    run.issueCount,
    run.warningCount,
    JSON.stringify(run.summary),
    JSON.stringify(run.checks)
  ]);
  return {
    id: Number(result.rows[0].id),
    createdAt: result.rows[0].created_at
  };
}

function serializeRun(row) {
  return {
    id: Number(row.id),
    environment: row.environment || "unknown",
    status: row.status || "unknown",
    startedAt: row.started_at || null,
    finishedAt: row.finished_at || null,
    issueCount: Number(row.issue_count || 0),
    warningCount: Number(row.warning_count || 0),
    summary: row.summary || {},
    checks: Array.isArray(row.checks) ? row.checks : [],
    createdAt: row.created_at || null
  };
}

function isMissingDataHealthTable(error) {
  return error?.code === "42P01" && /data_health_runs/.test(error?.message || "");
}
