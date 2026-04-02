#!/usr/bin/env bash

set -euo pipefail

PORT="${FRONTEND_SMOKE_PORT:-3001}"
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_LOG="${FRONTEND_SMOKE_LOG:-/tmp/deploymate-frontend-runtime-smoke.log}"
APP_HTML="$(mktemp)"
DETAIL_HTML="$(mktemp)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cleanup() {
  if [ -n "${SERVER_PID:-}" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$APP_HTML" "$DETAIL_HTML"
}

trap cleanup EXIT

NEXT_PUBLIC_SMOKE_TEST_MODE=1 npm --prefix "$REPO_ROOT/frontend" run dev -- --hostname 127.0.0.1 --port "$PORT" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 60); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "[frontend-runtime-smoke] dev server exited early" >&2
    cat "$SERVER_LOG" >&2
    exit 1
  fi
  if curl -sS -o /dev/null "$BASE_URL/app"; then
    break
  fi
  sleep 1
done

if ! curl -sS -o /dev/null "$BASE_URL/app"; then
  echo "[frontend-runtime-smoke] dev server did not become ready" >&2
  cat "$SERVER_LOG" >&2
  exit 1
fi

curl -sS "$BASE_URL/app" >"$APP_HTML"
curl -sS "$BASE_URL/deployments/smoke-deployment" >"$DETAIL_HTML"

grep -q 'data-testid="runtime-page-title"' "$APP_HTML"
grep -q 'data-testid="runtime-smoke-banner"' "$APP_HTML"
grep -q 'data-testid="runtime-deployments-section"' "$APP_HTML"
grep -q 'data-testid="runtime-deployments-title"' "$APP_HTML"
grep -q 'data-testid="runtime-deployments-list"' "$APP_HTML"
grep -q 'data-testid="runtime-deployment-card-smoke-deployment"' "$APP_HTML"
grep -q 'data-testid="runtime-deployment-details-link-smoke-deployment"' "$APP_HTML"
grep -q 'smoke-runtime' "$APP_HTML"

grep -q 'data-testid="runtime-detail-page-title"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-smoke-banner"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-summary-card"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-diagnostics-card"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-diagnostics-title"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-health-card"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-logs-card"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-activity-card"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-activity-title"' "$DETAIL_HTML"
grep -q 'Smoke VPS' "$DETAIL_HTML"

echo "[frontend-runtime-smoke] app runtime surface rendered"
echo "[frontend-runtime-smoke] deployment detail surface rendered"
echo "[frontend-runtime-smoke] complete"
