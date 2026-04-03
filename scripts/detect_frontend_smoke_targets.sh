#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/project_automation_targets.sh"

if [ "$#" -eq 0 ]; then
  automation_frontend_fast_smokes_default_lines
  exit 0
fi

for path in "$@"; do
  automation_frontend_smoke_targets_for_path "$path"
done | automation_emit_unique_lines | {
  if IFS= read -r first_line; then
    printf '%s\n' "$first_line"
    cat
  else
    automation_frontend_fast_smokes_default_lines
  fi
}
