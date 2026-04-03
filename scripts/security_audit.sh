#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/audit_cache.sh"
cd "$ROOT_DIR"

audit_cache_prepare

if audit_cache_has security_audit; then
  echo "[security-audit] already completed in this run; skipping"
  exit 0
fi

if command -v rg >/dev/null 2>&1; then
  SEARCH_CMD=(rg -n -S)
else
  SEARCH_CMD=(grep -nE)
fi

TMP_FILE="$(mktemp)"
cleanup() {
  rm -f "$TMP_FILE"
}
trap cleanup EXIT

echo "[security-audit] repo: $ROOT_DIR"

TRACKED_FILES=()
if [ "${DEPLOYMATE_SECURITY_AUDIT_SCOPE:-full}" = "changed" ] && [ -n "${DEPLOYMATE_CHANGED_FILES:-}" ]; then
  while IFS= read -r file; do
    [ -n "$file" ] && [ -f "$file" ] && TRACKED_FILES+=("$file")
  done <<< "$DEPLOYMATE_CHANGED_FILES"
  echo "[security-audit] file scope: changed files"
else
  while IFS= read -r file; do
    TRACKED_FILES+=("$file")
  done < <(git ls-files)
  echo "[security-audit] file scope: full tracked files"
fi

if [ "${#TRACKED_FILES[@]}" -eq 0 ]; then
  echo "[security-audit] no files in current scope"
  exit 0
fi

FILTERED_FILES=()
for file in "${TRACKED_FILES[@]}"; do
  case "$file" in
    .env.production.example|frontend/.env.example|frontend/package-lock.json)
      continue
      ;;
    *)
      FILTERED_FILES+=("$file")
      ;;
  esac
done

echo "[security-audit] scanning tracked files for high-signal secret patterns"

if "${SEARCH_CMD[@]}" \
  -e 'gh[opusr]_[A-Za-z0-9_]+' \
  -e 'github_pat_[A-Za-z0-9_]+' \
  -e 'AKIA[0-9A-Z]{16}' \
  -e '-----BEGIN [A-Z ]*PRIVATE KEY-----' \
  -e 'xox[baprs]-[A-Za-z0-9-]+' \
  -e 'sk_live_[A-Za-z0-9]+' \
  -- "${FILTERED_FILES[@]}" >"$TMP_FILE"; then
  echo "[security-audit] potential secret material found:"
  cat "$TMP_FILE"
  exit 1
fi

echo "[security-audit] scanning for risky runtime defaults"

WARNINGS=0
RUNTIME_FILES=()
for file in "${FILTERED_FILES[@]}"; do
  case "$file" in
    backend/tests/*|README.md|PRODUCTION.md|RUNBOOK.md|SAFE-RELEASE.md|SECURITY.md|CHANGELOG.md|ARCHITECTURE.md|ROADMAP.md|CONTRIBUTING.md|docs/*)
      continue
      ;;
    scripts/security_audit.sh)
      continue
      ;;
    *)
      RUNTIME_FILES+=("$file")
      ;;
  esac
done

if "${SEARCH_CMD[@]}" 'StrictHostKeyChecking=no' -- "${RUNTIME_FILES[@]}" >"$TMP_FILE"; then
  echo "[security-audit] warning: StrictHostKeyChecking=no found"
  cat "$TMP_FILE"
  WARNINGS=1
fi

if "${SEARCH_CMD[@]}" '/var/run/docker.sock' -- "${RUNTIME_FILES[@]}" >"$TMP_FILE"; then
  echo "[security-audit] warning: docker.sock reference found"
  cat "$TMP_FILE"
  WARNINGS=1
fi

if [ -f "scripts/release_workflow_audit.sh" ] && [ "${DEPLOYMATE_RUN_RELEASE_WORKFLOW_AUDIT:-1}" = "1" ]; then
  echo "[security-audit] release workflow audit"
  bash scripts/release_workflow_audit.sh
elif [ -f "scripts/release_workflow_audit.sh" ]; then
  echo "[security-audit] release workflow audit skipped for this local diff"
fi

if [ -f "scripts/server_credentials_audit.sh" ] && [ "${DEPLOYMATE_RUN_SERVER_CREDENTIALS_AUDIT:-1}" = "1" ]; then
  echo "[security-audit] server credentials audit"
  bash scripts/server_credentials_audit.sh
elif [ -f "scripts/server_credentials_audit.sh" ]; then
  echo "[security-audit] server credentials audit skipped for this local diff"
fi

if [ -f "scripts/local_runtime_audit.sh" ]; then
  if [ "${DEPLOYMATE_RUN_RUNTIME_AUDITS:-1}" = "1" ]; then
    echo "[security-audit] local runtime audit"
    bash scripts/local_runtime_audit.sh
  else
    echo "[security-audit] local runtime audit skipped for this local diff"
  fi
fi

if [ -f "scripts/runtime_capability_audit.sh" ]; then
  if [ "${DEPLOYMATE_RUN_RUNTIME_AUDITS:-1}" = "1" ]; then
    echo "[security-audit] runtime capability audit"
    bash scripts/runtime_capability_audit.sh
  else
    echo "[security-audit] runtime capability audit skipped for this local diff"
  fi
fi

if [ "$WARNINGS" -eq 0 ]; then
  echo "[security-audit] no high-risk findings"
else
  echo "[security-audit] warnings found; review recommended"
fi

audit_cache_mark security_audit
