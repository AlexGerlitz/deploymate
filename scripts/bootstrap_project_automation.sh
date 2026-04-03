#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/lib/automation_core_bundle.sh"
MANIFEST="$(automation_core_manifest_file "$REPO_ROOT")"
FORCE=0
TARGET_DIR=""
INIT_ADAPTERS=0
PROJECT_NAME=""
FRONTEND_DIR=""
BACKEND_DIR=""

usage() {
  cat <<'EOF'
Usage:
  bash scripts/bootstrap_project_automation.sh /absolute/path/to/project [--force] [--init-adapters] [--project-name <name>] [--frontend-dir <dir>] [--backend-dir <dir>]

Behavior:
  - copies the automation-core manifest files into the target project
  - refuses to overwrite existing files unless --force is set
  - can prefill the adapter config for a new project with --init-adapters
  - prints the adapter files to edit first after bootstrap
EOF
}

if [ "$#" -lt 1 ]; then
  usage >&2
  exit 1
fi

while [ "$#" -gt 0 ]; do
  case "$1" in
    --force)
      FORCE=1
      ;;
    --init-adapters)
      INIT_ADAPTERS=1
      ;;
    --project-name)
      PROJECT_NAME="${2:-}"
      shift
      ;;
    --frontend-dir)
      FRONTEND_DIR="${2:-}"
      shift
      ;;
    --backend-dir)
      BACKEND_DIR="${2:-}"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [ -n "$TARGET_DIR" ]; then
        echo "[bootstrap-automation-core] unexpected extra argument: $1" >&2
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
  echo "[bootstrap-automation-core] target directory does not exist: $TARGET_DIR" >&2
  exit 1
fi

automation_core_validate_manifest "$REPO_ROOT"

copy_count=0
skip_count=0
overwrite_count=0

while IFS= read -r rel_path; do
  [ -n "$rel_path" ] || continue
  src_path="${REPO_ROOT}/${rel_path}"
  dest_path="${TARGET_DIR}/${rel_path}"

  if [ ! -e "$src_path" ]; then
    echo "[bootstrap-automation-core] manifest entry missing in core repo: $rel_path" >&2
    exit 1
  fi

  mkdir -p "$(dirname "$dest_path")"

  if [ -e "$dest_path" ] && [ "$FORCE" != "1" ]; then
    echo "[bootstrap-automation-core] skip existing file: $rel_path"
    skip_count=$((skip_count + 1))
    continue
  fi

  if [ -e "$dest_path" ] && [ "$FORCE" = "1" ]; then
    overwrite_count=$((overwrite_count + 1))
  fi

  cp "$src_path" "$dest_path"
  copy_count=$((copy_count + 1))
done <"$MANIFEST"

if [ "$INIT_ADAPTERS" = "1" ]; then
  init_args=("$TARGET_DIR")
  if [ -n "$PROJECT_NAME" ]; then
    init_args+=(--project-name "$PROJECT_NAME")
  fi
  if [ -n "$FRONTEND_DIR" ]; then
    init_args+=(--frontend-dir "$FRONTEND_DIR")
  fi
  if [ -n "$BACKEND_DIR" ]; then
    init_args+=(--backend-dir "$BACKEND_DIR")
  fi
  bash "${SCRIPT_DIR}/init_project_automation_adapters.sh" "${init_args[@]}"
fi

cat <<EOF
[bootstrap-automation-core] copied files: $copy_count
[bootstrap-automation-core] skipped existing files: $skip_count
[bootstrap-automation-core] overwritten files: $overwrite_count
[bootstrap-automation-core] core version: $(automation_core_version "$REPO_ROOT")
[bootstrap-automation-core] next files to edit first:
  - scripts/project_automation_config.sh
  - scripts/project_automation_targets.sh
  - scripts/project_automation_smoke_checks.sh
[bootstrap-automation-core] recommended first validation:
  - make changed
  - make profile-changed
  - make dev-doctor
EOF
