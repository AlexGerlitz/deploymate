#!/usr/bin/env bash

set -euo pipefail

WEBHOOK_URL=""
WORKFLOW_NAME=""
ENVIRONMENT_NAME=""
STATUS=""
SURFACE=""
SMOKE_MODE=""
COMMIT_SHA=""
REF_NAME=""
RUN_URL=""
DETAILS=""

usage() {
  cat <<'EOF'
Usage:
  bash scripts/send_workflow_notification.sh \
    --webhook-url <url> \
    --workflow <name> \
    --environment <staging|production> \
    --status <success|failure|cancelled> \
    --surface <frontend|backend|full> \
    --smoke <description> \
    --commit <sha> \
    --ref <branch-or-ref> \
    --run-url <url> \
    [--details <extra text>]
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --webhook-url)
      WEBHOOK_URL="${2:-}"
      shift 2
      ;;
    --workflow)
      WORKFLOW_NAME="${2:-}"
      shift 2
      ;;
    --environment)
      ENVIRONMENT_NAME="${2:-}"
      shift 2
      ;;
    --status)
      STATUS="${2:-}"
      shift 2
      ;;
    --surface)
      SURFACE="${2:-}"
      shift 2
      ;;
    --smoke)
      SMOKE_MODE="${2:-}"
      shift 2
      ;;
    --commit)
      COMMIT_SHA="${2:-}"
      shift 2
      ;;
    --ref)
      REF_NAME="${2:-}"
      shift 2
      ;;
    --run-url)
      RUN_URL="${2:-}"
      shift 2
      ;;
    --details)
      DETAILS="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[notify] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

for value_name in WEBHOOK_URL WORKFLOW_NAME ENVIRONMENT_NAME STATUS SURFACE SMOKE_MODE COMMIT_SHA REF_NAME RUN_URL; do
  if [ -z "${!value_name}" ]; then
    echo "[notify] missing required argument: ${value_name}" >&2
    usage >&2
    exit 1
  fi
done

case "$STATUS" in
  success)
    STATUS_ICON="OK"
    ;;
  failure)
    STATUS_ICON="FAIL"
    ;;
  cancelled)
    STATUS_ICON="CANCELLED"
    ;;
  *)
    STATUS_ICON="$(printf '%s' "$STATUS" | tr '[:lower:]' '[:upper:]')"
    ;;
esac

SHORT_SHA="$(printf '%s' "$COMMIT_SHA" | cut -c1-7)"
MESSAGE="$STATUS_ICON $WORKFLOW_NAME
Environment: $ENVIRONMENT_NAME
Surface: $SURFACE
Smoke: $SMOKE_MODE
Ref: $REF_NAME
Commit: $SHORT_SHA
Run: $RUN_URL"

if [ -n "$DETAILS" ]; then
  MESSAGE="$MESSAGE
Details: $DETAILS"
fi

PAYLOAD="$(python3 - "$MESSAGE" <<'PY'
import json
import sys

message = sys.argv[1]
print(json.dumps({
    "text": message,
    "content": message,
}))
PY
)"

curl --fail --silent --show-error \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD" \
  "$WEBHOOK_URL"
