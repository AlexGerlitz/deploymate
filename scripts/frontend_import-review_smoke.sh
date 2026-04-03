#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/frontend_smoke_shared.sh"
source "${SCRIPT_DIR}/lib/frontend_smoke_checks.sh"

generated_feature_checks() {
  cat "${SCRIPT_DIR}/generated_smoke_checks/import-review.txt"
}

trap stop_frontend_smoke_server EXIT
start_frontend_smoke_server
wait_for_frontend_smoke_url
frontend_smoke_assert_checks "frontend-import-review-smoke" "$BASE_URL" generated_feature_checks
echo "[frontend-import-review-smoke] ok"