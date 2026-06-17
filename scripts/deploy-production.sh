#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-${PRODUCTION_DIR:-/home/th/docker/custom/orulzip/production}}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-orulzip}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
DOCKER_NETWORK_NAME="${DOCKER_NETWORK_NAME:-${ORULZIP_DOCKER_NETWORK:-}}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://localhost:3050/map}"
LOCK_FILE="${DEPLOY_LOCK_FILE:-/tmp/orulzip-production-deploy.lock}"
ASKPASS_FILE=""

log() {
  printf '[deploy] %s\n' "$*"
}

cleanup() {
  if [ -n "$ASKPASS_FILE" ] && [ -f "$ASKPASS_FILE" ]; then
    rm -f "$ASKPASS_FILE"
  fi
}

trap cleanup EXIT

fetch_origin_branch() {
  if [ -n "${GITHUB_TOKEN:-}" ] && [ -n "${GITHUB_REPOSITORY:-}" ]; then
    ASKPASS_FILE="$(mktemp)"
    cat > "$ASKPASS_FILE" <<'ASKPASS'
#!/usr/bin/env bash
case "$1" in
  *Username*) printf '%s\n' "x-access-token" ;;
  *Password*) printf '%s\n' "$GITHUB_TOKEN" ;;
  *) printf '\n' ;;
esac
ASKPASS
    chmod 700 "$ASKPASS_FILE"
    GIT_ASKPASS="$ASKPASS_FILE" GIT_TERMINAL_PROMPT=0 git fetch \
      "https://github.com/${GITHUB_REPOSITORY}.git" \
      "+$DEPLOY_BRANCH:refs/remotes/origin/$DEPLOY_BRANCH"
    return
  fi

  GIT_TERMINAL_PROMPT=0 git fetch origin "+$DEPLOY_BRANCH:refs/remotes/origin/$DEPLOY_BRANCH"
}

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "another deployment is already running"
  exit 1
fi

if [ ! -d "$DEPLOY_DIR/.git" ]; then
  log "initializing git checkout: $DEPLOY_DIR"
  mkdir -p "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"
  git init
  if ! git remote get-url origin >/dev/null 2>&1; then
    if [ -n "${GITHUB_REPOSITORY:-}" ]; then
      git remote add origin "https://github.com/${GITHUB_REPOSITORY}.git"
    else
      log "missing origin remote and GITHUB_REPOSITORY"
      exit 1
    fi
  fi
else
  cd "$DEPLOY_DIR"
fi

if [ ! -f ".env" ]; then
  log "missing $DEPLOY_DIR/.env"
  exit 1
fi

log "updating $DEPLOY_DIR from origin/$DEPLOY_BRANCH"
fetch_origin_branch
git checkout -B "$DEPLOY_BRANCH" "refs/remotes/origin/$DEPLOY_BRANCH"
git reset --hard "refs/remotes/origin/$DEPLOY_BRANCH"
export ORULZIP_COMMIT_SHA="$(git rev-parse --short=7 HEAD)"
export ORULZIP_DEPLOYED_AT_KST="$(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M KST')"
log "deploy version: $ORULZIP_DEPLOYED_AT_KST $ORULZIP_COMMIT_SHA"

if [ -n "$DOCKER_NETWORK_NAME" ]; then
  if ! docker network inspect "$DOCKER_NETWORK_NAME" >/dev/null 2>&1; then
    log "creating docker network $DOCKER_NETWORK_NAME"
    docker network create "$DOCKER_NETWORK_NAME" >/dev/null
  fi
fi

export COMPOSE_FILE
log "building and restarting docker compose project $COMPOSE_PROJECT_NAME with $COMPOSE_FILE"
docker compose -p "$COMPOSE_PROJECT_NAME" up -d --build

log "checking service health at $HEALTHCHECK_URL"
for attempt in $(seq 1 20); do
  if curl -fsS "$HEALTHCHECK_URL" >/dev/null; then
    log "healthcheck passed"
    docker compose -p "$COMPOSE_PROJECT_NAME" ps
    exit 0
  fi
  log "healthcheck attempt $attempt failed; retrying"
  sleep 3
done

log "healthcheck failed"
docker compose -p "$COMPOSE_PROJECT_NAME" ps
exit 1
