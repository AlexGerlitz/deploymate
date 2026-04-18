#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/frontend_smoke_shared.sh"
source "${SCRIPT_DIR}/lib/frontend_smoke_checks.sh"

BUILT_DIST_DIRS=()

cleanup() {
  local dist_dir=""

  for dist_dir in "${BUILT_DIST_DIRS[@]}"; do
    rm -rf "${REPO_ROOT}/frontend/${dist_dir}"
  done
}

trap cleanup EXIT

build_beginner_static_dist() {
  local smoke_name="$1"
  local dist_dir="$2"
  local build_log="/tmp/${smoke_name}.log"

  shift 2
  rm -rf "${REPO_ROOT}/frontend/${dist_dir}"

  if ! env \
    NEXT_PUBLIC_SMOKE_TEST_MODE=1 \
    NEXT_FONT_GOOGLE_MOCKED_RESPONSES="$GOOGLE_FONT_MOCK_RESPONSES" \
    NEXT_DIST_DIR="$dist_dir" \
    "$@" \
    npm --prefix "${REPO_ROOT}/frontend" run build >"$build_log" 2>&1; then
    echo "[${smoke_name}] static build failed" >&2
    cat "$build_log" >&2
    exit 1
  fi

  BUILT_DIST_DIRS+=("$dist_dir")
}

beginner_static_html_file() {
  frontend_smoke_static_html_file "$REPO_ROOT" "$1" "$2"
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

  if ! grep -Eq 'data-testid="deployment-workflow-tab-stack"[^>]*>Bring compose stack<' "$html_file"; then
    echo "[${smoke_name}] workflow lost the compose stack intake tab" >&2
    return 1
  fi

  if ! grep -Eq 'data-testid="deployment-workflow-stack-intake-note"' "$html_file"; then
    echo "[${smoke_name}] workflow lost the compose stack intake guidance note" >&2
    return 1
  fi

  if ! grep -Eq 'data-testid="deployment-workflow-first-deploy-templates-note"' "$html_file"; then
    echo "[${smoke_name}] first deploy path lost the explicit template fallback note" >&2
    return 1
  fi

  if ! grep -Eq 'data-testid="templates-team-asset-card"' "$html_file"; then
    echo "[${smoke_name}] workflow lost the template handoff asset lane" >&2
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

    node --input-type=module <<'NODE'
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
  local smoke_name="frontend-beginner-admin-smoke"
  local dist_dir=".next-smoke-beginner-admin-static"
  local overview_html=""

  build_beginner_static_dist \
    "$smoke_name" \
    "$dist_dir" \
    NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0

  frontend_smoke_assert_static_checks \
    "$smoke_name" \
    "$REPO_ROOT" \
    "$dist_dir" \
    automation_smoke_beginner_admin_checks

  overview_html="$(beginner_static_html_file "$dist_dir" "/app")"
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
}

run_beginner_admin_server_ready_smoke() {
  local smoke_name="frontend-beginner-admin-server-ready-smoke"
  local dist_dir=".next-smoke-beginner-admin-server-ready-static"
  local overview_html=""
  local workflow_html=""

  build_beginner_static_dist \
    "$smoke_name" \
    "$dist_dir" \
    NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0 \
    NEXT_PUBLIC_SMOKE_OVERVIEW_SCENARIO=admin-server-ready-first-deploy \
    NEXT_PUBLIC_SMOKE_DEPLOYMENT_WORKFLOW_SCENARIO=first-deploy-after-overview \
    "NEXT_PUBLIC_SMOKE_WORKFLOW_QUERY=server=smoke-server&source=overview-first-deploy"

  overview_html="$(beginner_static_html_file "$dist_dir" "/app")"
  workflow_html="$(beginner_static_html_file "$dist_dir" "/app/deployment-workflow")"

  if ! grep -Eq 'data-testid="workspace-scenario-action-step-2"[^>]*>Choose app to run<' "$overview_html"; then
    echo "[${smoke_name}] overview did not point the ready-server admin to first deployment" >&2
    exit 1
  fi

  if ! grep -Eq 'data-testid="workspace-scenario-primary-action"[^>]*>Choose app to run<' "$overview_html"; then
    echo "[${smoke_name}] overview lost the top-level first-deploy action" >&2
    exit 1
  fi

  if ! grep -Eq 'href="/app/deployment-workflow\?server=smoke-server&amp;source=overview-first-deploy"' "$overview_html"; then
    echo "[${smoke_name}] overview did not preserve the ready server into the first-deploy link" >&2
    exit 1
  fi

  if grep -Eq 'data-testid="workspace-scenario-action-step-1"[^>]*>Add first server target<' "$overview_html"; then
    echo "[${smoke_name}] overview regressed to server setup after a server was ready" >&2
    exit 1
  fi

  if ! grep -Eq 'data-testid="workspace-scenario-item-step-1".*Server ready.*already connected' "$overview_html"; then
    echo "[${smoke_name}] overview lost the explicit ready-server demotion copy on Step 1" >&2
    exit 1
  fi

  if ! grep -Eq 'data-testid="workspace-scenario-action-step-1"[^>]*>Review server setup<' "$overview_html"; then
    echo "[${smoke_name}] overview Step 1 still competes with first deploy instead of staying a review action" >&2
    exit 1
  fi

  if grep -Eq 'data-testid="workspace-scenario-action-step-2"[^>]*disabled' "$overview_html"; then
    echo "[${smoke_name}] Step 2 stayed blocked after a server was ready" >&2
    exit 1
  fi

  if ! assert_first_deploy_handoff_workflow \
    "$smoke_name" \
    "$workflow_html" \
    'selected from Overview' \
    "overview-first-deploy"; then
    exit 1
  fi
}

