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
  smokeAdminAuditEvents,
  smokeAdminOverview,
  smokeAdminUser as smokeUser,
  smokeMode,
  smokeRestoreBundle,
  smokeRestoreDryRun,
  smokeRestoreReportMode,
  smokeUserAuditViews,
  smokeUsers,
  smokeUserSavedViews,
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
  applyFilterDefinitions,
  buildFilterChipsFromDefinitions,
  buildFilterState,
  buildAuditEventsCsv,
  copyTextToClipboard,
  createChoiceFilterDefinition,
  createTextFilterDefinition,
  readJsonOrError,
  sortItemsByDateMode,
  triggerFileDownload,
} from "../../lib/admin-page-utils";
import {
  analyzeBackupBundleText,
  buildRestoreDryRunCsv,
  buildRestoreIssuesCsv,
  buildRestoreReportDigest,
  buildSelectedUsersCsv,
} from "../../lib/admin-export-utils";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const usersSavedViewsStorageKey = "deploymate.admin.users.savedViews";
const usersAuditViewsStorageKey = "deploymate.admin.users.auditViews";

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

function formatUserSavedViews(items) {
  return formatSavedViews(items, {
    formatDate,
    summarizeFilters: (filters) =>
      [
        filters.role && filters.role !== "all" ? `role ${filters.role}` : null,
        filters.plan && filters.plan !== "all" ? `plan ${filters.plan}` : null,
        filters.must_change_password && filters.must_change_password !== "all"
          ? filters.must_change_password === "required"
            ? "password change required"
            : "password ok"
          : null,
        filters.q ? `search ${filters.q}` : null,
        filters.audit_q ? `audit ${filters.audit_q}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
  });
}

function UsersPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [authChecked, setAuthChecked] = useState(smokeMode);
  const [currentUser, setCurrentUser] = useState(smokeMode ? smokeUser : null);
  const [users, setUsers] = useState(smokeMode ? smokeUsers : []);
  const [adminOverview, setAdminOverview] = useState(smokeMode ? smokeAdminOverview : null);
  const [auditEvents, setAuditEvents] = useState(smokeMode ? smokeAdminAuditEvents : []);
  const [backupBundleText, setBackupBundleText] = useState(
    smokeRestoreReportMode ? JSON.stringify(smokeRestoreBundle, null, 2) : "",
  );
  const [restoreDryRun, setRestoreDryRun] = useState(
    smokeRestoreReportMode ? smokeRestoreDryRun : null,
  );
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreSectionFilter, setRestoreSectionFilter] = useState("all");
  const [loading, setLoading] = useState(!smokeMode);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState("");
  const [deletingUserId, setDeletingUserId] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState(smokeMode ? ["smoke-admin"] : []);
  const [bulkRoleValue, setBulkRoleValue] = useState(smokeMode ? "admin" : "");
  const [bulkPlanValue, setBulkPlanValue] = useState("");
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [roleFilter, setRoleFilter] = useState(
    () => searchParams.get("role") || (smokeMode ? "admin" : "all"),
  );
  const [planFilter, setPlanFilter] = useState(() => searchParams.get("plan") || "all");
  const [mustChangeFilter, setMustChangeFilter] = useState(() => {
    const value = searchParams.get("must_change_password");
    if (value === "required" || value === "ok") {
      return value;
    }
    return "all";
  });
  const [auditQuery, setAuditQuery] = useState(() => searchParams.get("audit_q") || "");
  const [auditScopeFilter, setAuditScopeFilter] = useState(
    () => searchParams.get("audit_scope") || (smokeMode ? "user" : "all"),
  );
  const [auditSort, setAuditSort] = useState(() => searchParams.get("audit_sort") || "newest");
  const debouncedQuery = useDebouncedValue(query, { disabled: smokeMode, initialValue: "" });
  const debouncedAuditQuery = useDebouncedValue(auditQuery, { disabled: smokeMode, initialValue: "" });
  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "member",
  });
  const filteredUsers = users;
  const bundleLineCount = backupBundleText ? backupBundleText.split("\n").length : 0;
  const bundleAnalysis = analyzeBackupBundleText(backupBundleText);
  const restoreReportDigest = buildRestoreReportDigest(restoreDryRun);
  const visibleRestoreSections = restoreDryRun
    ? restoreDryRun.sections.filter(
        (section) => restoreSectionFilter === "all" || section.status === restoreSectionFilter,
      )
    : [];
  const primaryFilterDefinitions = [
    createTextFilterDefinition({
      key: "q",
      value: query,
      setValue: setQuery,
      chipKey: "users-q",
      chipLabel: `Search: ${query.trim()}`,
      testId: "users-filter-chip-query",
    }),
    createChoiceFilterDefinition({
      key: "role",
      value: roleFilter,
      setValue: setRoleFilter,
      chipKey: "users-role",
      chipLabel: `Role: ${roleFilter}`,
      testId: "users-filter-chip-role",
    }),
    createChoiceFilterDefinition({
      key: "plan",
      value: planFilter,
      setValue: setPlanFilter,
      chipKey: "users-plan",
      chipLabel: `Plan: ${planFilter}`,
      testId: "users-filter-chip-plan",
    }),
    createChoiceFilterDefinition({
      key: "must_change_password",
      value: mustChangeFilter,
      setValue: setMustChangeFilter,
      chipKey: "users-password",
      chipLabel: mustChangeFilter === "required" ? "Password: change required" : "Password: ok",
      testId: "users-filter-chip-password",
    }),
    createTextFilterDefinition({
      key: "audit_q",
      value: auditQuery,
      setValue: setAuditQuery,
      chipKey: "users-audit",
      chipLabel: `Audit: ${auditQuery.trim()}`,
      testId: "users-filter-chip-audit",
    }),
  ];
  const { currentFilters: currentUserView, hasActiveFilters: hasUserFilters } =
    buildFilterState(primaryFilterDefinitions);
  const auditFilterDefinitions = [
    createTextFilterDefinition({
      key: "audit_q",
      value: auditQuery,
      setValue: setAuditQuery,
      chipKey: "users-audit-search",
      chipLabel: `Audit: ${auditQuery.trim()}`,
      testId: "users-audit-filter-chip-query",
    }),
    createChoiceFilterDefinition({
      key: "audit_scope",
      value: auditScopeFilter,
      setValue: setAuditScopeFilter,
      chipKey: "users-audit-scope",
      chipLabel: `Scope: ${auditScopeFilter}`,
      testId: "users-audit-filter-chip-scope",
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
    initialViews: smokeMode ? formatUserSavedViews(smokeUserSavedViews) : [],
    formatViews: formatUserSavedViews,
    storageKey: usersSavedViewsStorageKey,
    currentFilters: currentUserView,
    hasFilters: hasUserFilters,
    applyViewFilters,
    pathname,
    copyText: copyTextToClipboard,
    setFeedback: setSuccess,
    setError,
    initialMetaText: smokeMode ? "Loaded from local browser storage." : "Using local browser storage.",
    exportFilename: "deploymate-users-saved-views.json",
    exportScope: "admin-users",
    summaryNoun: "user",
    emptyImportMessage: "No valid saved user views found in this file.",
    wrongScopeMessage: "This file is not a users saved views export.",
    saveSuccessMessage: "Saved current user view.",
    updateSuccessMessage: "Current saved user view updated.",
    deleteSuccessMessage: "Saved user view removed.",
    exportSuccessMessage: "Saved user views exported.",
    clearSuccessMessage: "Saved user views cleared.",
    clearImportedSuccessMessage: "Imported user views removed.",
    resetToolsSuccessMessage: "Saved views tools reset.",
    importMergeMessage: ({ total, replacedCount, skippedCount }) =>
      `Saved user views merged. Total: ${total}. Replaced: ${replacedCount}. Skipped by limit: ${skippedCount}.`,
  });
  const activeFilterChips = buildFilterChipsFromDefinitions(primaryFilterDefinitions);
  const activeAuditFilterChips = buildFilterChipsFromDefinitions(auditFilterDefinitions);
  const {
    currentFilters: currentAuditView,
    hasActiveFilters: hasAuditFilters,
    serializedParams: auditCopyParams,
  } = buildFilterState(auditFilterDefinitions);
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
    initialViews: smokeMode ? formatUserSavedViews(smokeUserAuditViews) : [],
    formatViews: formatUserSavedViews,
    storageKey: usersAuditViewsStorageKey,
    currentFilters: currentAuditView,
    canSaveWhen: hasAuditFilters,
    applyViewFilters: (filters) => applyFilterDefinitions(auditFilterDefinitions, filters),
    pathname,
    copyText: copyTextToClipboard,
    setFeedback: setSuccess,
    setError,
    resetViewFilters: () => applyFilterDefinitions(auditFilterDefinitions, {}),
    copyParams: auditCopyParams,
  });
  const visibleAuditEvents = sortItemsByDateMode(
    auditEvents.filter((item) => auditScopeFilter === "all" || item.target_type === auditScopeFilter),
    {
      valueKey: "created_at",
      mode: auditSort,
    },
  );
  const { syncedSearchParams } = buildFilterState([
    ...primaryFilterDefinitions,
    ...auditFilterDefinitions.filter((definition) => definition.key !== "audit_q"),
  ]);
  const selectedVisibleUserIds = filteredUsers
    .map((user) => user.id)
    .filter((userId) => selectedUserIds.includes(userId));
  const selectedUsers = filteredUsers.filter((user) => selectedUserIds.includes(user.id));
  const selectedUsersPreview = selectedUsers.slice(0, 3).map((user) => user.username).join(", ");
  const allVisibleUsersSelected =
    filteredUsers.length > 0 && selectedVisibleUserIds.length === filteredUsers.length;
  const hasSelectedUsers = selectedUserIds.length > 0;
  const bulkUsersDirty = hasSelectedUsers || bulkRoleValue !== "" || bulkPlanValue !== "";
  const bulkUsersActionSummary = [
    bulkRoleValue ? `role -> ${bulkRoleValue}` : null,
    bulkPlanValue ? `plan -> ${bulkPlanValue}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

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

  async function loadUsers() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (roleFilter !== "all") {
        params.set("role", roleFilter);
      }
      if (planFilter !== "all") {
        params.set("plan", planFilter);
      }
      if (mustChangeFilter !== "all") {
        params.set("must_change_password", mustChangeFilter === "required" ? "true" : "false");
      }
      if (debouncedQuery.trim()) {
        params.set("q", debouncedQuery.trim());
      }
      const response = await fetch(`${apiBaseUrl}/admin/users?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await readJsonOrError(response, "Failed to load users.");
      setUsers(Array.isArray(data) ? data : []);
      setAccessDenied(false);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }
      if (requestError instanceof Error && requestError.status === 403) {
        setAccessDenied(true);
        setUsers([]);
        return;
      }
      setError(
        requestError instanceof Error ? requestError.message : "Failed to load users.",
      );
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  function applyViewFilters(filters) {
    applyFilterDefinitions(primaryFilterDefinitions, filters);
  }

  async function refreshPageData() {
    await Promise.all([loadUsers(), loadAdminOverview(), loadAuditEvents()]);
  }

  useEffect(() => {
    if (!success && !error) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      setSuccess("");
      setError("");
    }, 4000);
    return () => window.clearTimeout(timeoutId);
  }, [success, error]);

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

  function updateFormField(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function handleCreateUser(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await readJsonOrError(
        await fetch(`${apiBaseUrl}/admin/users`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(form),
        }),
        "Failed to create user.",
      );
      setForm({
        username: "",
        password: "",
        role: "member",
      });
      setSuccess("User created successfully.");
      await refreshPageData();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Failed to create user.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoleChange(userId, role) {
    setUpdatingUserId(userId);
    setError("");
    setSuccess("");

    try {
      await readJsonOrError(
        await fetch(`${apiBaseUrl}/admin/users/${userId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ role }),
        }),
        "Failed to update user role.",
      );
      setSuccess("User role updated successfully.");
      await refreshPageData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to update user role.",
      );
    } finally {
      setUpdatingUserId("");
    }
  }

  async function handlePlanChange(userId, plan) {
    setUpdatingUserId(userId);
    setError("");
    setSuccess("");

    try {
      await readJsonOrError(
        await fetch(`${apiBaseUrl}/admin/users/${userId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ plan }),
        }),
        "Failed to update user plan.",
      );
      setSuccess("User plan updated successfully.");
      await refreshPageData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to update user plan.",
      );
    } finally {
      setUpdatingUserId("");
    }
  }

  async function handleDeleteUser(userId) {
    const confirmed = window.confirm("Delete this user?");
    if (!confirmed) {
      return;
    }

    setDeletingUserId(userId);
    setError("");
    setSuccess("");

    try {
      await readJsonOrError(
        await fetch(`${apiBaseUrl}/admin/users/${userId}`, {
          method: "DELETE",
          credentials: "include",
        }),
        "Failed to delete user.",
      );
      setSuccess("User deleted successfully.");
      await refreshPageData();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Failed to delete user.",
      );
    } finally {
      setDeletingUserId("");
    }
  }

  function handleToggleUserSelection(userId) {
    setSelectedUserIds((currentIds) =>
      currentIds.includes(userId)
        ? currentIds.filter((item) => item !== userId)
        : [...currentIds, userId],
    );
  }

  function handleToggleVisibleUsers() {
    const visibleIds = filteredUsers.map((user) => user.id);
    if (visibleIds.length === 0) {
      return;
    }
    setSelectedUserIds((currentIds) => {
      if (visibleIds.every((userId) => currentIds.includes(userId))) {
        return currentIds.filter((userId) => !visibleIds.includes(userId));
      }
      return Array.from(new Set([...currentIds, ...visibleIds]));
    });
  }

  function handleSelectUsersByRole(role) {
    const matchingIds = filteredUsers
      .filter((user) => user.role === role)
      .map((user) => user.id);
    setSelectedUserIds(matchingIds);
    setSuccess(`${matchingIds.length} ${role} user${matchingIds.length === 1 ? "" : "s"} selected.`);
    setError("");
  }

  function handleSelectUsersNeedingPasswordChange() {
    const matchingIds = filteredUsers
      .filter((user) => user.must_change_password)
      .map((user) => user.id);
    setSelectedUserIds(matchingIds);
    setSuccess(
      `${matchingIds.length} user${matchingIds.length === 1 ? "" : "s"} requiring a password change selected.`,
    );
    setError("");
  }

  function handleSelectVisibleUsersWithAuditFilter() {
    const matchingIds = filteredUsers.map((user) => user.id);
    setSelectedUserIds(matchingIds);
    setSuccess(
      `${matchingIds.length} visible user${matchingIds.length === 1 ? "" : "s"} selected from the current user filter view.`,
    );
    setError("");
  }

  function handleClearSelectedUsers() {
    setSelectedUserIds([]);
    setSuccess("Selection cleared.");
    setError("");
  }

  function handleResetBulkUsersTools() {
    setSelectedUserIds([]);
    setBulkRoleValue("");
    setBulkPlanValue("");
    setSuccess("Bulk tools reset.");
    setError("");
  }

  async function handleBulkUserPatch(patch, successMessage, fallbackMessage) {
    if (!selectedUserIds.length) {
      return;
    }

    setBulkUpdating(true);
    setError("");
    setSuccess("");

    try {
      for (const userId of selectedUserIds) {
        await readJsonOrError(
          await fetch(`${apiBaseUrl}/admin/users/${userId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(patch),
          }),
          fallbackMessage,
        );
      }
      setSelectedUserIds([]);
      setSuccess(successMessage);
      await refreshPageData();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : fallbackMessage,
      );
    } finally {
      setBulkUpdating(false);
    }
  }

  async function handleBulkRoleChange() {
    if (!bulkRoleValue || !selectedUserIds.length) {
      return;
    }
    await handleBulkUserPatch(
      { role: bulkRoleValue },
      `Updated role to ${bulkRoleValue} for ${selectedUserIds.length} user${selectedUserIds.length === 1 ? "" : "s"}.`,
      "Failed to update user roles.",
    );
    setBulkRoleValue("");
  }

  async function handleBulkPlanChange() {
    if (!bulkPlanValue || !selectedUserIds.length) {
      return;
    }
    await handleBulkUserPatch(
      { plan: bulkPlanValue },
      `Updated plan to ${bulkPlanValue} for ${selectedUserIds.length} user${selectedUserIds.length === 1 ? "" : "s"}.`,
      "Failed to update user plans.",
    );
    setBulkPlanValue("");
  }

  function handleApplyBulkUserPreset(kind) {
    if (kind === "promote_admins") {
      setBulkRoleValue("admin");
      setBulkPlanValue("");
      setSuccess("Preset loaded: promote selected users to admin.");
      setError("");
      return;
    }
    if (kind === "move_to_team") {
      setBulkRoleValue("");
      setBulkPlanValue("team");
      setSuccess("Preset loaded: move selected users to team.");
      setError("");
      return;
    }
    if (kind === "reset_to_trial") {
      setBulkRoleValue("");
      setBulkPlanValue("trial");
      setSuccess("Preset loaded: move selected users to trial.");
      setError("");
    }
  }

  function handleDownloadSelectedUsersExport() {
    if (!selectedUsers.length) {
      return;
    }
    const blob = new Blob([buildSelectedUsersCsv(selectedUsers)], {
      type: "text/csv;charset=utf-8",
    });
    triggerFileDownload("deploymate-selected-users.csv", blob);
    setSuccess("Selected users export downloaded.");
    setError("");
  }

  function handleDownloadFilteredUsersExport() {
    if (!filteredUsers.length) {
      return;
    }
    const blob = new Blob([buildSelectedUsersCsv(filteredUsers)], {
      type: "text/csv;charset=utf-8",
    });
    triggerFileDownload("deploymate-filtered-users.csv", blob);
    setSuccess("Filtered users export downloaded.");
    setError("");
  }

  async function handleDownloadUsersExport() {
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/admin/exports/users?format=csv`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to download users export.");
      }
      const blob = await response.blob();
      triggerFileDownload("deploymate-admin-users.csv", blob);
      setSuccess("Users export downloaded.");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Failed to download users export.",
      );
    }
  }

  async function handleDownloadAuditExport() {
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/admin/exports/audit-events?format=csv`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to download admin audit export.");
      }
      const blob = await response.blob();
      triggerFileDownload("deploymate-admin-audit-events.csv", blob);
      setSuccess("Admin audit export downloaded.");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Failed to download admin audit export.",
      );
    }
  }

  function handleDownloadVisibleAuditExport() {
    const blob = new Blob([buildAuditEventsCsv(visibleAuditEvents)], {
      type: "text/csv;charset=utf-8",
    });
    triggerFileDownload("deploymate-admin-audit-current-view.csv", blob);
    setSuccess("Current audit view exported.");
    setError("");
  }

  async function handleCopyCurrentView() {
    setError("");
    try {
      await copyTextToClipboard(window.location.href);
      setSuccess("Current view link copied.");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Failed to copy current view link.",
      );
    }
  }

  async function handleDownloadBackupBundle() {
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/admin/exports/backup-bundle`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to download backup bundle.");
      }
      const blob = await response.blob();
      triggerFileDownload("deploymate-backup-bundle.json", blob);
      setSuccess("Backup bundle downloaded.");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Failed to download backup bundle.",
      );
    }
  }

  function handleBackupFileChange(event) {
    const [file] = Array.from(event.target.files || []);
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setBackupBundleText(typeof reader.result === "string" ? reader.result : "");
      setRestoreDryRun(null);
      setRestoreSectionFilter("all");
      setSuccess(`Loaded backup file ${file.name}.`);
      setError("");
    };
    reader.onerror = () => {
      setError("Failed to read backup file.");
    };
    reader.readAsText(file);
  }

  async function handleRunRestoreDryRun() {
    setRestoreLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!backupBundleText.trim()) {
        throw new Error("Load or paste a backup bundle first.");
      }

      const parsedBundle = JSON.parse(backupBundleText);
      const response = await fetch(`${apiBaseUrl}/admin/restore/dry-run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ bundle: parsedBundle }),
      });
      const data = await readJsonOrError(response, "Failed to run restore dry-run.");
      setRestoreDryRun(data);
      setRestoreSectionFilter("all");
      setSuccess("Restore dry-run completed.");
    } catch (requestError) {
      setRestoreDryRun(null);
      setError(
        requestError instanceof Error ? requestError.message : "Failed to run restore dry-run.",
      );
    } finally {
      setRestoreLoading(false);
    }
  }

  function handleLoadSampleBundle() {
    setBackupBundleText(
      JSON.stringify(
        {
          manifest: {
            version: "2026-04-01.backup-bundle.v1",
            generated_at: new Date().toISOString(),
            bundle_name: "deploymate-sample-bundle",
            sections: {
              users: 1,
              upgrade_requests: 1,
              audit_events: 0,
              servers: 1,
              deployments: 0,
              templates: 1,
            },
          },
          data: {
            users: [{ id: "sample-user-1", username: "sample-admin", role: "admin", plan: "team" }],
            upgrade_requests: [{ id: "sample-request-1", name: "Sample Team", email: "ops@example.com", current_plan: "trial" }],
            audit_events: [],
            servers: [{ id: "sample-server-1", name: "sample-server", host: "10.0.0.10", port: 22, username: "deploy" }],
            deployments: [],
            templates: [{ id: "sample-template-1", template_name: "sample-template", image: "nginx:latest" }],
          },
        },
        null,
        2,
      ),
    );
    setRestoreDryRun(null);
    setSuccess("Sample bundle loaded.");
    setError("");
  }

  function handleClearBundle() {
    setBackupBundleText("");
    setRestoreDryRun(null);
    setRestoreSectionFilter("all");
    setSuccess("Backup bundle editor cleared.");
    setError("");
  }

  function handleDownloadRestoreReportJson() {
    if (!restoreDryRun) {
      return;
    }
    const blob = new Blob([JSON.stringify(restoreDryRun, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    triggerFileDownload("deploymate-restore-dry-run-report.json", blob);
    setSuccess("Validation report JSON downloaded.");
  }

  function handleDownloadRestoreReportCsv() {
    if (!restoreDryRun) {
      return;
    }
    const blob = new Blob([buildRestoreDryRunCsv(restoreDryRun)], {
      type: "text/csv;charset=utf-8",
    });
    triggerFileDownload("deploymate-restore-dry-run-report.csv", blob);
    setSuccess("Validation report CSV downloaded.");
  }

  async function handleCopyRestoreSummary() {
    if (!restoreDryRun) {
      return;
    }
    await copyTextToClipboard(restoreReportDigest);
    setSuccess("Validation summary copied.");
  }

  function handleDownloadRestoreIssuesCsv() {
    if (!restoreDryRun) {
      return;
    }
    const blob = new Blob([buildRestoreIssuesCsv(restoreDryRun)], {
      type: "text/csv;charset=utf-8",
    });
    triggerFileDownload("deploymate-restore-dry-run-issues.csv", blob);
    setSuccess("Validation issues CSV downloaded.");
  }

  function resetUserFilters() {
    setQuery("");
    setRoleFilter("all");
    setPlanFilter("all");
    setMustChangeFilter("all");
    setAuditQuery("");
  }

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
    setSelectedUserIds((currentIds) =>
      currentIds.filter((userId) => users.some((user) => user.id === userId)),
    );
  }, [users]);

  useEffect(() => {
    if (smokeMode || !authChecked || accessDenied) {
      return;
    }
    loadUsers();
  }, [authChecked, accessDenied, debouncedQuery, roleFilter, planFilter, mustChangeFilter]);

  useEffect(() => {
    if (smokeMode || !authChecked || accessDenied) {
      return;
    }
    loadAuditEvents();
  }, [authChecked, accessDenied, debouncedAuditQuery]);

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
          title="Users"
          titleTestId="users-page-title"
          subtitle={currentUser ? `Admin users management · ${currentUser.username}` : "Users"}
          loading={loading}
          onRefresh={refreshPageData}
          refreshTestId="users-refresh-button"
          actions={[
            { label: "Copy link", testId: "users-copy-link-button", onClick: handleCopyCurrentView },
            { label: "Export CSV", testId: "users-export-button", onClick: handleDownloadUsersExport },
            { label: "Audit CSV", testId: "users-audit-export-button", onClick: handleDownloadAuditExport },
          ]}
        />

        <AdminFeedbackBanners
          smokeMode={smokeMode}
          error={error}
          success={success}
          errorTestId="users-error-banner"
          successTestId="users-success-banner"
        />

        {adminOverview ? (
          <article className="card formCard">
            <div className="sectionHeader">
              <div>
                <h2>Admin overview</h2>
                <p className="formHint">Server-side snapshot of users, plans, and security state.</p>
              </div>
            </div>
            <div className="overviewGrid">
              <div className="overviewCard">
                <span className="overviewLabel">Users</span>
                <strong className="overviewValue">{adminOverview.users.total}</strong>
                <div className="overviewMeta">
                  <span>Admins {adminOverview.users.admins}</span>
                  <span>Members {adminOverview.users.members}</span>
                  <span>Password changes required {adminOverview.users.must_change_password}</span>
                </div>
              </div>
              <div className="overviewCard">
                <span className="overviewLabel">Plans</span>
                <strong className="overviewValue">{adminOverview.users.team + adminOverview.users.solo}</strong>
                <div className="overviewMeta">
                  <span>Trial {adminOverview.users.trial}</span>
                  <span>Solo {adminOverview.users.solo}</span>
                  <span>Team {adminOverview.users.team}</span>
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
          title="Admin audit trail"
          description="Recent admin actions across users and upgrade handling."
          query={auditQuery}
          onQueryChange={(event) => setAuditQuery(event.target.value)}
          queryPlaceholder="user.updated, alice, approved"
          queryTestId="users-audit-search"
          filterLabel="Scope"
          filterValue={auditScopeFilter}
          onFilterChange={(event) => setAuditScopeFilter(event.target.value)}
          filterOptions={[
            { label: "All targets", value: "all" },
            { label: "Users", value: "user" },
            { label: "Upgrade requests", value: "upgrade_request" },
          ]}
          filterTestId="users-audit-scope-filter"
          sortValue={auditSort}
          onSortChange={(event) => setAuditSort(event.target.value)}
          sortTestId="users-audit-sort"
          totalCount={visibleAuditEvents.length}
          summary="Audit search updates after a short pause."
          filters={activeAuditFilterChips}
          actions={[
            { label: "Copy audit link", testId: "users-audit-copy-link-button", onClick: handleCopyAuditViewLink },
            { label: "Export current CSV", testId: "users-audit-current-export-button", onClick: handleDownloadVisibleAuditExport, disabled: visibleAuditEvents.length === 0 },
            { label: "Reset audit", testId: "users-audit-reset-button", onClick: handleResetAuditTools, disabled: !(auditQuery.trim() || auditScopeFilter !== "all" || auditSort !== "newest") },
          ]}
          emptyTestId="users-audit-empty-state"
          emptyText={auditQuery.trim() ? "No admin audit events match this search." : "No admin audit events yet."}
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
                  <span>{item.target_type} · {item.target_label || item.target_id || "-"}</span>
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
            saveTestId="users-save-audit-view-button"
            saveLabel={hasAuditViewNameMatch ? "Update audit view" : "Save audit view"}
            inputHint="Save the current audit query, scope, and sort. Audit presets are stored separately from the main users saved views."
            inputCountText={`${normalizedAuditViewName.length}/40 characters`}
            views={auditViews}
            onApply={handleApplyAuditView}
            onDelete={handleDeleteAuditView}
            emptyText="No saved audit views yet."
            listTestId="users-audit-views-list"
            activeViewId={activeAuditViewId}
          />
        </article>

        <article className="card formCard">
          <div className="sectionHeader">
            <div>
              <h2 data-testid="backup-panel-title">Backup and restore dry run</h2>
              <p className="formHint">
                Export a full admin backup bundle, then validate a restore bundle without applying any changes.
              </p>
            </div>
          </div>
          <div className="backupActions">
            <button type="button" data-testid="backup-download-bundle-button" onClick={handleDownloadBackupBundle}>
              Download backup bundle
            </button>
            <button type="button" data-testid="backup-paste-sample-button" onClick={handleLoadSampleBundle}>
              Paste sample
            </button>
            <label className="linkButton backupUploadButton">
              Load backup file
              <input data-testid="backup-upload-file-input" type="file" accept="application/json,.json" onChange={handleBackupFileChange} />
            </label>
            <button type="button" data-testid="backup-clear-bundle-button" onClick={handleClearBundle} disabled={!backupBundleText.trim()}>
              Clear bundle
            </button>
            <button
              type="button"
              data-testid="restore-dry-run-button"
              onClick={handleRunRestoreDryRun}
              disabled={restoreLoading || bundleAnalysis.status !== "ready"}
            >
              {restoreLoading ? "Validating..." : "Run restore dry-run"}
            </button>
            <button
              type="button"
              data-testid="restore-report-json-button"
              onClick={handleDownloadRestoreReportJson}
              disabled={!restoreDryRun}
            >
              Report JSON
            </button>
            <button type="button" data-testid="restore-report-csv-button" onClick={handleDownloadRestoreReportCsv} disabled={!restoreDryRun}>
              Report CSV
            </button>
            <button type="button" data-testid="restore-copy-summary-button" onClick={handleCopyRestoreSummary} disabled={!restoreDryRun}>
              Copy summary
            </button>
            <button type="button" data-testid="restore-report-issues-csv-button" onClick={handleDownloadRestoreIssuesCsv} disabled={!restoreDryRun}>
              Issues CSV
            </button>
          </div>
          <label className="field">
            <span>Bundle JSON</span>
            <textarea
              value={backupBundleText}
              onChange={(event) => setBackupBundleText(event.target.value)}
              placeholder='{"manifest": {...}, "data": {...}}'
            />
          </label>
          <p className="formHint">Paste an exported bundle JSON here or load a saved `.json` file before running validation.</p>
          <p className="formHint">Bundle size: {backupBundleText.length} chars · {bundleLineCount} lines.</p>
          <div
            data-testid="backup-preflight-banner"
            className={`banner ${bundleAnalysis.status === "invalid" ? "error" : bundleAnalysis.status === "ready" ? "success" : "subtle"}`}
          >
            {bundleAnalysis.message}
          </div>
          {bundleAnalysis.manifest ? (
            <div className="backupManifestGrid" data-testid="backup-manifest-preview">
              <div className="backupManifestItem">
                <span className="label">Bundle</span>
                <strong>{bundleAnalysis.manifest.bundle_name || "N/A"}</strong>
              </div>
              <div className="backupManifestItem">
                <span className="label">Version</span>
                <strong>{bundleAnalysis.manifest.version || "N/A"}</strong>
              </div>
              <div className="backupManifestItem">
                <span className="label">Sections</span>
                <strong>{bundleAnalysis.sectionCount}</strong>
              </div>
              <div className="backupManifestItem">
                <span className="label">Records</span>
                <strong>{bundleAnalysis.recordCount}</strong>
              </div>
            </div>
          ) : null}
          {restoreDryRun ? (
            <div className="backupReport" data-testid="restore-report">
              <div className="overviewGrid">
                <div className="overviewCard">
                  <span className="overviewLabel">Bundle</span>
                  <strong className="overviewValue">{restoreDryRun.manifest.bundle_name}</strong>
                  <div className="overviewMeta">
                    <span>Version {restoreDryRun.manifest.version}</span>
                    <span>Generated {formatDate(restoreDryRun.manifest.generated_at)}</span>
                  </div>
                </div>
                <div className="overviewCard">
                  <span className="overviewLabel">Validation summary</span>
                  <strong className="overviewValue">{restoreDryRun.summary.total_records}</strong>
                  <div className="overviewMeta">
                    <span>Sections {restoreDryRun.summary.total_sections}</span>
                    <span>Blockers {restoreDryRun.summary.blocker_count}</span>
                    <span>Warnings {restoreDryRun.summary.warning_count}</span>
                  </div>
                </div>
              </div>
              <div className="backupSummaryBadges" data-testid="restore-summary-badges">
                <span className="status healthy">safe {restoreDryRun.summary.ok_sections}</span>
                <span className="status warn">review {restoreDryRun.summary.review_required_sections}</span>
                <span className="status error">blocked {restoreDryRun.summary.blocked_sections}</span>
              </div>
              <div className="banner subtle" data-testid="restore-summary-digest">
                {restoreReportDigest}
              </div>
              <div className="overviewGrid" data-testid="restore-attention-overview">
                <div className="overviewCard">
                  <span className="overviewLabel">Attention sections</span>
                  <strong className="overviewValue">
                    {restoreDryRun.summary.blocked_sections + restoreDryRun.summary.review_required_sections}
                  </strong>
                  <div className="overviewMeta">
                    <span>Blocked {restoreDryRun.summary.blocked_sections}</span>
                    <span>Review {restoreDryRun.summary.review_required_sections}</span>
                  </div>
                </div>
                <div className="overviewCard">
                  <span className="overviewLabel">Issue volume</span>
                  <strong className="overviewValue">
                    {restoreDryRun.summary.blocker_count + restoreDryRun.summary.warning_count}
                  </strong>
                  <div className="overviewMeta">
                    <span>Blockers {restoreDryRun.summary.blocker_count}</span>
                    <span>Warnings {restoreDryRun.summary.warning_count}</span>
                  </div>
                </div>
              </div>
              <div className="adminSavedViewsComposer">
                <label className="field">
                  <span>Section status</span>
                  <select data-testid="restore-section-filter" value={restoreSectionFilter} onChange={(event) => setRestoreSectionFilter(event.target.value)}>
                    <option value="all">All sections</option>
                    <option value="ok">Safe</option>
                    <option value="warn">Review</option>
                    <option value="error">Blocked</option>
                  </select>
                </label>
              </div>
              <div className="backupManifestGrid" data-testid="restore-manifest-counts">
                {Object.entries(restoreDryRun.manifest.sections || {}).map(([name, count]) => (
                  <div key={name} className="backupManifestItem">
                    <span className="label">{name}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
              <div className="backupSectionChips" data-testid="restore-section-chips">
                {restoreDryRun.sections.map((section) => (
                  <button
                    key={section.name}
                    type="button"
                    className="adminFilterChip"
                    onClick={() => setRestoreSectionFilter(section.status)}
                  >
                    <span>{section.name}</span>
                    <span className={`status ${section.status === "ok" ? "healthy" : section.status}`}>
                      {section.status}
                    </span>
                  </button>
                ))}
              </div>
              <div className="overviewAttentionList">
                {visibleRestoreSections.map((section) => (
                  <div className="overviewAttentionItem" key={section.name} data-testid={`restore-section-${section.name}`}>
                    <div className="row">
                      <span className="label">Section</span>
                      <span>{section.name}</span>
                    </div>
                    <div className="row">
                      <span className="label">Status</span>
                      <span className={`status ${section.status === "ok" ? "healthy" : section.status}`}>
                        {section.status}
                      </span>
                    </div>
                    <div className="row">
                      <span className="label">Records</span>
                      <span>{section.incoming_count} incoming · {section.current_count} current</span>
                    </div>
                    {section.blockers.length > 0 ? (
                      <div className="backupIssueList">
                        {section.blockers.map((issue, index) => (
                          <div className="row" key={`${section.name}-blocker-${issue.code}-${index}`}>
                            <span className="label">Blocker</span>
                            <span>{issue.message}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {section.warnings.length > 0 ? (
                      <div className="backupIssueList">
                        {section.warnings.map((issue, index) => (
                          <div className="row" key={`${section.name}-warning-${issue.code}-${index}`}>
                            <span className="label">Warning</span>
                            <span>{issue.message}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {section.notes.length > 0 ? (
                      <div className="backupIssueList">
                        {section.notes.map((note, index) => (
                          <div className="row" key={`${section.name}-note-${index}`}>
                            <span className="label">Note</span>
                            <span>{note}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </article>

        <article className="card formCard">
          <div className="sectionHeader">
            <h2>Users overview</h2>
            <p className="formHint">
              Filter by role or plan, and search by username.
            </p>
          </div>
          <div className="deploymentControls">
            <div className="filterTabs" role="tablist" aria-label="User role filters">
              <button
                type="button"
                className={roleFilter === "all" ? "active" : ""}
                onClick={() => setRoleFilter("all")}
              >
                All roles
              </button>
              <button
                type="button"
                className={roleFilter === "admin" ? "active" : ""}
                onClick={() => setRoleFilter("admin")}
              >
                Admin
              </button>
              <button
                type="button"
                className={roleFilter === "member" ? "active" : ""}
                onClick={() => setRoleFilter("member")}
              >
                Member
              </button>
            </div>
            <div className="filterTabs" role="tablist" aria-label="User plan filters">
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
            <div className="filterTabs" role="tablist" aria-label="Password change filters">
              <button
                type="button"
                className={mustChangeFilter === "all" ? "active" : ""}
                onClick={() => setMustChangeFilter("all")}
              >
                All security states
              </button>
              <button
                type="button"
                className={mustChangeFilter === "required" ? "active" : ""}
                onClick={() => setMustChangeFilter("required")}
              >
                Change required
              </button>
              <button
                type="button"
                className={mustChangeFilter === "ok" ? "active" : ""}
                onClick={() => setMustChangeFilter("ok")}
              >
                Password OK
              </button>
            </div>
            <label className="field deploymentSearch">
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="admin, alice, bob"
              />
            </label>
          </div>
          <AdminFilterFooter
            summary={`Showing ${filteredUsers.length} user${filteredUsers.length === 1 ? "" : "s"} for the current filters.`}
            hint="User and audit filters stay in the URL, so this view can be shared or saved locally."
            onReset={resetUserFilters}
            resetDisabled={!hasUserFilters}
            resetTestId="users-reset-filters-button"
            actions={[
              {
                label: "Copy filter link",
                testId: "users-copy-filter-link-button",
                onClick: handleCopyCurrentView,
              },
            ]}
          />
        </article>

        <article className="card formCard">
          <AdminSavedViews
            title="Saved user views"
            inputLabel="View name"
            inputValue={savedViewName}
            onInputChange={(event) => setSavedViewName(event.target.value)}
            onSave={handleSaveCurrentView}
            onUpdateCurrent={handleUpdateCurrentView}
            saveDisabled={!canSaveCurrentView || reachedViewLimitWithoutReplace}
            updateDisabled={!activeSavedViewHasChanges}
            saveTestId="users-save-view-button"
            updateTestId="users-update-current-view-button"
            saveLabel={hasSavedViewNameMatch ? "Update saved view" : "Save current view"}
            inputHint="Names are case-insensitive and extra spaces are normalized. Matching names update the existing saved view."
            inputCountText={`${normalizedSavedViewName.length}/40 characters`}
            viewSummaryText={savedViewsSummaryText}
            useCurrentNameLabel="Use current name"
            onUseCurrentName={handleUseCurrentSavedViewName}
            useCurrentNameDisabled={!activeSavedView?.name}
            searchValue={savedViewsSearch}
            onSearchChange={(event) => setSavedViewsSearch(event.target.value)}
            searchTestId="users-saved-views-search"
            searchPlaceholder="admins, team, imported"
            sourceFilter={savedViewsSourceFilter}
            onSourceFilterChange={(event) => setSavedViewsSourceFilter(event.target.value)}
            sourceFilterTestId="users-saved-views-source-filter"
            sortValue={savedViewsSort}
            onSortChange={(event) => setSavedViewsSort(event.target.value)}
            sortTestId="users-saved-views-sort"
            statusText={
              !hasUserFilters
                ? "Set at least one user or audit filter before saving a view."
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
                testId: "users-export-saved-views-button",
                onClick: handleDownloadSavedViews,
                disabled: savedViews.length === 0,
              },
              {
                label: "Import views",
                testId: "users-import-saved-views-button",
                kind: "file",
                accept: "application/json,.json",
                onChange: handleImportSavedViews,
              },
              {
                label: "Clear all",
                testId: "users-clear-saved-views-button",
                onClick: handleClearSavedViews,
                disabled: savedViews.length === 0,
              },
              {
                label: "Clear imported",
                testId: "users-clear-imported-saved-views-button",
                onClick: handleClearImportedSavedViews,
                disabled: !savedViews.some((item) => item.source === "imported"),
              },
              {
                label: "Reset tools",
                testId: "users-reset-saved-views-tools-button",
                onClick: handleResetSavedViewsTools,
                disabled: !savedViewsToolsDirty,
              },
            ]}
            emptyText={
              savedViews.length === 0
                ? "No saved user views yet."
                : "No saved user views match this search or source filter."
            }
            listTestId="users-saved-views-list"
            activeViewId={activeSavedViewId}
          />
        </article>

        <article className="card formCard">
          <h2>Create user</h2>
          <form className="form" onSubmit={handleCreateUser}>
            <label className="field">
              <span>Username</span>
              <input
                name="username"
                value={form.username}
                onChange={updateFormField}
                disabled={submitting}
                placeholder="new-admin"
                required
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={updateFormField}
                disabled={submitting}
                placeholder="Temporary password"
                required
              />
            </label>

            <label className="field">
              <span>Role</span>
              <select
                name="role"
                value={form.role}
                onChange={updateFormField}
                disabled={submitting}
              >
                <option value="member">member</option>
                <option value="admin">admin</option>
              </select>
            </label>

            <div className="formActions">
              <button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create user"}
              </button>
            </div>
            <p className="formHint">New users start on the `trial` plan and can be updated immediately after creation.</p>
          </form>
        </article>

        <article className="card formCard" data-testid="users-bulk-card">
          <div className="sectionHeader">
            <div>
              <h2 data-testid="users-bulk-title">Bulk user actions</h2>
              <p className="formHint">
                Bulk selection follows the current server-side user filters.
              </p>
              <p className="formHint" data-testid="users-bulk-selection-summary">
                Selected {selectedUserIds.length} · Visible {filteredUsers.length}
              </p>
              {hasSelectedUsers ? (
                <p className="formHint">
                  {selectedUsers.length > 3
                    ? `${selectedUsersPreview} +${selectedUsers.length - 3} more`
                    : selectedUsersPreview}
                </p>
              ) : null}
              <div className="backupSummaryBadges" data-testid="users-bulk-stats">
                <span className="status info">selected {selectedUserIds.length}</span>
                <span className="status unknown">visible {filteredUsers.length}</span>
                <span className="status unknown">admins {filteredUsers.filter((user) => user.role === "admin").length}</span>
                <span className="status unknown">members {filteredUsers.filter((user) => user.role === "member").length}</span>
              </div>
            </div>
            <div className="actions">
              <button
                type="button"
                className="secondaryButton"
                data-testid="users-bulk-select-visible-button"
                onClick={handleToggleVisibleUsers}
                disabled={filteredUsers.length === 0 || bulkUpdating}
              >
                {allVisibleUsersSelected ? "Unselect visible" : `Select visible (${filteredUsers.length})`}
              </button>
              <button
                type="button"
                className="secondaryButton"
                data-testid="users-bulk-clear-selection-button"
                onClick={handleClearSelectedUsers}
                disabled={!hasSelectedUsers || bulkUpdating}
              >
                Clear selection
              </button>
              <button
                type="button"
                className="secondaryButton"
                data-testid="users-bulk-export-selection-button"
                onClick={handleDownloadSelectedUsersExport}
                disabled={!hasSelectedUsers || bulkUpdating}
              >
                Export selection
              </button>
              <button
                type="button"
                className="secondaryButton"
                data-testid="users-bulk-export-filtered-button"
                onClick={handleDownloadFilteredUsersExport}
                disabled={filteredUsers.length === 0 || bulkUpdating}
              >
                Export current filter
              </button>
              <button
                type="button"
                className="secondaryButton"
                data-testid="users-bulk-select-admins-button"
                onClick={() => handleSelectUsersByRole("admin")}
                disabled={bulkUpdating || !filteredUsers.some((user) => user.role === "admin")}
              >
                Select admins
              </button>
              <button
                type="button"
                className="secondaryButton"
                data-testid="users-bulk-select-members-button"
                onClick={() => handleSelectUsersByRole("member")}
                disabled={bulkUpdating || !filteredUsers.some((user) => user.role === "member")}
              >
                Select members
              </button>
              <button
                type="button"
                className="secondaryButton"
                data-testid="users-bulk-select-password-required-button"
                onClick={handleSelectUsersNeedingPasswordChange}
                disabled={bulkUpdating || !filteredUsers.some((user) => user.must_change_password)}
              >
                Select password required
              </button>
              <button
                type="button"
                className="secondaryButton"
                data-testid="users-bulk-select-current-filter-button"
                onClick={handleSelectVisibleUsersWithAuditFilter}
                disabled={bulkUpdating || filteredUsers.length === 0}
              >
                Select current filter
              </button>
              <button
                type="button"
                className="secondaryButton"
                data-testid="users-bulk-reset-tools-button"
                onClick={handleResetBulkUsersTools}
                disabled={!bulkUsersDirty || bulkUpdating}
              >
                Reset bulk tools
              </button>
            </div>
          </div>

          <div className="bulkActionsGrid">
            <div className="field" data-testid="users-bulk-presets">
              <span>Quick presets</span>
              <div className="actions">
                <button
                  type="button"
                  className="secondaryButton"
                  data-testid="users-bulk-preset-admin-button"
                  onClick={() => handleApplyBulkUserPreset("promote_admins")}
                  disabled={bulkUpdating}
                >
                  Promote to admin
                </button>
                <button
                  type="button"
                  className="secondaryButton"
                  data-testid="users-bulk-preset-team-button"
                  onClick={() => handleApplyBulkUserPreset("move_to_team")}
                  disabled={bulkUpdating}
                >
                  Move to team
                </button>
                <button
                  type="button"
                  className="secondaryButton"
                  data-testid="users-bulk-preset-trial-button"
                  onClick={() => handleApplyBulkUserPreset("reset_to_trial")}
                  disabled={bulkUpdating}
                >
                  Move to trial
                </button>
              </div>
            </div>
            <label className="field">
              <span>Bulk role</span>
              <select
                data-testid="users-bulk-role-select"
                value={bulkRoleValue}
                onChange={(event) => setBulkRoleValue(event.target.value)}
                disabled={bulkUpdating}
              >
                <option value="">Keep current role</option>
                <option value="member">member</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <button
              type="button"
              className="secondaryButton"
              data-testid="users-bulk-role-apply-button"
              onClick={handleBulkRoleChange}
              disabled={!hasSelectedUsers || !bulkRoleValue || bulkUpdating}
            >
              {bulkUpdating ? "Applying..." : "Apply role"}
            </button>

            <label className="field">
              <span>Bulk plan</span>
              <select
                data-testid="users-bulk-plan-select"
                value={bulkPlanValue}
                onChange={(event) => setBulkPlanValue(event.target.value)}
                disabled={bulkUpdating}
              >
                <option value="">Keep current plan</option>
                <option value="trial">trial</option>
                <option value="solo">solo</option>
                <option value="team">team</option>
              </select>
            </label>
            <button
              type="button"
              className="secondaryButton"
              data-testid="users-bulk-plan-apply-button"
              onClick={handleBulkPlanChange}
              disabled={!hasSelectedUsers || !bulkPlanValue || bulkUpdating}
            >
              {bulkUpdating ? "Applying..." : "Apply plan"}
            </button>
          </div>
          <p className="formHint">
            Bulk user actions use the current selection only and reuse the existing single-user admin update path.
          </p>
          <p className="formHint">
            Fast selectors respect the current server-side filters and let you stage a role or plan update without changing the current list view.
          </p>
          <p className="formHint" data-testid="users-bulk-action-summary">
            {hasSelectedUsers
              ? bulkUsersActionSummary
                ? `Ready to apply: ${bulkUsersActionSummary}.`
                : "Pick a role or plan target to enable bulk apply."
              : "Select at least one user to enable bulk actions."}
          </p>
        </article>

        {loading && users.length === 0 ? (
          <div className="empty">Loading users...</div>
        ) : null}

        {!loading && users.length === 0 ? (
          <div className="empty" data-testid="users-empty-state">No users found for the current filters.</div>
        ) : null}

        <div className="list">
          {!loading && users.length > 0 && filteredUsers.length === 0 ? (
            <div className="empty" data-testid="users-filter-empty-state">No users match this filter or search.</div>
          ) : null}

          {filteredUsers.map((user) => (
            <article className="card compactCard adminEntityCard" key={user.id}>
              <div className="adminEntityCardHeader">
                <div>
                  <span className="adminEntityCardEyebrow">User</span>
                  <h3>{user.username}</h3>
                  <p>
                    {user.role} · {user.plan} ·{" "}
                    {user.must_change_password ? "password change required" : "password OK"}
                  </p>
                </div>
                <label className="bulkSelectLabel">
                  <input
                    type="checkbox"
                    data-testid={`users-select-${user.id}`}
                    checked={selectedUserIds.includes(user.id)}
                    onChange={() => handleToggleUserSelection(user.id)}
                    disabled={bulkUpdating}
                  />
                  <span>Select user</span>
                </label>
              </div>
              <div className="adminEntityCardMetrics">
                <div className="adminEntityMetric">
                  <span>Role</span>
                  <strong>{user.role}</strong>
                </div>
                <div className="adminEntityMetric">
                  <span>Plan</span>
                  <strong>{user.plan}</strong>
                </div>
                <div className="adminEntityMetric">
                  <span>Security</span>
                  <strong>{user.must_change_password ? "Change required" : "Password OK"}</strong>
                </div>
              </div>
              <div className="row">
                <span className="label">Username</span>
                <span>{user.username}</span>
              </div>
              <div className="row">
                <span className="label">Plan</span>
                <span>{user.plan}</span>
              </div>
              <div className="row">
                <span className="label">Role</span>
                <span>{user.role}</span>
              </div>
              <div className="row">
                <span className="label">Password</span>
                <span>{user.must_change_password ? "Change required" : "OK"}</span>
              </div>
              <div className="row">
                <span className="label">Created</span>
                <span>{formatDate(user.created_at)}</span>
              </div>
              <div className="actions">
                <select
                  value={user.role}
                  onChange={(event) => handleRoleChange(user.id, event.target.value)}
                  disabled={updatingUserId === user.id || deletingUserId === user.id || bulkUpdating}
                >
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                </select>
                <select
                  value={user.plan}
                  onChange={(event) => handlePlanChange(user.id, event.target.value)}
                  disabled={updatingUserId === user.id || deletingUserId === user.id || bulkUpdating}
                >
                  <option value="trial">trial</option>
                  <option value="solo">solo</option>
                  <option value="team">team</option>
                </select>
                <button
                  type="button"
                  className="dangerButton"
                  onClick={() => handleDeleteUser(user.id)}
                  disabled={deletingUserId === user.id || updatingUserId === user.id || bulkUpdating}
                >
                  {deletingUserId === user.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<main className="page"><div className="container"><div className="empty">Loading admin users...</div></div></main>}>
      <UsersPageContent />
    </Suspense>
  );
}
