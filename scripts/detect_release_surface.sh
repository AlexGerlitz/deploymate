#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_REF="${1:-}"
HEAD_REF="${2:-HEAD}"
EMPTY_TREE_SHA="4b825dc642cb6eb9a060e54bf8d69288fbee4904"

if [ -z "$BASE_REF" ]; then
  echo "[detect-release-surface] usage: bash scripts/detect_release_surface.sh <base-ref> [head-ref]" >&2
  exit 1
fi

cd "$ROOT_DIR"

if ! git rev-parse --verify "$BASE_REF^{commit}" >/dev/null 2>&1; then
  BASE_REF="$EMPTY_TREE_SHA"
fi

changed_files=()
while IFS= read -r path; do
  changed_files+=("$path")
done < <(git diff --name-only "$BASE_REF" "$HEAD_REF")

if [ "${#changed_files[@]}" -eq 0 ]; then
  printf 'surface=skip\n'
  printf 'should_deploy=0\n'
  printf 'reason=no changed files\n'
  exit 0
fi

frontend_changed=0
backend_changed=0
full_changed=0
relevant_changed=0

for path in "${changed_files[@]}"; do
  case "$path" in
    frontend/*)
      frontend_changed=1
      relevant_changed=1
      ;;
    backend/*)
      backend_changed=1
      relevant_changed=1
      ;;
    README.md|RUNBOOK.md|HANDOFF.md|LICENSE|.gitignore|.github/*)
      ;;
    *)
      full_changed=1
      relevant_changed=1
      ;;
  esac
done

surface="full"
reason="shared or mixed changes"

if [ "$relevant_changed" = "0" ]; then
  surface="skip"
  reason="docs or workflow-only changes"
elif [ "$full_changed" = "0" ] && [ "$frontend_changed" = "1" ] && [ "$backend_changed" = "0" ]; then
  surface="frontend"
  reason="frontend-only changes"
elif [ "$full_changed" = "0" ] && [ "$frontend_changed" = "0" ] && [ "$backend_changed" = "1" ]; then
  surface="backend"
  reason="backend-only changes"
fi

printf 'surface=%s\n' "$surface"
if [ "$surface" = "skip" ]; then
  printf 'should_deploy=0\n'
else
  printf 'should_deploy=1\n'
fi
printf 'reason=%s\n' "$reason"