run_beginner_admin_live_review_smoke() {
  local smoke_name="frontend-beginner-admin-live-review-smoke"
  local dist_dir=".next-smoke-beginner-admin-live-review-static"
  local overview_html=""

  build_beginner_static_dist \
    "$smoke_name" \
    "$dist_dir" \
    NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0 \
    NEXT_PUBLIC_SMOKE_OVERVIEW_SCENARIO=admin-live-review

  overview_html="$(beginner_static_html_file "$dist_dir" "/app")"

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
}

run_beginner_member_smoke() {
  local smoke_name="frontend-beginner-member-smoke"
  local dist_dir=".next-smoke-beginner-member-static"
  local member_html=""
  local workflow_html=""

  build_beginner_static_dist \
    "$smoke_name" \
    "$dist_dir" \
    NEXT_PUBLIC_SMOKE_USER_ROLE=member \
    NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0

  frontend_smoke_assert_static_checks \
    "$smoke_name" \
    "$REPO_ROOT" \
    "$dist_dir" \
    automation_smoke_beginner_member_checks

  member_html="$(beginner_static_html_file "$dist_dir" "/app/server-review")"
  workflow_html="$(beginner_static_html_file "$dist_dir" "/app/deployment-workflow")"

  if grep -Eq 'data-testid="server-review-create-card"|data-testid="server-review-create-server"|data-testid="server-review-blocked-workflow-link"' "$member_html"; then
    echo "[${smoke_name}] member remote-only path leaked admin controls or a false workflow CTA" >&2
    exit 1
  fi

  if grep -Eq 'data-testid="create-deployment-card"|data-testid="create-deployment-submit-button"|data-testid="templates-card"|data-testid="template-delete-button-' "$workflow_html"; then
    echo "[${smoke_name}] member remote-only workflow leaked blocked create/template controls" >&2
    exit 1
  fi

  if ! grep -Eq 'data-testid="deployment-workflow-member-live-card"' "$workflow_html"; then
    echo "[${smoke_name}] member remote-only live path lost the live-review guidance card" >&2
    exit 1
  fi

  if grep -Eq 'data-testid="deployment-workflow-member-blocked-card"' "$workflow_html"; then
    echo "[${smoke_name}] member remote-only live path still renders the waiting-for-admin card" >&2
    exit 1
  fi

  if grep -Eq 'Ops Batch|ops-batch\.demo\.example\.com' "$workflow_html"; then
    echo "[${smoke_name}] member remote-only workflow leaked admin-managed server identity" >&2
    exit 1
  fi
}

