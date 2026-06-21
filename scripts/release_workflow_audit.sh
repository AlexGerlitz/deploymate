#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/audit_cache.sh"
source "$ROOT_DIR/scripts/lib/project_automation_targets.sh"
cd "$ROOT_DIR"

RELEASE_WORKFLOW=".github/workflows/release.yml"
STAGING_WORKFLOW=".github/workflows/staging.yml"
SECRETS_AUDIT_WORKFLOW=".github/workflows/release-secrets-audit.yml"
MAINTENANCE_STATUS_WORKFLOW=".github/workflows/release-maintenance-status.yml"
PUBLIC_EVIDENCE_WORKFLOW=".github/workflows/public-evidence-bundle.yml"
SECRETS_AUDIT_ACTION=".github/actions/release-secrets-audit/action.yml"
RELEASE_AUDIT_INCIDENT_ACTION=".github/actions/release-audit-incident/action.yml"
RELEASE_AUDIT_FAILURE_CLASSIFIER="scripts/release_audit_failure_classifier.js"
RELEASE_MAINTENANCE_SCRIPT="scripts/release_maintenance_status.sh"
PUBLIC_EVIDENCE_SCRIPT="scripts/public_evidence_bundle.py"
REVIEW_PACKET_VERIFY_SCRIPT="scripts/verify_review_packet.py"
LATEST_REVIEW_PACKET_SCRIPT="scripts/check_latest_review_packet_artifact.py"
PUBLIC_REVIEW_GATE_SCRIPT="scripts/public_review_gate.sh"
RELEASE_INCIDENT_DIAGNOSTICS_SCRIPT="scripts/release_incident_diagnostics.py"
RUNBOOK_FILE="RUNBOOK.md"

extract_workflow_secrets() {
  local file="$1"
  grep -oE 'secrets\.[A-Z0-9_]+' "$file" \
    | sed 's/^secrets\.//' \
    | sort -u
}

extract_runbook_secrets() {
  python3 - "$RUNBOOK_FILE" <<'PY'
import re
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as fh:
    lines = fh.readlines()

capture = False
names = set()
for line in lines:
    if line.startswith("GitHub Actions release workflow secrets for runtime smoke:"):
        capture = True
        continue
    if capture and line.startswith("Runtime smoke notes:"):
        break
    if capture:
        names.update(re.findall(r"`([A-Z0-9_]+)`", line))

for name in sorted(names):
    print(name)
PY
}

extract_runbook_audit_secrets() {
  python3 - "$RUNBOOK_FILE" <<'PY'
import re
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as fh:
    lines = fh.readlines()

capture = False
names = set()
for line in lines:
    if line.startswith("Required GitHub Actions release secrets audit workflow secrets:"):
        capture = True
        continue
    if capture and line.startswith("Runtime smoke notes:"):
        break
    if capture:
        names.update(re.findall(r"`([A-Z0-9_]+)`", line))

for name in sorted(names):
    print(name)
PY
}

cache_contract_output() {
  local cache_key="$1"
  local fingerprint="$2"
  local output_file="$3"
  local extractor="$4"
  shift 4 || true

  if audit_cache_persistent_has "$cache_key" "$fingerprint"; then
    if audit_cache_persistent_read_value "$cache_key" >"$output_file"; then
      audit_cache_record_event persistent_hit release_workflow_audit
      return 0
    fi
  fi

  audit_cache_record_event persistent_miss release_workflow_audit
  "$extractor" "$@" >"$output_file"
  audit_cache_persistent_mark "$cache_key" "$fingerprint"
  audit_cache_persistent_store_file "$cache_key" "$output_file"
  return 1
}

compare_lists() {
  local label="$1"
  local left_file="$2"
  local right_file="$3"
  local diff_file
  diff_file="$(mktemp)"

  if diff -u "$left_file" "$right_file" >"$diff_file"; then
    rm -f "$diff_file"
    return 0
  fi

  echo "[release-audit] mismatch: $label" >&2
  cat "$diff_file" >&2
  rm -f "$diff_file"
  return 1
}

