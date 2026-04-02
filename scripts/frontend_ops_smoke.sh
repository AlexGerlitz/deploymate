#!/usr/bin/env bash

set -euo pipefail

PORT="${FRONTEND_SMOKE_PORT:-3001}"
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_LOG="${FRONTEND_SMOKE_LOG:-/tmp/deploymate-frontend-ops-smoke.log}"
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
    echo "[frontend-ops-smoke] dev server exited early" >&2
    cat "$SERVER_LOG" >&2
    exit 1
  fi
  if curl -sS -o /dev/null "$BASE_URL/app"; then
    break
  fi
  sleep 1
done

if ! curl -sS -o /dev/null "$BASE_URL/app"; then
  echo "[frontend-ops-smoke] dev server did not become ready" >&2
  cat "$SERVER_LOG" >&2
  exit 1
fi

curl -sS "$BASE_URL/app" >"$APP_HTML"

check_contains() {
  local label="$1"
  local pattern="$2"

  if ! grep -Eq "$pattern" "$APP_HTML"; then
    echo "[frontend-ops-smoke] missing check: $label" >&2
    exit 1
  fi
}

check_contains "ops overview card" 'data-testid="ops-overview-card"'
check_contains "ops overview header" 'data-testid="ops-overview-header"'
check_contains "ops overview title" 'data-testid="ops-overview-title"'
check_contains "ops overview actions" 'data-testid="ops-overview-actions"'
check_contains "ops copy summary button" 'data-testid="ops-copy-summary-button"'
check_contains "ops download overview button" 'data-testid="ops-download-overview-button"'
check_contains "ops export deployments button" 'data-testid="ops-export-deployments-button"'
check_contains "ops export servers button" 'data-testid="ops-export-servers-button"'
check_contains "ops export templates button" 'data-testid="ops-export-templates-button"'
check_contains "ops export activity button" 'data-testid="ops-export-activity-button"'
check_contains "ops overview grid" 'data-testid="ops-overview-grid"'
check_contains "ops deployments card" 'data-testid="ops-overview-deployments-card"'
check_contains "ops servers card" 'data-testid="ops-overview-servers-card"'
check_contains "ops activity card" 'data-testid="ops-overview-activity-card"'
check_contains "ops templates card" 'data-testid="ops-overview-templates-card"'
check_contains "ops capabilities card" 'data-testid="ops-overview-capabilities-card"'
check_contains "ops attention list or empty banner" 'data-testid="ops-attention-list"|data-testid="ops-attention-empty-banner"'
check_contains "ops smoke deployment count copy" 'Deployments'
check_contains "ops smoke servers copy" 'Servers'
check_contains "ops smoke activity copy" 'Activity'
check_contains "ops smoke templates copy" 'Templates'
check_contains "ops runtime posture copy" 'remote-only|mixed'

echo "[frontend-ops-smoke] ops overview rendered"
echo "[frontend-ops-smoke] ops export actions rendered"
echo "[frontend-ops-smoke] ops attention surface rendered"
echo "[frontend-ops-smoke] complete"
