#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/audit_cache.sh"
cd "$ROOT_DIR"

ENV_FILE="${DEPLOYMATE_RUNTIME_AUDIT_ENV_FILE:-.env.production}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/runtime_capability_audit.sh [--env-file <path>]

Options:
  --env-file <path>   Production env file to validate. Default: .env.production
  -h, --help          Show this help
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[runtime-capability-audit] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ -z "$ENV_FILE" ]; then
  echo "[runtime-capability-audit] --env-file requires a non-empty path" >&2
  exit 1
fi

if [ "${DEPLOYMATE_RUN_RUNTIME_AUDITS:-1}" != "1" ]; then
  echo "[runtime-capability-audit] skipped for this local diff"
  exit 0
fi

audit_cache_prepare

if audit_cache_has runtime_capability_audit; then
  echo "[runtime-capability-audit] already completed in this run; skipping"
  audit_cache_record_event run_hit runtime_capability_audit
  exit 0
fi

RUNTIME_AUDIT_FILE_CACHE_MAX_FILES="${DEPLOYMATE_RUNTIME_AUDIT_FILE_CACHE_MAX_FILES:-12}"

runtime_capability_files=(
  "frontend/Dockerfile"
  "docker-compose.prod.yml"
  ".env.production.example"
)

if [ -f "$ENV_FILE" ]; then
  runtime_capability_files+=("$ENV_FILE")
fi

runtime_capability_metadata="$(printf 'env_file=%s\n' "$ENV_FILE")"
runtime_capability_fingerprint="$(audit_cache_fingerprint_inputs \
  "runtime-capability-audit" \
  "$runtime_capability_metadata" \
  "${runtime_capability_files[@]}")"

if audit_cache_persistent_has "runtime_capability_audit" "$runtime_capability_fingerprint"; then
  echo "[runtime-capability-audit] cache hit"
  audit_cache_record_event persistent_hit runtime_capability_audit
  audit_cache_mark runtime_capability_audit
  exit 0
fi

audit_cache_record_event persistent_miss runtime_capability_audit

if command -v rg >/dev/null 2>&1; then
  SEARCH_CMD=(rg -n)
else
  SEARCH_CMD=(grep -nE)
fi

check_runtime_capability_file() {
  local file="$1"

  case "$file" in
    frontend/Dockerfile)
      if ! "${SEARCH_CMD[@]}" 'ARG NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0' "$file" >/dev/null; then
        fail "frontend/Dockerfile does not default NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED to 0"
      fi
      ;;
    docker-compose.prod.yml)
      if ! "${SEARCH_CMD[@]}" 'DEPLOYMATE_LOCAL_DOCKER_ENABLED: \$\{DEPLOYMATE_LOCAL_DOCKER_ENABLED:-false\}' "$file" >/dev/null; then
        fail "docker-compose.prod.yml does not default DEPLOYMATE_LOCAL_DOCKER_ENABLED to false"
      fi

      if ! "${SEARCH_CMD[@]}" 'NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED: \$\{NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED:-0\}' "$file" >/dev/null; then
        fail "docker-compose.prod.yml does not default NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED to 0"
      fi
      ;;
    .env.production.example)
      if ! "${SEARCH_CMD[@]}" '^DEPLOYMATE_LOCAL_DOCKER_ENABLED=false$' "$file" >/dev/null; then
        fail ".env.production.example does not keep DEPLOYMATE_LOCAL_DOCKER_ENABLED=false"
      fi

      if ! "${SEARCH_CMD[@]}" '^NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0$' "$file" >/dev/null; then
        fail ".env.production.example does not keep NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0"
      fi
      ;;
  esac
}

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
runtime_capability_static_files=(
  "frontend/Dockerfile"
  "docker-compose.prod.yml"
  ".env.production.example"
)
runtime_capability_cache_hits=0
runtime_capability_cache_misses=0

if [ "${#runtime_capability_static_files[@]}" -le "$RUNTIME_AUDIT_FILE_CACHE_MAX_FILES" ]; then
  echo "[runtime-capability-audit] static contract cache mode: per-file"
  for file in "${runtime_capability_static_files[@]}"; do
    runtime_capability_file_key="$(audit_cache_key_for_input "runtime_capability_audit_file" "$file")"
    runtime_capability_file_fingerprint="$(audit_cache_fingerprint_files "runtime-capability-audit:${file}" "$file")"
    if audit_cache_persistent_has "$runtime_capability_file_key" "$runtime_capability_file_fingerprint"; then
      audit_cache_record_event persistent_hit runtime_capability_audit
      runtime_capability_cache_hits=$((runtime_capability_cache_hits + 1))
      continue
    fi

    audit_cache_record_event persistent_miss runtime_capability_audit
    runtime_capability_cache_misses=$((runtime_capability_cache_misses + 1))
    check_runtime_capability_file "$file"
    audit_cache_persistent_mark "$runtime_capability_file_key" "$runtime_capability_file_fingerprint"
  done
  echo "[runtime-capability-audit] static contract reused ${runtime_capability_cache_hits} file results; rescanned ${runtime_capability_cache_misses}"
else
  check_runtime_capability_file "frontend/Dockerfile"
  check_runtime_capability_file "docker-compose.prod.yml"
  check_runtime_capability_file ".env.production.example"
fi

echo "[runtime-capability-audit] checking production env alignment"

if [ ! -f "$ENV_FILE" ]; then
  echo "[runtime-capability-audit] no $ENV_FILE file found; static contract checks only"
  echo "[runtime-capability-audit] ok"
  audit_cache_persistent_mark "runtime_capability_audit" "$runtime_capability_fingerprint"
  audit_cache_mark runtime_capability_audit
  exit 0
fi

backend_value="$(read_env_value "$ENV_FILE" "DEPLOYMATE_LOCAL_DOCKER_ENABLED" || true)"
frontend_value="$(read_env_value "$ENV_FILE" "NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED" || true)"

if [ -z "$backend_value" ]; then
  fail "$ENV_FILE is missing DEPLOYMATE_LOCAL_DOCKER_ENABLED"
fi

if [ -z "$frontend_value" ]; then
  fail "$ENV_FILE is missing NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED"
fi

case "$backend_value" in
  true)
    [ "$frontend_value" = "1" ] || fail "$ENV_FILE has DEPLOYMATE_LOCAL_DOCKER_ENABLED=true but NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=$frontend_value"
    ;;
  false)
    [ "$frontend_value" = "0" ] || fail "$ENV_FILE has DEPLOYMATE_LOCAL_DOCKER_ENABLED=false but NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=$frontend_value"
    ;;
  *)
    fail "$ENV_FILE has unsupported DEPLOYMATE_LOCAL_DOCKER_ENABLED=$backend_value"
    ;;
esac

echo "[runtime-capability-audit] ok"
audit_cache_persistent_mark "runtime_capability_audit" "$runtime_capability_fingerprint"
audit_cache_mark runtime_capability_audit