audit_release_secrets_workflow_shape() {
  python3 - "$SECRETS_AUDIT_WORKFLOW" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

required_jobs = [
    "scheduled-paused",
    "manual-audit",
    "scheduled-production",
    "scheduled-staging",
    "incident-self-test",
]
for job in required_jobs:
    if not re.search(rf"^  {re.escape(job)}:\s*$", text, flags=re.MULTILINE):
        raise SystemExit(f"[release-audit] {path} is missing explicit job {job}")

if re.search(r"^\s+strategy:\s*$", text, flags=re.MULTILINE):
    raise SystemExit(f"[release-audit] {path} must not use strategy/matrix for audit modes")

if re.search(r"^\s+matrix:\s*$", text, flags=re.MULTILINE):
    raise SystemExit(f"[release-audit] {path} must not use strategy/matrix for audit modes")

if "uses: actions/github-script@v8" in text:
    raise SystemExit(f"[release-audit] {path} should call the local incident action instead of inline github-script")

if text.count("uses: ./.github/actions/release-secrets-audit") != 3:
    raise SystemExit(f"[release-audit] {path} should call the audit action from manual and scheduled jobs only")

if text.count("uses: ./.github/actions/release-audit-incident") != 3:
    raise SystemExit(f"[release-audit] {path} should call the incident action from both scheduled jobs and self-test")

if "failure-category: ${{ steps.audit.outputs['failure-category'] }}" not in text:
    raise SystemExit(f"[release-audit] {path} should pass the classified failure category into incident triage")

if "operator-hint: ${{ steps.audit.outputs['operator-hint'] }}" not in text:
    raise SystemExit(f"[release-audit] {path} should pass the classified operator hint into incident triage")

if "vars.RELEASE_AUDIT_SCHEDULED_PAUSED == 'true'" not in text:
    raise SystemExit(f"[release-audit] {path} should expose an explicit scheduled audit pause job")

if text.count("vars.RELEASE_AUDIT_SCHEDULED_PAUSED != 'true'") != 2:
    raise SystemExit(f"[release-audit] {path} should gate production and staging scheduled jobs on the pause variable")
PY
}

audit_release_secrets_action_shape() {
  python3 - "$SECRETS_AUDIT_ACTION" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

if "id: audit" not in text:
    raise SystemExit(f"[release-audit] {path} must give the secret-contract step id: audit")

if "${{ job.status }}" in text:
    raise SystemExit(f"[release-audit] {path} must not report composite action status from job.status")

if text.count("${{ steps.audit.outcome == 'success' && 'success' || 'failure' }}") != 2:
    raise SystemExit(f"[release-audit] {path} should report summary and notification status from steps.audit.outcome")

required_snippets = [
    "outputs:",
    "failure-category:",
    "operator-hint:",
    "node scripts/release_audit_failure_classifier.js",
    "--format github-output >> \"$GITHUB_OUTPUT\"",
]
for snippet in required_snippets:
    if snippet not in text:
        raise SystemExit(f"[release-audit] {path} is missing audit failure classifier snippet {snippet!r}")
PY
}

audit_release_incident_action_shape() {
  python3 - "$RELEASE_AUDIT_INCIDENT_ACTION" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

required_snippets = [
    "failure-category:",
    "operator-hint:",
    "AUDIT_FAILURE_CATEGORY:",
    "AUDIT_OPERATOR_HINT:",
]
for snippet in required_snippets:
    if snippet not in text:
        raise SystemExit(f"[release-audit] {path} is missing classified incident snippet {snippet!r}")
PY
}

