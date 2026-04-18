#!/usr/bin/env bash

set -euo pipefail

ROOT_USAGE_THRESHOLD="${DEPLOYMATE_RELEASE_DISK_GUARD_THRESHOLD:-80}"
BUILDER_CACHE_MAX_AGE="${DEPLOYMATE_RELEASE_BUILDER_CACHE_MAX_AGE:-24h}"
BUILDER_CACHE_PRUNE_ALWAYS="${DEPLOYMATE_RELEASE_BUILDER_CACHE_PRUNE_ALWAYS:-1}"

require_integer() {
  local name="$1"
  local value="$2"

  case "$value" in
    ''|*[!0-9]*)
      echo "[release-disk-guard] invalid integer for $name: $value" >&2
      exit 1
      ;;
  esac
}

require_toggle() {
  local name="$1"
  local value="$2"

  case "$value" in
    0|1)
      ;;
    *)
      echo "[release-disk-guard] invalid toggle for $name: $value" >&2
      exit 1
      ;;
  esac
}

root_usage_percent() {
  df -P / | awk 'NR==2 { gsub("%", "", $5); print $5 }'
}

require_integer "DEPLOYMATE_RELEASE_DISK_GUARD_THRESHOLD" "$ROOT_USAGE_THRESHOLD"
require_toggle "DEPLOYMATE_RELEASE_BUILDER_CACHE_PRUNE_ALWAYS" "$BUILDER_CACHE_PRUNE_ALWAYS"

if ! command -v docker >/dev/null 2>&1; then
  echo "[release-disk-guard] docker not found; skipping"
  exit 0
fi

usage_before="$(root_usage_percent)"
require_integer "root usage percent" "$usage_before"

echo "[release-disk-guard] root usage before: ${usage_before}%"

should_prune="$BUILDER_CACHE_PRUNE_ALWAYS"
if [ "$should_prune" != "1" ] && [ "$usage_before" -ge "$ROOT_USAGE_THRESHOLD" ]; then
  should_prune="1"
fi

if [ "$should_prune" = "1" ]; then
  echo "[release-disk-guard] pruning builder cache older than $BUILDER_CACHE_MAX_AGE"
  if ! docker builder prune --force --filter "until=$BUILDER_CACHE_MAX_AGE"; then
    echo "[release-disk-guard] builder cache prune failed; continuing" >&2
  fi
else
  echo "[release-disk-guard] root usage below ${ROOT_USAGE_THRESHOLD}%; skipping builder prune"
fi

usage_after="$(root_usage_percent)"
require_integer "root usage percent" "$usage_after"

echo "[release-disk-guard] root usage after: ${usage_after}%"

if [ "$usage_after" -ge "$ROOT_USAGE_THRESHOLD" ]; then
  echo "[release-disk-guard] warning: root usage still at or above ${ROOT_USAGE_THRESHOLD}%" >&2
fi
