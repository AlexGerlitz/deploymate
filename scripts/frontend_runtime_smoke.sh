#!/usr/bin/env bash

set -euo pipefail

PORT="${FRONTEND_SMOKE_PORT:-3001}"
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_LOG="${FRONTEND_SMOKE_LOG:-/tmp/deploymate-frontend-runtime-smoke.log}"
DIST_DIR="${FRONTEND_SMOKE_DIST_DIR:-.next-smoke-${PORT}}"
APP_HTML="$(mktemp)"
DETAIL_HTML="$(mktemp)"
FAILED_DETAIL_HTML="$(mktemp)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/lib/project_automation.sh"
source "${SCRIPT_DIR}/lib/frontend_smoke_checks.sh"
source "${SCRIPT_DIR}/frontend_smoke_shared.sh"

cleanup() {
  if [ "${FRONTEND_SMOKE_REUSE_SERVER:-0}" != "1" ]; then
    stop_frontend_smoke_server
  fi
  rm -f "$APP_HTML" "$DETAIL_HTML" "$FAILED_DETAIL_HTML"
}

trap cleanup EXIT

if [ "${FRONTEND_SMOKE_REUSE_SERVER:-0}" != "1" ]; then
  start_frontend_smoke_server
fi

wait_for_frontend_smoke_url "$(automation_frontend_ready_path)"
frontend_smoke_assert_checks "frontend-runtime-smoke" "$BASE_URL" automation_smoke_runtime_checks

curl -sS "${BASE_URL}/deployments/smoke-deployment" > "$DETAIL_HTML"
if ! grep -Eq 'data-testid="runtime-detail-main-next-step-action-focus"[^>]*>Open running app<' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] healthy runtime detail does not make opening the app the main next step" >&2
  exit 1
fi

if grep -Eq 'data-testid="runtime-detail-main-next-step-action-focus"[^>]*>Prepare rollout change<' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] healthy runtime detail still makes rollout change the main next step" >&2
  exit 1
fi

curl -sS "${BASE_URL}/app/deployment-workflow" > "$APP_HTML"
if grep -Eq 'data-testid="runtime-deployment-delete-button-review-worker"' "$APP_HTML"; then
  echo "[frontend-runtime-smoke] failed runtime queue exposes delete before detail review" >&2
  exit 1
fi

curl -sS "${BASE_URL}/deployments/review-worker" > "$FAILED_DETAIL_HTML"
if ! grep -Eq 'data-testid="runtime-detail-main-next-step-action-focus"[^>]*>Review runtime issues<' "$FAILED_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] failed runtime detail is not review-first" >&2
  exit 1
fi

if grep -Eq 'data-testid="runtime-detail-main-next-step-action-focus"[^>]*>(Prepare rollout change|Open running app)<' "$FAILED_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] failed runtime detail exposes a non-review main next step" >&2
  exit 1
fi

echo "[frontend-runtime-smoke] app runtime surface rendered"
echo "[frontend-runtime-smoke] deployment detail surface rendered"
echo "[frontend-runtime-smoke] complete"
