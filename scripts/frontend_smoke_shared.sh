#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

PORT="${FRONTEND_SMOKE_PORT:-3001}"
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_LOG="${FRONTEND_SMOKE_LOG:-/tmp/deploymate-frontend-shared-smoke.log}"
DIST_DIR="${FRONTEND_SMOKE_DIST_DIR:-.next-smoke-${PORT}}"

start_frontend_smoke_server() {
  NEXT_PUBLIC_SMOKE_TEST_MODE=1 NEXT_DIST_DIR="$DIST_DIR" npm --prefix "$REPO_ROOT/frontend" run dev -- --hostname 127.0.0.1 --port "$PORT" >"$SERVER_LOG" 2>&1 &
  FRONTEND_SMOKE_SERVER_PID=$!
  export FRONTEND_SMOKE_SERVER_PID
}

wait_for_frontend_smoke_url() {
  local path="${1:-/app}"

  for _ in $(seq 1 60); do
    if [ -n "${FRONTEND_SMOKE_SERVER_PID:-}" ] && ! kill -0 "$FRONTEND_SMOKE_SERVER_PID" 2>/dev/null; then
      echo "[frontend-smoke] dev server exited early" >&2
      cat "$SERVER_LOG" >&2
      exit 1
    fi
    if curl -sS -o /dev/null "$BASE_URL$path"; then
      return 0
    fi
    sleep 1
  done

  echo "[frontend-smoke] dev server did not become ready for $path" >&2
  [ -f "$SERVER_LOG" ] && cat "$SERVER_LOG" >&2
  exit 1
}

stop_frontend_smoke_server() {
  if [ -n "${FRONTEND_SMOKE_SERVER_PID:-}" ] && kill -0 "$FRONTEND_SMOKE_SERVER_PID" 2>/dev/null; then
    kill "$FRONTEND_SMOKE_SERVER_PID" >/dev/null 2>&1 || true
    wait "$FRONTEND_SMOKE_SERVER_PID" 2>/dev/null || true
  fi

  if [ -n "${DIST_DIR:-}" ] && [ -d "$REPO_ROOT/frontend/$DIST_DIR" ]; then
    rm -rf "$REPO_ROOT/frontend/$DIST_DIR"
  fi
}
