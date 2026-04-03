#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MANIFEST="${REPO_ROOT}/automation-core/FILES.txt"
TARGET_DIR=""
FORCE=0
INCLUDE_ADAPTERS=0
DRY_RUN=0

is_adapter_path() {
  case "$1" in
    scripts/project_automation_config.sh|scripts/project_automation_targets.sh|scripts/project_automation_smoke_checks.sh)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

usage() {
  cat <<'EOF'
Usage:
  bash scripts/upgrade_project_automation.sh /absolute/path/to/project [--force] [--include-adapters] [--dry-run]

Behavior:
  - updates reusable automation-core files in an existing project
  - skips adapter files by default
  - skips changed existing files unless --force is passed
  - can print a dry-run summary without copying files
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
    --include-adapters)
      INCLUDE_ADAPTERS=1
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [ -n "$TARGET_DIR" ]; then
        echo "[upgrade-automation-core] unexpected extra argument: $1" >&2
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
  echo "[upgrade-automation-core] target directory does not exist: $TARGET_DIR" >&2
  exit 1
fi

if [ ! -f "$MANIFEST" ]; then
  echo "[upgrade-automation-core] manifest not found: $MANIFEST" >&2
  exit 1
fi

installed_count=0
updated_count=0
unchanged_count=0
skipped_changed_count=0
skipped_adapter_count=0

while IFS= read -r rel_path; do
  [ -n "$rel_path" ] || continue
  src_path="${REPO_ROOT}/${rel_path}"
  dest_path="${TARGET_DIR}/${rel_path}"

  if [ ! -e "$src_path" ]; then
    echo "[upgrade-automation-core] manifest entry missing in core repo: $rel_path" >&2
    exit 1
  fi

  if is_adapter_path "$rel_path" && [ "$INCLUDE_ADAPTERS" != "1" ]; then
    echo "[upgrade-automation-core] skip adapter file: $rel_path"
    skipped_adapter_count=$((skipped_adapter_count + 1))
    continue
  fi

  if [ ! -e "$dest_path" ]; then
    if [ "$DRY_RUN" = "1" ]; then
      echo "[upgrade-automation-core] would install missing file: $rel_path"
    else
      mkdir -p "$(dirname "$dest_path")"
      cp "$src_path" "$dest_path"
      echo "[upgrade-automation-core] installed missing file: $rel_path"
    fi
    installed_count=$((installed_count + 1))
    continue
  fi

  if cmp -s "$src_path" "$dest_path"; then
    unchanged_count=$((unchanged_count + 1))
    continue
  fi

  if [ "$FORCE" != "1" ]; then
    echo "[upgrade-automation-core] skip changed existing file: $rel_path"
    skipped_changed_count=$((skipped_changed_count + 1))
    continue
  fi

  if [ "$DRY_RUN" = "1" ]; then
    echo "[upgrade-automation-core] would overwrite file: $rel_path"
  else
    cp "$src_path" "$dest_path"
    echo "[upgrade-automation-core] updated file: $rel_path"
  fi
  updated_count=$((updated_count + 1))
done <"$MANIFEST"

cat <<EOF
[upgrade-automation-core] installed missing files: $installed_count
[upgrade-automation-core] updated files: $updated_count
[upgrade-automation-core] unchanged files: $unchanged_count
[upgrade-automation-core] skipped changed files: $skipped_changed_count
[upgrade-automation-core] skipped adapter files: $skipped_adapter_count
[upgrade-automation-core] next recommended checks:
  - review skipped changed files if any
  - adapt adapter files manually unless --include-adapters was used
  - make changed
  - make profile-changed
EOF
