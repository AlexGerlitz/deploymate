#!/usr/bin/env bash

set -euo pipefail

PORT="${FRONTEND_SMOKE_PORT:-3001}"
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_LOG="${FRONTEND_SMOKE_LOG:-/tmp/deploymate-frontend-runtime-smoke.log}"
DIST_DIR="${FRONTEND_SMOKE_DIST_DIR:-.next-smoke-${PORT}}"
APP_HTML="$(mktemp)"
DETAIL_HTML="$(mktemp)"
STACK_DETAIL_HTML="$(mktemp)"
STACK_INCIDENT_HTML="$(mktemp)"
FRESH_DETAIL_HTML="$(mktemp)"
FAILED_DETAIL_HTML="$(mktemp)"
ADMIN_MANAGED_DETAIL_HTML="$(mktemp)"
HEALTHY_WORKFLOW_HTML="$(mktemp)"
FAILED_WORKFLOW_HTML="$(mktemp)"
DISK_BLOCKED_WORKFLOW_HTML="$(mktemp)"
INTERNAL_DETAIL_HTML="$(mktemp)"
INTERNAL_WORKFLOW_HTML="$(mktemp)"
TEMPLATE_SUCCESS_WORKFLOW_HTML="$(mktemp)"
CREATE_SUCCESS_WORKFLOW_HTML="$(mktemp)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/lib/project_automation.sh"
source "${SCRIPT_DIR}/lib/frontend_smoke_checks.sh"
source "${SCRIPT_DIR}/frontend_smoke_shared.sh"

RUNTIME_SCENARIO_PORT_BASE="${FRONTEND_SMOKE_RUNTIME_SCENARIO_PORT_BASE:-$((PORT + 20))}"

cleanup() {
  if [ "${FRONTEND_SMOKE_REUSE_SERVER:-0}" != "1" ]; then
    stop_frontend_smoke_server
  fi
  rm -f "$APP_HTML" "$DETAIL_HTML" "$STACK_DETAIL_HTML" "$STACK_INCIDENT_HTML" "$FRESH_DETAIL_HTML" "$FAILED_DETAIL_HTML" "$ADMIN_MANAGED_DETAIL_HTML" "$HEALTHY_WORKFLOW_HTML" "$FAILED_WORKFLOW_HTML" "$DISK_BLOCKED_WORKFLOW_HTML" "$INTERNAL_DETAIL_HTML" "$INTERNAL_WORKFLOW_HTML" "$TEMPLATE_SUCCESS_WORKFLOW_HTML" "$CREATE_SUCCESS_WORKFLOW_HTML"
}

trap cleanup EXIT

