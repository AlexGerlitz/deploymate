#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_BRANCH="${BASE_BRANCH:-develop}"
AUTO_LOCAL_ARGS=()

usage() {
  cat <<'EOF'
Usage:
  bash scripts/pr_ready_check.sh [--base <branch>] [--base-ref <ref>] [--head-ref <ref>]

Run the recommended local verification loop for the current branch and print the PR next steps.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --base)
      BASE_BRANCH="${2:-}"
      shift 2
      ;;
    --base-ref|--head-ref)
      AUTO_LOCAL_ARGS+=("$1" "${2:-}")
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[pr-ready-check] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"

current_branch="$(git branch --show-current)"
if [ -z "$current_branch" ]; then
  echo "[pr-ready-check] detached HEAD is not supported for PR flow" >&2
  exit 1
fi

case "$current_branch" in
  "$BASE_BRANCH"|main)
    echo "[pr-ready-check] current branch '$current_branch' is not a PR branch" >&2
    echo "[pr-ready-check] create a feature branch first: bash scripts/start_pr_branch.sh <slug>" >&2
    exit 1
    ;;
esac

if [ -n "$(git status --short)" ]; then
  echo "[pr-ready-check] working tree is dirty; commit or stash changes before PR validation" >&2
  exit 1
fi

if [ "${#AUTO_LOCAL_ARGS[@]}" -gt 0 ]; then
  bash scripts/run_recommended_local_mode.sh "${AUTO_LOCAL_ARGS[@]}"
else
  bash scripts/run_recommended_local_mode.sh
fi

base_ref="$(git merge-base HEAD "$BASE_BRANCH")"
commit_count="$(git rev-list --count "${base_ref}..HEAD")"
latest_subject="$(git log -1 --pretty=%s)"

echo "[pr-ready-check] branch: $current_branch"
echo "[pr-ready-check] base branch: $BASE_BRANCH"
echo "[pr-ready-check] commits since base: $commit_count"
echo "[pr-ready-check] latest commit: $latest_subject"

if git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' >/dev/null 2>&1; then
  echo "[pr-ready-check] upstream: $(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}')"
  echo "[pr-ready-check] next step: make pr-open"
else
  echo "[pr-ready-check] next step: git push -u origin $current_branch"
  echo "[pr-ready-check] after push: make pr-open"
fi
