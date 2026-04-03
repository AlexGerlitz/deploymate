#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_BRANCH="${SOURCE_BRANCH:-develop}"
TARGET_BRANCH="${TARGET_BRANCH:-main}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/sync_main.sh [--source <branch>] [--target <branch>]

Fast-forward the target branch from the source branch and push it.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --source)
      SOURCE_BRANCH="${2:-}"
      shift 2
      ;;
    --target)
      TARGET_BRANCH="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[sync-main] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"

if [ -n "$(git status --short)" ]; then
  echo "[sync-main] working tree is dirty; commit or stash changes first" >&2
  exit 1
fi

current_branch="$(git branch --show-current)"

git fetch origin "$SOURCE_BRANCH" "$TARGET_BRANCH" >/dev/null
git switch "$TARGET_BRANCH" >/dev/null
git merge --ff-only "origin/$SOURCE_BRANCH" >/dev/null
git push origin "$TARGET_BRANCH"

echo "[sync-main] synced $TARGET_BRANCH <- origin/$SOURCE_BRANCH"

if [ -n "$current_branch" ] && [ "$current_branch" != "$TARGET_BRANCH" ]; then
  git switch "$current_branch" >/dev/null
fi
