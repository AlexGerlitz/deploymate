#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_REF="${BASE_REF:-}"
HEAD_REF="${HEAD_REF:-HEAD}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/dev_verify_changed.sh [--base-ref <ref>] [--head-ref <ref>]

Detects the changed release surface relative to a sensible local base and runs
the lightweight local gate only for that surface.
EOF
}

resolve_base_ref() {
  if [ -n "$BASE_REF" ]; then
    printf '%s\n' "$BASE_REF"
    return
  fi

  if upstream_ref="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null)"; then
    git merge-base HEAD "$upstream_ref"
    return
  fi

  if git rev-parse --verify origin/develop >/dev/null 2>&1; then
    git merge-base HEAD origin/develop
    return
  fi

  if git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
    git rev-parse HEAD~1
    return
  fi

  git hash-object -t tree /dev/null
}

classify_paths() {
  local frontend_changed=0
  local backend_changed=0
  local full_changed=0
  local relevant_changed=0
  local path=""

  for path in "$@"; do
    case "$path" in
      frontend/*)
        frontend_changed=1
        relevant_changed=1
        ;;
      backend/*)
        backend_changed=1
        relevant_changed=1
        ;;
      README.md|RUNBOOK.md|HANDOFF.md|LICENSE|.gitignore|.github/*)
        ;;
      *)
        full_changed=1
        relevant_changed=1
        ;;
    esac
  done

  if [ "$relevant_changed" = "0" ]; then
    printf 'surface=skip\n'
    printf 'reason=docs or workflow-only changes\n'
  elif [ "$full_changed" = "0" ] && [ "$frontend_changed" = "1" ] && [ "$backend_changed" = "0" ]; then
    printf 'surface=frontend\n'
    printf 'reason=frontend-only changes\n'
  elif [ "$full_changed" = "0" ] && [ "$frontend_changed" = "0" ] && [ "$backend_changed" = "1" ]; then
    printf 'surface=backend\n'
    printf 'reason=backend-only changes\n'
  else
    printf 'surface=full\n'
    printf 'reason=shared or mixed changes\n'
  fi
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --base-ref)
      BASE_REF="${2:-}"
      shift 2
      ;;
    --head-ref)
      HEAD_REF="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[dev-verify-changed] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"

BASE_REF="$(resolve_base_ref)"
echo "[dev-verify-changed] base ref: $BASE_REF"
echo "[dev-verify-changed] head ref: $HEAD_REF"

changed_files=()
while IFS= read -r path; do
  [ -n "$path" ] && changed_files+=("$path")
done < <(
  {
    git diff --name-only "$BASE_REF" "$HEAD_REF"
    git diff --name-only HEAD
    git diff --name-only --cached HEAD
  } | awk '!seen[$0]++'
)

if [ "${#changed_files[@]}" -eq 0 ]; then
  detect_output=$'surface=skip\nreason=no changed files'
else
  detect_output="$(classify_paths "${changed_files[@]}")"
fi

printf '%s\n' "$detect_output"

surface=""
reason=""
backend_changed_files=()
frontend_changed_files=()
runtime_audit_reason=""
security_audit_reason=""
backend_fast_reason=""
while IFS='=' read -r key value; do
  case "$key" in
    surface)
      surface="$value"
      ;;
    reason)
      reason="$value"
      ;;
  esac
done <<< "$detect_output"

for path in "${changed_files[@]}"; do
  case "$path" in
    backend/*)
      backend_changed_files+=("$path")
      ;;
    frontend/*)
      frontend_changed_files+=("$path")
      ;;
  esac
done

if [ "$surface" = "skip" ]; then
  echo "[dev-verify-changed] skipping local gate: $reason"
  exit 0
fi

runtime_audit_output="$(bash scripts/detect_runtime_audit_need.sh "${changed_files[@]}")"
printf '%s\n' "$runtime_audit_output"
while IFS='=' read -r key value; do
  case "$key" in
    run_runtime_audits)
      DEPLOYMATE_RUN_RUNTIME_AUDITS="$value"
      export DEPLOYMATE_RUN_RUNTIME_AUDITS
      ;;
    reason)
      runtime_audit_reason="$value"
      ;;
  esac
done <<< "$runtime_audit_output"

echo "[dev-verify-changed] runtime audits: ${DEPLOYMATE_RUN_RUNTIME_AUDITS:-1} (${runtime_audit_reason})"

security_audit_output="$(bash scripts/detect_security_audit_scope.sh "${changed_files[@]}")"
printf '%s\n' "$security_audit_output"
while IFS='=' read -r key value; do
  case "$key" in
    security_audit_scope)
      DEPLOYMATE_SECURITY_AUDIT_SCOPE="$value"
      export DEPLOYMATE_SECURITY_AUDIT_SCOPE
      ;;
    run_release_workflow_audit)
      DEPLOYMATE_RUN_RELEASE_WORKFLOW_AUDIT="$value"
      export DEPLOYMATE_RUN_RELEASE_WORKFLOW_AUDIT
      ;;
    run_server_credentials_audit)
      DEPLOYMATE_RUN_SERVER_CREDENTIALS_AUDIT="$value"
      export DEPLOYMATE_RUN_SERVER_CREDENTIALS_AUDIT
      ;;
    reason)
      security_audit_reason="$value"
      ;;
  esac
done <<< "$security_audit_output"

DEPLOYMATE_CHANGED_FILES="$(printf '%s\n' "${changed_files[@]}")"
export DEPLOYMATE_CHANGED_FILES
echo "[dev-verify-changed] security audit: ${DEPLOYMATE_SECURITY_AUDIT_SCOPE:-full} (${security_audit_reason})"

echo "[dev-verify-changed] running fast gate for surface: $surface"
if [ "$surface" = "backend" ] || [ "$surface" = "full" ]; then
  backend_fast_output="$(bash scripts/detect_backend_fast_scope.sh "${changed_files[@]}")"
  printf '%s\n' "$backend_fast_output"
  while IFS='=' read -r key value; do
    case "$key" in
      backend_fast_mode)
        DEPLOYMATE_BACKEND_FAST_MODE="$value"
        export DEPLOYMATE_BACKEND_FAST_MODE
        ;;
      backend_fast_modules)
        BACKEND_FAST_TEST_MODULES="$value"
        export BACKEND_FAST_TEST_MODULES
        ;;
      reason)
        backend_fast_reason="$value"
        ;;
    esac
  done <<< "$backend_fast_output"
  echo "[dev-verify-changed] backend fast mode: ${DEPLOYMATE_BACKEND_FAST_MODE:-safety} (${backend_fast_reason})"
  if [ -n "${BACKEND_FAST_TEST_MODULES:-}" ]; then
    echo "[dev-verify-changed] backend fast targets: $BACKEND_FAST_TEST_MODULES"
  fi
fi

if [ "$surface" = "frontend" ] || [ "$surface" = "full" ]; then
  if [ "${#frontend_changed_files[@]}" -gt 0 ]; then
    FRONTEND_FAST_SMOKES="$(bash scripts/detect_frontend_smoke_targets.sh "${frontend_changed_files[@]}" | tr '\n' ' ' | xargs)"
    export FRONTEND_FAST_SMOKES
    echo "[dev-verify-changed] frontend fast smokes: $FRONTEND_FAST_SMOKES"
  fi
fi

bash scripts/dev_fast_check.sh "$surface"
