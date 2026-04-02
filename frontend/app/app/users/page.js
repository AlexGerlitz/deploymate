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

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const smokeMode = process.env.NEXT_PUBLIC_SMOKE_TEST_MODE === "1";
const smokeUser = {
  id: "smoke-admin",
  username: "smoke-admin",
  is_admin: true,
  role: "admin",
  plan: "team",
};
const smokeUsers = [
  {
    id: "smoke-admin",
    username: "smoke-admin",
    role: "admin",
    plan: "team",
    must_change_password: false,
    created_at: "2026-04-02T00:00:00Z",
  },
  {
    id: "smoke-member",
    username: "smoke-member",
    role: "member",
    plan: "trial",
    must_change_password: true,
    created_at: "2026-04-02T00:03:00Z",
  },
];
const smokeAdminOverview = {
  users: {
    total: 2,
    admins: 1,
    members: 1,
    trial: 1,
    solo: 0,
    team: 1,
    must_change_password: 1,
  },
  attention_items: [],
};
const smokeAuditEvents = [
  {
    id: "smoke-audit-1",
    action_type: "user.created",
    actor_username: "smoke-admin",
    target_type: "user",
    target_label: "smoke-admin",
    details: "Smoke test event",
    created_at: "2026-04-02T00:05:00Z",
  },
];
const smokeUserSavedViews = [
  {
    id: "users-smoke-view",
    name: "Admins only",
    filters: {
      q: "",
      role: "admin",
      plan: "all",
      must_change_password: "all",
      audit_q: "",
    },
    updatedAt: "2026-04-02T00:10:00Z",
  },
];
const smokeUserAuditViews = [
  {
    id: "users-audit-smoke-view",
    name: "User actions",
    filters: { audit_q: "", audit_scope: "user", audit_sort: "newest" },
    updatedAt: "2026-04-02T00:20:00Z",
  },
];
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

async function readJsonOrError(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const detail =
      payload && typeof payload.detail === "string"
        ? payload.detail
        : fallbackMessage;
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }

  return payload;
}

function triggerFileDownload(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value) {
  const normalized =
    value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replaceAll("\"", "\"\"")}"`;
  }
  return normalized;
}

