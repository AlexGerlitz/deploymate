"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  AdminActiveFilters,
  AdminAuditToolbar,
  AdminFeedbackBanners,
  AdminFilterFooter,
  AdminPageHeader,
  AdminSavedViews,
} from "../admin-ui";
import {
  smokeAdminUser as smokeUser,
  smokeMode,
  smokeUpgradeAuditEvents as smokeAuditEvents,
  smokeUpgradeAuditViews,
  smokeUpgradeOverview as smokeOverview,
  smokeUpgradeRequests as smokeRequests,
  smokeUpgradeSavedViews,
  smokeUpgradeUsers as smokeUsers,
} from "../../lib/admin-smoke-fixtures";
import {
  formatSavedViews,
} from "../../lib/admin-saved-views";
import {
  useAdminAuditViewsManager,
  useAdminSavedViewsManager,
  useDebouncedValue,
} from "../../lib/admin-page-hooks";
import {
  buildFilterChips,
  buildFilterChipsFromDefinitions,
  buildFilterState,
  buildAuditEventsCsv,
  copyTextToClipboard,
  createBooleanFilterDefinition,
  createChoiceFilterDefinition,
  createTextFilterDefinition,
  readJsonOrError,
  sortItemsByDateMode,
  triggerFileDownload,
} from "../../lib/admin-page-utils";
import { buildSelectedRequestsCsv } from "../../lib/admin-export-utils";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const upgradeSavedViewsStorageKey = "deploymate.admin.upgradeRequests.savedViews";
const upgradeAuditViewsStorageKey = "deploymate.admin.upgradeRequests.auditViews";

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

