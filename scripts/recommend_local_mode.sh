#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_REF="${BASE_REF:-}"
HEAD_REF="${HEAD_REF:-HEAD}"
SIMULATED_PATHS=()

usage() {
  cat <<'EOF'
Usage:
  bash scripts/recommend_local_mode.sh [--base-ref <ref>] [--head-ref <ref>]
  bash scripts/recommend_local_mode.sh --paths <path> [<path> ...]

Print the locally recommended verification command for the current diff.
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
    --paths)
      shift
      while [ "$#" -gt 0 ]; do
        SIMULATED_PATHS+=("$1")
        shift
      done
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[recommend-local-mode] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"

resolved_base_ref="$(resolve_base_ref)"
changed_files=()
if [ "${#SIMULATED_PATHS[@]}" -gt 0 ]; then
  changed_files=("${SIMULATED_PATHS[@]}")
else
  while IFS= read -r path; do
    [ -n "$path" ] && changed_files+=("$path")
  done < <(
    {
      git diff --name-only "$resolved_base_ref" "$HEAD_REF"
      git diff --name-only HEAD
      git diff --name-only --cached HEAD
    } | awk '!seen[$0]++'
  )
fi

surface="skip"
reason="no changed files"
if [ "${#changed_files[@]}" -gt 0 ]; then
  detect_output="$(classify_paths "${changed_files[@]}")"
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
fi

recommended_command="make changed"
recommended_mode="changed"
recommendation_reason="$reason"
recommended_run_command="make changed"
recommended_profile_command="make profile-changed"
recommended_execution_class="fast"
backend_fast_mode=""
frontend_fast_mode=""
frontend_fast_smokes=""
backend_syntax_mode=""

if [ "$surface" = "skip" ]; then
  recommended_command="make timing-history"
  recommended_mode="skip"
  recommended_run_command="make timing-history"
  recommended_profile_command="make timing-history"
  recommended_execution_class="skip"
elif [ "$surface" = "frontend" ]; then
  while IFS='=' read -r key value; do
    case "$key" in
      frontend_fast_mode)
        frontend_fast_mode="$value"
        ;;
      frontend_fast_smokes)
        frontend_fast_smokes="$value"
        ;;
    esac
  done < <(bash scripts/detect_frontend_fast_scope.sh "${changed_files[@]}")

  recommended_profile_command="make profile-frontend"
  if [ "$frontend_fast_mode" = "targeted" ]; then
    case "$frontend_fast_smokes" in
      auth|ops|runtime)
        recommended_command="make frontend-hot"
        recommended_mode="frontend-hot"
        recommended_run_command="make frontend-hot"
        recommendation_reason="single frontend fast target (${frontend_fast_smokes})"
        ;;
      *)
        recommended_command="make frontend"
        recommended_mode="frontend"
        recommended_run_command="make frontend"
        recommendation_reason="frontend-only diff with targeted smokes"
        ;;
    esac
  else
    recommended_command="make profile-frontend"
    recommended_mode="profile-frontend"
    recommended_run_command="make frontend"
    recommended_execution_class="profile"
    recommendation_reason="frontend-only diff needs the default smoke pack"
  fi
elif [ "$surface" = "backend" ]; then
  while IFS='=' read -r key value; do
    case "$key" in
      backend_syntax_mode)
        backend_syntax_mode="$value"
        ;;
    esac
  done < <(bash scripts/detect_backend_syntax_scope.sh "${changed_files[@]}")

  while IFS='=' read -r key value; do
    case "$key" in
      backend_fast_mode)
        backend_fast_mode="$value"
        ;;
    esac
  done < <(bash scripts/detect_backend_fast_scope.sh "${changed_files[@]}")

  recommended_command="make backend"
  recommended_mode="backend"
  recommended_run_command="make backend"
  recommended_profile_command="make profile-backend"
  case "$backend_fast_mode" in
    targeted)
      recommendation_reason="backend-only diff with targeted test modules"
      ;;
    safety)
      if [ "$backend_syntax_mode" = "full" ] || [ "${#changed_files[@]}" -gt 3 ]; then
        recommended_command="make profile-backend"
        recommended_mode="profile-backend"
        recommended_execution_class="profile"
        recommendation_reason="backend-only diff needs the safety suite and profiling context"
      else
        recommendation_reason="backend-only diff needs safety suite"
      fi
      ;;
    skip)
      recommendation_reason="backend diff resolved to skip backend fast suite"
      ;;
  esac
else
  while IFS='=' read -r key value; do
    case "$key" in
      backend_fast_mode)
        backend_fast_mode="$value"
        ;;
    esac
  done < <(bash scripts/detect_backend_fast_scope.sh "${changed_files[@]}")

  while IFS='=' read -r key value; do
    case "$key" in
      frontend_fast_mode)
        frontend_fast_mode="$value"
        ;;
      frontend_fast_smokes)
        frontend_fast_smokes="$value"
        ;;
    esac
  done < <(bash scripts/detect_frontend_fast_scope.sh "${changed_files[@]}")

  if [ "$frontend_fast_mode" = "skip" ] && [ "${backend_fast_mode:-safety}" != "skip" ]; then
    recommended_run_command="make backend"
    recommended_profile_command="make profile-backend"
    if [ "$backend_fast_mode" = "safety" ]; then
      recommended_command="make profile-backend"
      recommended_mode="profile-backend"
      recommended_execution_class="profile"
      recommendation_reason="mixed diff collapses to backend-only safety loop"
    else
      recommended_command="make backend"
      recommended_mode="backend"
      recommendation_reason="mixed diff resolves to backend-only fast loop"
    fi
  elif [ "$backend_fast_mode" = "skip" ] && [ "${frontend_fast_mode:-default}" != "skip" ]; then
    recommended_profile_command="make profile-frontend"
    if [ "$frontend_fast_mode" = "targeted" ] && { [ "$frontend_fast_smokes" = "auth" ] || [ "$frontend_fast_smokes" = "ops" ] || [ "$frontend_fast_smokes" = "runtime" ]; }; then
      recommended_command="make frontend-hot"
      recommended_mode="frontend-hot"
      recommended_run_command="make frontend-hot"
      recommendation_reason="mixed diff resolves to single frontend fast target (${frontend_fast_smokes})"
    else
      recommended_command="make profile-frontend"
      recommended_mode="profile-frontend"
      recommended_run_command="make frontend"
      recommended_execution_class="profile"
      recommendation_reason="mixed diff resolves to frontend-only default smoke pack"
    fi
  else
    recommended_command="make profile-changed"
    recommended_mode="profile-changed"
    recommended_run_command="make changed"
    recommended_profile_command="make profile-changed"
    recommended_execution_class="profile"
    recommendation_reason="shared or mixed changes benefit from timing and cache context"
  fi
fi

printf 'base_ref=%s\n' "$resolved_base_ref"
printf 'head_ref=%s\n' "$HEAD_REF"
printf 'surface=%s\n' "$surface"
printf 'reason=%s\n' "$reason"
printf 'recommended_mode=%s\n' "$recommended_mode"
printf 'recommended_command=%s\n' "$recommended_command"
printf 'recommended_run_command=%s\n' "$recommended_run_command"
printf 'recommended_profile_command=%s\n' "$recommended_profile_command"
printf 'recommended_execution_class=%s\n' "$recommended_execution_class"
printf 'recommendation_reason=%s\n' "$recommendation_reason"
