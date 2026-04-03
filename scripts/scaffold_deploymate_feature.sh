#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${PWD}"
FEATURE_NAME=""
FEATURE_SLUG=""
FEATURE_KIND="review-workflow"
FORCE=0

usage() {
  cat <<'EOF'
Usage:
  bash scripts/scaffold_deploymate_feature.sh [target-dir] --name "Controlled Import Plan" --slug controlled-import-plan [options]

Options:
  --feature-kind <kind>  One of: review-workflow, recovery-workflow, guardrail-workflow
  --force                Overwrite generated files if they already exist

Behavior:
  - reuses scaffold_deploymate_surface.sh for the base surface
  - creates a frontend feature-pack helper module
  - creates a generated smoke checks file and dedicated smoke script
  - aims at current DeployMate review/recovery/admin-heavy feature slices
EOF
}

title_case_to_pascal() {
  ruby -e '
    input = ARGV.join(" ")
    parts = input.split(/[^a-zA-Z0-9]+/).reject(&:empty?)
    puts parts.map { |part| part[0].upcase + part[1..].to_s.downcase }.join
  ' "$@"
}

slug_to_camel() {
  ruby -e '
    input = ARGV.join(" ")
    parts = input.split(/[^a-zA-Z0-9]+/).reject(&:empty?)
    head = parts.shift.to_s.downcase
    tail = parts.map { |part| part[0].upcase + part[1..].to_s.downcase }.join
    puts head + tail
  ' "$@"
}

safe_write() {
  local dest_path="$1"
  local content="$2"
  mkdir -p "$(dirname "$dest_path")"
  if [ -e "$dest_path" ] && [ "$FORCE" != "1" ]; then
    echo "[scaffold-deploymate-feature] skip existing file: ${dest_path#$TARGET_DIR/}"
    return 0
  fi
  printf '%s' "$content" >"$dest_path"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --name)
      FEATURE_NAME="${2:-}"
      shift 2
      ;;
    --slug)
      FEATURE_SLUG="${2:-}"
      shift 2
      ;;
    --feature-kind)
      FEATURE_KIND="${2:-}"
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
      if [ "$TARGET_DIR" != "$PWD" ]; then
        echo "[scaffold-deploymate-feature] unexpected extra argument: $1" >&2
        exit 1
      fi
      TARGET_DIR="$1"
      shift
      ;;
  esac
done

if [ ! -d "$TARGET_DIR" ]; then
  echo "[scaffold-deploymate-feature] target directory does not exist: $TARGET_DIR" >&2
  exit 1
fi

if [ -z "$FEATURE_NAME" ] || [ -z "$FEATURE_SLUG" ]; then
  usage >&2
  exit 1
fi

case "$FEATURE_KIND" in
  review-workflow)
    SURFACE_FLAGS=(--preset generic --with-saved-views --with-audit --with-export --with-table)
    FEATURE_FOCUS="review"
    ;;
  recovery-workflow)
    SURFACE_FLAGS=(--preset generic --with-export --with-table)
    FEATURE_FOCUS="recovery"
    ;;
  guardrail-workflow)
    SURFACE_FLAGS=(--preset generic --with-export --with-table)
    FEATURE_FOCUS="guardrail"
    ;;
  *)
    echo "[scaffold-deploymate-feature] unsupported feature kind: $FEATURE_KIND" >&2
    exit 1
    ;;
esac

if [ "$FORCE" = "1" ]; then
  SURFACE_FLAGS+=(--force)
fi

bash "$SCRIPT_DIR/scaffold_deploymate_surface.sh" \
  "$TARGET_DIR" \
  --name "$FEATURE_NAME" \
  --slug "$FEATURE_SLUG" \
  "${SURFACE_FLAGS[@]}"

PASCAL_NAME="$(title_case_to_pascal "$FEATURE_NAME")"
CAMEL_NAME="$(slug_to_camel "$FEATURE_SLUG")"

feature_pack_path="$TARGET_DIR/frontend/app/lib/${FEATURE_SLUG}-feature-pack.js"
generated_smoke_checks_path="$TARGET_DIR/scripts/generated_smoke_checks/${FEATURE_SLUG}.txt"
generated_smoke_script_path="$TARGET_DIR/scripts/frontend_${FEATURE_SLUG}_smoke.sh"

safe_write "$feature_pack_path" "$(cat <<EOF
import { escapeCsvCell } from "./admin-page-utils";

export const ${CAMEL_NAME}FeatureRoute = "/app/${FEATURE_SLUG}";

