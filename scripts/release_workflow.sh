#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SURFACE="full"
BACKEND_PYTHON="${BACKEND_PYTHON:-}"
FAST_MODE=0
BACKEND_FAST_TEST_MODULES="${BACKEND_FAST_TEST_MODULES:-}"
FRONTEND_FAST_SMOKES="${FRONTEND_FAST_SMOKES:-}"
source "$ROOT_DIR/scripts/timing_history.sh"
SCRIPT_START_TS="$(date +%s)"

format_duration() {
  local seconds="$1"
  printf '%ss' "$seconds"
}

clean_frontend_build_artifacts() {
  if [ -d "frontend/.next" ]; then
    echo "[release] removing stale frontend/.next"
    rm -rf "frontend/.next"
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

  start_frontend_smoke_server
  trap 'stop_frontend_smoke_server' RETURN

  wait_for_frontend_smoke_url "/app"

  for smoke_target in "${smoke_targets[@]}"; do
    echo "[release] frontend ${smoke_target} smoke"
    npm --prefix frontend run "smoke:${smoke_target}"
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

  wait_for_frontend_smoke_url "/app"

  for smoke_target in "${smoke_targets[@]}"; do
    echo "[release] frontend ${smoke_target} smoke"
    npm --prefix frontend run "smoke:${smoke_target}"
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

if [ -z "$BACKEND_PYTHON" ]; then
  if [ -x "backend/venv/bin/python" ]; then
    BACKEND_PYTHON="backend/venv/bin/python"
  else
    BACKEND_PYTHON="python3"
  fi
fi

echo "[release] repo: $ROOT_DIR"
echo "[release] surface: $SURFACE"
echo "[release] fast mode: $FAST_MODE"
echo "[release] backend python: $BACKEND_PYTHON"
if [ -n "$BACKEND_FAST_TEST_MODULES" ]; then
  echo "[release] backend fast targets: $BACKEND_FAST_TEST_MODULES"
fi
if [ -n "$FRONTEND_FAST_SMOKES" ]; then
  echo "[release] frontend fast smokes: $FRONTEND_FAST_SMOKES"
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
  frontend_fast_smokes=(auth ops runtime)
  if [ -n "$FRONTEND_FAST_SMOKES" ]; then
    IFS=' ' read -r -a frontend_fast_smokes <<< "$FRONTEND_FAST_SMOKES"
  fi

  if [ "$FAST_MODE" = "1" ]; then
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
  else
    frontend_fast_port=3001
    for frontend_smoke in "${frontend_fast_smokes[@]}"; do
      case "$frontend_smoke" in
        auth|ops|runtime)
          echo "[release] frontend ${frontend_smoke} smoke"
          FRONTEND_SMOKE_PORT="$frontend_fast_port" npm --prefix frontend run "smoke:${frontend_smoke}"
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
    NEXT_PUBLIC_SMOKE_RESTORE_REPORT=1 \
      bash scripts/frontend_restore_smoke.sh

    clean_frontend_build_artifacts
    echo "[release] frontend build"
    npm --prefix frontend run build
  fi
  frontend_duration=$(( $(date +%s) - frontend_start_ts ))
fi

backend_duration=0
if [ "$SURFACE" = "backend" ] || [ "$SURFACE" = "full" ]; then
  backend_start_ts="$(date +%s)"
  if [ "$FAST_MODE" = "1" ]; then
    if [ -n "$BACKEND_FAST_TEST_MODULES" ]; then
      echo "[release] backend targeted fast suite"
      IFS=' ' read -r -a backend_fast_modules <<< "$BACKEND_FAST_TEST_MODULES"
      PYTHONPATH=backend "$BACKEND_PYTHON" -m unittest "${backend_fast_modules[@]}"
    else
      echo "[release] backend fast safety suite"
      PYTHONPATH=backend "$BACKEND_PYTHON" -m unittest \
        backend.tests.test_auth_security \
        backend.tests.test_ops_api_flow \
        backend.tests.test_restore_dry_run \
        backend.tests.test_server_credentials_policy
    fi
  else
    echo "[release] backend test suite"
    PYTHONPATH=backend "$BACKEND_PYTHON" -m unittest discover -s backend/tests -p 'test_*.py'
  fi
  backend_duration=$(( $(date +%s) - backend_start_ts ))
fi

echo "[release] executed phases:"
if [ "$SURFACE" = "frontend" ] || [ "$SURFACE" = "full" ]; then
  if [ "$FAST_MODE" = "1" ]; then
    if [ -n "$FRONTEND_FAST_SMOKES" ]; then
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
    if [ -n "$BACKEND_FAST_TEST_MODULES" ]; then
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
timing_history_print_hint "release_workflow" "$SURFACE" "$FAST_MODE"
echo "[release] next: git status --short"
echo "[release] next: git push origin develop"
echo "[release] next: follow RUNBOOK.md for deploy and post-deploy smoke"
