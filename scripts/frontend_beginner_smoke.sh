#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

run_beginner_export_payload_smoke() {
  (
    set -euo pipefail
    cd "$REPO_ROOT"

    node --experimental-default-type=module --input-type=module <<'NODE'
import { buildAccessControlledRuntimeExportPayload } from "./frontend/app/lib/runtime-workspace-utils.js";
import {
  smokeActivity,
  smokeDeployments,
  smokeDiagnostics,
  smokeHealth,
} from "./frontend/app/lib/smoke-fixtures.js";

const payload = buildAccessControlledRuntimeExportPayload({
  deployment: smokeDeployments[0],
  health: smokeHealth,
  diagnostics: smokeDiagnostics,
  activity: [
    ...smokeActivity,
    {
      id: "server-leak-regression",
      deployment_id: "smoke-deployment",
      level: "warn",
      title: "Smoke VPS target changed",
      message: "deploy@smoke.example.com:22 uses smoke-server for diagnostics.",
      created_at: "2026-04-02T00:04:00Z",
      category: "diagnostics",
    },
  ],
  attentionItems: [
    {
      key: "server-leak-regression",
      label: "Smoke VPS",
      status: "warn",
      message: "deploy@smoke.example.com:22 needs review.",
    },
  ],
  suggestedPorts: [38080, 38081],
  canAccessServers: false,
});

const serialized = JSON.stringify(payload);
const forbidden = [
  '"server_name"',
  '"server_host"',
  '"server_id"',
  "Smoke VPS",
  "deploy@smoke.example.com:22",
  "smoke-server",
];

for (const value of forbidden) {
  if (serialized.includes(value)) {
    throw new Error(`member export payload leaked ${value}`);
  }
}

if (!serialized.includes("Managed by an admin")) {
  throw new Error("member export payload lost the admin-managed target marker");
}

if (!Array.isArray(payload.suggestedPorts) || payload.suggestedPorts.length !== 0) {
  throw new Error("member export payload leaked remote suggested ports");
}
NODE
  )
}

run_beginner_admin_smoke() {
  (
    set -euo pipefail
    source "${SCRIPT_DIR}/frontend_smoke_shared.sh"
    source "${SCRIPT_DIR}/lib/frontend_smoke_checks.sh"

    export PORT="${FRONTEND_SMOKE_BEGINNER_ADMIN_PORT:-3005}"
    export BASE_URL="http://127.0.0.1:${PORT}"
    export SERVER_LOG="${FRONTEND_SMOKE_BEGINNER_ADMIN_LOG:-/tmp/deploymate-frontend-beginner-admin-smoke.log}"
    export DIST_DIR="${FRONTEND_SMOKE_BEGINNER_ADMIN_DIST_DIR:-.next-smoke-beginner-admin-${PORT}}"
    export FRONTEND_SMOKE_PORT="$PORT"
    export FRONTEND_SMOKE_LOG="$SERVER_LOG"
    export FRONTEND_SMOKE_DIST_DIR="$DIST_DIR"
    export FRONTEND_SMOKE_REUSE_SERVER=0
    export NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0

    cleanup_admin() {
      stop_frontend_smoke_server
    }

    trap cleanup_admin EXIT

    start_frontend_smoke_server
    wait_for_frontend_smoke_url "/app"
    frontend_smoke_assert_checks "frontend-beginner-admin-smoke" "$BASE_URL" automation_smoke_beginner_admin_checks
  )
}

