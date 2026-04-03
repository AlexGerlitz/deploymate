#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SURFACE="${1:-full}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/dev_fast_check.sh [frontend|backend|full]

Runs the lightweight local gate:
  - frontend: auth + ops + runtime smokes
  - backend: focused safety test set
  - full: both
EOF
}

case "$SURFACE" in
  frontend|backend|full)
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    echo "[dev-fast-check] invalid surface: $SURFACE" >&2
    usage >&2
    exit 1
    ;;
esac

cd "$ROOT_DIR"

echo "[dev-fast-check] surface: $SURFACE"
if [ "${DEPLOYMATE_CONTEXT_DERIVED:-0}" != "1" ]; then
  eval "$(bash scripts/derive_local_fast_context.sh --surface "$SURFACE")"
  echo "[dev-fast-check] derived local diff context from ${DEPLOYMATE_CONTEXT_BASE_REF:-unknown}..${DEPLOYMATE_CONTEXT_HEAD_REF:-HEAD}"
  echo "[dev-fast-check] runtime audits: ${DEPLOYMATE_RUN_RUNTIME_AUDITS:-1}"
  echo "[dev-fast-check] security audit scope: ${DEPLOYMATE_SECURITY_AUDIT_SCOPE:-full}"
  echo "[dev-fast-check] secret scan scope: ${DEPLOYMATE_SECRET_SCAN_SCOPE:-${DEPLOYMATE_SECURITY_AUDIT_SCOPE:-full}}"
  echo "[dev-fast-check] runtime policy scan scope: ${DEPLOYMATE_RUNTIME_POLICY_SCAN_SCOPE:-skip}"
  echo "[dev-fast-check] backend syntax mode: ${DEPLOYMATE_BACKEND_SYNTAX_MODE:-full}"
  if [ -n "${DEPLOYMATE_BACKEND_FAST_MODE:-}" ]; then
    echo "[dev-fast-check] backend fast mode: $DEPLOYMATE_BACKEND_FAST_MODE"
  fi
  if [ -n "${DEPLOYMATE_FRONTEND_FAST_MODE:-}" ]; then
    echo "[dev-fast-check] frontend fast mode: $DEPLOYMATE_FRONTEND_FAST_MODE"
  fi
fi

if [ "$SURFACE" = "frontend" ] || [ "$SURFACE" = "full" ]; then
  if [ "${FRONTEND_SMOKE_PERSIST_SERVER:-0}" = "1" ]; then
    export FRONTEND_SMOKE_KEEP_ALIVE_ON_EXIT="${FRONTEND_SMOKE_KEEP_ALIVE_ON_EXIT:-1}"
    echo "[dev-fast-check] persistent frontend smoke server: $FRONTEND_SMOKE_PERSIST_SERVER"
  fi
fi

bash scripts/release_workflow.sh --surface "$SURFACE" --fast
