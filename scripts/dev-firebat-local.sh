#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ORULZIP_LOCAL_ENV_FILE:-.env.local.firebat}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  echo "Create it from firebat development env, then run this script again." >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

export HOST="${HOST:-127.0.0.1}"
export PORT="${PORT:-3065}"
export ORULZIP_DB_INIT="${ORULZIP_DB_INIT:-0}"
export ORULZIP_READ_ONLY="${ORULZIP_READ_ONLY:-1}"
export ORULZIP_ADMIN_COOKIE_SECURE="${ORULZIP_ADMIN_COOKIE_SECURE:-0}"

exec npm run dev