run_runtime_export_handoff_smoke() {
  (
    set -euo pipefail
    cd "$REPO_ROOT"

    node --input-type=module <<'NODE'
import {
  buildActivityExportCsv,
  buildIncidentMarkdown,
  buildIncidentSnapshotPayload,
  buildRuntimeActivityTrailExportRecord,
  buildRuntimeAttentionExportRecord,
  buildRuntimeIdentityExportRecord,
  buildRuntimeNextStepExportRecord,
  buildRuntimeRecentActivityExportRecord,
  buildRuntimeHealthProofExportRecord,
  buildRuntimeOwnershipExportRecord,
  buildRuntimeReleaseTraceExportRecord,
  buildRuntimeReviewTargetExportRecord,
} from "./frontend/app/lib/runtime-workspace-utils.js";
import {
  smokeActivity,
  smokeDeployment,
  smokeDiagnostics,
  smokeHealth,
} from "./frontend/app/lib/smoke-fixtures.js";

const ownership = buildRuntimeOwnershipExportRecord({
  value: "Your remote runtime",
  detail: "You own the deployment record and can review the live target directly from this page.",
});

if (ownership.value !== "Your remote runtime") {
  throw new Error("runtime ownership export record lost the ownership label");
}

if (!ownership.detail.includes("review the live target directly")) {
  throw new Error("runtime ownership export record lost the ownership detail");
}

const reviewTarget = buildRuntimeReviewTargetExportRecord({
  kind: "app",
  href: smokeHealth.url,
});

if (reviewTarget.value !== "Live endpoint") {
  throw new Error("runtime review target export record lost the target label");
}

if (reviewTarget.href !== smokeHealth.url) {
  throw new Error("runtime review target export record lost the href");
}

if (!reviewTarget.detail.includes("Open the live endpoint first")) {
  throw new Error("runtime review target export record lost the detail");
}

const healthReviewTarget = buildRuntimeReviewTargetExportRecord({
  kind: "health",
  href: "https://customer-portal.example.com/health",
});

if (healthReviewTarget.value !== "Saved health target") {
  throw new Error("runtime review target export record lost the health-target label");
}

if (healthReviewTarget.href !== "https://customer-portal.example.com/health") {
  throw new Error("runtime review target export record lost the health-target href");
}

const identity = buildRuntimeIdentityExportRecord(smokeDeployment, {
  locationSummary: "Running on Smoke VPS (smoke.example.com).",
});

if (identity.value !== "smoke-runtime") {
  throw new Error("runtime identity export record lost the value");
}

if (identity.detail !== "nginx:alpine is the current runtime source. Running on Smoke VPS (smoke.example.com).") {
  throw new Error("runtime identity export record lost the detail");
}

const recentActivity = buildRuntimeRecentActivityExportRecord(smokeActivity);

if (recentActivity.value !== "Deployment succeeded") {
  throw new Error("runtime recent activity export record lost the value");
}

if (
  recentActivity.detail !==
  "Deployment smoke-deployment is running in container smoke-runtime. Logged 02.04.2026, 00:01:00 UTC."
) {
  throw new Error("runtime recent activity export record lost the detail");
}

const activityTrail = buildRuntimeActivityTrailExportRecord(smokeActivity);

if (activityTrail.value !== "2 events, 2 successes") {
  throw new Error("runtime activity trail export record lost the value");
}

if (activityTrail.detail !== "Latest: Deployment succeeded at 02.04.2026, 00:01:00 UTC.") {
  throw new Error("runtime activity trail export record lost the detail");
}

const attentionCue = buildRuntimeAttentionExportRecord([]);

if (attentionCue.value !== "0 active warnings") {
  throw new Error("runtime attention export record lost the value");
}

if (attentionCue.detail !== "No active runtime warnings right now.") {
  throw new Error("runtime attention export record lost the detail");
}

const nextStepCue = buildRuntimeNextStepExportRecord(
  "Open running app",
  "Open the running app and confirm the user-facing path works. Only prepare a rollout change after that check is intentional.",
);

if (nextStepCue.value !== "Open running app") {
  throw new Error("runtime next-step export record lost the value");
}

if (
  nextStepCue.detail !==
  "Open the running app and confirm the user-facing path works. Only prepare a rollout change after that check is intentional."
) {
  throw new Error("runtime next-step export record lost the detail");
}

const healthProof = buildRuntimeHealthProofExportRecord(smokeHealth, {
  kind: "app",
  href: smokeHealth.url,
});

if (healthProof.value !== "healthy") {
  throw new Error("runtime health proof export record lost the status");
}

if (healthProof.detail !== "Checked 02.04.2026, 00:03:00 UTC with HTTP 200 in 42 ms.") {
  throw new Error("runtime health proof export record lost the proof detail");
}

const releaseTrace = buildRuntimeReleaseTraceExportRecord(smokeDeployment);

if (
  releaseTrace.value !==
  "source webhook, ref refs/heads/main, commit 7d9c4a2b1f0e, tag ghcr.io/deploymate/smoke-runtime:2026.04.02, by smoke-ci"
) {
  throw new Error("runtime release trace export record lost the summary");
}

if (releaseTrace.detail !== "Triggered 02.04.2026, 00:05:00 UTC.") {
  throw new Error("runtime release trace export record lost the trigger detail");
}

const snapshot = buildIncidentSnapshotPayload({
  deployment: smokeDeployment,
  health: smokeHealth,
  exportPayload: {
    deployment: smokeDeployment,
    health: smokeHealth,
    diagnostics: smokeDiagnostics,
    activity: smokeActivity.slice(0, 1),
    attentionItems: [],
    suggestedPorts: [],
  },
  identityRecord: identity,
  recentActivityRecord: recentActivity,
  activityTrailRecord: activityTrail,
  attentionRecord: attentionCue,
  nextStepRecord: nextStepCue,
  ownershipSummary: ownership,
  reviewTarget: {
    kind: "app",
    href: smokeHealth.url,
  },
  runtimeSummaryText: `Review target: ${reviewTarget.value} -> ${reviewTarget.href}`,
  plainLanguageSummary: `Open ${reviewTarget.href} before the next rollout change.`,
  nextStep: "Open the live endpoint and confirm the user-facing path works.",
  status: smokeDeployment.status,
});

if (snapshot.review_target?.href !== smokeHealth.url) {
  throw new Error("incident snapshot lost the exported review target href");
}

if (snapshot.runtime_identity?.container_name !== "smoke-runtime") {
  throw new Error("incident snapshot lost the exported runtime identity");
}

if (snapshot.recent_activity?.title !== "Deployment succeeded") {
  throw new Error("incident snapshot lost the exported recent activity cue");
}

if (snapshot.activity_trail?.value !== "2 events, 2 successes") {
  throw new Error("incident snapshot lost the exported activity trail cue");
}

if (snapshot.attention_cue?.total_count !== "0") {
  throw new Error("incident snapshot lost the exported attention cue");
}

if (snapshot.next_step_cue?.value !== "Open running app") {
  throw new Error("incident snapshot lost the exported next-step cue");
}

if (snapshot.health_proof?.status_code !== "200") {
  throw new Error("incident snapshot lost the exported health proof status code");
}

if (snapshot.release_trace?.commit_sha !== smokeDeployment.release_commit_sha) {
  throw new Error("incident snapshot lost the exported release trace commit");
}

const markdown = buildIncidentMarkdown(snapshot);

for (const value of [
  "## Runtime Identity",
  "Value: smoke-runtime",
  "Detail: nginx:alpine is the current runtime source. Running on Smoke VPS (smoke.example.com).",
  "Runtime shape: single",
  "Image: nginx:alpine",
  "Container: smoke-runtime",
  "Location: Running on Smoke VPS (smoke.example.com).",
  "## Recent Activity Cue",
  "Value: Deployment succeeded",
  "Detail: Deployment smoke-deployment is running in container smoke-runtime. Logged 02.04.2026, 00:01:00 UTC.",
  "Logged at: 02.04.2026, 00:01:00 UTC",
  "Level: success",
  "Category: deploy",
  "Title: Deployment succeeded",
  "Message: Deployment smoke-deployment is running in container smoke-runtime.",
  "## Activity Trail",
  "Value: 2 events, 2 successes",
  "Detail: Latest: Deployment succeeded at 02.04.2026, 00:01:00 UTC.",
  "Total count: 2",
  "Error count: 0",
  "Warn count: 0",
  "Success count: 2",
  "Latest event: Deployment succeeded",
  "Latest level: success",
  "Latest at: 02.04.2026, 00:01:00 UTC",
  "Latest problem: n/a",
  "Latest problem at: n/a",
  "Latest success: n/a",
  "Latest success at: n/a",
  "## Attention Cue",
  "Value: 0 active warnings",
  "Detail: No active runtime warnings right now.",
  "Total count: 0",
  "Error count: 0",
  "Warn count: 0",
  "Primary label: n/a",
  "Primary message: n/a",
  "## Next Safe Action Cue",
  "Value: Open running app",
  "Detail: Open the running app and confirm the user-facing path works. Only prepare a rollout change after that check is intentional.",
  "## Review Target",
  "Status: Live endpoint",
  `Href: ${smokeHealth.url}`,
  "Detail: Open the live endpoint first, then confirm health and recent activity.",
  "## Health Proof",
  "Status: healthy",
  "Detail: Checked 02.04.2026, 00:03:00 UTC with HTTP 200 in 42 ms.",
  "Checked at: 02.04.2026, 00:03:00 UTC",
  "HTTP status: 200",
  "Response time: 42 ms",
  "Error: n/a",
  "## Release Trace",
  "Summary: source webhook, ref refs/heads/main, commit 7d9c4a2b1f0e, tag ghcr.io/deploymate/smoke-runtime:2026.04.02, by smoke-ci",
  "Source: webhook",
  "Commit: 7d9c4a2b1f0e6d5c4b3a29181716151413121110",
  "Triggered at: 02.04.2026, 00:05:00 UTC",
  "Triggered by: smoke-ci",
]) {
  if (!markdown.includes(value)) {
    throw new Error(`runtime handoff markdown lost ${value}`);
  }
}

const csv = buildActivityExportCsv(smokeActivity.slice(0, 1), {
  deploymentId: smokeDeployment.id,
  deployment: smokeDeployment,
  identityRecord: identity,
  recentActivityRecord: recentActivity,
  activityTrailRecord: activityTrail,
  attentionRecord: attentionCue,
  nextStepRecord: nextStepCue,
  health: smokeHealth,
  ownershipSummary: ownership,
  reviewTarget: {
    kind: "app",
    href: smokeHealth.url,
  },
});

for (const value of [
  "deployment_id",
  "runtime_identity_value",
  "runtime_identity_detail",
  "runtime_shape",
  "runtime_image",
  "runtime_container_name",
  "runtime_stack_name",
  "runtime_primary_service",
  "runtime_location",
  "recent_activity_value",
  "recent_activity_detail",
  "recent_activity_created_at",
  "recent_activity_level",
  "recent_activity_category",
  "recent_activity_title",
  "recent_activity_message",
  "activity_trail_value",
  "activity_trail_detail",
  "activity_trail_total_count",
  "activity_trail_error_count",
  "activity_trail_warn_count",
  "activity_trail_success_count",
  "activity_trail_latest_title",
  "activity_trail_latest_level",
  "activity_trail_latest_created_at",
  "activity_trail_latest_problem_title",
  "activity_trail_latest_problem_created_at",
  "activity_trail_latest_success_title",
  "activity_trail_latest_success_created_at",
  "attention_cue_value",
  "attention_cue_detail",
  "attention_total_count",
  "attention_error_count",
  "attention_warn_count",
  "attention_primary_label",
  "attention_primary_message",
  "next_step_value",
  "next_step_detail",
  "ownership_status",
  "ownership_detail",
  "review_target_kind",
  "review_target_status",
  "review_target_href",
  "review_target_detail",
  "health_proof_status",
  "health_proof_detail",
  "health_checked_at",
  "health_status_code",
  "health_response_time_ms",
  "health_error",
  "release_trace_summary",
  "release_trace_detail",
  "release_source",
  "release_ref",
  "release_commit_sha",
  "release_image_tag",
  "release_triggered_at",
  "release_triggered_by",
  "smoke-deployment",
  "smoke-runtime",
  "nginx:alpine is the current runtime source. Running on Smoke VPS (smoke.example.com).",
  "single",
  "nginx:alpine",
  "Running on Smoke VPS (smoke.example.com).",
  "Deployment succeeded",
  "Deployment smoke-deployment is running in container smoke-runtime. Logged 02.04.2026, 00:01:00 UTC.",
  "2026-04-02T00:01:00Z",
  "success",
  "deploy",
  "Deployment succeeded",
  "Deployment smoke-deployment is running in container smoke-runtime.",
  "2 events, 2 successes",
  "Latest: Deployment succeeded at 02.04.2026, 00:01:00 UTC.",
  "2",
  "0",
  "0",
  "2",
  "Deployment succeeded",
  "success",
  "2026-04-02T00:01:00Z",
  "0 active warnings",
  "No active runtime warnings right now.",
  "0",
  "0",
  "0",
  "Open running app",
  "Open the running app and confirm the user-facing path works. Only prepare a rollout change after that check is intentional.",
  "Your remote runtime",
  "You own the deployment record and can review the live target directly from this page.",
  "app",
  "Live endpoint",
  smokeHealth.url,
  "Open the live endpoint first, then confirm health and recent activity.",
  "healthy",
  "Checked 02.04.2026, 00:03:00 UTC with HTTP 200 in 42 ms.",
  "2026-04-02T00:03:00Z",
  "200",
  "42",
  "source webhook, ref refs/heads/main, commit 7d9c4a2b1f0e, tag ghcr.io/deploymate/smoke-runtime:2026.04.02, by smoke-ci",
  "Triggered 02.04.2026, 00:05:00 UTC.",
  "webhook",
  "refs/heads/main",
  "7d9c4a2b1f0e6d5c4b3a29181716151413121110",
  "ghcr.io/deploymate/smoke-runtime:2026.04.02",
  "2026-04-02T00:05:00Z",
  "smoke-ci",
]) {
  if (!csv.includes(value)) {
    throw new Error(`runtime activity export lost ${value}`);
  }
}
NODE
  )
}

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

