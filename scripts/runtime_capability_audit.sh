#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/audit_cache.sh"
cd "$ROOT_DIR"

if [ "${DEPLOYMATE_RUN_RUNTIME_AUDITS:-1}" != "1" ]; then
  echo "[runtime-capability-audit] skipped for this local diff"
  exit 0
fi

audit_cache_prepare

if audit_cache_has runtime_capability_audit; then
  echo "[runtime-capability-audit] already completed in this run; skipping"
  exit 0
fi

if command -v rg >/dev/null 2>&1; then
  SEARCH_CMD=(rg -n)
else
  SEARCH_CMD=(grep -nE)
fi

fail() {
  echo "[runtime-capability-audit] fail: $1" >&2
  exit 1
}

read_env_value() {
  local file="$1"
  local key="$2"
  local line

  line="$(grep -E "^${key}=" "$file" | tail -n 1 || true)"
  if [ -z "$line" ]; then
    return 1
  fi

  printf '%s\n' "${line#*=}"
}

echo "[runtime-capability-audit] checking production defaults"

if ! "${SEARCH_CMD[@]}" 'ARG NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0' frontend/Dockerfile >/dev/null; then
  fail "frontend/Dockerfile does not default NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED to 0"
fi

if ! "${SEARCH_CMD[@]}" 'DEPLOYMATE_LOCAL_DOCKER_ENABLED: \$\{DEPLOYMATE_LOCAL_DOCKER_ENABLED:-false\}' docker-compose.prod.yml >/dev/null; then
  fail "docker-compose.prod.yml does not default DEPLOYMATE_LOCAL_DOCKER_ENABLED to false"
fi

if ! "${SEARCH_CMD[@]}" 'NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED: \$\{NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED:-0\}' docker-compose.prod.yml >/dev/null; then
  fail "docker-compose.prod.yml does not default NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED to 0"
fi

if ! "${SEARCH_CMD[@]}" '^DEPLOYMATE_LOCAL_DOCKER_ENABLED=false$' .env.production.example >/dev/null; then
  fail ".env.production.example does not keep DEPLOYMATE_LOCAL_DOCKER_ENABLED=false"
fi

if ! "${SEARCH_CMD[@]}" '^NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0$' .env.production.example >/dev/null; then
  fail ".env.production.example does not keep NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0"
fi

echo "[runtime-capability-audit] checking production env alignment"

if [ ! -f ".env.production" ]; then
  echo "[runtime-capability-audit] no .env.production file found; static contract checks only"
  echo "[runtime-capability-audit] ok"
  audit_cache_mark runtime_capability_audit
  exit 0
fi

backend_value="$(read_env_value ".env.production" "DEPLOYMATE_LOCAL_DOCKER_ENABLED" || true)"
frontend_value="$(read_env_value ".env.production" "NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED" || true)"

if [ -z "$backend_value" ]; then
  fail ".env.production is missing DEPLOYMATE_LOCAL_DOCKER_ENABLED"
fi

if [ -z "$frontend_value" ]; then
  fail ".env.production is missing NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED"
fi

case "$backend_value" in
  true)
    [ "$frontend_value" = "1" ] || fail ".env.production has DEPLOYMATE_LOCAL_DOCKER_ENABLED=true but NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=$frontend_value"
    ;;
  false)
    [ "$frontend_value" = "0" ] || fail ".env.production has DEPLOYMATE_LOCAL_DOCKER_ENABLED=false but NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=$frontend_value"
    ;;
  *)
    fail ".env.production has unsupported DEPLOYMATE_LOCAL_DOCKER_ENABLED=$backend_value"
    ;;
esac

echo "[runtime-capability-audit] ok"
audit_cache_mark runtime_capability_audit
