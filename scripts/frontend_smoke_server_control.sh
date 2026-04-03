#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/frontend_smoke_shared.sh"

command="${1:-status}"

status_all() {
  local found_any=0
  local state_file=""
  mkdir -p "$SERVER_REGISTRY_DIR"
  shopt -s nullglob
  for state_file in "$SERVER_REGISTRY_DIR"/*.env; do
    found_any=1
    unset FRONTEND_SMOKE_SERVER_PID FRONTEND_SMOKE_SERVER_LOG FRONTEND_SMOKE_SERVER_DIST_DIR FRONTEND_SMOKE_SERVER_PORT
    # shellcheck disable=SC1090
    source "$state_file"
    PORT="${FRONTEND_SMOKE_SERVER_PORT:-3001}"
    BASE_URL="http://127.0.0.1:${PORT}"
    if frontend_smoke_pid_alive "${FRONTEND_SMOKE_SERVER_PID:-}"; then
      echo "[frontend-smoke-server] running pid=${FRONTEND_SMOKE_SERVER_PID} port=${FRONTEND_SMOKE_SERVER_PORT} dist=${FRONTEND_SMOKE_SERVER_DIST_DIR} log=${FRONTEND_SMOKE_SERVER_LOG}"
    elif frontend_smoke_url_alive; then
      echo "[frontend-smoke-server] running detached port=${FRONTEND_SMOKE_SERVER_PORT} dist=${FRONTEND_SMOKE_SERVER_DIST_DIR} log=${FRONTEND_SMOKE_SERVER_LOG}"
    else
      echo "[frontend-smoke-server] stale state removed: $state_file"
      rm -f "$state_file"
    fi
  done
  shopt -u nullglob

  if [ "$found_any" = "0" ]; then
    echo "[frontend-smoke-server] no persistent servers"
  fi
}

stop_all() {
  local found_any=0
  local state_file=""
  mkdir -p "$SERVER_REGISTRY_DIR"
  shopt -s nullglob
  for state_file in "$SERVER_REGISTRY_DIR"/*.env; do
    found_any=1
    unset FRONTEND_SMOKE_SERVER_PID FRONTEND_SMOKE_SERVER_LOG FRONTEND_SMOKE_SERVER_DIST_DIR FRONTEND_SMOKE_SERVER_PORT
    # shellcheck disable=SC1090
    source "$state_file"
    PORT="${FRONTEND_SMOKE_SERVER_PORT:-3001}"
    SERVER_LOG="${FRONTEND_SMOKE_SERVER_LOG:-/tmp/deploymate-frontend-shared-smoke.log}"
    DIST_DIR="${FRONTEND_SMOKE_SERVER_DIST_DIR:-.next-smoke-${PORT}}"
    PERSIST_SERVER=0
    KEEP_ALIVE_ON_EXIT=0
    export FRONTEND_SMOKE_SERVER_PID PORT SERVER_LOG DIST_DIR PERSIST_SERVER KEEP_ALIVE_ON_EXIT
    stop_frontend_smoke_server
  done
  shopt -u nullglob

  if [ "$found_any" = "0" ]; then
    echo "[frontend-smoke-server] no persistent servers"
  else
    echo "[frontend-smoke-server] stopped all persistent servers"
  fi
}

case "$command" in
  status)
    status_all
    ;;
  stop)
    stop_all
    ;;
  *)
    echo "Usage: bash scripts/frontend_smoke_server_control.sh [status|stop]" >&2
    exit 1
    ;;
esac
