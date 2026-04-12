#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

frontend_smoke_browser_bin() {
  if [ -n "${FRONTEND_SMOKE_BROWSER_BIN:-}" ] && [ -x "${FRONTEND_SMOKE_BROWSER_BIN}" ]; then
    printf '%s\n' "${FRONTEND_SMOKE_BROWSER_BIN}"
    return 0
  fi

  for browser in google-chrome chromium chromium-browser; do
    if command -v "$browser" >/dev/null 2>&1; then
      command -v "$browser"
      return 0
    fi
  done

  if [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
    printf '%s\n' "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    return 0
  fi

  echo "[frontend-beginner-smoke] no headless browser found for hydrated DOM checks" >&2
  return 1
}

frontend_smoke_dump_dom() {
  local url="$1"
  local output_file="$2"
  local browser_bin=""

  browser_bin="$(frontend_smoke_browser_bin)"
  "$browser_bin" --headless=new --disable-gpu --dump-dom "$url" >"$output_file" 2>/dev/null
}

assert_first_deploy_handoff_workflow() {
  local smoke_name="$1"
  local html_file="$2"
  local bridge_pattern="$3"
  local handoff_source="$4"

  if ! grep -Eq "$bridge_pattern" "$html_file"; then
    echo "[${smoke_name}] workflow lost the handoff bridge copy" >&2
    return 1
  fi

  if ! grep -Eq 'data-testid="deployment-workflow-hero-primary-action"[^>]*>Set image for first deploy<' "$html_file"; then
    echo "[${smoke_name}] workflow lost the single image-first hero CTA" >&2
    return 1
  fi

  if grep -Eq 'data-testid="deployment-workflow-main-next-step-button"' "$html_file"; then
    echo "[${smoke_name}] workflow still renders a second primary CTA above the fold" >&2
    return 1
  fi

  if ! grep -Eq "data-testid=\"create-deployment-image-input\"[^>]*data-handoff-focus-source=\"${handoff_source}\"" "$html_file"; then
    echo "[${smoke_name}] workflow lost the handoff image-focus marker" >&2
    return 1
  fi

  if grep -Eq 'data-testid="create-deployment-image-input"[^>]*autofocus' "$html_file"; then
    echo "[${smoke_name}] workflow still autofocuses the image field and can scroll past the Step 2 guidance" >&2
    return 1
  fi

  if grep -Eq 'data-testid="deployment-workflow-tab-live"' "$html_file"; then
    echo "[${smoke_name}] live-review tab still appears before the first deployment exists" >&2
    return 1
  fi

  if ! grep -Eq 'data-testid="deployment-workflow-tab-templates"[^>]*>Use saved setup instead<' "$html_file"; then
    echo "[${smoke_name}] template tab did not stay framed as the fallback path" >&2
    return 1
  fi

  if ! grep -Eq 'data-testid="deployment-workflow-first-deploy-templates-note"' "$html_file"; then
    echo "[${smoke_name}] first deploy path lost the explicit template fallback note" >&2
    return 1
  fi

  if ! grep -Eq 'data-testid="create-advanced-toggle-button"[^>]*>Open advanced setup<' "$html_file"; then
    echo "[${smoke_name}] workflow opened advanced setup before the user asked for it" >&2
    return 1
  fi

  if ! grep -Eq '(<section[^>]*data-testid="create-advanced-section"[^>]*hidden)|(<section[^>]*hidden[^>]*data-testid="create-advanced-section")' "$html_file"; then
    echo "[${smoke_name}] workflow lost the collapsed advanced section" >&2
    return 1
  fi

  if grep -Eq 'Image is required\.' "$html_file"; then
    echo "[${smoke_name}] workflow showed a premature validation error" >&2
    return 1
  fi
}

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

    overview_html="$(mktemp)"
    curl -sS "${BASE_URL}/app" > "$overview_html"
    python3 - "$overview_html" <<'PY'
import sys
from pathlib import Path

html = Path(sys.argv[1]).read_text(encoding="utf-8")
required_order = [
    'data-testid="workspace-action-surface"',
    'data-testid="workspace-quick-actions"',
    'data-testid="ops-overview-disclosure"',
]
positions = []
for marker in required_order:
    index = html.find(marker)
    if index == -1:
        raise SystemExit(f"missing marker: {marker}")
    positions.append(index)

if positions != sorted(positions):
    raise SystemExit("overview primary product blocks no longer render before operations depth")
PY
    rm -f "$overview_html"
  )
}

