#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DELETE_BRANCH=0
MERGE_STRATEGY="squash"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/pr_land.sh [--merge|--squash|--rebase] [--delete-branch]

Safely merge the current PR after doctor and GitHub checks pass.
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
      echo "[pr-land] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"

bash scripts/pr_doctor.sh --strict

pr_view_output="$(gh pr view --json number,state,isDraft,headRefOid,baseRefName,headRefName,url 2>/dev/null)"
if [ -z "$pr_view_output" ]; then
  echo "[pr-land] no active PR found for the current branch" >&2
  exit 1
fi

pr_number="$(printf '%s\n' "$pr_view_output" | ruby -rjson -e 'data=JSON.parse(STDIN.read); puts data["number"] || ""')"
pr_state="$(printf '%s\n' "$pr_view_output" | ruby -rjson -e 'data=JSON.parse(STDIN.read); puts data["state"] || ""')"
pr_is_draft="$(printf '%s\n' "$pr_view_output" | ruby -rjson -e 'data=JSON.parse(STDIN.read); puts data["isDraft"] ? "1" : "0"')"
pr_head_sha="$(printf '%s\n' "$pr_view_output" | ruby -rjson -e 'data=JSON.parse(STDIN.read); puts data["headRefOid"] || ""')"
pr_url="$(printf '%s\n' "$pr_view_output" | ruby -rjson -e 'data=JSON.parse(STDIN.read); puts data["url"] || ""')"

if [ "$pr_state" != "OPEN" ]; then
  echo "[pr-land] PR is not open: $pr_state" >&2
  exit 1
fi
if [ "$pr_is_draft" = "1" ]; then
  echo "[pr-land] PR is still draft" >&2
  exit 1
fi

current_head_sha="$(git rev-parse HEAD)"
if [ -n "$pr_head_sha" ] && [ "$pr_head_sha" != "$current_head_sha" ]; then
  echo "[pr-land] local HEAD does not match PR head SHA; push or refresh first" >&2
  exit 1
fi

checks_state="missing"
if pr_checks_output="$(gh pr checks "$pr_number" --json bucket 2>/dev/null)"; then
  checks_state="$(printf '%s\n' "$pr_checks_output" | ruby -rjson -e '
    data=JSON.parse(STDIN.read)
    if data.empty?
      puts "missing"
    elsif data.any? { |item| item["bucket"] == "fail" }
      puts "fail"
    elsif data.any? { |item| item["bucket"] == "pending" }
      puts "pending"
    elsif data.all? { |item| ["pass","skipping"].include?(item["bucket"]) }
      puts "pass"
    else
      puts "mixed"
    end
  ')"
fi

if [ "$checks_state" != "pass" ]; then
  echo "[pr-land] PR checks are not green: $checks_state" >&2
  echo "[pr-land] use: make pr-watch" >&2
  exit 1
fi

merge_args=(pr merge "$pr_number" "--match-head-commit" "$current_head_sha")
case "$MERGE_STRATEGY" in
  merge)
    merge_args+=(--merge)
    ;;
  squash)
    merge_args+=(--squash)
    ;;
  rebase)
    merge_args+=(--rebase)
    ;;
esac
if [ "$DELETE_BRANCH" = "1" ]; then
  merge_args+=(--delete-branch)
fi

echo "[pr-land] merging PR #$pr_number from $pr_url"
gh "${merge_args[@]}"
