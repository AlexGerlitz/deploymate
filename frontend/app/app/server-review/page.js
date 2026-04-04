"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  AdminActiveFilters,
  AdminAuditToolbar,
  AdminDisclosureSection,
  AdminFeedbackBanners,
  AdminFilterFooter,
  AdminPageHeader,
  AdminSavedViews,
  AdminSurfaceActionStarter,
  AdminSurfaceBulkStarter,
  AdminSurfaceMutationPreview,
  AdminSurfaceQueue,
  AdminSurfaceQueueCard,
  AdminSurfaceSummary,
  AdminSurfaceTable,
} from "../admin-ui";
import { formatSavedViews } from "../../lib/admin-saved-views";
import { useAdminSavedViewsManager } from "../../lib/admin-page-hooks";
import {
  applyFilterDefinitions,
  buildFilterChipsFromDefinitions,
  buildFilterState,
  copyTextToClipboard,
  createChoiceFilterDefinition,
  createTextFilterDefinition,
  sortItemsByDateMode,
  triggerFileDownload,
} from "../../lib/admin-page-utils";
import {
  bulkStatusOptions,
  segmentFilterOptions,
  starterMetrics,
  starterRuntimeMode,
  starterTableColumns,
  starterStrings,
} from "./starter-data";
import { buildStarterMutationPreview, buildStarterSummaryMetrics } from "./starter-actions";
import {
  createServerReviewServer,
  deleteServerReviewServer,
  fetchServerReviewStarterList,
  fetchServerReviewSuggestedPorts,
  runServerReviewStarterAction,
  updateServerReviewServer,
} from "./starter-api";
import { formatDate } from "../../lib/runtime-workspace-utils";

const savedViewsStorageKey = "deploymate.admin.server-review.savedViews";

