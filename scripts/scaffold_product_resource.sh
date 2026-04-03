#!/usr/bin/env bash

set -euo pipefail

TARGET_DIR=""
RESOURCE_NAME=""
RESOURCE_SLUG=""
FRONTEND_DIR="${FRONTEND_DIR:-frontend}"
BACKEND_DIR="${BACKEND_DIR:-backend}"
ROUTE_PREFIX=""
FORCE=0

usage() {
  cat <<'EOF'
Usage:
  bash scripts/scaffold_product_resource.sh /absolute/path/to/project --name "Projects" --slug projects [options]

Options:
  --frontend-dir <dir>
  --backend-dir <dir>
  --route-prefix <prefix>
  --force

Behavior:
  - creates one first resource slice in the target project
  - adds a frontend page shell
  - adds backend route and service stubs
  - appends resource notes into starter docs
EOF
}

title_case_to_pascal() {
  ruby -e '
    input = ARGV.join(" ")
    parts = input.split(/[^a-zA-Z0-9]+/).reject(&:empty?)
    puts parts.map { |part| part[0].upcase + part[1..].to_s.downcase }.join
  ' "$@"
}

safe_write() {
  local dest_path="$1"
  local content="$2"
  mkdir -p "$(dirname "$dest_path")"
  if [ -e "$dest_path" ] && [ "$FORCE" != "1" ]; then
    echo "[scaffold-product-resource] skip existing file: ${dest_path#$TARGET_DIR/}"
    return 0
  fi
  printf '%s' "$content" >"$dest_path"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --name)
      RESOURCE_NAME="${2:-}"
      shift 2
      ;;
    --slug)
      RESOURCE_SLUG="${2:-}"
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
    --route-prefix)
      ROUTE_PREFIX="${2:-}"
      shift 2
      ;;
    --force)
      FORCE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [ -n "$TARGET_DIR" ]; then
        echo "[scaffold-product-resource] unexpected extra argument: $1" >&2
        exit 1
      fi
      TARGET_DIR="$1"
      shift
      ;;
  esac
done

if [ -z "$TARGET_DIR" ] || [ ! -d "$TARGET_DIR" ]; then
  echo "[scaffold-product-resource] target directory does not exist: ${TARGET_DIR:-missing}" >&2
  exit 1
fi
if [ -z "$RESOURCE_NAME" ] || [ -z "$RESOURCE_SLUG" ]; then
  usage >&2
  exit 1
fi

PASCAL_NAME="$(title_case_to_pascal "$RESOURCE_NAME")"
ROUTE_PREFIX="${ROUTE_PREFIX:-/api/${RESOURCE_SLUG}}"

frontend_page_path="$TARGET_DIR/$FRONTEND_DIR/app/$RESOURCE_SLUG/page.js"
backend_route_path="$TARGET_DIR/$BACKEND_DIR/app/routes/$RESOURCE_SLUG.py"
backend_service_path="$TARGET_DIR/$BACKEND_DIR/app/services/$RESOURCE_SLUG.py"
docs_brief_path="$TARGET_DIR/docs/PRODUCT-BRIEF.md"
docs_roadmap_path="$TARGET_DIR/docs/ROADMAP.md"
schemas_path="$TARGET_DIR/$BACKEND_DIR/app/schemas.py"
main_path="$TARGET_DIR/$BACKEND_DIR/app/main.py"

