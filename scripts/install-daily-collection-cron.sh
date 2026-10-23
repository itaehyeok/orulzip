#!/usr/bin/env bash
set -Eeuo pipefail
APP_DIR="${ORULZIP_PRODUCTION_DIR:-/home/th/docker/custom/orulzip/production}"
if [[ "$(cat /etc/timezone 2>/dev/null || true)" != "Asia/Seoul" || "$(date +%Z%z)" != "KST+0900" ]]; then
  echo "Production host timezone must be Asia/Seoul (KST) to install this schedule." >&2
  exit 1
fi
INSTALLER_MARKER="# orulzip daily-collection"; LEGACY_MARKER="# orulzip molit-national-batch"
CRONTAB_BIN="${CRONTAB_BIN:-crontab}"
existing="$("$CRONTAB_BIN" -l 2>/dev/null || true)"
updated="$(printf '%s\n' "$existing" | awk -v marker="$INSTALLER_MARKER" -v legacy="$LEGACY_MARKER" 'index($0, marker) || index($0, legacy) { next } { print }' | sed '/^[[:space:]]*$/d')"
new_entries="$(cat <<EOF
0 2 * * * $APP_DIR/scripts/run-daily-collection.sh molit $INSTALLER_MARKER molit
0 5 * * * $APP_DIR/scripts/run-daily-collection.sh kb $INSTALLER_MARKER kb
EOF
)"
if [[ -n "$updated" ]]; then updated+=$'\n'; fi; updated+="$new_entries"
if [[ "${ORULZIP_CRON_INSTALL_DRY_RUN:-0}" == "1" ]]; then printf '%s\n' "$updated"; exit 0; fi
printf '%s\n' "$updated" | "$CRONTAB_BIN" -
printf 'Installed daily collection schedule (KST): MOLIT 02:00, KB 05:00.\n'
