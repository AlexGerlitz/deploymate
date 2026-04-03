#!/usr/bin/env bash

set -euo pipefail

TARGET_DIR="${PWD}"
SURFACE_NAME=""
SURFACE_SLUG=""
API_PREFIX=""
FORCE=0

usage() {
  cat <<'EOF'
Usage:
  bash scripts/scaffold_deploymate_surface.sh [target-dir] --name "Audit Inbox" --slug audit-inbox [options]

Options:
  --api-prefix <prefix>  Override the generated API prefix. Default: /<slug>
  --force                Overwrite generated files if they already exist

Behavior:
  - generates a new DeployMate admin surface page
  - generates a backend route and service stub
  - generates a backend API flow test stub
  - wires the new route into backend/app/main.py
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
    echo "[scaffold-deploymate-surface] skip existing file: ${dest_path#$TARGET_DIR/}"
    return 0
  fi
  printf '%s' "$content" >"$dest_path"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --name)
      SURFACE_NAME="${2:-}"
      shift 2
      ;;
    --slug)
      SURFACE_SLUG="${2:-}"
      shift 2
      ;;
    --api-prefix)
      API_PREFIX="${2:-}"
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
        echo "[scaffold-deploymate-surface] unexpected extra argument: $1" >&2
        exit 1
      fi
      TARGET_DIR="$1"
      shift
      ;;
  esac
done

if [ ! -d "$TARGET_DIR" ]; then
  echo "[scaffold-deploymate-surface] target directory does not exist: $TARGET_DIR" >&2
  exit 1
fi

if [ -z "$SURFACE_NAME" ] || [ -z "$SURFACE_SLUG" ]; then
  usage >&2
  exit 1
fi

if [ ! -f "$TARGET_DIR/backend/app/main.py" ]; then
  echo "[scaffold-deploymate-surface] expected backend/app/main.py in target repo" >&2
  exit 1
fi

if [ ! -d "$TARGET_DIR/frontend/app/app" ]; then
  echo "[scaffold-deploymate-surface] expected frontend/app/app in target repo" >&2
  exit 1
fi

PASCAL_NAME="$(title_case_to_pascal "$SURFACE_NAME")"
PY_SLUG="${SURFACE_SLUG//-/_}"
API_PREFIX="${API_PREFIX:-/$SURFACE_SLUG}"

frontend_page_path="$TARGET_DIR/frontend/app/app/$SURFACE_SLUG/page.js"
backend_route_path="$TARGET_DIR/backend/app/routes/$PY_SLUG.py"
backend_service_path="$TARGET_DIR/backend/app/services/$PY_SLUG.py"
backend_test_path="$TARGET_DIR/backend/tests/test_${PY_SLUG}_api_flow.py"
backend_main_path="$TARGET_DIR/backend/app/main.py"

safe_write "$frontend_page_path" "$(cat <<EOF
"use client";

import { useMemo, useState } from "react";
import {
  AdminDisclosureSection,
  AdminFeedbackBanners,
  AdminFilterFooter,
  AdminPageHeader,
  AdminSurfaceQueue,
  AdminSurfaceQueueCard,
  AdminSurfaceSummary,
} from "../admin-ui";

const sampleItems = [
  {
    id: "${SURFACE_SLUG}-sample-1",
    label: "Primary review queue",
    status: "needs-review",
    note: "Replace this with the first real review slice for ${SURFACE_NAME}.",
  },
  {
    id: "${SURFACE_SLUG}-sample-2",
    label: "Follow-up backlog",
    status: "ready",
    note: "Keep only the actions and fields that support an actual admin decision.",
  },
];

