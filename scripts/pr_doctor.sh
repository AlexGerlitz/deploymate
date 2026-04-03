#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_BRANCH="${BASE_BRANCH:-develop}"
STRICT=0
STATE_FILE="$ROOT_DIR/.logs/auto_local_last.env"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/pr_doctor.sh [--base <branch>] [--strict]

Print branch, PR, diff-size, and local verification health for the current PR branch.
EOF
}

classify_pr_size() {
  local files_changed="$1"
  local line_changes="$2"
  local commit_count="$3"

  if [ "$files_changed" -ge 30 ] || [ "$line_changes" -ge 900 ] || [ "$commit_count" -ge 10 ]; then
    printf 'split'
  elif [ "$files_changed" -ge 16 ] || [ "$line_changes" -ge 400 ] || [ "$commit_count" -ge 6 ]; then
    printf 'large'
  elif [ "$files_changed" -ge 8 ] || [ "$line_changes" -ge 160 ] || [ "$commit_count" -ge 3 ]; then
    printf 'medium'
  else
    printf 'small'
  fi
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --base)
      BASE_BRANCH="${2:-}"
      shift 2
      ;;
    --strict)
      STRICT=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[pr-doctor] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"

current_branch="$(git branch --show-current)"
if [ -z "$current_branch" ]; then
  echo "[pr-doctor] detached HEAD is not supported" >&2
  exit 1
fi

base_ref="$(git merge-base HEAD "$BASE_BRANCH")"
commit_count="$(git rev-list --count "${base_ref}..HEAD")"
files_changed="$(git diff --name-only "${base_ref}..HEAD" | sed '/^$/d' | wc -l | tr -d ' ')"
shortstat="$(git diff --shortstat "${base_ref}..HEAD" || true)"
insertions="$(printf '%s\n' "$shortstat" | sed -nE 's/.* ([0-9]+) insertion.*/\1/p')"
deletions="$(printf '%s\n' "$shortstat" | sed -nE 's/.* ([0-9]+) deletion.*/\1/p')"
insertions="${insertions:-0}"
deletions="${deletions:-0}"
line_changes="$((insertions + deletions))"
size_class="$(classify_pr_size "$files_changed" "$line_changes" "$commit_count")"

dirty_state="clean"
if [ -n "$(git status --short)" ]; then
  dirty_state="dirty"
fi

upstream_ref=""
has_upstream=0
if upstream_ref="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null)"; then
  has_upstream=1
fi

pr_number=""
pr_state="missing"
if pr_view_output="$(gh pr view --json number,state,isDraft,url 2>/dev/null)"; then
  pr_number="$(printf '%s\n' "$pr_view_output" | ruby -rjson -e 'data=JSON.parse(STDIN.read); puts data["number"] || ""')"
  pr_state="$(printf '%s\n' "$pr_view_output" | ruby -rjson -e 'data=JSON.parse(STDIN.read); draft=data["isDraft"] ? "draft" : "ready"; puts "#{data["state"]}:#{draft}"')"
  pr_url="$(printf '%s\n' "$pr_view_output" | ruby -rjson -e 'data=JSON.parse(STDIN.read); puts data["url"] || ""')"
else
  pr_url=""
fi

last_base_ref=""
last_mode=""
last_bottleneck_phase=""
if [ -f "$STATE_FILE" ]; then
  while IFS='=' read -r key value; do
    normalized="${value#\'}"
    normalized="${normalized%\'}"
    case "$key" in
      LAST_AUTO_LOCAL_BASE_REF)
        last_base_ref="$normalized"
        ;;
      LAST_AUTO_LOCAL_MODE)
        last_mode="$normalized"
        ;;
      LAST_AUTO_LOCAL_BOTTLENECK_PHASE)
        last_bottleneck_phase="$normalized"
        ;;
    esac
  done < "$STATE_FILE"
fi

local_loop_state="missing"
if [ -n "$last_base_ref" ] && [ "$last_base_ref" = "$base_ref" ] && [ -n "$last_mode" ]; then
  local_loop_state="ready"
fi

echo "[pr-doctor] branch: $current_branch"
echo "[pr-doctor] base branch: $BASE_BRANCH"
echo "[pr-doctor] working tree: $dirty_state"
echo "[pr-doctor] commits since base: $commit_count"
echo "[pr-doctor] files changed: $files_changed"
echo "[pr-doctor] line changes: +$insertions / -$deletions"
echo "[pr-doctor] size class: $size_class"
if [ "$has_upstream" = "1" ]; then
  echo "[pr-doctor] upstream: $upstream_ref"
else
  echo "[pr-doctor] upstream: missing"
fi
if [ -n "$pr_number" ]; then
  echo "[pr-doctor] pull request: #$pr_number ($pr_state)"
  echo "[pr-doctor] pull request url: $pr_url"
else
  echo "[pr-doctor] pull request: missing"
fi
if [ "$local_loop_state" = "ready" ]; then
  echo "[pr-doctor] local verification: ready via $last_mode"
  if [ -n "$last_bottleneck_phase" ]; then
    echo "[pr-doctor] last bottleneck: $last_bottleneck_phase"
  fi
else
  echo "[pr-doctor] local verification: missing or stale for this base ref"
fi

issues=0
if [ "$dirty_state" = "dirty" ]; then
  echo "[pr-doctor] warning: working tree is dirty" >&2
  issues=1
fi
if [ "$has_upstream" != "1" ]; then
  echo "[pr-doctor] warning: branch has no upstream yet" >&2
  issues=1
fi
if [ "$size_class" = "split" ]; then
  echo "[pr-doctor] warning: this branch is large enough that it probably wants 2 PRs" >&2
  issues=1
elif [ "$size_class" = "large" ]; then
  echo "[pr-doctor] warning: this PR is getting large; split it if the change is not one coherent unit" >&2
fi
if [ "$local_loop_state" != "ready" ]; then
  echo "[pr-doctor] warning: run make pr-ready before opening or updating the PR" >&2
  issues=1
fi

if [ "$STRICT" = "1" ] && [ "$issues" != "0" ]; then
  exit 1
fi
