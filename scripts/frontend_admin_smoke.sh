#!/usr/bin/env bash

set -euo pipefail

PORT="${FRONTEND_SMOKE_PORT:-3001}"
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_LOG="${FRONTEND_SMOKE_LOG:-/tmp/deploymate-frontend-admin-smoke.log}"
USERS_HTML="$(mktemp)"
UPGRADE_HTML="$(mktemp)"
REGISTER_HTML="$(mktemp)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cleanup() {
  if [ -n "${SERVER_PID:-}" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$USERS_HTML" "$UPGRADE_HTML" "$REGISTER_HTML"
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

curl -sS "$BASE_URL/register" >"$REGISTER_HTML"

curl -sS "$BASE_URL/app/users" >"$USERS_HTML"
curl -sS "$BASE_URL/app/upgrade-requests" >"$UPGRADE_HTML"

grep -q 'Create Trial Account\|Public signup is not enabled' "$REGISTER_HTML"

grep -q 'data-testid="users-page-title"' "$USERS_HTML"
grep -q 'data-testid="backup-panel-title"' "$USERS_HTML"
grep -q 'data-testid="admin-smoke-banner"' "$USERS_HTML"
grep -q 'data-testid="users-refresh-button"' "$USERS_HTML"
grep -q 'data-testid="users-copy-link-button"' "$USERS_HTML"
grep -q 'data-testid="users-export-button"' "$USERS_HTML"
grep -q 'data-testid="users-audit-export-button"' "$USERS_HTML"
grep -q 'data-testid="users-audit-search"' "$USERS_HTML"
grep -q 'data-testid="users-audit-scope-filter"' "$USERS_HTML"
grep -q 'data-testid="users-audit-sort"' "$USERS_HTML"
grep -q 'data-testid="users-audit-copy-link-button"' "$USERS_HTML"
grep -q 'data-testid="users-audit-current-export-button"' "$USERS_HTML"
grep -q 'data-testid="users-audit-reset-button"' "$USERS_HTML"
grep -q 'data-testid="users-save-audit-view-button"' "$USERS_HTML"
grep -q 'data-testid="users-audit-views-list"' "$USERS_HTML"
grep -q 'data-testid="users-reset-filters-button"' "$USERS_HTML"
grep -q 'data-testid="users-copy-filter-link-button"' "$USERS_HTML"
grep -q 'data-testid="users-save-view-button"' "$USERS_HTML"
grep -q 'data-testid="users-update-current-view-button"' "$USERS_HTML"
grep -q 'data-testid="users-saved-views-list"' "$USERS_HTML"
grep -q 'data-testid="users-saved-views-search"' "$USERS_HTML"
grep -q 'data-testid="users-saved-views-source-filter"' "$USERS_HTML"
grep -q 'data-testid="users-saved-views-sort"' "$USERS_HTML"
grep -q 'data-testid="users-export-saved-views-button"' "$USERS_HTML"
grep -q 'data-testid="users-import-saved-views-button"' "$USERS_HTML"
grep -q 'data-testid="users-clear-saved-views-button"' "$USERS_HTML"
grep -q 'data-testid="users-clear-imported-saved-views-button"' "$USERS_HTML"
grep -q 'data-testid="users-reset-saved-views-tools-button"' "$USERS_HTML"
grep -q 'data-testid="users-bulk-selection-summary"' "$USERS_HTML"
grep -q 'data-testid="users-bulk-card"' "$USERS_HTML"
grep -q 'data-testid="users-bulk-title"' "$USERS_HTML"
grep -q 'data-testid="users-bulk-stats"' "$USERS_HTML"
grep -q 'data-testid="users-bulk-presets"' "$USERS_HTML"
grep -q 'data-testid="users-bulk-action-summary"' "$USERS_HTML"
grep -q 'data-testid="users-bulk-select-visible-button"' "$USERS_HTML"
grep -q 'data-testid="users-bulk-clear-selection-button"' "$USERS_HTML"
grep -q 'data-testid="users-bulk-export-selection-button"' "$USERS_HTML"
grep -q 'data-testid="users-bulk-export-filtered-button"' "$USERS_HTML"
grep -q 'data-testid="users-bulk-select-admins-button"' "$USERS_HTML"
grep -q 'data-testid="users-bulk-select-members-button"' "$USERS_HTML"
grep -q 'data-testid="users-bulk-select-password-required-button"' "$USERS_HTML"
grep -q 'data-testid="users-bulk-select-current-filter-button"' "$USERS_HTML"
grep -q 'data-testid="users-bulk-reset-tools-button"' "$USERS_HTML"
grep -q 'data-testid="users-bulk-preset-admin-button"' "$USERS_HTML"
grep -q 'data-testid="users-bulk-preset-team-button"' "$USERS_HTML"
grep -q 'data-testid="users-bulk-preset-trial-button"' "$USERS_HTML"
grep -q 'data-testid="users-bulk-role-select"' "$USERS_HTML"
grep -q 'data-testid="users-bulk-role-apply-button"' "$USERS_HTML"
grep -q 'data-testid="users-bulk-plan-select"' "$USERS_HTML"
grep -q 'data-testid="users-bulk-plan-apply-button"' "$USERS_HTML"
grep -q 'Update current view' "$USERS_HTML"
grep -q 'Loaded from local browser storage\|Using local browser storage' "$USERS_HTML"
grep -q 'data-testid="restore-dry-run-button"' "$USERS_HTML"
grep -q 'data-testid="restore-report-json-button"' "$USERS_HTML"
grep -q 'data-testid="restore-report-csv-button"' "$USERS_HTML"
grep -q 'data-testid="backup-download-bundle-button"' "$USERS_HTML"
grep -q 'data-testid="backup-paste-sample-button"' "$USERS_HTML"
grep -q 'data-testid="backup-upload-file-input"' "$USERS_HTML"
grep -q 'data-testid="backup-clear-bundle-button"' "$USERS_HTML"
grep -q 'data-testid="backup-preflight-banner"' "$USERS_HTML"
grep -q 'data-testid="restore-dry-run-button"[^>]*disabled' "$USERS_HTML"
grep -q 'data-testid="restore-report-json-button"[^>]*disabled' "$USERS_HTML"
grep -q 'data-testid="restore-report-csv-button"[^>]*disabled' "$USERS_HTML"
grep -q 'data-testid="upgrade-requests-page-title"' "$UPGRADE_HTML"
grep -q 'data-testid="admin-smoke-banner"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-refresh-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-copy-link-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-export-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-audit-search"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-audit-sort"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-audit-copy-link-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-audit-current-export-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-audit-reset-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-save-audit-view-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-audit-views-list"' "$UPGRADE_HTML"
grep -q 'Audit presets are stored separately from the main inbox saved views' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-reset-filters-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-copy-filter-link-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-save-view-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-update-current-view-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-saved-views-list"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-saved-views-search"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-saved-views-source-filter"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-saved-views-sort"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-export-saved-views-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-import-saved-views-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-clear-saved-views-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-clear-imported-saved-views-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-reset-saved-views-tools-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-bulk-selection-summary"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-bulk-card"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-bulk-title"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-bulk-stats"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-bulk-presets"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-bulk-action-summary"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-bulk-select-visible-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-bulk-clear-selection-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-bulk-export-selection-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-bulk-export-filtered-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-bulk-select-new-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-bulk-select-review-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-bulk-select-linked-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-bulk-select-current-filter-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-bulk-reset-tools-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-bulk-preset-review-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-bulk-preset-close-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-bulk-preset-reject-button"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-bulk-status-select"' "$UPGRADE_HTML"
grep -q 'data-testid="upgrade-bulk-status-apply-button"' "$UPGRADE_HTML"
grep -q 'Update current view' "$UPGRADE_HTML"
grep -q 'Loaded from local browser storage\|Using local browser storage' "$UPGRADE_HTML"

echo "[frontend-smoke] users page rendered"
echo "[frontend-smoke] register page rendered"
echo "[frontend-smoke] backup panel rendered"
echo "[frontend-smoke] backup preflight controls rendered"
echo "[frontend-smoke] disabled states rendered"
echo "[frontend-smoke] admin controls rendered"
echo "[frontend-smoke] saved views rendered"
echo "[frontend-smoke] upgrade requests page rendered"
echo "[frontend-smoke] complete"
