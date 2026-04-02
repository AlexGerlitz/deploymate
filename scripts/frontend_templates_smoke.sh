#!/usr/bin/env bash

set -euo pipefail

PORT="${FRONTEND_SMOKE_PORT:-3001}"
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_LOG="${FRONTEND_SMOKE_LOG:-/tmp/deploymate-frontend-templates-smoke.log}"
DIST_DIR="${FRONTEND_SMOKE_DIST_DIR:-.next-smoke-${PORT}}"
APP_HTML="$(mktemp)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cleanup() {
  if [ -n "${SERVER_PID:-}" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  if [ -n "${DIST_DIR:-}" ] && [ -d "$REPO_ROOT/frontend/$DIST_DIR" ]; then
    rm -rf "$REPO_ROOT/frontend/$DIST_DIR"
  fi
  rm -f "$APP_HTML"
}

trap cleanup EXIT

NEXT_PUBLIC_SMOKE_TEST_MODE=1 NEXT_DIST_DIR="$DIST_DIR" npm --prefix "$REPO_ROOT/frontend" run dev -- --hostname 127.0.0.1 --port "$PORT" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 60); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "[frontend-templates-smoke] dev server exited early" >&2
    cat "$SERVER_LOG" >&2
    exit 1
  fi
  if curl -sS -o /dev/null "$BASE_URL/app"; then
    break
  fi
  sleep 1
done

if ! curl -sS -o /dev/null "$BASE_URL/app"; then
  echo "[frontend-templates-smoke] dev server did not become ready" >&2
  cat "$SERVER_LOG" >&2
  exit 1
fi

curl -sS "$BASE_URL/app" >"$APP_HTML"

check_contains() {
  local label="$1"
  local pattern="$2"

  if ! grep -Eq "$pattern" "$APP_HTML"; then
    echo "[frontend-templates-smoke] missing check: $label" >&2
    exit 1
  fi
}

check_contains "templates card" 'data-testid="templates-card"'
check_contains "templates section title" 'data-testid="templates-section-title"'
check_contains "templates filter tabs" 'data-testid="templates-filter-tabs"'
check_contains "templates filter all" 'data-testid="templates-filter-all"'
check_contains "templates filter unused" 'data-testid="templates-filter-unused"'
check_contains "templates filter recent" 'data-testid="templates-filter-recent"'
check_contains "templates filter popular" 'data-testid="templates-filter-popular"'
check_contains "templates search input" 'data-testid="templates-search-input"'
check_contains "templates list" 'data-testid="templates-list"'
check_contains "smoke template card" 'data-testid="template-card-smoke-template"'
check_contains "template preview button" 'data-testid="template-preview-button-smoke-template"'
check_contains "template deploy button" 'data-testid="template-deploy-button-smoke-template"'
check_contains "template edit button" 'data-testid="template-edit-button-smoke-template"'
check_contains "template duplicate button" 'data-testid="template-duplicate-button-smoke-template"'
check_contains "template delete button" 'data-testid="template-delete-button-smoke-template"'
check_contains "smoke template copy" 'Smoke template'
check_contains "smoke image copy" 'nginx:alpine'
check_contains "template preview card" 'data-testid="template-preview-card"'
check_contains "template preview title" 'data-testid="template-preview-title"'
check_contains "template preview content" 'data-testid="template-preview-diff-list"|data-testid="template-preview-match-banner"'
check_contains "template preview actions" 'data-testid="template-preview-actions"'
check_contains "template preview apply button" 'data-testid="template-preview-apply-button"'
check_contains "template preview edit button" 'data-testid="template-preview-edit-button"'
check_contains "template preview deploy button" 'data-testid="template-preview-deploy-button"'
check_contains "create deployment card" 'data-testid="create-deployment-card"'
check_contains "create deployment title" 'data-testid="create-deployment-title"'
check_contains "template name input" 'data-testid="create-template-name-input"'
check_contains "save template button" 'data-testid="create-save-template-button"'
check_contains "create deployment button" 'data-testid="create-deployment-submit-button"'
check_contains "template helper copy" 'Save the current image, name, ports, server, and env vars as a reusable preset\.'

echo "[frontend-templates-smoke] template list rendered"
echo "[frontend-templates-smoke] template preview rendered"
echo "[frontend-templates-smoke] create-form template controls rendered"
echo "[frontend-templates-smoke] complete"
