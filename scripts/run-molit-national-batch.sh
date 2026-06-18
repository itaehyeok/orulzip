#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ORULZIP_DATA_COLLECTOR_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
COMPOSE_FILE="${MOLIT_NATIONAL_BATCH_COMPOSE_FILE:-docker-compose.data-collector.yml}"
SERVICE="${MOLIT_NATIONAL_BATCH_SERVICE:-molit-daily-collector}"
TARGETS="${MOLIT_NATIONAL_BATCH_TARGETS:-gyeongnam,gyeongbuk,jeonnam,jeju,chungbuk,chungnam,jeonbuk}"
LIMIT="${MOLIT_NATIONAL_BATCH_LIMIT:-9700}"
DELAY_MS="${MOLIT_NATIONAL_BATCH_DELAY_MS:-500}"
GEOCODE_LIMIT="${MOLIT_NATIONAL_BATCH_GEOCODE_LIMIT:-5000}"
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

remove_cron_if_done() {
  if [[ "${MOLIT_NATIONAL_BATCH_REMOVE_CRON_ON_COMPLETE:-0}" != "1" ]]; then
    return
  fi
  if ! command -v crontab >/dev/null 2>&1; then
    return
  fi
  local next_cron
  next_cron="$(mktemp)"
  crontab -l 2>/dev/null | grep -vF "$CRON_MARKER" > "$next_cron" || true
  crontab "$next_cron"
  rm -f "$next_cron"
  log "Removed cron entries marked as: $CRON_MARKER"
}

remaining_before="$(remaining_tasks)"
log "MOLIT national batch remaining before run: $remaining_before"
if [[ "$remaining_before" -le 0 ]]; then
  log "No remaining MOLIT national tasks."
  remove_cron_if_done
  exit 0
fi

docker compose -f "$COMPOSE_FILE" run --rm "$SERVICE" \
  node scripts/sync-molit-trades.js \
    --targets "$TARGETS" \
    --limit "$LIMIT" \
    --delay-ms "$DELAY_MS" \
    --skip-map-cache-refresh

docker compose -f "$COMPOSE_FILE" run --rm "$SERVICE" \
  npm run sync:molit-complexes -- \
    --geocode \
    --geocode-mode missing \
    --geocode-limit "$GEOCODE_LIMIT"

docker compose -f "$COMPOSE_FILE" run --rm "$SERVICE" \
  npm run refresh:molit-map-cache -- --skip-complex-sync

remaining_after="$(remaining_tasks)"
log "MOLIT national batch remaining after run: $remaining_after"
if [[ "$remaining_after" -le 0 ]]; then
  remove_cron_if_done
fi
