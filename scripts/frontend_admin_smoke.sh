#!/usr/bin/env bash

set -euo pipefail

PORT="${FRONTEND_SMOKE_PORT:-3001}"
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_LOG="${FRONTEND_SMOKE_LOG:-/tmp/deploymate-frontend-admin-smoke.log}"
DIST_DIR="${FRONTEND_SMOKE_DIST_DIR:-.next-smoke-${PORT}}"
USERS_HTML="$(mktemp)"
UPGRADE_HTML="$(mktemp)"
REGISTER_HTML="$(mktemp)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/frontend_smoke_shared.sh"

cleanup() {
  if [ "${FRONTEND_SMOKE_REUSE_SERVER:-0}" != "1" ]; then
    stop_frontend_smoke_server
  fi
  rm -f "$USERS_HTML" "$UPGRADE_HTML" "$REGISTER_HTML"
}

trap cleanup EXIT

if [ "${FRONTEND_SMOKE_REUSE_SERVER:-0}" != "1" ]; then
  start_frontend_smoke_server
fi

wait_for_frontend_smoke_url "/login"

curl -sS "$BASE_URL/register" >"$REGISTER_HTML"

curl -sS "$BASE_URL/app/users" >"$USERS_HTML"
curl -sS "$BASE_URL/app/upgrade-requests" >"$UPGRADE_HTML"

check_contains() {
  local file="$1"
  local label="$2"
  local pattern="$3"

  if ! grep -Eq "$pattern" "$file"; then
    echo "[frontend-smoke] missing check: $label" >&2
    exit 1
  fi
}

check_contains "$REGISTER_HTML" "register copy" 'Create Trial Account|Public signup is not enabled'

