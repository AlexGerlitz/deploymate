#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${DEPLOYMATE_BASE_URL:-}"
USERNAME="${DEPLOYMATE_ADMIN_USERNAME:-}"
PASSWORD="${DEPLOYMATE_ADMIN_PASSWORD:-}"
RUNTIME_ENABLED="${DEPLOYMATE_SMOKE_RUNTIME_ENABLED:-0}"
RUNTIME_SERVER_ID="${DEPLOYMATE_SMOKE_SERVER_ID:-}"
RUNTIME_TEMP_SERVER_ID=""
RUNTIME_SERVER_NAME="${DEPLOYMATE_SMOKE_SERVER_NAME:-prod-runtime-smoke}"
RUNTIME_SERVER_HOST="${DEPLOYMATE_SMOKE_SERVER_HOST:-}"
RUNTIME_SERVER_PORT="${DEPLOYMATE_SMOKE_SERVER_PORT:-22}"
RUNTIME_SERVER_USERNAME="${DEPLOYMATE_SMOKE_SERVER_USERNAME:-}"
RUNTIME_SSH_KEY_FILE="${DEPLOYMATE_SMOKE_SSH_KEY_FILE:-}"
RUNTIME_IMAGE="${DEPLOYMATE_SMOKE_IMAGE:-nginx:alpine}"
RUNTIME_INTERNAL_PORT="${DEPLOYMATE_SMOKE_INTERNAL_PORT:-80}"
RUNTIME_EXTERNAL_PORT="${DEPLOYMATE_SMOKE_EXTERNAL_PORT:-}"
RUNTIME_START_PORT="${DEPLOYMATE_SMOKE_START_PORT:-38080}"
RUNTIME_HEALTH_TIMEOUT="${DEPLOYMATE_SMOKE_HEALTH_TIMEOUT:-45}"
RUNTIME_DEPLOYMENT_ID=""

COOKIE_JAR="$(mktemp)"
LOGIN_BODY_FILE="$(mktemp)"
ME_BODY_FILE="$(mktemp)"
LOGOUT_BODY_FILE="$(mktemp)"
ME_AFTER_LOGOUT_BODY_FILE="$(mktemp)"
BACKUP_BUNDLE_BODY_FILE="$(mktemp)"
DRY_RUN_BODY_FILE="$(mktemp)"
RUNTIME_CREATE_BODY_FILE="$(mktemp)"
RUNTIME_HEALTH_BODY_FILE="$(mktemp)"
RUNTIME_DIAGNOSTICS_BODY_FILE="$(mktemp)"
RUNTIME_ACTIVITY_BODY_FILE="$(mktemp)"
RUNTIME_LOGS_BODY_FILE="$(mktemp)"
RUNTIME_DELETE_BODY_FILE="$(mktemp)"
RUNTIME_PORTS_BODY_FILE="$(mktemp)"
RUNTIME_SERVER_CREATE_BODY_FILE="$(mktemp)"
RUNTIME_SERVER_DELETE_BODY_FILE="$(mktemp)"

cleanup() {
  if [ -n "$RUNTIME_DEPLOYMENT_ID" ] && [ -s "$COOKIE_JAR" ]; then
    curl -sS -o "$RUNTIME_DELETE_BODY_FILE" -w "%{http_code}" \
      -b "$COOKIE_JAR" \
      -X DELETE "$BASE_URL/api/deployments/$RUNTIME_DEPLOYMENT_ID" >/dev/null || true
  fi
  if [ -n "$RUNTIME_TEMP_SERVER_ID" ] && [ -s "$COOKIE_JAR" ]; then
    curl -sS -o "$RUNTIME_SERVER_DELETE_BODY_FILE" -w "%{http_code}" \
      -b "$COOKIE_JAR" \
      -X DELETE "$BASE_URL/api/servers/$RUNTIME_TEMP_SERVER_ID" >/dev/null || true
  fi
  rm -f \
    "$COOKIE_JAR" \
    "$LOGIN_BODY_FILE" \
    "$ME_BODY_FILE" \
    "$LOGOUT_BODY_FILE" \
    "$ME_AFTER_LOGOUT_BODY_FILE" \
    "$BACKUP_BUNDLE_BODY_FILE" \
    "$DRY_RUN_BODY_FILE" \
    "$RUNTIME_CREATE_BODY_FILE" \
    "$RUNTIME_HEALTH_BODY_FILE" \
    "$RUNTIME_DIAGNOSTICS_BODY_FILE" \
    "$RUNTIME_ACTIVITY_BODY_FILE" \
    "$RUNTIME_LOGS_BODY_FILE" \
    "$RUNTIME_DELETE_BODY_FILE" \
    "$RUNTIME_PORTS_BODY_FILE" \
    "$RUNTIME_SERVER_CREATE_BODY_FILE" \
    "$RUNTIME_SERVER_DELETE_BODY_FILE"
}

