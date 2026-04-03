#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ "${DEPLOYMATE_RUN_RUNTIME_AUDITS:-1}" != "1" ]; then
  echo "[local-runtime-audit] skipped for this local diff"
  exit 0
fi

if command -v rg >/dev/null 2>&1; then
  SEARCH_CMD=(rg -n)
else
  SEARCH_CMD=(grep -nE)
fi

echo "[local-runtime-audit] checking backend default"
if ! "${SEARCH_CMD[@]}" 'DEPLOYMATE_LOCAL_DOCKER_ENABLED", "false"' backend/app/services/runtime_executors.py >/dev/null; then
  echo "[local-runtime-audit] fail: backend local runtime is not default-off" >&2
  exit 1
fi

echo "[local-runtime-audit] checking production examples"
if ! "${SEARCH_CMD[@]}" '^DEPLOYMATE_LOCAL_DOCKER_ENABLED=false$' .env.production.example >/dev/null; then
  echo "[local-runtime-audit] fail: .env.production.example does not keep local runtime disabled" >&2
  exit 1
fi

if ! "${SEARCH_CMD[@]}" 'DEPLOYMATE_LOCAL_DOCKER_ENABLED: \$\{DEPLOYMATE_LOCAL_DOCKER_ENABLED:-false\}' docker-compose.prod.yml >/dev/null; then
  echo "[local-runtime-audit] fail: docker-compose.prod.yml does not default local runtime to false" >&2
  exit 1
fi

if ! "${SEARCH_CMD[@]}" 'NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED: \$\{NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED:-0\}' docker-compose.prod.yml >/dev/null; then
  echo "[local-runtime-audit] fail: frontend production default still exposes local deployment controls" >&2
  exit 1
fi

echo "[local-runtime-audit] ok"
