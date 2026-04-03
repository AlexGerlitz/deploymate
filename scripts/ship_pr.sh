#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_BRANCH="${BASE_BRANCH:-develop}"
PREFIX="${PREFIX:-feat}"
SLUG=""
MESSAGE=""
TITLE=""
DRAFT=0

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ship_pr.sh --slug <slug> --message <commit-message> [options]

Options:
  --base <branch>
  --prefix <prefix>
  --title <pr-title>
  --draft

Behavior:
  - creates a feature branch if you are still on develop/main
  - stages all current changes
  - creates one commit
  - runs make pr-ready
  - pushes the branch
  - opens a PR when one does not already exist
EOF
}

sanitize_slug() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9._-' '-'
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --slug)
      SLUG="${2:-}"
      shift 2
      ;;
    --message)
      MESSAGE="${2:-}"
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
    --title)
      TITLE="${2:-}"
      shift 2
      ;;
    --draft)
      DRAFT=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[ship-pr] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ -z "$SLUG" ] || [ -z "$MESSAGE" ]; then
  usage >&2
  exit 1
fi

cd "$ROOT_DIR"

if [ -f ".git/index.lock" ]; then
  echo "[ship-pr] stale .git/index.lock is blocking git operations; remove it first" >&2
  exit 1
fi

current_branch="$(git branch --show-current)"
if [ -z "$current_branch" ]; then
  echo "[ship-pr] detached HEAD is not supported" >&2
  exit 1
fi

if [ -z "$(git status --short)" ]; then
  echo "[ship-pr] nothing to ship; working tree is clean" >&2
  exit 1
fi

if [ "$current_branch" = "$BASE_BRANCH" ] || [ "$current_branch" = "main" ]; then
  branch_name="${PREFIX}/$(sanitize_slug "$SLUG")"
  if git show-ref --verify --quiet "refs/heads/$branch_name"; then
    echo "[ship-pr] branch '$branch_name' already exists" >&2
    exit 1
  fi
  git switch -c "$branch_name" >/dev/null
  current_branch="$branch_name"
  echo "[ship-pr] created feature branch: $current_branch"
fi

git add -A

if git diff --cached --quiet; then
  echo "[ship-pr] nothing staged after git add -A" >&2
  exit 1
fi

git commit -m "$MESSAGE"

bash scripts/pr_ready_check.sh --base "$BASE_BRANCH"

if git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' >/dev/null 2>&1; then
  git push origin "$current_branch"
else
  git push -u origin "$current_branch"
fi

if gh pr view --json number >/dev/null 2>&1; then
  echo "[ship-pr] PR already exists for $current_branch"
  bash scripts/pr_status.sh
  exit 0
fi

open_args=(--base "$BASE_BRANCH")
if [ -n "$TITLE" ]; then
  open_args+=(--title "$TITLE")
fi
if [ "$DRAFT" = "1" ]; then
  open_args+=(--draft)
fi

bash scripts/open_pull_request.sh "${open_args[@]}"
