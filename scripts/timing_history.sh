#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIMING_DIR="$ROOT_DIR/.logs"
TIMING_FILE="$TIMING_DIR/local_gate_timing.csv"
TIMING_MAX_ROWS="${TIMING_MAX_ROWS:-4000}"

timing_history_prepare() {
  mkdir -p "$TIMING_DIR"
  if [ ! -f "$TIMING_FILE" ]; then
    cat >"$TIMING_FILE" <<'EOF'
timestamp_utc,script,surface,fast_mode,phase,duration_seconds,git_head
EOF
  fi
}

timing_history_trim() {
  local data_rows=""
  local keep_rows=""
  local tmp_file=""

  timing_history_prepare

  data_rows="$(tail -n +2 "$TIMING_FILE" | wc -l | tr -d ' ')"
  if [ "$data_rows" -le "$TIMING_MAX_ROWS" ]; then
    return 0
  fi

  keep_rows="$TIMING_MAX_ROWS"
  tmp_file="$(mktemp)"
  {
    head -n 1 "$TIMING_FILE"
    tail -n "$keep_rows" "$TIMING_FILE"
  } >"$tmp_file"
  mv "$tmp_file" "$TIMING_FILE"
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

  timing_history_trim
}

timing_history_print_recent() {
  local line_count="${1:-12}"

  timing_history_prepare
  tail -n "$line_count" "$TIMING_FILE"
}

timing_history_print_stats() {
  local row_count="${1:-160}"
  local stats_body=""

  timing_history_prepare

  stats_body="$(awk -F',' -v row_count="$row_count" '
    NR == 1 {
      next
    }
    {
      rows[buffer_size % row_count] = $0
      buffer_size++
    }
    END {
      start = buffer_size > row_count ? buffer_size - row_count : 0
      for (i = start; i < buffer_size; i++) {
        split(rows[i % row_count], fields, ",")
        key = fields[2] "|" fields[3] "|" fields[4] "|" fields[5]
        duration = fields[6] + 0
        count[key]++
        sum[key] += duration
        latest[key] = duration
        if (!(key in min) || duration < min[key]) {
          min[key] = duration
        }
        if (!(key in max) || duration > max[key]) {
          max[key] = duration
        }
      }
      for (key in count) {
        avg = sum[key] / count[key]
        printf "%s|%d|%.2f|%d|%d|%d\n", key, count[key], avg, min[key], max[key], latest[key]
      }
    }
  ' "$TIMING_FILE" | sort)"

  printf '%s\n' "script|surface|fast|phase|count|avg_s|min_s|max_s|latest_s"
  if [ -n "$stats_body" ]; then
    printf '%s\n' "$stats_body"
  fi
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  command="${1:-print_recent}"
  case "$command" in
    print_recent)
      shift || true
      timing_history_print_recent "${1:-12}"
      ;;
    print_stats)
      shift || true
      timing_history_print_stats "${1:-160}"
      ;;
    *)
      echo "[timing-history] unknown command: $command" >&2
      echo "Usage: bash scripts/timing_history.sh [print_recent|print_stats] [count]" >&2
      exit 1
      ;;
  esac
fi
