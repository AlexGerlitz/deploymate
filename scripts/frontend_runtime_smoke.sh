#!/usr/bin/env bash

set -euo pipefail

PORT="${FRONTEND_SMOKE_PORT:-3001}"
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_LOG="${FRONTEND_SMOKE_LOG:-/tmp/deploymate-frontend-runtime-smoke.log}"
DIST_DIR="${FRONTEND_SMOKE_DIST_DIR:-.next-smoke-${PORT}}"
APP_HTML="$(mktemp)"
DETAIL_HTML="$(mktemp)"
FAILED_DETAIL_HTML="$(mktemp)"
HEALTHY_WORKFLOW_HTML="$(mktemp)"
FAILED_WORKFLOW_HTML="$(mktemp)"
INTERNAL_DETAIL_HTML="$(mktemp)"
INTERNAL_WORKFLOW_HTML="$(mktemp)"
TEMPLATE_SUCCESS_WORKFLOW_HTML="$(mktemp)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/lib/project_automation.sh"
source "${SCRIPT_DIR}/lib/frontend_smoke_checks.sh"
source "${SCRIPT_DIR}/frontend_smoke_shared.sh"

cleanup() {
  if [ "${FRONTEND_SMOKE_REUSE_SERVER:-0}" != "1" ]; then
    stop_frontend_smoke_server
  fi
  rm -f "$APP_HTML" "$DETAIL_HTML" "$FAILED_DETAIL_HTML" "$HEALTHY_WORKFLOW_HTML" "$FAILED_WORKFLOW_HTML" "$INTERNAL_DETAIL_HTML" "$INTERNAL_WORKFLOW_HTML" "$TEMPLATE_SUCCESS_WORKFLOW_HTML"
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

if ! grep -Eq '(<a[^>]*data-testid="runtime-deployment-details-link-review-worker"[^>]*class="[^"]*landingButton primaryButton[^"]*")|(<a[^>]*class="[^"]*landingButton primaryButton[^"]*"[^>]*data-testid="runtime-deployment-details-link-review-worker")' "$APP_HTML"; then
  echo "[frontend-runtime-smoke] failed runtime queue does not make review the primary card action" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-deployment-details-link-review-worker"[^>]*>Review runtime issues<' "$APP_HTML"; then
  echo "[frontend-runtime-smoke] failed runtime queue lost the explicit runtime review action label" >&2
  exit 1
fi

if ! grep -Eq '(<a[^>]*data-testid="runtime-deployment-open-app-link-smoke-deployment"[^>]*class="[^"]*landingButton primaryButton[^"]*")|(<a[^>]*class="[^"]*landingButton primaryButton[^"]*"[^>]*data-testid="runtime-deployment-open-app-link-smoke-deployment")' "$APP_HTML"; then
  echo "[frontend-runtime-smoke] healthy secondary runtime queue card does not make opening the app primary" >&2
  exit 1
fi

if ! grep -Eq '(<a[^>]*data-testid="runtime-deployment-details-link-smoke-deployment"[^>]*class="[^"]*secondaryButton[^"]*")|(<a[^>]*class="[^"]*secondaryButton[^"]*"[^>]*data-testid="runtime-deployment-details-link-smoke-deployment")' "$APP_HTML"; then
  echo "[frontend-runtime-smoke] healthy secondary runtime queue card does not keep details secondary" >&2
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

curl -sS "${BASE_URL}/deployments/internal-runtime" > "$INTERNAL_DETAIL_HTML"
if ! grep -Eq 'data-testid="runtime-detail-main-next-step-action-focus"[^>]*>Review stable runtime<' "$INTERNAL_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] internal-only runtime detail does not make stable review the main next step" >&2
  exit 1
fi

if grep -Eq 'data-testid="runtime-detail-main-next-step-action-focus"[^>]*>(Prepare rollout change|Open running app)<' "$INTERNAL_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] internal-only runtime detail exposes a non-review main next step" >&2
  exit 1
fi

if ! grep -Eq 'No public URL assigned yet' "$INTERNAL_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] internal-only runtime detail lost the private-endpoint explanation" >&2
  exit 1
fi

(
  set -euo pipefail
  source "${SCRIPT_DIR}/frontend_smoke_shared.sh"

  export PORT="${FRONTEND_SMOKE_HEALTHY_RUNTIME_PORT:-3011}"
  export BASE_URL="http://127.0.0.1:${PORT}"
  export SERVER_LOG="${FRONTEND_SMOKE_HEALTHY_RUNTIME_LOG:-/tmp/deploymate-frontend-healthy-runtime-smoke.log}"
  export DIST_DIR="${FRONTEND_SMOKE_HEALTHY_RUNTIME_DIST_DIR:-.next-smoke-healthy-runtime-${PORT}}"
  export FRONTEND_SMOKE_PORT="$PORT"
  export FRONTEND_SMOKE_LOG="$SERVER_LOG"
  export FRONTEND_SMOKE_DIST_DIR="$DIST_DIR"
  export FRONTEND_SMOKE_REUSE_SERVER=0
  export NEXT_PUBLIC_SMOKE_DEPLOYMENT_WORKFLOW_SCENARIO=healthy-live-review

  cleanup_healthy_runtime() {
    stop_frontend_smoke_server
  }

  trap cleanup_healthy_runtime EXIT

  start_frontend_smoke_server
  wait_for_frontend_smoke_url "/app/deployment-workflow"

  curl -sS "${BASE_URL}/app/deployment-workflow" > "$HEALTHY_WORKFLOW_HTML"

  if ! grep -Eq 'data-testid="runtime-deployment-card-smoke-deployment"' "$HEALTHY_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] healthy workflow scenario lost the smoke deployment card" >&2
    exit 1
  fi

  if ! grep -Eq '(<a[^>]*data-testid="runtime-deployment-open-app-link-smoke-deployment"[^>]*class="[^"]*landingButton primaryButton[^"]*")|(<a[^>]*class="[^"]*landingButton primaryButton[^"]*"[^>]*data-testid="runtime-deployment-open-app-link-smoke-deployment")' "$HEALTHY_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] healthy workflow does not make opening the app the primary queue action" >&2
    exit 1
  fi

  if ! grep -Eq '(<a[^>]*data-testid="runtime-deployment-details-link-smoke-deployment"[^>]*class="[^"]*secondaryButton[^"]*")|(<a[^>]*class="[^"]*secondaryButton[^"]*"[^>]*data-testid="runtime-deployment-details-link-smoke-deployment")' "$HEALTHY_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] healthy workflow does not keep detail review secondary after open app" >&2
    exit 1
  fi
)

(
  set -euo pipefail
  source "${SCRIPT_DIR}/frontend_smoke_shared.sh"

  export PORT="${FRONTEND_SMOKE_FAILED_RUNTIME_PORT:-3012}"
  export BASE_URL="http://127.0.0.1:${PORT}"
  export SERVER_LOG="${FRONTEND_SMOKE_FAILED_RUNTIME_LOG:-/tmp/deploymate-frontend-failed-runtime-smoke.log}"
  export DIST_DIR="${FRONTEND_SMOKE_FAILED_RUNTIME_DIST_DIR:-.next-smoke-failed-runtime-${PORT}}"
  export FRONTEND_SMOKE_PORT="$PORT"
  export FRONTEND_SMOKE_LOG="$SERVER_LOG"
  export FRONTEND_SMOKE_DIST_DIR="$DIST_DIR"
  export FRONTEND_SMOKE_REUSE_SERVER=0
  export NEXT_PUBLIC_SMOKE_DEPLOYMENT_WORKFLOW_SCENARIO=failed-live-review

  cleanup_failed_runtime() {
    stop_frontend_smoke_server
  }

  trap cleanup_failed_runtime EXIT

  start_frontend_smoke_server
  wait_for_frontend_smoke_url "/app/deployment-workflow"

  curl -sS "${BASE_URL}/app/deployment-workflow" > "$FAILED_WORKFLOW_HTML"

  if ! grep -Eq '(<a[^>]*data-testid="runtime-deployment-details-link-review-worker-shadow"[^>]*class="[^"]*landingButton primaryButton[^"]*")|(<a[^>]*class="[^"]*landingButton primaryButton[^"]*"[^>]*data-testid="runtime-deployment-details-link-review-worker-shadow")' "$FAILED_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] failed secondary runtime queue card does not make review the primary action" >&2
    exit 1
  fi

  if ! grep -Eq 'data-testid="runtime-deployment-details-link-review-worker-shadow"[^>]*>Review runtime issues<' "$FAILED_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] failed secondary runtime queue card lost the explicit review action label" >&2
    exit 1
  fi
)

(
  set -euo pipefail
  source "${SCRIPT_DIR}/frontend_smoke_shared.sh"

  export PORT="${FRONTEND_SMOKE_INTERNAL_RUNTIME_PORT:-3013}"
  export BASE_URL="http://127.0.0.1:${PORT}"
  export SERVER_LOG="${FRONTEND_SMOKE_INTERNAL_RUNTIME_LOG:-/tmp/deploymate-frontend-internal-runtime-smoke.log}"
  export DIST_DIR="${FRONTEND_SMOKE_INTERNAL_RUNTIME_DIST_DIR:-.next-smoke-internal-runtime-${PORT}}"
  export FRONTEND_SMOKE_PORT="$PORT"
  export FRONTEND_SMOKE_LOG="$SERVER_LOG"
  export FRONTEND_SMOKE_DIST_DIR="$DIST_DIR"
  export FRONTEND_SMOKE_REUSE_SERVER=0
  export NEXT_PUBLIC_SMOKE_DEPLOYMENT_WORKFLOW_SCENARIO=internal-only-live-review

  cleanup_internal_runtime() {
    stop_frontend_smoke_server
  }

  trap cleanup_internal_runtime EXIT

  start_frontend_smoke_server
  wait_for_frontend_smoke_url "/app/deployment-workflow"

  curl -sS "${BASE_URL}/app/deployment-workflow" > "$INTERNAL_WORKFLOW_HTML"

  if ! grep -Eq '(<a[^>]*data-testid="runtime-deployment-details-link-internal-runtime"[^>]*class="[^"]*landingButton primaryButton[^"]*")|(<a[^>]*class="[^"]*landingButton primaryButton[^"]*"[^>]*data-testid="runtime-deployment-details-link-internal-runtime")' "$INTERNAL_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] internal-only focus runtime queue card does not make stable review primary" >&2
    exit 1
  fi

  if ! grep -Eq 'data-testid="runtime-deployment-details-link-internal-runtime"[^>]*>Review stable runtime<' "$INTERNAL_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] internal-only focus runtime queue card lost the stable review label" >&2
    exit 1
  fi

  if grep -Eq 'data-testid="runtime-deployment-open-app-link-internal-runtime"' "$INTERNAL_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] internal-only focus runtime queue card should not expose open app" >&2
    exit 1
  fi

  if ! grep -Eq '(<a[^>]*data-testid="runtime-deployment-details-link-internal-runtime-shadow"[^>]*class="[^"]*landingButton primaryButton[^"]*")|(<a[^>]*class="[^"]*landingButton primaryButton[^"]*"[^>]*data-testid="runtime-deployment-details-link-internal-runtime-shadow")' "$INTERNAL_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] internal-only secondary runtime queue card does not make stable review primary" >&2
    exit 1
  fi

  if ! grep -Eq 'data-testid="runtime-deployment-details-link-internal-runtime-shadow"[^>]*>Review stable runtime<' "$INTERNAL_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] internal-only secondary runtime queue card lost the stable review label" >&2
    exit 1
  fi

  if grep -Eq 'data-testid="runtime-deployment-open-app-link-internal-runtime-shadow"' "$INTERNAL_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] internal-only secondary runtime queue card should not expose open app" >&2
    exit 1
  fi
)

(
  set -euo pipefail
  source "${SCRIPT_DIR}/frontend_smoke_shared.sh"

  export PORT="${FRONTEND_SMOKE_TEMPLATE_SUCCESS_PORT:-3014}"
  export BASE_URL="http://127.0.0.1:${PORT}"
  export SERVER_LOG="${FRONTEND_SMOKE_TEMPLATE_SUCCESS_LOG:-/tmp/deploymate-frontend-template-success-smoke.log}"
  export DIST_DIR="${FRONTEND_SMOKE_TEMPLATE_SUCCESS_DIST_DIR:-.next-smoke-template-success-${PORT}}"
  export FRONTEND_SMOKE_PORT="$PORT"
  export FRONTEND_SMOKE_LOG="$SERVER_LOG"
  export FRONTEND_SMOKE_DIST_DIR="$DIST_DIR"
  export FRONTEND_SMOKE_REUSE_SERVER=0
  export NEXT_PUBLIC_SMOKE_DEPLOYMENT_WORKFLOW_SCENARIO=template-deploy-success

  cleanup_template_success() {
    stop_frontend_smoke_server
  }

  trap cleanup_template_success EXIT

  start_frontend_smoke_server
  wait_for_frontend_smoke_url "/app/deployment-workflow"

  curl -sS "${BASE_URL}/app/deployment-workflow" > "$TEMPLATE_SUCCESS_WORKFLOW_HTML"

  if ! grep -Eq 'data-testid="template-deploy-success-banner"' "$TEMPLATE_SUCCESS_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] template deploy success scenario lost the success banner" >&2
    exit 1
  fi

  if ! grep -Eq '(<a[^>]*data-testid="template-deploy-success-open-detail-link"[^>]*class="[^"]*landingButton primaryButton[^"]*")|(<a[^>]*class="[^"]*landingButton primaryButton[^"]*"[^>]*data-testid="template-deploy-success-open-detail-link")' "$TEMPLATE_SUCCESS_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] template deploy success does not make runtime detail the primary action" >&2
    exit 1
  fi

  if ! grep -Eq 'data-testid="template-deploy-success-open-detail-link"[^>]*>Open runtime detail<' "$TEMPLATE_SUCCESS_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] template deploy success lost the explicit runtime-detail action label" >&2
    exit 1
  fi

  if ! grep -Eq '(<button[^>]*data-testid="template-deploy-success-open-live-button"[^>]*class="[^"]*secondaryButton[^"]*")|(<button[^>]*class="[^"]*secondaryButton[^"]*"[^>]*data-testid="template-deploy-success-open-live-button")' "$TEMPLATE_SUCCESS_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] template deploy success does not keep live queue review secondary" >&2
    exit 1
  fi
)

echo "[frontend-runtime-smoke] app runtime surface rendered"
echo "[frontend-runtime-smoke] deployment detail surface rendered"
echo "[frontend-runtime-smoke] internal-only runtime detail rendered"
echo "[frontend-runtime-smoke] healthy workflow happy path rendered"
echo "[frontend-runtime-smoke] failed secondary workflow review path rendered"
echo "[frontend-runtime-smoke] internal-only workflow review path rendered"
echo "[frontend-runtime-smoke] template deploy success path rendered"
echo "[frontend-runtime-smoke] complete"
