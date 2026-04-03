#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/project_automation_targets.sh"

if [ "$#" -eq 0 ]; then
  printf 'backend_syntax_mode=full\n'
  printf 'reason=no changed files provided\n'
  exit 0
fi

python_files=()
requires_full=0
reason="no changed backend python files"

for path in "$@"; do
  case "$(automation_backend_syntax_scope_for_path "$path")" in
    backend_python)
      python_files+=("$path")
      reason="changed backend python files"
      ;;
    backend_tests)
      ;;
    backend_non_python)
      requires_full=1
      reason="non-python backend files changed"
      ;;
    backend_release_contract)
      requires_full=1
      reason="shared release or backend contract changed"
      ;;
  esac
done

if [ "$requires_full" = "1" ]; then
  printf 'backend_syntax_mode=full\n'
  printf 'reason=%s\n' "$reason"
  exit 0
fi

if [ "${#python_files[@]}" -eq 0 ]; then
  printf 'backend_syntax_mode=skip\n'
  printf 'reason=%s\n' "$reason"
  exit 0
fi

printf 'backend_syntax_mode=targeted\n'
printf 'backend_python_files=%s\n' "$(printf '%s\n' "${python_files[@]}" | sort -u | tr '\n' ' ' | xargs)"
printf 'reason=%s\n' "$reason"
