#!/usr/bin/env bash

audit_cache_prepare() {
  local root_dir=""
  root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  if [ -z "${DEPLOYMATE_AUDIT_CACHE_DIR:-}" ]; then
    DEPLOYMATE_AUDIT_CACHE_DIR="$(mktemp -d)"
    export DEPLOYMATE_AUDIT_CACHE_DIR
    DEPLOYMATE_AUDIT_CACHE_OWNED=1
    export DEPLOYMATE_AUDIT_CACHE_OWNED
    DEPLOYMATE_AUDIT_CACHE_OWNER_PID="$$"
    export DEPLOYMATE_AUDIT_CACHE_OWNER_PID
  fi
  if [ -z "${DEPLOYMATE_PERSISTENT_AUDIT_CACHE_DIR:-}" ]; then
    DEPLOYMATE_PERSISTENT_AUDIT_CACHE_DIR="$root_dir/.logs/audit_fingerprints"
    export DEPLOYMATE_PERSISTENT_AUDIT_CACHE_DIR
  fi
  mkdir -p "$DEPLOYMATE_PERSISTENT_AUDIT_CACHE_DIR"
  if [ -z "${DEPLOYMATE_AUDIT_CACHE_STATS_FILE:-}" ]; then
    DEPLOYMATE_AUDIT_CACHE_STATS_FILE="$DEPLOYMATE_AUDIT_CACHE_DIR/stats.log"
    export DEPLOYMATE_AUDIT_CACHE_STATS_FILE
  fi
  if [ "${DEPLOYMATE_AUDIT_CACHE_STATS_INITIALIZED:-0}" != "1" ]; then
    : > "${DEPLOYMATE_AUDIT_CACHE_STATS_FILE}"
    DEPLOYMATE_AUDIT_CACHE_STATS_INITIALIZED=1
    export DEPLOYMATE_AUDIT_CACHE_STATS_INITIALIZED
  fi
}

audit_cache_cleanup() {
  if [ "${DEPLOYMATE_AUDIT_CACHE_OWNED:-0}" = "1" ] \
    && [ "${DEPLOYMATE_AUDIT_CACHE_OWNER_PID:-}" = "$$" ] \
    && [ -n "${DEPLOYMATE_AUDIT_CACHE_DIR:-}" ]; then
    rm -rf "$DEPLOYMATE_AUDIT_CACHE_DIR"
  fi
}

audit_cache_key_path() {
  local key="$1"
  printf '%s/%s.done\n' "$DEPLOYMATE_AUDIT_CACHE_DIR" "$key"
}

audit_cache_has() {
  local key="$1"
  [ -n "${DEPLOYMATE_AUDIT_CACHE_DIR:-}" ] && [ -f "$(audit_cache_key_path "$key")" ]
}

audit_cache_mark() {
  local key="$1"
  [ -n "${DEPLOYMATE_AUDIT_CACHE_DIR:-}" ] || return 0
  : > "$(audit_cache_key_path "$key")"
}

audit_cache_record_event() {
  local event_type="$1"
  local key="$2"
  [ -n "${DEPLOYMATE_AUDIT_CACHE_STATS_FILE:-}" ] || return 0
  printf '%s,%s\n' "$event_type" "$key" >>"$DEPLOYMATE_AUDIT_CACHE_STATS_FILE"
}

audit_cache_persistent_key_path() {
  local key="$1"
  printf '%s/%s.fingerprint\n' "$DEPLOYMATE_PERSISTENT_AUDIT_CACHE_DIR" "$key"
}

audit_cache_persistent_value_path() {
  local key="$1"
  printf '%s/%s.value\n' "$DEPLOYMATE_PERSISTENT_AUDIT_CACHE_DIR" "$key"
}

audit_cache_hash_cmd() {
  if command -v shasum >/dev/null 2>&1; then
    printf 'shasum -a 256\n'
  else
    printf 'sha256sum\n'
  fi
}

audit_cache_hash_string() {
  local data="${1:-}"
  local hash_cmd=""

  hash_cmd="$(audit_cache_hash_cmd)"
  printf '%s' "$data" | eval "$hash_cmd" | awk '{print $1}'
}

audit_cache_key_for_input() {
  local prefix="$1"
  local raw_input="${2:-}"

  printf '%s_%s' "$prefix" "$(audit_cache_hash_string "$raw_input")"
}

audit_cache_fingerprint_files() {
  local seed="$1"
  shift || true
  local hash_cmd=""
  local combined=""
  local file=""
  hash_cmd="$(audit_cache_hash_cmd)"

  combined="$(printf 'seed=%s\n' "$seed")"
  for file in "$@"; do
    if [ -f "$file" ]; then
      combined="${combined}file=${file}\n"
      combined="${combined}$(eval "$hash_cmd" "\"$file\"" | awk '{print $1}')\n"
    else
      combined="${combined}missing=${file}\n"
    fi
  done

  printf '%b' "$combined" | eval "$hash_cmd" | awk '{print $1}'
}