check_contains "$USERS_HTML" "users page title" 'data-testid="users-page-title"'
check_contains "$USERS_HTML" "backup panel title" 'data-testid="backup-panel-title"'
check_contains "$USERS_HTML" "admin smoke banner" 'data-testid="admin-smoke-banner"'
check_contains "$USERS_HTML" "users refresh button" 'data-testid="users-refresh-button"'
check_contains "$USERS_HTML" "users copy link button" 'data-testid="users-copy-link-button"'
check_contains "$USERS_HTML" "users export button" 'data-testid="users-export-button"'
check_contains "$USERS_HTML" "users audit export button" 'data-testid="users-audit-export-button"'
check_contains "$USERS_HTML" "users audit search" 'data-testid="users-audit-search"'
check_contains "$USERS_HTML" "users audit scope filter" 'data-testid="users-audit-scope-filter"'
check_contains "$USERS_HTML" "users audit sort" 'data-testid="users-audit-sort"'
check_contains "$USERS_HTML" "users audit copy link button" 'data-testid="users-audit-copy-link-button"'
check_contains "$USERS_HTML" "users audit current export button" 'data-testid="users-audit-current-export-button"'
check_contains "$USERS_HTML" "users audit reset button" 'data-testid="users-audit-reset-button"'
check_contains "$USERS_HTML" "users save audit view button" 'data-testid="users-save-audit-view-button"'
check_contains "$USERS_HTML" "users audit views list" 'data-testid="users-audit-views-list"'
check_contains "$USERS_HTML" "users reset filters button" 'data-testid="users-reset-filters-button"'
check_contains "$USERS_HTML" "users copy filter link button" 'data-testid="users-copy-filter-link-button"'
check_contains "$USERS_HTML" "users save view button" 'data-testid="users-save-view-button"'
check_contains "$USERS_HTML" "users update current view button" 'data-testid="users-update-current-view-button"'
check_contains "$USERS_HTML" "users saved views list" 'data-testid="users-saved-views-list"'
check_contains "$USERS_HTML" "users saved views search" 'data-testid="users-saved-views-search"'
check_contains "$USERS_HTML" "users saved views source filter" 'data-testid="users-saved-views-source-filter"'
check_contains "$USERS_HTML" "users saved views sort" 'data-testid="users-saved-views-sort"'
check_contains "$USERS_HTML" "users export saved views button" 'data-testid="users-export-saved-views-button"'
check_contains "$USERS_HTML" "users import saved views button" 'data-testid="users-import-saved-views-button"'
check_contains "$USERS_HTML" "users clear saved views button" 'data-testid="users-clear-saved-views-button"'
check_contains "$USERS_HTML" "users clear imported saved views button" 'data-testid="users-clear-imported-saved-views-button"'
check_contains "$USERS_HTML" "users reset saved views tools button" 'data-testid="users-reset-saved-views-tools-button"'
check_contains "$USERS_HTML" "users bulk selection summary" 'data-testid="users-bulk-selection-summary"'
check_contains "$USERS_HTML" "users bulk card" 'data-testid="users-bulk-card"'
check_contains "$USERS_HTML" "users bulk title" 'data-testid="users-bulk-title"'
check_contains "$USERS_HTML" "users bulk stats" 'data-testid="users-bulk-stats"'
check_contains "$USERS_HTML" "users bulk presets" 'data-testid="users-bulk-presets"'
check_contains "$USERS_HTML" "users bulk action summary" 'data-testid="users-bulk-action-summary"'
check_contains "$USERS_HTML" "users bulk select visible button" 'data-testid="users-bulk-select-visible-button"'
check_contains "$USERS_HTML" "users bulk clear selection button" 'data-testid="users-bulk-clear-selection-button"'
check_contains "$USERS_HTML" "users bulk export selection button" 'data-testid="users-bulk-export-selection-button"'
check_contains "$USERS_HTML" "users bulk export filtered button" 'data-testid="users-bulk-export-filtered-button"'
check_contains "$USERS_HTML" "users bulk select admins button" 'data-testid="users-bulk-select-admins-button"'
check_contains "$USERS_HTML" "users bulk select members button" 'data-testid="users-bulk-select-members-button"'
check_contains "$USERS_HTML" "users bulk select password required button" 'data-testid="users-bulk-select-password-required-button"'
check_contains "$USERS_HTML" "users bulk select current filter button" 'data-testid="users-bulk-select-current-filter-button"'
check_contains "$USERS_HTML" "users bulk reset tools button" 'data-testid="users-bulk-reset-tools-button"'
check_contains "$USERS_HTML" "users bulk preset admin button" 'data-testid="users-bulk-preset-admin-button"'
check_contains "$USERS_HTML" "users bulk preset team button" 'data-testid="users-bulk-preset-team-button"'
check_contains "$USERS_HTML" "users bulk preset trial button" 'data-testid="users-bulk-preset-trial-button"'
check_contains "$USERS_HTML" "users bulk role select" 'data-testid="users-bulk-role-select"'
check_contains "$USERS_HTML" "users bulk role apply button" 'data-testid="users-bulk-role-apply-button"'
check_contains "$USERS_HTML" "users bulk plan select" 'data-testid="users-bulk-plan-select"'
check_contains "$USERS_HTML" "users bulk plan apply button" 'data-testid="users-bulk-plan-apply-button"'
check_contains "$USERS_HTML" "users update current view copy" 'Update current view'
check_contains "$USERS_HTML" "users saved views storage copy" 'Loaded from local browser storage|Using local browser storage'
check_contains "$USERS_HTML" "restore dry run button" 'data-testid="restore-dry-run-button"'
check_contains "$USERS_HTML" "restore report json button" 'data-testid="restore-report-json-button"'
check_contains "$USERS_HTML" "restore report csv button" 'data-testid="restore-report-csv-button"'
check_contains "$USERS_HTML" "backup download bundle button" 'data-testid="backup-download-bundle-button"'
check_contains "$USERS_HTML" "backup paste sample button" 'data-testid="backup-paste-sample-button"'
check_contains "$USERS_HTML" "backup upload file input" 'data-testid="backup-upload-file-input"'
check_contains "$USERS_HTML" "backup clear bundle button" 'data-testid="backup-clear-bundle-button"'
check_contains "$USERS_HTML" "backup preflight banner" 'data-testid="backup-preflight-banner"'
check_contains "$USERS_HTML" "restore dry run disabled" 'data-testid="restore-dry-run-button"[^>]*disabled'
check_contains "$USERS_HTML" "restore report json disabled" 'data-testid="restore-report-json-button"[^>]*disabled'
check_contains "$USERS_HTML" "restore report csv disabled" 'data-testid="restore-report-csv-button"[^>]*disabled'
check_contains "$UPGRADE_HTML" "upgrade requests page title" 'data-testid="upgrade-requests-page-title"'
check_contains "$UPGRADE_HTML" "upgrade smoke banner" 'data-testid="admin-smoke-banner"'
check_contains "$UPGRADE_HTML" "upgrade refresh button" 'data-testid="upgrade-refresh-button"'
check_contains "$UPGRADE_HTML" "upgrade copy link button" 'data-testid="upgrade-copy-link-button"'
check_contains "$UPGRADE_HTML" "upgrade export button" 'data-testid="upgrade-export-button"'
check_contains "$UPGRADE_HTML" "upgrade audit search" 'data-testid="upgrade-audit-search"'
check_contains "$UPGRADE_HTML" "upgrade audit sort" 'data-testid="upgrade-audit-sort"'
check_contains "$UPGRADE_HTML" "upgrade audit copy link button" 'data-testid="upgrade-audit-copy-link-button"'
check_contains "$UPGRADE_HTML" "upgrade audit current export button" 'data-testid="upgrade-audit-current-export-button"'
check_contains "$UPGRADE_HTML" "upgrade audit reset button" 'data-testid="upgrade-audit-reset-button"'
check_contains "$UPGRADE_HTML" "upgrade save audit view button" 'data-testid="upgrade-save-audit-view-button"'
check_contains "$UPGRADE_HTML" "upgrade audit views list" 'data-testid="upgrade-audit-views-list"'
check_contains "$UPGRADE_HTML" "upgrade audit presets copy" 'Audit presets are stored separately from the main inbox saved views'
check_contains "$UPGRADE_HTML" "upgrade reset filters button" 'data-testid="upgrade-reset-filters-button"'
check_contains "$UPGRADE_HTML" "upgrade copy filter link button" 'data-testid="upgrade-copy-filter-link-button"'
check_contains "$UPGRADE_HTML" "upgrade save view button" 'data-testid="upgrade-save-view-button"'
check_contains "$UPGRADE_HTML" "upgrade update current view button" 'data-testid="upgrade-update-current-view-button"'
check_contains "$UPGRADE_HTML" "upgrade saved views list" 'data-testid="upgrade-saved-views-list"'
check_contains "$UPGRADE_HTML" "upgrade saved views search" 'data-testid="upgrade-saved-views-search"'
check_contains "$UPGRADE_HTML" "upgrade saved views source filter" 'data-testid="upgrade-saved-views-source-filter"'
check_contains "$UPGRADE_HTML" "upgrade saved views sort" 'data-testid="upgrade-saved-views-sort"'
check_contains "$UPGRADE_HTML" "upgrade export saved views button" 'data-testid="upgrade-export-saved-views-button"'
check_contains "$UPGRADE_HTML" "upgrade import saved views button" 'data-testid="upgrade-import-saved-views-button"'
check_contains "$UPGRADE_HTML" "upgrade clear saved views button" 'data-testid="upgrade-clear-saved-views-button"'
check_contains "$UPGRADE_HTML" "upgrade clear imported saved views button" 'data-testid="upgrade-clear-imported-saved-views-button"'
check_contains "$UPGRADE_HTML" "upgrade reset saved views tools button" 'data-testid="upgrade-reset-saved-views-tools-button"'
check_contains "$UPGRADE_HTML" "upgrade bulk selection summary" 'data-testid="upgrade-bulk-selection-summary"'
check_contains "$UPGRADE_HTML" "upgrade bulk card" 'data-testid="upgrade-bulk-card"'
check_contains "$UPGRADE_HTML" "upgrade bulk title" 'data-testid="upgrade-bulk-title"'
check_contains "$UPGRADE_HTML" "upgrade bulk stats" 'data-testid="upgrade-bulk-stats"'
check_contains "$UPGRADE_HTML" "upgrade bulk presets" 'data-testid="upgrade-bulk-presets"'
check_contains "$UPGRADE_HTML" "upgrade bulk action summary" 'data-testid="upgrade-bulk-action-summary"'
check_contains "$UPGRADE_HTML" "upgrade bulk select visible button" 'data-testid="upgrade-bulk-select-visible-button"'
check_contains "$UPGRADE_HTML" "upgrade bulk clear selection button" 'data-testid="upgrade-bulk-clear-selection-button"'
check_contains "$UPGRADE_HTML" "upgrade bulk export selection button" 'data-testid="upgrade-bulk-export-selection-button"'
check_contains "$UPGRADE_HTML" "upgrade bulk export filtered button" 'data-testid="upgrade-bulk-export-filtered-button"'
check_contains "$UPGRADE_HTML" "upgrade bulk select new button" 'data-testid="upgrade-bulk-select-new-button"'
check_contains "$UPGRADE_HTML" "upgrade bulk select review button" 'data-testid="upgrade-bulk-select-review-button"'
check_contains "$UPGRADE_HTML" "upgrade bulk select linked button" 'data-testid="upgrade-bulk-select-linked-button"'
check_contains "$UPGRADE_HTML" "upgrade bulk select current filter button" 'data-testid="upgrade-bulk-select-current-filter-button"'
check_contains "$UPGRADE_HTML" "upgrade bulk reset tools button" 'data-testid="upgrade-bulk-reset-tools-button"'
check_contains "$UPGRADE_HTML" "upgrade bulk preset review button" 'data-testid="upgrade-bulk-preset-review-button"'
check_contains "$UPGRADE_HTML" "upgrade bulk preset close button" 'data-testid="upgrade-bulk-preset-close-button"'
check_contains "$UPGRADE_HTML" "upgrade bulk preset reject button" 'data-testid="upgrade-bulk-preset-reject-button"'
check_contains "$UPGRADE_HTML" "upgrade bulk status select" 'data-testid="upgrade-bulk-status-select"'
check_contains "$UPGRADE_HTML" "upgrade bulk status apply button" 'data-testid="upgrade-bulk-status-apply-button"'
check_contains "$UPGRADE_HTML" "upgrade update current view copy" 'Update current view'
check_contains "$UPGRADE_HTML" "upgrade saved views storage copy" 'Loaded from local browser storage|Using local browser storage'

echo "[frontend-smoke] users page rendered"
echo "[frontend-smoke] register page rendered"
echo "[frontend-smoke] backup panel rendered"
echo "[frontend-smoke] backup preflight controls rendered"
echo "[frontend-smoke] disabled states rendered"
echo "[frontend-smoke] admin controls rendered"
echo "[frontend-smoke] saved views rendered"
echo "[frontend-smoke] upgrade requests page rendered"
echo "[frontend-smoke] complete"
