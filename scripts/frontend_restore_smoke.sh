#!/usr/bin/env bash

set -euo pipefail

PORT="${FRONTEND_SMOKE_PORT:-3001}"
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_LOG="${FRONTEND_SMOKE_LOG:-/tmp/deploymate-frontend-restore-smoke.log}"
DIST_DIR="${FRONTEND_SMOKE_DIST_DIR:-.next-smoke-${PORT}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/frontend_smoke_shared.sh"
source "${SCRIPT_DIR}/lib/frontend_smoke_checks.sh"

cleanup() {
  if [ "${FRONTEND_SMOKE_REUSE_SERVER:-0}" != "1" ]; then
    stop_frontend_smoke_server
  fi
}

trap cleanup EXIT

if [ "${FRONTEND_SMOKE_REUSE_SERVER:-0}" != "1" ]; then
  NEXT_PUBLIC_SMOKE_RESTORE_REPORT=1 start_frontend_smoke_server
fi

wait_for_frontend_smoke_url "/app/users"
frontend_smoke_assert_checks "frontend-restore-smoke" "$BASE_URL" automation_smoke_restore_checks

echo "[frontend-restore-smoke] restore report rendered"
echo "[frontend-restore-smoke] restore digest controls rendered"
echo "[frontend-restore-smoke] restore attention sections rendered"
echo "[frontend-restore-smoke] complete"
