#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="${GITHUB_REPOSITORY:-AlexGerlitz/deploymate}"
BRANCH="${GITHUB_REF_NAME:-develop}"
SOURCE="maintenance"
CHECK_NETWORK=0
OUTPUT="${DEPLOYMATE_RELEASE_MAINTENANCE_STATUS_FILE:-$ROOT_DIR/.logs/release-maintenance-status.json}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/sync_release_maintenance_status.sh [options]

Options:
  --source maintenance|evidence  JSON source to write. Default: maintenance.
  --output <path>                Runtime JSON path to write. Defaults to DEPLOYMATE_RELEASE_MAINTENANCE_STATUS_FILE or .logs/release-maintenance-status.json.
  --repo <owner/name>            GitHub repository to inspect. Defaults to GITHUB_REPOSITORY or AlexGerlitz/deploymate.
  --branch <name>                GitHub branch for evidence bundle workflow lookup. Default: GITHUB_REF_NAME or develop.
  --check-network                Include DNS and HTTPS probes.
  --no-network                   Skip DNS and HTTPS probes. Default.
  -h, --help                     Show this help.

This script is read-only toward GitHub and remote hosts. It writes one local JSON
file atomically so the Operations overview can read release-maintenance state
without calling GitHub or shelling out on every dashboard request.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --source)
      SOURCE="${2:-}"
      shift 2
      ;;
    --output)
      OUTPUT="${2:-}"
      shift 2
      ;;
    --repo)
      REPO="${2:-}"
      shift 2
      ;;
    --branch)
      BRANCH="${2:-}"
      shift 2
      ;;
    --check-network)
      CHECK_NETWORK=1
      shift
      ;;
    --no-network)
      CHECK_NETWORK=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[sync-release-maintenance] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ "$SOURCE" != "maintenance" ] && [ "$SOURCE" != "evidence" ]; then
  echo "[sync-release-maintenance] --source must be maintenance or evidence" >&2
  exit 1
fi

if [ -z "$OUTPUT" ]; then
  echo "[sync-release-maintenance] --output must not be empty" >&2
  exit 1
fi

if [ -z "$REPO" ]; then
  echo "[sync-release-maintenance] --repo must not be empty" >&2
  exit 1
fi

if [ "$SOURCE" = "evidence" ] && [ -z "$BRANCH" ]; then
  echo "[sync-release-maintenance] --branch must not be empty for evidence source" >&2
  exit 1
fi

validate_json() {
  local source="$1"
  local file="$2"

  python3 - "$source" "$file" <<'PY'
import json
import sys
from pathlib import Path

source = sys.argv[1]
path = Path(sys.argv[2])

try:
    payload = json.loads(path.read_text(encoding="utf-8"))
except Exception as exc:
    raise SystemExit(f"invalid json: {exc}")

if not isinstance(payload, dict):
    raise SystemExit("json root must be an object")

if source == "maintenance":
    required = [
        "generated_at",
        "repo",
        "ready_for_unpause",
        "blocker_count",
        "issue_18_state",
        "issue_19_state",
        "network_checks",
    ]
    missing = [key for key in required if key not in payload]
    if missing:
        raise SystemExit(f"maintenance json missing keys: {', '.join(missing)}")
elif source == "evidence":
    maintenance = payload.get("maintenance")
    workflows = payload.get("workflows")
    if not isinstance(maintenance, dict):
        raise SystemExit("evidence json missing maintenance object")
    if not isinstance(workflows, dict):
        raise SystemExit("evidence json missing workflows object")
    if not isinstance(maintenance.get("repair_playbook"), list):
        raise SystemExit("evidence maintenance missing repair_playbook list")
    required = ["ready_for_unpause", "blocker_count", "issue_18_state", "issue_19_state"]
    missing = [key for key in required if key not in maintenance]
    if missing:
        raise SystemExit(f"evidence maintenance missing keys: {', '.join(missing)}")
else:
    raise SystemExit(f"unknown source: {source}")
PY
}

generate_json() {
  if [ "$SOURCE" = "maintenance" ]; then
    args=(bash scripts/release_maintenance_status.sh --repo "$REPO" --format json)
    if [ "$CHECK_NETWORK" != "1" ]; then
      args+=(--no-network)
    fi
    "${args[@]}"
    return 0
  fi

  args=(python3 scripts/public_evidence_bundle.py --repo "$REPO" --branch "$BRANCH" --format json)
  if [ "$CHECK_NETWORK" = "1" ]; then
    args+=(--check-network)
  fi
  "${args[@]}"
}

cd "$ROOT_DIR"

output_dir="$(dirname "$OUTPUT")"
mkdir -p "$output_dir"
tmp_file="$(mktemp "${output_dir}/.release-maintenance-status.XXXXXX")"
cleanup() {
  rm -f "$tmp_file"
}
trap cleanup EXIT

generate_json >"$tmp_file"
validate_json "$SOURCE" "$tmp_file"
chmod 0644 "$tmp_file"
mv "$tmp_file" "$OUTPUT"
trap - EXIT

echo "[sync-release-maintenance] wrote $SOURCE status to $OUTPUT"