run_beginner_admin_server_ready_smoke() {
  (
    set -euo pipefail
    source "${SCRIPT_DIR}/frontend_smoke_shared.sh"

    export PORT="${FRONTEND_SMOKE_BEGINNER_ADMIN_SERVER_READY_PORT:-3016}"
    export BASE_URL="http://127.0.0.1:${PORT}"
    export SERVER_LOG="${FRONTEND_SMOKE_BEGINNER_ADMIN_SERVER_READY_LOG:-/tmp/deploymate-frontend-beginner-admin-server-ready-smoke.log}"
    export DIST_DIR="${FRONTEND_SMOKE_BEGINNER_ADMIN_SERVER_READY_DIST_DIR:-.next-smoke-beginner-admin-server-ready-${PORT}}"
    export FRONTEND_SMOKE_PORT="$PORT"
    export FRONTEND_SMOKE_LOG="$SERVER_LOG"
    export FRONTEND_SMOKE_DIST_DIR="$DIST_DIR"
    export FRONTEND_SMOKE_REUSE_SERVER=0
    export NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0
    export NEXT_PUBLIC_SMOKE_OVERVIEW_SCENARIO=admin-server-ready-first-deploy
    export NEXT_PUBLIC_SMOKE_DEPLOYMENT_WORKFLOW_SCENARIO=first-deploy-after-overview

    cleanup_admin_server_ready() {
      stop_frontend_smoke_server
    }

    trap cleanup_admin_server_ready EXIT

    start_frontend_smoke_server
    wait_for_frontend_smoke_url "/app"

    overview_html="$(mktemp)"
    curl -sS "${BASE_URL}/app" > "$overview_html"

    if ! grep -Eq 'data-testid="workspace-scenario-action-step-2"[^>]*>Choose app to run<' "$overview_html"; then
      echo "[frontend-beginner-admin-server-ready-smoke] overview did not point the ready-server admin to first deployment" >&2
      rm -f "$overview_html"
      exit 1
    fi

    if ! grep -Eq 'data-testid="workspace-scenario-primary-action"[^>]*>Choose app to run<' "$overview_html"; then
      echo "[frontend-beginner-admin-server-ready-smoke] overview lost the top-level first-deploy action" >&2
      rm -f "$overview_html"
      exit 1
    fi

    if ! grep -Eq 'href="/app/deployment-workflow\?server=smoke-server&amp;source=overview-first-deploy"' "$overview_html"; then
      echo "[frontend-beginner-admin-server-ready-smoke] overview did not preserve the ready server into the first-deploy link" >&2
      rm -f "$overview_html"
      exit 1
    fi

    if grep -Eq 'data-testid="workspace-scenario-action-step-1"[^>]*>Add first server target<' "$overview_html"; then
      echo "[frontend-beginner-admin-server-ready-smoke] overview regressed to server setup after a server was ready" >&2
      rm -f "$overview_html"
      exit 1
    fi

    if ! grep -Eq 'data-testid="workspace-scenario-item-step-1".*Server ready.*already connected' "$overview_html"; then
      echo "[frontend-beginner-admin-server-ready-smoke] overview lost the explicit ready-server demotion copy on Step 1" >&2
      rm -f "$overview_html"
      exit 1
    fi

    if ! grep -Eq 'data-testid="workspace-scenario-action-step-1"[^>]*>Review server setup<' "$overview_html"; then
      echo "[frontend-beginner-admin-server-ready-smoke] overview Step 1 still competes with first deploy instead of staying a review action" >&2
      rm -f "$overview_html"
      exit 1
    fi

    if grep -Eq 'data-testid="workspace-scenario-action-step-2"[^>]*disabled' "$overview_html"; then
      echo "[frontend-beginner-admin-server-ready-smoke] Step 2 stayed blocked after a server was ready" >&2
      rm -f "$overview_html"
      exit 1
    fi

    workflow_html="$(mktemp)"
    frontend_smoke_dump_dom "${BASE_URL}/app/deployment-workflow?server=smoke-server&source=overview-first-deploy" "$workflow_html"

    if ! assert_first_deploy_handoff_workflow \
      "frontend-beginner-admin-server-ready-smoke" \
      "$workflow_html" \
      'selected from Overview' \
      "overview-first-deploy"; then
      rm -f "$overview_html" "$workflow_html"
      exit 1
    fi

    rm -f "$overview_html" "$workflow_html"
  )
}

