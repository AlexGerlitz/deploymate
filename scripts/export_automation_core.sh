#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST_FILE="$ROOT_DIR/automation-core/FILES.txt"
OUTPUT_DIR="${1:-$ROOT_DIR/automation-core-dist}"

if [ ! -f "$MANIFEST_FILE" ]; then
  echo "[export-automation-core] manifest missing: $MANIFEST_FILE" >&2
  exit 1
fi

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

copy_path() {
  local rel_path="$1"
  local src="$ROOT_DIR/$rel_path"
  local dest="$OUTPUT_DIR/$rel_path"

  if [ ! -f "$src" ]; then
    echo "[export-automation-core] missing file in manifest: $rel_path" >&2
    exit 1
  fi

  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
}

while IFS= read -r rel_path; do
  [ -n "$rel_path" ] || continue
  copy_path "$rel_path"
done < "$MANIFEST_FILE"

cat > "$OUTPUT_DIR/README.md" <<'EOF'
# Exported Automation Core

This bundle was exported from DeployMate so the automation layer can be reused elsewhere.

Recommended first edits in a new project:

1. `scripts/project_automation_config.sh`
2. `scripts/project_automation_targets.sh`

After that, adjust smoke commands or test suites only if the new repo uses different entrypoints.
EOF

echo "[export-automation-core] bundle written to: $OUTPUT_DIR"
echo "[export-automation-core] manifest: $MANIFEST_FILE"
