#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SURFACE="full"
BACKEND_PYTHON="${BACKEND_PYTHON:-}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/release_workflow.sh [--surface frontend|backend|full]

This script runs the local release checks in the expected order:
  1. preflight
  2. frontend smokes and build for frontend/full surfaces
  3. backend test suite for backend/full surfaces

It does not commit, push, or deploy. It is the local gate before those steps.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --surface)
      SURFACE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[release] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

case "$SURFACE" in
  frontend|backend|full)
    ;;
  *)
    echo "[release] invalid surface: $SURFACE" >&2
    usage >&2
    exit 1
    ;;
esac

cd "$ROOT_DIR"

if [ -z "$BACKEND_PYTHON" ]; then
  if [ -x "backend/venv/bin/python" ]; then
    BACKEND_PYTHON="backend/venv/bin/python"
  else
    BACKEND_PYTHON="python3"
  fi
fi

echo "[release] repo: $ROOT_DIR"
echo "[release] surface: $SURFACE"
echo "[release] backend python: $BACKEND_PYTHON"

echo "[release] preflight"
bash scripts/preflight.sh

if [ "$SURFACE" = "frontend" ] || [ "$SURFACE" = "full" ]; then
  echo "[release] frontend auth smoke"
  npm --prefix frontend run smoke:auth

  echo "[release] frontend admin smoke"
  npm --prefix frontend run smoke:admin

  echo "[release] frontend admin interactions smoke"
  npm --prefix frontend run smoke:admin-interactions

  echo "[release] frontend ops smoke"
  npm --prefix frontend run smoke:ops

  echo "[release] frontend restore smoke"
  npm --prefix frontend run smoke:restore

  echo "[release] frontend runtime smoke"
  npm --prefix frontend run smoke:runtime

  echo "[release] frontend servers smoke"
  npm --prefix frontend run smoke:servers

  echo "[release] frontend templates smoke"
  npm --prefix frontend run smoke:templates

  echo "[release] frontend build"
  npm --prefix frontend run build
fi

if [ "$SURFACE" = "backend" ] || [ "$SURFACE" = "full" ]; then
  echo "[release] backend test suite"
  PYTHONPATH=backend "$BACKEND_PYTHON" -m unittest discover -s backend/tests -p 'test_*.py'
fi

echo "[release] checks passed"
echo "[release] next: git status --short"
echo "[release] next: git push origin develop"
echo "[release] next: follow RUNBOOK.md for deploy and post-deploy smoke"
