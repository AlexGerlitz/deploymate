#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SURFACE="${1:-full}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/dev_fast_check.sh [frontend|backend|full]

Runs the lightweight local gate:
  - frontend: auth + ops + runtime smokes
  - backend: focused safety test set
  - full: both
EOF
}

case "$SURFACE" in
  frontend|backend|full)
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    echo "[dev-fast-check] invalid surface: $SURFACE" >&2
    usage >&2
    exit 1
    ;;
esac

cd "$ROOT_DIR"

echo "[dev-fast-check] surface: $SURFACE"
bash scripts/release_workflow.sh --surface "$SURFACE" --fast
