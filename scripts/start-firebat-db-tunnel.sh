#!/usr/bin/env bash
set -euo pipefail

SSH_HOST="${FIREBAT_SSH_HOST:-firebat}"
LOCAL_PORT="${FIREBAT_DB_LOCAL_PORT:-15432}"
REMOTE_CONTAINER="${FIREBAT_DB_CONTAINER:-orulzip-postgres}"
REMOTE_PORT="${FIREBAT_DB_REMOTE_PORT:-5432}"

REMOTE_IP="$(
  ssh "$SSH_HOST" "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' '$REMOTE_CONTAINER'"
)"

if [[ -z "$REMOTE_IP" ]]; then
  echo "Could not find IP for Docker container: $REMOTE_CONTAINER" >&2
  exit 1
fi

echo "Opening SSH tunnel: 127.0.0.1:${LOCAL_PORT} -> ${REMOTE_CONTAINER}(${REMOTE_IP}):${REMOTE_PORT} via ${SSH_HOST}"
echo "Keep this terminal open while using the local app. Press Ctrl+C to stop."

exec ssh -N -L "127.0.0.1:${LOCAL_PORT}:${REMOTE_IP}:${REMOTE_PORT}" "$SSH_HOST"
