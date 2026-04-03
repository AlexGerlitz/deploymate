#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/audit_cache.sh"
PROFILE_MODE="${1:-changed}"
STATS_COUNT="${TIMING_STATS_COUNT:-160}"
RECENT_COUNT="${TIMING_RECENT_COUNT:-12}"
HINT_ROWS="${TIMING_HINT_ROWS:-160}"
HINT_SURFACE="full"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/profile_surface.sh [changed|frontend|backend|full]
EOF
}

case "$PROFILE_MODE" in
  changed)
    ;;
  frontend|backend|full)
    HINT_SURFACE="$PROFILE_MODE"
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    echo "[profile-surface] invalid mode: $PROFILE_MODE" >&2
    usage >&2
    exit 1
    ;;
esac

cd "$ROOT_DIR"

audit_cache_prepare
trap audit_cache_cleanup EXIT

if [ "$PROFILE_MODE" = "changed" ]; then
  echo "[profile-surface] running changed-file fast gate"
  shift || true
  bash scripts/dev_verify_changed.sh "$@"
else
  echo "[profile-surface] running fast gate for surface: $PROFILE_MODE"
  bash scripts/dev_fast_check.sh "$PROFILE_MODE"
fi

echo "[profile-surface] recent timing rows"
bash scripts/timing_history.sh print_recent "$RECENT_COUNT"

echo "[profile-surface] grouped timing stats"
bash scripts/timing_history.sh print_stats "$STATS_COUNT"

audit_cache_print_summary "[profile-surface]"
audit_cache_print_family_summary "[profile-surface]"
audit_cache_print_family_hint "[profile-surface]"

echo "[profile-surface] release bottleneck hint"
bash scripts/timing_history.sh print_hint release_workflow "$HINT_SURFACE" 1 "$HINT_ROWS" || true