audit_release_maintenance_workflow_shape() {
  python3 - "$MAINTENANCE_STATUS_WORKFLOW" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

required_snippets = [
    "name: Release Maintenance Status",
    "workflow_dispatch:",
    "schedule:",
    "permissions:",
    "issues: read",
    "--format json",
    "--format markdown",
    "release-maintenance-status.json",
    "release-maintenance-status.md",
    "uses: actions/upload-artifact@v7",
]

for snippet in required_snippets:
    if snippet not in text:
        raise SystemExit(f"[release-audit] {path} is missing {snippet!r}")

if "--require-ready" not in text:
    raise SystemExit(f"[release-audit] {path} must support require_ready gating")

if "vars.RELEASE_AUDIT_SCHEDULED_PAUSED" not in text or "vars.STAGING_RELEASE_PAUSED" not in text:
    raise SystemExit(f"[release-audit] {path} must pass release pause variables into the status script")
PY
}

audit_release_maintenance_script_shape() {
  python3 - "$RELEASE_MAINTENANCE_SCRIPT" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

required_snippets = [
    "release_incident_diagnostics.py",
    "issue_${issue}_failure_category",
    "issue_${issue}_operator_hint",
    "## Incident Diagnostics",
]
for snippet in required_snippets:
    if snippet not in text:
        raise SystemExit(f"[release-audit] {path} is missing incident diagnostics snippet {snippet!r}")
PY
}

audit_public_evidence_workflow_shape() {
  python3 - "$PUBLIC_EVIDENCE_WORKFLOW" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

required_snippets = [
    "name: Public Evidence Bundle",
    "workflow_run:",
    "- CI",
    "github.event.workflow_run.conclusion == 'success'",
    "github.event.workflow_run.head_sha",
    "github.event.workflow_run.head_branch",
    "workflow_dispatch:",
    "schedule:",
    "actions: read",
    "issues: write",
    "default: true",
    "publish_incident_comment:",
    "if [ \"$GITHUB_EVENT_NAME\" = \"schedule\" ]; then",
    "check_network=\"true\"",
    "publish_incident_comment=\"false\"",
    "scripts/public_evidence_bundle.py",
    "scripts/export_review_packet.py",
    "scripts/verify_review_packet.py",
    "--format review-index",
    "--publish-open-incident-comments",
    "review_packet_args=(--repo \"$GITHUB_REPOSITORY\" --branch \"$branch\" --output deploymate-review-packet)",
    "python3 scripts/verify_review_packet.py deploymate-review-packet",
    "deploymate-public-evidence.json",
    "deploymate-review-index.json",
    "deploymate-public-evidence.md",
    "deploymate-incident-comment-publish-result.json",
    "name: deploymate-review-packet",
    "path: deploymate-review-packet/",
    "uses: actions/upload-artifact@v7",
]

for snippet in required_snippets:
    if snippet not in text:
        raise SystemExit(f"[release-audit] {path} is missing {snippet!r}")
PY
}

audit_public_evidence_script_shape() {
  python3 - "$PUBLIC_EVIDENCE_SCRIPT" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

required_snippets = [
    "## Incident Diagnostics",
    "## Review Index",
    "## Release Repair Playbook",
    "build_review_index",
    "build_repair_playbook",
    "review_index",
    "issue_18_failure_category",
    "issue_19_failure_category",
    "issue_18_operator_hint",
    "issue_19_operator_hint",
]
for snippet in required_snippets:
    if snippet not in text:
        raise SystemExit(f"[release-audit] {path} is missing public evidence incident snippet {snippet!r}")
PY
}

audit_review_packet_verify_script_shape() {
  python3 - "$REVIEW_PACKET_VERIFY_SCRIPT" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

required_snippets = [
    "Verify a DeployMate review packet manifest.",
    "MANIFEST.json",
    "sha256 mismatch",
    "byte size mismatch",
    "unexpected files",
    "[review-packet-verify] ok",
]
for snippet in required_snippets:
    if snippet not in text:
        raise SystemExit(f"[release-audit] {path} is missing review packet verifier snippet {snippet!r}")
PY
}

