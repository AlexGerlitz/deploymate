#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${1:-$ROOT_DIR/product-starter-dist}"
STARTER_MANIFEST="$ROOT_DIR/product-starter/FILES.txt"
AUTOMATION_MANIFEST="$ROOT_DIR/automation-core/FILES.txt"

copy_rel_file() {
  local rel_path="$1"
  local src="$ROOT_DIR/$rel_path"
  local dest="$OUTPUT_DIR/$rel_path"

  if [ ! -f "$src" ]; then
    echo "[export-product-starter] missing file: $rel_path" >&2
    exit 1
  fi

  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
}

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

while IFS= read -r rel_path; do
  [ -n "$rel_path" ] || continue
  copy_rel_file "$rel_path"
done < "$STARTER_MANIFEST"

while IFS= read -r rel_path; do
  [ -n "$rel_path" ] || continue
  copy_rel_file "$rel_path"
done < "$AUTOMATION_MANIFEST"

echo "[export-product-starter] bundle written to: $OUTPUT_DIR"
echo "[export-product-starter] starter version: $(tr -d '\n' < "$ROOT_DIR/product-starter/VERSION")"
echo "[export-product-starter] automation core version: $(tr -d '\n' < "$ROOT_DIR/automation-core/VERSION")"
