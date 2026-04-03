#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_BRANCH="${BASE_BRANCH:-develop}"
TITLE=""
DRAFT=0

usage() {
  cat <<'EOF'
Usage:
  bash scripts/open_pull_request.sh [--base <branch>] [--title <title>] [--draft]

Open a PR from the current feature branch into the chosen base branch.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --base)
      BASE_BRANCH="${2:-}"
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
      echo "[open-pull-request] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"

branch_name="$(git branch --show-current)"
if [ -z "$branch_name" ]; then
  echo "[open-pull-request] detached HEAD is not supported for PR flow" >&2
  exit 1
fi

case "$branch_name" in
  "$BASE_BRANCH"|main)
    echo "[open-pull-request] current branch '$branch_name' is not a PR branch" >&2
    exit 1
    ;;
esac

if [ -n "$(git status --short)" ]; then
  echo "[open-pull-request] working tree is dirty; commit or stash changes first" >&2
  exit 1
fi

if ! git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' >/dev/null 2>&1; then
  echo "[open-pull-request] branch '$branch_name' has no upstream; run: git push -u origin $branch_name" >&2
  exit 1
fi

base_ref="$(git merge-base HEAD "$BASE_BRANCH")"
recommendation_output="$(bash scripts/recommend_local_mode.sh --base-ref "$base_ref")"
recommended_command=""
recommendation_reason=""
followup_command=""
followup_reason=""

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
  esac
done <<< "$recommendation_output"

if [ -z "$TITLE" ]; then
  TITLE="$(git log -1 --pretty=%s)"
fi

tmp_body="$(mktemp)"
trap 'rm -f "$tmp_body"' EXIT
{
  cat .github/pull_request_template.md
  echo
  echo "## Automation Context"
  echo
  echo "- Recommended local loop before opening: \`${recommended_command:-make changed}\`"
  echo "- Recommendation reason: ${recommendation_reason:-current diff}"
  if [ -n "$followup_command" ]; then
    echo "- Cheap follow-up after first green pass: \`${followup_command}\`"
    echo "- Follow-up reason: ${followup_reason:-same diff can use a cheaper rerun}"
  fi
} >"$tmp_body"

gh_args=(pr create --base "$BASE_BRANCH" --title "$TITLE" --body-file "$tmp_body")
if [ "$DRAFT" = "1" ]; then
  gh_args+=(--draft)
fi

gh "${gh_args[@]}"
