#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TMP_FILE="$(mktemp)"
cleanup() {
  rm -f "$TMP_FILE"
}
trap cleanup EXIT

echo "[security-audit] repo: $ROOT_DIR"

TRACKED_FILES=()
while IFS= read -r file; do
  TRACKED_FILES+=("$file")
done < <(git ls-files)

if [ "${#TRACKED_FILES[@]}" -eq 0 ]; then
  echo "[security-audit] no tracked files"
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

if rg -n -S \
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

if rg -n -S 'StrictHostKeyChecking=no' -- "${RUNTIME_FILES[@]}" >"$TMP_FILE"; then
  echo "[security-audit] warning: StrictHostKeyChecking=no found"
  cat "$TMP_FILE"
  WARNINGS=1
fi

if rg -n -S '/var/run/docker.sock' -- "${RUNTIME_FILES[@]}" >"$TMP_FILE"; then
  echo "[security-audit] warning: docker.sock reference found"
  cat "$TMP_FILE"
  WARNINGS=1
fi

if [ -f "scripts/release_workflow_audit.sh" ]; then
  echo "[security-audit] release workflow audit"
  bash scripts/release_workflow_audit.sh
fi

if [ "$WARNINGS" -eq 0 ]; then
  echo "[security-audit] no high-risk findings"
else
  echo "[security-audit] warnings found; review recommended"
fi
