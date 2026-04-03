#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INTERVAL="${INTERVAL:-10}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/pr_watch.sh [--interval <seconds>]

Watch PR checks for the current branch and print PR doctor summary after completion.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --interval)
      INTERVAL="${2:-10}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[pr-watch] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"

gh pr checks --watch --interval "$INTERVAL"
echo
bash scripts/pr_doctor.sh || true
