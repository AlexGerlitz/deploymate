#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/audit_cache.sh"
cd "$ROOT_DIR"

ENV_FILE="${DEPLOYMATE_PRODUCTION_ENV_AUDIT_ENV_FILE:-.env.production}"
REQUIRE_RUNTIME_FILES=0
DEFAULT_KNOWN_HOSTS_FILE="/opt/deploymate/.secrets/deploymate_known_hosts"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/production_env_audit.sh [--env-file <path>] [--require-runtime-files]

Options:
  --env-file <path>         Production env file to validate. Default: .env.production
  --require-runtime-files   Fail if the env file or runtime files such as known_hosts
                            are missing on this machine.
  -h, --help                Show this help
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --require-runtime-files)
      REQUIRE_RUNTIME_FILES=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[production-env-audit] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ -z "$ENV_FILE" ]; then
  echo "[production-env-audit] --env-file requires a non-empty path" >&2
  exit 1
fi

if command -v rg >/dev/null 2>&1; then
  SEARCH_CMD=(rg -n)
else
  SEARCH_CMD=(grep -nE)
fi

fail() {
  echo "[production-env-audit] fail: $1" >&2
  exit 1
}

read_env_value() {
  local file="$1"
  local key="$2"
  local line=""

  line="$(grep -E "^${key}=" "$file" | tail -n 1 || true)"
  if [ -z "$line" ]; then
    return 1
  fi

  printf '%s\n' "${line#*=}"
}

lowercase() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

value_is_true() {
  case "$(lowercase "$1")" in
    1|true|yes|on)
      return 0
      ;;
  esac
  return 1
}

value_is_placeholder_secret() {
  local value=""
  value="$(lowercase "$1")"

  case "$value" in
    ""|admin|password|changeme|change-me|change-this*|replace-with*|default*|example*|your-*|todo*|\<*\>)
      return 0
      ;;
  esac

  return 1
}

require_static_match() {
  local file="$1"
  local pattern="$2"
  local message="$3"

  if ! "${SEARCH_CMD[@]}" "$pattern" "$file" >/dev/null; then
    fail "$message"
  fi
}

audit_cache_prepare

audit_key="$(audit_cache_key_for_input "production_env_audit" "${ENV_FILE}|${REQUIRE_RUNTIME_FILES}")"
audit_metadata="$(printf 'env_file=%s\nrequire_runtime_files=%s\n' "$ENV_FILE" "$REQUIRE_RUNTIME_FILES")"
audit_files=(
  "scripts/production_env_audit.sh"
  "docker-compose.prod.yml"
  ".env.production.example"
)

if [ -f "$ENV_FILE" ]; then
  audit_files+=("$ENV_FILE")
fi

audit_fingerprint="$(audit_cache_fingerprint_inputs "$audit_key" "$audit_metadata" "${audit_files[@]}")"

if audit_cache_has "$audit_key"; then
  echo "[production-env-audit] already completed in this run; skipping"
  audit_cache_record_event run_hit "$audit_key"
  exit 0
fi

if audit_cache_persistent_has "$audit_key" "$audit_fingerprint"; then
  echo "[production-env-audit] cache hit"
  audit_cache_record_event persistent_hit "$audit_key"
  audit_cache_mark "$audit_key"
  exit 0
fi

audit_cache_record_event persistent_miss "$audit_key"

echo "[production-env-audit] checking production security defaults"

require_static_match \
  "docker-compose.prod.yml" \
  'DEPLOYMATE_AUTH_RATE_LIMIT_BACKEND: \$\{DEPLOYMATE_AUTH_RATE_LIMIT_BACKEND:-database\}' \
  "docker-compose.prod.yml does not default DEPLOYMATE_AUTH_RATE_LIMIT_BACKEND to database"
require_static_match \
  "docker-compose.prod.yml" \
  'DEPLOYMATE_SSH_HOST_KEY_CHECKING: \$\{DEPLOYMATE_SSH_HOST_KEY_CHECKING:-yes\}' \
  "docker-compose.prod.yml does not default DEPLOYMATE_SSH_HOST_KEY_CHECKING to yes"
require_static_match \
  "docker-compose.prod.yml" \
  'DEPLOYMATE_SSH_KNOWN_HOSTS_FILE: \$\{DEPLOYMATE_SSH_KNOWN_HOSTS_FILE:-/opt/deploymate/\.secrets/deploymate_known_hosts\}' \
  "docker-compose.prod.yml does not default DEPLOYMATE_SSH_KNOWN_HOSTS_FILE to a persistent path"
require_static_match \
  "docker-compose.prod.yml" \
  '\$\{DEPLOYMATE_SSH_KNOWN_HOSTS_FILE:-/opt/deploymate/\.secrets/deploymate_known_hosts\}:\$\{DEPLOYMATE_SSH_KNOWN_HOSTS_FILE:-/opt/deploymate/\.secrets/deploymate_known_hosts\}:ro' \
  "docker-compose.prod.yml does not mount the SSH known_hosts file into the backend container"
