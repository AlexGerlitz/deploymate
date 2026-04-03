#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_BRANCH="${BASE_BRANCH:-develop}"
PREFIX="${PREFIX:-feat}"
SLUG=""

usage() {
  cat <<'EOF'
Usage:
  bash scripts/start_pr_branch.sh <slug>
  bash scripts/start_pr_branch.sh --slug <slug> [--base <branch>] [--prefix <prefix>]

Create a clean feature branch for PR work from the chosen base branch.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --slug)
      SLUG="${2:-}"
      shift 2
      ;;
    --base)
      BASE_BRANCH="${2:-}"
      shift 2
      ;;
    --prefix)
      PREFIX="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [ -z "$SLUG" ]; then
        SLUG="$1"
        shift
      else
        echo "[start-pr-branch] unknown argument: $1" >&2
        usage >&2
        exit 1
      fi
      ;;
  esac
done

if [ -z "$SLUG" ]; then
  echo "[start-pr-branch] branch slug is required" >&2
  usage >&2
  exit 1
fi

cd "$ROOT_DIR"

if [ -n "$(git status --short)" ]; then
  echo "[start-pr-branch] working tree is dirty; commit or stash changes first" >&2
  exit 1
fi

sanitized_slug="$(printf '%s' "$SLUG" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9._-' '-')"
branch_name="${PREFIX}/${sanitized_slug}"

if ! git show-ref --verify --quiet "refs/heads/$BASE_BRANCH"; then
  echo "[start-pr-branch] local base branch '$BASE_BRANCH' does not exist" >&2
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/$branch_name"; then
  echo "[start-pr-branch] branch '$branch_name' already exists" >&2
  exit 1
fi

git switch "$BASE_BRANCH" >/dev/null
git switch -c "$branch_name" "$BASE_BRANCH" >/dev/null

echo "[start-pr-branch] created $branch_name from $BASE_BRANCH"
echo "[start-pr-branch] next step: make auto-local"
