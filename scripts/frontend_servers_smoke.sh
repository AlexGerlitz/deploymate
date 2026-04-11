#!/usr/bin/env bash

set -euo pipefail

PORT="${FRONTEND_SMOKE_PORT:-3001}"
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_LOG="${FRONTEND_SMOKE_LOG:-/tmp/deploymate-frontend-servers-smoke.log}"
DIST_DIR="${FRONTEND_SMOKE_DIST_DIR:-.next-smoke-${PORT}}"
MEMBER_PORT="${FRONTEND_SMOKE_MEMBER_PORT:-3002}"
MEMBER_LOG="${FRONTEND_SMOKE_MEMBER_LOG:-/tmp/deploymate-frontend-servers-member-smoke.log}"
MEMBER_DIST_DIR="${FRONTEND_SMOKE_MEMBER_DIST_DIR:-.next-smoke-member-${MEMBER_PORT}}"
READY_PORT="${FRONTEND_SMOKE_READY_PORT:-3004}"
READY_LOG="${FRONTEND_SMOKE_READY_LOG:-/tmp/deploymate-frontend-servers-ready-smoke.log}"
READY_DIST_DIR="${FRONTEND_SMOKE_READY_DIST_DIR:-.next-smoke-ready-${READY_PORT}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/frontend_smoke_shared.sh"
source "${SCRIPT_DIR}/lib/frontend_smoke_checks.sh"

cleanup() {
  if [ "${FRONTEND_SMOKE_REUSE_SERVER:-0}" != "1" ]; then
    stop_frontend_smoke_server
  fi
}

trap cleanup EXIT

if [ "${FRONTEND_SMOKE_REUSE_SERVER:-0}" != "1" ]; then
  start_frontend_smoke_server
fi

wait_for_frontend_smoke_url "/app"
frontend_smoke_assert_checks "frontend-servers-smoke" "$BASE_URL" automation_smoke_servers_checks

(
  set -euo pipefail
  source "${SCRIPT_DIR}/frontend_smoke_shared.sh"
  source "${SCRIPT_DIR}/lib/frontend_smoke_checks.sh"

  export PORT="$MEMBER_PORT"
  export BASE_URL="http://127.0.0.1:${PORT}"
  export SERVER_LOG="$MEMBER_LOG"
  export DIST_DIR="$MEMBER_DIST_DIR"
  export FRONTEND_SMOKE_PORT="$MEMBER_PORT"
  export FRONTEND_SMOKE_LOG="$MEMBER_LOG"
  export FRONTEND_SMOKE_DIST_DIR="$MEMBER_DIST_DIR"
  export FRONTEND_SMOKE_REUSE_SERVER=0
  export NEXT_PUBLIC_SMOKE_USER_ROLE=member

  cleanup_member() {
    stop_frontend_smoke_server
  }

  trap cleanup_member EXIT

  start_frontend_smoke_server
  wait_for_frontend_smoke_url "/app"
  frontend_smoke_assert_checks "frontend-servers-member-smoke" "$BASE_URL" automation_smoke_servers_member_checks

  member_html="$(mktemp)"
  curl -sS "${BASE_URL}/app/server-review" > "$member_html"
  if grep -Eq 'data-testid="server-review-create-card"|data-testid="server-review-create-server"|data-testid="server-review-page-title"' "$member_html"; then
    echo "[frontend-servers-member-smoke] member path leaked admin server-review controls" >&2
    rm -f "$member_html"
    exit 1
  fi
  rm -f "$member_html"
)

