#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SURFACE="full"
FAST_MODE=0
source "$ROOT_DIR/scripts/audit_cache.sh"
source "$ROOT_DIR/scripts/timing_history.sh"
SCRIPT_START_TS="$(date +%s)"

format_duration() {
  local seconds="$1"
  printf '%ss' "$seconds"
}

clean_frontend_build_artifacts() {
  if [ -d "frontend/.next" ]; then
    echo "[preflight] removing stale frontend/.next"
    rm -rf "frontend/.next"
  fi
}

usage() {
  cat <<'EOF'
Usage:
  bash scripts/preflight.sh [--surface frontend|backend|full] [--fast]
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
      echo "[preflight] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

case "$SURFACE" in
  frontend|backend|full)
    ;;
  *)
    echo "[preflight] invalid surface: $SURFACE" >&2
    usage >&2
    exit 1
    ;;
esac

cd "$ROOT_DIR"

audit_cache_prepare
trap audit_cache_cleanup EXIT

echo "[preflight] repo: $ROOT_DIR"
echo "[preflight] surface: $SURFACE"
echo "[preflight] fast mode: $FAST_MODE"
echo "[preflight] git status"
git status --short

frontend_build_duration=0
if [ -f "frontend/package.json" ] && { [ "$SURFACE" = "frontend" ] || [ "$SURFACE" = "full" ]; }; then
  if [ "$FAST_MODE" = "1" ]; then
    echo "[preflight] frontend build skipped in fast mode"
  else
    frontend_build_start_ts="$(date +%s)"
    clean_frontend_build_artifacts
    echo "[preflight] frontend build"
    npm --prefix frontend run build
    frontend_build_duration=$(( $(date +%s) - frontend_build_start_ts ))
  fi
fi

backend_syntax_duration=0
if [ -d "backend/app" ] && { [ "$SURFACE" = "backend" ] || [ "$SURFACE" = "full" ]; }; then
  backend_syntax_start_ts="$(date +%s)"
  echo "[preflight] backend syntax check"
  python_files=()
  while IFS= read -r file; do
    python_files+=("$file")
  done < <(find backend/app -type f -name '*.py' | sort)
  if [ "${#python_files[@]}" -gt 0 ]; then
    python3 -m py_compile "${python_files[@]}"
  fi
  backend_syntax_duration=$(( $(date +%s) - backend_syntax_start_ts ))
fi

security_audit_duration=0
if [ -f "scripts/security_audit.sh" ]; then
  security_audit_start_ts="$(date +%s)"
  echo "[preflight] security audit"
  bash scripts/security_audit.sh
  security_audit_duration=$(( $(date +%s) - security_audit_start_ts ))
fi

runtime_capability_duration=0
if [ -f "scripts/runtime_capability_audit.sh" ]; then
  if [ "${DEPLOYMATE_RUN_RUNTIME_AUDITS:-1}" = "1" ]; then
    runtime_capability_start_ts="$(date +%s)"
    echo "[preflight] runtime capability audit"
    bash scripts/runtime_capability_audit.sh
    runtime_capability_duration=$(( $(date +%s) - runtime_capability_start_ts ))
  else
    echo "[preflight] runtime capability audit skipped for this local diff"
  fi
fi

total_duration=$(( $(date +%s) - SCRIPT_START_TS ))
timing_history_append "preflight" "$SURFACE" "$FAST_MODE" "frontend_build" "$frontend_build_duration"
timing_history_append "preflight" "$SURFACE" "$FAST_MODE" "backend_syntax" "$backend_syntax_duration"
timing_history_append "preflight" "$SURFACE" "$FAST_MODE" "security_audit" "$security_audit_duration"
timing_history_append "preflight" "$SURFACE" "$FAST_MODE" "runtime_capability_audit" "$runtime_capability_duration"
timing_history_append "preflight" "$SURFACE" "$FAST_MODE" "total" "$total_duration"
echo "[preflight] timing summary:"
echo "[preflight]   - frontend build: $(format_duration "$frontend_build_duration")"
echo "[preflight]   - backend syntax: $(format_duration "$backend_syntax_duration")"
echo "[preflight]   - security audit: $(format_duration "$security_audit_duration")"
echo "[preflight]   - runtime capability audit: $(format_duration "$runtime_capability_duration")"
echo "[preflight]   - total: $(format_duration "$total_duration")"
echo "[preflight] timing history: .logs/local_gate_timing.csv"
timing_history_print_hint "preflight" "$SURFACE" "$FAST_MODE"
echo "[preflight] done"