if ! grep -Eq 'data-testid="runtime-detail-share-order-title"[^>]*>Share this runtime in order<' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] runtime detail lost the ordered share/handoff guidance" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-handoff-review-target"[^>]*>Live endpoint: http://smoke\.example\.com:38080\. Open the live endpoint first, then confirm health and recent activity\.<' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] runtime detail handoff card lost the explicit review target cue" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-handoff-identity"[^>]*>smoke-runtime\. nginx:alpine is the current runtime source\. Running on Smoke VPS \(smoke\.example\.com\)\.<' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] runtime detail handoff card lost the explicit runtime identity cue" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-handoff-recent-activity"[^>]*>Deployment succeeded\. Deployment smoke-deployment is running in container smoke-runtime\. Logged 02\.04\.2026, 00:01:00 UTC\.<' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] runtime detail handoff card lost the explicit recent activity cue" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-handoff-activity-trail"[^>]*>2 events, 2 successes\. Latest: Deployment succeeded at 02\.04\.2026, 00:01:00 UTC\.<' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] runtime detail handoff card lost the explicit activity trail cue" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-handoff-attention"[^>]*>0 active warnings\. No active runtime warnings right now\.<' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] runtime detail handoff card lost the explicit attention cue" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-activity-trail-reference"[^>]*>2 events, 2 successes\. Latest: Deployment succeeded at 02\.04\.2026, 00:01:00 UTC\.<' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] runtime detail quick reference lost the activity trail summary" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-handoff-next-step"[^>]*>Open running app\. Open the running app and confirm the user-facing path works\. Only prepare a rollout change after that check is intentional\.<' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] runtime detail handoff card lost the explicit next-step cue" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-handoff-health-proof"[^>]*>healthy\. Checked 02\.04\.2026, 00:03:00 UTC with HTTP 200 in 42 ms\.<' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] runtime detail handoff card lost the explicit health proof cue" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-handoff-release-trace"[^>]*>source webhook, ref refs/heads/main, commit 7d9c4a2b1f0e, tag ghcr\.io/deploymate/smoke-runtime:2026\.04\.02, by smoke-ci\. Triggered 02\.04\.2026, 00:05:00 UTC\.<' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] runtime detail handoff card lost the explicit release trace cue" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-passport-item-review-target"' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] deployment passport lost the on-screen review target cue" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-passport-item-release-trace"' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] deployment passport lost the on-screen release trace cue" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-passport-item-attention"' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] deployment passport lost the on-screen current risk cue" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-passport-item-safe-change"' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] deployment passport lost the safe change path cue" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-passport-item-recovery-path"' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] deployment passport lost the recovery path cue" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-activity-summary"' "$DETAIL_HTML" || \
  ! grep -Eq 'Current trail: <!-- -->2 events, 2 successes<!-- -->\.' "$DETAIL_HTML" || \
  ! grep -Eq 'Latest: Health check passed at 02\.04\.2026, 00:03:00 UTC\.' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] runtime detail activity card lost the explicit activity trail summary" >&2
  exit 1