audit_cache_fingerprint_inputs() {
  local seed="$1"
  local metadata="${2:-}"
  shift 2 || true
  local hash_cmd=""
  local combined=""
  local file=""

  hash_cmd="$(audit_cache_hash_cmd)"
  combined="$(printf 'seed=%s\nmetadata=%s\n' "$seed" "$metadata")"

  for file in "$@"; do
    if [ -f "$file" ]; then
      combined="${combined}file=${file}\n"
      combined="${combined}$(eval "$hash_cmd" "\"$file\"" | awk '{print $1}')\n"
    else
      combined="${combined}missing=${file}\n"
    fi
  done

  printf '%b' "$combined" | eval "$hash_cmd" | awk '{print $1}'
}

audit_cache_persistent_has() {
  local key="$1"
  local fingerprint="$2"
  local path=""
  path="$(audit_cache_persistent_key_path "$key")"
  [ -f "$path" ] && [ "$(cat "$path")" = "$fingerprint" ]
}

audit_cache_persistent_mark() {
  local key="$1"
  local fingerprint="$2"
  local path=""
  path="$(audit_cache_persistent_key_path "$key")"
  printf '%s\n' "$fingerprint" >"$path"
}

audit_cache_persistent_store_value() {
  local key="$1"
  local value="${2:-}"
  local path=""
  path="$(audit_cache_persistent_value_path "$key")"
  printf '%s' "$value" >"$path"
}

audit_cache_persistent_store_file() {
  local key="$1"
  local source_file="$2"
  local path=""
  path="$(audit_cache_persistent_value_path "$key")"
  cat "$source_file" >"$path"
}

audit_cache_persistent_read_value() {
  local key="$1"
  local path=""
  path="$(audit_cache_persistent_value_path "$key")"
  [ -f "$path" ] || return 1
  cat "$path"
}

audit_cache_persistent_clear() {
  audit_cache_prepare
  rm -rf "$DEPLOYMATE_PERSISTENT_AUDIT_CACHE_DIR"
  mkdir -p "$DEPLOYMATE_PERSISTENT_AUDIT_CACHE_DIR"
}

audit_cache_print_summary() {
  local prefix="${1:-[audit-cache]}"
  local stats_file="${DEPLOYMATE_AUDIT_CACHE_STATS_FILE:-}"
  local summary=""

  [ -n "$stats_file" ] && [ -f "$stats_file" ] || return 0

  summary="$(awk -F',' '
    {
      counts[$1]++
    }
    END {
      printf "persistent_hit=%d persistent_miss=%d run_hit=%d phase_hit=%d phase_miss=%d", counts["persistent_hit"] + 0, counts["persistent_miss"] + 0, counts["run_hit"] + 0, counts["phase_hit"] + 0, counts["phase_miss"] + 0
    }
  ' "$stats_file")"

  case "$summary" in
    "persistent_hit=0 persistent_miss=0 run_hit=0 phase_hit=0 phase_miss=0")
      return 0
      ;;
  esac

  printf '%s cache summary: %s\n' "$prefix" "$summary"
}

audit_cache_print_family_summary() {
  local prefix="${1:-[audit-cache]}"
  local stats_file="${DEPLOYMATE_AUDIT_CACHE_STATS_FILE:-}"
  local summary_body=""

  [ -n "$stats_file" ] && [ -f "$stats_file" ] || return 0

  summary_body="$(awk -F',' '
    function family_for_key(key) {
      if (key ~ /^security_/ || key == "security_audit") {
        return "security"
      }
      if (key ~ /^release_workflow_audit$/ || key ~ /^release_workflow_contract_/) {
        return "release_contract"
      }
      if (key ~ /^runtime_capability_audit/ || key ~ /^local_runtime_audit/) {
        return "runtime"
      }
      return ""
    }
    {
      family = family_for_key($2)
      if (family == "") {
        next
      }
      counts[family "," $1]++
    }
    END {
      families[1] = "security"
      families[2] = "release_contract"
      families[3] = "runtime"
      for (i = 1; i <= 3; i++) {
        family = families[i]
        hit = counts[family ",persistent_hit"] + counts[family ",phase_hit"] + counts[family ",run_hit"]
        miss = counts[family ",persistent_miss"] + counts[family ",phase_miss"]
        if (hit + miss > 0) {
          printf "%s hit=%d miss=%d\n", family, hit, miss
        }
      }
    }
  ' "$stats_file")"

  [ -n "$summary_body" ] || return 0

  while IFS= read -r line; do
    [ -n "$line" ] || continue
    printf '%s family cache: %s\n' "$prefix" "$line"
  done <<< "$summary_body"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  set -euo pipefail
  command="${1:-clear_persistent}"
  case "$command" in
    clear_persistent)
      audit_cache_persistent_clear
      echo "[audit-cache] cleared persistent audit fingerprints"
      ;;
    *)
      echo "Usage: bash scripts/audit_cache.sh [clear_persistent]" >&2
      exit 1
      ;;
  esac
fi
