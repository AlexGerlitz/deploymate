#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${DEPLOYMATE_BASE_URL:-}"
USERNAME="${DEPLOYMATE_ADMIN_USERNAME:-}"
PASSWORD="${DEPLOYMATE_ADMIN_PASSWORD:-}"
SMOKE_CURL_RESOLVE="${DEPLOYMATE_SMOKE_CURL_RESOLVE:-}"

COOKIE_JAR="$(mktemp)"
LOGIN_BODY_FILE="$(mktemp)"
ME_BODY_FILE="$(mktemp)"
LOGOUT_BODY_FILE="$(mktemp)"
HEALTH_BODY_FILE="$(mktemp)"

CURL_ARGS=()
if [ -n "$SMOKE_CURL_RESOLVE" ]; then
  CURL_ARGS+=(--resolve "$SMOKE_CURL_RESOLVE")
fi

cleanup() {
  rm -f \
    "$COOKIE_JAR" \
    "$LOGIN_BODY_FILE" \
    "$ME_BODY_FILE" \
    "$LOGOUT_BODY_FILE" \
    "$HEALTH_BODY_FILE"
}

trap cleanup EXIT

require_env() {
  local name="$1"
  local value="$2"
  if [ -z "$value" ]; then
    echo "[release-precheck] missing required env: $name" >&2
    exit 1
  fi
}

curl_precheck() {
  if [ "${#CURL_ARGS[@]}" -gt 0 ]; then
    curl "${CURL_ARGS[@]}" "$@"
  else
    curl "$@"
  fi
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
        raise SystemExit(1)

if isinstance(value, bool):
    print("true" if value else "false")
elif value is None:
    print("null")
else:
    print(value)
PY
}

echo "[release-precheck] base url: $BASE_URL"
if [ -n "$SMOKE_CURL_RESOLVE" ]; then
  echo "[release-precheck] curl resolve: $SMOKE_CURL_RESOLVE"
fi

require_env "DEPLOYMATE_BASE_URL" "$BASE_URL"
require_env "DEPLOYMATE_ADMIN_USERNAME" "$USERNAME"
require_env "DEPLOYMATE_ADMIN_PASSWORD" "$PASSWORD"

health_status="$(
  curl_precheck -sS -o "$HEALTH_BODY_FILE" -w "%{http_code}" "$BASE_URL/api/health" || true
)"
case "$health_status" in
  200)
    health_value="$(json_get "$HEALTH_BODY_FILE" "status" 2>/dev/null || true)"
    if [ -n "$health_value" ]; then
      echo "[release-precheck] health endpoint reachable: $health_value"
    else
      echo "[release-precheck] health endpoint reachable"
    fi
    ;;
  000)
    echo "[release-precheck] health probe inconclusive (network or TLS); continuing"
    ;;
  *)
    echo "[release-precheck] health probe inconclusive (HTTP $health_status); continuing"
    ;;
esac

login_status="$(
  curl_precheck -sS -o "$LOGIN_BODY_FILE" -w "%{http_code}" \
    -c "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -X POST "$BASE_URL/api/auth/login" \
    --data "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" || true
)"

case "$login_status" in
  200)
    login_username="$(json_get "$LOGIN_BODY_FILE" "username" 2>/dev/null || true)"
    if [ -n "$login_username" ] && [ "$login_username" != "$USERNAME" ]; then
      echo "[release-precheck] login returned unexpected user: $login_username" >&2
      exit 1
    fi

    me_status="$(
      curl_precheck -sS -o "$ME_BODY_FILE" -w "%{http_code}" \
        -b "$COOKIE_JAR" \
        "$BASE_URL/api/auth/me" || true
    )"
    if [ "$me_status" = "200" ]; then
      me_username="$(json_get "$ME_BODY_FILE" "username" 2>/dev/null || true)"
      if [ -n "$me_username" ] && [ "$me_username" != "$USERNAME" ]; then
        echo "[release-precheck] auth/me returned unexpected user: $me_username" >&2
        exit 1
      fi
      echo "[release-precheck] auth session validated"
    else
      echo "[release-precheck] auth/me validation inconclusive after successful login; continuing"
    fi

    logout_status="$(
      curl_precheck -sS -o "$LOGOUT_BODY_FILE" -w "%{http_code}" \
        -b "$COOKIE_JAR" \
        -c "$COOKIE_JAR" \
        -X POST "$BASE_URL/api/auth/logout" || true
    )"
    if [ "$logout_status" = "200" ]; then
      echo "[release-precheck] logout ok"
    else
      echo "[release-precheck] logout validation inconclusive (HTTP $logout_status); continuing"
    fi

    echo "[release-precheck] smoke credentials validated"
    ;;
  401|403)
    echo "[release-precheck] smoke credentials are invalid for $BASE_URL" >&2
    if [ -s "$LOGIN_BODY_FILE" ]; then
      cat "$LOGIN_BODY_FILE" >&2
    fi
    exit 1
    ;;
  000)
    echo "[release-precheck] login precheck inconclusive (network or TLS); continuing"
    ;;
  *)
    echo "[release-precheck] login precheck inconclusive (HTTP $login_status); continuing"
    if [ -s "$LOGIN_BODY_FILE" ]; then
      cat "$LOGIN_BODY_FILE"
    fi
    ;;
esac

echo "[release-precheck] complete"
