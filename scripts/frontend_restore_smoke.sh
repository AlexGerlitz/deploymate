#!/usr/bin/env bash

set -euo pipefail

PORT="${FRONTEND_SMOKE_PORT:-3001}"
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_LOG="${FRONTEND_SMOKE_LOG:-/tmp/deploymate-frontend-restore-smoke.log}"
DIST_DIR="${FRONTEND_SMOKE_DIST_DIR:-.next-smoke-${PORT}}"
USERS_HTML="$(mktemp)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/frontend_smoke_shared.sh"

cleanup() {
  if [ "${FRONTEND_SMOKE_REUSE_SERVER:-0}" != "1" ]; then
    stop_frontend_smoke_server
  fi
  rm -f "$USERS_HTML"
}

trap cleanup EXIT

if [ "${FRONTEND_SMOKE_REUSE_SERVER:-0}" != "1" ]; then
  NEXT_PUBLIC_SMOKE_RESTORE_REPORT=1 start_frontend_smoke_server
fi

wait_for_frontend_smoke_url "/app/users"

curl -sS "$BASE_URL/app/users" >"$USERS_HTML"

check_contains() {
  local label="$1"
  local pattern="$2"

  if ! grep -Eq "$pattern" "$USERS_HTML"; then
    echo "[frontend-restore-smoke] missing check: $label" >&2
    exit 1
  fi
}

check_contains "restore report surface" 'data-testid="restore-report"'
check_contains "restore summary badges" 'data-testid="restore-summary-badges"'
check_contains "restore summary digest" 'data-testid="restore-summary-digest"'
check_contains "restore attention overview" 'data-testid="restore-attention-overview"'
check_contains "restore issues csv button" 'data-testid="restore-report-issues-csv-button"'
check_contains "restore copy summary button" 'data-testid="restore-copy-summary-button"'
check_contains "restore section filter" 'data-testid="restore-section-filter"'
check_contains "restore manifest counts" 'data-testid="restore-manifest-counts"'
check_contains "restore section chips" 'data-testid="restore-section-chips"'
check_contains "restore users section" 'data-testid="restore-section-users"'
check_contains "restore servers section" 'data-testid="restore-section-servers"'
check_contains "restore deployments section" 'data-testid="restore-section-deployments"'
check_contains "restore digest copy" 'priority: users, servers, deployment_templates'
check_contains "restore issues copy" 'Server credentials and host trust must be reviewed before any import\.'
check_contains "restore issues csv label" 'Issues CSV'

echo "[frontend-restore-smoke] restore report rendered"
echo "[frontend-restore-smoke] restore digest controls rendered"
echo "[frontend-restore-smoke] restore attention sections rendered"
echo "[frontend-restore-smoke] complete"