function buildRestoreDryRunCsv(report) {
  const rows = [
    ["section", "status", "incoming_count", "current_count", "issue_type", "code", "message"],
  ];

  for (const section of report.sections || []) {
    if (!section.blockers.length && !section.warnings.length) {
      rows.push([
        section.name,
        section.status,
        section.incoming_count,
        section.current_count,
        "note",
        "",
        (section.notes || []).join(" | "),
      ]);
      continue;
    }

    for (const issue of section.blockers || []) {
      rows.push([
        section.name,
        section.status,
        section.incoming_count,
        section.current_count,
        "blocker",
        issue.code,
        issue.message,
      ]);
    }

    for (const issue of section.warnings || []) {
      rows.push([
        section.name,
        section.status,
        section.incoming_count,
        section.current_count,
        "warning",
        issue.code,
        issue.message,
      ]);
    }
  }

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function analyzeBackupBundleText(bundleText) {
  if (!bundleText.trim()) {
    return { status: "empty", message: "Load or paste a backup bundle to inspect it." };
  }

  try {
    const parsed = JSON.parse(bundleText);
    const manifest = parsed && typeof parsed === "object" ? parsed.manifest : null;
    const sections = manifest && typeof manifest.sections === "object" ? manifest.sections : null;

    if (!manifest || !sections) {
      return {
        status: "invalid",
        message: "Bundle JSON is valid, but the expected manifest or sections block is missing.",
      };
    }

    return {
      status: "ready",
      message: "Bundle JSON parsed successfully and looks ready for dry-run validation.",
      manifest,
      sectionCount: Object.keys(sections).length,
      recordCount: Object.values(sections).reduce((total, value) => total + Number(value || 0), 0),
    };
  } catch (error) {
    return {
      status: "invalid",
      message: error instanceof Error ? error.message : "Bundle JSON could not be parsed.",
    };
  }
}

function buildAuditEventsCsv(items) {
  const rows = [["action_type", "actor_username", "target_type", "target_label", "details", "created_at"]];
  for (const item of items) {
    rows.push([
      item.action_type || "",
      item.actor_username || "",
      item.target_type || "",
      item.target_label || item.target_id || "",
      item.details || "",
      item.created_at || "",
    ]);
  }
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function buildSelectedUsersCsv(items) {
  const rows = [["username", "role", "plan", "must_change_password", "created_at"]];
  for (const item of items) {
    rows.push([
      item.username || "",
      item.role || "",
      item.plan || "",
      item.must_change_password ? "true" : "false",
      item.created_at || "",
    ]);
  }
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

async function copyTextToClipboard(value) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function normalizeSavedViewName(value) {
  return value.trim().replaceAll(/\s+/g, " ");
}

function formatSavedViews(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item) => item && typeof item.id === "string" && typeof item.name === "string" && item.filters)
    .sort((left, right) => {
      const leftTime = new Date(left.updatedAt || 0).getTime();
      const rightTime = new Date(right.updatedAt || 0).getTime();
      return rightTime - leftTime;
    })
    .map((item) => ({
      id: item.id,
      name: item.name,
      filters: item.filters,
      updatedAt: item.updatedAt || new Date().toISOString(),
      source: item.source || "local",
      updatedAtLabel: formatDate(item.updatedAt || new Date().toISOString()),
      sourceLabel: item.source === "imported" ? "Imported" : "Local",
      summary: [
        item.filters.role && item.filters.role !== "all" ? `role ${item.filters.role}` : null,
        item.filters.plan && item.filters.plan !== "all" ? `plan ${item.filters.plan}` : null,
        item.filters.must_change_password && item.filters.must_change_password !== "all"
          ? item.filters.must_change_password === "required"
            ? "password change required"
            : "password ok"
          : null,
        item.filters.q ? `search ${item.filters.q}` : null,
        item.filters.audit_q ? `audit ${item.filters.audit_q}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    }));
}

function normalizeSavedViewsForStorage(items) {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    filters: item.filters,
    updatedAt: item.updatedAt,
    source: item.source || "local",
  }));
}

function parseImportedSavedViews(payload) {
  if (Array.isArray(payload)) {
    return { views: payload, meta: { source: "legacy-array" } };
  }
  if (payload && Array.isArray(payload.views)) {
    return {
      views: payload.views,
      meta: {
        source: "bundle",
        version: payload.version,
        scope: payload.scope,
        exportedAt: payload.exported_at,
      },
    };
  }
  return { views: [], meta: null };
}

function dedupeSavedViewsByName(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizeSavedViewName(item.name).toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function mergeSavedViews(existingItems, importedItems) {
  return dedupeSavedViewsByName([...importedItems, ...existingItems]).slice(0, 8);
}

function sortSavedViews(items, mode) {
  const nextItems = [...items];
  if (mode === "oldest") {
    return nextItems.sort(
      (left, right) => new Date(left.updatedAt || 0).getTime() - new Date(right.updatedAt || 0).getTime(),
    );
  }
  if (mode === "name") {
    return nextItems.sort((left, right) => left.name.localeCompare(right.name));
  }
  return nextItems.sort(
    (left, right) => new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime(),
  );
}

function UsersPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [authChecked, setAuthChecked] = useState(smokeMode);
  const [currentUser, setCurrentUser] = useState(smokeMode ? smokeUser : null);
  const [users, setUsers] = useState(smokeMode ? smokeUsers : []);
  const [adminOverview, setAdminOverview] = useState(smokeMode ? smokeAdminOverview : null);
  const [auditEvents, setAuditEvents] = useState(smokeMode ? smokeAuditEvents : []);
  const [backupBundleText, setBackupBundleText] = useState("");
  const [restoreDryRun, setRestoreDryRun] = useState(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreSectionFilter, setRestoreSectionFilter] = useState("all");
  const [savedViews, setSavedViews] = useState(
    smokeMode ? formatSavedViews(smokeUserSavedViews) : [],
  );
  const [savedViewName, setSavedViewName] = useState("");
  const [savedViewsMetaText, setSavedViewsMetaText] = useState(
    smokeMode ? "Loaded from local browser storage." : "Using local browser storage.",
  );
  const [savedViewsSearch, setSavedViewsSearch] = useState("");
  const [savedViewsSourceFilter, setSavedViewsSourceFilter] = useState("all");
  const [savedViewsSort, setSavedViewsSort] = useState("newest");
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
  const [auditViews, setAuditViews] = useState(
    smokeMode ? formatSavedViews(smokeUserAuditViews) : [],
  );
  const [auditViewName, setAuditViewName] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [debouncedAuditQuery, setDebouncedAuditQuery] = useState("");
  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "member",
  });
  const filteredUsers = users;
  const bundleLineCount = backupBundleText ? backupBundleText.split("\n").length : 0;
  const bundleAnalysis = analyzeBackupBundleText(backupBundleText);
  const visibleRestoreSections = restoreDryRun
    ? restoreDryRun.sections.filter(
        (section) => restoreSectionFilter === "all" || section.status === restoreSectionFilter,
      )
    : [];
  const hasUserFilters =
    query.trim() !== "" ||
    roleFilter !== "all" ||
    planFilter !== "all" ||
    mustChangeFilter !== "all" ||
    auditQuery.trim() !== "";
  const currentUserView = {
    q: query.trim(),
    role: roleFilter,
    plan: planFilter,
    must_change_password: mustChangeFilter,
    audit_q: auditQuery.trim(),
  };
  const currentUserViewSignature = JSON.stringify(currentUserView);
  const normalizedSavedViewName = normalizeSavedViewName(savedViewName);
  const matchedSavedViewByName = savedViews.find(
    (item) => normalizeSavedViewName(item.name).toLowerCase() === normalizedSavedViewName.toLowerCase(),
  );
  const activeSavedViewId =
    savedViews.find((item) => JSON.stringify(item.filters) === currentUserViewSignature)?.id || "";
  const activeSavedView = savedViews.find((item) => item.id === activeSavedViewId) || null;
  const hasSavedViewNameMatch = Boolean(matchedSavedViewByName);
  const hasSavedViewChanges =
    matchedSavedViewByName &&
    JSON.stringify(matchedSavedViewByName.filters) !== currentUserViewSignature;
  const activeSavedViewHasChanges =
    activeSavedView &&
    JSON.stringify(activeSavedView.filters) !== currentUserViewSignature;
  const activeFilterChips = [
    query.trim()
      ? {
          key: "users-q",
          label: `Search: ${query.trim()}`,
          onRemove: () => setQuery(""),
          testId: "users-filter-chip-query",
        }
      : null,
    roleFilter !== "all"
      ? {
          key: "users-role",
          label: `Role: ${roleFilter}`,
          onRemove: () => setRoleFilter("all"),
          testId: "users-filter-chip-role",
        }
      : null,
    planFilter !== "all"
      ? {
          key: "users-plan",
          label: `Plan: ${planFilter}`,
          onRemove: () => setPlanFilter("all"),
          testId: "users-filter-chip-plan",
        }
      : null,
    mustChangeFilter !== "all"
      ? {
          key: "users-password",
          label: mustChangeFilter === "required" ? "Password: change required" : "Password: ok",
          onRemove: () => setMustChangeFilter("all"),
          testId: "users-filter-chip-password",
        }
      : null,
    auditQuery.trim()
      ? {
          key: "users-audit",
          label: `Audit: ${auditQuery.trim()}`,
          onRemove: () => setAuditQuery(""),
          testId: "users-filter-chip-audit",
        }
      : null,
  ];
  const activeAuditFilterChips = auditQuery.trim()
    ? [
        {
          key: "users-audit-search",
          label: `Audit: ${auditQuery.trim()}`,
          onRemove: () => setAuditQuery(""),
          testId: "users-audit-filter-chip-query",
        },
      ]
    : [];
  if (auditScopeFilter !== "all") {
    activeAuditFilterChips.push({
      key: "users-audit-scope",
      label: `Scope: ${auditScopeFilter}`,
      onRemove: () => setAuditScopeFilter("all"),
      testId: "users-audit-filter-chip-scope",
    });
  }
  const currentAuditView = {
    audit_q: auditQuery.trim(),
    audit_scope: auditScopeFilter,
    audit_sort: auditSort,
  };
  const currentAuditViewSignature = JSON.stringify(currentAuditView);
  const normalizedAuditViewName = normalizeSavedViewName(auditViewName);
  const matchedAuditViewByName = auditViews.find(
    (item) => normalizeSavedViewName(item.name).toLowerCase() === normalizedAuditViewName.toLowerCase(),
  );
  const activeAuditViewId =
    auditViews.find((item) => JSON.stringify(item.filters) === currentAuditViewSignature)?.id || "";
  const activeAuditView = auditViews.find((item) => item.id === activeAuditViewId) || null;
  const hasAuditViewNameMatch = Boolean(matchedAuditViewByName);
  const canSaveAuditView =
    normalizedAuditViewName !== "" && (auditQuery.trim() || auditScopeFilter !== "all" || auditSort !== "newest");
  const visibleAuditEvents = [...auditEvents]
    .filter((item) => auditScopeFilter === "all" || item.target_type === auditScopeFilter)
    .sort((left, right) => {
      const leftTime = new Date(left.created_at || 0).getTime();
      const rightTime = new Date(right.created_at || 0).getTime();
      return auditSort === "oldest" ? leftTime - rightTime : rightTime - leftTime;
    });
  const canSaveCurrentView = normalizedSavedViewName !== "" && hasUserFilters;
  const reachedViewLimitWithoutReplace =
    savedViews.length >= 8 && !hasSavedViewNameMatch;
  const visibleSavedViews = sortSavedViews(
    savedViews.filter((item) => {
      if (
        savedViewsSourceFilter !== "all" &&
        (item.source || "local") !== savedViewsSourceFilter
      ) {
        return false;
      }
      const haystack = `${item.name} ${item.summary || ""}`.toLowerCase();
      return haystack.includes(savedViewsSearch.trim().toLowerCase());
    }),
    savedViewsSort,
  );
  const savedViewsToolsDirty =
    normalizedSavedViewName !== "" ||
    savedViewsSearch.trim() !== "" ||
    savedViewsSourceFilter !== "all" ||
    savedViewsSort !== "newest";
  const savedViewsSummaryText =
    savedViews.length === 0
      ? ""
      : `Showing ${visibleSavedViews.length} of ${savedViews.length} saved user view${savedViews.length === 1 ? "" : "s"}.`;
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

  function persistSavedViews(nextViews) {
    const normalized = formatSavedViews(nextViews);
    setSavedViews(normalized);
    if (!smokeMode) {
      window.localStorage.setItem(usersSavedViewsStorageKey, JSON.stringify(nextViews));
    }
  }

  function applyViewFilters(filters) {
    setQuery(filters.q || "");
    setRoleFilter(filters.role || "all");
    setPlanFilter(filters.plan || "all");
    setMustChangeFilter(filters.must_change_password || "all");
    setAuditQuery(filters.audit_q || "");
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

  useEffect(() => {
    if (smokeMode) {
      return;
    }

    try {
      const stored = window.localStorage.getItem(usersSavedViewsStorageKey);
      if (!stored) {
        return;
      }
      const parsed = JSON.parse(stored);
      setSavedViews(formatSavedViews(parsed));
      setSavedViewsMetaText("Loaded from local browser storage.");
    } catch {
      setSavedViews([]);
      setSavedViewsMetaText("Using local browser storage.");
    }

    try {
      const storedAudit = window.localStorage.getItem(usersAuditViewsStorageKey);
      if (!storedAudit) {
        return;
      }
      setAuditViews(formatSavedViews(JSON.parse(storedAudit)));
    } catch {
      setAuditViews([]);
    }
  }, []);

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

  async function handleCopyAuditViewLink() {
    const params = new URLSearchParams();
    if (auditQuery.trim()) {
      params.set("audit_q", auditQuery.trim());
    }
    if (auditScopeFilter !== "all") {
      params.set("audit_scope", auditScopeFilter);
    }
    if (auditSort !== "newest") {
      params.set("audit_sort", auditSort);
    }
    const url = `${window.location.origin}${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    await copyTextToClipboard(url);
    setSuccess("Audit view link copied.");
    setError("");
  }

  function handleResetAuditTools() {
    setAuditQuery("");
    setAuditScopeFilter("all");
    setAuditSort("newest");
    setSuccess("Audit tools reset.");
    setError("");
  }

  function persistAuditViews(nextViews) {
    const normalized = formatSavedViews(nextViews);
    setAuditViews(normalized);
    if (!smokeMode) {
      window.localStorage.setItem(usersAuditViewsStorageKey, JSON.stringify(nextViews));
    }
  }

  function handleSaveAuditView() {
    if (!canSaveAuditView) {
      return;
    }
    const matchedView = matchedAuditViewByName;
    const nextViews = [
      {
        id: matchedView ? matchedView.id : `${Date.now()}`,
        name: normalizedAuditViewName,
        filters: currentAuditView,
        updatedAt: new Date().toISOString(),
        source: "local",
      },
      ...auditViews
        .filter((item) => normalizeSavedViewName(item.name).toLowerCase() !== normalizedAuditViewName.toLowerCase())
        .map((item) => ({
          id: item.id,
          name: item.name,
          filters: item.filters,
          updatedAt: item.updatedAt,
          source: item.source,
        })),
    ].slice(0, 8);
    persistAuditViews(nextViews);
    setAuditViewName("");
    setSuccess("Audit view saved.");
    setError("");
  }

  function handleApplyAuditView(viewId) {
    const nextView = auditViews.find((item) => item.id === viewId);
    if (!nextView) {
      return;
    }
    setAuditQuery(nextView.filters.audit_q || "");
    setAuditScopeFilter(nextView.filters.audit_scope || "all");
    setAuditSort(nextView.filters.audit_sort || "newest");
    setAuditViewName(nextView.name);
    setSuccess(`Applied audit view ${nextView.name}.`);
    setError("");
  }

  function handleDeleteAuditView(viewId) {
    persistAuditViews(
      auditViews.filter((item) => item.id !== viewId).map((item) => ({
        id: item.id,
        name: item.name,
        filters: item.filters,
        updatedAt: item.updatedAt,
        source: item.source,
      })),
    );
    setSuccess("Audit view removed.");
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

  async function handleCopySavedViewLink(viewId) {
    const nextView = savedViews.find((item) => item.id === viewId);
    if (!nextView) {
      return;
    }

    const params = new URLSearchParams();
    if (nextView.filters.q) {
      params.set("q", nextView.filters.q);
    }
    if (nextView.filters.role && nextView.filters.role !== "all") {
      params.set("role", nextView.filters.role);
    }
    if (nextView.filters.plan && nextView.filters.plan !== "all") {
      params.set("plan", nextView.filters.plan);
    }
    if (
      nextView.filters.must_change_password &&
      nextView.filters.must_change_password !== "all"
    ) {
      params.set("must_change_password", nextView.filters.must_change_password);
    }
    if (nextView.filters.audit_q) {
      params.set("audit_q", nextView.filters.audit_q);
    }

    const url = `${window.location.origin}${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    await copyTextToClipboard(url);
    setSuccess(`Saved view link copied for ${nextView.name}.`);
    setError("");
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

  function resetUserFilters() {
    setQuery("");
    setRoleFilter("all");
    setPlanFilter("all");
    setMustChangeFilter("all");
    setAuditQuery("");
  }

  function handleSaveCurrentView() {
    if (!canSaveCurrentView) {
      return;
    }

    const matchedView = matchedSavedViewByName;

    const nextViews = [
      {
        id: matchedView ? matchedView.id : `${Date.now()}`,
        name: normalizedSavedViewName,
        filters: currentUserView,
        updatedAt: new Date().toISOString(),
        source: "local",
      },
      ...savedViews
        .filter((item) => normalizeSavedViewName(item.name).toLowerCase() !== normalizedSavedViewName.toLowerCase())
        .map((item) => ({
          id: item.id,
          name: item.name,
          filters: item.filters,
          updatedAt: item.updatedAt,
        })),
    ].slice(0, 8);

    persistSavedViews(nextViews);
    setSavedViewsMetaText("Using local browser storage.");
    setSavedViewName("");
    setSuccess("Saved current user view.");
    setError("");
  }

  function handleApplySavedView(viewId) {
    const nextView = savedViews.find((item) => item.id === viewId);
    if (!nextView) {
      return;
    }
    applyViewFilters(nextView.filters);
    setSavedViewName(nextView.name);
    setSavedViewsMetaText(
      nextView.source === "imported" ? "Applied an imported saved view." : "Applied a local saved view.",
    );
    setSuccess(`Applied saved view ${nextView.name}.`);
    setError("");
  }

  function handleUpdateCurrentView() {
    if (!activeSavedViewId) {
      return;
    }

    const nextViews = [
      {
        id: activeSavedViewId,
        name: activeSavedView?.name || normalizedSavedViewName || "Saved view",
        filters: currentUserView,
        updatedAt: new Date().toISOString(),
        source: "local",
      },
      ...savedViews
        .filter((item) => item.id !== activeSavedViewId)
        .map((item) => ({
          id: item.id,
          name: item.name,
          filters: item.filters,
          updatedAt: item.updatedAt,
        })),
    ].slice(0, 8);

    persistSavedViews(nextViews);
    setSavedViewsMetaText("Using local browser storage.");
    setSavedViewName(activeSavedView?.name || "");
    setSuccess("Current saved user view updated.");
    setError("");
  }

  function handleDeleteSavedView(viewId) {
    const deletedView = savedViews.find((item) => item.id === viewId);
    const nextViews = savedViews
      .filter((item) => item.id !== viewId)
      .map((item) => ({
        id: item.id,
        name: item.name,
        filters: item.filters,
        updatedAt: item.updatedAt,
      }));
    persistSavedViews(nextViews);
    if (deletedView && deletedView.name === savedViewName) {
      setSavedViewName("");
    }
    setSuccess("Saved user view removed.");
    setError("");
  }

  function handleDownloadSavedViews() {
    if (savedViews.length === 0) {
      return;
    }
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 1,
            exported_at: new Date().toISOString(),
            scope: "admin-users",
            views: normalizeSavedViewsForStorage(savedViews),
          },
          null,
          2,
        ),
      ],
      { type: "application/json;charset=utf-8" },
    );
    triggerFileDownload("deploymate-users-saved-views.json", blob);
    setSuccess("Saved user views exported.");
    setError("");
  }

  function handleImportSavedViews(event) {
    const [file] = Array.from(event.target.files || []);
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(typeof reader.result === "string" ? reader.result : "[]");
        const imported = parseImportedSavedViews(parsed);
        if (imported.meta?.version && imported.meta.version !== 1) {
          throw new Error("Unsupported saved views export version.");
        }
        if (imported.meta?.scope && imported.meta.scope !== "admin-users") {
          throw new Error("This file is not a users saved views export.");
        }
        const importedViews = formatSavedViews(imported.views).map((item) => ({
          ...item,
          source: "imported",
        }));
        const normalized = normalizeSavedViewsForStorage(
          mergeSavedViews(formatSavedViews(savedViews), importedViews),
        );
        if (normalized.length === 0) {
          throw new Error("No valid saved user views found in this file.");
        }
        const importedNameSet = new Set(
          importedViews.map((item) => normalizeSavedViewName(item.name).toLowerCase()),
        );
        const replacedCount = formatSavedViews(savedViews).filter((item) =>
          importedNameSet.has(normalizeSavedViewName(item.name).toLowerCase()),
        ).length;
        const mergedTotal = dedupeSavedViewsByName([...importedViews, ...formatSavedViews(savedViews)]).length;
        const skippedCount = Math.max(0, mergedTotal - normalized.length);
        persistSavedViews(normalized);
        setSavedViewsMetaText(
          imported.meta?.source === "bundle"
            ? `Imported bundle${imported.meta.version ? ` v${imported.meta.version}` : ""}${imported.meta.exportedAt ? ` · exported ${formatDate(imported.meta.exportedAt)}` : ""}.`
            : "Imported legacy saved views file.",
        );
        setSuccess(
          `Saved user views merged. Total: ${normalized.length}. Replaced: ${replacedCount}. Skipped by limit: ${skippedCount}.`,
        );
        setError("");
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Failed to import saved user views.",
        );
      }
    };
    reader.onerror = () => {
      setError("Failed to read saved views file.");
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function handleClearSavedViews() {
    persistSavedViews([]);
    setSavedViewName("");
    setSavedViewsMetaText("Using local browser storage.");
    setSuccess("Saved user views cleared.");
    setError("");
  }

  function handleClearImportedSavedViews() {
    const nextViews = savedViews.filter((item) => item.source !== "imported");
    persistSavedViews(nextViews);
    setSavedViewsMetaText("Using local browser storage.");
    setSuccess("Imported user views removed.");
    setError("");
  }

  function handleResetSavedViewsTools() {
    setSavedViewName("");
    setSavedViewsSearch("");
    setSavedViewsSourceFilter("all");
    setSavedViewsSort("newest");
    setSavedViewsMetaText("Using local browser storage.");
    setSuccess("Saved views tools reset.");
    setError("");
  }

  function handleUseCurrentSavedViewName() {
    if (!activeSavedView?.name) {
      return;
    }
    setSavedViewName(activeSavedView.name);
  }

  useEffect(() => {
    if (smokeMode) {
      return;
    }
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set("q", query.trim());
    }
    if (roleFilter !== "all") {
      params.set("role", roleFilter);
    }
    if (planFilter !== "all") {
      params.set("plan", planFilter);
    }
    if (mustChangeFilter !== "all") {
      params.set("must_change_password", mustChangeFilter);
    }
    if (auditQuery.trim()) {
      params.set("audit_q", auditQuery.trim());
    }
    if (auditScopeFilter !== "all") {
      params.set("audit_scope", auditScopeFilter);
    }
    if (auditSort !== "newest") {
      params.set("audit_sort", auditSort);
    }
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    const currentUrl = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
    if (nextUrl !== currentUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [smokeMode, pathname, router, searchParams, query, roleFilter, planFilter, mustChangeFilter, auditQuery, auditScopeFilter, auditSort]);

  useEffect(() => {
    setSelectedUserIds((currentIds) =>
      currentIds.filter((userId) => users.some((user) => user.id === userId)),
    );
  }, [users]);

  useEffect(() => {
    if (smokeMode) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    if (smokeMode) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setDebouncedAuditQuery(auditQuery);
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [auditQuery]);

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
            <div className="backupReport">
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
              <div className="backupSummaryBadges">
                <span className="status healthy">safe {restoreDryRun.summary.ok_sections}</span>
                <span className="status warn">review {restoreDryRun.summary.review_required_sections}</span>
                <span className="status error">blocked {restoreDryRun.summary.blocked_sections}</span>
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
                  <div className="overviewAttentionItem" key={section.name}>
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
            <article className="card compactCard" key={user.id}>
              <div className="row">
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
