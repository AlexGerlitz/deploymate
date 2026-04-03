#!/usr/bin/env bash

set -euo pipefail

TARGET_DIR="${PWD}"
SURFACE_NAME=""
SURFACE_SLUG=""
API_PREFIX=""
FORCE=0
WITH_SAVED_VIEWS=0
WITH_AUDIT=0
WITH_EXPORT=0

usage() {
  cat <<'EOF'
Usage:
  bash scripts/scaffold_deploymate_surface.sh [target-dir] --name "Audit Inbox" --slug audit-inbox [options]

Options:
  --api-prefix <prefix>  Override the generated API prefix. Default: /<slug>
  --with-saved-views     Include a saved-views starter section in the generated page
  --with-audit           Include an audit starter section in the generated page
  --with-export          Include an export/recovery starter section in the generated page
  --force                Overwrite generated files if they already exist

Behavior:
  - generates a new DeployMate admin surface page
  - generates a backend route and service stub
  - generates a backend API flow test stub
  - adds a typed list contract into backend/app/schemas.py
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
    --with-saved-views)
      WITH_SAVED_VIEWS=1
      shift
      ;;
    --with-audit)
      WITH_AUDIT=1
      shift
      ;;
    --with-export)
      WITH_EXPORT=1
      shift
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

if [ ! -f "$TARGET_DIR/backend/app/schemas.py" ]; then
  echo "[scaffold-deploymate-surface] expected backend/app/schemas.py in target repo" >&2
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
backend_schemas_path="$TARGET_DIR/backend/app/schemas.py"

admin_ui_imports="  AdminActiveFilters,
  AdminDisclosureSection,
  AdminFeedbackBanners,
  AdminFilterFooter,
  AdminPageHeader,
  AdminSurfaceQueue,
  AdminSurfaceQueueCard,
  AdminSurfaceSummary,"
hook_imports=""
saved_views_lib_imports=""
utils_imports="  buildFilterChipsFromDefinitions,
  buildFilterState,
  createTextFilterDefinition,"
constants_block=""
helpers_block=""
saved_views_state_block=""
saved_views_section=""
audit_state_block=""
audit_section=""
export_helpers_block=""
export_section=""

if [ "$WITH_SAVED_VIEWS" = "1" ]; then
  admin_ui_imports="${admin_ui_imports}
  AdminSavedViews,"
  hook_imports="import { useAdminSavedViewsManager } from \"../../lib/admin-page-hooks\";"
  saved_views_lib_imports="import { formatSavedViews } from \"../../lib/admin-saved-views\";"
  utils_imports="${utils_imports}
  applyFilterDefinitions,
  copyTextToClipboard,"
  constants_block="$(cat <<EOF
const ${PY_SLUG}SavedViewsStorageKey = "deploymate.admin.${SURFACE_SLUG}.savedViews";
EOF
)"
  helpers_block="$(cat <<EOF
