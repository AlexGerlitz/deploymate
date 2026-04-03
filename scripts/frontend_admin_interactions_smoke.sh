#!/usr/bin/env bash

set -euo pipefail

PORT="${FRONTEND_SMOKE_PORT:-3001}"
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_LOG="${FRONTEND_SMOKE_LOG:-/tmp/deploymate-frontend-admin-interactions-smoke.log}"
DIST_DIR="${FRONTEND_SMOKE_DIST_DIR:-.next-smoke-${PORT}}"
USERS_HTML="$(mktemp)"
UPGRADE_HTML="$(mktemp)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/frontend_smoke_shared.sh"

cleanup() {
  if [ "${FRONTEND_SMOKE_REUSE_SERVER:-0}" != "1" ]; then
    stop_frontend_smoke_server
  fi
  rm -f "$USERS_HTML" "$UPGRADE_HTML"
}

trap cleanup EXIT

if [ "${FRONTEND_SMOKE_REUSE_SERVER:-0}" != "1" ]; then
  start_frontend_smoke_server
fi

wait_for_frontend_smoke_url "/app/users"

curl -sS "$BASE_URL/app/users" >"$USERS_HTML"
curl -sS "$BASE_URL/app/upgrade-requests" >"$UPGRADE_HTML"

check_contains() {
  local file="$1"
  local label="$2"
  local pattern="$3"

  if ! grep -Eq "$pattern" "$file"; then
    echo "[frontend-admin-interactions-smoke] missing check: $label" >&2
    exit 1
  fi
}

check_contains "$USERS_HTML" "users saved view name" 'Admins only'
check_contains "$USERS_HTML" "users active saved view badge" 'Current'
check_contains "$USERS_HTML" "users saved views meta copy" 'Loaded from local browser storage\.'
check_contains "$USERS_HTML" "users audit saved view" 'User actions'
check_contains "$USERS_HTML" "users bulk card" 'data-testid="users-bulk-card"'
check_contains "$USERS_HTML" "users bulk action summary surface" 'data-testid="users-bulk-action-summary"'
check_contains "$USERS_HTML" "users current filter button" 'data-testid="users-bulk-select-current-filter-button"'
check_contains "$USERS_HTML" "users update current view button" 'data-testid="users-update-current-view-button"'

check_contains "$UPGRADE_HTML" "upgrade saved view name" 'In review queue'
check_contains "$UPGRADE_HTML" "upgrade active saved view badge" 'Current'
check_contains "$UPGRADE_HTML" "upgrade saved views meta copy" 'Loaded from local browser storage\.'
check_contains "$UPGRADE_HTML" "upgrade audit saved view" 'Newest approvals'
check_contains "$UPGRADE_HTML" "upgrade bulk card" 'data-testid="upgrade-bulk-card"'
check_contains "$UPGRADE_HTML" "upgrade bulk action summary surface" 'data-testid="upgrade-bulk-action-summary"'
check_contains "$UPGRADE_HTML" "upgrade current filter button" 'data-testid="upgrade-bulk-select-current-filter-button"'
check_contains "$UPGRADE_HTML" "upgrade update current view button" 'data-testid="upgrade-update-current-view-button"'

echo "[frontend-admin-interactions-smoke] users saved views rendered with active state"
echo "[frontend-admin-interactions-smoke] users bulk actions surface rendered"
echo "[frontend-admin-interactions-smoke] upgrade saved views rendered with active state"
echo "[frontend-admin-interactions-smoke] upgrade bulk actions surface rendered"
echo "[frontend-admin-interactions-smoke] complete"
