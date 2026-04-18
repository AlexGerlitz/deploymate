#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
FRONTEND_SMOKE_DIST_DIR="${FRONTEND_SMOKE_DIST_DIR:-.next-smoke-templates}"
source "${SCRIPT_DIR}/frontend_smoke_shared.sh"
source "${SCRIPT_DIR}/lib/frontend_smoke_checks.sh"
DIST_DIR="${FRONTEND_SMOKE_DIST_DIR}"
HTML_FILE="${REPO_ROOT}/frontend/${DIST_DIR}/server/app/app/deployment-workflow.html"

cleanup() {
  rm -rf "${REPO_ROOT}/frontend/${DIST_DIR}"
}

trap cleanup EXIT

rm -rf "${REPO_ROOT}/frontend/${DIST_DIR}"

NEXT_PUBLIC_SMOKE_TEST_MODE=1 \
NEXT_FONT_GOOGLE_MOCKED_RESPONSES="$GOOGLE_FONT_MOCK_RESPONSES" \
NEXT_DIST_DIR="$DIST_DIR" \
npm --prefix "${REPO_ROOT}/frontend" run build

if [ ! -f "$HTML_FILE" ]; then
  echo "[frontend-templates-smoke] missing build output: $HTML_FILE" >&2
  exit 1
fi

while IFS= read -r line; do
  [ -n "$line" ] || continue
  label="${line#*|}"
  label="${label%%|*}"
  pattern="${line#*|*|}"

  if ! grep -Eq "$pattern" "$HTML_FILE"; then
    echo "[frontend-templates-smoke] missing check: $label" >&2
    exit 1
  fi
done < <(automation_smoke_templates_checks)

echo "[frontend-templates-smoke] template list rendered"
echo "[frontend-templates-smoke] template preview rendered"
echo "[frontend-templates-smoke] create-form template controls rendered"
echo "[frontend-templates-smoke] complete"