run_beginner_member_smoke() {
  (
    set -euo pipefail
    source "${SCRIPT_DIR}/frontend_smoke_shared.sh"
    source "${SCRIPT_DIR}/lib/frontend_smoke_checks.sh"

    export PORT="${FRONTEND_SMOKE_BEGINNER_MEMBER_PORT:-3006}"
    export BASE_URL="http://127.0.0.1:${PORT}"
    export SERVER_LOG="${FRONTEND_SMOKE_BEGINNER_MEMBER_LOG:-/tmp/deploymate-frontend-beginner-member-smoke.log}"
    export DIST_DIR="${FRONTEND_SMOKE_BEGINNER_MEMBER_DIST_DIR:-.next-smoke-beginner-member-${PORT}}"
    export FRONTEND_SMOKE_PORT="$PORT"
    export FRONTEND_SMOKE_LOG="$SERVER_LOG"
    export FRONTEND_SMOKE_DIST_DIR="$DIST_DIR"
    export FRONTEND_SMOKE_REUSE_SERVER=0
    export NEXT_PUBLIC_SMOKE_USER_ROLE=member
    export NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0

    cleanup_member() {
      stop_frontend_smoke_server
    }

    trap cleanup_member EXIT

    start_frontend_smoke_server
    wait_for_frontend_smoke_url "/app"
    frontend_smoke_assert_checks "frontend-beginner-member-smoke" "$BASE_URL" automation_smoke_beginner_member_checks

    member_html="$(mktemp)"
    curl -sS "${BASE_URL}/app/server-review" > "$member_html"
    if grep -Eq 'data-testid="server-review-create-card"|data-testid="server-review-create-server"|data-testid="server-review-blocked-workflow-link"' "$member_html"; then
      echo "[frontend-beginner-member-smoke] member remote-only path leaked admin controls or a false workflow CTA" >&2
      rm -f "$member_html"
      exit 1
    fi

    workflow_html="$(mktemp)"
    curl -sS "${BASE_URL}/app/deployment-workflow" > "$workflow_html"
    if grep -Eq 'data-testid="create-deployment-card"|data-testid="create-deployment-submit-button"|data-testid="templates-card"|data-testid="template-delete-button-' "$workflow_html"; then
      echo "[frontend-beginner-member-smoke] member remote-only workflow leaked blocked create/template controls" >&2
      rm -f "$member_html" "$workflow_html"
      exit 1
    fi

    if grep -Eq 'Ops Batch|ops-batch\.demo\.example\.com' "$workflow_html"; then
      echo "[frontend-beginner-member-smoke] member remote-only workflow leaked admin-managed server identity" >&2
      rm -f "$member_html" "$workflow_html"
      exit 1
    fi

    detail_html="$(mktemp)"
    failed_detail_html="$(mktemp)"
    curl -sS "${BASE_URL}/deployments/smoke-deployment" > "$detail_html"
    curl -sS "${BASE_URL}/deployments/review-worker" > "$failed_detail_html"
    if grep -Eq 'data-testid="runtime-detail-tab-change"|data-testid="runtime-detail-redeploy-review-button"|data-testid="runtime-detail-delete-review-button"|data-testid="runtime-detail-delete-confirm-button"' "$detail_html" "$failed_detail_html"; then
      echo "[frontend-beginner-member-smoke] member runtime detail leaked mutation or destructive controls" >&2
      rm -f "$member_html" "$workflow_html" "$detail_html" "$failed_detail_html"
      exit 1
    fi

    if grep -Eq 'Smoke VPS' "$detail_html"; then
      echo "[frontend-beginner-member-smoke] member healthy runtime detail leaked admin-managed server label" >&2
      rm -f "$member_html" "$workflow_html" "$detail_html" "$failed_detail_html"
      exit 1
    fi

    if grep -Eq 'Ops Batch|ops-batch\.demo\.example\.com' "$failed_detail_html"; then
      echo "[frontend-beginner-member-smoke] member failed runtime detail leaked admin-managed server identity" >&2
      rm -f "$member_html" "$workflow_html" "$detail_html" "$failed_detail_html"
      exit 1
    fi

    if ! grep -Eq 'data-testid="runtime-detail-main-next-step-action-focus"[^>]*>Open running app<' "$detail_html"; then
      echo "[frontend-beginner-member-smoke] member healthy runtime detail lost the safe open-app next step" >&2
      rm -f "$member_html" "$workflow_html" "$detail_html" "$failed_detail_html"
      exit 1
    fi

    if ! grep -Eq 'data-testid="runtime-detail-main-next-step-action-focus"[^>]*>Review runtime issues<' "$failed_detail_html"; then
      echo "[frontend-beginner-member-smoke] member failed runtime detail lost the review-first next step" >&2
      rm -f "$member_html" "$workflow_html" "$detail_html" "$failed_detail_html"
      exit 1
    fi

    rm -f "$member_html"
    rm -f "$workflow_html" "$detail_html" "$failed_detail_html"
  )
}

