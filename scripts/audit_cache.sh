#!/usr/bin/env bash

audit_cache_prepare() {
  if [ -z "${DEPLOYMATE_AUDIT_CACHE_DIR:-}" ]; then
    DEPLOYMATE_AUDIT_CACHE_DIR="$(mktemp -d)"
    export DEPLOYMATE_AUDIT_CACHE_DIR
    DEPLOYMATE_AUDIT_CACHE_OWNED=1
    export DEPLOYMATE_AUDIT_CACHE_OWNED
  fi
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
