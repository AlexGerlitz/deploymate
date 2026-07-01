#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

REPO="${GITHUB_REPOSITORY:-AlexGerlitz/deploymate}"
BRANCH="${GITHUB_REF_NAME:-develop}"
RUN_GITHUB=1
RUN_FRONTEND=0
OUTPUT_DIR=""

usage() {
  cat <<'EOF'
Usage:
  bash scripts/public_review_gate.sh [options]

Options:
  --repo <owner/name>       GitHub repository. Defaults to GITHUB_REPOSITORY or AlexGerlitz/deploymate.
  --branch <branch>         GitHub branch. Defaults to GITHUB_REF_NAME or develop.
  --output-dir <dir>        Empty directory for the local generated review packet.
  --skip-github             Skip downloading and verifying the latest GitHub Actions review packet artifact.
  --with-frontend           Also run the public /review frontend smoke.
  -h, --help                Show this help.

This gate verifies the reviewer-facing evidence path:
  1. release workflow/evidence contract
  2. local review packet generation
  3. local review packet manifest and SHA-256 integrity
  4. latest GitHub Actions review packet artifact integrity, unless skipped
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --repo)
      REPO="${2:-}"
      shift 2
      ;;
    --branch)
      BRANCH="${2:-}"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="${2:-}"
      shift 2
      ;;
    --skip-github)
      RUN_GITHUB=0
      shift
      ;;
    --with-frontend)
      RUN_FRONTEND=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[public-review] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ -z "$REPO" ] || [ -z "$BRANCH" ]; then
  echo "[public-review] repo and branch must not be empty" >&2
  exit 1
fi

cleanup_dir=""
if [ -n "$OUTPUT_DIR" ]; then
  PACKET_DIR="$(python3 - "$OUTPUT_DIR" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1]).resolve()
if path.exists() and any(path.iterdir()):
    raise SystemExit(f"output directory is not empty: {path}")
path.mkdir(parents=True, exist_ok=True)
print(path)
PY
)"
else
  cleanup_dir="$(mktemp -d)"
  PACKET_DIR="$cleanup_dir/review-packet"
fi

cleanup() {
  if [ -n "$cleanup_dir" ]; then
    rm -rf "$cleanup_dir"
  fi
}
trap cleanup EXIT

echo "[public-review] repo: $REPO"
echo "[public-review] branch: $BRANCH"

echo "[public-review] release workflow audit"
bash scripts/release_workflow_audit.sh

echo "[public-review] export local review packet"
python3 scripts/export_review_packet.py \
  --repo "$REPO" \
  --branch "$BRANCH" \
  --output "$PACKET_DIR"

echo "[public-review] verify local review packet"
python3 scripts/verify_review_packet.py "$PACKET_DIR"

if [ "$RUN_GITHUB" = "1" ]; then
  echo "[public-review] verify latest GitHub review packet artifact"
  python3 scripts/check_latest_review_packet_artifact.py \
    --repo "$REPO" \
    --branch "$BRANCH"
else
  echo "[public-review] latest GitHub review packet artifact skipped"
fi

if [ "$RUN_FRONTEND" = "1" ]; then
  echo "[public-review] frontend /review smoke"
  npm --prefix frontend run smoke:review
fi

echo "[public-review] ok"
