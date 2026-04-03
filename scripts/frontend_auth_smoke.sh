#!/usr/bin/env bash

set -euo pipefail

PORT="${FRONTEND_SMOKE_PORT:-3001}"
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_LOG="${FRONTEND_SMOKE_LOG:-/tmp/deploymate-frontend-auth-smoke.log}"
DIST_DIR="${FRONTEND_SMOKE_DIST_DIR:-.next-smoke-${PORT}}"
LOGIN_HTML="$(mktemp)"
REGISTER_HTML="$(mktemp)"
CHANGE_PASSWORD_HTML="$(mktemp)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/lib/project_automation.sh"
source "${SCRIPT_DIR}/lib/frontend_smoke_checks.sh"
source "${SCRIPT_DIR}/frontend_smoke_shared.sh"

cleanup() {
  if [ "${FRONTEND_SMOKE_REUSE_SERVER:-0}" != "1" ]; then
    stop_frontend_smoke_server
  fi
  rm -f "$LOGIN_HTML" "$REGISTER_HTML" "$CHANGE_PASSWORD_HTML"
}

trap cleanup EXIT

if [ "${FRONTEND_SMOKE_REUSE_SERVER:-0}" != "1" ]; then
  start_frontend_smoke_server
fi

wait_for_frontend_smoke_url "$(automation_frontend_auth_ready_path)"
frontend_smoke_assert_checks "frontend-auth-smoke" "$BASE_URL" automation_smoke_auth_checks

echo "[frontend-auth-smoke] login page rendered"
echo "[frontend-auth-smoke] register page rendered"
echo "[frontend-auth-smoke] change-password page rendered"
echo "[frontend-auth-smoke] complete"
