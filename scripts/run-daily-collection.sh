#!/usr/bin/env bash
set -Eeuo pipefail
PROVIDER="${1:-}"; shift || true
case "$PROVIDER" in molit|kb) ;; *) echo "Usage: $0 molit|kb [child args...]" >&2; exit 2 ;; esac
APP_DIR="/home/th/docker/custom/orulzip/production"
COLLECTOR_DIR="/home/th/docker/custom/orulzip/data-collector"
ENV_FILE="$COLLECTOR_DIR/.env"; COMPOSE_FILE="$APP_DIR/docker-compose.data-collector.yml"
PROJECT_NAME="orulzip-data-collector"; SERVICE="daily-collection"
LOG_DIR="$COLLECTOR_DIR/logs/daily-collection"; mkdir -p "$LOG_DIR"
exec >>"$LOG_DIR/$PROVIDER.log" 2>&1
printf '[%s] Starting %s daily collection\n' "$(date -Is)" "$PROVIDER"
[[ -f "$ENV_FILE" ]] || { echo "Required production env file is missing; refusing to run."; exit 1; }
[[ -f "$COMPOSE_FILE" ]] || { echo "Required production compose file is missing; refusing to run."; exit 1; }
exec 9>"$LOG_DIR/$PROVIDER.lock"
if ! flock -n 9; then printf '[%s] %s collection already holds the host lock; skipped\n' "$(date -Is)" "$PROVIDER"; exit 0; fi
if [[ "$(git -C "$APP_DIR" branch --show-current)" != "main" ]]; then echo "Canonical production checkout is not on main; refusing to run."; exit 1; fi
if [[ -n "$(git -C "$APP_DIR" status --porcelain --untracked-files=no)" ]]; then echo "Canonical production checkout has tracked changes; refusing to run."; exit 1; fi
RELEASE_FILE="$COLLECTOR_DIR/active-collection-image"
[[ -f "$RELEASE_FILE" ]] || { echo "No activated collection release"; exit 1; }
export ORULZIP_COLLECTOR_IMAGE="$(cat "$RELEASE_FILE")"
[[ "$ORULZIP_COLLECTOR_IMAGE" =~ ^orulzip-collector:[0-9a-f]{40}$ ]] || { echo "Invalid activated collection image"; exit 1; }
COMMIT="$(printf "%s" "$ORULZIP_COLLECTOR_IMAGE" | cut -d: -f2)"
git -C "$APP_DIR" merge-base --is-ancestor "$COMMIT" HEAD || { echo "Collection release is not integrated in main"; exit 1; }
docker image inspect "$ORULZIP_COLLECTOR_IMAGE" >/dev/null 2>&1 || { echo "Exact production image is not present locally; refusing to run."; exit 1; }
cd "$APP_DIR"; set +e
docker compose --project-name "$PROJECT_NAME" --project-directory "$APP_DIR" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" \
  run --rm --no-deps --pull never --entrypoint node -e ORULZIP_DB_INIT=0 \
  "$SERVICE" scripts/run-daily-collection.js "$PROVIDER" "$@"
status=$?; set -e
if [[ "$status" -eq 0 ]]; then printf '[%s] %s daily collection completed\n' "$(date -Is)" "$PROVIDER"
else printf '[%s] %s daily collection failed with status %s\n' "$(date -Is)" "$PROVIDER" "$status"; fi
exit "$status"