run_beginner_member_overview_live_smoke() {
  local smoke_name="frontend-beginner-member-overview-live-smoke"
  local dist_dir=".next-smoke-beginner-member-overview-live-static"
  local overview_html=""

  build_beginner_static_dist \
    "$smoke_name" \
    "$dist_dir" \
    NEXT_PUBLIC_SMOKE_USER_ROLE=member \
    NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0 \
    NEXT_PUBLIC_SMOKE_OVERVIEW_SCENARIO=member-live-review

  overview_html="$(beginner_static_html_file "$dist_dir" "/app")"

  if ! grep -Eq 'data-testid="workspace-scenario-action-step-1"[^>]*>Open live review<' "$overview_html"; then
    echo "[${smoke_name}] member overview live path lost the review primary action" >&2
    exit 1
  fi

  if ! grep -Eq '(<button[^>]*data-testid="workspace-scenario-action-step-2"[^>]*disabled[^>]*>Ask admin for new deploy<)|(<button[^>]*disabled[^>]*data-testid="workspace-scenario-action-step-2"[^>]*>Ask admin for new deploy<)' "$overview_html"; then
    echo "[${smoke_name}] member overview live path did not gate new deployments" >&2
    exit 1
  fi

  if ! grep -Eq 'data-testid="workspace-scenario-action-step-3"[^>]*>Review live apps<' "$overview_html"; then
    echo "[${smoke_name}] member overview live path did not make live review the Step 3 action" >&2
    exit 1
  fi

  if grep -Eq 'Smoke VPS|Edge EU Central|Ops Batch|smoke\.example\.com|ops-batch\.demo\.example\.com|eu-central\.demo\.example\.com' "$overview_html"; then
    echo "[${smoke_name}] member overview live path leaked admin-managed server identity" >&2
    exit 1
  fi
}

run_beginner_member_waiting_smoke() {
  local smoke_name="frontend-beginner-member-waiting-smoke"
  local dist_dir=".next-smoke-beginner-member-waiting-static"
  local overview_html=""
  local waiting_html=""

  build_beginner_static_dist \
    "$smoke_name" \
    "$dist_dir" \
    NEXT_PUBLIC_SMOKE_USER_ROLE=member \
    NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0 \
    NEXT_PUBLIC_SMOKE_DEPLOYMENT_WORKFLOW_SCENARIO=member-waiting-for-admin-target

  overview_html="$(beginner_static_html_file "$dist_dir" "/app")"
  waiting_html="$(beginner_static_html_file "$dist_dir" "/app/deployment-workflow")"

  if ! grep -Eq 'data-testid="workspace-scenario-action-step-1"[^>]*>Review rollout status<' "$overview_html"; then
    echo "[${smoke_name}] member waiting overview lost the explicit rollout-status action" >&2
    exit 1
  fi

  if ! grep -Eq 'data-testid="deployment-workflow-member-blocked-card"' "$waiting_html"; then
    echo "[${smoke_name}] member waiting path lost the blocked guidance card" >&2
    exit 1
  fi

  if ! grep -Eq 'data-testid="deployment-workflow-main-next-step-button"[^>]*>Back to overview<' "$waiting_html"; then
    echo "[${smoke_name}] member waiting path lost the overview primary action" >&2
    exit 1
  fi

  if grep -Eq 'data-testid="deployment-workflow-member-live-card"|data-testid="create-deployment-card"|data-testid="templates-card"|data-testid="runtime-deployment-card-' "$waiting_html"; then
    echo "[${smoke_name}] member waiting path leaked live or create surfaces" >&2
    exit 1
  fi
}

run_beginner_first_deploy_smoke() {
  local smoke_name="frontend-beginner-first-deploy-smoke"
  local dist_dir=".next-smoke-beginner-first-deploy-static"
  local server_review_html=""
  local first_deploy_html=""

  build_beginner_static_dist \
    "$smoke_name" \
    "$dist_dir" \
    NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0 \
    NEXT_PUBLIC_SMOKE_SERVER_REVIEW_SCENARIO=ready \
    NEXT_PUBLIC_SMOKE_DEPLOYMENT_WORKFLOW_SCENARIO=first-deploy-after-server-review \
    "NEXT_PUBLIC_SMOKE_WORKFLOW_QUERY=server=smoke-server&source=server-review"

  server_review_html="$(beginner_static_html_file "$dist_dir" "/app/server-review")"
  first_deploy_html="$(beginner_static_html_file "$dist_dir" "/app/deployment-workflow")"

  if ! grep -Eq 'href="/app/deployment-workflow\?server=smoke-server&amp;source=server-review"' "$server_review_html"; then
    echo "[${smoke_name}] server review did not preserve the ready handoff into deployment workflow" >&2
    exit 1
  fi

  if ! grep -Eq 'Step 1 is done on' "$first_deploy_html"; then
    echo "[${smoke_name}] server-ready lead is missing" >&2
    exit 1
  fi

  if ! assert_first_deploy_handoff_workflow \
    "$smoke_name" \
    "$first_deploy_html" \
    'selected from Server Review' \
    "server-review"; then
    exit 1
  fi
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