fi

if ! grep -Eq '>Review rollback<' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] healthy deployment passport lost the explicit rollback recovery path" >&2
  exit 1
fi

if ! grep -Eq '>Rollback ready<' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] healthy deployment passport lost the rollback-ready change path" >&2
  exit 1
fi

if grep -Eq 'data-testid="runtime-detail-passport-incident-card"' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] healthy deployment passport should not render incident mode" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-template-card"' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] runtime detail lost the template handoff card" >&2
  exit 1
fi

if ! grep -Eq '>Save as reusable handoff asset<' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] runtime detail lost the reusable handoff template framing" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-rollback-card"' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] runtime detail lost the rollback review card" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-rollback-review-button"[^>]*>Review rollback<' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] runtime detail does not expose rollback review when a previous release snapshot exists" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-rollback-summary"[^>]*>nginx:1.26 via host port 38080 with 1 env var and 0 secrets<' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] runtime detail lost the saved rollback summary" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-evidence-order-title"[^>]*>Read evidence in order<' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] runtime detail lost the ordered evidence guidance" >&2
  exit 1
fi

if grep -Eq 'data-testid="runtime-detail-main-next-step-action-focus"[^>]*>Prepare rollout change<' "$DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] healthy runtime detail still makes rollout change the main next step" >&2
  exit 1
fi

curl -sS "${BASE_URL}/deployments/smoke-stack-runtime" > "$STACK_DETAIL_HTML"
if ! grep -Eq 'data-testid="runtime-detail-runtime-shape"[^>]*>stack<' "$STACK_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] stack runtime detail lost the runtime shape summary" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-stack-name"[^>]*>customer-portal<' "$STACK_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] stack runtime detail lost the stack identity" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-primary-service"[^>]*>web<' "$STACK_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] stack runtime detail lost the primary service summary" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-health-target"[^>]*>https://customer-portal.example.com/health<' "$STACK_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] stack runtime detail lost the saved health target" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-stack-change-note"' "$STACK_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] stack runtime detail still lacks the guarded stack-change note" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-stack-template-banner"' "$STACK_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] stack runtime detail still exposes the single-app template path" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-stack-webhook-note"' "$STACK_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] stack runtime detail still lacks the guarded webhook note" >&2
  exit 1