trap cleanup EXIT

require_env() {
  local name="$1"
  local value="$2"
  if [ -z "$value" ]; then
    echo "[smoke] missing required env: $name" >&2
    exit 1
  fi
}

check_http_ok() {
  local label="$1"
  local url="$2"

  local status_code
  status_code="$(curl -sS -o /dev/null -w "%{http_code}" "$url")"
  if [ "$status_code" != "200" ]; then
    echo "[smoke] $label failed with HTTP $status_code: $url" >&2
    exit 1
  fi
  echo "[smoke] $label ok"
}

check_http_redirect_to_login() {
  local label="$1"
  local url="$2"

  local headers_file
  headers_file="$(mktemp)"
  local status_code
  status_code="$(curl -sS -D "$headers_file" -o /dev/null -w "%{http_code}" "$url")"
  local location
  location="$(awk 'BEGIN{IGNORECASE=1} /^location:/ {sub(/\r$/, "", $2); print $2}' "$headers_file" | tail -n 1)"
  rm -f "$headers_file"

  case "$status_code" in
    301|302|303|307|308)
      ;;
    *)
      echo "[smoke] $label expected redirect to login, got HTTP $status_code: $url" >&2
      exit 1
      ;;
  esac

  if [ -z "$location" ]; then
    echo "[smoke] $label redirect missing Location header: $url" >&2
    exit 1
  fi

  case "$location" in
    */login|*/login?*)
      echo "[smoke] $label ok"
      ;;
    *)
      echo "[smoke] $label redirected to unexpected location: $location" >&2
      exit 1
      ;;
  esac
}

check_http_status() {
  local label="$1"
  local expected_status="$2"
  local actual_status="$3"
  local body_file="$4"

  if [ "$actual_status" != "$expected_status" ]; then
    echo "[smoke] $label failed with HTTP $actual_status" >&2
    cat "$body_file" >&2
    exit 1
  fi
  echo "[smoke] $label ok"
}

json_get() {
  local file="$1"
  local field="$2"

  python3 - "$file" "$field" <<'PY'
import json
import sys

path = sys.argv[1]
field = sys.argv[2]

with open(path, "r", encoding="utf-8") as fh:
    data = json.load(fh)

value = data
for part in field.split("."):
    if isinstance(value, dict) and part in value:
        value = value[part]
    else:
        raise SystemExit(f"missing field: {field}")

if isinstance(value, bool):
    print("true" if value else "false")
elif value is None:
    print("null")
else:
    print(value)
PY
}

json_query() {
  local file="$1"
  local expression="$2"

  python3 - "$file" "$expression" <<'PY'
import json
import sys

path = sys.argv[1]
expression = sys.argv[2]

with open(path, "r", encoding="utf-8") as fh:
    data = json.load(fh)

value = eval(expression, {"__builtins__": {}}, {"data": data, "len": len})
if isinstance(value, bool):
    print("true" if value else "false")
elif value is None:
    print("null")
else:
    print(value)
PY
}

ensure_runtime_server_id() {
  if [ -n "$RUNTIME_SERVER_ID" ]; then
    return 0
  fi

  if [ -z "$RUNTIME_SERVER_HOST" ] || [ -z "$RUNTIME_SERVER_USERNAME" ] || [ -z "$RUNTIME_SSH_KEY_FILE" ]; then
    return 0
  fi

  if [ ! -f "$RUNTIME_SSH_KEY_FILE" ]; then
    echo "[smoke] runtime ssh key file not found: $RUNTIME_SSH_KEY_FILE" >&2
    exit 1
  fi

  local payload
  payload="$(python3 - "$RUNTIME_SERVER_NAME" "$RUNTIME_SERVER_HOST" "$RUNTIME_SERVER_PORT" "$RUNTIME_SERVER_USERNAME" "$RUNTIME_SSH_KEY_FILE" <<'PY'
import json
import sys

name = sys.argv[1]
host = sys.argv[2]
port = int(sys.argv[3])
username = sys.argv[4]
key_path = sys.argv[5]

with open(key_path, "r", encoding="utf-8") as fh:
    ssh_key = fh.read()

print(json.dumps({
    "name": name,
    "host": host,
    "port": port,
    "username": username,
    "auth_type": "ssh_key",
    "ssh_key": ssh_key,
}, ensure_ascii=True))
PY
)"

  local create_status
  create_status="$(
    curl -sS -o "$RUNTIME_SERVER_CREATE_BODY_FILE" -w "%{http_code}" \
      -b "$COOKIE_JAR" \
      -H "Content-Type: application/json" \
      -X POST "$BASE_URL/api/servers" \
      --data "$payload"
  )"
  check_http_status "runtime smoke server create" "200" "$create_status" "$RUNTIME_SERVER_CREATE_BODY_FILE" >&2

  RUNTIME_SERVER_ID="$(json_get "$RUNTIME_SERVER_CREATE_BODY_FILE" "id")"
  if [ -z "$RUNTIME_SERVER_ID" ] || [ "$RUNTIME_SERVER_ID" = "null" ]; then
    echo "[smoke] runtime smoke server create response is missing id" >&2
    cat "$RUNTIME_SERVER_CREATE_BODY_FILE" >&2
    exit 1
  fi

  RUNTIME_TEMP_SERVER_ID="$RUNTIME_SERVER_ID"
  echo "[smoke] runtime smoke server created: $RUNTIME_SERVER_ID" >&2
}

