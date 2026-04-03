#!/usr/bin/env bash

set -euo pipefail

PORT="${FRONTEND_SMOKE_PORT:-3001}"
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_LOG="${FRONTEND_SMOKE_LOG:-/tmp/deploymate-frontend-servers-smoke.log}"
DIST_DIR="${FRONTEND_SMOKE_DIST_DIR:-.next-smoke-${PORT}}"
APP_HTML="$(mktemp)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
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

wait_for_frontend_smoke_url "/app"

curl -sS "$BASE_URL/app" >"$APP_HTML"

check_contains() {
  local label="$1"
  local pattern="$2"

  if ! grep -Eq "$pattern" "$APP_HTML"; then
    echo "[frontend-servers-smoke] missing check: $label" >&2
    exit 1
  fi
}

check_contains "servers card" 'data-testid="servers-card"'
check_contains "servers title" 'data-testid="servers-title"'
check_contains "servers search input" 'data-testid="servers-search-input"|data-testid="servers-restricted-banner"'
check_contains "servers create form or restricted banner" 'data-testid="servers-create-form"|data-testid="servers-restricted-banner"'
check_contains "servers create name input" 'data-testid="servers-create-name-input"|data-testid="servers-restricted-banner"'
check_contains "servers create host input" 'data-testid="servers-create-host-input"|data-testid="servers-restricted-banner"'
check_contains "servers create port input" 'data-testid="servers-create-port-input"|data-testid="servers-restricted-banner"'
check_contains "servers create username input" 'data-testid="servers-create-username-input"|data-testid="servers-restricted-banner"'
check_contains "servers create auth input" 'data-testid="servers-create-auth-type-input"|data-testid="servers-restricted-banner"'
check_contains "servers create ssh key input" 'data-testid="servers-create-ssh-key-input"|data-testid="servers-restricted-banner"'
check_contains "servers create submit button" 'data-testid="servers-create-submit-button"|data-testid="servers-restricted-banner"'
check_contains "servers list" 'data-testid="servers-list"|data-testid="servers-restricted-banner"'
check_contains "smoke server card or restricted banner" 'data-testid="server-card-smoke-server"|data-testid="servers-restricted-banner"'
check_contains "server test button or restricted banner" 'data-testid="server-test-button-smoke-server"|data-testid="servers-restricted-banner"'
check_contains "server diagnostics button or restricted banner" 'data-testid="server-diagnostics-button-smoke-server"|data-testid="servers-restricted-banner"'
check_contains "server delete button or restricted banner" 'data-testid="server-delete-button-smoke-server"|data-testid="servers-restricted-banner"'
check_contains "server diagnostics summary or restricted banner" 'data-testid="server-diagnostics-summary-smoke-server"|data-testid="servers-restricted-banner"'
check_contains "server diagnostics meta or restricted banner" 'data-testid="server-diagnostics-meta-smoke-server"|data-testid="servers-restricted-banner"'
check_contains "smoke server copy" 'Smoke VPS'
check_contains "smoke server host copy" '203\.0\.113\.10'

echo "[frontend-servers-smoke] server management surface rendered"
echo "[frontend-servers-smoke] diagnostics surface rendered"
echo "[frontend-servers-smoke] complete"