fi

if grep -Eq 'data-testid="runtime-detail-webhook-row"' "$STACK_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] stack runtime detail still exposes the single-app release webhook controls" >&2
  exit 1
fi

if ! grep -Eq '>Open health target<' "$STACK_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] stack runtime detail no longer leads with the saved health target" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-review-target-link"[^>]*>https://customer-portal.example.com/health<' "$STACK_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] stack runtime detail facts no longer expose the saved review endpoint link" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-passport-item-recovery-path"' "$STACK_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] stack runtime passport lost the recovery path cue" >&2
  exit 1
fi

if ! grep -Eq '>Guarded stack replacement<' "$STACK_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] stack runtime passport lost the guarded stack replacement label" >&2
  exit 1
fi

if ! grep -Eq 'Review the saved health target at https://customer-portal.example.com/health and recent activity before planning any replacement\.' "$STACK_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] stack runtime passport lost the health-target-first recovery detail" >&2
  exit 1
fi

if ! grep -Eq 'Guided redeploy and rollback stay paused for stack v0' "$STACK_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] stack runtime passport lost the paused-stack-recovery guardrail" >&2
  exit 1
fi

if grep -Eq '>Prepare rollout change<' "$STACK_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] stack runtime detail still suggests the disabled single-app change flow as the next action" >&2
  exit 1
fi

if grep -Eq 'data-testid="runtime-detail-passport-incident-card"' "$STACK_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] healthy stack runtime detail should stay out of incident mode" >&2
  exit 1
fi

curl -sS "${BASE_URL}/deployments/smoke-stack-runtime?source=stack-incident" > "$STACK_INCIDENT_HTML"
if ! grep -Eq 'data-testid="runtime-detail-passport-incident-card"' "$STACK_INCIDENT_HTML"; then
  echo "[frontend-runtime-smoke] stack incident detail lost the passport incident mode card" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-passport-incident-item-likely-cause"' "$STACK_INCIDENT_HTML"; then
  echo "[frontend-runtime-smoke] stack incident detail lost the likely-cause incident cue" >&2
  exit 1
fi

if ! grep -Eq '>Stack health unhealthy<' "$STACK_INCIDENT_HTML"; then
  echo "[frontend-runtime-smoke] stack incident detail lost the stack-specific likely-cause label" >&2
  exit 1
fi

if ! grep -Eq 'Saved health target returned 502 from primary service web\.' "$STACK_INCIDENT_HTML"; then
  echo "[frontend-runtime-smoke] stack incident detail lost the saved-health-target failure detail" >&2
  exit 1
fi

if ! grep -Eq 'Open the saved health target at https://customer-portal.example.com/health, then read recent activity and stack diagnostics before deciding whether the whole stack needs replacement\.' "$STACK_INCIDENT_HTML"; then
  echo "[frontend-runtime-smoke] stack incident detail lost the stack-specific first-checks guidance" >&2
  exit 1
fi

if ! grep -Eq '>Review health and warnings<' "$STACK_INCIDENT_HTML"; then
  echo "[frontend-runtime-smoke] stack incident detail lost the review-first safe action" >&2
  exit 1
fi

if ! grep -Eq '>Handoff before stack replacement<' "$STACK_INCIDENT_HTML"; then
  echo "[frontend-runtime-smoke] stack incident detail lost the stack-specific escalation path label" >&2
  exit 1
fi

if ! grep -Eq 'before any guarded whole-stack delete or replacement\.' "$STACK_INCIDENT_HTML"; then
  echo "[frontend-runtime-smoke] stack incident detail lost the guarded whole-stack escalation boundary" >&2
  exit 1
fi

if ! grep -Eq '>Diagnose, then replace stack<' "$STACK_INCIDENT_HTML"; then
  echo "[frontend-runtime-smoke] stack incident detail lost the stack recovery-path incident state" >&2
  exit 1
fi

curl -sS "${BASE_URL}/deployments/smoke-deployment?source=workflow-success" > "$FRESH_DETAIL_HTML"
if ! grep -Eq 'data-testid="runtime-detail-fresh-rollout-banner"' "$FRESH_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] fresh rollout detail lost the workflow-success bridge banner" >&2
  exit 1
fi

if ! grep -Eq 'Opened from deployment workflow: this rollout is still fresh\.' "$FRESH_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] fresh rollout detail lost the explicit workflow-to-detail bridge copy" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-passport-card"' "$FRESH_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] fresh rollout detail lost the deployment passport card" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-passport-title"[^>]*>Deployment passport<' "$FRESH_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] fresh rollout detail lost the deployment passport title" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-passport-item-safe-change"' "$FRESH_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] fresh rollout passport lost the safe change path cue" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-passport-item-recovery-path"' "$FRESH_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] fresh rollout passport lost the recovery path cue" >&2
  exit 1
fi

if ! grep -Eq '>Verify before change<' "$FRESH_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] fresh rollout passport lost the verify-before-change path" >&2
  exit 1
fi

if ! grep -Eq '>No recovery decision yet<' "$FRESH_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] fresh rollout passport lost the no-recovery-yet cue" >&2
  exit 1
fi

