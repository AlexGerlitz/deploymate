#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DELETE_BRANCH=0
MERGE_STRATEGY="squash"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/pr_land_sync.sh [--merge|--squash|--rebase] [--delete-branch]

Merge the current PR and then fast-forward main from develop.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --merge)
      MERGE_STRATEGY="merge"
      shift
      ;;
    --squash)
      MERGE_STRATEGY="squash"
      shift
      ;;
    --rebase)
      MERGE_STRATEGY="rebase"
      shift
      ;;
    --delete-branch)
      DELETE_BRANCH=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[pr-land-sync] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"

land_args=()
case "$MERGE_STRATEGY" in
  merge)
    land_args+=(--merge)
    ;;
  squash)
    land_args+=(--squash)
    ;;
  rebase)
    land_args+=(--rebase)
    ;;
esac
if [ "$DELETE_BRANCH" = "1" ]; then
  land_args+=(--delete-branch)
fi

bash scripts/pr_land.sh "${land_args[@]}"
bash scripts/sync_main.sh

echo "[pr-land-sync] merged PR and synced main from develop"
