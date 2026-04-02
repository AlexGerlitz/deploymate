#!/usr/bin/env bash

set -euo pipefail

PORT="${FRONTEND_SMOKE_PORT:-3001}"
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_LOG="${FRONTEND_SMOKE_LOG:-/tmp/deploymate-frontend-restore-smoke.log}"
USERS_HTML="$(mktemp)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cleanup() {
  if [ -n "${SERVER_PID:-}" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$USERS_HTML"
}

trap cleanup EXIT

NEXT_PUBLIC_SMOKE_TEST_MODE=1 NEXT_PUBLIC_SMOKE_RESTORE_REPORT=1 \
  npm --prefix "$REPO_ROOT/frontend" run dev -- --hostname 127.0.0.1 --port "$PORT" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 60); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "[frontend-restore-smoke] dev server exited early" >&2
    cat "$SERVER_LOG" >&2
    exit 1
  fi
  if curl -sS -o /dev/null "$BASE_URL/app/users"; then
    break
  fi
  sleep 1
done

if ! curl -sS -o /dev/null "$BASE_URL/app/users"; then
  echo "[frontend-restore-smoke] dev server did not become ready" >&2
  cat "$SERVER_LOG" >&2
  exit 1
fi

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