if ! grep -Eq 'Verify the app, health, and recent activity first\.' "$FRESH_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] fresh rollout passport lost the explicit verify-first change guidance" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-fresh-rollout-checklist-card"' "$FRESH_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] fresh rollout detail lost the first-review checklist card" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-fresh-rollout-checklist-title"[^>]*>Verify this rollout before you move on<' "$FRESH_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] fresh rollout detail lost the explicit verification checklist title" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-main-next-step-action-secondary"[^>]*>Review runtime overview<' "$FRESH_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] fresh rollout detail does not keep review-first secondary guidance" >&2
  exit 1
fi

if grep -Eq 'data-testid="runtime-detail-main-next-step-action-secondary"[^>]*>Prepare rollout change<' "$FRESH_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] fresh rollout detail still exposes prepare-change as the immediate secondary path" >&2
  exit 1
fi

if grep -Eq 'data-testid="runtime-detail-tab-change"' "$FRESH_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] fresh rollout detail still exposes the change tab before verification" >&2
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

if ! grep -Eq 'data-testid="runtime-detail-passport-incident-card"' "$FAILED_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] failed runtime passport did not switch into incident mode" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-passport-incident-title"[^>]*>Use the passport as the incident brief<' "$FAILED_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] failed runtime passport lost the incident brief title" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-passport-incident-item-likely-cause"' "$FAILED_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] failed runtime passport lost the likely-cause cue" >&2
  exit 1
fi

if ! grep -Eq 'Container exited after readiness timeout on port 9090\.' "$FAILED_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] failed runtime passport lost the concrete likely cause detail" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-passport-incident-item-safe-action-now"' "$FAILED_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] failed runtime passport lost the safe-action cue" >&2
  exit 1
fi

if ! grep -Eq '>Review runtime issues<' "$FAILED_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] failed runtime passport lost the review-first safe action" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-passport-incident-item-escalation-path"' "$FAILED_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] failed runtime passport lost the escalation cue" >&2
  exit 1
fi

if ! grep -Eq 'copy the deployment passport summary and export the incident snapshot before attempting redeploy or rollback\.' "$FAILED_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] failed runtime passport lost the escalation path detail" >&2
  exit 1
fi

if ! grep -Eq 'data-testid="runtime-detail-passport-item-recovery-path"' "$FAILED_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] failed runtime passport lost the recovery path cue" >&2
  exit 1
fi

if ! grep -Eq '>Diagnose, then review redeploy<' "$FAILED_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] failed runtime passport lost the explicit redeploy-first recovery path" >&2
  exit 1
fi

if ! grep -Eq 'No previous running release snapshot is available yet\.' "$FAILED_DETAIL_HTML"; then
  echo "[frontend-runtime-smoke] failed runtime passport lost the no-rollback recovery explanation" >&2
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

  export PORT="${FRONTEND_SMOKE_HEALTHY_RUNTIME_PORT:-${RUNTIME_SCENARIO_PORT_BASE}}"
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

  if ! grep -Eq 'data-testid="runtime-deployment-open-app-link-smoke-stack-runtime"[^>]*>Open health target<' "$HEALTHY_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] healthy workflow no longer exposes the stack health target as the runtime review action" >&2
    exit 1
  fi
)

(
  set -euo pipefail
  source "${SCRIPT_DIR}/frontend_smoke_shared.sh"

  export PORT="${FRONTEND_SMOKE_DISK_BLOCKED_RUNTIME_PORT:-$((RUNTIME_SCENARIO_PORT_BASE + 1))}"
  export BASE_URL="http://127.0.0.1:${PORT}"
  export SERVER_LOG="${FRONTEND_SMOKE_DISK_BLOCKED_RUNTIME_LOG:-/tmp/deploymate-frontend-disk-blocked-runtime-smoke.log}"
  export DIST_DIR="${FRONTEND_SMOKE_DISK_BLOCKED_RUNTIME_DIST_DIR:-.next-smoke-disk-blocked-runtime-${PORT}}"
  export FRONTEND_SMOKE_PORT="$PORT"
  export FRONTEND_SMOKE_LOG="$SERVER_LOG"
  export FRONTEND_SMOKE_DIST_DIR="$DIST_DIR"
  export FRONTEND_SMOKE_REUSE_SERVER=0
  export NEXT_PUBLIC_SMOKE_DEPLOYMENT_WORKFLOW_SCENARIO=disk-pressure-blocked

  cleanup_disk_blocked_runtime() {
    stop_frontend_smoke_server
  }

  trap cleanup_disk_blocked_runtime EXIT

  start_frontend_smoke_server
  wait_for_frontend_smoke_url "/app/deployment-workflow"

  curl -sS "${BASE_URL}/app/deployment-workflow" > "$DISK_BLOCKED_WORKFLOW_HTML"

  if ! grep -Eq 'data-testid="deployment-workflow-disk-guardrail-card"' "$DISK_BLOCKED_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] disk-pressure workflow lost the dedicated guardrail card" >&2
    exit 1
  fi

  if ! grep -Eq 'data-testid="deployment-workflow-main-next-step-focus"[^>]*>DeployMate host root disk is 86% full<' "$DISK_BLOCKED_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] disk-pressure workflow lost the host-disk next-step focus" >&2
    exit 1
  fi

  if ! grep -Eq 'Free space on the DeployMate host, refresh overview, and only then start another rollout from this workspace\.' "$DISK_BLOCKED_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] disk-pressure workflow lost the explicit cleanup-first action path" >&2
    exit 1
  fi

  if ! grep -Eq 'data-testid="deployment-workflow-hero-primary-action"[^>]*>Review live apps instead<' "$DISK_BLOCKED_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] disk-pressure workflow lost the review-live fallback CTA" >&2
    exit 1
  fi

  if ! grep -Eq 'data-testid="create-deployment-disk-guardrail-banner"' "$DISK_BLOCKED_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] disk-pressure workflow lost the create-form guardrail banner" >&2
    exit 1
  fi

  if ! grep -Eq 'data-testid="stack-intake-disk-guardrail-banner"' "$DISK_BLOCKED_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] disk-pressure workflow lost the stack guardrail banner" >&2
    exit 1
  fi

  if ! grep -Eq 'data-testid="templates-disk-guardrail-banner"' "$DISK_BLOCKED_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] disk-pressure workflow lost the template guardrail banner" >&2
    exit 1
  fi

  if ! grep -Eq '(<button[^>]*data-testid="create-deployment-submit-button"[^>]*disabled)|(<button[^>]*disabled[^>]*data-testid="create-deployment-submit-button")' "$DISK_BLOCKED_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] disk-pressure workflow still leaves create deployment enabled" >&2
    exit 1
  fi

  if ! grep -Eq '(<button[^>]*data-testid="stack-intake-deploy-button"[^>]*disabled)|(<button[^>]*disabled[^>]*data-testid="stack-intake-deploy-button")' "$DISK_BLOCKED_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] disk-pressure workflow still leaves stack deploy enabled" >&2
    exit 1
  fi

  if ! grep -Eq '(<button[^>]*data-testid="template-deploy-button-smoke-template"[^>]*disabled)|(<button[^>]*disabled[^>]*data-testid="template-deploy-button-smoke-template")' "$DISK_BLOCKED_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] disk-pressure workflow still leaves template deploy enabled" >&2
    exit 1
  fi

  if ! grep -Eq '>Blocked by low disk<' "$DISK_BLOCKED_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] disk-pressure workflow lost the blocked template deploy label" >&2
    exit 1
  fi
)

