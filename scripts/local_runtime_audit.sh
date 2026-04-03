#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/audit_cache.sh"
cd "$ROOT_DIR"

if [ "${DEPLOYMATE_RUN_RUNTIME_AUDITS:-1}" != "1" ]; then
  echo "[local-runtime-audit] skipped for this local diff"
  exit 0
fi

audit_cache_prepare

if audit_cache_has local_runtime_audit; then
  echo "[local-runtime-audit] already completed in this run; skipping"
  audit_cache_record_event run_hit local_runtime_audit
  exit 0
fi

RUNTIME_AUDIT_FILE_CACHE_MAX_FILES="${DEPLOYMATE_RUNTIME_AUDIT_FILE_CACHE_MAX_FILES:-12}"

local_runtime_fingerprint="$(audit_cache_fingerprint_files \
  "local-runtime-audit" \
  "backend/app/services/runtime_executors.py" \
  ".env.production.example" \
  "docker-compose.prod.yml")"

if audit_cache_persistent_has "local_runtime_audit" "$local_runtime_fingerprint"; then
  echo "[local-runtime-audit] cache hit"
  audit_cache_record_event persistent_hit local_runtime_audit
  audit_cache_mark local_runtime_audit
  exit 0
fi

audit_cache_record_event persistent_miss local_runtime_audit

if command -v rg >/dev/null 2>&1; then
  SEARCH_CMD=(rg -n)
else
  SEARCH_CMD=(grep -nE)
fi

check_local_runtime_file() {
  local file="$1"

  case "$file" in
    backend/app/services/runtime_executors.py)
      if ! "${SEARCH_CMD[@]}" 'DEPLOYMATE_LOCAL_DOCKER_ENABLED", "false"' "$file" >/dev/null; then
        echo "[local-runtime-audit] fail: backend local runtime is not default-off" >&2
        exit 1
      fi
      ;;
    .env.production.example)
      if ! "${SEARCH_CMD[@]}" '^DEPLOYMATE_LOCAL_DOCKER_ENABLED=false$' "$file" >/dev/null; then
        echo "[local-runtime-audit] fail: .env.production.example does not keep local runtime disabled" >&2
        exit 1
      fi
      ;;
    docker-compose.prod.yml)
      if ! "${SEARCH_CMD[@]}" 'DEPLOYMATE_LOCAL_DOCKER_ENABLED: \$\{DEPLOYMATE_LOCAL_DOCKER_ENABLED:-false\}' "$file" >/dev/null; then
        echo "[local-runtime-audit] fail: docker-compose.prod.yml does not default local runtime to false" >&2
        exit 1
      fi

      if ! "${SEARCH_CMD[@]}" 'NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED: \$\{NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED:-0\}' "$file" >/dev/null; then
        echo "[local-runtime-audit] fail: frontend production default still exposes local deployment controls" >&2
        exit 1
      fi
      ;;
  esac
}

local_runtime_static_files=(
  "backend/app/services/runtime_executors.py"
  ".env.production.example"
  "docker-compose.prod.yml"
)
local_runtime_cache_hits=0
local_runtime_cache_misses=0

if [ "${DEPLOYMATE_RUN_RUNTIME_AUDITS:-1}" = "1" ] \
  && [ "${#local_runtime_static_files[@]}" -le "$RUNTIME_AUDIT_FILE_CACHE_MAX_FILES" ]; then
  echo "[local-runtime-audit] static contract cache mode: per-file"
  for file in "${local_runtime_static_files[@]}"; do
    local_runtime_file_key="$(audit_cache_key_for_input "local_runtime_audit_file" "$file")"
    local_runtime_file_fingerprint="$(audit_cache_fingerprint_files "local-runtime-audit:${file}" "$file")"
    if audit_cache_persistent_has "$local_runtime_file_key" "$local_runtime_file_fingerprint"; then
      audit_cache_record_event persistent_hit local_runtime_audit
      local_runtime_cache_hits=$((local_runtime_cache_hits + 1))
      continue
    fi

    audit_cache_record_event persistent_miss local_runtime_audit
    local_runtime_cache_misses=$((local_runtime_cache_misses + 1))
    check_local_runtime_file "$file"
    audit_cache_persistent_mark "$local_runtime_file_key" "$local_runtime_file_fingerprint"
  done
  echo "[local-runtime-audit] static contract reused ${local_runtime_cache_hits} file results; rescanned ${local_runtime_cache_misses}"
  echo "[local-runtime-audit] ok"
  audit_cache_persistent_mark "local_runtime_audit" "$local_runtime_fingerprint"
  audit_cache_mark local_runtime_audit
  exit 0
fi

echo "[local-runtime-audit] checking backend default"
check_local_runtime_file "backend/app/services/runtime_executors.py"

echo "[local-runtime-audit] checking production examples"
check_local_runtime_file ".env.production.example"
check_local_runtime_file "docker-compose.prod.yml"

echo "[local-runtime-audit] ok"
audit_cache_persistent_mark "local_runtime_audit" "$local_runtime_fingerprint"
audit_cache_mark local_runtime_audit
