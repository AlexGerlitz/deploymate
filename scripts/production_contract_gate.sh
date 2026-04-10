#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${BACKEND_PYTHON:-python3}"
cd "$ROOT_DIR"

echo "[production-contract] repo: $ROOT_DIR"
echo "[production-contract] python: $PYTHON_BIN"

echo "[production-contract] shell syntax"
bash -n \
  scripts/preflight.sh \
  scripts/remote_release.sh \
  scripts/security_audit.sh \
  scripts/runtime_capability_audit.sh \
  scripts/production_env_audit.sh \
  scripts/production_contract_gate.sh

echo "[production-contract] release workflow audit"
bash scripts/release_workflow_audit.sh

echo "[production-contract] runtime capability audit"
bash scripts/runtime_capability_audit.sh

echo "[production-contract] production env audit"
bash scripts/production_env_audit.sh

echo "[production-contract] script regression tests"
"$PYTHON_BIN" -m unittest discover -s backend/tests -p 'test_production_env_audit.py'

echo "[production-contract] ok"