resolve_runtime_external_port() {
  if [ -n "$RUNTIME_EXTERNAL_PORT" ]; then
    echo "$RUNTIME_EXTERNAL_PORT"
    return 0
  fi

  if [ -z "$RUNTIME_SERVER_ID" ]; then
    echo "[smoke] DEPLOYMATE_SMOKE_EXTERNAL_PORT is required when DEPLOYMATE_SMOKE_SERVER_ID is not set" >&2
    exit 1
  fi

  local ports_status
  ports_status="$(
    curl -sS -o "$RUNTIME_PORTS_BODY_FILE" -w "%{http_code}" \
      -b "$COOKIE_JAR" \
      "$BASE_URL/api/servers/$RUNTIME_SERVER_ID/suggested-ports?limit=1&start_port=$RUNTIME_START_PORT"
  )"
  check_http_status "suggested ports" "200" "$ports_status" "$RUNTIME_PORTS_BODY_FILE" >&2

  local port
  port="$(json_query "$RUNTIME_PORTS_BODY_FILE" 'data.get("ports", [None])[0]')"
  if [ -z "$port" ] || [ "$port" = "null" ]; then
    echo "[smoke] suggested ports response did not include a port" >&2
    cat "$RUNTIME_PORTS_BODY_FILE" >&2
    exit 1
  fi

  echo "$port"
}

