#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIMING_DIR="$ROOT_DIR/.logs"
TIMING_FILE="$TIMING_DIR/local_gate_timing.csv"

timing_history_prepare() {
  mkdir -p "$TIMING_DIR"
  if [ ! -f "$TIMING_FILE" ]; then
    cat >"$TIMING_FILE" <<'EOF'
timestamp_utc,script,surface,fast_mode,phase,duration_seconds,git_head
EOF
  fi
}

timing_history_append() {
  local script_name="$1"
  local surface="$2"
  local fast_mode="$3"
  local phase="$4"
  local duration_seconds="$5"
  local timestamp_utc=""
  local git_head=""

  timing_history_prepare

  timestamp_utc="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  git_head="$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")"

  printf '%s,%s,%s,%s,%s,%s,%s\n' \
    "$timestamp_utc" \
    "$script_name" \
    "$surface" \
    "$fast_mode" \
    "$phase" \
    "$duration_seconds" \
    "$git_head" >>"$TIMING_FILE"
}

timing_history_print_recent() {
  local line_count="${1:-12}"

  timing_history_prepare
  tail -n "$line_count" "$TIMING_FILE"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  command="${1:-print_recent}"
  case "$command" in
    print_recent)
      shift || true
      timing_history_print_recent "${1:-12}"
      ;;
    *)
      echo "[timing-history] unknown command: $command" >&2
      echo "Usage: bash scripts/timing_history.sh [print_recent] [line_count]" >&2
      exit 1
      ;;
  esac
fi
