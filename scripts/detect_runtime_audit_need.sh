#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/project_automation_targets.sh"

if [ "$#" -eq 0 ]; then
  printf 'run_runtime_audits=1\n'
  printf 'reason=no changed files provided\n'
  exit 0
fi

for path in "$@"; do
  case "$(automation_runtime_audit_scope_for_path "$path")" in
    runtime_contract)
      printf 'run_runtime_audits=1\n'
      printf 'reason=runtime or deploy contract changed\n'
      exit 0
      ;;
  esac
done

printf 'run_runtime_audits=0\n'
printf 'reason=runtime contract untouched\n'