export const ${CAMEL_NAME}SmokeFixture = {
  focus: "${FEATURE_FOCUS}",
  route: ${CAMEL_NAME}FeatureRoute,
  headline: "${FEATURE_NAME}",
  nextStep:
    "Replace starter queue items, actions, and smoke copy with the first real ${FEATURE_FOCUS} workflow.",
};

export function build${PASCAL_NAME}Summary(items = []) {
  return {
    total: items.length,
    ready: items.filter((item) => String(item.status || "").includes("ready")).length,
    attention: items.filter((item) => String(item.status || "").includes("review") || String(item.status || "").includes("follow")).length,
  };
}

export function build${PASCAL_NAME}Csv(items = []) {
  const rows = [["id", "label", "status", "segment", "meta", "note"]];
  for (const item of items) {
    rows.push([
      item.id || "",
      item.label || "",
      item.status || "",
      item.segment || "",
      item.meta || "",
      item.note || "",
    ]);
  }
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\\n");
}

export function build${PASCAL_NAME}Markdown(items = []) {
  const lines = [
    "# ${FEATURE_NAME}",
    "",
    "## Current Starter Scope",
    "",
    "- Route: /app/${FEATURE_SLUG}",
    "- Feature kind: ${FEATURE_KIND}",
    "- Focus: ${FEATURE_FOCUS}",
    "",
    "## Items",
    "",
  ];

  if (!items.length) {
    lines.push("- No items yet.");
  } else {
    for (const item of items) {
      lines.push(\`- \${item.label || item.id || "Unnamed"}: \${item.status || "unknown"}\`);
    }
  }

  return lines.join("\\n");
}
EOF
)"

safe_write "$generated_smoke_checks_path" "$(cat <<EOF
/app/${FEATURE_SLUG}|${FEATURE_NAME} page title|data-testid="${FEATURE_SLUG}-page-title"
/app/${FEATURE_SLUG}|${FEATURE_NAME} search|data-testid="${FEATURE_SLUG}-search"
/app/${FEATURE_SLUG}|${FEATURE_NAME} action starter|data-testid="${FEATURE_SLUG}-action-starter"
/app/${FEATURE_SLUG}|${FEATURE_NAME} bulk starter|data-testid="${FEATURE_SLUG}-bulk-starter"
/app/${FEATURE_SLUG}|${FEATURE_NAME} mutation starter|data-testid="${FEATURE_SLUG}-mutation-starter"
/app/${FEATURE_SLUG}|${FEATURE_NAME} next steps|data-testid="${FEATURE_SLUG}-next-steps"
EOF
)"

safe_write "$generated_smoke_script_path" "$(cat <<EOF
#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
source "\${SCRIPT_DIR}/frontend_smoke_shared.sh"
source "\${SCRIPT_DIR}/lib/frontend_smoke_checks.sh"

generated_feature_checks() {
  cat "\${SCRIPT_DIR}/generated_smoke_checks/${FEATURE_SLUG}.txt"
}

trap stop_frontend_smoke_server EXIT
start_frontend_smoke_server
wait_for_frontend_smoke_url
frontend_smoke_assert_checks "frontend-${FEATURE_SLUG}-smoke" "\$BASE_URL" generated_feature_checks
echo "[frontend-${FEATURE_SLUG}-smoke] ok"
EOF
)"

echo "[scaffold-deploymate-feature] feature: $FEATURE_NAME"
echo "[scaffold-deploymate-feature] slug: $FEATURE_SLUG"
echo "[scaffold-deploymate-feature] kind: $FEATURE_KIND"
echo "[scaffold-deploymate-feature] created:"
echo "  - ${feature_pack_path#$TARGET_DIR/}"
echo "  - ${generated_smoke_checks_path#$TARGET_DIR/}"
echo "  - ${generated_smoke_script_path#$TARGET_DIR/}"
echo "[scaffold-deploymate-feature] why this exists:"
echo "  - new DeployMate features usually need backend, frontend, exports, and smoke in one pass"
echo "  - this wrapper keeps the existing surface scaffold, but adds the extra project-specific pack you keep rebuilding by hand"
echo "[scaffold-deploymate-feature] next useful steps:"
echo "  - replace starter queue and starter actions with the first real workflow"
echo "  - wire the generated smoke script into the relevant local mode only after the feature becomes real"
echo "  - import ${FEATURE_SLUG}-feature-pack.js when the page starts needing summary/export helpers"
