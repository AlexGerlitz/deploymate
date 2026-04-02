#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

echo "[preflight] repo: $ROOT_DIR"
echo "[preflight] git status"
git status --short

if [ -f "frontend/package.json" ]; then
  echo "[preflight] frontend build"
  npm --prefix frontend run build
fi

if [ -d "backend/app" ]; then
  echo "[preflight] backend syntax check"
  python_files=()
  while IFS= read -r file; do
    python_files+=("$file")
  done < <(find backend/app -type f -name '*.py' | sort)
  if [ "${#python_files[@]}" -gt 0 ]; then
    python3 -m py_compile "${python_files[@]}"
  fi
fi

if [ -f "scripts/security_audit.sh" ]; then
  echo "[preflight] security audit"
  bash scripts/security_audit.sh
fi

if [ -f "scripts/runtime_capability_audit.sh" ]; then
  echo "[preflight] runtime capability audit"
  bash scripts/runtime_capability_audit.sh
fi

echo "[preflight] done"
