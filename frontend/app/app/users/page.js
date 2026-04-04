"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  AdminActiveFilters,
  AdminAuditToolbar,
  AdminDisclosureSection,
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
  smokeRestoreImportPlan,
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
  persistSessionJson,
  readErrorMessageFromResponse,
  readJsonOrError,
  sortItemsByDateMode,
  triggerFileDownload,
} from "../../lib/admin-page-utils";
import {
  analyzeBackupBundleText,
  buildRestoreFilteredSectionsCsv,
  buildRestoreDryRunCsv,
  buildRestoreImportPlanMarkdown,
  buildRestoreIssuesCsv,
  buildRestorePreparationMarkdown,
  buildRestoreReportDigest,
  buildSelectedUsersCsv,
} from "../../lib/admin-export-utils";
import {
  buildImportReviewHandoffPayload,
  importReviewFeatureRoute,
  importReviewHandoffStorageKey,
} from "../../lib/import-review-feature-pack";
import { formatDate } from "../../lib/runtime-workspace-utils";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const usersSavedViewsStorageKey = "deploymate.admin.users.savedViews";
const usersAuditViewsStorageKey = "deploymate.admin.users.auditViews";

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

function formatPreparationMode(mode) {
  return String(mode || "")
    .split("_")
    .filter(Boolean)
    .join(" ");
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
  const [restoreImportPlan, setRestoreImportPlan] = useState(
    smokeRestoreReportMode ? smokeRestoreImportPlan : null,
  );
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreSectionFilter, setRestoreSectionFilter] = useState("all");
  const [restoreSectionQuery, setRestoreSectionQuery] = useState("");
  const [restoreHighestRiskOnly, setRestoreHighestRiskOnly] = useState(false);
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
    ? restoreDryRun.sections.filter((section) => {
        if (restoreSectionFilter !== "all" && section.status !== restoreSectionFilter) {
          return false;
        }

        if (
          restoreHighestRiskOnly &&
          !(restoreDryRun.summary.highest_risk_sections || []).includes(section.name)
        ) {
          return false;
        }

        const query = restoreSectionQuery.trim().toLowerCase();
        if (!query) {
          return true;
        }

        const haystack = [
          section.name,
          section.status,
          section.preparation_mode,
          section.recommended_action,
          ...(section.notes || []),
          ...(section.blockers || []).map((issue) => issue.message),
          ...(section.warnings || []).map((issue) => issue.message),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
    : [];
  const restorePreparationMarkdown = buildRestorePreparationMarkdown(restoreDryRun);
  const restoreImportPlanMarkdown = buildRestoreImportPlanMarkdown(restoreImportPlan);
  const visibleAdminsCount = filteredUsers.filter((user) => user.role === "admin").length;
  const visibleSecurityFollowUpCount = filteredUsers.filter((user) => user.must_change_password).length;
  const accessFocusLabel =
    visibleSecurityFollowUpCount > 0
      ? "Security follow-up users need attention"
      : visibleAdminsCount > 0
        ? "Admin access is the active review slice"
        : filteredUsers.length > 0
          ? "Member access is the active review slice"
          : "No clear team-access focus yet";
  const accessNextStep =
    visibleSecurityFollowUpCount > 0
      ? "Start with users who still need a password change, then review admin access and only after that create new accounts."
      : visibleAdminsCount > 0
        ? "Review the visible admin accounts first, then move through the remaining team-access changes on screen."
        : filteredUsers.length > 0
          ? "Review the visible teammate access slice first, then create or bulk-update accounts only after the list looks right."
          : "Adjust the filters until this page shows the access slice you actually want to review next.";
  const recoveryFocusLabel = restoreImportPlan
    ? "Controlled import plan is ready for dedicated review"
    : restoreDryRun
      ? "Dry-run already shows the current recovery state"
      : bundleAnalysis.status === "ready"
        ? "Bundle is loaded and ready for validation"
        : "Recovery path is waiting for a bundle";
  const recoveryNextStep = restoreImportPlan
    ? "Open import review workspace for this exact bundle and continue the controlled recovery path there."
    : restoreDryRun
      ? restoreDryRun.summary.next_step
      : bundleAnalysis.status === "ready"
        ? "Validate the loaded bundle first, then build the controlled import plan if the dry-run is usable."
        : "Export or load a bundle first, then run restore validation before using any recovery handoff tools.";
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
        throw new Error(
          await readErrorMessageFromResponse(response, "Failed to download users export."),
        );
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
        throw new Error(
          await readErrorMessageFromResponse(response, "Failed to download admin audit export."),
        );
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
        throw new Error(
          await readErrorMessageFromResponse(response, "Failed to download backup bundle."),
        );
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
      setRestoreImportPlan(null);
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
      setRestoreImportPlan(null);
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
    setRestoreImportPlan(null);
    setSuccess("Sample bundle loaded.");
    setError("");
  }

  function handleClearBundle() {
    setBackupBundleText("");
    setRestoreDryRun(null);
    setRestoreImportPlan(null);
    setRestoreSectionFilter("all");
    setSuccess("Backup bundle editor cleared.");
    setError("");
  }

  function handleBackupBundleTextChange(event) {
    setBackupBundleText(event.target.value);
    setRestoreDryRun(null);
    setRestoreImportPlan(null);
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

  async function handleCopyRestorePreparation() {
    if (!restoreDryRun) {
      return;
    }
    await copyTextToClipboard(
      [
        restoreDryRun.summary.plain_language_summary,
        `Next step: ${restoreDryRun.summary.next_step}`,
        restoreDryRun.summary.preparation_summary,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    setSuccess("Import preparation summary copied.");
  }

  function handleDownloadRestorePreparationMarkdown() {
    if (!restoreDryRun) {
      return;
    }
    const blob = new Blob([restorePreparationMarkdown], {
      type: "text/markdown;charset=utf-8",
    });
    triggerFileDownload("deploymate-restore-import-preparation.md", blob);
    setSuccess("Import preparation markdown downloaded.");
  }

  function handleDownloadVisibleRestoreSectionsCsv() {
    if (!restoreDryRun) {
      return;
    }
    const blob = new Blob([buildRestoreFilteredSectionsCsv(visibleRestoreSections)], {
      type: "text/csv;charset=utf-8",
    });
    triggerFileDownload("deploymate-restore-current-sections.csv", blob);
    setSuccess("Current restore sections CSV downloaded.");
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

  async function handleBuildRestoreImportPlan() {
    setRestoreLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!backupBundleText.trim()) {
        throw new Error("Load or paste a backup bundle first.");
      }

      const parsedBundle = JSON.parse(backupBundleText);
      const response = await fetch(`${apiBaseUrl}/admin/restore/import-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ bundle: parsedBundle }),
      });
      const data = await readJsonOrError(response, "Failed to build restore import plan.");
      setRestoreImportPlan(data);
      setSuccess("Controlled import plan built.");
    } catch (requestError) {
      setRestoreImportPlan(null);
      setError(
        requestError instanceof Error ? requestError.message : "Failed to build restore import plan.",
      );
    } finally {
      setRestoreLoading(false);
    }
  }

  function handleDownloadRestoreImportPlanJson() {
    if (!restoreImportPlan) {
      return;
    }
    const blob = new Blob([JSON.stringify(restoreImportPlan, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    triggerFileDownload("deploymate-restore-import-plan.json", blob);
    setSuccess("Controlled import plan JSON downloaded.");
  }

  function handleDownloadRestoreImportPlanMarkdown() {
    if (!restoreImportPlan) {
      return;
    }
    const blob = new Blob([restoreImportPlanMarkdown], {
      type: "text/markdown;charset=utf-8",
    });
    triggerFileDownload("deploymate-restore-import-plan.md", blob);
    setSuccess("Controlled import plan markdown downloaded.");
  }

  function handleOpenImportReviewWorkspace() {
    if (!restoreDryRun || !restoreImportPlan) {
      setError("Build the controlled import plan before opening import review.");
      setSuccess("");
      return;
    }

    const handoffPayload = buildImportReviewHandoffPayload({
      generated_at: new Date().toISOString(),
      bundle_manifest: restoreDryRun.manifest,
      dry_run: restoreDryRun,
      import_plan: restoreImportPlan,
    });

    if (!handoffPayload || !persistSessionJson(importReviewHandoffStorageKey, handoffPayload)) {
      setError("Failed to stage the import review handoff in this browser session.");
      setSuccess("");
      return;
    }

    router.push(`${importReviewFeatureRoute}?source=restore-handoff`);
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
          primaryAction={{
            label: "Review team access",
            testId: "users-primary-action-button",
            onClick: () => scrollToElement("users-current-review-slice"),
            disabled: false,
          }}
          actions={[
            { label: "Recovery path", testId: "users-recovery-path-button", onClick: () => scrollToElement("users-recovery-path-card") },
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

        <article className="card formCard" data-testid="users-main-next-step-card">
          <div className="sectionHeader">
            <div>
              <h2 data-testid="users-main-next-step-title">Main next step</h2>
              <p className="formHint">
                Work the visible team-access slice first. Creation, bulk tools, audit, and recovery stay secondary until the current access review is clear.
              </p>
            </div>
          </div>
          <div className="row">
            <span className="label">Current focus</span>
            <span data-testid="users-main-next-step-focus">{accessFocusLabel}</span>
          </div>
          <div className="row">
            <span className="label">What to do</span>
            <span data-testid="users-main-next-step-copy">{accessNextStep}</span>
          </div>
          <div className="backupSummaryBadges">
            <span className="status info">visible {filteredUsers.length}</span>
            <span className="status unknown">admins {visibleAdminsCount}</span>
            <span className="status warn">security follow-up {visibleSecurityFollowUpCount}</span>
          </div>
          <div className="actionCluster">
            <button
              type="button"
              className="landingButton primaryButton"
              data-testid="users-main-next-step-button"
              onClick={() => scrollToElement("users-current-review-slice")}
            >
              Open current review slice
            </button>
            <button
              type="button"
              className="secondaryButton"
              data-testid="users-main-next-step-copy-button"
              onClick={() => copyTextToClipboard(accessNextStep).then(() => setSuccess("Team-access next-step summary copied."))}
            >
              Copy next step
            </button>
          </div>
        </article>

        <article id="users-recovery-path-card" className="card formCard" data-testid="users-recovery-path-card">
          <div className="sectionHeader">
            <div>
              <h2 data-testid="users-recovery-path-title">Recovery path</h2>
              <p className="formHint">
                Keep backup validation and restore review visible as a separate path. Use it only when you are doing recovery work, not while reviewing normal team access.
              </p>
            </div>
          </div>
          <div className="row">
            <span className="label">Current focus</span>
            <span data-testid="users-recovery-path-focus">{recoveryFocusLabel}</span>
          </div>
          <div className="row">
            <span className="label">What to do</span>
            <span data-testid="users-recovery-path-copy">{recoveryNextStep}</span>
          </div>
          <div className="actionCluster">
            {restoreImportPlan ? (
              <button
                type="button"
                className="landingButton primaryButton"
                data-testid="users-recovery-open-import-review-button"
                onClick={handleOpenImportReviewWorkspace}
              >
                Open import review workspace
              </button>
            ) : (
              <button
                type="button"
                className="landingButton primaryButton"
                data-testid="users-recovery-open-advanced-button"
                onClick={() => scrollToElement("users-advanced-tools-section")}
              >
                Open recovery tools
              </button>
            )}
            <button
              type="button"
              className="secondaryButton"
              data-testid="users-recovery-copy-button"
              onClick={() => copyTextToClipboard(recoveryNextStep).then(() => setSuccess("Recovery next-step summary copied."))}
            >
              Copy recovery next step
            </button>
          </div>
        </article>

        <AdminDisclosureSection
          title="Advanced audit and recovery"
          subtitle="Open this when review needs an audit trail, export artifact, or restore validation."
          badge={`${visibleAuditEvents.length} activity`}
          sectionId="users-advanced-tools-section"
          testId="users-advanced-tools"
        >
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

          <article className="card formCard backupPanel">
            <div className="sectionHeader">
              <div>
                <h2 data-testid="backup-panel-title">Backup and restore dry run</h2>
                <p className="formHint">
                  Export the current admin state, then validate a restore bundle without applying live changes.
                </p>
              </div>
            </div>
          <div className="backupActionGroup">
            <button
              type="button"
              className="landingButton primaryButton"
              data-testid="backup-download-bundle-button"
              onClick={handleDownloadBackupBundle}
            >
              Export backup bundle
            </button>
            <button type="button" className="softButton" data-testid="backup-paste-sample-button" onClick={handleLoadSampleBundle}>
              Load sample bundle
            </button>
            <label className="linkButton backupUploadButton">
              Load bundle file
              <input data-testid="backup-upload-file-input" type="file" accept="application/json,.json" onChange={handleBackupFileChange} />
            </label>
            <button type="button" className="secondaryButton" data-testid="backup-clear-bundle-button" onClick={handleClearBundle} disabled={!backupBundleText.trim()}>
              Clear bundle
            </button>
          </div>
          <div className="backupActionGroup">
            <button
              type="button"
              className="landingButton primaryButton"
              data-testid="restore-dry-run-button"
              onClick={handleRunRestoreDryRun}
              disabled={restoreLoading || bundleAnalysis.status !== "ready"}
            >
              {restoreLoading ? "Validating..." : "Validate restore bundle"}
            </button>
            <button
              type="button"
              className="softButton"
              data-testid="restore-report-json-button"
              onClick={handleDownloadRestoreReportJson}
              disabled={!restoreDryRun}
            >
              Report JSON
            </button>
            <button type="button" className="softButton" data-testid="restore-report-csv-button" onClick={handleDownloadRestoreReportCsv} disabled={!restoreDryRun}>
              Report CSV
            </button>
            <button type="button" className="softButton" data-testid="restore-copy-summary-button" onClick={handleCopyRestoreSummary} disabled={!restoreDryRun}>
              Copy summary
            </button>
            <button type="button" className="secondaryButton" data-testid="restore-report-issues-csv-button" onClick={handleDownloadRestoreIssuesCsv} disabled={!restoreDryRun}>
              Issues CSV
            </button>
            <button
              type="button"
              className="secondaryButton"
              data-testid="restore-import-plan-button"
              onClick={handleBuildRestoreImportPlan}
              disabled={restoreLoading || bundleAnalysis.status !== "ready"}
            >
              {restoreLoading ? "Building plan..." : "Build controlled import plan"}
            </button>
          </div>
          <label className="field">
            <span>Bundle JSON</span>
            <textarea
              value={backupBundleText}
              onChange={handleBackupBundleTextChange}
              placeholder='{"manifest": {...}, "data": {...}}'
            />
          </label>
          <p className="formHint">Paste an exported bundle here or load a saved `.json` file before running validation.</p>
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
              <div className="overviewGrid" data-testid="restore-preparation-overview">
                <div className="overviewCard" data-testid="restore-readiness-card">
                  <span className="overviewLabel">Import readiness</span>
                  <strong className="overviewValue">{restoreDryRun.summary.readiness_status}</strong>
                  <div className="overviewMeta">
                    {(restoreDryRun.summary.highest_risk_sections || []).length > 0 ? (
                      <span>Risk focus {restoreDryRun.summary.highest_risk_sections.join(", ")}</span>
                    ) : (
                      <span>No high-risk sections detected</span>
                    )}
                  </div>
                </div>
                <div className="overviewCard" data-testid="restore-next-step-card">
                  <span className="overviewLabel">What to do next</span>
                  <strong className="overviewValue">
                    {restoreDryRun.summary.readiness_status === "blocked"
                      ? "Resolve blockers"
                      : restoreDryRun.summary.readiness_status === "review"
                        ? "Clean up review items"
                        : "Prepare controlled import"}
                  </strong>
                  <div className="overviewMeta">
                    <span>{restoreDryRun.summary.next_step}</span>
                  </div>
                </div>
                <div className="overviewCard" data-testid="restore-preparation-mix-card">
                  <span className="overviewLabel">Preparation mix</span>
                  <strong className="overviewValue">{restoreDryRun.summary.prepare_import_sections}</strong>
                  <div className="overviewMeta">
                    <span>Prepare {restoreDryRun.summary.prepare_import_sections}</span>
                    <span>Merge review {restoreDryRun.summary.merge_review_sections}</span>
                    <span>Validate only {restoreDryRun.summary.validate_only_sections}</span>
                    <span>Dry-run only {restoreDryRun.summary.dry_run_only_sections}</span>
                  </div>
                </div>
              </div>
              <div className="banner subtle" data-testid="restore-summary-digest">
                {restoreReportDigest}
              </div>
              <article className="card compactCard" data-testid="restore-preparation-card">
                <div className="sectionHeader">
                  <div>
                    <h3 data-testid="restore-preparation-title">Import preparation</h3>
                    <p className="formHint">
                      Use this summary to explain the restore state to a non-technical reviewer before any future import work.
                    </p>
                  </div>
                </div>
                <div className="row">
                  <span className="label">Plain-language summary</span>
                  <div className="stackedValue">
                    <span data-testid="restore-plain-language-summary">
                      {restoreDryRun.summary.plain_language_summary}
                    </span>
                  </div>
                </div>
                <div className="row">
                  <span className="label">Recommended next step</span>
                  <span data-testid="restore-next-step-summary">{restoreDryRun.summary.next_step}</span>
                </div>
                <div className="row">
                  <span className="label">Preparation mix</span>
                  <span data-testid="restore-preparation-mix-summary">{restoreDryRun.summary.preparation_summary}</span>
                </div>
                <div className="actionCluster">
                  <button
                    type="button"
                    className="softButton"
                    data-testid="restore-copy-preparation-button"
                    onClick={handleCopyRestorePreparation}
                  >
                    Copy preparation summary
                  </button>
                  <button
                    type="button"
                    className="secondaryButton"
                    data-testid="restore-preparation-markdown-button"
                    onClick={handleDownloadRestorePreparationMarkdown}
                  >
                    Preparation markdown
                  </button>
                  <button
                    type="button"
                    className="secondaryButton"
                    data-testid="restore-visible-sections-csv-button"
                    onClick={handleDownloadVisibleRestoreSectionsCsv}
                  >
                    Current sections CSV
                  </button>
                </div>
              </article>
              {restoreImportPlan ? (
                <article className="card compactCard" data-testid="restore-import-plan-card">
                  <div className="sectionHeader">
                    <div>
                      <h3 data-testid="restore-import-plan-title">Controlled import plan</h3>
                      <p className="formHint">
                        This plan narrows future import scope for review, but it still does not authorize any live apply.
                      </p>
                    </div>
                  </div>
                  <div className="overviewGrid" data-testid="restore-import-plan-overview">
                    <div className="overviewCard">
                      <span className="overviewLabel">Plan status</span>
                      <strong className="overviewValue">{restoreImportPlan.summary.plan_status}</strong>
                      <div className="overviewMeta">
                        <span>Apply allowed {restoreImportPlan.summary.apply_allowed ? "yes" : "no"}</span>
                        <span>Plan ID {restoreImportPlan.summary.plan_id}</span>
                      </div>
                    </div>
                    <div className="overviewCard">
                      <span className="overviewLabel">Scope</span>
                      <strong className="overviewValue">{restoreImportPlan.summary.included_sections.length}</strong>
                      <div className="overviewMeta">
                        <span>Included {restoreImportPlan.summary.included_sections.join(", ") || "none"}</span>
                        <span>Blocked {restoreImportPlan.summary.blocked_sections.join(", ") || "none"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="row">
                    <span className="label">Scope summary</span>
                    <span data-testid="restore-import-plan-scope-summary">{restoreImportPlan.summary.plan_scope_summary}</span>
                  </div>
                  <div className="row">
                    <span className="label">Reviewer guidance</span>
                    <span data-testid="restore-import-plan-reviewer-guidance">{restoreImportPlan.summary.reviewer_guidance}</span>
                  </div>
                  <div className="row">
                    <span className="label">Typed confirmation</span>
                    <span data-testid="restore-import-plan-confirmation">{restoreImportPlan.summary.typed_confirmation_phrase}</span>
                  </div>
                  <div className="actionCluster">
                    <button
                      type="button"
                      className="softButton"
                      data-testid="restore-import-plan-json-button"
                      onClick={handleDownloadRestoreImportPlanJson}
                    >
                      Plan JSON
                    </button>
                    <button
                      type="button"
                      className="secondaryButton"
                      data-testid="restore-import-plan-markdown-button"
                      onClick={handleDownloadRestoreImportPlanMarkdown}
                    >
                      Plan markdown
                    </button>
                    <button
                      type="button"
                      className="secondaryButton"
                      data-testid="restore-open-import-review-button"
                      onClick={handleOpenImportReviewWorkspace}
                    >
                      Open import review workspace
                    </button>
                  </div>
                  <div className="banner subtle" data-testid="restore-import-review-handoff-note">
                    Continue on a dedicated review screen with this exact bundle, dry-run result, and controlled import plan.
                  </div>
                  <div className="overviewAttentionList" data-testid="restore-import-plan-sections">
                    {restoreImportPlan.sections.map((section) => (
                      <div className="overviewAttentionItem" key={section.name} data-testid={`restore-import-plan-section-${section.name}`}>
                        <div className="row">
                          <span className="label">Section</span>
                          <span>{section.name}</span>
                        </div>
                        <div className="row">
                          <span className="label">Plan state</span>
                          <span>{section.plan_state}</span>
                        </div>
                        <div className="row">
                          <span className="label">Preparation mode</span>
                          <span>{formatPreparationMode(section.preparation_mode)}</span>
                        </div>
                        <div className="row">
                          <span className="label">Include in plan</span>
                          <span>{section.include_in_plan ? "yes" : "no"}</span>
                        </div>
                        <div className="row">
                          <span className="label">Rationale</span>
                          <span>{section.rationale}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ) : null}
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
                <label className="field">
                  <span>Search sections</span>
                  <input
                    data-testid="restore-section-search"
                    value={restoreSectionQuery}
                    onChange={(event) => setRestoreSectionQuery(event.target.value)}
                    placeholder="servers, template, missing"
                  />
                </label>
                <label className="field">
                  <span>Risk focus</span>
                  <select
                    data-testid="restore-high-risk-filter"
                    value={restoreHighestRiskOnly ? "high-risk" : "all"}
                    onChange={(event) => setRestoreHighestRiskOnly(event.target.value === "high-risk")}
                  >
                    <option value="all">All sections</option>
                    <option value="high-risk">Highest-risk only</option>
                  </select>
                </label>
              </div>
              <p className="formHint" data-testid="restore-visible-sections-summary">
                Showing {visibleRestoreSections.length} of {restoreDryRun.sections.length} section{restoreDryRun.sections.length === 1 ? "" : "s"}.
              </p>
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
                    <div className="row">
                      <span className="label">Issue summary</span>
                      <span>
                        {(section.blockers || []).length} blocker{(section.blockers || []).length === 1 ? "" : "s"} ·{" "}
                        {(section.warnings || []).length} warning{(section.warnings || []).length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="row">
                      <span className="label">Preparation mode</span>
                      <span data-testid={`restore-section-mode-${section.name}`}>
                        {formatPreparationMode(section.preparation_mode)}
                      </span>
                    </div>
                    <div className="row">
                      <span className="label">Recommended action</span>
                      <span data-testid={`restore-section-action-${section.name}`}>
                        {section.recommended_action}
                      </span>
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
        </AdminDisclosureSection>

        <article className="card formCard">
          <div className="sectionHeader">
            <h2>Start with team access review</h2>
            <p className="formHint">
              Narrow the list first, then review or edit the teammate cards below. Creation and bulk tools come after that.
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
            hint="Filters stay in the URL, so this exact view can be shared or saved for the next review."
            onReset={resetUserFilters}
            resetDisabled={!hasUserFilters}
            resetTestId="users-reset-filters-button"
            actions={[
              {
                label: "Share this view",
                testId: "users-copy-filter-link-button",
                onClick: handleCopyCurrentView,
              },
            ]}
          />
        </article>

        <article id="users-current-review-slice" className="card formCard">
          <div className="sectionHeader">
            <div>
              <h2>Current review slice</h2>
              <p className="formHint">
                Use the list below as the main working surface for access changes. Secondary tools stay lower on the page.
              </p>
            </div>
          </div>
          <div className="backupSummaryBadges">
            <span className="status info">visible {filteredUsers.length}</span>
            <span className="status unknown">selected {selectedUserIds.length}</span>
            <span className="status unknown">admins {filteredUsers.filter((user) => user.role === "admin").length}</span>
            <span className="status unknown">security follow-up {filteredUsers.filter((user) => user.must_change_password).length}</span>
          </div>
        </article>

        <article id="users-create-user-card" className="card formCard adminToolCard">
          <div className="adminToolHeader">
            <span className="adminToolEyebrow">After review</span>
            <h2>Add teammate</h2>
            <p className="adminToolMeta">
              Create a new account once the current access view is settled.
            </p>
          </div>
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
            <p className="formHint">New accounts start on the `trial` plan and can be upgraded or restricted immediately after creation.</p>
          </form>
        </article>

        <AdminDisclosureSection
          title="After review: saved views and bulk changes"
          subtitle="Use these shortcuts once the current team-access view looks right."
          badge={`${savedViews.length} saved`}
          testId="users-power-tools"
        >
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
                ? "Set at least one user or activity filter before saving a view."
                : reachedViewLimitWithoutReplace
                ? "Saved views are full. Reuse an existing name or clear a few presets first."
                : activeSavedViewHasChanges
                ? `Saved view "${activeSavedView?.name || ""}" has unapplied filter changes.`
                : hasSavedViewNameMatch
                ? hasSavedViewChanges
                  ? "This will refresh the existing saved view with what is on screen now."
                  : "This saved view already matches what is on screen now."
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
                ? "No saved user views yet. Save one to keep a repeatable team-access review."
                : "No saved user views match this search or source filter."
            }
            listTestId="users-saved-views-list"
            activeViewId={activeSavedViewId}
          />
        </article>

        <article className="card formCard adminToolCard" data-testid="users-bulk-card">
          <div className="sectionHeader">
            <div>
              <span className="adminToolEyebrow">Admin actions</span>
              <h2 data-testid="users-bulk-title">Bulk access changes</h2>
              <p className="formHint">
                Bulk selection follows the current server-side list, so changes stay aligned with the review view above.
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
            <div className="actions bulkActionToolbar">
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
                Export this view
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
                  Select security follow-up
              </button>
              <button
                type="button"
                className="secondaryButton"
                data-testid="users-bulk-select-current-filter-button"
                onClick={handleSelectVisibleUsersWithAuditFilter}
                disabled={bulkUpdating || filteredUsers.length === 0}
              >
                  Select this view
              </button>
              <button
                type="button"
                className="secondaryButton"
                data-testid="users-bulk-reset-tools-button"
                onClick={handleResetBulkUsersTools}
                disabled={!bulkUsersDirty || bulkUpdating}
              >
                  Reset bulk panel
              </button>
            </div>
          </div>

          <div className="bulkActionsGrid">
            <div className="field bulkQuickActions" data-testid="users-bulk-presets">
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
                  Move to starter
                </button>
              </div>
            </div>
            <div className="bulkApplyPanel">
              <label className="field">
                <span>Bulk role</span>
                <select
                  data-testid="users-bulk-role-select"
                  value={bulkRoleValue}
                  onChange={(event) => setBulkRoleValue(event.target.value)}
                  disabled={bulkUpdating}
                >
                  <option value="">Leave roles unchanged</option>
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
            </div>

            <div className="bulkApplyPanel">
              <label className="field">
                <span>Bulk plan</span>
                <select
                  data-testid="users-bulk-plan-select"
                  value={bulkPlanValue}
                  onChange={(event) => setBulkPlanValue(event.target.value)}
                  disabled={bulkUpdating}
                >
                  <option value="">Leave plans unchanged</option>
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
          </div>
          <div className="adminHintStack">
            <p className="formHint">
              Bulk user actions use the current selection only and reuse the existing single-user admin update path.
            </p>
            <p className="formHint">
              Quick selectors respect the current list and let you stage access changes without breaking the review context.
            </p>
            <p className="formHint" data-testid="users-bulk-action-summary">
              {hasSelectedUsers
                ? bulkUsersActionSummary
                  ? `Ready to apply: ${bulkUsersActionSummary}.`
                  : "Choose a role or plan target to enable the apply action."
                : "Select at least one teammate to enable bulk actions."}
            </p>
          </div>
        </article>
        </AdminDisclosureSection>

        {loading && users.length === 0 ? (
          <div className="empty">Loading team access view...</div>
        ) : null}

        {!loading && users.length === 0 ? (
          <div className="empty" data-testid="users-empty-state">No people match this view yet. Clear a filter or add a teammate.</div>
        ) : null}

        <div className="list">
          {!loading && users.length > 0 && filteredUsers.length === 0 ? (
            <div className="empty" data-testid="users-filter-empty-state">No teammates match this filter or search. Try a broader view.</div>
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
              <div className="actionCluster">
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
