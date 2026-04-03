#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/lib/automation_core_bundle.sh"

TARGET_DIR=""
STRICT=0

usage() {
  cat <<'EOF'
Usage:
  bash scripts/automation_core_doctor.sh /absolute/path/to/project [--strict]

Behavior:
  - validates the source automation-core manifest
  - checks target version metadata
  - reports missing files, diverged reusable-core files, and adapter drift separately
  - exits non-zero with --strict when missing or diverged reusable-core files are found
EOF
}

if [ "$#" -lt 1 ]; then
  usage >&2
  exit 1
fi

while [ "$#" -gt 0 ]; do
  case "$1" in
    --strict)
      STRICT=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [ -n "$TARGET_DIR" ]; then
        echo "[automation-core-doctor] unexpected extra argument: $1" >&2
        exit 1
      fi
      TARGET_DIR="$1"
      ;;
  esac
  shift
done

if [ -z "$TARGET_DIR" ]; then
  usage >&2
  exit 1
fi

if [ ! -d "$TARGET_DIR" ]; then
  echo "[automation-core-doctor] target directory does not exist: $TARGET_DIR" >&2
  exit 1
fi

automation_core_validate_manifest "$REPO_ROOT"

source_version="$(automation_core_version "$REPO_ROOT")"
target_version="missing"
target_version_file="${TARGET_DIR}/automation-core/VERSION"
if [ -f "$target_version_file" ]; then
  target_version="$(tr -d '\n' <"$target_version_file")"
fi

missing_core=0
diverged_core=0
matching_core=0
adapter_missing=0
adapter_drift=0
adapter_matching=0

while IFS= read -r rel_path; do
  [ -n "$rel_path" ] || continue
  src_path="${REPO_ROOT}/${rel_path}"
  dest_path="${TARGET_DIR}/${rel_path}"

  if automation_core_is_adapter_path "$rel_path"; then
    if [ ! -e "$dest_path" ]; then
      adapter_missing=$((adapter_missing + 1))
    elif cmp -s "$src_path" "$dest_path"; then
      adapter_matching=$((adapter_matching + 1))
    else
      adapter_drift=$((adapter_drift + 1))
    fi
    continue
  fi

  if [ ! -e "$dest_path" ]; then
    missing_core=$((missing_core + 1))
  elif cmp -s "$src_path" "$dest_path"; then
    matching_core=$((matching_core + 1))
  else
    diverged_core=$((diverged_core + 1))
  fi
done <"$(automation_core_manifest_file "$REPO_ROOT")"

status="ok"
if [ "$missing_core" -gt 0 ] || [ "$diverged_core" -gt 0 ]; then
  status="needs-attention"
fi

cat <<EOF
[automation-core-doctor] source core version: $source_version
[automation-core-doctor] target core version: $target_version
[automation-core-doctor] reusable core: matching=$matching_core diverged=$diverged_core missing=$missing_core
[automation-core-doctor] adapters: matching=$adapter_matching drifted=$adapter_drift missing=$adapter_missing
[automation-core-doctor] status: $status
EOF

if [ "$adapter_drift" -gt 0 ] || [ "$adapter_missing" -gt 0 ]; then
  cat <<'EOF'
[automation-core-doctor] adapter reminder:
  - scripts/project_automation_config.sh
  - scripts/project_automation_targets.sh
  - scripts/project_automation_smoke_checks.sh
EOF
fi

if [ "$STRICT" = "1" ] && { [ "$missing_core" -gt 0 ] || [ "$diverged_core" -gt 0 ]; }; then
  exit 1
fi