audit_latest_review_packet_script_shape() {
  python3 - "$LATEST_REVIEW_PACKET_SCRIPT" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

required_snippets = [
    "Download and verify the latest DeployMate review packet artifact.",
    '"gh",',
    '"list",',
    '"download",',
    "deploymate-review-packet",
    "verify_review_packet.py",
    "review packet run mismatch",
    "[review-packet-artifact] ok",
]
for snippet in required_snippets:
    if snippet not in text:
        raise SystemExit(f"[release-audit] {path} is missing latest artifact checker snippet {snippet!r}")
PY
}

audit_public_review_gate_script_shape() {
  python3 - "$PUBLIC_REVIEW_GATE_SCRIPT" "Makefile" <<'PY'
import sys
from pathlib import Path

script = Path(sys.argv[1]).read_text(encoding="utf-8")
makefile = Path(sys.argv[2]).read_text(encoding="utf-8")

required_script_snippets = [
    "bash scripts/release_workflow_audit.sh",
    "python3 scripts/export_review_packet.py",
    "python3 scripts/verify_review_packet.py",
    "python3 scripts/check_latest_review_packet_artifact.py",
    "--skip-github",
    "--with-frontend",
    "npm --prefix frontend run smoke:review",
    "[public-review] ok",
]
for snippet in required_script_snippets:
    if snippet not in script:
        raise SystemExit(f"[release-audit] scripts/public_review_gate.sh is missing {snippet!r}")

required_makefile_snippets = [
    "public-review:",
    "bash scripts/public_review_gate.sh $(PUBLIC_REVIEW_FLAGS)",
]
for snippet in required_makefile_snippets:
    if snippet not in makefile:
        raise SystemExit(f"[release-audit] Makefile is missing public review gate snippet {snippet!r}")
PY
}

audit_public_evidence_docs_shape() {
  python3 - <<'PY'
from pathlib import Path

readme = Path("README.md").read_text(encoding="utf-8")
runbook = Path("RUNBOOK.md").read_text(encoding="utf-8")
release_notes = Path("docs/releases/v0.1.0.md").read_text(encoding="utf-8")

required_readme = [
    "Public Evidence Bundle",
    "deploymate-review-packet",
    "make public-review",
    "check_latest_review_packet_artifact.py",
    "verify_review_packet.py",
    "public review packet with CI, release-maintenance, incident status, repair playbook, README, manifest, and SHA-256 checksums",
    "## Live Target Status",
    "Public network check",
    "availability is intentionally verified through release maintenance evidence",
    "actions/workflows/ci.yml/badge.svg?branch=develop",
    "actions/workflows/public-evidence-bundle.yml/badge.svg?branch=develop",
    "actions/workflows/release-maintenance-status.yml/badge.svg?branch=develop",
]
for snippet in required_readme:
    if snippet not in readme:
        raise SystemExit(f"[release-audit] README.md is missing public evidence snippet {snippet!r}")

required_runbook = [
    "python3 scripts/public_evidence_bundle.py --format markdown",
    "deploymate-public-evidence.json",
    "deploymate-public-evidence.md",
    "deploymate-review-packet",
    "python3 scripts/check_latest_review_packet_artifact.py",
    "make public-review",
    "PUBLIC_REVIEW_FLAGS=--with-frontend",
    "python3 scripts/verify_review_packet.py dist/review",
]
for snippet in required_runbook:
    if snippet not in runbook:
        raise SystemExit(f"[release-audit] RUNBOOK.md is missing public evidence snippet {snippet!r}")

required_release_notes = [
    "live target availability tracked by release maintenance evidence",
    "open the latest `Public Evidence Bundle` artifact and check `Public network check`",
    "if the public target is paused or unavailable, use the screenshots, release evidence, and route map from `README.md`",
]
for snippet in required_release_notes:
    if snippet not in release_notes:
        raise SystemExit(f"[release-audit] docs/releases/v0.1.0.md is missing live target status snippet {snippet!r}")

for stale_claim in [
    "with a live demo at `https://deploymatecloud.ru`",
    "1. open `https://deploymatecloud.ru/register`",
]:
    if stale_claim in release_notes:
        raise SystemExit(f"[release-audit] docs/releases/v0.1.0.md still overclaims live target status: {stale_claim!r}")
PY
}

