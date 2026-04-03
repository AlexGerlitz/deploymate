#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -eq 0 ]; then
  printf 'backend_syntax_mode=full\n'
  printf 'reason=no changed files provided\n'
  exit 0
fi

python_files=()
requires_full=0
reason="no changed backend python files"

for path in "$@"; do
  case "$path" in
    backend/app/*.py|backend/app/**/*.py)
      python_files+=("$path")
      reason="changed backend python files"
      ;;
    backend/tests/*.py|backend/tests/**/*.py)
      ;;
    backend/*)
      requires_full=1
      reason="non-python backend files changed"
      ;;
    docker-compose.yml|docker-compose.prod.yml|.env.production.example|deploy/*|infra/*|scripts/preflight.sh|scripts/release_workflow.sh|scripts/dev_verify_changed.sh)
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
