#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SURFACE="full"
BACKEND_PYTHON="${BACKEND_PYTHON:-}"
FAST_MODE=0
BACKEND_FAST_TEST_MODULES="${BACKEND_FAST_TEST_MODULES:-}"
DEPLOYMATE_BACKEND_FAST_MODE="${DEPLOYMATE_BACKEND_FAST_MODE:-}"
FRONTEND_FAST_SMOKES="${FRONTEND_FAST_SMOKES:-}"
DEPLOYMATE_FRONTEND_FAST_MODE="${DEPLOYMATE_FRONTEND_FAST_MODE:-}"
source "$ROOT_DIR/scripts/lib/project_automation.sh"
source "$ROOT_DIR/scripts/audit_cache.sh"
source "$ROOT_DIR/scripts/timing_history.sh"
SCRIPT_START_TS="$(date +%s)"

format_duration() {
  local seconds="$1"
  printf '%ss' "$seconds"
}

phase_cache_fingerprint() {
  local cache_key="$1"
  local metadata="$2"
  shift 2 || true
  audit_cache_fingerprint_inputs "$cache_key" "$metadata" "$@"
}

frontend_target_changed_files() {
  local smoke_target="$1"
  local changed_path=""
  local target_line=""

  [ -n "${DEPLOYMATE_CHANGED_FILES:-}" ] || return 0

  while IFS= read -r changed_path; do
    [ -n "$changed_path" ] || continue
    while IFS= read -r target_line; do
      [ -n "$target_line" ] || continue
      if [ "$target_line" = "$smoke_target" ]; then
        printf '%s\n' "$changed_path"
        break
      fi
    done < <(bash scripts/detect_frontend_smoke_targets.sh "$changed_path")
  done <<< "${DEPLOYMATE_CHANGED_FILES}"
}

backend_module_changed_files() {
  local test_module="$1"
  local changed_path=""
  local target_line=""

  [ -n "${DEPLOYMATE_CHANGED_FILES:-}" ] || return 0

  while IFS= read -r changed_path; do
    [ -n "$changed_path" ] || continue
    while IFS= read -r target_line; do
      [ -n "$target_line" ] || continue
      if [ "$target_line" = "$test_module" ]; then
        printf '%s\n' "$changed_path"
        break
      fi
    done < <(bash scripts/detect_backend_test_targets.sh "$changed_path")
  done <<< "${DEPLOYMATE_CHANGED_FILES}"
}

clean_frontend_build_artifacts() {
  local frontend_dir=""
  frontend_dir="$(automation_frontend_dir_rel)"
  if [ -d "${frontend_dir}/.next" ]; then
    echo "[release] removing stale ${frontend_dir}/.next"
    rm -rf "${frontend_dir}/.next"
  fi
}

run_frontend_fast_smokes_shared() {
  local smoke_targets=("$@")
  local shared_port=3001
  local shared_log="/tmp/deploymate-frontend-fast-smoke.log"
  local shared_dist=".next-smoke-fast-${shared_port}"
  local smoke_target=""

  source scripts/frontend_smoke_shared.sh

  PORT="$shared_port"
  BASE_URL="http://127.0.0.1:${PORT}"
  SERVER_LOG="$shared_log"
  DIST_DIR="$shared_dist"

  export FRONTEND_SMOKE_PORT="$shared_port"
  export FRONTEND_SMOKE_LOG="$shared_log"
  export FRONTEND_SMOKE_DIST_DIR="$shared_dist"
  export FRONTEND_SMOKE_REUSE_SERVER=1

  local server_started=0
  trap 'if [ "$server_started" = "1" ]; then stop_frontend_smoke_server; fi' RETURN
  ensure_shared_server() {
    if [ "$server_started" != "1" ]; then
      start_frontend_smoke_server
      wait_for_frontend_smoke_url "$(automation_frontend_ready_path)"
      server_started=1
    fi
  }

  for smoke_target in "${smoke_targets[@]}"; do
    frontend_phase_cache_key="frontend_fast_phase_${smoke_target}"
    frontend_phase_metadata="$(printf 'surface=%s\nfast=%s\nmode=%s\ntarget=%s\n' "$SURFACE" "$FAST_MODE" "${DEPLOYMATE_FRONTEND_FAST_MODE:-default}" "$smoke_target")"
    frontend_phase_files=(
      "scripts/release_workflow.sh"
      "scripts/frontend_smoke_shared.sh"
      "scripts/frontend_${smoke_target}_smoke.sh"
      "scripts/lib/frontend_smoke_checks.sh"
      "scripts/project_automation_smoke_checks.sh"
      "scripts/project_automation_config.sh"
      "scripts/project_automation_targets.sh"
      "frontend/package.json"
    )
    frontend_phase_changed_subset="$(frontend_target_changed_files "$smoke_target")"
    if [ -n "$frontend_phase_changed_subset" ]; then
      while IFS= read -r changed_path; do
        [ -n "$changed_path" ] && frontend_phase_files+=("$changed_path")
      done <<< "$frontend_phase_changed_subset"
    fi
    frontend_phase_metadata="$(printf '%srelevant_changed=%s\n' "$frontend_phase_metadata" "$frontend_phase_changed_subset")"
    frontend_phase_fingerprint="$(phase_cache_fingerprint "$frontend_phase_cache_key" "$frontend_phase_metadata" "${frontend_phase_files[@]}")"

    if audit_cache_persistent_has "$frontend_phase_cache_key" "$frontend_phase_fingerprint"; then
      echo "[release] frontend ${smoke_target} phase cache hit"
      audit_cache_record_event phase_hit "$frontend_phase_cache_key"
      continue
    fi

    echo "[release] frontend ${smoke_target} phase cache miss"
    audit_cache_record_event phase_miss "$frontend_phase_cache_key"
    ensure_shared_server
    echo "[release] frontend ${smoke_target} smoke"
    automation_frontend_npm run "smoke:${smoke_target}"
    audit_cache_persistent_mark "$frontend_phase_cache_key" "$frontend_phase_fingerprint"
  done
}

