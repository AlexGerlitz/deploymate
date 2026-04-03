#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE_DIR="$ROOT_DIR/product-starter/templates"
TARGET_DIR=""
PROJECT_NAME="New Product"
APP_SLUG="new-product"
CONTACT_EMAIL="founder@example.com"
FRONTEND_DIR="frontend"
BACKEND_DIR="backend"
FORCE=0
WITH_AUTOMATION_CORE=1

usage() {
  cat <<'EOF'
Usage:
  bash scripts/bootstrap_product_starter.sh /absolute/path/to/project [options]

Options:
  --project-name <name>
  --app-slug <slug>
  --contact-email <email>
  --frontend-dir <dir>
  --backend-dir <dir>
  --force
  --without-automation-core

Behavior:
  - renders the starter product skeleton into the target directory
  - optionally bootstraps the reusable automation core into the same repo
EOF
}

render_file() {
  local src_path="$1"
  local dest_path="$2"
  ruby -e '
    src, dest, project_name, app_slug, contact_email = ARGV
    content = File.read(src)
    content = content.gsub("{{PROJECT_NAME}}", project_name)
    content = content.gsub("{{APP_SLUG}}", app_slug)
    content = content.gsub("{{CONTACT_EMAIL}}", contact_email)
    File.write(dest, content)
  ' "$src_path" "$dest_path" "$PROJECT_NAME" "$APP_SLUG" "$CONTACT_EMAIL"
}

map_target_path() {
  local rel_path="$1"
  case "$rel_path" in
    frontend/*)
      printf '%s/%s\n' "$FRONTEND_DIR" "${rel_path#frontend/}"
      ;;
    backend/*)
      printf '%s/%s\n' "$BACKEND_DIR" "${rel_path#backend/}"
      ;;
    *)
      printf '%s\n' "$rel_path"
      ;;
  esac
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --project-name)
      PROJECT_NAME="${2:-}"
      shift 2
      ;;
    --app-slug)
      APP_SLUG="${2:-}"
      shift 2
      ;;
    --contact-email)
      CONTACT_EMAIL="${2:-}"
      shift 2
      ;;
    --frontend-dir)
      FRONTEND_DIR="${2:-}"
      shift 2
      ;;
    --backend-dir)
      BACKEND_DIR="${2:-}"
      shift 2
      ;;
    --force)
      FORCE=1
      shift
      ;;
    --without-automation-core)
      WITH_AUTOMATION_CORE=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [ -n "$TARGET_DIR" ]; then
        echo "[bootstrap-product-starter] unexpected extra argument: $1" >&2
        exit 1
      fi
      TARGET_DIR="$1"
      shift
      ;;
  esac
done

if [ -z "$TARGET_DIR" ]; then
  usage >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"

copy_count=0
skip_count=0
while IFS= read -r src_path; do
  rel_path="${src_path#$TEMPLATE_DIR/}"
  target_rel="$(map_target_path "$rel_path")"
  dest_path="$TARGET_DIR/$target_rel"
  mkdir -p "$(dirname "$dest_path")"
  if [ -e "$dest_path" ] && [ "$FORCE" != "1" ]; then
    echo "[bootstrap-product-starter] skip existing file: $target_rel"
    skip_count=$((skip_count + 1))
    continue
  fi
  render_file "$src_path" "$dest_path"
  copy_count=$((copy_count + 1))
done < <(find "$TEMPLATE_DIR" -type f | sort)

if [ "$WITH_AUTOMATION_CORE" = "1" ]; then
  bash "$ROOT_DIR/scripts/bootstrap_project_automation.sh" "$TARGET_DIR" --init-adapters \
    --project-name "$PROJECT_NAME" \
    --frontend-dir "$FRONTEND_DIR" \
    --backend-dir "$BACKEND_DIR"
fi

cat <<EOF
[bootstrap-product-starter] rendered files: $copy_count
[bootstrap-product-starter] skipped files: $skip_count
[bootstrap-product-starter] project: $PROJECT_NAME
[bootstrap-product-starter] frontend dir: $FRONTEND_DIR
[bootstrap-product-starter] backend dir: $BACKEND_DIR
[bootstrap-product-starter] next useful steps:
  - fill docs/PRODUCT-BRIEF.md
  - replace starter landing/auth/app copy
  - define first real backend resource
  - run make changed
  - run make dev-doctor
EOF