run_runtime_smoke() {
  local external_port
  external_port="$(resolve_runtime_external_port)"
  echo "[smoke] runtime smoke enabled"

  local payload
  payload="$(python3 - "$RUNTIME_IMAGE" "$RUNTIME_INTERNAL_PORT" "$external_port" "$RUNTIME_SERVER_ID" <<'PY'
import json
import sys

image = sys.argv[1]
internal_port = int(sys.argv[2])
external_port = int(sys.argv[3])
server_id = sys.argv[4]

payload = {
    "image": image,
    "name": "smoke-runtime",
    "internal_port": internal_port,
    "external_port": external_port,
    "env": {
        "DEPLOYMATE_SMOKE": "1",
    },
}
if server_id:
    payload["server_id"] = server_id

print(json.dumps(payload, separators=(",", ":"), ensure_ascii=True))
PY
)"

  local create_status
  create_status="$(
    curl -sS -o "$RUNTIME_CREATE_BODY_FILE" -w "%{http_code}" \
      -b "$COOKIE_JAR" \
      -H "Content-Type: application/json" \
      -X POST "$BASE_URL/api/deployments" \
      --data "$payload"
  )"
  check_http_status "runtime deployment create" "200" "$create_status" "$RUNTIME_CREATE_BODY_FILE"

  RUNTIME_DEPLOYMENT_ID="$(json_get "$RUNTIME_CREATE_BODY_FILE" "id")"
  if [ -z "$RUNTIME_DEPLOYMENT_ID" ]; then
    echo "[smoke] runtime deployment response is missing id" >&2
    cat "$RUNTIME_CREATE_BODY_FILE" >&2
    exit 1
  fi
  echo "[smoke] runtime deployment created: $RUNTIME_DEPLOYMENT_ID"

  local deadline
  deadline=$((SECONDS + RUNTIME_HEALTH_TIMEOUT))
  while [ "$SECONDS" -lt "$deadline" ]; do
    local health_status
    health_status="$(
      curl -sS -o "$RUNTIME_HEALTH_BODY_FILE" -w "%{http_code}" \
        -b "$COOKIE_JAR" \
        "$BASE_URL/api/deployments/$RUNTIME_DEPLOYMENT_ID/health"
    )"
    check_http_status "runtime deployment health endpoint" "200" "$health_status" "$RUNTIME_HEALTH_BODY_FILE"

    local runtime_health
    runtime_health="$(json_get "$RUNTIME_HEALTH_BODY_FILE" "status")"
    if [ "$runtime_health" = "healthy" ]; then
      break
    fi
    sleep 1
  done

  if [ "$(json_get "$RUNTIME_HEALTH_BODY_FILE" "status")" != "healthy" ]; then
    echo "[smoke] runtime deployment did not become healthy in ${RUNTIME_HEALTH_TIMEOUT}s" >&2
    cat "$RUNTIME_HEALTH_BODY_FILE" >&2
    exit 1
  fi
  echo "[smoke] runtime deployment health ok"

  local diagnostics_status
  diagnostics_status="$(
    curl -sS -o "$RUNTIME_DIAGNOSTICS_BODY_FILE" -w "%{http_code}" \
      -b "$COOKIE_JAR" \
      "$BASE_URL/api/deployments/$RUNTIME_DEPLOYMENT_ID/diagnostics"
  )"
  check_http_status "runtime deployment diagnostics" "200" "$diagnostics_status" "$RUNTIME_DIAGNOSTICS_BODY_FILE"
  if [ "$(json_get "$RUNTIME_DIAGNOSTICS_BODY_FILE" "deployment_id")" != "$RUNTIME_DEPLOYMENT_ID" ]; then
    echo "[smoke] diagnostics returned unexpected deployment id" >&2
    cat "$RUNTIME_DIAGNOSTICS_BODY_FILE" >&2
    exit 1
  fi
  echo "[smoke] runtime deployment diagnostics ok"

  local logs_status
  logs_status="$(
    curl -sS -o "$RUNTIME_LOGS_BODY_FILE" -w "%{http_code}" \
      -b "$COOKIE_JAR" \
      "$BASE_URL/api/deployments/$RUNTIME_DEPLOYMENT_ID/logs"
  )"
  check_http_status "runtime deployment logs" "200" "$logs_status" "$RUNTIME_LOGS_BODY_FILE"
  if [ "$(json_get "$RUNTIME_LOGS_BODY_FILE" "container_name")" = "null" ]; then
    echo "[smoke] logs response is missing container_name" >&2
    cat "$RUNTIME_LOGS_BODY_FILE" >&2
    exit 1
  fi
  echo "[smoke] runtime deployment logs ok"

  local activity_status
  activity_status="$(
    curl -sS -o "$RUNTIME_ACTIVITY_BODY_FILE" -w "%{http_code}" \
      -b "$COOKIE_JAR" \
      "$BASE_URL/api/deployments/$RUNTIME_DEPLOYMENT_ID/activity"
  )"
  check_http_status "runtime deployment activity" "200" "$activity_status" "$RUNTIME_ACTIVITY_BODY_FILE"
  if [ "$(json_query "$RUNTIME_ACTIVITY_BODY_FILE" 'len(data)')" = "0" ]; then
    echo "[smoke] runtime activity returned zero events" >&2
    cat "$RUNTIME_ACTIVITY_BODY_FILE" >&2
    exit 1
  fi
  echo "[smoke] runtime deployment activity ok"

  local delete_status
  delete_status="$(
    curl -sS -o "$RUNTIME_DELETE_BODY_FILE" -w "%{http_code}" \
      -b "$COOKIE_JAR" \
      -X DELETE "$BASE_URL/api/deployments/$RUNTIME_DEPLOYMENT_ID"
  )"
  check_http_status "runtime deployment delete" "200" "$delete_status" "$RUNTIME_DELETE_BODY_FILE"
  if [ "$(json_get "$RUNTIME_DELETE_BODY_FILE" "status")" != "deleted" ]; then
    echo "[smoke] runtime delete response was not deleted" >&2
    cat "$RUNTIME_DELETE_BODY_FILE" >&2
    exit 1
  fi
  RUNTIME_DEPLOYMENT_ID=""
  echo "[smoke] runtime deployment cleanup ok"
}

require_env "DEPLOYMATE_BASE_URL" "$BASE_URL"
require_env "DEPLOYMATE_ADMIN_USERNAME" "$USERNAME"
require_env "DEPLOYMATE_ADMIN_PASSWORD" "$PASSWORD"

echo "[smoke] base url: $BASE_URL"

check_http_ok "login page" "$BASE_URL/login"
check_http_redirect_to_login "app shell redirect" "$BASE_URL/app"

health_body="$(curl -sS --fail-with-body "$BASE_URL/api/health")"
health_status="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["status"])' "$health_body")"
if [ "$health_status" != "healthy" ]; then
  echo "[smoke] backend health is not healthy: $health_body" >&2
  exit 1