function formatUpgradeSavedViews(items) {
  return formatSavedViews(items, {
    formatDate,
    summarizeFilters: (filters) =>
      [
        filters.status && filters.status !== "all" ? `status ${filters.status}` : null,
        filters.plan && filters.plan !== "all" ? `plan ${filters.plan}` : null,
        filters.linked_only ? "linked only" : null,
        filters.q ? `search ${filters.q}` : null,
        filters.audit_q ? `audit ${filters.audit_q}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
  });
}

function UpgradeRequestsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [authChecked, setAuthChecked] = useState(smokeMode);
  const [currentUser, setCurrentUser] = useState(smokeMode ? smokeUser : null);
  const [requests, setRequests] = useState(smokeMode ? smokeRequests : []);
  const [adminOverview, setAdminOverview] = useState(smokeMode ? smokeOverview : null);
  const [auditEvents, setAuditEvents] = useState(smokeMode ? smokeAuditEvents : []);
  const [users, setUsers] = useState(smokeMode ? smokeUsers : []);
  const [loading, setLoading] = useState(!smokeMode);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [planFilter, setPlanFilter] = useState(() => searchParams.get("plan") || "all");
  const [statusFilter, setStatusFilter] = useState(
    () => searchParams.get("status") || (smokeMode ? "in_review" : "all"),
  );
  const [linkedOnly, setLinkedOnly] = useState(() => searchParams.get("linked_only") === "true");
  const [auditQuery, setAuditQuery] = useState(
    () => searchParams.get("audit_q") || (smokeMode ? "approved" : ""),
  );
  const [auditSort, setAuditSort] = useState(() => searchParams.get("audit_sort") || "newest");
  const debouncedQuery = useDebouncedValue(query, { disabled: smokeMode, initialValue: "" });
  const debouncedAuditQuery = useDebouncedValue(auditQuery, { disabled: smokeMode, initialValue: "" });
  const [savingId, setSavingId] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [selectedRequestIds, setSelectedRequestIds] = useState(
    smokeMode ? ["smoke-request-1"] : [],
  );
  const [bulkStatusValue, setBulkStatusValue] = useState(smokeMode ? "closed" : "");
  const [saveFeedback, setSaveFeedback] = useState("");
  const [drafts, setDrafts] = useState({});
  const filteredRequests = requests;
  const primaryFilterDefinitions = [
    createTextFilterDefinition({
      key: "q",
      value: query,
      setValue: setQuery,
      chipKey: "upgrade-q",
      chipLabel: `Search: ${query.trim()}`,
      testId: "upgrade-filter-chip-query",
    }),
    createChoiceFilterDefinition({
      key: "plan",
      value: planFilter,
      setValue: setPlanFilter,
      chipKey: "upgrade-plan",
      chipLabel: `Plan: ${planFilter}`,
      testId: "upgrade-filter-chip-plan",
    }),
    createChoiceFilterDefinition({
      key: "status",
      value: statusFilter,
      setValue: setStatusFilter,
      chipKey: "upgrade-status",
      chipLabel: `Status: ${statusFilter}`,
      testId: "upgrade-filter-chip-status",
    }),
    createBooleanFilterDefinition({
      key: "linked_only",
      value: linkedOnly,
      setValue: setLinkedOnly,
      chipKey: "upgrade-linked",
      chipLabel: "Linked users only",
      testId: "upgrade-filter-chip-linked",
    }),
    createTextFilterDefinition({
      key: "audit_q",
      value: auditQuery,
      setValue: setAuditQuery,
      chipKey: "upgrade-audit",
      chipLabel: `Audit: ${auditQuery.trim()}`,
      testId: "upgrade-filter-chip-audit",
    }),
  ];
  const { currentFilters: currentUpgradeView, hasActiveFilters: hasRequestFilters } =
    buildFilterState(primaryFilterDefinitions);
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
    normalizedSavedViewName,
    hasSavedViewNameMatch,
    hasSavedViewChanges,
    activeSavedViewId,
    activeSavedView,
    activeSavedViewHasChanges,
    canSaveCurrentView,
    reachedViewLimitWithoutReplace,
    visibleSavedViews,
    savedViewsToolsDirty,
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
    smokeMode,
    initialViews: smokeMode ? formatUpgradeSavedViews(smokeUpgradeSavedViews) : [],
    formatViews: formatUpgradeSavedViews,
    storageKey: upgradeSavedViewsStorageKey,
    currentFilters: currentUpgradeView,
    hasFilters: hasRequestFilters,
    applyViewFilters,
    pathname,
    copyText: copyTextToClipboard,
    setFeedback: setSaveFeedback,
    setError,
    initialMetaText: smokeMode ? "Loaded from local browser storage." : "Using local browser storage.",
    exportFilename: "deploymate-upgrade-saved-views.json",
    exportScope: "admin-upgrade-requests",
    summaryNoun: "inbox",
    emptyImportMessage: "No valid saved inbox views found in this file.",
    wrongScopeMessage: "This file is not an upgrade requests saved views export.",
    saveSuccessMessage: "Saved current inbox view.",
    updateSuccessMessage: "Current saved inbox view updated.",
    deleteSuccessMessage: "Saved inbox view removed.",
    exportSuccessMessage: "Saved inbox views exported.",
    clearSuccessMessage: "Saved inbox views cleared.",
    clearImportedSuccessMessage: "Imported inbox views removed.",
    resetToolsSuccessMessage: "Saved views tools reset.",
    importMergeMessage: ({ total, replacedCount, skippedCount }) =>
      `Saved inbox views merged. Total: ${total}. Replaced: ${replacedCount}. Skipped by limit: ${skippedCount}.`,
  });
  const activeFilterChips = buildFilterChipsFromDefinitions(primaryFilterDefinitions);
  const activeAuditFilterChips = buildFilterChips([
    auditQuery.trim()
      ? {
          key: "upgrade-audit-search",
          label: `Audit: ${auditQuery.trim()}`,
          onRemove: () => setAuditQuery(""),
          testId: "upgrade-audit-filter-chip-query",
        }
      : null,
  ]);
  const visibleAuditEvents = sortItemsByDateMode(auditEvents, {
    valueKey: "created_at",
    mode: auditSort,
  });
  const currentAuditView = {
    audit_q: auditQuery.trim(),
    audit_sort: auditSort,
  };
  const {
    auditViews,
    auditViewName,
    setAuditViewName,
    normalizedAuditViewName,
    hasAuditViewNameMatch,
    activeAuditViewId,
    canSaveAuditView,
    handleSaveAuditView,
    handleApplyAuditView,
    handleDeleteAuditView,
    handleCopyAuditViewLink,
    handleResetAuditTools,
  } = useAdminAuditViewsManager({
    smokeMode,
    initialViews: smokeMode ? formatUpgradeSavedViews(smokeUpgradeAuditViews) : [],
    formatViews: formatUpgradeSavedViews,
    storageKey: upgradeAuditViewsStorageKey,
    currentFilters: currentAuditView,
    canSaveWhen: auditQuery.trim() || auditSort !== "newest",
    applyViewFilters: (filters) => {
      setAuditQuery(filters.audit_q || "");
      setAuditSort(filters.audit_sort || "newest");
    },
    pathname,
    copyText: copyTextToClipboard,
    setFeedback: setSaveFeedback,
    setError,
    resetViewFilters: () => {
      setAuditQuery("");
      setAuditSort("newest");
    },
    copyParams: {
      audit_q: auditQuery.trim(),
      audit_sort: auditSort !== "newest" ? auditSort : undefined,
    },
  });
  const selectedVisibleRequestIds = filteredRequests
    .map((item) => item.id)
    .filter((requestId) => selectedRequestIds.includes(requestId));
  const selectedRequests = filteredRequests.filter((item) => selectedRequestIds.includes(item.id));
  const selectedRequestsPreview = selectedRequests
    .slice(0, 3)
    .map((item) => item.name || item.email || item.id)
    .join(", ");
  const allVisibleRequestsSelected =
    filteredRequests.length > 0 && selectedVisibleRequestIds.length === filteredRequests.length;
  const hasSelectedRequests = selectedRequestIds.length > 0;
  const bulkRequestsDirty = hasSelectedRequests || bulkStatusValue !== "";
  const { syncedSearchParams } = buildFilterState([
    ...primaryFilterDefinitions,
    {
      key: "audit_sort",
      value: auditSort,
      serializeWhen: (value) => value !== "newest",
    },
  ]);

  function buildDraft(item) {
    return {
      status: item.status || "new",
      internal_note: item.internal_note || "",
      target_user_id: item.target_user_id || "",
      plan: item.current_plan || "trial",
    };
  }

  function syncDrafts(items) {
    const nextDrafts = {};
    items.forEach((item) => {
      nextDrafts[item.id] = buildDraft(item);
    });
    setDrafts(nextDrafts);
  }

  async function loadRequests() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (planFilter !== "all") {
        params.set("plan", planFilter);
      }
      if (linkedOnly) {
        params.set("linked_only", "true");
      }
      if (debouncedQuery.trim()) {
        params.set("q", debouncedQuery.trim());
      }
      const response = await fetch(`${apiBaseUrl}/admin/upgrade-requests?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await readJsonOrError(response, "Failed to load upgrade requests.");
      const items = Array.isArray(data) ? data : [];
      setRequests(items);
      syncDrafts(items);
      setAccessDenied(false);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }
      if (requestError instanceof Error && requestError.status === 403) {
        setAccessDenied(true);
        setRequests([]);
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load upgrade requests.",
      );
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    const response = await fetch(`${apiBaseUrl}/admin/users`, {
      cache: "no-store",
      credentials: "include",
    });
    const data = await readJsonOrError(response, "Failed to load admin users.");
    setUsers(Array.isArray(data) ? data : []);
  }

  async function loadAdminOverview() {
    const response = await fetch(`${apiBaseUrl}/admin/overview`, {
      cache: "no-store",
      credentials: "include",
    });
    const data = await readJsonOrError(response, "Failed to load admin overview.");
    setAdminOverview(data);
  }

  async function loadAuditEvents() {
    const params = new URLSearchParams();
    params.set("limit", "20");
    params.set("target_type", "upgrade_request");
    if (debouncedAuditQuery.trim()) {
      params.set("q", debouncedAuditQuery.trim());
    }
    const response = await fetch(`${apiBaseUrl}/admin/audit-events?${params.toString()}`, {
      cache: "no-store",
      credentials: "include",
    });
    const data = await readJsonOrError(response, "Failed to load admin audit events.");
    setAuditEvents(Array.isArray(data) ? data : []);
  }

  function applyViewFilters(filters) {
    setQuery(filters.q || "");
    setPlanFilter(filters.plan || "all");
    setStatusFilter(filters.status || "all");
    setLinkedOnly(Boolean(filters.linked_only));
    setAuditQuery(filters.audit_q || "");
  }

  async function refreshPageData() {
    await Promise.all([loadUsers(), loadRequests(), loadAdminOverview(), loadAuditEvents()]);
  }

  useEffect(() => {
    if (!saveFeedback && !error) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      setSaveFeedback("");
      setError("");
    }, 4000);
    return () => window.clearTimeout(timeoutId);
  }, [saveFeedback, error]);

  function updateDraft(requestId, field, value) {
    setDrafts((current) => ({
      ...current,
      [requestId]: {
        ...current[requestId],
        [field]: value,
      },
    }));
  }

  async function applyRequestUpdate(requestId, payload, successMessage) {
    setSavingId(requestId);
    setError("");
    setSaveFeedback("");
    try {
      const response = await fetch(`${apiBaseUrl}/admin/upgrade-requests/${requestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const updatedItem = await readJsonOrError(response, "Failed to update upgrade request.");
      setRequests((current) =>
        current.map((item) => (item.id === requestId ? updatedItem : item)),
      );
      setDrafts((current) => ({
        ...current,
        [requestId]: buildDraft(updatedItem),
      }));
      setSaveFeedback(successMessage);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to update upgrade request.",
      );
    } finally {
      setSavingId("");
    }
  }

  function handleToggleRequestSelection(requestId) {
    setSelectedRequestIds((currentIds) =>
      currentIds.includes(requestId)
        ? currentIds.filter((item) => item !== requestId)
        : [...currentIds, requestId],
    );
  }

  function handleToggleVisibleRequests() {
    const visibleIds = filteredRequests.map((item) => item.id);
    if (visibleIds.length === 0) {
      return;
    }
    setSelectedRequestIds((currentIds) => {
      if (visibleIds.every((requestId) => currentIds.includes(requestId))) {
        return currentIds.filter((requestId) => !visibleIds.includes(requestId));
      }
      return Array.from(new Set([...currentIds, ...visibleIds]));
    });
  }

  function handleSelectRequestsByStatus(status) {
    const matchingIds = filteredRequests
      .filter((item) => item.status === status)
      .map((item) => item.id);
    setSelectedRequestIds(matchingIds);
    setSaveFeedback(
      `${matchingIds.length} ${status.replace("_", " ")} request${matchingIds.length === 1 ? "" : "s"} selected.`,
    );
    setError("");
  }

  function handleSelectLinkedRequests() {
    const matchingIds = filteredRequests
      .filter((item) => item.target_user_id)
      .map((item) => item.id);
    setSelectedRequestIds(matchingIds);
    setSaveFeedback(
      `${matchingIds.length} linked request${matchingIds.length === 1 ? "" : "s"} selected.`,
    );
    setError("");
  }

  function handleSelectCurrentInboxFilter() {
    const matchingIds = filteredRequests.map((item) => item.id);
    setSelectedRequestIds(matchingIds);
    setSaveFeedback(
      `${matchingIds.length} visible request${matchingIds.length === 1 ? "" : "s"} selected from the current inbox filter view.`,
    );
    setError("");
  }

  function handleClearSelectedRequests() {
    setSelectedRequestIds([]);
    setSaveFeedback("Selection cleared.");
    setError("");
  }

  function handleResetBulkRequestTools() {
    setSelectedRequestIds([]);
    setBulkStatusValue("");
    setSaveFeedback("Bulk tools reset.");
    setError("");
  }

  async function handleBulkStatusApply() {
    if (!bulkStatusValue || !selectedRequestIds.length) {
      return;
    }

    setBulkSaving(true);
    setError("");
    setSaveFeedback("");

    try {
      for (const requestId of selectedRequestIds) {
        const currentDraft = drafts[requestId] || {};
        const response = await fetch(`${apiBaseUrl}/admin/upgrade-requests/${requestId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            status: bulkStatusValue,
            internal_note: currentDraft.internal_note || "",
            target_user_id: currentDraft.target_user_id || null,
          }),
        });
        const updatedItem = await readJsonOrError(response, "Failed to bulk update upgrade requests.");
        setRequests((current) =>
          current.map((item) => (item.id === requestId ? updatedItem : item)),
        );
        setDrafts((current) => ({
          ...current,
          [requestId]: buildDraft(updatedItem),
        }));
      }
      setSelectedRequestIds([]);
      setBulkStatusValue("");
      setSaveFeedback(
        `Updated status to ${bulkStatusValue} for ${selectedRequestIds.length} request${selectedRequestIds.length === 1 ? "" : "s"}.`,
      );
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to bulk update upgrade requests.",
      );
    } finally {
      setBulkSaving(false);
    }
  }

  function handleDownloadSelectedRequestsExport() {
    if (!selectedRequests.length) {
      return;
    }
    const blob = new Blob([buildSelectedRequestsCsv(selectedRequests)], {
      type: "text/csv;charset=utf-8",
    });
    triggerFileDownload("deploymate-selected-upgrade-requests.csv", blob);
    setSaveFeedback("Selected upgrade requests export downloaded.");
    setError("");
  }

  function handleDownloadFilteredRequestsExport() {
    if (!filteredRequests.length) {
      return;
    }
    const blob = new Blob([buildSelectedRequestsCsv(filteredRequests)], {
      type: "text/csv;charset=utf-8",
    });
    triggerFileDownload("deploymate-filtered-upgrade-requests.csv", blob);
    setSaveFeedback("Filtered upgrade requests export downloaded.");
    setError("");
  }

  function handleApplyBulkRequestPreset(kind) {
    if (kind === "review") {
      setBulkStatusValue("in_review");
      setSaveFeedback("Preset loaded: mark selected requests as in review.");
      setError("");
      return;
    }
    if (kind === "close") {
      setBulkStatusValue("closed");
      setSaveFeedback("Preset loaded: close selected requests.");
      setError("");
      return;
    }
    if (kind === "reject") {
      setBulkStatusValue("rejected");
      setSaveFeedback("Preset loaded: reject selected requests.");
      setError("");
    }
  }

  useEffect(() => {
    if (smokeMode) {
      return;
    }
    async function checkAuthAndLoad() {
      try {
        const response = await fetch(`${apiBaseUrl}/auth/me`, {
          cache: "no-store",
          credentials: "include",
        });
        const data = await readJsonOrError(response, "Authentication failed.");
        setCurrentUser(data);
        setAuthChecked(true);

        if (!data.is_admin) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        await refreshPageData();
      } catch {
        router.replace("/login");
      }
    }

    checkAuthAndLoad();
  }, [router]);

  useEffect(() => {
    if (smokeMode) {
      return;
    }
    const nextUrl = syncedSearchParams ? `${pathname}?${syncedSearchParams}` : pathname;
    const currentUrl = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
    if (nextUrl !== currentUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [pathname, router, searchParams, smokeMode, syncedSearchParams]);

  useEffect(() => {
    setSelectedRequestIds((currentIds) =>
      currentIds.filter((requestId) => requests.some((item) => item.id === requestId)),
    );
  }, [requests]);

  useEffect(() => {
    if (smokeMode || !authChecked || accessDenied) {
      return;
    }
    loadRequests();
  }, [authChecked, accessDenied, debouncedQuery, planFilter, statusFilter, linkedOnly]);

  useEffect(() => {
    if (smokeMode || !authChecked || accessDenied) {
      return;
    }
    loadAuditEvents();
  }, [authChecked, accessDenied, debouncedAuditQuery]);

  async function handleDownloadUpgradeExport() {
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/admin/exports/upgrade-requests?format=csv`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to download upgrade requests export.");
      }
      const blob = await response.blob();
      triggerFileDownload("deploymate-upgrade-requests.csv", blob);
      setSaveFeedback("Upgrade requests export downloaded.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to download upgrade requests export.",
      );
    }
  }

  async function handleCopyCurrentView() {
    setError("");
    try {
      await copyTextToClipboard(window.location.href);
      setSaveFeedback("Current view link copied.");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Failed to copy current view link.",
      );
    }
  }

  function handleDownloadVisibleAuditExport() {
    const blob = new Blob([buildAuditEventsCsv(visibleAuditEvents)], {
      type: "text/csv;charset=utf-8",
    });
    triggerFileDownload("deploymate-upgrade-audit-current-view.csv", blob);
    setSaveFeedback("Current audit view exported.");
    setError("");
  }

  function resetRequestFilters() {
    setQuery("");
    setPlanFilter("all");
    setStatusFilter("all");
    setLinkedOnly(false);
    setAuditQuery("");
  }

  if (!authChecked) {
    return (
      <main className="page">
        <div className="container">
          <div className="empty">Checking authentication...</div>
        </div>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="page">
        <div className="container narrowContainer">
          <article className="card formCard">
            <h1>Access denied</h1>
            <div className="banner error">
              This page is available only for the admin user.
            </div>
            <div className="formActions">
              <Link href="/app" className="linkButton">
                Back to app
              </Link>
            </div>
          </article>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <AdminPageHeader
          title="Upgrade Requests"
          titleTestId="upgrade-requests-page-title"
          subtitle={currentUser ? `Admin inbox · ${currentUser.username}` : "Admin inbox"}
          loading={loading}
          onRefresh={refreshPageData}
          refreshTestId="upgrade-refresh-button"
          actions={[
            { label: "Copy link", testId: "upgrade-copy-link-button", onClick: handleCopyCurrentView },
            { label: "Export CSV", testId: "upgrade-export-button", onClick: handleDownloadUpgradeExport },
          ]}
        />

        <AdminFeedbackBanners
          smokeMode={smokeMode}
          error={error}
          success={saveFeedback}
          errorTestId="upgrade-error-banner"
          successTestId="upgrade-success-banner"
        />

        {adminOverview ? (
          <article className="card formCard">
            <div className="sectionHeader">
              <div>
                <h2>Inbox overview</h2>
                <p className="formHint">Server-side snapshot of upgrade demand and review progress.</p>
              </div>
            </div>
            <div className="overviewGrid">
              <div className="overviewCard">
                <span className="overviewLabel">Requests</span>
                <strong className="overviewValue">{adminOverview.upgrade_requests.total}</strong>
                <div className="overviewMeta">
                  <span>New {adminOverview.upgrade_requests.new}</span>
                  <span>In review {adminOverview.upgrade_requests.in_review}</span>
                  <span>Approved {adminOverview.upgrade_requests.approved}</span>
                </div>
              </div>
              <div className="overviewCard">
                <span className="overviewLabel">Resolution</span>
                <strong className="overviewValue">{adminOverview.upgrade_requests.linked_users}</strong>
                <div className="overviewMeta">
                  <span>Linked users {adminOverview.upgrade_requests.linked_users}</span>
                  <span>Rejected {adminOverview.upgrade_requests.rejected}</span>
                  <span>Closed {adminOverview.upgrade_requests.closed}</span>
                </div>
              </div>
            </div>
            {Array.isArray(adminOverview.attention_items) && adminOverview.attention_items.length > 0 ? (
              <div className="overviewAttentionList">
                {adminOverview.attention_items.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="overviewAttentionItem">
                    <div className="row">
                      <span className="label">Level</span>
                      <span className={`status ${item.level === "info" ? "unknown" : item.level}`}>
                        {item.level}
                      </span>
                    </div>
                    <div className="row">
                      <span className="label">Title</span>
                      <span>{item.title}</span>
                    </div>
                    <div className="row">
                      <span className="label">Action</span>
                      <span>{item.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        ) : null}

        <AdminAuditToolbar
          title="Upgrade audit trail"
          description="Recent admin actions taken on upgrade requests."
          query={auditQuery}
          onQueryChange={(event) => setAuditQuery(event.target.value)}
          queryPlaceholder="approved, in_review, target user"
          queryTestId="upgrade-audit-search"
          sortValue={auditSort}
          onSortChange={(event) => setAuditSort(event.target.value)}
          sortTestId="upgrade-audit-sort"
          totalCount={visibleAuditEvents.length}
          summary="Audit search updates after a short pause."
          filters={activeAuditFilterChips}
          actions={[
            { label: "Copy audit link", testId: "upgrade-audit-copy-link-button", onClick: handleCopyAuditViewLink },
            { label: "Export current CSV", testId: "upgrade-audit-current-export-button", onClick: handleDownloadVisibleAuditExport, disabled: visibleAuditEvents.length === 0 },
            { label: "Reset audit", testId: "upgrade-audit-reset-button", onClick: handleResetAuditTools, disabled: !(auditQuery.trim() || auditSort !== "newest") },
          ]}
          emptyTestId="upgrade-audit-empty-state"
          emptyText={auditQuery.trim() ? "No upgrade audit events match this search." : "No upgrade audit events yet."}
        >
          <div className="timeline">
            {visibleAuditEvents.map((item) => (
              <div className="timelineItem" key={item.id}>
                <div className="row">
                  <span className="label">Action</span>
                  <span>{item.action_type}</span>
                </div>
                <div className="row">
                  <span className="label">Actor</span>
                  <span>{item.actor_username || "-"}</span>
                </div>
                <div className="row">
                  <span className="label">Target</span>
                  <span>{item.target_label || item.target_id || "-"}</span>
                </div>
                <div className="row">
                  <span className="label">Details</span>
                  <span>{item.details || "-"}</span>
                </div>
                <div className="row">
                  <span className="label">Created</span>
                  <span>{formatDate(item.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </AdminAuditToolbar>

        <article className="card formCard">
          <AdminSavedViews
            title="Saved audit views"
            inputLabel="Audit view name"
            inputValue={auditViewName}
            onInputChange={(event) => setAuditViewName(event.target.value)}
            onSave={handleSaveAuditView}
            saveDisabled={!canSaveAuditView}
            saveTestId="upgrade-save-audit-view-button"
            saveLabel={hasAuditViewNameMatch ? "Update audit view" : "Save audit view"}
            inputHint="Save the current audit query and sort. Audit presets are stored separately from the main inbox saved views."
            inputCountText={`${normalizedAuditViewName.length}/40 characters`}
            views={auditViews}
            onApply={handleApplyAuditView}
            onDelete={handleDeleteAuditView}
            emptyText="No saved audit views yet."
            listTestId="upgrade-audit-views-list"
            activeViewId={activeAuditViewId}
          />
        </article>

        <article className="card formCard">
          <div className="sectionHeader">
            <h2>Inbox filters</h2>
            <p className="formHint">Filter by status or current plan, then search requester details.</p>
          </div>
          <div className="deploymentControls">
            <div className="filterTabs" role="tablist" aria-label="Upgrade status filters">
              <button
                type="button"
                className={statusFilter === "all" ? "active" : ""}
                onClick={() => setStatusFilter("all")}
              >
                All statuses
              </button>
              <button
                type="button"
                className={statusFilter === "new" ? "active" : ""}
                onClick={() => setStatusFilter("new")}
              >
                New
              </button>
              <button
                type="button"
                className={statusFilter === "in_review" ? "active" : ""}
                onClick={() => setStatusFilter("in_review")}
              >
                In review
              </button>
              <button
                type="button"
                className={statusFilter === "approved" ? "active" : ""}
                onClick={() => setStatusFilter("approved")}
              >
                Approved
              </button>
              <button
                type="button"
                className={statusFilter === "rejected" ? "active" : ""}
                onClick={() => setStatusFilter("rejected")}
              >
                Rejected
              </button>
              <button
                type="button"
                className={statusFilter === "closed" ? "active" : ""}
                onClick={() => setStatusFilter("closed")}
              >
                Closed
              </button>
            </div>
            <div className="filterTabs" role="tablist" aria-label="Upgrade plan filters">
              <button
                type="button"
                className={planFilter === "all" ? "active" : ""}
                onClick={() => setPlanFilter("all")}
              >
                All plans
              </button>
              <button
                type="button"
                className={planFilter === "trial" ? "active" : ""}
                onClick={() => setPlanFilter("trial")}
              >
                Trial
              </button>
              <button
                type="button"
                className={planFilter === "solo" ? "active" : ""}
                onClick={() => setPlanFilter("solo")}
              >
                Solo
              </button>
              <button
                type="button"
                className={planFilter === "team" ? "active" : ""}
                onClick={() => setPlanFilter("team")}
              >
                Team
              </button>
            </div>
            <label className="field toolbarField">
              <span>Linked users only</span>
              <input
                type="checkbox"
                checked={linkedOnly}
                onChange={(event) => setLinkedOnly(event.target.checked)}
              />
            </label>
            <label className="field deploymentSearch">
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="name, email, company, use case"
              />
            </label>
          </div>
          <AdminFilterFooter
            summary={`Showing ${filteredRequests.length} request${filteredRequests.length === 1 ? "" : "s"} for the current filters.`}
            hint="Inbox and audit filters stay in the URL, so this view can be shared or saved locally."
            onReset={resetRequestFilters}
            resetDisabled={!hasRequestFilters}
            resetTestId="upgrade-reset-filters-button"
            actions={[
              {
                label: "Copy filter link",
                testId: "upgrade-copy-filter-link-button",
                onClick: handleCopyCurrentView,
              },
            ]}
          />
        </article>

        <article className="card formCard">
          <AdminSavedViews
            title="Saved inbox views"
            inputLabel="View name"
            inputValue={savedViewName}
            onInputChange={(event) => setSavedViewName(event.target.value)}
            onSave={handleSaveCurrentView}
            onUpdateCurrent={handleUpdateCurrentView}
            saveDisabled={!canSaveCurrentView || reachedViewLimitWithoutReplace}
            updateDisabled={!activeSavedViewHasChanges}
            saveTestId="upgrade-save-view-button"
            updateTestId="upgrade-update-current-view-button"
            saveLabel={hasSavedViewNameMatch ? "Update saved view" : "Save current view"}
            inputHint="Names are case-insensitive and extra spaces are normalized. Matching names update the existing saved view."
            inputCountText={`${normalizedSavedViewName.length}/40 characters`}
            viewSummaryText={savedViewsSummaryText}
            useCurrentNameLabel="Use current name"
            onUseCurrentName={handleUseCurrentSavedViewName}
            useCurrentNameDisabled={!activeSavedView?.name}
            searchValue={savedViewsSearch}
            onSearchChange={(event) => setSavedViewsSearch(event.target.value)}
            searchTestId="upgrade-saved-views-search"
            searchPlaceholder="review, imported, team"
            sourceFilter={savedViewsSourceFilter}
            onSourceFilterChange={(event) => setSavedViewsSourceFilter(event.target.value)}
            sourceFilterTestId="upgrade-saved-views-source-filter"
            sortValue={savedViewsSort}
            onSortChange={(event) => setSavedViewsSort(event.target.value)}
            sortTestId="upgrade-saved-views-sort"
            statusText={
              !hasRequestFilters
                ? "Set at least one inbox or audit filter before saving a view."
                : reachedViewLimitWithoutReplace
                ? "Saved views are full. Use an existing name or clear some presets first."
                : activeSavedViewHasChanges
                ? `Current saved view "${activeSavedView?.name || ""}" has unsaved filter changes.`
                : hasSavedViewNameMatch
                ? hasSavedViewChanges
                  ? "This will update the existing saved view with the current filters."
                  : "Saved view name matches the current filter state."
                : ""
            }
            metaText={savedViewsMetaText}
            views={visibleSavedViews}
            onApply={handleApplySavedView}
            onDelete={handleDeleteSavedView}
            onCopy={handleCopySavedViewLink}
            actions={[
              {
                label: "Export views",
                testId: "upgrade-export-saved-views-button",
                onClick: handleDownloadSavedViews,
                disabled: savedViews.length === 0,
              },
              {
                label: "Import views",
                testId: "upgrade-import-saved-views-button",
                kind: "file",
                accept: "application/json,.json",
                onChange: handleImportSavedViews,
              },
              {
                label: "Clear all",
                testId: "upgrade-clear-saved-views-button",
                onClick: handleClearSavedViews,
                disabled: savedViews.length === 0,
              },
              {
                label: "Clear imported",
                testId: "upgrade-clear-imported-saved-views-button",
                onClick: handleClearImportedSavedViews,
                disabled: !savedViews.some((item) => item.source === "imported"),
              },
              {
                label: "Reset tools",
                testId: "upgrade-reset-saved-views-tools-button",
                onClick: handleResetSavedViewsTools,
                disabled: !savedViewsToolsDirty,
              },
            ]}
            emptyText={
              savedViews.length === 0
                ? "No saved inbox views yet."
                : "No saved inbox views match this search or source filter."
            }
            listTestId="upgrade-saved-views-list"
            activeViewId={activeSavedViewId}
          />
        </article>

        {loading && requests.length === 0 ? (
          <div className="empty">Loading upgrade requests...</div>
        ) : null}

        {!loading && requests.length === 0 ? (
          <div className="empty" data-testid="upgrade-empty-state">No upgrade requests found for the current filters.</div>
        ) : null}

        <article className="card formCard" data-testid="upgrade-bulk-card">
          <div className="sectionHeader">
            <div>
              <h2 data-testid="upgrade-bulk-title">Bulk inbox actions</h2>
              <p className="formHint">Bulk selection follows the current server-side inbox filters.</p>
              <p className="formHint" data-testid="upgrade-bulk-selection-summary">
                Selected {selectedRequestIds.length} · Visible {filteredRequests.length}
              </p>
              {hasSelectedRequests ? (
                <p className="formHint">
                  {selectedRequests.length > 3
                    ? `${selectedRequestsPreview} +${selectedRequests.length - 3} more`
                    : selectedRequestsPreview}
                </p>
              ) : null}
              <div className="backupSummaryBadges" data-testid="upgrade-bulk-stats">
                <span className="status info">selected {selectedRequestIds.length}</span>
                <span className="status unknown">visible {filteredRequests.length}</span>
                <span className="status unknown">new {filteredRequests.filter((item) => item.status === "new").length}</span>
                <span className="status unknown">review {filteredRequests.filter((item) => item.status === "in_review").length}</span>
              </div>
            </div>
            <div className="actions">
              <button
                type="button"
                className="secondaryButton"
                data-testid="upgrade-bulk-select-visible-button"
                onClick={handleToggleVisibleRequests}
                disabled={filteredRequests.length === 0 || bulkSaving}
              >
                {allVisibleRequestsSelected ? "Unselect visible" : `Select visible (${filteredRequests.length})`}
              </button>
              <button
                type="button"
                className="secondaryButton"
                data-testid="upgrade-bulk-clear-selection-button"
                onClick={handleClearSelectedRequests}
                disabled={!hasSelectedRequests || bulkSaving}
              >
                Clear selection
              </button>
              <button
                type="button"
                className="secondaryButton"
                data-testid="upgrade-bulk-export-selection-button"
                onClick={handleDownloadSelectedRequestsExport}
                disabled={!hasSelectedRequests || bulkSaving}
              >
                Export selection
              </button>
              <button
                type="button"
                className="secondaryButton"
                data-testid="upgrade-bulk-export-filtered-button"
                onClick={handleDownloadFilteredRequestsExport}
                disabled={filteredRequests.length === 0 || bulkSaving}
              >
                Export current filter
              </button>
              <button
                type="button"
                className="secondaryButton"
                data-testid="upgrade-bulk-select-new-button"
                onClick={() => handleSelectRequestsByStatus("new")}
                disabled={bulkSaving || !filteredRequests.some((item) => item.status === "new")}
              >
                Select new
              </button>
              <button
                type="button"
                className="secondaryButton"
                data-testid="upgrade-bulk-select-review-button"
                onClick={() => handleSelectRequestsByStatus("in_review")}
                disabled={bulkSaving || !filteredRequests.some((item) => item.status === "in_review")}
              >
                Select in review
              </button>
              <button
                type="button"
                className="secondaryButton"
                data-testid="upgrade-bulk-select-linked-button"
                onClick={handleSelectLinkedRequests}
                disabled={bulkSaving || !filteredRequests.some((item) => item.target_user_id)}
              >
                Select linked
              </button>
              <button
                type="button"
                className="secondaryButton"
                data-testid="upgrade-bulk-select-current-filter-button"
                onClick={handleSelectCurrentInboxFilter}
                disabled={bulkSaving || filteredRequests.length === 0}
              >
                Select current filter
              </button>
              <button
                type="button"
                className="secondaryButton"
                data-testid="upgrade-bulk-reset-tools-button"
                onClick={handleResetBulkRequestTools}
                disabled={!bulkRequestsDirty || bulkSaving}
              >
                Reset bulk tools
              </button>
            </div>
          </div>

          <div className="bulkActionsGrid">
            <div className="field" data-testid="upgrade-bulk-presets">
              <span>Quick presets</span>
              <div className="actions">
                <button
                  type="button"
                  className="secondaryButton"
                  data-testid="upgrade-bulk-preset-review-button"
                  onClick={() => handleApplyBulkRequestPreset("review")}
                  disabled={bulkSaving}
                >
                  Mark in review
                </button>
                <button
                  type="button"
                  className="secondaryButton"
                  data-testid="upgrade-bulk-preset-close-button"
                  onClick={() => handleApplyBulkRequestPreset("close")}
                  disabled={bulkSaving}
                >
                  Close selected
                </button>
                <button
                  type="button"
                  className="secondaryButton"
                  data-testid="upgrade-bulk-preset-reject-button"
                  onClick={() => handleApplyBulkRequestPreset("reject")}
                  disabled={bulkSaving}
                >
                  Reject selected
                </button>
              </div>
            </div>
            <label className="field">
              <span>Bulk lifecycle status</span>
              <select
                data-testid="upgrade-bulk-status-select"
                value={bulkStatusValue}
                onChange={(event) => setBulkStatusValue(event.target.value)}
                disabled={bulkSaving}
              >
                <option value="">Keep current status</option>
                <option value="new">new</option>
                <option value="in_review">in_review</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
                <option value="closed">closed</option>
              </select>
            </label>
            <button
              type="button"
              className="secondaryButton"
              data-testid="upgrade-bulk-status-apply-button"
              onClick={handleBulkStatusApply}
              disabled={!hasSelectedRequests || !bulkStatusValue || bulkSaving}
            >
              {bulkSaving ? "Applying..." : "Apply status"}
            </button>
          </div>
          <p className="formHint">
            Bulk inbox actions only update lifecycle status and reuse the existing single-request admin write path.
          </p>
          <p className="formHint">
            Fast selectors respect the current inbox filters so you can stage status changes without disturbing the current triage view.
          </p>
          <p className="formHint" data-testid="upgrade-bulk-action-summary">
            {hasSelectedRequests
              ? bulkStatusValue
                ? `Ready to apply: status -> ${bulkStatusValue}.`
                : "Pick a lifecycle status to enable bulk apply."
              : "Select at least one request to enable bulk actions."}
          </p>
        </article>

        <div className="list">
          {!loading && requests.length > 0 && filteredRequests.length === 0 ? (
            <div className="empty" data-testid="upgrade-filter-empty-state">No upgrade requests match this filter or search.</div>
          ) : null}

          {filteredRequests.map((item) => (
            <article className="card compactCard" key={item.id}>
              <div className="row">
                <label className="bulkSelectLabel">
                  <input
                    type="checkbox"
                    data-testid={`upgrade-select-${item.id}`}
                    checked={selectedRequestIds.includes(item.id)}
                    onChange={() => handleToggleRequestSelection(item.id)}
                    disabled={bulkSaving}
                  />
                  <span>Select request</span>
                </label>
              </div>
              <div className="row">
                <span className="label">Status</span>
                <span className={`status ${(item.status || "unknown").replace("_", "-")}`}>
                  {(item.status || "unknown").replace("_", " ")}
                </span>
              </div>
              <div className="row">
                <span className="label">Name</span>
                <span>{item.name || "-"}</span>
              </div>
              <div className="row">
                <span className="label">Email</span>
                <span>{item.email || "-"}</span>
              </div>
              <div className="row">
                <span className="label">Company / team</span>
                <span>{item.company_or_team || "-"}</span>
              </div>
              <div className="row">
                <span className="label">Use case</span>
                <span>{item.use_case || "-"}</span>
              </div>
              <div className="row">
                <span className="label">Current plan</span>
                <span>{item.current_plan || "-"}</span>
              </div>
              <div className="row">
                <span className="label">Handled by</span>
                <span>{item.handled_by_username || "-"}</span>
              </div>
              <div className="row">
                <span className="label">Target user</span>
                <span>{item.target_username || "-"}</span>
              </div>
              <div className="row">
                <span className="label">Reviewed</span>
                <span>{formatDate(item.reviewed_at)}</span>
              </div>
              <div className="row">
                <span className="label">Updated</span>
                <span>{formatDate(item.updated_at)}</span>
              </div>
              <div className="row">
                <span className="label">Created</span>
                <span>{formatDate(item.created_at)}</span>
              </div>
              <label className="field">
                <span>Lifecycle status</span>
                <select
                  value={drafts[item.id]?.status || "new"}
                  onChange={(event) => updateDraft(item.id, "status", event.target.value)}
                  disabled={savingId === item.id || bulkSaving}
                >
                  <option value="new">new</option>
                  <option value="in_review">in_review</option>
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                  <option value="closed">closed</option>
                </select>
              </label>
              <label className="field">
                <span>Internal note</span>
                <textarea
                  value={drafts[item.id]?.internal_note || ""}
                  onChange={(event) => updateDraft(item.id, "internal_note", event.target.value)}
                  disabled={savingId === item.id || bulkSaving}
                  placeholder="Next step, pricing context, follow-up owner"
                />
              </label>
              <p className="formHint">Use internal notes for follow-up context visible to admins only.</p>
              <label className="field">
                <span>Target user</span>
                <select
                  value={drafts[item.id]?.target_user_id || ""}
                  onChange={(event) => updateDraft(item.id, "target_user_id", event.target.value)}
                  disabled={savingId === item.id || bulkSaving}
                >
                  <option value="">Not linked</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username} · {user.plan}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Plan to assign</span>
                <select
                  value={drafts[item.id]?.plan || "trial"}
                  onChange={(event) => updateDraft(item.id, "plan", event.target.value)}
                  disabled={savingId === item.id || bulkSaving}
                >
                  <option value="trial">trial</option>
                  <option value="solo">solo</option>
                  <option value="team">team</option>
                </select>
              </label>
              <div className="actions">
                <button
                  type="button"
                  onClick={() =>
                    applyRequestUpdate(
                      item.id,
                      {
                        status: drafts[item.id]?.status || item.status,
                        internal_note: drafts[item.id]?.internal_note || "",
                        target_user_id: drafts[item.id]?.target_user_id || null,
                      },
                      "Upgrade request updated.",
                    )
                  }
                  disabled={savingId === item.id || bulkSaving}
                >
                  {savingId === item.id ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyRequestUpdate(
                      item.id,
                      {
                        status: "in_review",
                        internal_note: drafts[item.id]?.internal_note || "",
                        target_user_id: drafts[item.id]?.target_user_id || null,
                      },
                      "Upgrade request marked as in review.",
                    )
                  }
                  disabled={savingId === item.id || bulkSaving}
                >
                  Mark in review
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyRequestUpdate(
                      item.id,
                      {
                        status: "approved",
                        internal_note: drafts[item.id]?.internal_note || "",
                        target_user_id: drafts[item.id]?.target_user_id || null,
                        plan: drafts[item.id]?.target_user_id ? drafts[item.id]?.plan : undefined,
                      },
                      "Upgrade request approved.",
                    )
                  }
                  disabled={savingId === item.id || bulkSaving || !drafts[item.id]?.target_user_id}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="dangerButton"
                  onClick={() =>
                    applyRequestUpdate(
                      item.id,
                      {
                        status: "rejected",
                        internal_note: drafts[item.id]?.internal_note || "",
                        target_user_id: drafts[item.id]?.target_user_id || null,
                      },
                      "Upgrade request rejected.",
                    )
                  }
                  disabled={savingId === item.id || bulkSaving}
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyRequestUpdate(
                      item.id,
                      {
                        status: "closed",
                        internal_note: drafts[item.id]?.internal_note || "",
                        target_user_id: drafts[item.id]?.target_user_id || null,
                      },
                      "Upgrade request closed.",
                    )
                  }
                  disabled={savingId === item.id || bulkSaving}
                >
                  Close
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function UpgradeRequestsPage() {
  return (
    <Suspense fallback={<main className="page"><div className="container"><div className="empty">Loading upgrade inbox...</div></div></main>}>
      <UpgradeRequestsPageContent />
    </Suspense>
  );
}
