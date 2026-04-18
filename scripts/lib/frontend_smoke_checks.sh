#!/usr/bin/env bash

set -euo pipefail

FRONTEND_SMOKE_CHECKS_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${FRONTEND_SMOKE_CHECKS_SCRIPT_DIR}/project_automation_smoke_checks.sh"

frontend_smoke_fetch_page() {
  local base_url="$1"
  local path="$2"
  local file="$3"
  curl -sS "${base_url}${path}" >"$file"
}

frontend_smoke_static_html_file() {
  local repo_root="$1"
  local dist_dir="$2"
  local path="$3"

  if [ -z "$path" ] || [ "${path#/}" = "$path" ]; then
    echo "[frontend-smoke] static path must start with /: $path" >&2
    return 1
  fi

  printf '%s/frontend/%s/server/app%s.html\n' "$repo_root" "$dist_dir" "$path"
}

frontend_smoke_assert_checks() {
  local smoke_name="$1"
  local base_url="$2"
  local checks_function="$3"
  local tmp_dir=""
  local line=""
  local path=""
  local label=""
  local pattern=""
  local page_file=""

  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' RETURN

  while IFS= read -r line; do
    [ -n "$line" ] || continue
    path="${line%%|*}"
    label="${line#*|}"
    label="${label%%|*}"
    pattern="${line#*|*|}"
    page_file="$tmp_dir/$(printf '%s' "$path" | tr '/[]' '___').html"
    if [ ! -f "$page_file" ]; then
      frontend_smoke_fetch_page "$base_url" "$path" "$page_file"
    fi
    if ! grep -Eq "$pattern" "$page_file"; then
      echo "[${smoke_name}] missing check: $label" >&2
      exit 1
    fi
  done < <("$checks_function")
}

frontend_smoke_assert_static_checks() {
  local smoke_name="$1"
  local repo_root="$2"
  local dist_dir="$3"
  local checks_function="$4"
  local line=""
  local path=""
  local label=""
  local pattern=""
  local page_file=""

  while IFS= read -r line; do
    [ -n "$line" ] || continue
    path="${line%%|*}"
    label="${line#*|}"
    label="${label%%|*}"
    pattern="${line#*|*|}"
    page_file="$(frontend_smoke_static_html_file "$repo_root" "$dist_dir" "$path")"
    if [ ! -f "$page_file" ]; then
      echo "[${smoke_name}] missing static page: $page_file" >&2
      exit 1
    fi
    if ! grep -Eq "$pattern" "$page_file"; then
      echo "[${smoke_name}] missing check: $label" >&2
      exit 1
    fi
  done < <("$checks_function")
}
