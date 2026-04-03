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

## Bootstrap In A New Project

1. Bootstrap into the target project root:

```bash
bash scripts/bootstrap_project_automation.sh /absolute/path/to/project
```

Or through `make`:

```bash
make bootstrap-core TARGET_DIR=/absolute/path/to/project
```

Use `--force` only when you intentionally want to overwrite already copied core files.

2. Review `Makefile` and keep only the commands that match the new project workflow.
3. Edit `scripts/project_automation_config.sh` first:
   - frontend and backend directories
   - python/venv path
   - default smoke routes
4. Edit `scripts/project_automation_targets.sh` next:
   - release surface rules
   - frontend smoke target mapping
   - backend test target mapping
   - runtime and security sensitivity rules
5. Edit `scripts/project_automation_smoke_checks.sh` last:
   - selectors
   - page copy assertions
   - route-specific smoke expectations
6. Run a cheap first validation:

```bash
make changed
make profile-changed
```

7. Once that is stable, run the heavier loops you actually want to keep:

```bash
make frontend
make backend
make full
```

## What This Core Already Solves

- diff-aware local verification
- targeted frontend smokes
- targeted backend tests
- reusable local audit caches
- local timing history, stats, and bottleneck hints
- optional persistent frontend smoke server for hot loops

## Migration Rule

Do not rewrite the orchestration first.

Port the adapter files first, then only patch core scripts when the new project has a truly different workflow contract.

## Upgrade An Existing Project

For a project that already has this core installed:

```bash
bash scripts/upgrade_project_automation.sh /absolute/path/to/project
```

Or through `make`:

```bash
make upgrade-core TARGET_DIR=/absolute/path/to/project
```

Default behavior is safe:

- adapter files are skipped
- changed existing files are skipped
- only missing or unchanged core files are updated automatically

Useful flags:

```bash
bash scripts/upgrade_project_automation.sh /absolute/path/to/project --dry-run
bash scripts/upgrade_project_automation.sh /absolute/path/to/project --force
bash scripts/upgrade_project_automation.sh /absolute/path/to/project --force --include-adapters
```
EOF

echo "[export-automation-core] bundle written to: $OUTPUT_DIR"
echo "[export-automation-core] manifest: $MANIFEST_FILE"
