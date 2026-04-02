#!/usr/bin/env bash

set -euo pipefail

PORT="${FRONTEND_SMOKE_PORT:-3001}"
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_LOG="${FRONTEND_SMOKE_LOG:-/tmp/deploymate-frontend-admin-smoke.log}"
USERS_HTML="$(mktemp)"
UPGRADE_HTML="$(mktemp)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cleanup() {
  if [ -n "${SERVER_PID:-}" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$USERS_HTML" "$UPGRADE_HTML"
}

trap cleanup EXIT

NEXT_PUBLIC_SMOKE_TEST_MODE=1 npm --prefix "$REPO_ROOT/frontend" run dev -- --hostname 127.0.0.1 --port "$PORT" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 60); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "[frontend-smoke] dev server exited early" >&2
    cat "$SERVER_LOG" >&2
    exit 1
  fi
  if curl -sS -o /dev/null "$BASE_URL/login"; then
    break
  fi
  sleep 1
done

if ! curl -sS -o /dev/null "$BASE_URL/login"; then
  echo "[frontend-smoke] dev server did not become ready" >&2
  cat "$SERVER_LOG" >&2
  exit 1
fi

curl -sS "$BASE_URL/app/users" >"$USERS_HTML"
curl -sS "$BASE_URL/app/upgrade-requests" >"$UPGRADE_HTML"

grep -q 'data-testid="users-page-title"' "$USERS_HTML"
grep -q 'data-testid="backup-panel-title"' "$USERS_HTML"
grep -q 'data-testid="admin-smoke-banner"' "$USERS_HTML"
grep -q 'data-testid="users-refresh-button"' "$USERS_HTML"
grep -q 'data-testid="users-copy-link-button"' "$USERS_HTML"
grep -q 'data-testid="users-export-button"' "$USERS_HTML"
grep -q 'data-testid="users-audit-export-button"' "$USERS_HTML"
grep -q 'data-testid="users-reset-filters-button"' "$USERS_HTML"
grep -q 'data-testid="users-copy-filter-link-button"' "$USERS_HTML"
grep -q 'data-testid="users-save-view-button"' "$USERS_HTML"
grep -q 'data-testid="users-saved-views-list"' "$USERS_HTML"
grep -q 'data-testid="users-export-saved-views-button"' "$USERS_HTML"
grep -q 'data-testid="users-import-saved-views-button"' "$USERS_HTML"
grep -q 'data-testid="users-clear-saved-views-button"' "$USERS_HTML"
grep -q 'data-testid="restore-dry-run-button"' "$USERS_HTML"
grep -q 'data-testid="restore-report-json-button"' "$USERS_HTML"
grep -q 'data-testid="restore-report-csv-button"' "$USERS_HTML"
grep -q 'data-testid="restore-dry-run-button"[^>]*disabled' "$USERS_HTML"
grep -q 'data-testid="restore-report-json-button"[^>]*disabled' "$USERS_HTML"
grep -q 'data-testid="restore-report-csv-button"[^>]*disabled' "$USERS_HTML"
grep -q 'data-testid="upgrade-requests-page-title"' "$UPGRADE_HTML"
grep -q 'data-testid="admin-smoke-banner"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-refresh-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-copy-link-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-export-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-reset-filters-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-copy-filter-link-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-save-view-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-saved-views-list"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-export-saved-views-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-import-saved-views-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-clear-saved-views-button"' "$UPGRADE_HTML"

echo "[frontend-smoke] users page rendered"
echo "[frontend-smoke] backup panel rendered"
echo "[frontend-smoke] disabled states rendered"
echo "[frontend-smoke] admin controls rendered"
echo "[frontend-smoke] saved views rendered"
echo "[frontend-smoke] upgrade requests page rendered"
echo "[frontend-smoke] complete"