fi
echo "[smoke] backend health ok"

login_status="$(
  curl -sS -o "$LOGIN_BODY_FILE" -w "%{http_code}" \
    -c "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -X POST "$BASE_URL/api/auth/login" \
    --data "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}"
)"

if [ "$login_status" != "200" ]; then
  echo "[smoke] login failed with HTTP $login_status" >&2
  cat "$LOGIN_BODY_FILE" >&2
  exit 1
fi

login_username="$(json_get "$LOGIN_BODY_FILE" "username")"
if [ "$login_username" != "$USERNAME" ]; then
  echo "[smoke] unexpected login user: $login_username" >&2
  exit 1
fi
echo "[smoke] login ok"

me_status="$(
  curl -sS -o "$ME_BODY_FILE" -w "%{http_code}" \
    -b "$COOKIE_JAR" \
    "$BASE_URL/api/auth/me"
)"

if [ "$me_status" != "200" ]; then
  echo "[smoke] auth/me failed with HTTP $me_status" >&2
  cat "$ME_BODY_FILE" >&2
  exit 1
fi

me_username="$(json_get "$ME_BODY_FILE" "username")"
if [ "$me_username" != "$USERNAME" ]; then
  echo "[smoke] auth/me returned unexpected user: $me_username" >&2
  exit 1
fi
echo "[smoke] auth/me ok"

backup_bundle_status="$(
  curl -sS -o "$BACKUP_BUNDLE_BODY_FILE" -w "%{http_code}" \
    -b "$COOKIE_JAR" \
    "$BASE_URL/api/admin/backup-bundle"
)"

if [ "$backup_bundle_status" != "200" ]; then
  echo "[smoke] backup bundle failed with HTTP $backup_bundle_status" >&2
  cat "$BACKUP_BUNDLE_BODY_FILE" >&2
  exit 1
fi

backup_bundle_name="$(json_get "$BACKUP_BUNDLE_BODY_FILE" "manifest.bundle_name")"
if [ -z "$backup_bundle_name" ]; then
  echo "[smoke] backup bundle manifest is missing bundle_name" >&2
  exit 1
fi
echo "[smoke] backup bundle ok"

python3 - "$BACKUP_BUNDLE_BODY_FILE" > "$DRY_RUN_BODY_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    bundle = json.load(fh)

print(json.dumps({"bundle": bundle}, ensure_ascii=True))
PY

dry_run_status="$(
  curl -sS -o "$ME_AFTER_LOGOUT_BODY_FILE" -w "%{http_code}" \
    -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -X POST "$BASE_URL/api/admin/restore/dry-run" \
    --data-binary @"$DRY_RUN_BODY_FILE"
)"

if [ "$dry_run_status" != "200" ]; then
  echo "[smoke] restore dry-run failed with HTTP $dry_run_status" >&2
  cat "$ME_AFTER_LOGOUT_BODY_FILE" >&2
  exit 1
fi

dry_run_sections="$(json_get "$ME_AFTER_LOGOUT_BODY_FILE" "summary.total_sections")"
if [ "$dry_run_sections" = "0" ]; then
  echo "[smoke] restore dry-run returned zero sections" >&2
  exit 1
fi
echo "[smoke] restore dry-run ok"

if [ "$RUNTIME_ENABLED" = "1" ] || [ "$RUNTIME_ENABLED" = "true" ]; then
  ensure_runtime_server_id
  run_runtime_smoke
else
  echo "[smoke] runtime smoke skipped"
fi

logout_status="$(
  curl -sS -o "$LOGOUT_BODY_FILE" -w "%{http_code}" \
    -b "$COOKIE_JAR" \
    -c "$COOKIE_JAR" \
    -X POST "$BASE_URL/api/auth/logout"
)"

if [ "$logout_status" != "200" ]; then
  echo "[smoke] logout failed with HTTP $logout_status" >&2
  cat "$LOGOUT_BODY_FILE" >&2
  exit 1
fi
echo "[smoke] logout ok"

me_after_logout_status="$(
  curl -sS -o "$ME_AFTER_LOGOUT_BODY_FILE" -w "%{http_code}" \
    -b "$COOKIE_JAR" \
    "$BASE_URL/api/auth/me"
)"

if [ "$me_after_logout_status" != "401" ]; then
  echo "[smoke] auth/me after logout expected 401, got $me_after_logout_status" >&2
  cat "$ME_AFTER_LOGOUT_BODY_FILE" >&2
  exit 1
fi
echo "[smoke] session invalidation ok"

echo "[smoke] complete"
