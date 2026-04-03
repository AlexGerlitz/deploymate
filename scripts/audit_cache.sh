#!/usr/bin/env bash

audit_cache_prepare() {
  local root_dir=""
  root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  if [ -z "${DEPLOYMATE_AUDIT_CACHE_DIR:-}" ]; then
    DEPLOYMATE_AUDIT_CACHE_DIR="$(mktemp -d)"
    export DEPLOYMATE_AUDIT_CACHE_DIR
    DEPLOYMATE_AUDIT_CACHE_OWNED=1
    export DEPLOYMATE_AUDIT_CACHE_OWNED
  fi
  if [ -z "${DEPLOYMATE_PERSISTENT_AUDIT_CACHE_DIR:-}" ]; then
    DEPLOYMATE_PERSISTENT_AUDIT_CACHE_DIR="$root_dir/.logs/audit_fingerprints"
    export DEPLOYMATE_PERSISTENT_AUDIT_CACHE_DIR
  fi
  mkdir -p "$DEPLOYMATE_PERSISTENT_AUDIT_CACHE_DIR"
}

audit_cache_cleanup() {
  if [ "${DEPLOYMATE_AUDIT_CACHE_OWNED:-0}" = "1" ] && [ -n "${DEPLOYMATE_AUDIT_CACHE_DIR:-}" ]; then
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

audit_cache_persistent_key_path() {
  local key="$1"
  printf '%s/%s.fingerprint\n' "$DEPLOYMATE_PERSISTENT_AUDIT_CACHE_DIR" "$key"
}

audit_cache_hash_cmd() {
  if command -v shasum >/dev/null 2>&1; then
    printf 'shasum -a 256\n'
  else
    printf 'sha256sum\n'
  fi
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

audit_cache_persistent_clear() {
  audit_cache_prepare
  rm -rf "$DEPLOYMATE_PERSISTENT_AUDIT_CACHE_DIR"
  mkdir -p "$DEPLOYMATE_PERSISTENT_AUDIT_CACHE_DIR"
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
