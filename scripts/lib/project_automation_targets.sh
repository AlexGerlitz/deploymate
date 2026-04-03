#!/usr/bin/env bash

set -euo pipefail

AUTOMATION_TARGETS_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${AUTOMATION_TARGETS_SCRIPT_DIR}/project_automation_targets.sh"

automation_emit_unique_lines() {
  awk 'NF && !seen[$0]++'
}
