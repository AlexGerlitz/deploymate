#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_BRANCH="${BASE_BRANCH:-develop}"
STRICT=0
OUTPUT_FORMAT="human"
STATE_FILE="$ROOT_DIR/.logs/auto_local_last.env"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/pr_doctor.sh [--base <branch>] [--strict] [--format human|shell]

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

collect_split_hint() {
  local base_ref="$1"
  local frontend_count=0
  local backend_count=0
  local shared_count=0
  local docs_count=0
  local path=""

  while IFS= read -r path; do
    [ -n "$path" ] || continue
    case "$path" in
      frontend/*)
        frontend_count=$((frontend_count + 1))
        ;;
      backend/*)
        backend_count=$((backend_count + 1))
        ;;
      README.md|RUNBOOK.md|HANDOFF.md|LICENSE|.gitignore|.github/*)
        docs_count=$((docs_count + 1))
        ;;
      *)
        shared_count=$((shared_count + 1))
        ;;
    esac
  done < <(git diff --name-only "${base_ref}..HEAD")

  printf 'frontend_count=%s\n' "$frontend_count"
  printf 'backend_count=%s\n' "$backend_count"
  printf 'shared_count=%s\n' "$shared_count"
  printf 'docs_count=%s\n' "$docs_count"

  if [ "$frontend_count" -gt 0 ] && [ "$backend_count" -gt 0 ] && [ "$shared_count" -eq 0 ]; then
    printf 'split_hint=consider separate frontend and backend PRs\n'
  elif [ "$shared_count" -gt 0 ] && [ "$frontend_count" -gt 0 ] && [ "$backend_count" -eq 0 ]; then
    printf 'split_hint=consider separating shared/docs changes from frontend product work\n'
  elif [ "$shared_count" -gt 0 ] && [ "$backend_count" -gt 0 ] && [ "$frontend_count" -eq 0 ]; then
    printf 'split_hint=consider separating shared/docs changes from backend/runtime work\n'
  elif [ "$shared_count" -gt 0 ] && [ "$frontend_count" -gt 0 ] && [ "$backend_count" -gt 0 ]; then
    printf 'split_hint=consider one PR for shared contract changes and one PR per product surface\n'
  elif [ "$docs_count" -gt 0 ] && [ "$frontend_count" -gt 0 ] && [ "$backend_count" -eq 0 ] && [ "$shared_count" -eq 0 ]; then
    printf 'split_hint=consider moving docs/runbook edits into a small follow-up PR\n'
  elif [ "$docs_count" -gt 0 ] && [ "$backend_count" -gt 0 ] && [ "$frontend_count" -eq 0 ] && [ "$shared_count" -eq 0 ]; then
    printf 'split_hint=consider moving docs/runbook edits into a small follow-up PR\n'
  else
    printf 'split_hint=\n'
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
    --format)
      OUTPUT_FORMAT="${2:-human}"
      shift 2
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
pr_checks_state="missing"
pr_checks_summary=""
pr_head_sha=""
pr_base_ref_name=""
pr_head_ref_name=""
if pr_view_output="$(gh pr view --json number,state,isDraft,url,headRefOid,baseRefName,headRefName 2>/dev/null)"; then
  pr_number="$(printf '%s\n' "$pr_view_output" | ruby -rjson -e 'data=JSON.parse(STDIN.read); puts data["number"] || ""')"
  pr_state="$(printf '%s\n' "$pr_view_output" | ruby -rjson -e 'data=JSON.parse(STDIN.read); draft=data["isDraft"] ? "draft" : "ready"; puts "#{data["state"]}:#{draft}"')"
  pr_url="$(printf '%s\n' "$pr_view_output" | ruby -rjson -e 'data=JSON.parse(STDIN.read); puts data["url"] || ""')"
  pr_head_sha="$(printf '%s\n' "$pr_view_output" | ruby -rjson -e 'data=JSON.parse(STDIN.read); puts data["headRefOid"] || ""')"
  pr_base_ref_name="$(printf '%s\n' "$pr_view_output" | ruby -rjson -e 'data=JSON.parse(STDIN.read); puts data["baseRefName"] || ""')"
  pr_head_ref_name="$(printf '%s\n' "$pr_view_output" | ruby -rjson -e 'data=JSON.parse(STDIN.read); puts data["headRefName"] || ""')"
  if pr_checks_output="$(gh pr checks "$pr_number" --json bucket,name,workflow,state 2>/dev/null)"; then
    pr_checks_state="$(printf '%s\n' "$pr_checks_output" | ruby -rjson -e '
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
    pr_checks_summary="$(printf '%s\n' "$pr_checks_output" | ruby -rjson -e '
      data=JSON.parse(STDIN.read)
      counts=Hash.new(0)
      data.each { |item| counts[item["bucket"] || "unknown"] += 1 }
      order=%w[fail pending pass skipping cancel unknown]
      parts=order.filter_map { |key| counts[key] > 0 ? "#{key}=#{counts[key]}" : nil }
      puts(parts.join(", "))
    ')"
  fi
else
  pr_url=""
fi

frontend_count=0
backend_count=0
shared_count=0
docs_count=0
split_hint=""
while IFS='=' read -r key value; do
  case "$key" in
    frontend_count)
      frontend_count="$value"
      ;;
    backend_count)
      backend_count="$value"
      ;;
    shared_count)
      shared_count="$value"
      ;;
    docs_count)
      docs_count="$value"
      ;;
    split_hint)
      split_hint="$value"
      ;;
  esac
done < <(collect_split_hint "$base_ref")

last_base_ref=""
last_head_ref=""
last_verified_head_sha=""
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
      LAST_AUTO_LOCAL_HEAD_REF)
        last_head_ref="$normalized"
        ;;
      LAST_AUTO_LOCAL_VERIFIED_HEAD_SHA)
        last_verified_head_sha="$normalized"
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
current_head_sha="$(git rev-parse HEAD)"
if [ -n "$last_base_ref" ] && [ "$last_base_ref" = "$base_ref" ] && [ -n "$last_mode" ] && [ -n "$last_verified_head_sha" ] && [ "$last_verified_head_sha" = "$current_head_sha" ]; then
  local_loop_state="ready"
elif [ -n "$last_verified_head_sha" ] && [ "$last_verified_head_sha" != "$current_head_sha" ]; then
  local_loop_state="stale-head"
fi

overall_status="ready"
if [ "$dirty_state" = "dirty" ] || [ "$has_upstream" != "1" ] || [ "$local_loop_state" != "ready" ]; then
  overall_status="blocked"
fi
if [ -n "$pr_number" ] && [ "$pr_checks_state" = "fail" ]; then
  overall_status="blocked"
fi
if [ -n "$pr_number" ] && [ "$pr_state" != "MERGED:ready" ] && [ -n "$pr_head_sha" ] && [ "$pr_head_sha" != "$current_head_sha" ]; then
  overall_status="blocked"
fi
if [ -n "$pr_number" ] && [ "$pr_state" != "MERGED:ready" ] && [ -n "$pr_head_sha" ] && [ -n "$last_verified_head_sha" ] && [ "$pr_head_sha" != "$last_verified_head_sha" ]; then
  overall_status="blocked"
fi
if [ "$overall_status" = "ready" ] && { [ "$size_class" = "large" ] || [ "$size_class" = "split" ] || [ -n "$split_hint" ] || [ "$pr_checks_state" = "pending" ]; }; then
  overall_status="warn"
fi

if [ "$OUTPUT_FORMAT" = "shell" ]; then
  cat <<EOF
branch=$current_branch
base_branch=$BASE_BRANCH
working_tree=$dirty_state
commits_since_base=$commit_count
files_changed=$files_changed
line_changes=$line_changes
size_class=$size_class
frontend_count=$frontend_count
backend_count=$backend_count
shared_count=$shared_count
docs_count=$docs_count
split_hint=$split_hint
has_upstream=$has_upstream
upstream_ref=$upstream_ref
pr_number=$pr_number
pr_state=$pr_state
pr_checks_state=$pr_checks_state
pr_head_sha=$pr_head_sha
current_head_sha=$current_head_sha
local_loop_state=$local_loop_state
last_mode=$last_mode
last_verified_head_sha=$last_verified_head_sha
overall_status=$overall_status
EOF
else

echo "[pr-doctor] branch: $current_branch"
echo "[pr-doctor] base branch: $BASE_BRANCH"
echo "[pr-doctor] working tree: $dirty_state"
echo "[pr-doctor] commits since base: $commit_count"
echo "[pr-doctor] files changed: $files_changed"
echo "[pr-doctor] line changes: +$insertions / -$deletions"
echo "[pr-doctor] size class: $size_class"
echo "[pr-doctor] diff mix: frontend=$frontend_count backend=$backend_count shared=$shared_count docs=$docs_count"
if [ -n "$split_hint" ]; then
  echo "[pr-doctor] split hint: $split_hint"
fi
if [ "$has_upstream" = "1" ]; then
  echo "[pr-doctor] upstream: $upstream_ref"
else
  echo "[pr-doctor] upstream: missing"
fi
if [ -n "$pr_number" ]; then
  echo "[pr-doctor] pull request: #$pr_number ($pr_state)"
  echo "[pr-doctor] pull request url: $pr_url"
  if [ -n "$pr_head_ref_name" ] || [ -n "$pr_base_ref_name" ]; then
    echo "[pr-doctor] PR branch pair: ${pr_head_ref_name:-unknown} -> ${pr_base_ref_name:-unknown}"
  fi
  if [ -n "$pr_head_sha" ]; then
    echo "[pr-doctor] PR head SHA: ${pr_head_sha:0:7}"
  fi
  echo "[pr-doctor] PR checks: $pr_checks_state"
  if [ -n "$pr_checks_summary" ]; then
    echo "[pr-doctor] PR checks summary: $pr_checks_summary"
  fi
else
  echo "[pr-doctor] pull request: missing"
fi
if [ "$local_loop_state" = "ready" ]; then
  echo "[pr-doctor] local verification: ready via $last_mode"
  echo "[pr-doctor] verified head SHA: ${last_verified_head_sha:0:7}"
  if [ -n "$last_bottleneck_phase" ]; then
    echo "[pr-doctor] last bottleneck: $last_bottleneck_phase"
  fi
elif [ "$local_loop_state" = "stale-head" ]; then
  echo "[pr-doctor] local verification: stale after new commits"
  echo "[pr-doctor] last verified head SHA: ${last_verified_head_sha:0:7}"
else
  echo "[pr-doctor] local verification: missing or stale for this base ref"
fi
echo "[pr-doctor] overall status: $overall_status"
fi

issues=0
if [ "$dirty_state" = "dirty" ]; then
  if [ "$OUTPUT_FORMAT" != "shell" ]; then
    echo "[pr-doctor] warning: working tree is dirty" >&2
  fi
  issues=1
fi
if [ "$has_upstream" != "1" ]; then
  if [ "$OUTPUT_FORMAT" != "shell" ]; then
    echo "[pr-doctor] warning: branch has no upstream yet" >&2
  fi
  issues=1
fi
if [ "$size_class" = "split" ]; then
  if [ "$OUTPUT_FORMAT" != "shell" ]; then
    echo "[pr-doctor] warning: this branch is large enough that it probably wants 2 PRs" >&2
  fi
  issues=1
elif [ "$size_class" = "large" ]; then
  if [ "$OUTPUT_FORMAT" != "shell" ]; then
    echo "[pr-doctor] warning: this PR is getting large; split it if the change is not one coherent unit" >&2
  fi
fi
if [ -n "$split_hint" ] && { [ "$size_class" = "split" ] || [ "$size_class" = "large" ]; }; then
  if [ "$OUTPUT_FORMAT" != "shell" ]; then
    echo "[pr-doctor] split hint: $split_hint" >&2
  fi
fi
if [ "$local_loop_state" != "ready" ]; then
  if [ "$OUTPUT_FORMAT" != "shell" ]; then
    echo "[pr-doctor] warning: run make pr-ready before opening or updating the PR" >&2
  fi
  issues=1
fi
if [ -n "$pr_head_sha" ] && [ "$pr_state" != "MERGED:ready" ] && [ "$pr_head_sha" != "$current_head_sha" ]; then
  if [ "$OUTPUT_FORMAT" != "shell" ]; then
    echo "[pr-doctor] warning: current local HEAD is not the same as the PR head on GitHub; push the branch or refresh the local branch" >&2
  fi
  issues=1
fi
if [ -n "$pr_head_sha" ] && [ "$pr_state" != "MERGED:ready" ] && [ -n "$last_verified_head_sha" ] && [ "$pr_head_sha" != "$last_verified_head_sha" ]; then
  if [ "$OUTPUT_FORMAT" != "shell" ]; then
    echo "[pr-doctor] warning: the last local green loop does not match the PR head SHA" >&2
  fi
  issues=1
fi
if [ -n "$pr_number" ] && [ "$pr_checks_state" = "fail" ]; then
  if [ "$OUTPUT_FORMAT" != "shell" ]; then
    echo "[pr-doctor] warning: PR checks are failing" >&2
  fi
  issues=1
elif [ -n "$pr_number" ] && [ "$pr_checks_state" = "pending" ]; then
  if [ "$OUTPUT_FORMAT" != "shell" ]; then
    echo "[pr-doctor] warning: PR checks are still pending" >&2
  fi
fi

if [ "$STRICT" = "1" ] && [ "$issues" != "0" ]; then
  exit 1
fi
