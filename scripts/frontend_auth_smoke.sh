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

wait_for_frontend_smoke_url "/login"

curl -sS "$BASE_URL/login" >"$LOGIN_HTML"
curl -sS "$BASE_URL/register" >"$REGISTER_HTML"
curl -sS "$BASE_URL/change-password" >"$CHANGE_PASSWORD_HTML"

check_contains() {
  local file="$1"
  local label="$2"
  local pattern="$3"

  if ! grep -Eq "$pattern" "$file"; then
    echo "[frontend-auth-smoke] missing check: $label" >&2
    exit 1
  fi
}

check_contains "$LOGIN_HTML" "login card" 'data-testid="auth-login-card"'
check_contains "$LOGIN_HTML" "login title" 'data-testid="auth-login-title"'
check_contains "$LOGIN_HTML" "login form" 'data-testid="auth-login-form"'
check_contains "$LOGIN_HTML" "login username input" 'data-testid="auth-login-username-input"'
check_contains "$LOGIN_HTML" "login password input" 'data-testid="auth-login-password-input"'
check_contains "$LOGIN_HTML" "login submit button" 'data-testid="auth-login-submit-button"'
check_contains "$LOGIN_HTML" "login help banner" 'data-testid="auth-login-help-banner"'

check_contains "$REGISTER_HTML" "register card" 'data-testid="auth-register-card"'
check_contains "$REGISTER_HTML" "register title" 'data-testid="auth-register-title"'
check_contains "$REGISTER_HTML" "register username input or disabled banner" 'data-testid="auth-register-username-input"|data-testid="auth-register-disabled-banner"'
check_contains "$REGISTER_HTML" "register back link" 'data-testid="auth-register-back-link"'
check_contains "$REGISTER_HTML" "register screen copy" 'Create Trial Account'

check_contains "$CHANGE_PASSWORD_HTML" "change-password card" 'data-testid="auth-change-password-card"'
check_contains "$CHANGE_PASSWORD_HTML" "change-password title" 'data-testid="auth-change-password-title"'
check_contains "$CHANGE_PASSWORD_HTML" "change-password user" 'data-testid="auth-change-password-user"'
check_contains "$CHANGE_PASSWORD_HTML" "change-password required or help banner" 'data-testid="auth-change-password-required-banner"|data-testid="auth-change-password-help-banner"'
check_contains "$CHANGE_PASSWORD_HTML" "change-password form" 'data-testid="auth-change-password-form"'
check_contains "$CHANGE_PASSWORD_HTML" "change-password current input" 'data-testid="auth-change-password-current-input"'
check_contains "$CHANGE_PASSWORD_HTML" "change-password new input" 'data-testid="auth-change-password-new-input"'
check_contains "$CHANGE_PASSWORD_HTML" "change-password confirm input" 'data-testid="auth-change-password-confirm-input"'
check_contains "$CHANGE_PASSWORD_HTML" "change-password submit button" 'data-testid="auth-change-password-submit-button"'
check_contains "$CHANGE_PASSWORD_HTML" "change-password logout button" 'data-testid="auth-change-password-logout-button"'

echo "[frontend-auth-smoke] login page rendered"
echo "[frontend-auth-smoke] register page rendered"
echo "[frontend-auth-smoke] change-password page rendered"
echo "[frontend-auth-smoke] complete"
