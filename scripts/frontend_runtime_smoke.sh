#!/usr/bin/env bash

set -euo pipefail

PORT="${FRONTEND_SMOKE_PORT:-3001}"
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_LOG="${FRONTEND_SMOKE_LOG:-/tmp/deploymate-frontend-runtime-smoke.log}"
DIST_DIR="${FRONTEND_SMOKE_DIST_DIR:-.next-smoke-${PORT}}"
APP_HTML="$(mktemp)"
DETAIL_HTML="$(mktemp)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/lib/project_automation.sh"
source "${SCRIPT_DIR}/frontend_smoke_shared.sh"

cleanup() {
  if [ "${FRONTEND_SMOKE_REUSE_SERVER:-0}" != "1" ]; then
    stop_frontend_smoke_server
  fi
  rm -f "$APP_HTML" "$DETAIL_HTML"
}

trap cleanup EXIT

if [ "${FRONTEND_SMOKE_REUSE_SERVER:-0}" != "1" ]; then
  start_frontend_smoke_server
fi

wait_for_frontend_smoke_url "$(automation_frontend_ready_path)"

curl -sS "$BASE_URL$(automation_frontend_ready_path)" >"$APP_HTML"
curl -sS "$BASE_URL$(automation_frontend_runtime_detail_path)" >"$DETAIL_HTML"

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
grep -q 'data-testid="runtime-detail-header-actions"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-copy-summary-button"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-overview-grid"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-endpoint-card"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-runtime-card"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-health-overview-card"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-attention-card"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-attention-banner"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-summary-card"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-quick-reference-card"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-quick-reference-title"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-attention-list-card"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-attention-list-title"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-attention-empty-state"\|data-testid="runtime-detail-attention-list"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-diagnostics-card"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-diagnostics-title"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-diagnostics-badges"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-health-card"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-logs-card"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-activity-card"' "$DETAIL_HTML"
grep -q 'data-testid="runtime-detail-activity-title"' "$DETAIL_HTML"
grep -q 'Smoke VPS' "$DETAIL_HTML"

echo "[frontend-runtime-smoke] app runtime surface rendered"
echo "[frontend-runtime-smoke] deployment detail surface rendered"
echo "[frontend-runtime-smoke] complete"