run_beginner_admin_live_review_smoke() {
  (
    set -euo pipefail
    source "${SCRIPT_DIR}/frontend_smoke_shared.sh"

    export PORT="${FRONTEND_SMOKE_BEGINNER_ADMIN_LIVE_REVIEW_PORT:-3017}"
    export BASE_URL="http://127.0.0.1:${PORT}"
    export SERVER_LOG="${FRONTEND_SMOKE_BEGINNER_ADMIN_LIVE_REVIEW_LOG:-/tmp/deploymate-frontend-beginner-admin-live-review-smoke.log}"
    export DIST_DIR="${FRONTEND_SMOKE_BEGINNER_ADMIN_LIVE_REVIEW_DIST_DIR:-.next-smoke-beginner-admin-live-review-${PORT}}"
    export FRONTEND_SMOKE_PORT="$PORT"
    export FRONTEND_SMOKE_LOG="$SERVER_LOG"
    export FRONTEND_SMOKE_DIST_DIR="$DIST_DIR"
    export FRONTEND_SMOKE_REUSE_SERVER=0
    export NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0
    export NEXT_PUBLIC_SMOKE_OVERVIEW_SCENARIO=admin-live-review

    cleanup_admin_live_review() {
      stop_frontend_smoke_server
    }

    trap cleanup_admin_live_review EXIT

    start_frontend_smoke_server
    wait_for_frontend_smoke_url "/app"

    overview_html="$(mktemp)"
    curl -sS "${BASE_URL}/app" > "$overview_html"

    python3 - "$overview_html" <<'PY'
import sys
from pathlib import Path

html = Path(sys.argv[1]).read_text(encoding="utf-8")

def card(step):
    marker = f'data-testid="workspace-scenario-item-step-{step}"'
    start = html.find(marker)
    if start == -1:
        raise SystemExit(f"missing overview step {step}")
    next_start = html.find('data-testid="workspace-scenario-item-step-', start + len(marker))
    return html[start: next_start if next_start != -1 else len(html)]

def testid_anchor(testid):
    marker = f'data-testid="{testid}"'
    start = html.find(marker)
    if start == -1:
        raise SystemExit(f"missing {testid}")
    end = html.find("</a>", start)
    return html[start: end + len("</a>") if end != -1 else len(html)]

step_two = card(2)
step_three = card(3)
primary_action = testid_anchor("workspace-scenario-primary-action")

if 'data-testid="workspace-primary-task-card"' in step_two:
    raise SystemExit("Step 2 stayed primary after the first deployment existed")

if 'data-testid="workspace-primary-task-card"' not in step_three:
    raise SystemExit("Step 3 did not become primary after the first deployment existed")

if ">Start another deploy<" not in step_two:
    raise SystemExit("Step 2 did not become a secondary another-deploy action")

if ">Review live apps<" not in step_three:
    raise SystemExit("Step 3 did not expose live review as the current action")

if ">Review live apps<" not in primary_action:
    raise SystemExit("overview lost the top-level live-review action after deploy")
PY

    rm -f "$overview_html"
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

    if ! grep -Eq 'data-testid="deployment-workflow-member-live-card"' "$workflow_html"; then
      echo "[frontend-beginner-member-smoke] member remote-only live path lost the live-review guidance card" >&2
      rm -f "$member_html" "$workflow_html"
      exit 1
    fi

    if grep -Eq 'data-testid="deployment-workflow-member-blocked-card"' "$workflow_html"; then
      echo "[frontend-beginner-member-smoke] member remote-only live path still renders the waiting-for-admin card" >&2
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
    admin_managed_detail_html="$(mktemp)"
    curl -sS "${BASE_URL}/deployments/smoke-deployment" > "$detail_html"
    curl -sS "${BASE_URL}/deployments/review-worker" > "$failed_detail_html"
    curl -sS "${BASE_URL}/deployments/admin-managed-runtime" > "$admin_managed_detail_html"
    if grep -Eq 'data-testid="runtime-detail-tab-change"|data-testid="runtime-detail-redeploy-review-button"|data-testid="runtime-detail-delete-review-button"|data-testid="runtime-detail-delete-confirm-button"' "$detail_html" "$failed_detail_html" "$admin_managed_detail_html"; then
      echo "[frontend-beginner-member-smoke] member runtime detail leaked mutation or destructive controls" >&2
      rm -f "$member_html" "$workflow_html" "$detail_html" "$failed_detail_html" "$admin_managed_detail_html"
      exit 1
    fi

    if grep -Eq 'Smoke VPS' "$detail_html"; then
      echo "[frontend-beginner-member-smoke] member healthy runtime detail leaked admin-managed server label" >&2
      rm -f "$member_html" "$workflow_html" "$detail_html" "$failed_detail_html" "$admin_managed_detail_html"
      exit 1
    fi

    if grep -Eq 'Ops Batch|ops-batch\.demo\.example\.com' "$failed_detail_html"; then
      echo "[frontend-beginner-member-smoke] member failed runtime detail leaked admin-managed server identity" >&2
      rm -f "$member_html" "$workflow_html" "$detail_html" "$failed_detail_html" "$admin_managed_detail_html"
      exit 1
    fi

    if ! grep -Eq 'data-testid="runtime-detail-admin-managed-live-checks-banner"' "$admin_managed_detail_html"; then
      echo "[frontend-beginner-member-smoke] member admin-managed runtime detail lost the live-checks boundary notice" >&2
      rm -f "$member_html" "$workflow_html" "$detail_html" "$failed_detail_html" "$admin_managed_detail_html"
      exit 1
    fi

    if ! grep -Eq 'data-testid="runtime-detail-template-admin-managed-banner"' "$admin_managed_detail_html"; then
      echo "[frontend-beginner-member-smoke] member admin-managed runtime detail lost the template boundary notice" >&2
      rm -f "$member_html" "$workflow_html" "$detail_html" "$failed_detail_html" "$admin_managed_detail_html"
      exit 1
    fi

    if grep -Eq 'data-testid="runtime-detail-save-template-button"' "$admin_managed_detail_html"; then
      echo "[frontend-beginner-member-smoke] member admin-managed runtime detail exposed local template save" >&2
      rm -f "$member_html" "$workflow_html" "$detail_html" "$failed_detail_html" "$admin_managed_detail_html"
      exit 1
    fi

    if grep -Eq 'Smoke VPS|smoke\.example\.com|deploy@|For local deploys' "$admin_managed_detail_html"; then
      echo "[frontend-beginner-member-smoke] member admin-managed runtime detail leaked server identity or local-runtime copy" >&2
      rm -f "$member_html" "$workflow_html" "$detail_html" "$failed_detail_html" "$admin_managed_detail_html"
      exit 1
    fi

    if ! grep -Eq 'data-testid="runtime-detail-main-next-step-action-focus"[^>]*>Open running app<' "$detail_html"; then
      echo "[frontend-beginner-member-smoke] member healthy runtime detail lost the safe open-app next step" >&2
      rm -f "$member_html" "$workflow_html" "$detail_html" "$failed_detail_html" "$admin_managed_detail_html"
      exit 1
    fi

    if ! grep -Eq 'data-testid="runtime-detail-main-next-step-action-focus"[^>]*>Review runtime issues<' "$failed_detail_html"; then
      echo "[frontend-beginner-member-smoke] member failed runtime detail lost the review-first next step" >&2
      rm -f "$member_html" "$workflow_html" "$detail_html" "$failed_detail_html" "$admin_managed_detail_html"
      exit 1
    fi

    rm -f "$member_html"
    rm -f "$workflow_html" "$detail_html" "$failed_detail_html" "$admin_managed_detail_html"
  )
}

