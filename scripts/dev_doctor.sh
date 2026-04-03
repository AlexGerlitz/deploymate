#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/dev_doctor.sh

Print the recommended local loop, follow-up hint, latest timing bottleneck, and PR doctor summary.
EOF
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

cd "$ROOT_DIR"

recommendation_output="$(bash scripts/recommend_local_mode.sh)"
recommended_command=""
recommendation_reason=""
followup_command=""
followup_reason=""
surface=""

while IFS='=' read -r key value; do
  case "$key" in
    recommended_command)
      recommended_command="$value"
      ;;
    recommendation_reason)
      recommendation_reason="$value"
      ;;
    followup_command)
      followup_command="$value"
      ;;
    followup_reason)
      followup_reason="$value"
      ;;
    surface)
      surface="$value"
      ;;
  esac
done <<< "$recommendation_output"

echo "[dev-doctor] recommended loop: ${recommended_command:-make changed}"
echo "[dev-doctor] reason: ${recommendation_reason:-current diff}"
if [ -n "$followup_command" ]; then
  echo "[dev-doctor] cheap follow-up: $followup_command"
  echo "[dev-doctor] follow-up reason: ${followup_reason:-same diff can use a cheaper rerun}"
fi

case "${surface:-full}" in
  frontend|backend|full)
    bash scripts/timing_history.sh print_hint release_workflow "${surface:-full}" 1 160 || true
    ;;
esac

echo
bash scripts/pr_doctor.sh || true