run_frontend_smokes_shared() {
  local shared_port="${1}"
  local shared_log="${2}"
  local shared_dist="${3}"
  shift 3
  local smoke_targets=("$@")
  local smoke_target=""

  source scripts/frontend_smoke_shared.sh

  PORT="$shared_port"
  BASE_URL="http://127.0.0.1:${PORT}"
  SERVER_LOG="$shared_log"
  DIST_DIR="$shared_dist"

  export FRONTEND_SMOKE_PORT="$shared_port"
  export FRONTEND_SMOKE_LOG="$shared_log"
  export FRONTEND_SMOKE_DIST_DIR="$shared_dist"
  export FRONTEND_SMOKE_REUSE_SERVER=1

  start_frontend_smoke_server
  trap 'stop_frontend_smoke_server' RETURN

  wait_for_frontend_smoke_url "$(automation_frontend_ready_path)"

  for smoke_target in "${smoke_targets[@]}"; do
    echo "[release] frontend ${smoke_target} smoke"
    automation_frontend_npm run "smoke:${smoke_target}"
  done
}

usage() {
  cat <<'EOF'
Usage:
  bash scripts/release_workflow.sh [--surface frontend|backend|full] [--fast]

This script runs the local release checks in the expected order:
  1. preflight
  2. frontend smokes and build for frontend/full surfaces
  3. backend test suite for backend/full surfaces

It does not commit, push, or deploy. It is the local gate before those steps.

Fast mode keeps the same surface selection with a smaller local gate.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --surface)
      SURFACE="${2:-}"
      shift 2
      ;;
    --fast)
      FAST_MODE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[release] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

case "$SURFACE" in
  frontend|backend|full)
    ;;
  *)
    echo "[release] invalid surface: $SURFACE" >&2
    usage >&2
    exit 1
    ;;
esac

cd "$ROOT_DIR"

audit_cache_prepare
trap audit_cache_cleanup EXIT

if [ -z "$BACKEND_PYTHON" ]; then
  BACKEND_PYTHON="$(automation_backend_python)"
fi

echo "[release] repo: $ROOT_DIR"
echo "[release] surface: $SURFACE"
echo "[release] fast mode: $FAST_MODE"
echo "[release] backend python: $BACKEND_PYTHON"
if [ -n "$BACKEND_FAST_TEST_MODULES" ]; then
  echo "[release] backend fast targets: $BACKEND_FAST_TEST_MODULES"
fi
if [ -n "$DEPLOYMATE_BACKEND_FAST_MODE" ]; then
  echo "[release] backend fast mode: $DEPLOYMATE_BACKEND_FAST_MODE"
fi
if [ -n "$FRONTEND_FAST_SMOKES" ]; then
  echo "[release] frontend fast smokes: $FRONTEND_FAST_SMOKES"
fi
if [ -n "$DEPLOYMATE_FRONTEND_FAST_MODE" ]; then
  echo "[release] frontend fast mode: $DEPLOYMATE_FRONTEND_FAST_MODE"
fi

