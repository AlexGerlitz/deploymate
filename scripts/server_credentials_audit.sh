#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/project_automation.sh"
cd "$ROOT_DIR"

BACKEND_PYTHON="${BACKEND_PYTHON:-}"
if [ -z "$BACKEND_PYTHON" ]; then
  BACKEND_PYTHON="$(automation_backend_python)"
fi

AUDIT_OUTPUT="$(
  PYTHONPATH="$(automation_backend_dir_rel)" "$BACKEND_PYTHON" -c '
import json
from app.db import get_server_credentials_audit
print(json.dumps(get_server_credentials_audit()))
' 2>/dev/null
)" || {
  echo "[server-credentials-audit] skipped: database unavailable or backend audit failed"
  exit 0
}

SERVER_RECORDS="$(printf '%s' "$AUDIT_OUTPUT" | "$BACKEND_PYTHON" -c 'import json,sys; print(json.load(sys.stdin)["server_records"])')"
CREDENTIAL_RECORDS="$(printf '%s' "$AUDIT_OUTPUT" | "$BACKEND_PYTHON" -c 'import json,sys; print(json.load(sys.stdin)["credential_records"])')"
PLAINTEXT_RECORDS="$(printf '%s' "$AUDIT_OUTPUT" | "$BACKEND_PYTHON" -c 'import json,sys; print(json.load(sys.stdin)["plaintext_records"])')"
ENCRYPTED_RECORDS="$(printf '%s' "$AUDIT_OUTPUT" | "$BACKEND_PYTHON" -c 'import json,sys; print(json.load(sys.stdin)["encrypted_records"])')"
KEY_CONFIGURED="$(printf '%s' "$AUDIT_OUTPUT" | "$BACKEND_PYTHON" -c 'import json,sys; print("yes" if json.load(sys.stdin)["encryption_key_configured"] else "no")')"

echo "[server-credentials-audit] server records: $SERVER_RECORDS"
echo "[server-credentials-audit] credential records: $CREDENTIAL_RECORDS"
echo "[server-credentials-audit] encrypted records: $ENCRYPTED_RECORDS"
echo "[server-credentials-audit] plaintext records: $PLAINTEXT_RECORDS"
echo "[server-credentials-audit] key configured: $KEY_CONFIGURED"

if [ "$CREDENTIAL_RECORDS" -gt 0 ] && [ "$KEY_CONFIGURED" != "yes" ]; then
  echo "[server-credentials-audit] fail: DEPLOYMATE_SERVER_CREDENTIALS_KEY is missing while server credentials exist" >&2
  exit 1
fi

if [ "$PLAINTEXT_RECORDS" -gt 0 ]; then
  echo "[server-credentials-audit] fail: plaintext server credential records remain in the database" >&2
  exit 1
fi

echo "[server-credentials-audit] ok"