require_static_match \
  ".env.production.example" \
  '^DEPLOYMATE_AUTH_RATE_LIMIT_BACKEND=database$' \
  ".env.production.example does not set DEPLOYMATE_AUTH_RATE_LIMIT_BACKEND=database"
require_static_match \
  ".env.production.example" \
  '^DEPLOYMATE_SSH_HOST_KEY_CHECKING=yes$' \
  ".env.production.example does not set DEPLOYMATE_SSH_HOST_KEY_CHECKING=yes"
require_static_match \
  ".env.production.example" \
  '^DEPLOYMATE_SSH_KNOWN_HOSTS_FILE=/opt/deploymate/\.secrets/deploymate_known_hosts$' \
  ".env.production.example does not set DEPLOYMATE_SSH_KNOWN_HOSTS_FILE to the persistent production path"

echo "[production-env-audit] checking production env alignment"

if [ ! -f "$ENV_FILE" ]; then
  if [ "$REQUIRE_RUNTIME_FILES" = "1" ]; then
    fail "required env file \"$ENV_FILE\" is missing"
  fi

  echo "[production-env-audit] no $ENV_FILE file found; static contract checks only"
  echo "[production-env-audit] ok"
  audit_cache_persistent_mark "$audit_key" "$audit_fingerprint"
  audit_cache_mark "$audit_key"
  exit 0
fi

admin_password="$(read_env_value "$ENV_FILE" "DEPLOYMATE_ADMIN_PASSWORD" || true)"
if [ -z "$admin_password" ]; then
  fail "$ENV_FILE is missing DEPLOYMATE_ADMIN_PASSWORD"
fi
if value_is_placeholder_secret "$admin_password"; then
  fail "$ENV_FILE keeps a placeholder or insecure DEPLOYMATE_ADMIN_PASSWORD"
fi

credentials_key="$(read_env_value "$ENV_FILE" "DEPLOYMATE_SERVER_CREDENTIALS_KEY" || true)"
if [ -z "$credentials_key" ]; then
  fail "$ENV_FILE is missing DEPLOYMATE_SERVER_CREDENTIALS_KEY"
fi
if value_is_placeholder_secret "$credentials_key"; then
  fail "$ENV_FILE keeps a placeholder DEPLOYMATE_SERVER_CREDENTIALS_KEY"
fi

insecure_bootstrap="$(read_env_value "$ENV_FILE" "DEPLOYMATE_ALLOW_INSECURE_DEFAULT_ADMIN" || true)"
if [ -n "$insecure_bootstrap" ] && value_is_true "$insecure_bootstrap"; then
  fail "$ENV_FILE enables DEPLOYMATE_ALLOW_INSECURE_DEFAULT_ADMIN=true"
fi

session_cookie_secure="$(read_env_value "$ENV_FILE" "SESSION_COOKIE_SECURE" || true)"
if [ -z "$session_cookie_secure" ]; then
  fail "$ENV_FILE is missing SESSION_COOKIE_SECURE=true"
fi
if ! value_is_true "$session_cookie_secure"; then
  fail "$ENV_FILE must keep SESSION_COOKIE_SECURE=true"
fi

rate_limit_backend="$(read_env_value "$ENV_FILE" "DEPLOYMATE_AUTH_RATE_LIMIT_BACKEND" || true)"
if [ -n "$rate_limit_backend" ] && [ "$(lowercase "$rate_limit_backend")" != "database" ]; then
  fail "$ENV_FILE must keep DEPLOYMATE_AUTH_RATE_LIMIT_BACKEND=database"
fi

ssh_mode="$(read_env_value "$ENV_FILE" "DEPLOYMATE_SSH_HOST_KEY_CHECKING" || true)"
if [ -z "$ssh_mode" ]; then
  ssh_mode="yes"
fi
if [ "$(lowercase "$ssh_mode")" != "yes" ]; then
  fail "$ENV_FILE must keep DEPLOYMATE_SSH_HOST_KEY_CHECKING=yes in production"
fi

known_hosts_file="$(read_env_value "$ENV_FILE" "DEPLOYMATE_SSH_KNOWN_HOSTS_FILE" || true)"
if [ -z "$known_hosts_file" ]; then
  known_hosts_file="$DEFAULT_KNOWN_HOSTS_FILE"
fi
if [ -z "$known_hosts_file" ]; then
  fail "$ENV_FILE does not resolve DEPLOYMATE_SSH_KNOWN_HOSTS_FILE"
fi

echo "[production-env-audit] effective known_hosts path: $known_hosts_file"

if [ "$REQUIRE_RUNTIME_FILES" = "1" ]; then
  if [ ! -f "$known_hosts_file" ]; then
    fail "known_hosts file \"$known_hosts_file\" does not exist on this machine"
  fi
  if [ ! -s "$known_hosts_file" ]; then
    fail "known_hosts file \"$known_hosts_file\" is empty"
  fi
fi

echo "[production-env-audit] ok"
audit_cache_persistent_mark "$audit_key" "$audit_fingerprint"
audit_cache_mark "$audit_key"