echo "[release] preflight"
preflight_start_ts="$(date +%s)"
if [ "$FAST_MODE" = "1" ]; then
  bash scripts/preflight.sh --surface "$SURFACE" --fast
else
  bash scripts/preflight.sh --surface "$SURFACE"
fi
preflight_duration=$(( $(date +%s) - preflight_start_ts ))

frontend_duration=0
if [ "$SURFACE" = "frontend" ] || [ "$SURFACE" = "full" ]; then
  frontend_start_ts="$(date +%s)"
  IFS=' ' read -r -a frontend_fast_smokes <<< "$(automation_frontend_fast_smokes_default)"
  if [ -n "$FRONTEND_FAST_SMOKES" ]; then
    IFS=' ' read -r -a frontend_fast_smokes <<< "$FRONTEND_FAST_SMOKES"
  fi

  if [ "$FAST_MODE" = "1" ]; then
    if [ "$DEPLOYMATE_FRONTEND_FAST_MODE" = "skip" ]; then
      echo "[release] frontend fast smokes skipped for this diff"
    else
      for frontend_smoke in "${frontend_fast_smokes[@]}"; do
        case "$frontend_smoke" in
          auth|ops|runtime)
            ;;
          *)
            echo "[release] unknown frontend fast smoke target: $frontend_smoke" >&2
            exit 1
            ;;
        esac
      done
      run_frontend_fast_smokes_shared "${frontend_fast_smokes[@]}"
    fi
  else
    frontend_fast_port=3001
    for frontend_smoke in "${frontend_fast_smokes[@]}"; do
      case "$frontend_smoke" in
        auth|ops|runtime)
          echo "[release] frontend ${frontend_smoke} smoke"
          FRONTEND_SMOKE_PORT="$frontend_fast_port" automation_frontend_npm run "smoke:${frontend_smoke}"
          frontend_fast_port=$((frontend_fast_port + 1))
          ;;
        *)
          echo "[release] unknown frontend fast smoke target: $frontend_smoke" >&2
          exit 1
          ;;
      esac
    done
  fi

  if [ "$FAST_MODE" != "1" ]; then
    run_frontend_smokes_shared 3001 "/tmp/deploymate-frontend-full-smoke.log" ".next-smoke-full-3001" \
      auth ops runtime admin admin-interactions servers templates

    FRONTEND_SMOKE_PORT=3002 \
    FRONTEND_SMOKE_LOG="/tmp/deploymate-frontend-restore-shared.log" \
    FRONTEND_SMOKE_DIST_DIR=".next-smoke-restore-3002" \
    FRONTEND_SMOKE_REUSE_SERVER=0 \
    NEXT_PUBLIC_SMOKE_RESTORE_REPORT=1 \
      bash scripts/frontend_restore_smoke.sh

    clean_frontend_build_artifacts
    echo "[release] frontend build"
    automation_frontend_npm run build
  fi
  frontend_duration=$(( $(date +%s) - frontend_start_ts ))
fi

