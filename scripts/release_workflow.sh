#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SURFACE="full"
BACKEND_PYTHON="${BACKEND_PYTHON:-}"
FAST_MODE=0
BACKEND_FAST_TEST_MODULES="${BACKEND_FAST_TEST_MODULES:-}"
FRONTEND_FAST_SMOKES="${FRONTEND_FAST_SMOKES:-}"

clean_frontend_build_artifacts() {
  if [ -d "frontend/.next" ]; then
    echo "[release] removing stale frontend/.next"
    rm -rf "frontend/.next"
  fi
}

usage() {
  cat <<'EOF'
Usage:
  bash scripts/release_workflow.sh [--surface frontend|backend|full] [--fast]

This script runs the local release checks in the expected order:
  1. preflight
  2. frontend smokes and build for frontend/full surfaces
  3. backend test suite for backend/full surfaces

It does not commit, push, or deploy. It is the local gate before those steps.

Fast mode keeps the same surface selection with a smaller local gate.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --surface)
      SURFACE="${2:-}"
      shift 2
      ;;
    --fast)
      FAST_MODE=1
      shift
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
echo "[release] fast mode: $FAST_MODE"
echo "[release] backend python: $BACKEND_PYTHON"
if [ -n "$BACKEND_FAST_TEST_MODULES" ]; then
  echo "[release] backend fast targets: $BACKEND_FAST_TEST_MODULES"
fi
if [ -n "$FRONTEND_FAST_SMOKES" ]; then
  echo "[release] frontend fast smokes: $FRONTEND_FAST_SMOKES"
fi

echo "[release] preflight"
if [ "$FAST_MODE" = "1" ]; then
  bash scripts/preflight.sh --surface "$SURFACE" --fast
else
  bash scripts/preflight.sh --surface "$SURFACE"
fi

if [ "$SURFACE" = "frontend" ] || [ "$SURFACE" = "full" ]; then
  frontend_fast_smokes=(auth ops runtime)
  if [ -n "$FRONTEND_FAST_SMOKES" ]; then
    IFS=' ' read -r -a frontend_fast_smokes <<< "$FRONTEND_FAST_SMOKES"
  fi

  frontend_fast_port=3001
  for frontend_smoke in "${frontend_fast_smokes[@]}"; do
    case "$frontend_smoke" in
      auth|ops|runtime)
        echo "[release] frontend ${frontend_smoke} smoke"
        FRONTEND_SMOKE_PORT="$frontend_fast_port" npm --prefix frontend run "smoke:${frontend_smoke}"
        frontend_fast_port=$((frontend_fast_port + 1))
        ;;
      *)
        echo "[release] unknown frontend fast smoke target: $frontend_smoke" >&2
        exit 1
        ;;
    esac
  done

  if [ "$FAST_MODE" != "1" ]; then
    echo "[release] frontend admin smoke"
    FRONTEND_SMOKE_PORT=3004 npm --prefix frontend run smoke:admin

    echo "[release] frontend admin interactions smoke"
    FRONTEND_SMOKE_PORT=3005 npm --prefix frontend run smoke:admin-interactions

    echo "[release] frontend restore smoke"
    FRONTEND_SMOKE_PORT=3006 npm --prefix frontend run smoke:restore

    echo "[release] frontend servers smoke"
    FRONTEND_SMOKE_PORT=3007 npm --prefix frontend run smoke:servers

    echo "[release] frontend templates smoke"
    FRONTEND_SMOKE_PORT=3008 npm --prefix frontend run smoke:templates

    clean_frontend_build_artifacts
    echo "[release] frontend build"
    npm --prefix frontend run build
  fi
fi

if [ "$SURFACE" = "backend" ] || [ "$SURFACE" = "full" ]; then
  if [ "$FAST_MODE" = "1" ]; then
    if [ -n "$BACKEND_FAST_TEST_MODULES" ]; then
      echo "[release] backend targeted fast suite"
      IFS=' ' read -r -a backend_fast_modules <<< "$BACKEND_FAST_TEST_MODULES"
      PYTHONPATH=backend "$BACKEND_PYTHON" -m unittest "${backend_fast_modules[@]}"
    else
      echo "[release] backend fast safety suite"
      PYTHONPATH=backend "$BACKEND_PYTHON" -m unittest \
        backend.tests.test_auth_security \
        backend.tests.test_ops_api_flow \
        backend.tests.test_restore_dry_run \
        backend.tests.test_server_credentials_policy
    fi
  else
    echo "[release] backend test suite"
    PYTHONPATH=backend "$BACKEND_PYTHON" -m unittest discover -s backend/tests -p 'test_*.py'
  fi
fi

echo "[release] executed phases:"
if [ "$SURFACE" = "frontend" ] || [ "$SURFACE" = "full" ]; then
  if [ "$FAST_MODE" = "1" ]; then
    if [ -n "$FRONTEND_FAST_SMOKES" ]; then
      echo "[release]   - frontend preflight plus targeted fast smokes"
    else
      echo "[release]   - frontend preflight plus auth, ops, and runtime smokes"
    fi
  else
    echo "[release]   - frontend preflight, smokes, and build"
  fi
fi
if [ "$SURFACE" = "backend" ] || [ "$SURFACE" = "full" ]; then
  if [ "$FAST_MODE" = "1" ]; then
    if [ -n "$BACKEND_FAST_TEST_MODULES" ]; then
      echo "[release]   - backend preflight plus targeted fast suite"
    else
      echo "[release]   - backend preflight plus fast safety suite"
    fi
  else
    echo "[release]   - backend preflight and test suite"
  fi
fi

echo "[release] checks passed"
echo "[release] next: git status --short"
echo "[release] next: git push origin develop"
echo "[release] next: follow RUNBOOK.md for deploy and post-deploy smoke"
