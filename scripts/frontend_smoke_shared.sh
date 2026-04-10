#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/lib/project_automation.sh"

PORT="${FRONTEND_SMOKE_PORT:-3001}"
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_LOG="${FRONTEND_SMOKE_LOG:-/tmp/deploymate-frontend-shared-smoke.log}"
DIST_DIR="${FRONTEND_SMOKE_DIST_DIR:-.next-smoke-${PORT}}"
PERSIST_SERVER="${FRONTEND_SMOKE_PERSIST_SERVER:-0}"
KEEP_ALIVE_ON_EXIT="${FRONTEND_SMOKE_KEEP_ALIVE_ON_EXIT:-0}"
SERVER_REGISTRY_DIR="${FRONTEND_SMOKE_REGISTRY_DIR:-$(automation_frontend_smoke_registry_dir)}"
FRONTEND_DIR="$(automation_frontend_dir)"
FRONTEND_READY_PATH="$(automation_frontend_ready_path)"

frontend_smoke_server_key() {
  printf '%s\n' "port-${PORT}_dist-${DIST_DIR}_restore-${NEXT_PUBLIC_SMOKE_RESTORE_REPORT:-0}_role-${NEXT_PUBLIC_SMOKE_USER_ROLE:-admin}" | tr '/ :' '___'
}

frontend_smoke_server_state_file() {
  mkdir -p "$SERVER_REGISTRY_DIR"
  printf '%s/%s.env\n' "$SERVER_REGISTRY_DIR" "$(frontend_smoke_server_key)"
}

frontend_smoke_pid_alive() {
  local pid="${1:-}"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

frontend_smoke_url_alive() {
  curl -sS -o /dev/null "$BASE_URL$FRONTEND_READY_PATH"
}

frontend_smoke_kill_port() {
  local pids=""
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti "tcp:${PORT}" 2>/dev/null | tr '\n' ' ' | xargs || true)"
    if [ -n "$pids" ]; then
      kill $pids >/dev/null 2>&1 || true
      return 0
    fi
  fi
  return 1
}

frontend_smoke_load_state() {
  local state_file=""
  state_file="$(frontend_smoke_server_state_file)"
  if [ -f "$state_file" ]; then
    # shellcheck disable=SC1090
    source "$state_file"
  fi
}

frontend_smoke_write_state() {
  local state_file=""
  state_file="$(frontend_smoke_server_state_file)"
  cat >"$state_file" <<EOF
FRONTEND_SMOKE_SERVER_PID=${FRONTEND_SMOKE_SERVER_PID}
FRONTEND_SMOKE_SERVER_LOG=${SERVER_LOG}
FRONTEND_SMOKE_SERVER_DIST_DIR=${DIST_DIR}
FRONTEND_SMOKE_SERVER_PORT=${PORT}
EOF
}

frontend_smoke_clear_state() {
  local state_file=""
  state_file="$(frontend_smoke_server_state_file)"
  rm -f "$state_file"
}

start_frontend_smoke_server() {
  local state_file=""

  state_file="$(frontend_smoke_server_state_file)"

  if [ "$PERSIST_SERVER" = "1" ]; then
    if python3 "$SCRIPT_DIR/frontend_smoke_daemon.py" status \
      --state-file "$state_file" \
      --port "$PORT"; then
      frontend_smoke_load_state
      SERVER_LOG="${FRONTEND_SMOKE_SERVER_LOG:-$SERVER_LOG}"
      DIST_DIR="${FRONTEND_SMOKE_SERVER_DIST_DIR:-$DIST_DIR}"
      FRONTEND_SMOKE_SERVER_PID="${FRONTEND_SMOKE_SERVER_PID:-}"
      export FRONTEND_SMOKE_SERVER_PID SERVER_LOG DIST_DIR
      return 0
    fi
    frontend_smoke_clear_state
    python3 "$SCRIPT_DIR/frontend_smoke_daemon.py" start \
      --state-file "$state_file" \
      --frontend-dir "$FRONTEND_DIR" \
      --port "$PORT" \
      --dist-dir "$DIST_DIR" \
      --log-file "$SERVER_LOG" \
      ${NEXT_PUBLIC_SMOKE_RESTORE_REPORT:+--restore-report}
    frontend_smoke_load_state
    FRONTEND_SMOKE_SERVER_PID="${FRONTEND_SMOKE_SERVER_PID:-}"
  else
    NEXT_PUBLIC_SMOKE_TEST_MODE=1 \
      NEXT_PUBLIC_SMOKE_RESTORE_REPORT="${NEXT_PUBLIC_SMOKE_RESTORE_REPORT:-}" \
      NEXT_DIST_DIR="$DIST_DIR" \
      bash -lc "cd \"$FRONTEND_DIR\" && exec npm run dev -- --hostname 127.0.0.1 --port \"$PORT\"" >"$SERVER_LOG" 2>&1 &
    FRONTEND_SMOKE_SERVER_PID=$!
  fi
  export FRONTEND_SMOKE_SERVER_PID
}

wait_for_frontend_smoke_url() {
  local path="${1:-$FRONTEND_READY_PATH}"

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
  local state_file=""

  if [ "$PERSIST_SERVER" = "1" ] && [ "$KEEP_ALIVE_ON_EXIT" = "1" ]; then
    return 0
  fi

  state_file="$(frontend_smoke_server_state_file)"

  if [ "$PERSIST_SERVER" = "1" ]; then
    python3 "$SCRIPT_DIR/frontend_smoke_daemon.py" stop --state-file "$state_file" >/dev/null 2>&1 || true
  fi

  if [ -n "${FRONTEND_SMOKE_SERVER_PID:-}" ] && kill -0 "$FRONTEND_SMOKE_SERVER_PID" 2>/dev/null; then
    kill "$FRONTEND_SMOKE_SERVER_PID" >/dev/null 2>&1 || true
    wait "$FRONTEND_SMOKE_SERVER_PID" 2>/dev/null || true
  fi
  frontend_smoke_kill_port || true

  frontend_smoke_clear_state

  if [ -n "${DIST_DIR:-}" ] && [ -d "$FRONTEND_DIR/$DIST_DIR" ]; then
    rm -rf "$FRONTEND_DIR/$DIST_DIR"
  fi
}
