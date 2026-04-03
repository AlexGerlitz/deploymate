#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SURFACE="full"
FAST_MODE=0
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

clean_frontend_build_artifacts() {
  local frontend_dir=""
  frontend_dir="$(automation_frontend_dir_rel)"
  if [ -d "${frontend_dir}/.next" ]; then
    echo "[preflight] removing stale ${frontend_dir}/.next"
    rm -rf "${frontend_dir}/.next"
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
if [ -f "$(automation_frontend_dir_rel)/package.json" ] && { [ "$SURFACE" = "frontend" ] || [ "$SURFACE" = "full" ]; }; then
  if [ "$FAST_MODE" = "1" ]; then
    echo "[preflight] frontend build skipped in fast mode"
  else
    frontend_build_start_ts="$(date +%s)"
    frontend_build_cache_key="preflight_frontend_build"
    frontend_build_metadata="$(printf 'surface=%s\nfast=%s\nfrontend_dir=%s\n' "$SURFACE" "$FAST_MODE" "$(automation_frontend_dir_rel)")"
    frontend_build_files=()
    while IFS= read -r file; do
      [ -n "$file" ] && frontend_build_files+=("$file")
    done < <(git ls-files "$(automation_frontend_dir_rel)")
    if [ -f ".env.production.example" ]; then
      frontend_build_files+=(".env.production.example")
    fi
    frontend_build_fingerprint="$(phase_cache_fingerprint "$frontend_build_cache_key" "$frontend_build_metadata" "${frontend_build_files[@]}")"
    if audit_cache_persistent_has "$frontend_build_cache_key" "$frontend_build_fingerprint"; then
      echo "[preflight] frontend build cache hit"
      audit_cache_record_event phase_hit "$frontend_build_cache_key"
    else
      echo "[preflight] frontend build cache miss"
      audit_cache_record_event phase_miss "$frontend_build_cache_key"
      clean_frontend_build_artifacts
      echo "[preflight] frontend build"
      automation_frontend_npm run build
      audit_cache_persistent_mark "$frontend_build_cache_key" "$frontend_build_fingerprint"
    fi
    frontend_build_duration=$(( $(date +%s) - frontend_build_start_ts ))
  fi
fi

backend_syntax_duration=0
if [ -d "$(automation_backend_app_dir_rel)" ] && { [ "$SURFACE" = "backend" ] || [ "$SURFACE" = "full" ]; }; then
  backend_syntax_start_ts="$(date +%s)"
  echo "[preflight] backend syntax check"
  python_files=()
  if [ "${DEPLOYMATE_BACKEND_SYNTAX_MODE:-full}" = "skip" ]; then
    echo "[preflight] backend syntax skipped for this local diff"
  elif [ "${DEPLOYMATE_BACKEND_SYNTAX_MODE:-full}" = "targeted" ] && [ -n "${DEPLOYMATE_BACKEND_PYTHON_FILES:-}" ]; then
    IFS=' ' read -r -a python_files <<< "$DEPLOYMATE_BACKEND_PYTHON_FILES"
    echo "[preflight] backend syntax scope: targeted"
  else
    while IFS= read -r file; do
      python_files+=("$file")
    done < <(find "$(automation_backend_app_dir_rel)" -type f -name '*.py' | sort)
    echo "[preflight] backend syntax scope: full"
  fi
  if [ "${#python_files[@]}" -gt 0 ]; then
    backend_syntax_cache_key="preflight_backend_syntax"
    backend_syntax_metadata="$(printf 'surface=%s\nfast=%s\nmode=%s\nfiles=%s\n' "$SURFACE" "$FAST_MODE" "${DEPLOYMATE_BACKEND_SYNTAX_MODE:-full}" "${python_files[*]}")"
    backend_syntax_fingerprint="$(phase_cache_fingerprint "$backend_syntax_cache_key" "$backend_syntax_metadata" "${python_files[@]}")"
    if audit_cache_persistent_has "$backend_syntax_cache_key" "$backend_syntax_fingerprint"; then
      echo "[preflight] backend syntax cache hit"
      audit_cache_record_event phase_hit "$backend_syntax_cache_key"
    else
      echo "[preflight] backend syntax cache miss"
      audit_cache_record_event phase_miss "$backend_syntax_cache_key"
      python3 -m py_compile "${python_files[@]}"
      audit_cache_persistent_mark "$backend_syntax_cache_key" "$backend_syntax_fingerprint"
    fi
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
audit_cache_print_summary "[preflight]"
timing_history_print_hint "preflight" "$SURFACE" "$FAST_MODE"
echo "[preflight] done"
