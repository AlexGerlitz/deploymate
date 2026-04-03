#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_BRANCH="${BASE_BRANCH:-develop}"
OUTPUT_FORMAT="human"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/git_doctor.sh [--base <branch>] [--format human|shell]

Print a compact Git health summary and the most useful next command.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --base)
      BASE_BRANCH="${2:-}"
      shift 2
      ;;
    --format)
      OUTPUT_FORMAT="${2:-human}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[git-doctor] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"

branch_name="$(git branch --show-current)"
if [ -z "$branch_name" ]; then
  branch_name="detached"
fi

working_tree="clean"
if [ -n "$(git status --short)" ]; then
  working_tree="dirty"
fi

index_lock="absent"
if [ -f ".git/index.lock" ]; then
  index_lock="present"
fi

has_upstream=0
upstream_ref=""
if upstream_ref="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null)"; then
  has_upstream=1
fi

ahead_count=0
behind_count=0
if [ "$has_upstream" = "1" ]; then
  ahead_behind="$(git rev-list --left-right --count "${upstream_ref}...HEAD")"
  behind_count="$(printf '%s' "$ahead_behind" | awk '{print $1}')"
  ahead_count="$(printf '%s' "$ahead_behind" | awk '{print $2}')"
fi

recommended_command=""
recommendation_reason=""

if [ "$index_lock" = "present" ]; then
  recommended_command="rm -f .git/index.lock"
  recommendation_reason="stale git index lock is blocking new commit operations"
elif [ "$branch_name" = "detached" ]; then
  recommended_command="git switch ${BASE_BRANCH}"
  recommendation_reason="detached HEAD is not a stable daily working mode"
elif [ "$working_tree" = "dirty" ] && { [ "$branch_name" = "$BASE_BRANCH" ] || [ "$branch_name" = "main" ]; }; then
  recommended_command="make ship-pr SLUG=my-change MESSAGE=\"Describe the change\""
  recommendation_reason="dirty changes are sitting on a base branch; convert them into a feature branch and PR flow"
elif [ "$working_tree" = "dirty" ]; then
  recommended_command="make auto-local"
  recommendation_reason="you still have local changes; run the cheapest verification loop before commit"
elif { [ "$branch_name" = "$BASE_BRANCH" ] || [ "$branch_name" = "main" ]; }; then
  recommended_command="make start-pr-branch SLUG=my-change"
  recommendation_reason="base branch is clean; start the next feature branch from a clean state"
elif [ "$has_upstream" != "1" ]; then
  recommended_command="git push -u origin ${branch_name}"
  recommendation_reason="feature branch exists locally but has not been published yet"
elif [ "$ahead_count" -gt 0 ] && [ "$behind_count" -eq 0 ]; then
  recommended_command="make pr-open"
  recommendation_reason="local commits are ready to publish into a pull request"
elif [ "$ahead_count" -eq 0 ] && [ "$behind_count" -eq 0 ]; then
  recommended_command="make pr-status"
  recommendation_reason="branch is synced with upstream; check PR state or continue coding"
else
  recommended_command="git pull --ff-only"
  recommendation_reason="branch is behind upstream and should be synchronized before more work"
fi

if [ "$OUTPUT_FORMAT" = "shell" ]; then
  cat <<EOF
branch=$branch_name
working_tree=$working_tree
index_lock=$index_lock
has_upstream=$has_upstream
upstream_ref=$upstream_ref
ahead_count=$ahead_count
behind_count=$behind_count
recommended_command=$recommended_command
recommendation_reason=$recommendation_reason
EOF
  exit 0
fi

echo "[git-doctor] branch: $branch_name"
echo "[git-doctor] working tree: $working_tree"
echo "[git-doctor] index lock: $index_lock"
if [ "$has_upstream" = "1" ]; then
  echo "[git-doctor] upstream: $upstream_ref"
  echo "[git-doctor] ahead/behind: +$ahead_count / -$behind_count"
else
  echo "[git-doctor] upstream: missing"
fi
echo "[git-doctor] next command: $recommended_command"
echo "[git-doctor] reason: $recommendation_reason"
