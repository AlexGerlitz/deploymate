#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/audit_cache.sh"
cd "$ROOT_DIR"

RELEASE_WORKFLOW=".github/workflows/release.yml"
STAGING_WORKFLOW=".github/workflows/staging.yml"
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
  audit_cache_persistent_store_value "$cache_key" "$(cat "$output_file")"
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

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

audit_cache_prepare

release_audit_fingerprint="$(audit_cache_fingerprint_files \
  "release-workflow-audit" \
  "$RELEASE_WORKFLOW" \
  "$STAGING_WORKFLOW" \
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
runbook_secrets_file="$TMP_DIR/runbook-secrets.txt"
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

runbook_file_key="$(audit_cache_key_for_input "release_workflow_contract" "$RUNBOOK_FILE")"
runbook_file_fingerprint="$(audit_cache_fingerprint_files "release-workflow-contract:${RUNBOOK_FILE}" "$RUNBOOK_FILE")"
if cache_contract_output "$runbook_file_key" "$runbook_file_fingerprint" "$runbook_secrets_file" extract_runbook_secrets; then
  release_contract_cache_hits=$((release_contract_cache_hits + 1))
else
  release_contract_cache_misses=$((release_contract_cache_misses + 1))
fi

echo "[release-audit] contract extraction reused ${release_contract_cache_hits} file results; rescanned ${release_contract_cache_misses}"

compare_lists "release.yml vs staging.yml secrets" "$release_secrets_file" "$staging_secrets_file"
compare_lists "workflow secrets vs RUNBOOK.md" "$release_secrets_file" "$runbook_secrets_file"

echo "[release-audit] release and staging workflows use the same secret contract"
echo "[release-audit] RUNBOOK.md matches the workflow secret contract"
audit_cache_persistent_mark "release_workflow_audit" "$release_audit_fingerprint"
