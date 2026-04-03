#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_FORMAT="human"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/dev_doctor.sh [--format human|shell]

Print the recommended local loop, follow-up hint, latest timing bottleneck, and PR doctor summary.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --format)
      OUTPUT_FORMAT="${2:-human}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[dev-doctor] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"

recommendation_output="$(bash scripts/recommend_local_mode.sh)"
recommended_command=""
recommendation_reason=""
followup_command=""
followup_reason=""
surface=""
bottleneck_line=""
pr_doctor_output=""
pr_overall_status=""

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

case "${surface:-full}" in
  frontend|backend|full)
    bottleneck_line="$(bash scripts/timing_history.sh print_hint_fields release_workflow "${surface:-full}" 1 160 2>/dev/null || true)"
    ;;
esac

pr_doctor_output="$(bash scripts/pr_doctor.sh --format shell 2>/dev/null || true)"
while IFS='=' read -r key value; do
  case "$key" in
    overall_status)
      pr_overall_status="$value"
      ;;
  esac
done <<< "$pr_doctor_output"

if [ "$OUTPUT_FORMAT" = "shell" ]; then
  printf 'recommended_command=%s\n' "${recommended_command:-make changed}"
  printf 'recommendation_reason=%s\n' "${recommendation_reason:-current diff}"
  printf 'followup_command=%s\n' "$followup_command"
  printf 'followup_reason=%s\n' "$followup_reason"
  printf 'surface=%s\n' "$surface"
  printf 'pr_overall_status=%s\n' "$pr_overall_status"
  if [ -n "$bottleneck_line" ]; then
    printf '%s\n' "$bottleneck_line"
  fi
else
  echo "[dev-doctor] recommended loop: ${recommended_command:-make changed}"
  echo "[dev-doctor] reason: ${recommendation_reason:-current diff}"
  if [ -n "$followup_command" ]; then
    echo "[dev-doctor] cheap follow-up: $followup_command"
    echo "[dev-doctor] follow-up reason: ${followup_reason:-same diff can use a cheaper rerun}"
  fi
  if [ -n "$bottleneck_line" ]; then
    while IFS='=' read -r key value; do
      case "$key" in
        phase)
          echo "[dev-doctor] recent bottleneck phase: $value"
          ;;
        avg_seconds)
          echo "[dev-doctor] recent bottleneck avg seconds: $value"
          ;;
        count)
          echo "[dev-doctor] recent bottleneck sample count: $value"
          ;;
      esac
    done <<< "$bottleneck_line"
  fi

  echo
  bash scripts/pr_doctor.sh || true
fi