backend_duration=0
if [ "$SURFACE" = "backend" ] || [ "$SURFACE" = "full" ]; then
  backend_start_ts="$(date +%s)"
  if [ "$FAST_MODE" = "1" ]; then
    if [ "$DEPLOYMATE_BACKEND_FAST_MODE" = "skip" ]; then
      echo "[release] backend fast suite skipped for this diff"
    else
      if [ -n "$BACKEND_FAST_TEST_MODULES" ]; then
        echo "[release] backend targeted fast suite"
        IFS=' ' read -r -a backend_fast_modules <<< "$BACKEND_FAST_TEST_MODULES"
      else
        echo "[release] backend fast safety suite"
        backend_fast_modules=(
          backend.tests.test_auth_security
          backend.tests.test_ops_api_flow
          backend.tests.test_restore_dry_run
          backend.tests.test_server_credentials_policy
        )
      fi

      for backend_fast_module in "${backend_fast_modules[@]}"; do
        backend_phase_cache_key="backend_fast_phase_${backend_fast_module//./_}"
        backend_phase_metadata="$(printf 'surface=%s\nfast=%s\nmode=%s\nmodule=%s\n' "$SURFACE" "$FAST_MODE" "${DEPLOYMATE_BACKEND_FAST_MODE:-safety}" "$backend_fast_module")"
        backend_phase_files=(
          "scripts/release_workflow.sh"
          "scripts/dev_fast_check.sh"
          "scripts/detect_backend_fast_scope.sh"
          "scripts/detect_backend_test_targets.sh"
          "scripts/project_automation_targets.sh"
          "scripts/project_automation_config.sh"
          "backend/requirements.txt"
        )
        backend_phase_changed_subset="$(backend_module_changed_files "$backend_fast_module")"
        if [ -n "$backend_phase_changed_subset" ]; then
          while IFS= read -r changed_path; do
            [ -n "$changed_path" ] && backend_phase_files+=("$changed_path")
          done <<< "$backend_phase_changed_subset"
        elif [ -n "${DEPLOYMATE_CHANGED_FILES:-}" ]; then
          while IFS= read -r changed_path; do
            [ -n "$changed_path" ] && backend_phase_files+=("$changed_path")
          done <<< "${DEPLOYMATE_CHANGED_FILES}"
        fi
        backend_phase_metadata="$(printf '%srelevant_changed=%s\n' "$backend_phase_metadata" "$backend_phase_changed_subset")"
        backend_phase_fingerprint="$(phase_cache_fingerprint "$backend_phase_cache_key" "$backend_phase_metadata" "${backend_phase_files[@]}")"

        if audit_cache_persistent_has "$backend_phase_cache_key" "$backend_phase_fingerprint"; then
          echo "[release] backend ${backend_fast_module} phase cache hit"
          audit_cache_record_event phase_hit "$backend_phase_cache_key"
          continue
        fi

        echo "[release] backend ${backend_fast_module} phase cache miss"
        audit_cache_record_event phase_miss "$backend_phase_cache_key"
        PYTHONPATH="$(automation_backend_dir_rel)" "$BACKEND_PYTHON" -m unittest "$backend_fast_module"
        audit_cache_persistent_mark "$backend_phase_cache_key" "$backend_phase_fingerprint"
      done
    fi
  else
    echo "[release] backend test suite"
    PYTHONPATH="$(automation_backend_dir_rel)" "$BACKEND_PYTHON" -m unittest discover -s "$(automation_backend_tests_dir_rel)" -p 'test_*.py'
  fi
  backend_duration=$(( $(date +%s) - backend_start_ts ))
fi

echo "[release] executed phases:"
if [ "$SURFACE" = "frontend" ] || [ "$SURFACE" = "full" ]; then
  if [ "$FAST_MODE" = "1" ]; then
    if [ "$DEPLOYMATE_FRONTEND_FAST_MODE" = "skip" ]; then
      echo "[release]   - frontend preflight only; fast smokes skipped for this diff"
    elif [ -n "$FRONTEND_FAST_SMOKES" ]; then
      echo "[release]   - frontend preflight plus targeted fast smokes"
    else
      echo "[release]   - frontend preflight plus auth, ops, and runtime smokes"
    fi
  else
    echo "[release]   - frontend preflight, smokes, and build"
  fi
fi
if [ "$SURFACE" = "backend" ] || [ "$SURFACE" = "full" ]; then
  if [ "$FAST_MODE" = "1" ]; then
    if [ "$DEPLOYMATE_BACKEND_FAST_MODE" = "skip" ]; then
      echo "[release]   - backend preflight only; fast suite skipped for this diff"
    elif [ -n "$BACKEND_FAST_TEST_MODULES" ]; then
      echo "[release]   - backend preflight plus targeted fast suite"
    else
      echo "[release]   - backend preflight plus fast safety suite"
    fi
  else
    echo "[release]   - backend preflight and test suite"
  fi
fi

echo "[release] checks passed"
total_duration=$(( $(date +%s) - SCRIPT_START_TS ))
timing_history_append "release_workflow" "$SURFACE" "$FAST_MODE" "preflight" "$preflight_duration"
timing_history_append "release_workflow" "$SURFACE" "$FAST_MODE" "frontend_phase" "$frontend_duration"
timing_history_append "release_workflow" "$SURFACE" "$FAST_MODE" "backend_phase" "$backend_duration"
timing_history_append "release_workflow" "$SURFACE" "$FAST_MODE" "total" "$total_duration"
echo "[release] timing summary:"
echo "[release]   - preflight: $(format_duration "$preflight_duration")"
echo "[release]   - frontend phase: $(format_duration "$frontend_duration")"
echo "[release]   - backend phase: $(format_duration "$backend_duration")"
echo "[release]   - total: $(format_duration "$total_duration")"
echo "[release] timing history: .logs/local_gate_timing.csv"
audit_cache_print_summary "[release]"
audit_cache_print_family_summary "[release]"
audit_cache_print_family_hint "[release]"
timing_history_print_hint "release_workflow" "$SURFACE" "$FAST_MODE"
echo "[release] next: git status --short"
echo "[release] next: git push origin develop"
echo "[release] next: follow RUNBOOK.md for deploy and post-deploy smoke"
