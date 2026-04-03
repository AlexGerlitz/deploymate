#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATS_COUNT="${TIMING_STATS_COUNT:-160}"
RECENT_COUNT="${TIMING_RECENT_COUNT:-12}"
HINT_ROWS="${TIMING_HINT_ROWS:-160}"

cd "$ROOT_DIR"

echo "[profile-changed] running changed-file fast gate"
bash scripts/dev_verify_changed.sh "$@"

echo "[profile-changed] recent timing rows"
bash scripts/timing_history.sh print_recent "$RECENT_COUNT"

echo "[profile-changed] grouped timing stats"
bash scripts/timing_history.sh print_stats "$STATS_COUNT"

echo "[profile-changed] release bottleneck hint"
bash scripts/timing_history.sh print_hint release_workflow full 1 "$HINT_ROWS" || true
