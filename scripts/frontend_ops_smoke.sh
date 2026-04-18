#!/usr/bin/env bash

set -euo pipefail

PORT="${FRONTEND_SMOKE_PORT:-3001}"
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_LOG="${FRONTEND_SMOKE_LOG:-/tmp/deploymate-frontend-ops-smoke.log}"
DIST_DIR="${FRONTEND_SMOKE_DIST_DIR:-.next-smoke-${PORT}}"
APP_HTML="$(mktemp)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/lib/frontend_smoke_checks.sh"
source "${SCRIPT_DIR}/frontend_smoke_shared.sh"

cleanup() {
  if [ "${FRONTEND_SMOKE_REUSE_SERVER:-0}" != "1" ]; then
    stop_frontend_smoke_server
  fi
  rm -f "$APP_HTML"
}

trap cleanup EXIT

if [ "${FRONTEND_SMOKE_REUSE_SERVER:-0}" != "1" ]; then
  start_frontend_smoke_server
fi

wait_for_frontend_smoke_url "$(automation_frontend_ready_path)"
frontend_smoke_assert_checks "frontend-ops-smoke" "$BASE_URL" automation_smoke_ops_checks

curl -sS "${BASE_URL}/app" > "$APP_HTML"

if ! grep -Eq 'DeployMate host root disk is 86% full' "$APP_HTML"; then
  echo "[frontend-ops-smoke] root disk pressure attention item is missing" >&2
  exit 1
fi

if ! grep -Eq 'Clear old builder cache before the next release\.' "$APP_HTML"; then
  echo "[frontend-ops-smoke] root disk pressure guidance is missing" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="ops-disk-recovery-card"' "$APP_HTML"; then
  echo "[frontend-ops-smoke] low-disk recovery runbook card is missing" >&2
  exit 1
fi

if ! grep -Eq 'docker builder prune --all --force' "$APP_HTML"; then
  echo "[frontend-ops-smoke] low-disk recovery commands are missing the builder cleanup step" >&2
  exit 1
fi

if ! grep -Eq 'journalctl --vacuum-size=100M' "$APP_HTML"; then
  echo "[frontend-ops-smoke] low-disk recovery commands are missing the journal cleanup step" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="ops-copy-disk-recovery-button"' "$APP_HTML"; then
  echo "[frontend-ops-smoke] low-disk recovery card is missing the copy action" >&2
  exit 1
fi

echo "[frontend-ops-smoke] ops overview rendered"
echo "[frontend-ops-smoke] ops export actions rendered"
echo "[frontend-ops-smoke] ops attention surface rendered"
echo "[frontend-ops-smoke] complete"
