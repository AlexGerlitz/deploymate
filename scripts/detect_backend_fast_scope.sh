#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/project_automation_targets.sh"

if [ "$#" -eq 0 ]; then
  printf 'backend_fast_mode=safety\n'
  printf 'reason=no changed files provided\n'
  exit 0
fi

backend_paths=()
requires_safety=0
has_backend_scope=0
reason="shared diff without backend app impact"

for path in "$@"; do
  case "$(automation_backend_fast_scope_for_path "$path")" in
    backend)
      backend_paths+=("$path")
      has_backend_scope=1
      reason="backend files changed"
      ;;
    backend_release_contract)
      requires_safety=1
      has_backend_scope=1
      reason="shared release or runtime contract changed"
      ;;
    ignore)
      ;;
    *)
      requires_safety=1
      has_backend_scope=1
      reason="shared repository file changed"
      ;;
  esac
done

if [ "$has_backend_scope" = "0" ]; then
  printf 'backend_fast_mode=skip\n'
  printf 'reason=%s\n' "$reason"
  exit 0
fi

if [ "$requires_safety" = "1" ]; then
  printf 'backend_fast_mode=safety\n'
  printf 'reason=%s\n' "$reason"
  exit 0
fi

targets="$(bash "$ROOT_DIR/scripts/detect_backend_test_targets.sh" "${backend_paths[@]}" | tr '\n' ' ' | xargs)"
printf 'backend_fast_mode=targeted\n'
printf 'backend_fast_modules=%s\n' "$targets"
printf 'reason=%s\n' "$reason"
