#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SURFACE="full"
BASE_REF="${BASE_REF:-}"
HEAD_REF="${HEAD_REF:-HEAD}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/derive_local_fast_context.sh [--surface frontend|backend|full] [--base-ref <ref>] [--head-ref <ref>]
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

print_export() {
  local key="$1"
  local value="${2:-}"
  printf 'export %s=%q\n' "$key" "$value"
}

join_lines() {
  if [ "$#" -eq 0 ]; then
    return 0
  fi

  printf '%s\n' "$@"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --surface)
      SURFACE="${2:-}"
      shift 2
      ;;
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
      echo "[derive-local-fast-context] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

case "$SURFACE" in
  frontend|backend|full)
    ;;
  *)
    echo "[derive-local-fast-context] invalid surface: $SURFACE" >&2
    usage >&2
    exit 1
    ;;
esac

cd "$ROOT_DIR"

resolved_base_ref="$(resolve_base_ref)"
changed_files=()
while IFS= read -r path; do
  [ -n "$path" ] && changed_files+=("$path")
done < <(
  {
    git diff --name-only "$resolved_base_ref" "$HEAD_REF"
    git diff --name-only HEAD
    git diff --name-only --cached HEAD
  } | awk '!seen[$0]++'
)

print_export DEPLOYMATE_CONTEXT_DERIVED 1
print_export DEPLOYMATE_CONTEXT_BASE_REF "$resolved_base_ref"
print_export DEPLOYMATE_CONTEXT_HEAD_REF "$HEAD_REF"
changed_files_joined=""
if [ "${#changed_files[@]}" -gt 0 ]; then
  changed_files_joined="$(join_lines "${changed_files[@]}")"
fi
print_export DEPLOYMATE_CHANGED_FILES "$changed_files_joined"

if [ "${#changed_files[@]}" -eq 0 ]; then
  print_export DEPLOYMATE_RUN_RUNTIME_AUDITS 1
  print_export DEPLOYMATE_SECURITY_AUDIT_SCOPE full
  print_export DEPLOYMATE_SECRET_SCAN_SCOPE full
  print_export DEPLOYMATE_RUNTIME_POLICY_SCAN_SCOPE full
  print_export DEPLOYMATE_RUN_RELEASE_WORKFLOW_AUDIT 1
  print_export DEPLOYMATE_RUN_SERVER_CREDENTIALS_AUDIT 1
  print_export DEPLOYMATE_BACKEND_SYNTAX_MODE full
  print_export DEPLOYMATE_BACKEND_PYTHON_FILES ""
  print_export DEPLOYMATE_BACKEND_FAST_MODE ""
  print_export BACKEND_FAST_TEST_MODULES ""
  print_export DEPLOYMATE_FRONTEND_FAST_MODE ""
  print_export FRONTEND_FAST_SMOKES ""
  exit 0
fi

while IFS='=' read -r key value; do
  case "$key" in
    run_runtime_audits)
      print_export DEPLOYMATE_RUN_RUNTIME_AUDITS "$value"
      ;;
  esac
done < <(bash scripts/detect_runtime_audit_need.sh "${changed_files[@]}")

while IFS='=' read -r key value; do
  case "$key" in
    security_audit_scope)
      print_export DEPLOYMATE_SECURITY_AUDIT_SCOPE "$value"
      ;;
    secret_scan_scope)
      print_export DEPLOYMATE_SECRET_SCAN_SCOPE "$value"
      ;;
    runtime_policy_scan_scope)
      print_export DEPLOYMATE_RUNTIME_POLICY_SCAN_SCOPE "$value"
      ;;
    run_release_workflow_audit)
      print_export DEPLOYMATE_RUN_RELEASE_WORKFLOW_AUDIT "$value"
      ;;
    run_server_credentials_audit)
      print_export DEPLOYMATE_RUN_SERVER_CREDENTIALS_AUDIT "$value"
      ;;
  esac
done < <(bash scripts/detect_security_audit_scope.sh "${changed_files[@]}")

while IFS='=' read -r key value; do
  case "$key" in
    backend_syntax_mode)
      print_export DEPLOYMATE_BACKEND_SYNTAX_MODE "$value"
      ;;
    backend_python_files)
      print_export DEPLOYMATE_BACKEND_PYTHON_FILES "$value"
      ;;
  esac
done < <(bash scripts/detect_backend_syntax_scope.sh "${changed_files[@]}")

if [ "$SURFACE" = "backend" ] || [ "$SURFACE" = "full" ]; then
  while IFS='=' read -r key value; do
    case "$key" in
      backend_fast_mode)
        print_export DEPLOYMATE_BACKEND_FAST_MODE "$value"
        ;;
      backend_fast_modules)
        print_export BACKEND_FAST_TEST_MODULES "$value"
        ;;
    esac
  done < <(bash scripts/detect_backend_fast_scope.sh "${changed_files[@]}")
fi

if [ "$SURFACE" = "frontend" ] || [ "$SURFACE" = "full" ]; then
  while IFS='=' read -r key value; do
    case "$key" in
      frontend_fast_mode)
        print_export DEPLOYMATE_FRONTEND_FAST_MODE "$value"
        ;;
      frontend_fast_smokes)
        print_export FRONTEND_FAST_SMOKES "$value"
        ;;
    esac
  done < <(bash scripts/detect_frontend_fast_scope.sh "${changed_files[@]}")
fi
