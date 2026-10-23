#!/usr/bin/env bash
set -Eeuo pipefail
SOURCE_DIR="/home/th/docker/custom/orulzip/production"
RUNTIME_DIR="/home/th/docker/custom/orulzip/data-collector"
cd "$SOURCE_DIR"
[[ "$(git branch --show-current)" == "main" ]] || { echo "Deploy only from main" >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo "Production checkout is dirty" >&2; exit 1; }
COMMON_DIR="$(git rev-parse --path-format=absolute --git-common-dir)"
[[ -d "$COMMON_DIR/codex-production.lock" ]] || { echo "Acquire the production integration lock before deploying" >&2; exit 1; }
[[ -n "${ORULZIP_PRODUCTION_LOCK_OWNER:-}" ]] || { echo "Set ORULZIP_PRODUCTION_LOCK_OWNER to the current lock owner" >&2; exit 1; }
ACTUAL_LOCK_OWNER="$(node -e 'const fs=require("node:fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1],"utf8")).owner || "")' "$COMMON_DIR/codex-production.lock/owner.json")"
[[ "$ACTUAL_LOCK_OWNER" == "$ORULZIP_PRODUCTION_LOCK_OWNER" ]] || { echo "Production lock belongs to another owner" >&2; exit 1; }
export ORULZIP_COLLECTOR_IMAGE="orulzip-collector:$(git rev-parse HEAD)"
compose=(docker compose -p orulzip-data-collector --project-directory "$SOURCE_DIR" --env-file "$RUNTIME_DIR/.env" -f "$SOURCE_DIR/docker-compose.data-collector.yml")
"${compose[@]}" build --build-arg ORULZIP_COMMIT_SHA="$(git rev-parse HEAD)" daily-collection
"${compose[@]}" run --rm --no-deps -T --interactive=false --entrypoint node daily-collection scripts/migrate-db.js
"${compose[@]}" run --rm --no-deps -T --interactive=false --entrypoint node daily-collection --test
mkdir -p "$RUNTIME_DIR/logs/daily-collection" "$RUNTIME_DIR/backups"
backup="$RUNTIME_DIR/backups/crontab-before-daily-collection-$(date +%Y%m%d-%H%M%S)"
(umask 077; crontab -l > "$backup" 2>/dev/null || true)
for name in orulzip-worker orulzip-worker-gyeonggi orulzip-molit-daily-collector orulzip-price-band-cache orulzip-data-collector-worker orulzip-data-collector-worker-gyeonggi orulzip-data-collector-molit-daily-collector orulzip-data-collector-worker-kb-national-sequential orulzip-data-collector-kb-national-orchestrator orulzip-data-collector-price-band-cache; do
  if docker container inspect "$name" >/dev/null 2>&1; then
    docker update --restart=no "$name" >/dev/null
    docker stop --time 30 "$name" >/dev/null
  fi
done
(umask 077; printf "%s\n" "$ORULZIP_COLLECTOR_IMAGE" > "$RUNTIME_DIR/active-collection-image.tmp")
mv "$RUNTIME_DIR/active-collection-image.tmp" "$RUNTIME_DIR/active-collection-image"
"$SOURCE_DIR/scripts/install-daily-collection-cron.sh"
printf 'Collection release installed: %s\n' "$(git rev-parse HEAD)"