export default function ${PASCAL_NAME}Page() {
  const [query, setQuery] = useState("");
  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return sampleItems;
    }
    return sampleItems.filter((item) => {
      return [item.label, item.status, item.note].some((value) =>
        value.toLowerCase().includes(normalized),
      );
    });
  }, [query]);

  return (
    <main className="workspaceShell">
      <AdminPageHeader
        title="${SURFACE_NAME}"
        titleTestId="${SURFACE_SLUG}-page-title"
        subtitle="Scaffold a new DeployMate admin surface from one generator instead of rebuilding the same review layout by hand."
        loading={false}
        onRefresh={() => {}}
        refreshTestId="${SURFACE_SLUG}-refresh"
        actions={[
          {
            label: "Placeholder export",
            testId: "${SURFACE_SLUG}-placeholder-export",
            onClick: () => {},
          },
        ]}
      />
      <AdminFeedbackBanners
        smokeMode={false}
        error=""
        success="Scaffold ready. Replace the sample queue, filters, and actions with the first real workflow."
        errorTestId="${SURFACE_SLUG}-error"
        successTestId="${SURFACE_SLUG}-success"
      />

      <AdminSurfaceSummary
        title="Review shape"
        description="Every new admin surface should start with a narrow review slice, not with every possible panel turned on at once."
        metrics={[
          {
            label: "First pass",
            value: "Queue",
            description: "Ship one useful list with one real decision before adding richer tooling.",
          },
          {
            label: "Second pass",
            value: "Action",
            description: "Add the first action that actually resolves the queue or moves work forward.",
          },
          {
            label: "Later",
            value: "Audit/export",
            description: "Bring in audit, saved views, and exports only after the main review flow earns them.",
          },
        ]}
        spotlightTitle="${SURFACE_NAME}"
        spotlightBody="Use this scaffold to establish the first real operator workflow, then layer in richer controls only where they reduce repeated admin work."
      />

      <AdminSurfaceQueue
        title="Current queue slice"
        description="Start with one useful list, one clear filter, and one action that helps the operator decide what to do next."
        searchLabel="Search ${SURFACE_NAME}"
        searchValue={query}
        onSearchChange={(event) => setQuery(event.target.value)}
        searchPlaceholder="Search the first real review queue"
        searchTestId="${SURFACE_SLUG}-search"
        emptyTestId="${SURFACE_SLUG}-empty"
        emptyText="No items match the current search."
        items={filteredItems}
      >
        {filteredItems.map((item) => (
          <AdminSurfaceQueueCard
            key={item.id}
            title={item.label}
            body={item.note}
            status={item.status}
          />
        ))}
      </AdminSurfaceQueue>

      <article className="card formCard">
        <AdminFilterFooter
          summary="Use this scaffold as the first pass for a real admin review surface, not as a permanent mock screen."
          hint="Next step: replace sampleItems with fetched data and wire one genuine action end to end."
          onReset={() => setQuery("")}
          resetDisabled={!query}
          resetTestId="${SURFACE_SLUG}-clear-filters"
        />
      </article>

      <AdminDisclosureSection
        title="Next integration steps"
        subtitle="The generator created the frontend page, backend route, service stub, and API flow test."
        badge="Scaffold"
        defaultOpen
        testId="${SURFACE_SLUG}-next-steps"
      >
        <ol className="formHint">
          <li>Replace the static queue with the first real backend payload.</li>
          <li>Add only the filters and actions that help one concrete admin workflow.</li>
          <li>Wire one smoke or API test around the first real interaction before adding extras.</li>
        </ol>
      </AdminDisclosureSection>
    </main>
  );
}
EOF
)"

safe_write "$backend_service_path" "$(cat <<EOF
def list_${PY_SLUG}_items() -> dict:
    return {
        "items": [
            {
                "id": "${SURFACE_SLUG}-sample-1",
                "label": "Primary review queue",
                "status": "needs-review",
            },
            {
                "id": "${SURFACE_SLUG}-sample-2",
                "label": "Follow-up backlog",
                "status": "ready",
            },
        ],
        "summary": {
            "surface": "${SURFACE_SLUG}",
            "total": 2,
            "next_step": "Replace stub data with the first real repository-backed workflow.",
        },
    }