run_beginner_member_overview_live_smoke() {
  (
    set -euo pipefail
    source "${SCRIPT_DIR}/frontend_smoke_shared.sh"

    export PORT="${FRONTEND_SMOKE_BEGINNER_MEMBER_OVERVIEW_LIVE_PORT:-3009}"
    export BASE_URL="http://127.0.0.1:${PORT}"
    export SERVER_LOG="${FRONTEND_SMOKE_BEGINNER_MEMBER_OVERVIEW_LIVE_LOG:-/tmp/deploymate-frontend-beginner-member-overview-live-smoke.log}"
    export DIST_DIR="${FRONTEND_SMOKE_BEGINNER_MEMBER_OVERVIEW_LIVE_DIST_DIR:-.next-smoke-beginner-member-overview-live-${PORT}}"
    export FRONTEND_SMOKE_PORT="$PORT"
    export FRONTEND_SMOKE_LOG="$SERVER_LOG"
    export FRONTEND_SMOKE_DIST_DIR="$DIST_DIR"
    export FRONTEND_SMOKE_REUSE_SERVER=0
    export NEXT_PUBLIC_SMOKE_USER_ROLE=member
    export NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0
    export NEXT_PUBLIC_SMOKE_OVERVIEW_SCENARIO=member-live-review

    cleanup_member_overview_live() {
      stop_frontend_smoke_server
    }

    trap cleanup_member_overview_live EXIT

    start_frontend_smoke_server
    wait_for_frontend_smoke_url "/app"

    overview_html="$(mktemp)"
    curl -sS "${BASE_URL}/app" > "$overview_html"

    if ! grep -Eq 'data-testid="workspace-scenario-action-step-1"[^>]*>Open live review<' "$overview_html"; then
      echo "[frontend-beginner-member-overview-live-smoke] member overview live path lost the review primary action" >&2
      rm -f "$overview_html"
      exit 1
    fi

    if ! grep -Eq '(<button[^>]*data-testid="workspace-scenario-action-step-2"[^>]*disabled[^>]*>Ask admin for new deploy<)|(<button[^>]*disabled[^>]*data-testid="workspace-scenario-action-step-2"[^>]*>Ask admin for new deploy<)' "$overview_html"; then
      echo "[frontend-beginner-member-overview-live-smoke] member overview live path did not gate new deployments" >&2
      rm -f "$overview_html"
      exit 1
    fi

    if ! grep -Eq 'data-testid="workspace-scenario-action-step-3"[^>]*>Review live apps<' "$overview_html"; then
      echo "[frontend-beginner-member-overview-live-smoke] member overview live path did not make live review the Step 3 action" >&2
      rm -f "$overview_html"
      exit 1
    fi

    if grep -Eq 'Smoke VPS|Edge EU Central|Ops Batch|smoke\.example\.com|ops-batch\.demo\.example\.com|eu-central\.demo\.example\.com' "$overview_html"; then
      echo "[frontend-beginner-member-overview-live-smoke] member overview live path leaked admin-managed server identity" >&2
      rm -f "$overview_html"
      exit 1
    fi

    rm -f "$overview_html"
  )
}