audit_release_surface_classification() {
  local path="$1"
  local expected="$2"
  local actual
  actual="$(automation_classify_release_path "$path")"
  if [ "$actual" != "$expected" ]; then
    echo "[release-audit] expected $path to classify as $expected, got $actual" >&2
    return 1
  fi
}

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

audit_cache_prepare
audit_release_secrets_workflow_shape
audit_release_secrets_action_shape
audit_release_incident_action_shape
audit_release_maintenance_workflow_shape
audit_release_maintenance_script_shape
audit_public_evidence_workflow_shape
audit_public_evidence_script_shape
audit_review_packet_verify_script_shape
audit_latest_review_packet_script_shape
audit_public_review_gate_script_shape
audit_public_evidence_docs_shape
audit_release_surface_classification "backend/tests/test_production_env_audit.py" "docs"
audit_release_surface_classification "backend/app/main.py" "backend"
audit_release_surface_classification "Makefile" "docs"
audit_release_surface_classification ".github/workflows/release-maintenance-status.yml" "docs"
audit_release_surface_classification ".github/workflows/public-evidence-bundle.yml" "docs"
audit_release_surface_classification "scripts/public_evidence_bundle.py" "docs"
audit_release_surface_classification "scripts/verify_review_packet.py" "docs"
audit_release_surface_classification "scripts/check_latest_review_packet_artifact.py" "docs"
audit_release_surface_classification "scripts/public_review_gate.sh" "docs"
audit_release_surface_classification "scripts/release_incident_diagnostics.py" "docs"

release_audit_fingerprint="$(audit_cache_fingerprint_files \
  "release-workflow-audit" \
  "$RELEASE_WORKFLOW" \
  "$STAGING_WORKFLOW" \
  "$SECRETS_AUDIT_WORKFLOW" \
  "$MAINTENANCE_STATUS_WORKFLOW" \
  "$PUBLIC_EVIDENCE_WORKFLOW" \
  "$SECRETS_AUDIT_ACTION" \
  "$RELEASE_AUDIT_INCIDENT_ACTION" \
  "$RELEASE_AUDIT_FAILURE_CLASSIFIER" \
  "$RELEASE_MAINTENANCE_SCRIPT" \
  "$PUBLIC_EVIDENCE_SCRIPT" \
  "$REVIEW_PACKET_VERIFY_SCRIPT" \
  "$LATEST_REVIEW_PACKET_SCRIPT" \
  "$PUBLIC_REVIEW_GATE_SCRIPT" \
  "Makefile" \
  "$RELEASE_INCIDENT_DIAGNOSTICS_SCRIPT" \
  "$RUNBOOK_FILE")"

if audit_cache_persistent_has "release_workflow_audit" "$release_audit_fingerprint"; then
  echo "[release-audit] cache hit"
  audit_cache_record_event persistent_hit release_workflow_audit
  exit 0
fi

audit_cache_record_event persistent_miss release_workflow_audit

echo "[release-audit] repo: $ROOT_DIR"

release_secrets_file="$TMP_DIR/release-secrets.txt"
staging_secrets_file="$TMP_DIR/staging-secrets.txt"
secrets_audit_file="$TMP_DIR/release-secrets-audit.txt"
runbook_secrets_file="$TMP_DIR/runbook-secrets.txt"
runbook_audit_secrets_file="$TMP_DIR/runbook-audit-secrets.txt"
release_contract_cache_hits=0
release_contract_cache_misses=0