EOF
)"

safe_write "$backend_route_path" "$(cat <<EOF
from fastapi import APIRouter, Depends

from app.services.auth import require_admin
from app.services.${PY_SLUG} import list_${PY_SLUG}_items


router = APIRouter(dependencies=[Depends(require_admin)])


@router.get("${API_PREFIX}")
def get_${PY_SLUG}() -> dict:
    return list_${PY_SLUG}_items()
EOF
)"

safe_write "$backend_test_path" "$(cat <<EOF
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.services.auth import require_admin


class ${PASCAL_NAME}ApiFlowTests(unittest.TestCase):
    def setUp(self):
        self.user = {
            "id": "admin-1",
            "username": "smoke-admin",
            "role": "admin",
            "plan": "team",
            "must_change_password": False,
        }

        app.dependency_overrides[require_admin] = lambda: self.user

        self.patchers = [
            patch("app.main.init_db", return_value=None),
            patch(
                "app.routes.${PY_SLUG}.list_${PY_SLUG}_items",
                side_effect=self._list_items,
            ),
        ]

        for patcher in self.patchers:
            patcher.start()
            self.addCleanup(patcher.stop)

        self.addCleanup(app.dependency_overrides.clear)
        self.client = TestClient(app)

    def _list_items(self):
        return {
            "items": [
                {
                    "id": "${SURFACE_SLUG}-sample-1",
                    "label": "Primary review queue",
                    "status": "needs-review",
                }
            ],
            "summary": {
                "surface": "${SURFACE_SLUG}",
                "total": 1,
                "next_step": "Replace stub data with the first real repository-backed workflow.",
            },
        }

    def test_${PY_SLUG}_http_flow(self):
        response = self.client.get("${API_PREFIX}")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["summary"]["surface"], "${SURFACE_SLUG}")
        self.assertEqual(len(payload["items"]), 1)
        self.assertEqual(payload["items"][0]["status"], "needs-review")


if __name__ == "__main__":
    unittest.main()
EOF
)"

ruby -e '
  file, py_slug = ARGV
  content = File.read(file)
  import_line = "from app.routes.#{py_slug} import router as #{py_slug}_router\n"
  unless content.include?(import_line)
    route_imports = content.scan(/^from app\.routes\..+$/)
    if route_imports.empty?
      content << "\n#{import_line}"
    else
      last_import = route_imports.last
      content = content.sub("#{last_import}\n", "#{last_import}\n#{import_line}")
    end
  end

  include_line = "app.include_router(#{py_slug}_router)\n"
  unless content.include?(include_line)
    include_routes = content.scan(/^app\.include_router\(.+\)$/)
    if include_routes.empty?
      content << "\n#{include_line}"
    else
      last_include = include_routes.last
      content = content.sub("#{last_include}\n", "#{last_include}\n#{include_line}")
    end
  end

  File.write(file, content)
' "$backend_main_path" "$PY_SLUG"

cat <<EOF
[scaffold-deploymate-surface] surface: $SURFACE_NAME
[scaffold-deploymate-surface] slug: $SURFACE_SLUG
[scaffold-deploymate-surface] api prefix: $API_PREFIX
[scaffold-deploymate-surface] created:
  - ${frontend_page_path#$TARGET_DIR/}
  - ${backend_route_path#$TARGET_DIR/}
  - ${backend_service_path#$TARGET_DIR/}
  - ${backend_test_path#$TARGET_DIR/}
[scaffold-deploymate-surface] updated:
  - ${backend_main_path#$TARGET_DIR/}
[scaffold-deploymate-surface] next useful steps:
  - replace the sample queue with a real backend payload
  - keep the first workflow narrow before adding bulk actions or exports
  - run make backend
  - run make frontend-hot
  - open a PR once the first real slice works end to end
EOF