run_beginner_member_waiting_smoke() {
  (
    set -euo pipefail
    source "${SCRIPT_DIR}/frontend_smoke_shared.sh"

    export PORT="${FRONTEND_SMOKE_BEGINNER_MEMBER_WAITING_PORT:-3008}"
    export BASE_URL="http://127.0.0.1:${PORT}"
    export SERVER_LOG="${FRONTEND_SMOKE_BEGINNER_MEMBER_WAITING_LOG:-/tmp/deploymate-frontend-beginner-member-waiting-smoke.log}"
    export DIST_DIR="${FRONTEND_SMOKE_BEGINNER_MEMBER_WAITING_DIST_DIR:-.next-smoke-beginner-member-waiting-${PORT}}"
    export FRONTEND_SMOKE_PORT="$PORT"
    export FRONTEND_SMOKE_LOG="$SERVER_LOG"
    export FRONTEND_SMOKE_DIST_DIR="$DIST_DIR"
    export FRONTEND_SMOKE_REUSE_SERVER=0
    export NEXT_PUBLIC_SMOKE_USER_ROLE=member
    export NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0
    export NEXT_PUBLIC_SMOKE_DEPLOYMENT_WORKFLOW_SCENARIO=member-waiting-for-admin-target

    cleanup_member_waiting() {
      stop_frontend_smoke_server
    }

    trap cleanup_member_waiting EXIT

    start_frontend_smoke_server
    wait_for_frontend_smoke_url "/app"

    overview_html="$(mktemp)"
    waiting_html="$(mktemp)"
    curl -sS "${BASE_URL}/app" > "$overview_html"
    curl -sS "${BASE_URL}/app/deployment-workflow" > "$waiting_html"

    if ! grep -Eq 'data-testid="workspace-scenario-action-step-1"[^>]*>Review rollout status<' "$overview_html"; then
      echo "[frontend-beginner-member-waiting-smoke] member waiting overview lost the explicit rollout-status action" >&2
      rm -f "$overview_html" "$waiting_html"
      exit 1
    fi

    if ! grep -Eq 'data-testid="deployment-workflow-member-blocked-card"' "$waiting_html"; then
      echo "[frontend-beginner-member-waiting-smoke] member waiting path lost the blocked guidance card" >&2
      rm -f "$overview_html" "$waiting_html"
      exit 1
    fi

    if ! grep -Eq 'data-testid="deployment-workflow-main-next-step-button"[^>]*>Back to overview<' "$waiting_html"; then
      echo "[frontend-beginner-member-waiting-smoke] member waiting path lost the overview primary action" >&2
      rm -f "$overview_html" "$waiting_html"
      exit 1
    fi

    if grep -Eq 'data-testid="deployment-workflow-member-live-card"|data-testid="create-deployment-card"|data-testid="templates-card"|data-testid="runtime-deployment-card-' "$waiting_html"; then
      echo "[frontend-beginner-member-waiting-smoke] member waiting path leaked live or create surfaces" >&2
      rm -f "$overview_html" "$waiting_html"
      exit 1
    fi

    rm -f "$overview_html" "$waiting_html"
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
    export NEXT_PUBLIC_SMOKE_SERVER_REVIEW_SCENARIO=ready
    export NEXT_PUBLIC_SMOKE_DEPLOYMENT_WORKFLOW_SCENARIO=first-deploy-after-server-review

    cleanup_first_deploy() {
      stop_frontend_smoke_server
    }

    trap cleanup_first_deploy EXIT

    start_frontend_smoke_server
    wait_for_frontend_smoke_url "/app"

    server_review_html="$(mktemp)"
    curl -sS "${BASE_URL}/app/server-review" > "$server_review_html"

    if ! grep -Eq 'href="/app/deployment-workflow\?server=smoke-server&amp;source=server-review"' "$server_review_html"; then
      echo "[frontend-beginner-first-deploy-smoke] server review did not preserve the ready handoff into deployment workflow" >&2
      rm -f "$server_review_html"
      exit 1
    fi

    first_deploy_html="$(mktemp)"
    frontend_smoke_dump_dom "${BASE_URL}/app/deployment-workflow?server=smoke-server&source=server-review" "$first_deploy_html"

    if ! grep -Eq 'Step 1 is done on' "$first_deploy_html"; then
      echo "[frontend-beginner-first-deploy-smoke] server-ready lead is missing" >&2
      rm -f "$server_review_html" "$first_deploy_html"
      exit 1
    fi

    if ! assert_first_deploy_handoff_workflow \
      "frontend-beginner-first-deploy-smoke" \
      "$first_deploy_html" \
      'selected from Server Review' \
      "server-review"; then
      rm -f "$server_review_html" "$first_deploy_html"
      exit 1
    fi

    rm -f "$server_review_html" "$first_deploy_html"
  )
}

run_beginner_admin_smoke
run_beginner_admin_server_ready_smoke
run_beginner_admin_live_review_smoke
run_beginner_member_smoke
run_beginner_member_overview_live_smoke
run_beginner_member_waiting_smoke
run_beginner_first_deploy_smoke
run_beginner_export_payload_smoke

echo "[frontend-beginner-smoke] first-time admin path rendered"
echo "[frontend-beginner-smoke] admin server-ready first deploy path rendered"
echo "[frontend-beginner-smoke] admin live-review handoff rendered"
echo "[frontend-beginner-smoke] member remote-only live review path rendered"
echo "[frontend-beginner-smoke] member overview live review path rendered"
echo "[frontend-beginner-smoke] member remote-only waiting path rendered"
echo "[frontend-beginner-smoke] first deploy after server review rendered"
echo "[frontend-beginner-smoke] member export payload sanitized"
echo "[frontend-beginner-smoke] complete"