release_file_key="$(audit_cache_key_for_input "release_workflow_contract" "$RELEASE_WORKFLOW")"
release_file_fingerprint="$(audit_cache_fingerprint_files "release-workflow-contract:${RELEASE_WORKFLOW}" "$RELEASE_WORKFLOW")"
if cache_contract_output "$release_file_key" "$release_file_fingerprint" "$release_secrets_file" extract_workflow_secrets "$RELEASE_WORKFLOW"; then
  release_contract_cache_hits=$((release_contract_cache_hits + 1))
else
  release_contract_cache_misses=$((release_contract_cache_misses + 1))
fi

staging_file_key="$(audit_cache_key_for_input "release_workflow_contract" "$STAGING_WORKFLOW")"
staging_file_fingerprint="$(audit_cache_fingerprint_files "release-workflow-contract:${STAGING_WORKFLOW}" "$STAGING_WORKFLOW")"
if cache_contract_output "$staging_file_key" "$staging_file_fingerprint" "$staging_secrets_file" extract_workflow_secrets "$STAGING_WORKFLOW"; then
  release_contract_cache_hits=$((release_contract_cache_hits + 1))
else
  release_contract_cache_misses=$((release_contract_cache_misses + 1))
fi

secrets_audit_key="$(audit_cache_key_for_input "release_workflow_contract" "$SECRETS_AUDIT_WORKFLOW")"
secrets_audit_fingerprint="$(audit_cache_fingerprint_files "release-workflow-contract:${SECRETS_AUDIT_WORKFLOW}" "$SECRETS_AUDIT_WORKFLOW")"
if cache_contract_output "$secrets_audit_key" "$secrets_audit_fingerprint" "$secrets_audit_file" extract_workflow_secrets "$SECRETS_AUDIT_WORKFLOW"; then
  release_contract_cache_hits=$((release_contract_cache_hits + 1))
else
  release_contract_cache_misses=$((release_contract_cache_misses + 1))
fi

runbook_file_key="$(audit_cache_key_for_input "release_workflow_contract" "$RUNBOOK_FILE")"
runbook_file_fingerprint="$(audit_cache_fingerprint_files "release-workflow-contract:${RUNBOOK_FILE}" "$RUNBOOK_FILE")"
if cache_contract_output "$runbook_file_key" "$runbook_file_fingerprint" "$runbook_secrets_file" extract_runbook_secrets; then
  release_contract_cache_hits=$((release_contract_cache_hits + 1))
else
  release_contract_cache_misses=$((release_contract_cache_misses + 1))
fi

runbook_audit_file_key="$(audit_cache_key_for_input "release_workflow_contract_audit" "$RUNBOOK_FILE")"
runbook_audit_file_fingerprint="$(audit_cache_fingerprint_files "release-workflow-contract-audit:${RUNBOOK_FILE}" "$RUNBOOK_FILE")"
if cache_contract_output "$runbook_audit_file_key" "$runbook_audit_file_fingerprint" "$runbook_audit_secrets_file" extract_runbook_audit_secrets; then
  release_contract_cache_hits=$((release_contract_cache_hits + 1))
else
  release_contract_cache_misses=$((release_contract_cache_misses + 1))
fi

echo "[release-audit] contract extraction reused ${release_contract_cache_hits} file results; rescanned ${release_contract_cache_misses}"

compare_lists "release.yml vs staging.yml secrets" "$release_secrets_file" "$staging_secrets_file"
compare_lists "release-secrets-audit.yml vs RUNBOOK.md audit secrets" "$secrets_audit_file" "$runbook_audit_secrets_file"
compare_lists "workflow secrets vs RUNBOOK.md" "$release_secrets_file" "$runbook_secrets_file"

echo "[release-audit] release and staging workflows use the same full secret contract"
echo "[release-audit] release-secrets-audit workflow matches the documented minimal audit secret contract"
echo "[release-audit] RUNBOOK.md matches the workflow secret contract"
audit_cache_persistent_mark "release_workflow_audit" "$release_audit_fingerprint"
