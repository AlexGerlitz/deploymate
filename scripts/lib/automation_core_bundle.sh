#!/usr/bin/env bash

set -euo pipefail

automation_core_repo_root() {
  local script_dir=""
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  cd "$script_dir/.." && pwd
}

automation_core_manifest_file() {
  local repo_root="$1"
  echo "${repo_root}/automation-core/FILES.txt"
}

automation_core_version_file() {
  local repo_root="$1"
  echo "${repo_root}/automation-core/VERSION"
}

automation_core_version() {
  local repo_root="$1"
  local version_file=""
  version_file="$(automation_core_version_file "$repo_root")"
  if [ ! -f "$version_file" ]; then
    echo "[automation-core] version file missing: $version_file" >&2
    return 1
  fi
  tr -d '\n' <"$version_file"
}

automation_core_is_adapter_path() {
  case "$1" in
    scripts/project_automation_config.sh|scripts/project_automation_targets.sh|scripts/project_automation_smoke_checks.sh)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

automation_core_validate_manifest() {
  local repo_root="$1"
  local manifest_file=""
  local rel_path=""
  local path=""
  manifest_file="$(automation_core_manifest_file "$repo_root")"

  if [ ! -f "$manifest_file" ]; then
    echo "[automation-core] manifest missing: $manifest_file" >&2
    return 1
  fi

  if [ ! -f "$(automation_core_version_file "$repo_root")" ]; then
    echo "[automation-core] version file missing from bundle" >&2
    return 1
  fi

  while IFS= read -r rel_path; do
    [ -n "$rel_path" ] || continue
    path="${repo_root}/${rel_path}"
    if [ ! -f "$path" ]; then
      echo "[automation-core] missing file in manifest: $rel_path" >&2
      return 1
    fi
  done <"$manifest_file"
}
