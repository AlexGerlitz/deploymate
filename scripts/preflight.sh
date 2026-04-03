#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SURFACE="full"
FAST_MODE=0

clean_frontend_build_artifacts() {
  if [ -d "frontend/.next" ]; then
    echo "[preflight] removing stale frontend/.next"
    rm -rf "frontend/.next"
  fi
}

usage() {
  cat <<'EOF'
Usage:
  bash scripts/preflight.sh [--surface frontend|backend|full] [--fast]
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
      echo "[preflight] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

case "$SURFACE" in
  frontend|backend|full)
    ;;
  *)
    echo "[preflight] invalid surface: $SURFACE" >&2
    usage >&2
    exit 1
    ;;
esac

cd "$ROOT_DIR"

echo "[preflight] repo: $ROOT_DIR"
echo "[preflight] surface: $SURFACE"
echo "[preflight] fast mode: $FAST_MODE"
echo "[preflight] git status"
git status --short

if [ -f "frontend/package.json" ] && { [ "$SURFACE" = "frontend" ] || [ "$SURFACE" = "full" ]; }; then
  if [ "$FAST_MODE" = "1" ]; then
    echo "[preflight] frontend build skipped in fast mode"
  else
    clean_frontend_build_artifacts
    echo "[preflight] frontend build"
    npm --prefix frontend run build
  fi
fi

if [ -d "backend/app" ] && { [ "$SURFACE" = "backend" ] || [ "$SURFACE" = "full" ]; }; then
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