(
  set -euo pipefail
  source "${SCRIPT_DIR}/frontend_smoke_shared.sh"

  export PORT="${FRONTEND_SMOKE_FAILED_RUNTIME_PORT:-$((RUNTIME_SCENARIO_PORT_BASE + 2))}"
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

  export PORT="${FRONTEND_SMOKE_INTERNAL_RUNTIME_PORT:-$((RUNTIME_SCENARIO_PORT_BASE + 3))}"
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

  export PORT="${FRONTEND_SMOKE_ADMIN_MANAGED_RUNTIME_PORT:-$((RUNTIME_SCENARIO_PORT_BASE + 4))}"
  export BASE_URL="http://127.0.0.1:${PORT}"
  export SERVER_LOG="${FRONTEND_SMOKE_ADMIN_MANAGED_RUNTIME_LOG:-/tmp/deploymate-frontend-admin-managed-runtime-smoke.log}"
  export DIST_DIR="${FRONTEND_SMOKE_ADMIN_MANAGED_RUNTIME_DIST_DIR:-.next-smoke-admin-managed-runtime-${PORT}}"
  export FRONTEND_SMOKE_PORT="$PORT"
  export FRONTEND_SMOKE_LOG="$SERVER_LOG"
  export FRONTEND_SMOKE_DIST_DIR="$DIST_DIR"
  export FRONTEND_SMOKE_REUSE_SERVER=0
  export NEXT_PUBLIC_SMOKE_USER_ROLE=member

  cleanup_admin_managed_runtime() {
    stop_frontend_smoke_server
  }

  trap cleanup_admin_managed_runtime EXIT

  start_frontend_smoke_server
  wait_for_frontend_smoke_url "/deployments/admin-managed-runtime"

  curl -sS "${BASE_URL}/deployments/admin-managed-runtime" > "$ADMIN_MANAGED_DETAIL_HTML"

  if ! grep -Eq 'data-testid="runtime-detail-admin-managed-live-checks-banner"' "$ADMIN_MANAGED_DETAIL_HTML"; then
    echo "[frontend-runtime-smoke] member admin-managed runtime detail lost the live-check ownership banner" >&2
    exit 1
  fi

  if ! grep -Eq 'data-testid="runtime-detail-passport-item-ownership"' "$ADMIN_MANAGED_DETAIL_HTML"; then
    echo "[frontend-runtime-smoke] member admin-managed runtime detail lost the passport ownership item" >&2
    exit 1
  fi

  if ! grep -Eq '>Your runtime on admin-managed target<' "$ADMIN_MANAGED_DETAIL_HTML"; then
    echo "[frontend-runtime-smoke] member admin-managed runtime detail lost the explicit ownership cue" >&2
    exit 1
  fi

  if ! grep -Eq 'data-testid="runtime-detail-handoff-ownership"[^>]*>Your runtime on admin-managed target\. You own the deployment record, but live health, logs, change, delete, and reusable setup stay with admins until server sharing exists\.<' "$ADMIN_MANAGED_DETAIL_HTML"; then
    echo "[frontend-runtime-smoke] member admin-managed runtime detail lost the handoff ownership export cue" >&2
    exit 1
  fi

  if grep -Eq 'data-testid="runtime-detail-tab-change"' "$ADMIN_MANAGED_DETAIL_HTML"; then
    echo "[frontend-runtime-smoke] member admin-managed runtime detail still exposes the change tab" >&2
    exit 1
  fi
)

