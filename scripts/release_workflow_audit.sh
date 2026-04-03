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

extract_workflow_secrets "$RELEASE_WORKFLOW" >"$release_secrets_file"
extract_workflow_secrets "$STAGING_WORKFLOW" >"$staging_secrets_file"
extract_runbook_secrets >"$runbook_secrets_file"

compare_lists "release.yml vs staging.yml secrets" "$release_secrets_file" "$staging_secrets_file"
compare_lists "workflow secrets vs RUNBOOK.md" "$release_secrets_file" "$runbook_secrets_file"

echo "[release-audit] release and staging workflows use the same secret contract"
echo "[release-audit] RUNBOOK.md matches the workflow secret contract"
audit_cache_persistent_mark "release_workflow_audit" "$release_audit_fingerprint"
