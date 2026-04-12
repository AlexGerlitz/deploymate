#!/usr/bin/env bash

set -euo pipefail

DEPLOY_HOST="${DEPLOYMATE_DEPLOY_HOST:-}"
DEPLOY_REPO_DIR="${DEPLOYMATE_DEPLOY_REPO_DIR:-/opt/deploymate}"
DEPLOY_ENV_FILE="${DEPLOYMATE_DEPLOY_ENV_FILE:-.env.production}"
ADMIN_USERNAME="${DEPLOYMATE_ADMIN_USERNAME:-}"
ADMIN_PASSWORD="${DEPLOYMATE_ADMIN_PASSWORD:-}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/release_secret_contract_audit.sh \
    --host <ssh-host> \
    --repo-dir <path> \
    --env-file <path> \
    --admin-username <user> \
    --admin-password <password>

This audit compares the GitHub-provided smoke credentials with the effective
admin credentials configured in the target runtime env file before deploy.
It prints only contract status, never raw secret values.
EOF
}

require_value() {
  local name="$1"
  local value="$2"
  if [ -z "$value" ]; then
    echo "[release-secret-contract] missing required value: $name" >&2
    exit 1
  fi
}

shell_quote() {
  printf '%q' "$1"
}

run_target_cmd() {
  local command="$1"
  if [ "$DEPLOY_HOST" = "local" ]; then
    bash -lc "$command"
  else
    ssh "$DEPLOY_HOST" "$command"
  fi
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --host)
      DEPLOY_HOST="${2:-}"
      shift 2
      ;;
    --repo-dir)
      DEPLOY_REPO_DIR="${2:-}"
      shift 2
      ;;
    --env-file)
      DEPLOY_ENV_FILE="${2:-}"
      shift 2
      ;;
    --admin-username)
      ADMIN_USERNAME="${2:-}"
      shift 2
      ;;
    --admin-password)
      ADMIN_PASSWORD="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[release-secret-contract] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

require_value "--host" "$DEPLOY_HOST"
require_value "--repo-dir" "$DEPLOY_REPO_DIR"
require_value "--env-file" "$DEPLOY_ENV_FILE"
require_value "--admin-username" "$ADMIN_USERNAME"
require_value "--admin-password" "$ADMIN_PASSWORD"

echo "[release-secret-contract] host: $DEPLOY_HOST"
echo "[release-secret-contract] repo: $DEPLOY_REPO_DIR"
echo "[release-secret-contract] env file: $DEPLOY_ENV_FILE"

REMOTE_CMD="cd $(shell_quote "$DEPLOY_REPO_DIR") && \
REMOTE_ENV_FILE=$(shell_quote "$DEPLOY_ENV_FILE") && \
case \"\$REMOTE_ENV_FILE\" in /*) ;; *) REMOTE_ENV_FILE=$(shell_quote "$DEPLOY_REPO_DIR")/\$REMOTE_ENV_FILE ;; esac && \
python3 - <<'PY' \"\$REMOTE_ENV_FILE\"
import hashlib
import json
import pathlib
import sys

env_path = pathlib.Path(sys.argv[1])
if not env_path.exists():
    raise SystemExit(f\"missing env file: {env_path}\")

values = {}
for raw_line in env_path.read_text(encoding=\"utf-8\").splitlines():
    line = raw_line.strip()
    if not line or line.startswith(\"#\") or \"=\" not in line:
        continue
    key, value = line.split(\"=\", 1)
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in \"\\\"'\":
        value = value[1:-1]
    values[key] = value

effective_username = values.get(\"DEPLOYMATE_ADMIN_USERNAME\") or \"admin\"
password = values.get(\"DEPLOYMATE_ADMIN_PASSWORD\") or \"\"

payload = {
    \"effective_username_sha256\": hashlib.sha256(effective_username.encode(\"utf-8\")).hexdigest(),
    \"password_sha256\": hashlib.sha256(password.encode(\"utf-8\")).hexdigest() if password else \"\",
    \"has_password\": bool(password),
}
print(json.dumps(payload, separators=(\",\", \":\"), ensure_ascii=True))
PY"

remote_payload="$(run_target_cmd "$REMOTE_CMD")"

comparison_result="$(
  python3 - "$remote_payload" "$ADMIN_USERNAME" "$ADMIN_PASSWORD" <<'PY'
import hashlib
import json
import sys

payload = json.loads(sys.argv[1])
username = sys.argv[2]
password = sys.argv[3]

expected_username_sha = hashlib.sha256(username.encode("utf-8")).hexdigest()
expected_password_sha = hashlib.sha256(password.encode("utf-8")).hexdigest()

if not payload.get("has_password"):
    print("missing_password")
elif payload["effective_username_sha256"] != expected_username_sha:
    print("username_mismatch")
elif payload["password_sha256"] != expected_password_sha:
    print("password_mismatch")
else:
    print("ok")
PY
)"

case "$comparison_result" in
  ok)
    echo "[release-secret-contract] runtime env matches provided smoke credentials"
    ;;
  missing_password)
    echo "[release-secret-contract] target env file is missing DEPLOYMATE_ADMIN_PASSWORD" >&2
    exit 1
    ;;
  username_mismatch)
    echo "[release-secret-contract] target admin username does not match provided smoke credentials" >&2
    exit 1
    ;;
  password_mismatch)
    echo "[release-secret-contract] target admin password does not match provided smoke credentials" >&2
    exit 1
    ;;
  *)
    echo "[release-secret-contract] unknown comparison result: $comparison_result" >&2
    exit 1
    ;;
esac

echo "[release-secret-contract] complete"