(
  set -euo pipefail
  source "${SCRIPT_DIR}/frontend_smoke_shared.sh"

  export PORT="${FRONTEND_SMOKE_TEMPLATE_SUCCESS_PORT:-$((RUNTIME_SCENARIO_PORT_BASE + 5))}"
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

  if ! grep -Eq 'data-testid="templates-team-asset-title"[^>]*>Treat templates as reusable handoff assets<' "$TEMPLATE_SUCCESS_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] template workflow lost the reusable handoff asset framing" >&2
    exit 1
  fi

  if ! grep -Eq '(<a[^>]*data-testid="template-deploy-success-open-detail-link"[^>]*class="[^"]*landingButton primaryButton[^"]*")|(<a[^>]*class="[^"]*landingButton primaryButton[^"]*"[^>]*data-testid="template-deploy-success-open-detail-link")' "$TEMPLATE_SUCCESS_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] template deploy success does not make runtime detail the primary action" >&2
    exit 1
  fi

  if ! grep -Eq 'data-testid="template-deploy-success-open-detail-link"[^>]*>Open deployment passport<' "$TEMPLATE_SUCCESS_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] template deploy success lost the explicit deployment-passport action label" >&2
    exit 1
  fi

  if ! grep -Eq '(<a[^>]*data-testid="template-deploy-success-open-detail-link"[^>]*href="/deployments/template-success-deployment\?source=workflow-success#runtime-detail-passport")|(<a[^>]*href="/deployments/template-success-deployment\?source=workflow-success#runtime-detail-passport"[^>]*data-testid="template-deploy-success-open-detail-link")' "$TEMPLATE_SUCCESS_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] template deploy success passport link lost the workflow-success context" >&2
    exit 1
  fi

  if ! grep -Eq '(<button[^>]*data-testid="template-deploy-success-open-live-button"[^>]*class="[^"]*secondaryButton[^"]*")|(<button[^>]*class="[^"]*secondaryButton[^"]*"[^>]*data-testid="template-deploy-success-open-live-button")' "$TEMPLATE_SUCCESS_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] template deploy success does not keep live queue review secondary" >&2
    exit 1
  fi
)

(
  set -euo pipefail
  source "${SCRIPT_DIR}/frontend_smoke_shared.sh"

  export PORT="${FRONTEND_SMOKE_CREATE_SUCCESS_PORT:-$((RUNTIME_SCENARIO_PORT_BASE + 6))}"
  export BASE_URL="http://127.0.0.1:${PORT}"
  export SERVER_LOG="${FRONTEND_SMOKE_CREATE_SUCCESS_LOG:-/tmp/deploymate-frontend-create-success-smoke.log}"
  export DIST_DIR="${FRONTEND_SMOKE_CREATE_SUCCESS_DIST_DIR:-.next-smoke-create-success-${PORT}}"
  export FRONTEND_SMOKE_PORT="$PORT"
  export FRONTEND_SMOKE_LOG="$SERVER_LOG"
  export FRONTEND_SMOKE_DIST_DIR="$DIST_DIR"
  export FRONTEND_SMOKE_REUSE_SERVER=0
  export NEXT_PUBLIC_SMOKE_DEPLOYMENT_WORKFLOW_SCENARIO=create-deploy-success

  cleanup_create_success() {
    stop_frontend_smoke_server
  }

  trap cleanup_create_success EXIT

  start_frontend_smoke_server
  wait_for_frontend_smoke_url "/app/deployment-workflow"

  curl -sS "${BASE_URL}/app/deployment-workflow" > "$CREATE_SUCCESS_WORKFLOW_HTML"

  if ! grep -Eq 'data-testid="create-deployment-success-banner"' "$CREATE_SUCCESS_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] create success scenario lost the success banner" >&2
    exit 1
  fi

  if ! grep -Eq '(<a[^>]*data-testid="create-deployment-success-open-detail-link"[^>]*class="[^"]*landingButton primaryButton[^"]*")|(<a[^>]*class="[^"]*landingButton primaryButton[^"]*"[^>]*data-testid="create-deployment-success-open-detail-link")' "$CREATE_SUCCESS_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] create success does not make runtime detail the primary action" >&2
    exit 1
  fi

  if ! grep -Eq 'data-testid="create-deployment-success-open-detail-link"[^>]*>Open deployment passport<' "$CREATE_SUCCESS_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] create success lost the explicit deployment-passport action label" >&2
    exit 1
  fi

  if ! grep -Eq '(<a[^>]*data-testid="create-deployment-success-open-detail-link"[^>]*href="/deployments/fresh-success-deployment\?source=workflow-success#runtime-detail-passport")|(<a[^>]*href="/deployments/fresh-success-deployment\?source=workflow-success#runtime-detail-passport"[^>]*data-testid="create-deployment-success-open-detail-link")' "$CREATE_SUCCESS_WORKFLOW_HTML"; then
    echo "[frontend-runtime-smoke] create success passport link lost the workflow-success context" >&2
    exit 1
  fi
)

run_runtime_export_handoff_smoke

echo "[frontend-runtime-smoke] app runtime surface rendered"
echo "[frontend-runtime-smoke] deployment detail surface rendered"
echo "[frontend-runtime-smoke] internal-only runtime detail rendered"
echo "[frontend-runtime-smoke] healthy workflow happy path rendered"
echo "[frontend-runtime-smoke] failed secondary workflow review path rendered"
echo "[frontend-runtime-smoke] internal-only workflow review path rendered"
echo "[frontend-runtime-smoke] member admin-managed runtime ownership cue rendered"
echo "[frontend-runtime-smoke] runtime export handoff helper rendered"
echo "[frontend-runtime-smoke] template deploy success path rendered"
echo "[frontend-runtime-smoke] create deploy success path rendered"
echo "[frontend-runtime-smoke] complete"