function formatSavedServerViews(items) {
  return formatSavedViews(items, {
    formatDate,
    summarizeFilters: (filters) =>
      [
        filters.q ? `search ${filters.q}` : null,
        filters.segment && filters.segment !== "all" ? `focus ${filters.segment}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
  });
}

function buildServerMeta(server, diagnostics, suggestedPorts) {
  const target = `${server.username}@${server.host}:${server.port}`;
  const authLabel = server.auth_type === "ssh_key" ? "SSH key auth" : "Auth review";
  const portsLabel =
    Array.isArray(suggestedPorts) && suggestedPorts.length > 0
      ? `suggested ${suggestedPorts.join(", ")}`
      : "ports pending";
  const deploymentLabel =
    typeof diagnostics?.deployment_count === "number"
      ? `${diagnostics.deployment_count} deployment${diagnostics.deployment_count === 1 ? "" : "s"}`
      : "deployment count pending";

  return `${target} · ${authLabel} · ${deploymentLabel} · ${portsLabel}`;
}

function buildServerNote(server, testResult, diagnostics) {
  if (diagnostics) {
    const details = [
      diagnostics.hostname || diagnostics.target,
      diagnostics.operating_system || "OS pending",
      diagnostics.docker_version || "Docker version pending",
      Array.isArray(diagnostics.listening_ports) && diagnostics.listening_ports.length > 0
        ? `listening ${diagnostics.listening_ports.join(", ")}`
        : "listening ports pending",
    ];
    return details.filter(Boolean).join(" · ");
  }

  if (testResult?.message) {
    return testResult.message;
  }

  if (server.auth_type !== "ssh_key") {
    return "Server still needs auth review before diagnostics can be trusted.";
  }

  return "Run connection test or diagnostics to confirm server readiness before the next rollout.";
}

function buildServerSegment(server, testResult, diagnostics) {
  if (server.auth_type !== "ssh_key") {
    return "auth";
  }

  if (diagnostics?.overall_status === "ok") {
    return "ready";
  }

  if (testResult?.status === "success") {
    return "ready";
  }

  return "diagnostics";
}

function buildServerStatus(server, testResult, diagnostics) {
  if (diagnostics?.overall_status) {
    return diagnostics.overall_status;
  }

  if (testResult?.status === "success") {
    return "reachable";
  }

  if (testResult?.status === "error") {
    return "needs-check";
  }

  return server.auth_type === "ssh_key" ? "needs-check" : "auth-review";
}

function mapServerToItem(server, runtimeState) {
  const testResult = runtimeState.testResults[server.id] || null;
  const diagnostics = runtimeState.diagnostics[server.id] || null;
  const suggestedPorts = runtimeState.suggestedPorts[server.id] || [];

  return {
    id: server.id,
    label: server.name,
    status: buildServerStatus(server, testResult, diagnostics),
    segment: buildServerSegment(server, testResult, diagnostics),
    meta: buildServerMeta(server, diagnostics, suggestedPorts),
    note: buildServerNote(server, testResult, diagnostics),
    server,
    testResult,
    diagnostics,
    suggestedPorts,
  };
}

function buildAuditEntry({ id, label, scope, detail }) {
  return {
    id,
    label,
    scope,
    detail,
    created_at: new Date().toISOString(),
  };
}

function appendAuditEntry(currentItems, nextItem) {
  return [nextItem, ...currentItems].slice(0, 20);
}

function scrollToElement(sectionId) {
  if (typeof document === "undefined") {
    return;
  }

  const element = document.getElementById(sectionId);
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function ServerReviewPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("Real server review surface is ready. Refresh loads live server targets.");
  const [servers, setServers] = useState([]);
  const [serverTestResults, setServerTestResults] = useState({});
  const [serverDiagnostics, setServerDiagnostics] = useState({});
  const [serverSuggestedPorts, setServerSuggestedPorts] = useState({});
  const [auditItems, setAuditItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [actionNote, setActionNote] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [bulkStatusValue, setBulkStatusValue] = useState(() => bulkStatusOptions[0]?.value || "");
  const [loading, setLoading] = useState(false);
  const [serverSubmitting, setServerSubmitting] = useState(false);
  const [serverUpdating, setServerUpdating] = useState(false);
  const [deletingServerId, setDeletingServerId] = useState("");
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [segmentFilter, setSegmentFilter] = useState(() => searchParams.get("segment") || "all");
  const [auditQuery, setAuditQuery] = useState(() => searchParams.get("audit_q") || "");
  const [auditScope, setAuditScope] = useState(() => searchParams.get("audit_scope") || "all");
  const [auditSort, setAuditSort] = useState(() => searchParams.get("audit_sort") || "newest");
  const [serverForm, setServerForm] = useState({
    name: "",
    host: "",
    port: "22",
    username: "",
    ssh_key: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    host: "",
    port: "22",
    username: "",
    ssh_key: "",
  });

  const primaryFilterDefinitions = [
    createTextFilterDefinition({
      key: "q",
      value: query,
      setValue: setQuery,
      chipKey: "server-review-query",
      chipLabel: `Search: ${query.trim()}`,
      testId: "server-review-filter-chip-query",
    }),
    createChoiceFilterDefinition({
      key: "segment",
      value: segmentFilter,
      setValue: setSegmentFilter,
      chipKey: "server-review-segment",
      chipLabel: `Focus: ${segmentFilter}`,
      testId: "server-review-filter-chip-segment",
    }),
  ];
  const { currentFilters, hasActiveFilters, syncedSearchParams } = buildFilterState(primaryFilterDefinitions);
  const activeFilterChips = buildFilterChipsFromDefinitions(primaryFilterDefinitions);

  const auditFilterDefinitions = [
    createTextFilterDefinition({
      key: "audit_q",
      value: auditQuery,
      setValue: setAuditQuery,
      chipKey: "server-review-audit-query",
      chipLabel: `Audit: ${auditQuery.trim()}`,
      testId: "server-review-audit-chip-query",
    }),
    createChoiceFilterDefinition({
      key: "audit_scope",
      value: auditScope,
      setValue: setAuditScope,
      chipKey: "server-review-audit-scope",
      chipLabel: `Scope: ${auditScope}`,
      testId: "server-review-audit-chip-scope",
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
  const activeAuditFilterChips = buildFilterChipsFromDefinitions(auditFilterDefinitions);

  const runtimeState = useMemo(
    () => ({
      testResults: serverTestResults,
      diagnostics: serverDiagnostics,
      suggestedPorts: serverSuggestedPorts,
    }),
    [serverDiagnostics, serverSuggestedPorts, serverTestResults],
  );

  const items = useMemo(
    () => servers.map((server) => mapServerToItem(server, runtimeState)),
    [runtimeState, servers],
  );

  const filteredItems = useMemo(() => {
    const normalized = currentFilters.q.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery =
        !normalized ||
        [
          item.label,
          item.status,
          item.note,
          item.meta,
          item.segment,
          item.server.host,
          item.server.username,
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalized));
      const matchesSegment =
        currentFilters.segment === "all" || item.segment === currentFilters.segment;
      return matchesQuery && matchesSegment;
    });
  }, [currentFilters.q, currentFilters.segment, items]);

  const summaryMetrics = useMemo(() => {
    const segmentSummary = buildStarterSummaryMetrics(filteredItems);
    if (!segmentSummary) {
      return starterMetrics;
    }

    return [
      {
        label: "Live queue",
        value: segmentSummary,
        description: "This view now reflects real server targets and their latest review state.",
      },
      ...starterMetrics.slice(1),
    ];
  }, [filteredItems]);

  const selectedItem =
    filteredItems.find((item) => item.id === selectedItemId) ||
    items.find((item) => item.id === selectedItemId) ||
    filteredItems[0] ||
    items[0] ||
    null;

  useEffect(() => {
    if (!selectedItem) {
      setEditForm({
        name: "",
        host: "",
        port: "22",
        username: "",
        ssh_key: "",
      });
      return;
    }

    setEditForm({
      name: selectedItem.server.name || "",
      host: selectedItem.server.host || "",
      port: String(selectedItem.server.port || 22),
      username: selectedItem.server.username || "",
      ssh_key: "",
    });
  }, [selectedItemId, selectedItem]);

  const selectedItems = items.filter((item) => selectedItemIds.includes(item.id));
  const starterMutationPreview = buildStarterMutationPreview(selectedItem, actionNote);
  const hasServers = servers.length > 0;
  const topPriorityTitle = hasServers ? "Review one saved server first" : "Add your first server target";
  const topPriorityBody = hasServers
    ? "Pick one saved server, test the connection or run diagnostics, and only then open editing, exports, or deeper review tools."
    : "Fill in one SSH target first so this workspace can tell you whether the server is reachable and ready for rollout work.";

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

  const visibleTableRows = useMemo(
    () =>
      filteredItems.map((item) => ({
        ...item,
        status: item.id === selectedItemId ? `${item.status} · focused` : item.status,
      })),
    [filteredItems, selectedItemId],
  );

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
    initialViews: formatSavedServerViews([
      {
        id: "server-review-saved-view-1",
        name: "Diagnostics queue",
        filters: { segment: "diagnostics" },
        updatedAt: "2026-04-04T00:00:00.000Z",
        source: "local",
      },
    ]),
    formatViews: formatSavedServerViews,
    storageKey: savedViewsStorageKey,
    currentFilters,
    hasFilters: hasActiveFilters,
    applyViewFilters: (filters) => applyFilterDefinitions(primaryFilterDefinitions, filters),
    pathname,
    copyText: copyTextToClipboard,
    setFeedback: setSuccess,
    setError,
    initialMetaText: "Using local browser storage.",
    exportFilename: "deploymate-server-review-saved-views.json",
    exportScope: "server-review",
    summaryNoun: "server review",
    emptyImportMessage: "No valid saved views found in this file.",
    wrongScopeMessage: "This file is not a Server Review saved views export.",
    saveSuccessMessage: "Saved current server review view.",
    updateSuccessMessage: "Current server review view updated.",
    deleteSuccessMessage: "Saved server review view removed.",
    exportSuccessMessage: "Saved server review views exported.",
    clearSuccessMessage: "Saved server review views cleared.",
    clearImportedSuccessMessage: "Imported server review views removed.",
    resetToolsSuccessMessage: "Saved server review tools reset.",
    importMergeMessage: ({ total, replacedCount, skippedCount }) =>
      `Saved server review views merged. Total: ${total}. Replaced: ${replacedCount}. Skipped by limit: ${skippedCount}.`,
  });

  async function loadServers(silent = false) {
    if (!silent) {
      setLoading(true);
      setError("");
    }

    try {
      const data = await fetchServerReviewStarterList();
      const nextServers = Array.isArray(data) ? data : [];
      setServers(nextServers);

      if (nextServers[0] && !selectedItemId) {
        setSelectedItemId(nextServers[0].id);
        setSelectedItemIds([nextServers[0].id]);
      }

      setAuditItems((currentItems) =>
        currentItems.length > 0
          ? currentItems
          : appendAuditEntry(
              currentItems,
              buildAuditEntry({
                id: "server-review-audit-loaded",
                label: "Server review loaded",
                scope: "queue",
                detail: `Loaded ${nextServers.length} server target${nextServers.length === 1 ? "" : "s"} from the live /servers API.`,
              }),
            ),
      );
      setSuccess(`Loaded ${nextServers.length} live server target${nextServers.length === 1 ? "" : "s"}.`);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }
      setError(
        requestError instanceof Error ? requestError.message : "Failed to load server review data.",
      );
      if (!silent) {
        setServers([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  async function enrichServerRuntime(serverId, actionKind) {
    const [actionResult, portsResult] = await Promise.all([
      runServerReviewStarterAction(serverId, {
        action: actionKind,
        note: actionNote.trim(),
      }),
      fetchServerReviewSuggestedPorts(serverId).catch(() => ({ ports: [] })),
    ]);

    const suggestedPorts = Array.isArray(portsResult?.ports) ? portsResult.ports : [];
    setServerSuggestedPorts((current) => ({
      ...current,
      [serverId]: suggestedPorts,
    }));

    if (actionKind === "primary" && actionResult?.server_id) {
      setServerDiagnostics((current) => ({
        ...current,
        [serverId]: actionResult,
      }));
      setAuditItems((currentItems) =>
        appendAuditEntry(
          currentItems,
          buildAuditEntry({
            id: `server-review-diagnostics-${serverId}-${Date.now()}`,
            label: "Diagnostics captured",
            scope: "queue",
            detail: `${actionResult.target} · ${actionResult.overall_status} · suggested ports ${suggestedPorts.join(", ") || "pending"}`,
          }),
        ),
      );
      return {
        successMessage: `Diagnostics loaded for ${actionResult.target}.`,
      };
    }

    setServerTestResults((current) => ({
      ...current,
      [serverId]: actionResult,
    }));
    setAuditItems((currentItems) =>
      appendAuditEntry(
        currentItems,
        buildAuditEntry({
          id: `server-review-test-${serverId}-${Date.now()}`,
          label: "Connection tested",
          scope: "queue",
          detail: `${actionResult.target || serverId} · ${actionResult.status} · ${actionResult.message}`,
        }),
      ),
    );
    return {
      successMessage: `Connection test finished: ${actionResult.message}`,
    };
  }

  function updateServerFormField(event) {
    const { name, value } = event.target;
    setServerForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function updateEditFormField(event) {
    const { name, value } = event.target;
    setEditForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function handleSelectItem(itemId) {
    setSelectedItemId(itemId);
    setSelectedItemIds((currentIds) => (currentIds.includes(itemId) ? currentIds : [...currentIds, itemId]));
    setSuccess("Focused the server action panel on the selected target.");
    setError("");
  }

  function handleToggleSelection(itemId) {
    setSelectedItemIds((currentIds) =>
      currentIds.includes(itemId)
        ? currentIds.filter((currentId) => currentId !== itemId)
        : [...currentIds, itemId],
    );
    setSelectedItemId(itemId);
    setSuccess("Updated bulk server selection.");
    setError("");
  }

  function handleApplyBulkPreset(segment) {
    const nextIds = filteredItems.filter((item) => item.segment === segment).map((item) => item.id);
    setSelectedItemIds(nextIds);
    if (nextIds[0]) {
      setSelectedItemId(nextIds[0]);
    }
    setSuccess(`Selected ${nextIds.length} server target${nextIds.length === 1 ? "" : "s"} for ${segment}.`);
    setError("");
  }

  async function handleCreateServer(event) {
    event.preventDefault();
    setServerSubmitting(true);
    setError("");

    try {
      const createdServer = await createServerReviewServer({
        name: serverForm.name,
        host: serverForm.host,
        port: Number(serverForm.port || 22),
        username: serverForm.username,
        auth_type: "ssh_key",
        ssh_key: serverForm.ssh_key,
      });
      setServerForm({
        name: "",
        host: "",
        port: "22",
        username: "",
        ssh_key: "",
      });
      await loadServers(true);
      setSelectedItemId(createdServer.id);
      setSelectedItemIds([createdServer.id]);
      setAuditItems((currentItems) =>
        appendAuditEntry(
          currentItems,
          buildAuditEntry({
            id: `server-review-create-${createdServer.id}`,
            label: "Server target created",
            scope: "queue",
            detail: `${createdServer.username}@${createdServer.host}:${createdServer.port} added to server review.`,
          }),
        ),
      );
      setSuccess(`Server target "${createdServer.name}" created.`);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }
      setError(requestError instanceof Error ? requestError.message : "Failed to create server.");
      setSuccess("");
    } finally {
      setServerSubmitting(false);
    }
  }

  async function handleDeleteServer(serverId) {
    const server = servers.find((item) => item.id === serverId);
    const confirmed = window.confirm(
      `Delete server "${server?.name || serverId}"? This is blocked if deployments still use it.`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingServerId(serverId);
    setError("");
    try {
      await deleteServerReviewServer(serverId);
      setServers((currentServers) => currentServers.filter((item) => item.id !== serverId));
      setServerTestResults((current) => {
        const next = { ...current };
        delete next[serverId];
        return next;
      });
      setServerDiagnostics((current) => {
        const next = { ...current };
        delete next[serverId];
        return next;
      });
      setServerSuggestedPorts((current) => {
        const next = { ...current };
        delete next[serverId];
        return next;
      });
      setSelectedItemIds((currentIds) => currentIds.filter((itemId) => itemId !== serverId));
      setSelectedItemId((currentId) => (currentId === serverId ? "" : currentId));
      setAuditItems((currentItems) =>
        appendAuditEntry(
          currentItems,
          buildAuditEntry({
            id: `server-review-delete-${serverId}-${Date.now()}`,
            label: "Server target deleted",
            scope: "queue",
            detail: `${server?.name || serverId} removed from server review.`,
          }),
        ),
      );
      setSuccess(`Server target "${server?.name || serverId}" deleted.`);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }
      setError(requestError instanceof Error ? requestError.message : "Failed to delete server.");
      setSuccess("");
    } finally {
      setDeletingServerId("");
    }
  }

  async function handleUpdateServer(event) {
    event.preventDefault();
    if (!selectedItem) {
      setError("Choose a server before saving edits.");
      setSuccess("");
      return;
    }

    setServerUpdating(true);
    setError("");
    try {
      const updatedServer = await updateServerReviewServer(selectedItem.id, {
        name: editForm.name,
        host: editForm.host,
        port: Number(editForm.port || 22),
        username: editForm.username,
        auth_type: "ssh_key",
        ssh_key: editForm.ssh_key,
      });
      setServers((currentServers) =>
        currentServers.map((server) => (server.id === selectedItem.id ? updatedServer : server)),
      );
      setAuditItems((currentItems) =>
        appendAuditEntry(
          currentItems,
          buildAuditEntry({
            id: `server-review-update-${selectedItem.id}-${Date.now()}`,
            label: "Server target updated",
            scope: "queue",
            detail: `${updatedServer.username}@${updatedServer.host}:${updatedServer.port} saved from the review editor.`,
          }),
        ),
      );
      setSuccess(`Server target "${updatedServer.name}" updated.`);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }
      setError(requestError instanceof Error ? requestError.message : "Failed to update server.");
      setSuccess("");
    } finally {
      setServerUpdating(false);
    }
  }

  async function handleRunStarterAction(actionKind, itemId = selectedItem?.id || "") {
    if (!itemId) {
      setError("Choose a server before running the review action.");
      setSuccess("");
      return;
    }

    setActionLoadingId(itemId);
    setError("");
    try {
      const { successMessage } = await enrichServerRuntime(itemId, actionKind);
      setSelectedItemId(itemId);
      setActionNote("");
      setSuccess(successMessage);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }
      setError(
        requestError instanceof Error ? requestError.message : "Failed to run server review action.",
      );
      setSuccess("");
    } finally {
      setActionLoadingId("");
    }
  }

  function handleApplyBulkAction() {
    if (!selectedItemIds.length || !bulkStatusValue) {
      setError("Select at least one server and a follow-up state before applying the local bulk review label.");
      setSuccess("");
      return;
    }

    setServerTestResults((currentResults) => {
      const nextResults = { ...currentResults };
      for (const serverId of selectedItemIds) {
        const currentResult = nextResults[serverId] || {};
        nextResults[serverId] = {
          ...currentResult,
          status: bulkStatusValue === "ssh_ready" ? "success" : "error",
          message: `Bulk follow-up label applied: ${bulkStatusValue}.`,
          target: currentResult.target || serverId,
        };
      }
      return nextResults;
    });

    setAuditItems((currentItems) =>
      appendAuditEntry(
        currentItems,
        buildAuditEntry({
          id: `server-review-bulk-${Date.now()}`,
          label: "Bulk follow-up applied",
          scope: "bulk",
          detail: `${selectedItemIds.length} server target${selectedItemIds.length === 1 ? "" : "s"} marked ${bulkStatusValue}.`,
        }),
      ),
    );
    setSuccess(`Bulk follow-up label applied to ${selectedItemIds.length} server target${selectedItemIds.length === 1 ? "" : "s"}.`);
    setError("");
  }

  function handleExportJson() {
    const payload = {
      surface: "server-review",
      generated_at: new Date().toISOString(),
      filters: currentFilters,
      items: filteredItems,
      audit: visibleAuditItems,
    };
    triggerFileDownload(
      "deploymate-server-review.json",
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      }),
    );
    setSuccess("Server review JSON export generated.");
    setError("");
  }

  function handleExportCsv() {
    const rows = [
      ["id", "server", "status", "focus", "context", "note"],
      ...filteredItems.map((item) => [item.id, item.label, item.status, item.segment, item.meta, item.note]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => String(value ?? "").replaceAll("\"", "\"\""))
          .map((value) => `"${value}"`)
          .join(","),
      )
      .join("\n");
    triggerFileDownload(
      "deploymate-server-review.csv",
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    setSuccess("Server review CSV export generated.");
    setError("");
  }

  useEffect(() => {
    loadServers();
  }, []);

  useEffect(() => {
    const nextQuery = searchParams.get("q") || "";
    if (nextQuery !== query) {
      setQuery(nextQuery);
    }
    const nextSegment = searchParams.get("segment") || "all";
    if (nextSegment !== segmentFilter) {
      setSegmentFilter(nextSegment);
    }
  }, [query, searchParams, segmentFilter]);

  useEffect(() => {
    const currentSearch = searchParams.toString();
    if (currentSearch === syncedSearchParams) {
      return;
    }
    router.replace(syncedSearchParams ? `${pathname}?${syncedSearchParams}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams, syncedSearchParams]);

  return (
    <main className="workspaceShell">
      <AdminPageHeader
        title="Server Review"
        titleTestId="server-review-page-title"
        subtitle="Review saved server targets, confirm connectivity, and keep diagnostics close before the next rollout."
        loading={loading}
        onRefresh={() => loadServers()}
        refreshTestId="server-review-refresh"
        primaryAction={{
          label: "Add server target",
          testId: "server-review-primary-action-button",
          onClick: () => scrollToElement("server-review-create-server-section"),
          disabled: false,
        }}
        actions={[
          {
            label: "Export JSON",
            testId: "server-review-header-export-json",
            onClick: handleExportJson,
          },
        ]}
      />

      <AdminFeedbackBanners
        smokeMode={starterRuntimeMode !== "api"}
        error={error}
        success={success}
        errorTestId="server-review-error"
        successTestId="server-review-success"
      />

      <AdminSurfaceSummary
        title={starterStrings.summaryTitle}
        description={starterStrings.summaryDescription}
        metrics={summaryMetrics}
        spotlightTitle="Live server review"
        spotlightBody={starterStrings.spotlightBody}
      />

      <article className="card formCard" data-testid="server-review-first-step">
        <div className="sectionHeader">
          <div>
            <h2>{topPriorityTitle}</h2>
            <p>{topPriorityBody}</p>
          </div>
        </div>
        <div className="overviewGrid" data-testid="server-review-first-step-grid">
          <article className="overviewCard">
            <span>Do this now</span>
            <strong>{hasServers ? "Focus one server and remove uncertainty" : "Create one SSH server target"}</strong>
            <div className="overviewMeta">
              <span>
                {hasServers
                  ? "Use the live queue below, run one connection test or diagnostics pass, and avoid jumping into exports or bulk review first."
                  : "Name, host, port, username, and SSH key are enough to begin. Everything else can wait until the first target is saved."}
              </span>
            </div>
            <div className="adminFilterActions">
              <button
                type="button"
                className="primaryButton"
                data-testid="server-review-first-step-action"
                onClick={() =>
                  scrollToElement(hasServers ? "server-review-live-queue" : "server-review-create-server-section")
                }
              >
                {hasServers ? "Open live server queue" : "Jump to add server form"}
              </button>
            </div>
          </article>
          <article className="overviewCard">
            <span>Later</span>
            <strong>Use deeper review tools only after one server is clear</strong>
            <div className="overviewMeta">
              <span>
                Edit, table comparison, saved views, exports, and activity are still here, but they should not compete with the first server action.
              </span>
            </div>
          </article>
        </div>
      </article>

      <AdminDisclosureSection
        title="Add server target"
        subtitle="Add one SSH target here so DeployMate can test it and show whether it is ready for rollout work."
        badge={hasServers ? "Create another" : "Start here"}
        defaultOpen={servers.length === 0}
        sectionId="server-review-create-server-section"
        testId="server-review-create-server"
      >
        <form className="form" onSubmit={handleCreateServer}>
          <label className="field">
            <span>Name</span>
            <input
              name="name"
              value={serverForm.name}
              onChange={updateServerFormField}
              placeholder="prod-vps"
              disabled={serverSubmitting}
              required
              data-testid="server-review-create-name"
            />
          </label>
          <label className="field">
            <span>Host</span>
            <input
              name="host"
              value={serverForm.host}
              onChange={updateServerFormField}
              placeholder="203.0.113.10"
              disabled={serverSubmitting}
              required
              data-testid="server-review-create-host"
            />
          </label>
          <label className="field">
            <span>Port</span>
            <input
              name="port"
              type="number"
              min="1"
              max="65535"
              value={serverForm.port}
              onChange={updateServerFormField}
              disabled={serverSubmitting}
              required
              data-testid="server-review-create-port"
            />
          </label>
          <label className="field">
            <span>Username</span>
            <input
              name="username"
              value={serverForm.username}
              onChange={updateServerFormField}
              placeholder="deploy"
              disabled={serverSubmitting}
              required
              data-testid="server-review-create-username"
            />
          </label>
          <label className="field">
            <span>SSH key</span>
            <textarea
              name="ssh_key"
              rows={6}
              value={serverForm.ssh_key}
              onChange={updateServerFormField}
	              placeholder="Paste your SSH private key content here"
              disabled={serverSubmitting}
              required
              data-testid="server-review-create-ssh-key"
            />
          </label>
          <div className="formActions">
            <button
              type="submit"
              disabled={serverSubmitting}
              data-testid="server-review-create-submit"
            >
              {serverSubmitting ? "Adding..." : "Add server"}
            </button>
          </div>
        </form>
      </AdminDisclosureSection>

      <AdminDisclosureSection
        title="Edit selected server"
        subtitle="Use this only after one server is already understood and you know exactly what needs to change."
        badge={selectedItem ? "Edit" : "Pick one"}
        defaultOpen={false}
        testId="server-review-edit-server"
      >
        {selectedItem ? (
          <form className="form" onSubmit={handleUpdateServer}>
            <label className="field">
              <span>Name</span>
              <input
                name="name"
                value={editForm.name}
                onChange={updateEditFormField}
                disabled={serverUpdating}
                required
                data-testid="server-review-edit-name"
              />
            </label>
            <label className="field">
              <span>Host</span>
              <input
                name="host"
                value={editForm.host}
                onChange={updateEditFormField}
                disabled={serverUpdating}
                required
                data-testid="server-review-edit-host"
              />
            </label>
            <label className="field">
              <span>Port</span>
              <input
                name="port"
                type="number"
                min="1"
                max="65535"
                value={editForm.port}
                onChange={updateEditFormField}
                disabled={serverUpdating}
                required
                data-testid="server-review-edit-port"
              />
            </label>
            <label className="field">
              <span>Username</span>
              <input
                name="username"
                value={editForm.username}
                onChange={updateEditFormField}
                disabled={serverUpdating}
                required
                data-testid="server-review-edit-username"
              />
            </label>
            <label className="field">
              <span>SSH key</span>
              <textarea
                name="ssh_key"
                rows={6}
                value={editForm.ssh_key}
                onChange={updateEditFormField}
                placeholder="Leave empty to keep the current key, or paste a replacement private key."
                disabled={serverUpdating}
                data-testid="server-review-edit-ssh-key"
              />
            </label>
            <div className="formActions">
              <button
                type="submit"
                disabled={serverUpdating}
                data-testid="server-review-edit-submit"
              >
                {serverUpdating ? "Saving..." : "Save server changes"}
              </button>
            </div>
          </form>
        ) : (
          <div className="empty">Pick a server from the queue or table to edit it here.</div>
        )}
      </AdminDisclosureSection>

      <div id="server-review-live-queue">
        <AdminSurfaceQueue
          title={starterStrings.queueTitle}
          description={starterStrings.queueDescription}
          searchLabel="Search server targets"
          searchValue={query}
          onSearchChange={(event) => setQuery(event.target.value)}
          searchPlaceholder={starterStrings.searchPlaceholder}
          searchTestId="server-review-search"
          emptyTestId="server-review-empty"
          emptyText="No server targets match the current review filters."
          items={filteredItems}
        >
        <AdminActiveFilters filters={activeFilterChips} />
        <label className="field">
          <span>{starterStrings.segmentFilterLabel}</span>
          <select
            data-testid="server-review-segment-filter"
            value={segmentFilter}
            onChange={(event) => setSegmentFilter(event.target.value)}
          >
            {segmentFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {filteredItems.map((item) => (
          <AdminSurfaceQueueCard
            key={item.id}
            title={item.label}
            body={item.note}
            status={item.id === selectedItemId ? `${item.status} · focused` : item.status}
          >
            <p className="formHint">
              <strong>{starterStrings.cardMetaLabel}:</strong> {item.meta}
            </p>
            <p className="formHint">
              <strong>{starterStrings.segmentFilterLabel}:</strong> {item.segment}
            </p>
            <div className="adminFilterActions">
              <button
                type="button"
                className="secondaryButton"
                data-testid={`${item.id}-select`}
                onClick={() => handleToggleSelection(item.id)}
              >
                {selectedItemIds.includes(item.id) ? "Selected" : "Select item"}
              </button>
              <button
                type="button"
                className="secondaryButton"
                data-testid={`${item.id}-focus`}
                onClick={() => handleSelectItem(item.id)}
              >
                {item.id === selectedItemId ? "Focused" : "Focus item"}
              </button>
              <button
                type="button"
                className="secondaryButton"
                data-testid={`${item.id}-primary-action`}
                onClick={() => handleRunStarterAction("primary", item.id)}
                disabled={actionLoadingId === item.id}
              >
                {starterStrings.primaryActionLabel}
              </button>
              <button
                type="button"
                className="secondaryButton"
                data-testid={`${item.id}-secondary-action`}
                onClick={() => handleRunStarterAction("secondary", item.id)}
                disabled={actionLoadingId === item.id}
              >
                {starterStrings.secondaryActionLabel}
              </button>
              <button
                type="button"
                className="dangerButton"
                data-testid={`${item.id}-delete`}
                onClick={() => handleDeleteServer(item.id)}
                disabled={deletingServerId === item.id}
              >
                {deletingServerId === item.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </AdminSurfaceQueueCard>
        ))}
        </AdminSurfaceQueue>
      </div>

      <AdminSurfaceActionStarter
        title={starterStrings.actionSectionTitle}
        description={`${starterStrings.actionSectionDescription} ${starterStrings.actionFocusHint}`}
        testId="server-review-action-starter"
        status={selectedItem?.status || ""}
        item={selectedItem}
        noteValue={actionNote}
        onNoteChange={(event) => setActionNote(event.target.value)}
        notePlaceholder={starterStrings.actionNotePlaceholder}
        primaryActionLabel={starterStrings.primaryActionLabel}
        secondaryActionLabel={starterStrings.secondaryActionLabel}
        onPrimaryAction={() => handleRunStarterAction("primary")}
        onSecondaryAction={() => handleRunStarterAction("secondary")}
        actionDisabled={selectedItem ? actionLoadingId === selectedItem.id : true}
        emptyText="No server target selected yet."
      />

      {selectedItem ? (
        <div className="adminFilterActions">
          <button
            type="button"
            className="dangerButton"
            data-testid="server-review-delete-selected"
            onClick={() => handleDeleteServer(selectedItem.id)}
            disabled={deletingServerId === selectedItem.id}
          >
            {deletingServerId === selectedItem.id ? "Deleting selected..." : "Delete selected server"}
          </button>
        </div>
      ) : null}

      <AdminDisclosureSection
        title="Advanced review tools"
        subtitle="Open this only after the first server decision is already clear."
        badge="Later"
        defaultOpen={false}
        testId="server-review-advanced-tools"
      >
        <AdminSurfaceTable
          title="Server review table"
          description="Use the denser table when you need to compare readiness, auth posture, and suggested next ports across multiple targets."
          columns={starterTableColumns}
          rows={visibleTableRows}
          rowKey={(row) => row.id}
          selectedRowId={selectedItemId}
          emptyText="No rows match the current search."
          emptyTestId="server-review-table-empty"
          tableTestId="server-review-table"
          renderCell={(row, column) => {
            if (column.key === "label") {
              return (
                <div className="adminSurfaceTablePrimary">
                  <strong>{row.label}</strong>
                  <p className="formHint">{row.note}</p>
                </div>
              );
            }
            return row[column.key];
          }}
          renderActions={(row) => (
            <>
              <button
                type="button"
                className="secondaryButton"
                data-testid={`${row.id}-table-select`}
                onClick={() => handleToggleSelection(row.id)}
              >
                {selectedItemIds.includes(row.id) ? "Selected" : "Select"}
              </button>
              <button
                type="button"
                className="secondaryButton"
                data-testid={`${row.id}-table-focus`}
                onClick={() => handleSelectItem(row.id)}
              >
                {row.id === selectedItemId ? "Focused" : "Focus"}
              </button>
              <button
                type="button"
                className="dangerButton"
                data-testid={`${row.id}-table-delete`}
                onClick={() => handleDeleteServer(row.id)}
                disabled={deletingServerId === row.id}
              >
                {deletingServerId === row.id ? "Deleting..." : "Delete"}
              </button>
            </>
          )}
        />

        <AdminSurfaceBulkStarter
          title={starterStrings.bulkSectionTitle}
          description={starterStrings.bulkSectionDescription}
          testId="server-review-bulk-starter"
          presetOneLabel={starterStrings.bulkPresetOneLabel}
          onPresetOne={() => handleApplyBulkPreset(starterStrings.bulkPresetOneSegment)}
          presetTwoLabel={starterStrings.bulkPresetTwoLabel}
          onPresetTwo={() => handleApplyBulkPreset(starterStrings.bulkPresetTwoSegment)}
          selectedCount={selectedItemIds.length}
          visibleCount={filteredItems.length}
          statusValue={bulkStatusValue}
          onStatusChange={(event) => setBulkStatusValue(event.target.value)}
          statusOptions={bulkStatusOptions}
          applyLabel={starterStrings.bulkApplyLabel}
          onApply={handleApplyBulkAction}
          applyDisabled={!selectedItemIds.length || !bulkStatusValue}
        />

        <AdminSurfaceMutationPreview
          description="This preview now reflects the live server review actions instead of a fake starter mutation."
          testId="server-review-mutation-starter"
          routeLabel={starterStrings.mutationRouteLabel}
          selectedSummary={selectedItems.map((item) => item.label).join(", ") || "Nothing selected"}
          payload={starterMutationPreview}
        />

        <article className="card formCard">
          <AdminFilterFooter
            summary="This surface now uses the live /servers API for review data, diagnostics, and connection checks."
            hint="Keep only the views and follow-up labels that support real operator review. Everything else should earn its place."
            onReset={() => {
              setQuery("");
              setSegmentFilter("all");
            }}
            resetDisabled={!query && segmentFilter === "all"}
            resetTestId="server-review-clear-filters"
          />
        </article>

        <AdminSavedViews
          title="Saved review views"
          inputLabel="View name"
          inputValue={savedViewName}
          onInputChange={(event) => setSavedViewName(event.target.value)}
          onSave={handleSaveCurrentView}
          onUpdateCurrent={handleUpdateCurrentView}
          saveDisabled={!canSaveCurrentView}
          updateDisabled={!activeSavedViewId}
          saveTestId="server-review-save-view"
          updateTestId="server-review-update-view"
          statusText={
            hasSavedViewNameMatch
              ? "A saved view with this name already exists and will be replaced."
              : "Save filters you want to revisit during daily infra review."
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
          searchTestId="server-review-saved-views-search"
          sourceFilter={savedViewsSourceFilter}
          onSourceFilterChange={(event) => setSavedViewsSourceFilter(event.target.value)}
          sourceFilterTestId="server-review-saved-views-source"
          sortValue={savedViewsSort}
          onSortChange={(event) => setSavedViewsSort(event.target.value)}
          sortTestId="server-review-saved-views-sort"
          actions={[
            {
              label: "Export views",
              testId: "server-review-saved-views-export",
              onClick: handleDownloadSavedViews,
              disabled: savedViews.length === 0,
            },
            {
              label: "Import views",
              kind: "file",
              testId: "server-review-saved-views-import",
              accept: "application/json",
              onChange: handleImportSavedViews,
            },
            {
              label: "Clear imported",
              testId: "server-review-saved-views-clear-imported",
              onClick: handleClearImportedSavedViews,
              disabled: savedViews.length === 0,
            },
            {
              label: "Clear all",
              testId: "server-review-saved-views-clear",
              onClick: handleClearSavedViews,
              disabled: savedViews.length === 0,
            },
            {
              label: "Reset tools",
              testId: "server-review-saved-views-reset-tools",
              onClick: handleResetSavedViewsTools,
            },
          ]}
          emptyText="No saved server review views yet."
          listTestId="server-review-saved-views-list"
          activeViewId={activeSavedViewId}
        />

        <AdminAuditToolbar
          title="Review activity"
          description="This local activity log records what the operator actually did on this page: refreshes, diagnostics, tests, and bulk follow-up labels."
          query={auditQuery}
          onQueryChange={(event) => setAuditQuery(event.target.value)}
          queryPlaceholder="Search server review activity"
          queryTestId="server-review-audit-search"
          filterLabel="Scope"
          filterValue={auditScope}
          onFilterChange={(event) => setAuditScope(event.target.value)}
          filterOptions={[
            { value: "all", label: "All activity" },
            { value: "queue", label: "Queue review" },
            { value: "bulk", label: "Bulk follow-up" },
          ]}
          filterTestId="server-review-audit-scope"
          sortValue={auditSort}
          onSortChange={(event) => setAuditSort(event.target.value)}
          sortTestId="server-review-audit-sort"
          totalCount={visibleAuditItems.length}
          summary="Use this log to explain what was reviewed and what changed during the current server review pass."
          filters={activeAuditFilterChips}
          emptyTestId="server-review-audit-empty"
          emptyText="No review activity recorded yet."
        >
          <div className="adminSavedViewsList" data-testid="server-review-audit-list">
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

        <AdminDisclosureSection
          title="Export and recovery"
          subtitle="JSON and CSV export stay close at hand for handoff, audit, or operator review."
          badge="Optional"
          testId="server-review-export-starter"
        >
          <div className="adminFilterActions">
            <button
              type="button"
              className="secondaryButton"
              data-testid="server-review-export-json"
              onClick={handleExportJson}
            >
              Export JSON
            </button>
            <button
              type="button"
              className="secondaryButton"
              data-testid="server-review-export-csv"
              onClick={handleExportCsv}
            >
              Export CSV
            </button>
          </div>
          <p className="formHint">
            The export reflects the live filtered queue and the current page activity log.
          </p>
        </AdminDisclosureSection>

        <AdminDisclosureSection
          title="What this proved"
          subtitle="This page started from the scaffold, then got wired into the real server API."
          badge="Real surface"
          defaultOpen={false}
          testId="server-review-next-steps"
        >
          <ol className="formHint">
            <li>The scaffold can now start a real server review page instead of only a local demo queue.</li>
            <li>Queue, table, saved views, export, and audit shell were reusable enough to survive contact with a real feature.</li>
            <li>The next useful follow-up is deciding whether this page should replace the server block on the main workspace.</li>
          </ol>
        </AdminDisclosureSection>
      </AdminDisclosureSection>
    </main>
  );
}

export default function ServerReviewPage() {
  return (
    <Suspense fallback={<main className="workspaceShell"><div className="card formCard">Loading...</div></main>}>
      <ServerReviewPageContent />
    </Suspense>
  );
}
