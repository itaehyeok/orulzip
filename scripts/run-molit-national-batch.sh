#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ORULZIP_DATA_COLLECTOR_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
COMPOSE_FILE="${MOLIT_NATIONAL_BATCH_COMPOSE_FILE:-docker-compose.data-collector.yml}"
SERVICE="${MOLIT_NATIONAL_BATCH_SERVICE:-molit-daily-collector}"
TARGETS="${MOLIT_NATIONAL_BATCH_TARGETS:-all-sido}"
RECENT_TARGETS="${MOLIT_NATIONAL_BATCH_RECENT_TARGETS:-all-sido}"
LIMIT="${MOLIT_NATIONAL_BATCH_LIMIT:-20000}"
DELAY_MS="${MOLIT_NATIONAL_BATCH_DELAY_MS:-500}"
GEOCODE_LIMIT="${MOLIT_NATIONAL_BATCH_GEOCODE_LIMIT:-5000}"
REFRESH_PRICE_BAND_CACHE="${MOLIT_NATIONAL_BATCH_REFRESH_PRICE_BAND_CACHE:-1}"
LOG_DIR="${MOLIT_NATIONAL_BATCH_LOG_DIR:-$ROOT_DIR/logs}"
LOCK_FILE="${MOLIT_NATIONAL_BATCH_LOCK_FILE:-$LOG_DIR/molit-national-batch.lock}"
CRON_MARKER="${MOLIT_NATIONAL_BATCH_CRON_MARKER:-# orulzip molit-national-batch}"

mkdir -p "$LOG_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[$(date -Is)] MOLIT national batch is already running; exiting."
  exit 0
fi

cd "$ROOT_DIR"

log() {
  echo "[$(date -Is)] $*"
}

current_month() {
  TZ=Asia/Seoul date +%Y%m
}

previous_month() {
  TZ=Asia/Seoul date -d "$(TZ=Asia/Seoul date +%Y-%m-01) -1 month" +%Y%m
}

remaining_tasks() {
  docker compose -f "$COMPOSE_FILE" run --rm "$SERVICE" \
    node scripts/sync-molit-trades.js \
      --targets "$TARGETS" \
      --limit "$LIMIT" \
      --delay-ms "$DELAY_MS" \
      --plan \
    | node -e '
        const fs = require("node:fs");
        const input = fs.readFileSync(0, "utf8");
        const start = input.indexOf("{");
        if (start < 0) process.exit(2);
        const data = JSON.parse(input.slice(start));
        console.log(Number(data.remainingTasks || 0));
      '
}

run_collection() {
  local label="$1"
  shift
  log "Starting MOLIT collection stage: $label"
  set +e
  docker compose -f "$COMPOSE_FILE" run --rm "$SERVICE" \
    node scripts/sync-molit-trades.js "$@"
  local sync_status="$?"
  set -e
  if [[ "$sync_status" -eq 75 ]]; then
    log "MOLIT collection stage stopped after quota exhaustion: $label"
    return 75
  fi
  if [[ "$sync_status" -ne 0 ]]; then
    log "MOLIT collection stage failed with exit code $sync_status: $label"
    return "$sync_status"
  fi
  return 0
}

RECENT_START_MONTH="${MOLIT_NATIONAL_BATCH_RECENT_START:-$(previous_month)}"
RECENT_END_MONTH="${MOLIT_NATIONAL_BATCH_RECENT_END:-$(current_month)}"

set +e
run_collection "recent-2-months" \
  --targets "$RECENT_TARGETS" \
  --start "$RECENT_START_MONTH" \
  --end "$RECENT_END_MONTH" \
  --force \
  --only-collected-targets \
  --limit "$LIMIT" \
  --delay-ms "$DELAY_MS" \
  --skip-map-cache-refresh
recent_status="$?"
set -e

if [[ "$recent_status" -eq 75 ]]; then
  log "Quota exhausted during recent refresh; backfill and cache refresh will wait for the next scheduled run."
  exit 0
fi
if [[ "$recent_status" -ne 0 ]]; then
  exit "$recent_status"
fi

remaining_before="$(remaining_tasks)"
log "MOLIT national batch remaining before run: $remaining_before"

backfill_quota_exhausted=0
if [[ "$remaining_before" -gt 0 ]]; then
  set +e
  run_collection "backfill" \
    --targets "$TARGETS" \
    --limit "$LIMIT" \
    --delay-ms "$DELAY_MS" \
    --skip-map-cache-refresh
  backfill_status="$?"
  set -e
  if [[ "$backfill_status" -eq 75 ]]; then
    backfill_quota_exhausted=1
  elif [[ "$backfill_status" -ne 0 ]]; then
    exit "$backfill_status"
  fi
else
  log "No remaining MOLIT backfill tasks."
fi

docker compose -f "$COMPOSE_FILE" run --rm "$SERVICE" \
  npm run sync:molit-complexes -- \
    --geocode \
    --geocode-mode missing \
    --geocode-limit "$GEOCODE_LIMIT"

docker compose -f "$COMPOSE_FILE" run --rm "$SERVICE" \
  npm run refresh:molit-map-cache -- --skip-complex-sync

if [[ "$REFRESH_PRICE_BAND_CACHE" != "0" ]]; then
  docker compose -f "$COMPOSE_FILE" run --rm "$SERVICE" \
    npm run refresh:price-band-cache
else
  log "Skipping price band rank cache refresh."
fi

docker compose -f "$COMPOSE_FILE" run --rm "$SERVICE" \
  npm run check:data-health

remaining_after="$(remaining_tasks)"
log "MOLIT national batch remaining after run: $remaining_after"
if [[ "$backfill_quota_exhausted" -eq 1 ]]; then
  log "Backfill stopped on quota exhaustion; next scheduled run will continue after the recent refresh."
fi