(
  set -euo pipefail
  source "${SCRIPT_DIR}/frontend_smoke_shared.sh"
  source "${SCRIPT_DIR}/lib/frontend_smoke_checks.sh"

  export PORT="${FRONTEND_SMOKE_PENDING_PORT:-3003}"
  export BASE_URL="http://127.0.0.1:${PORT}"
  export SERVER_LOG="${FRONTEND_SMOKE_PENDING_LOG:-/tmp/deploymate-frontend-servers-pending-smoke.log}"
  export DIST_DIR="${FRONTEND_SMOKE_PENDING_DIST_DIR:-.next-smoke-pending-${PORT}}"
  export FRONTEND_SMOKE_PORT="$PORT"
  export FRONTEND_SMOKE_LOG="$SERVER_LOG"
  export FRONTEND_SMOKE_DIST_DIR="$DIST_DIR"
  export FRONTEND_SMOKE_REUSE_SERVER=0
  export NEXT_PUBLIC_SMOKE_SERVER_REVIEW_SCENARIO=pending

  cleanup_pending() {
    stop_frontend_smoke_server
  }

  trap cleanup_pending EXIT

  start_frontend_smoke_server
  wait_for_frontend_smoke_url "/app"

  pending_html="$(mktemp)"
  curl -sS "${BASE_URL}/app/server-review" > "$pending_html"

  if ! grep -Eq 'Check server readiness' "$pending_html"; then
    echo "[frontend-servers-pending-smoke] pending path did not show the main readiness action" >&2
    rm -f "$pending_html"
    exit 1
  fi

  queue_pos="$(grep -bo 'data-testid=\"server-review-live-queue\"' "$pending_html" | head -n1 | cut -d: -f1)"
  create_pos="$(grep -bo 'data-testid=\"server-review-create-card\"' "$pending_html" | head -n1 | cut -d: -f1)"
  if [ -z "$queue_pos" ] || [ -z "$create_pos" ] || [ "$queue_pos" -ge "$create_pos" ]; then
    echo "[frontend-servers-pending-smoke] create form still appears before the live check queue" >&2
    rm -f "$pending_html"
    exit 1
  fi

  rm -f "$pending_html"
)

(
  set -euo pipefail
  source "${SCRIPT_DIR}/frontend_smoke_shared.sh"
  source "${SCRIPT_DIR}/lib/frontend_smoke_checks.sh"

  export PORT="$READY_PORT"
  export BASE_URL="http://127.0.0.1:${PORT}"
  export SERVER_LOG="$READY_LOG"
  export DIST_DIR="$READY_DIST_DIR"
  export FRONTEND_SMOKE_PORT="$READY_PORT"
  export FRONTEND_SMOKE_LOG="$READY_LOG"
  export FRONTEND_SMOKE_DIST_DIR="$READY_DIST_DIR"
  export FRONTEND_SMOKE_REUSE_SERVER=0
  export NEXT_PUBLIC_SMOKE_SERVER_REVIEW_SCENARIO=ready

  cleanup_ready() {
    stop_frontend_smoke_server
  }

  trap cleanup_ready EXIT

  start_frontend_smoke_server
  wait_for_frontend_smoke_url "/app"

  ready_html="$(mktemp)"
  curl -sS "${BASE_URL}/app/server-review" > "$ready_html"

  if ! grep -Eq 'Choose what to run' "$ready_html"; then
    echo "[frontend-servers-ready-smoke] ready path lost the step-2-first action copy" >&2
    rm -f "$ready_html"
    exit 1
  fi

  if ! grep -Eq '(<a[^>]*data-testid="smoke-server-continue-action"[^>]*class="[^"]*landingButton primaryButton[^"]*")|(<a[^>]*class="[^"]*landingButton primaryButton[^"]*"[^>]*data-testid="smoke-server-continue-action")' "$ready_html"; then
    echo "[frontend-servers-ready-smoke] ready path did not make the continue action primary" >&2
    rm -f "$ready_html"
    exit 1
  fi

  if ! grep -Eq '(<button[^>]*data-testid="smoke-server-recheck-action"[^>]*class="[^"]*secondaryButton[^"]*")|(<button[^>]*class="[^"]*secondaryButton[^"]*"[^>]*data-testid="smoke-server-recheck-action")' "$ready_html"; then
    echo "[frontend-servers-ready-smoke] ready path still leaves the recheck action at primary weight" >&2
    rm -f "$ready_html"
    exit 1
  fi

  rm -f "$ready_html"
)

echo "[frontend-servers-smoke] server management surface rendered"
echo "[frontend-servers-smoke] diagnostics surface rendered"
echo "[frontend-servers-smoke] member blocked surface rendered"
echo "[frontend-servers-smoke] pending server review path rendered"
echo "[frontend-servers-smoke] ready server review path rendered"
echo "[frontend-servers-smoke] complete"
