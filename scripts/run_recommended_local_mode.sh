#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_REF="${BASE_REF:-}"
HEAD_REF="${HEAD_REF:-HEAD}"
STATE_DIR="$ROOT_DIR/.logs"
STATE_FILE="$STATE_DIR/auto_local_last.env"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/run_recommended_local_mode.sh [--base-ref <ref>] [--head-ref <ref>]

Resolve the recommended local verification loop for the current diff and run it.
EOF
}

ARGS=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --base-ref)
      BASE_REF="${2:-}"
      ARGS+=("$1" "$2")
      shift 2
      ;;
    --head-ref)
      HEAD_REF="${2:-}"
      ARGS+=("$1" "$2")
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[run-recommended-local-mode] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"

recommendation_args=()
if [ "${#ARGS[@]}" -gt 0 ]; then
  recommendation_args=("${ARGS[@]}")
fi

if [ "${#recommendation_args[@]}" -gt 0 ]; then
  recommendation_output="$(bash scripts/recommend_local_mode.sh "${recommendation_args[@]}")"
else
  recommendation_output="$(bash scripts/recommend_local_mode.sh)"
fi
recommended_command=""
recommended_mode=""
recommended_execution_class=""
recommendation_reason=""
followup_command=""
followup_reason=""
base_ref=""
head_ref=""
surface=""

while IFS='=' read -r key value; do
  case "$key" in
    recommended_command)
      recommended_command="$value"
      ;;
    recommended_mode)
      recommended_mode="$value"
      ;;
    recommended_execution_class)
      recommended_execution_class="$value"
      ;;
    recommendation_reason)
      recommendation_reason="$value"
      ;;
    followup_command)
      followup_command="$value"
      ;;
    followup_reason)
      followup_reason="$value"
      ;;
    base_ref)
      base_ref="$value"
      ;;
    head_ref)
      head_ref="$value"
      ;;
    surface)
      surface="$value"
      ;;
  esac
done <<< "$recommendation_output"

echo "[run-recommended-local-mode] base ref: ${base_ref:-unknown}"
echo "[run-recommended-local-mode] head ref: ${head_ref:-HEAD}"
echo "[run-recommended-local-mode] chosen loop: ${recommended_command:-make changed}"
echo "[run-recommended-local-mode] class: ${recommended_execution_class:-fast}"
echo "[run-recommended-local-mode] reason: ${recommendation_reason:-current diff}"

mkdir -p "$STATE_DIR"

case "$recommended_mode" in
  skip)
    bash scripts/timing_history.sh print_recent 20
    ;;
  frontend)
    bash scripts/dev_fast_check.sh frontend
    ;;
  frontend-hot)
    FRONTEND_SMOKE_PERSIST_SERVER=1 bash scripts/dev_fast_check.sh frontend
    ;;
  profile-frontend)
    bash scripts/profile_surface.sh frontend
    ;;
  backend)
    bash scripts/dev_fast_check.sh backend
    ;;
  profile-backend)
    bash scripts/profile_surface.sh backend
    ;;
  profile-changed)
    if [ "${#recommendation_args[@]}" -gt 0 ]; then
      bash scripts/profile_surface.sh changed "${recommendation_args[@]}"
    else
      bash scripts/profile_surface.sh changed
    fi
    ;;
  changed|"")
    if [ "${#recommendation_args[@]}" -gt 0 ]; then
      bash scripts/dev_verify_changed.sh "${recommendation_args[@]}"
    else
      bash scripts/dev_verify_changed.sh
    fi
    ;;
  *)
    echo "[run-recommended-local-mode] unsupported recommended mode: $recommended_mode" >&2
    exit 1
    ;;
esac

{
  printf 'LAST_AUTO_LOCAL_MODE=%q\n' "${recommended_mode:-}"
  printf 'LAST_AUTO_LOCAL_COMMAND=%q\n' "${recommended_command:-}"
  printf 'LAST_AUTO_LOCAL_SURFACE=%q\n' "${surface:-}"
  printf 'LAST_AUTO_LOCAL_EXECUTION_CLASS=%q\n' "${recommended_execution_class:-}"
  printf 'LAST_AUTO_LOCAL_BASE_REF=%q\n' "${base_ref:-}"
} >"$STATE_FILE"

if [ -n "$followup_command" ]; then
  echo "[run-recommended-local-mode] next cheap follow-up: $followup_command"
  echo "[run-recommended-local-mode] follow-up reason: ${followup_reason:-same diff can use a cheaper rerun}"
fi