run_beginner_first_deploy_smoke() {
  (
    set -euo pipefail
    source "${SCRIPT_DIR}/frontend_smoke_shared.sh"
    source "${SCRIPT_DIR}/lib/frontend_smoke_checks.sh"

    export PORT="${FRONTEND_SMOKE_BEGINNER_FIRST_DEPLOY_PORT:-3007}"
    export BASE_URL="http://127.0.0.1:${PORT}"
    export SERVER_LOG="${FRONTEND_SMOKE_BEGINNER_FIRST_DEPLOY_LOG:-/tmp/deploymate-frontend-beginner-first-deploy-smoke.log}"
    export DIST_DIR="${FRONTEND_SMOKE_BEGINNER_FIRST_DEPLOY_DIST_DIR:-.next-smoke-beginner-first-deploy-${PORT}}"
    export FRONTEND_SMOKE_PORT="$PORT"
    export FRONTEND_SMOKE_LOG="$SERVER_LOG"
    export FRONTEND_SMOKE_DIST_DIR="$DIST_DIR"
    export FRONTEND_SMOKE_REUSE_SERVER=0
    export NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0
    export NEXT_PUBLIC_SMOKE_DEPLOYMENT_WORKFLOW_SCENARIO=first-deploy-after-server-review

    cleanup_first_deploy() {
      stop_frontend_smoke_server
    }

    trap cleanup_first_deploy EXIT

    start_frontend_smoke_server
    wait_for_frontend_smoke_url "/app"

    first_deploy_html="$(mktemp)"
    curl -sS "${BASE_URL}/app/deployment-workflow" > "$first_deploy_html"

    if ! grep -Eq 'Step 1 is done on' "$first_deploy_html"; then
      echo "[frontend-beginner-first-deploy-smoke] server-ready lead is missing" >&2
      rm -f "$first_deploy_html"
      exit 1
    fi

    if ! grep -Eq 'data-testid="deployment-workflow-main-next-step-button">Create deployment<' "$first_deploy_html"; then
      echo "[frontend-beginner-first-deploy-smoke] create lane is not the main next step" >&2
      rm -f "$first_deploy_html"
      exit 1
    fi

    if grep -Eq 'data-testid="deployment-workflow-main-next-step-button">Open saved setups<' "$first_deploy_html"; then
      echo "[frontend-beginner-first-deploy-smoke] template reuse still hijacks the main next step" >&2
      rm -f "$first_deploy_html"
      exit 1
    fi

    if grep -Eq 'Image is required\.' "$first_deploy_html"; then
      echo "[frontend-beginner-first-deploy-smoke] empty first draft shows a premature validation error" >&2
      rm -f "$first_deploy_html"
      exit 1
    fi

    rm -f "$first_deploy_html"
  )
}

run_beginner_admin_smoke
run_beginner_member_smoke
run_beginner_first_deploy_smoke
run_beginner_export_payload_smoke

echo "[frontend-beginner-smoke] first-time admin path rendered"
echo "[frontend-beginner-smoke] member remote-only blocked path rendered"
echo "[frontend-beginner-smoke] first deploy after server review rendered"
echo "[frontend-beginner-smoke] member export payload sanitized"
echo "[frontend-beginner-smoke] complete"