function formatDate(value) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function format${PASCAL_NAME}SavedViews(items) {
  return formatSavedViews(items, {
    formatDate,
    summarizeFilters: (filters) =>
      [filters.q ? \`search \${filters.q}\` : null].filter(Boolean).join(" · "),
  });
}
EOF
)"
  saved_views_state_block="$(cat <<EOF
  const {
    savedViews,
    savedViewName,
    setSavedViewName,
    savedViewsMetaText,
    savedViewsSearch,
    setSavedViewsSearch,
    savedViewsSourceFilter,
    setSavedViewsSourceFilter,
    savedViewsSort,
    setSavedViewsSort,
    hasSavedViewNameMatch,
    activeSavedViewId,
    canSaveCurrentView,
    visibleSavedViews,
    savedViewsSummaryText,
    handleSaveCurrentView,
    handleApplySavedView,
    handleUpdateCurrentView,
    handleDeleteSavedView,
    handleDownloadSavedViews,
    handleImportSavedViews,
    handleClearSavedViews,
    handleClearImportedSavedViews,
    handleResetSavedViewsTools,
    handleUseCurrentSavedViewName,
    handleCopySavedViewLink,
  } = useAdminSavedViewsManager({
    initialViews: format${PASCAL_NAME}SavedViews([
      {
        id: "${SURFACE_SLUG}-saved-view-1",
        name: "Daily review",
        filters: { q: "review" },
        updatedAt: new Date().toISOString(),
        source: "local",
      },
    ]),
    formatViews: format${PASCAL_NAME}SavedViews,
    storageKey: ${PY_SLUG}SavedViewsStorageKey,
    currentFilters,
    hasFilters: hasActiveFilters,
    applyViewFilters: (filters) => applyFilterDefinitions(primaryFilterDefinitions, filters),
    pathname,
    copyText: copyTextToClipboard,
    setFeedback: setSuccess,
    setError,
    initialMetaText: "Using local browser storage.",
    exportFilename: "deploymate-${SURFACE_SLUG}-saved-views.json",
    exportScope: "${SURFACE_SLUG}",
    summaryNoun: "${SURFACE_SLUG}",
    emptyImportMessage: "No valid saved views found in this file.",
    wrongScopeMessage: "This file is not a ${SURFACE_NAME} saved views export.",
    saveSuccessMessage: "Saved current review view.",
    updateSuccessMessage: "Current review view updated.",
    deleteSuccessMessage: "Saved review view removed.",
    exportSuccessMessage: "Saved review views exported.",
    clearSuccessMessage: "Saved review views cleared.",
    clearImportedSuccessMessage: "Imported review views removed.",
    resetToolsSuccessMessage: "Saved review view tools reset.",
    importMergeMessage: ({ total, replacedCount, skippedCount }) =>
      \`Saved review views merged. Total: \${total}. Replaced: \${replacedCount}. Skipped by limit: \${skippedCount}.\`,
  });
EOF
)"
  saved_views_section="$(cat <<EOF

      <AdminSavedViews
        title="Saved review views"
        inputLabel="View name"
        inputValue={savedViewName}
        onInputChange={(event) => setSavedViewName(event.target.value)}
        onSave={handleSaveCurrentView}
        onUpdateCurrent={handleUpdateCurrentView}
        saveDisabled={!canSaveCurrentView}
        updateDisabled={!activeSavedViewId}
        saveTestId="${SURFACE_SLUG}-save-view"
        updateTestId="${SURFACE_SLUG}-update-view"
        statusText={
          hasSavedViewNameMatch
            ? "A saved view with this name already exists and will be replaced."
            : "Use this block once the queue and filters are worth repeating."
        }
        metaText={savedViewsMetaText}
        viewSummaryText={savedViewsSummaryText}
        useCurrentNameLabel="Use active view name"
        onUseCurrentName={handleUseCurrentSavedViewName}
        useCurrentNameDisabled={!activeSavedViewId}
        views={visibleSavedViews}
        onApply={handleApplySavedView}
        onDelete={handleDeleteSavedView}
        onCopy={handleCopySavedViewLink}
        searchValue={savedViewsSearch}
        onSearchChange={(event) => setSavedViewsSearch(event.target.value)}
        searchTestId="${SURFACE_SLUG}-saved-views-search"
        sourceFilter={savedViewsSourceFilter}
        onSourceFilterChange={(event) => setSavedViewsSourceFilter(event.target.value)}
        sourceFilterTestId="${SURFACE_SLUG}-saved-views-source"
        sortValue={savedViewsSort}
        onSortChange={(event) => setSavedViewsSort(event.target.value)}
        sortTestId="${SURFACE_SLUG}-saved-views-sort"
        actions={[
          {
            label: "Export views",
            testId: "${SURFACE_SLUG}-saved-views-export",
            onClick: handleDownloadSavedViews,
            disabled: savedViews.length === 0,
          },
          {
            label: "Import views",
            kind: "file",
            testId: "${SURFACE_SLUG}-saved-views-import",
            accept: "application/json",
            onChange: handleImportSavedViews,
          },
          {
            label: "Clear imported",
            testId: "${SURFACE_SLUG}-saved-views-clear-imported",
            onClick: handleClearImportedSavedViews,
            disabled: savedViews.length === 0,
          },
          {
            label: "Clear all",
            testId: "${SURFACE_SLUG}-saved-views-clear",
            onClick: handleClearSavedViews,
            disabled: savedViews.length === 0,
          },
          {
            label: "Reset tools",
            testId: "${SURFACE_SLUG}-saved-views-reset-tools",
            onClick: handleResetSavedViewsTools,
          },
        ]}
        emptyText="No saved views yet."
        listTestId="${SURFACE_SLUG}-saved-views-list"
        activeViewId={activeSavedViewId}
      />
EOF
)"
fi

if [ "$WITH_AUDIT" = "1" ]; then
  admin_ui_imports="${admin_ui_imports}
  AdminAuditToolbar,"
  utils_imports="${utils_imports}
  createChoiceFilterDefinition,
  sortItemsByDateMode,"
  audit_state_block="$(cat <<EOF
  const [auditQuery, setAuditQuery] = useState(() => searchParams.get("audit_q") || "");
  const [auditScope, setAuditScope] = useState(() => searchParams.get("audit_scope") || "all");
  const [auditSort, setAuditSort] = useState(() => searchParams.get("audit_sort") || "newest");
  const auditItems = [
    {
      id: "${SURFACE_SLUG}-audit-1",
      label: "Scaffold created",
      scope: "queue",
      created_at: "2026-04-03T00:00:00+00:00",
      detail: "Replace this with the first real audit event stream once the main action exists.",
    },
    {
      id: "${SURFACE_SLUG}-audit-2",
      label: "Placeholder export added",
      scope: "bulk",
      created_at: "2026-04-02T00:00:00+00:00",
      detail: "Use audit to explain decisions, not to dump every internal detail.",
    },
  ];
  const auditFilterDefinitions = [
    createTextFilterDefinition({
      key: "audit_q",
      value: auditQuery,
      setValue: setAuditQuery,
      chipKey: "${SURFACE_SLUG}-audit-query",
      chipLabel: \`Audit: \${auditQuery.trim()}\`,
      testId: "${SURFACE_SLUG}-audit-chip-query",
    }),
    createChoiceFilterDefinition({
      key: "audit_scope",
      value: auditScope,
      setValue: setAuditScope,
      chipKey: "${SURFACE_SLUG}-audit-scope",
      chipLabel: \`Scope: \${auditScope}\`,
      testId: "${SURFACE_SLUG}-audit-chip-scope",
    }),
    createChoiceFilterDefinition({
      key: "audit_sort",
      value: auditSort,
      setValue: setAuditSort,
      resetValue: "newest",
      activeWhen: (value) => value !== "newest",
      serializeWhen: (value) => value !== "newest",
    }),
  ];
  const {
    serializedParams: auditSerializedParams,
    syncedSearchParams: syncedAuditSearchParams,
  } = buildFilterState(auditFilterDefinitions);
  const activeAuditFilterChips = buildFilterChipsFromDefinitions(auditFilterDefinitions);
  const visibleAuditItems = useMemo(() => {
    const normalizedAuditQuery = auditQuery.trim().toLowerCase();
    const scopedItems = auditItems.filter((item) => auditScope === "all" || item.scope === auditScope);
    const searchedItems = normalizedAuditQuery
      ? scopedItems.filter((item) =>
          [item.label, item.detail, item.scope].some((value) =>
            value.toLowerCase().includes(normalizedAuditQuery),
          ),
        )
      : scopedItems;
    return sortItemsByDateMode(searchedItems, {
      valueKey: "created_at",
      mode: auditSort,
    });
  }, [auditItems, auditQuery, auditScope, auditSort]);
EOF
)"
  audit_section="$(cat <<EOF

      <AdminAuditToolbar
        title="Audit history"
        description="Only keep audit here if it helps the operator explain what changed and why."
        query={auditQuery}
        onQueryChange={(event) => setAuditQuery(event.target.value)}
        queryPlaceholder="Search scaffold audit history"
        queryTestId="${SURFACE_SLUG}-audit-search"
        filterLabel="Scope"
        filterValue={auditScope}
        onFilterChange={(event) => setAuditScope(event.target.value)}
        filterOptions={[
          { value: "all", label: "All activity" },
          { value: "queue", label: "Queue changes" },
          { value: "bulk", label: "Bulk changes" },
        ]}
        filterTestId="${SURFACE_SLUG}-audit-scope"
        sortValue={auditSort}
        onSortChange={(event) => setAuditSort(event.target.value)}
        sortTestId="${SURFACE_SLUG}-audit-sort"
        totalCount={visibleAuditItems.length}
        summary="Add the real audit feed only when the surface has a decision trail worth preserving."
        filters={activeAuditFilterChips}
        emptyTestId="${SURFACE_SLUG}-audit-empty"
        emptyText="No audit events yet."
      >
        <div className="adminSavedViewsList" data-testid="${SURFACE_SLUG}-audit-list">
          {visibleAuditItems.map((item) => (
            <AdminSurfaceQueueCard
              key={item.id}
              title={item.label}
              body={item.detail}
              status={item.scope}
            />
          ))}
        </div>
      </AdminAuditToolbar>
EOF
)"
fi

if [ "$WITH_EXPORT" = "1" ]; then
  utils_imports="${utils_imports}
  triggerFileDownload,"
  export_helpers_block="$(cat <<EOF
  function handleExportJson() {
    const payload = {
      surface: "${SURFACE_SLUG}",
      generated_at: new Date().toISOString(),
      filters: currentFilters,
      items: filteredItems,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    triggerFileDownload("deploymate-${SURFACE_SLUG}-starter.json", blob);
    setSuccess("Starter JSON export generated.");
    setError("");
  }

  function handleExportCsv() {
    const rows = [
      ["id", "label", "status", "note"],
      ...filteredItems.map((item) => [item.id, item.label, item.status, item.note]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => String(value ?? "").replaceAll("\"", "\"\""))
          .map((value) => \`\"\${value}\"\`)
          .join(","),
      )
      .join("\\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    triggerFileDownload("deploymate-${SURFACE_SLUG}-starter.csv", blob);
    setSuccess("Starter CSV export generated.");
    setError("");
  }
EOF
)"
  export_section="$(cat <<EOF

      <AdminDisclosureSection
        title="Export and recovery"
        subtitle="Use this only after the main review flow is stable enough to justify exports, CSV handoff, or recovery notes."
        badge="Optional"
        testId="${SURFACE_SLUG}-export-starter"
      >
        <div className="adminFilterActions">
          <button
            type="button"
            className="secondaryButton"
            data-testid="${SURFACE_SLUG}-export-json"
            onClick={handleExportJson}
          >
            Export starter JSON
          </button>
          <button
            type="button"
            className="secondaryButton"
            data-testid="${SURFACE_SLUG}-export-csv"
            onClick={handleExportCsv}
          >
            Export starter CSV
          </button>
        </div>
        <p className="formHint">
          Keep export and recovery tools secondary until the first queue and action are genuinely useful.
        </p>
      </AdminDisclosureSection>
EOF
)"
fi

safe_write "$frontend_page_path" "$(cat <<EOF
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
${admin_ui_imports}
} from "../admin-ui";
${saved_views_lib_imports}
${hook_imports}
import {
${utils_imports}
} from "../../lib/admin-page-utils";

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

${constants_block}
${helpers_block}
function ${PASCAL_NAME}PageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(
    "Scaffold ready. Replace the sample queue, filters, and actions with the first real workflow.",
  );
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const primaryFilterDefinitions = [
    createTextFilterDefinition({
      key: "q",
      value: query,
      setValue: setQuery,
      chipKey: "${SURFACE_SLUG}-query",
      chipLabel: \`Search: \${query.trim()}\`,
      testId: "${SURFACE_SLUG}-filter-chip-query",
    }),
  ];
  const { currentFilters, hasActiveFilters, syncedSearchParams } =
    buildFilterState(primaryFilterDefinitions);
  const activeFilterChips = buildFilterChipsFromDefinitions(primaryFilterDefinitions);
${saved_views_state_block}
${audit_state_block}
  const filteredItems = useMemo(() => {
    const normalized = currentFilters.q.trim().toLowerCase();
    if (!normalized) {
      return sampleItems;
    }
    return sampleItems.filter((item) => {
      return [item.label, item.status, item.note].some((value) =>
        value.toLowerCase().includes(normalized),
      );
    });
  }, [currentFilters.q]);
${export_helpers_block}

  useEffect(() => {
    const nextQuery = searchParams.get("q") || "";
    if (nextQuery !== query) {
      setQuery(nextQuery);
    }
  }, [query, searchParams]);

  useEffect(() => {
    const currentSearch = searchParams.toString();
    if (currentSearch === syncedSearchParams) {
      return;
    }
    router.replace(syncedSearchParams ? \`\${pathname}?\${syncedSearchParams}\` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams, syncedSearchParams]);

  return (
    <main className="workspaceShell">
      <AdminPageHeader
        title="${SURFACE_NAME}"
        titleTestId="${SURFACE_SLUG}-page-title"
        subtitle="Scaffold a new DeployMate admin surface from one generator instead of rebuilding the same review layout by hand."
        loading={false}
        onRefresh={() => setSuccess("Refresh stays local in the starter until the real loader is wired.")}
        refreshTestId="${SURFACE_SLUG}-refresh"
        actions={[
          {
            label: "Placeholder export",
            testId: "${SURFACE_SLUG}-placeholder-export",
            onClick: () => setSuccess("Use the placeholder export only after the main workflow is real."),
          },
        ]}
      />
      <AdminFeedbackBanners
        smokeMode={false}
        error={error}
        success={success}
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
        spotlightBody="This starter already includes URL state, filter chips, and optional secondary sections, so you can go straight into the first real operator workflow."
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
        <AdminActiveFilters filters={activeFilterChips} />
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
          hint="This starter already includes URL search-param sync, filter chips, and optional secondary shells so you can go straight into the first real workflow."
          onReset={() => setQuery("")}
          resetDisabled={!query}
          resetTestId="${SURFACE_SLUG}-clear-filters"
        />
      </article>
${saved_views_section}
${audit_section}
${export_section}

      <AdminDisclosureSection
        title="Next integration steps"
        subtitle="The generator created the frontend page, backend route, service stub, typed schema, and API flow test."
        badge="Scaffold"
        defaultOpen
        testId="${SURFACE_SLUG}-next-steps"
      >
        <ol className="formHint">
          <li>Replace the static queue with the first real backend payload.</li>
          <li>Keep only the filters and secondary sections that support one concrete admin workflow.</li>
          <li>Wire one real action end to end before adding more controls.</li>
        </ol>
      </AdminDisclosureSection>
    </main>
  );
}

export default function ${PASCAL_NAME}Page() {
  return (
    <Suspense fallback={<main className="workspaceShell"><div className="card formCard">Loading...</div></main>}>
      <${PASCAL_NAME}PageContent />
    </Suspense>
  );
}
EOF
)"

safe_write "$backend_service_path" "$(cat <<EOF
def list_${PY_SLUG}_items(query: str = "") -> dict:
    normalized_query = query.strip().lower()
    items = [
        {
            "id": "${SURFACE_SLUG}-sample-1",
            "label": "Primary review queue",
            "status": "needs-review",
            "note": "Replace this with the first real review slice for ${SURFACE_NAME}.",
        },
        {
            "id": "${SURFACE_SLUG}-sample-2",
            "label": "Follow-up backlog",
            "status": "ready",
            "note": "Keep only the actions and fields that support an actual admin decision.",
        },
    ]
    if normalized_query:
        items = [
            item
            for item in items
            if normalized_query in item["label"].lower()
            or normalized_query in item["status"].lower()
            or normalized_query in item["note"].lower()
        ]

    return {
        "items": items,
        "summary": {
            "surface": "${SURFACE_SLUG}",
            "total": len(items),
            "query": query,
            "next_step": "Replace stub data with the first real repository-backed workflow.",
        },
    }
EOF
)"

safe_write "$backend_route_path" "$(cat <<EOF
from fastapi import APIRouter, Depends, Query

from app.services.auth import require_admin
from app.schemas import ${PASCAL_NAME}ListResponse
from app.services.${PY_SLUG} import list_${PY_SLUG}_items


router = APIRouter(dependencies=[Depends(require_admin)])


@router.get("${API_PREFIX}", response_model=${PASCAL_NAME}ListResponse)
def get_${PY_SLUG}(q: str = Query(default="")) -> ${PASCAL_NAME}ListResponse:
    return ${PASCAL_NAME}ListResponse(**list_${PY_SLUG}_items(query=q))
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
        return self._list_items_for_query("")

    def _list_items_for_query(self, query):
        return {
            "items": [
                {
                    "id": "${SURFACE_SLUG}-sample-1",
                    "label": "Primary review queue",
                    "status": "needs-review",
                    "note": "Replace this with the first real review slice for ${SURFACE_NAME}.",
                }
            ]
            if not query
            else [
                {
                    "id": "${SURFACE_SLUG}-sample-2",
                    "label": "Follow-up backlog",
                    "status": "ready",
                    "note": "Keep only the actions and fields that support an actual admin decision.",
                }
            ],
            "summary": {
                "surface": "${SURFACE_SLUG}",
                "total": 1,
                "query": query,
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
        self.assertEqual(payload["summary"]["query"], "")

    def test_${PY_SLUG}_query_filter_flow(self):
        with patch(
            "app.routes.${PY_SLUG}.list_${PY_SLUG}_items",
            side_effect=lambda query="": self._list_items_for_query(query),
        ):
            response = self.client.get("${API_PREFIX}?q=follow")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["summary"]["query"], "follow")
        self.assertEqual(payload["items"][0]["label"], "Follow-up backlog")


if __name__ == "__main__":
    unittest.main()
EOF
)"

if [ -f "$backend_schemas_path" ] && ! grep -q "class ${PASCAL_NAME}ListResponse" "$backend_schemas_path"; then
  cat >>"$backend_schemas_path" <<EOF


class ${PASCAL_NAME}Item(BaseModel):
    id: str
    label: str
    status: str
    note: Optional[str] = None


class ${PASCAL_NAME}Summary(BaseModel):
    surface: str
    total: int = 0
    query: str = ""
    next_step: str


class ${PASCAL_NAME}ListResponse(BaseModel):
    items: list[${PASCAL_NAME}Item] = Field(default_factory=list)
    summary: ${PASCAL_NAME}Summary
EOF
fi

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
[scaffold-deploymate-surface] frontend options:
  - saved views: $WITH_SAVED_VIEWS
  - audit: $WITH_AUDIT
  - export: $WITH_EXPORT
[scaffold-deploymate-surface] created:
  - ${frontend_page_path#$TARGET_DIR/}
  - ${backend_route_path#$TARGET_DIR/}
  - ${backend_service_path#$TARGET_DIR/}
  - ${backend_test_path#$TARGET_DIR/}
[scaffold-deploymate-surface] updated:
  - ${backend_main_path#$TARGET_DIR/}
  - ${backend_schemas_path#$TARGET_DIR/}
[scaffold-deploymate-surface] next useful steps:
  - replace the sample queue with a real backend payload
  - trim secondary sections that do not help the first real workflow
  - wire one real action before adding more controls
  - run make backend
  - run make frontend-hot
  - open a PR once the first real slice works end to end
EOF
