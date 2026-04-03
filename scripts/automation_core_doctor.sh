#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/lib/automation_core_bundle.sh"

TARGET_DIR=""
STRICT=0
OUTPUT_FORMAT="human"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/automation_core_doctor.sh /absolute/path/to/project [--strict] [--format human|shell]

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
    --format)
      OUTPUT_FORMAT="${2:-human}"
      shift
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

readiness_status="ready"
if [ "$missing_core" -gt 0 ] || [ "$diverged_core" -gt 0 ]; then
  readiness_status="core-needs-sync"
elif [ "$adapter_missing" -gt 0 ]; then
  readiness_status="adapters-missing"
elif [ "$adapter_matching" -gt 0 ] && [ "$adapter_drift" -eq 0 ] && [ "$adapter_missing" -eq 0 ]; then
  readiness_status="adapters-unedited"
elif [ "$adapter_drift" -gt 0 ] && [ "$adapter_matching" -gt 0 ]; then
  readiness_status="adapters-in-progress"
fi

if [ "$OUTPUT_FORMAT" = "shell" ]; then
  cat <<EOF
source_core_version=$source_version
target_core_version=$target_version
matching_core=$matching_core
diverged_core=$diverged_core
missing_core=$missing_core
adapter_matching=$adapter_matching
adapter_drift=$adapter_drift
adapter_missing=$adapter_missing
status=$status
readiness_status=$readiness_status
EOF
else

cat <<EOF
[automation-core-doctor] source core version: $source_version
[automation-core-doctor] target core version: $target_version
[automation-core-doctor] reusable core: matching=$matching_core diverged=$diverged_core missing=$missing_core
[automation-core-doctor] adapters: matching=$adapter_matching drifted=$adapter_drift missing=$adapter_missing
[automation-core-doctor] status: $status
[automation-core-doctor] readiness: $readiness_status
EOF

if [ "$adapter_drift" -gt 0 ] || [ "$adapter_missing" -gt 0 ]; then
  cat <<'EOF'
[automation-core-doctor] adapter reminder:
  - scripts/project_automation_config.sh
  - scripts/project_automation_targets.sh
  - scripts/project_automation_smoke_checks.sh
EOF
fi

if [ "$readiness_status" = "adapters-unedited" ]; then
  cat <<'EOF'
[automation-core-doctor] next step:
  - adapter files are still identical to the exported defaults
  - edit config, targets, and smoke checks before trusting the local loops
EOF
fi
if [ "$readiness_status" = "adapters-in-progress" ]; then
  cat <<'EOF'
[automation-core-doctor] next step:
  - at least one adapter file was customized, but some still match the defaults
  - finish adapting targets and smoke checks before relying on the fast loops
EOF
fi
fi

if [ "$STRICT" = "1" ] && { [ "$missing_core" -gt 0 ] || [ "$diverged_core" -gt 0 ]; }; then
  exit 1
fi