safe_write "$frontend_page_path" "$(cat <<EOF
export default function ${PASCAL_NAME}Page() {
  return (
    <main className="starterShell">
      <div className="starterWrap">
        <section className="starterHero">
          <p className="starterEyebrow">First Resource</p>
          <h1 className="starterTitle">${RESOURCE_NAME}</h1>
          <p className="starterLead">
            This is the first real product slice scaffold for ${RESOURCE_NAME}. Replace the placeholder cards
            with the list, filters, and actions your users actually need.
          </p>
        </section>
        <section className="starterGrid">
          <article className="starterGridCard">
            <h2>List view</h2>
            <p>Start with one useful list and one clear action.</p>
          </article>
          <article className="starterGridCard">
            <h2>Detail view</h2>
            <p>Add detail only when the list view has a real decision to support.</p>
          </article>
          <article className="starterGridCard">
            <h2>Admin/support</h2>
            <p>Add admin tooling only after the first workflow is genuinely useful.</p>
          </article>
        </section>
      </div>
    </main>
  );
}
EOF
)"

safe_write "$backend_service_path" "$(cat <<EOF
from ..schemas import ${PASCAL_NAME}ListResponse


def list_${RESOURCE_SLUG//-/_}() -> ${PASCAL_NAME}ListResponse:
    return ${PASCAL_NAME}ListResponse(items=[], total=0)
EOF
)"

safe_write "$backend_route_path" "$(cat <<EOF
from fastapi import APIRouter

from ..schemas import ${PASCAL_NAME}ListResponse
from ..services.${RESOURCE_SLUG} import list_${RESOURCE_SLUG//-/_}


router = APIRouter(prefix="${ROUTE_PREFIX}", tags=["${RESOURCE_SLUG}"])


@router.get("", response_model=${PASCAL_NAME}ListResponse)
def get_${RESOURCE_SLUG//-/_}() -> ${PASCAL_NAME}ListResponse:
    return list_${RESOURCE_SLUG//-/_}()
EOF
)"

if ! grep -q "class ${PASCAL_NAME}ListResponse" "$schemas_path" 2>/dev/null; then
  cat >>"$schemas_path" <<EOF


class ${PASCAL_NAME}Item(BaseModel):
    id: str
    name: str


class ${PASCAL_NAME}ListResponse(BaseModel):
    items: list[${PASCAL_NAME}Item]
    total: int
EOF
fi

if ! grep -q "routes.${RESOURCE_SLUG}" "$main_path" 2>/dev/null; then
  ruby -e '
    file, slug = ARGV
    content = File.read(file)
    import_line = "from .routes import #{slug}\n"
    unless content.include?(import_line)
      content = content.sub("from .routes import admin, auth, health\n", "from .routes import admin, auth, health\n#{import_line}")
    end
    include_line = "app.include_router(#{slug}.router)\n"
    unless content.include?(include_line)
      content << include_line
    end
    File.write(file, content)
  ' "$main_path" "$RESOURCE_SLUG"
fi

if [ -f "$docs_brief_path" ] && ! grep -q "$RESOURCE_NAME should become the first real resource slice" "$docs_brief_path"; then
  cat >>"$docs_brief_path" <<EOF

## First resource candidate

- $RESOURCE_NAME should become the first real resource slice after the starter shell.
EOF
fi

if [ -f "$docs_roadmap_path" ] && ! grep -q "$RESOURCE_NAME" "$docs_roadmap_path"; then
  cat >>"$docs_roadmap_path" <<EOF

## First implemented slice

- scaffold $RESOURCE_NAME list API and product page
EOF
fi

cat <<EOF
[scaffold-product-resource] resource: $RESOURCE_NAME
[scaffold-product-resource] slug: $RESOURCE_SLUG
[scaffold-product-resource] created:
  - ${frontend_page_path#$TARGET_DIR/}
  - ${backend_route_path#$TARGET_DIR/}
  - ${backend_service_path#$TARGET_DIR/}
[scaffold-product-resource] updated if present:
  - ${schemas_path#$TARGET_DIR/}
  - ${main_path#$TARGET_DIR/}
  - ${docs_brief_path#$TARGET_DIR/}
  - ${docs_roadmap_path#$TARGET_DIR/}
[scaffold-product-resource] next useful steps:
  - adapt the generated page to the real first workflow
  - replace stub backend response with real storage
  - run make changed
  - run make dev-doctor
EOF
