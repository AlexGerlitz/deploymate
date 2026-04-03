#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/project_automation_targets.sh"

if [ "$#" -eq 0 ]; then
  automation_backend_fast_safety_tests_lines
  exit 0
fi

for path in "$@"; do
  automation_backend_test_targets_for_path "$path"
done | automation_emit_unique_lines
