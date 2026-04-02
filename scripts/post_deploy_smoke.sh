#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${DEPLOYMATE_BASE_URL:-}"
USERNAME="${DEPLOYMATE_ADMIN_USERNAME:-}"
PASSWORD="${DEPLOYMATE_ADMIN_PASSWORD:-}"

COOKIE_JAR="$(mktemp)"
LOGIN_BODY_FILE="$(mktemp)"
ME_BODY_FILE="$(mktemp)"
LOGOUT_BODY_FILE="$(mktemp)"
ME_AFTER_LOGOUT_BODY_FILE="$(mktemp)"
BACKUP_BUNDLE_BODY_FILE="$(mktemp)"
DRY_RUN_BODY_FILE="$(mktemp)"

cleanup() {
  rm -f "$COOKIE_JAR" "$LOGIN_BODY_FILE" "$ME_BODY_FILE" "$LOGOUT_BODY_FILE" "$ME_AFTER_LOGOUT_BODY_FILE" "$BACKUP_BUNDLE_BODY_FILE" "$DRY_RUN_BODY_FILE"
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

require_env "DEPLOYMATE_BASE_URL" "$BASE_URL"
require_env "DEPLOYMATE_ADMIN_USERNAME" "$USERNAME"
require_env "DEPLOYMATE_ADMIN_PASSWORD" "$PASSWORD"

echo "[smoke] base url: $BASE_URL"

check_http_ok "login page" "$BASE_URL/login"
check_http_ok "app shell" "$BASE_URL/app"

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
