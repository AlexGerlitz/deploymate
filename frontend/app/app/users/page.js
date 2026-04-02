"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AdminFeedbackBanners, AdminFilterFooter, AdminPageHeader } from "../admin-ui";

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
];
const smokeAdminOverview = {
  users: {
    total: 1,
    admins: 1,
    members: 0,
    trial: 0,
    solo: 0,
    team: 1,
    must_change_password: 0,
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
  const [loading, setLoading] = useState(!smokeMode);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState("");
  const [deletingUserId, setDeletingUserId] = useState("");
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [roleFilter, setRoleFilter] = useState(() => searchParams.get("role") || "all");
  const [planFilter, setPlanFilter] = useState(() => searchParams.get("plan") || "all");
  const [mustChangeFilter, setMustChangeFilter] = useState(() => {
    const value = searchParams.get("must_change_password");
    if (value === "required" || value === "ok") {
      return value;
    }
    return "all";
  });
  const [auditQuery, setAuditQuery] = useState(() => searchParams.get("audit_q") || "");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [debouncedAuditQuery, setDebouncedAuditQuery] = useState("");
  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "member",
  });
  const filteredUsers = users;
  const bundleLineCount = backupBundleText ? backupBundleText.split("\n").length : 0;
  const hasUserFilters =
    query.trim() !== "" ||
    roleFilter !== "all" ||
    planFilter !== "all" ||
    mustChangeFilter !== "all";

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

        await Promise.all([loadUsers(), loadAdminOverview(), loadAuditEvents()]);
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
      await Promise.all([loadUsers(), loadAdminOverview(), loadAuditEvents()]);
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
      await Promise.all([loadUsers(), loadAdminOverview(), loadAuditEvents()]);
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
      await Promise.all([loadUsers(), loadAdminOverview(), loadAuditEvents()]);
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
      await Promise.all([loadUsers(), loadAdminOverview(), loadAuditEvents()]);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Failed to delete user.",
      );
    } finally {
      setDeletingUserId("");
    }
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
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    const currentUrl = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
    if (nextUrl !== currentUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [smokeMode, pathname, router, searchParams, query, roleFilter, planFilter, mustChangeFilter, auditQuery]);

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
          onRefresh={() => Promise.all([loadUsers(), loadAdminOverview(), loadAuditEvents()])}
          refreshTestId="users-refresh-button"
          actions={[
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

        <article className="card formCard">
          <div className="sectionHeader">
            <div>
              <h2>Admin audit trail</h2>
              <p className="formHint">Recent admin actions across users and upgrade handling.</p>
            </div>
          </div>
          <label className="field deploymentSearch">
            <span>Search audit</span>
            <input
              value={auditQuery}
              onChange={(event) => setAuditQuery(event.target.value)}
              placeholder="user.updated, alice, approved"
            />
          </label>
          <p className="formHint">Recent audit events shown: {auditEvents.length}</p>
          <p className="formHint">Audit search updates after a short pause.</p>
          {auditEvents.length === 0 ? (
            <div className="empty" data-testid="users-audit-empty-state">
              {auditQuery.trim() ? "No admin audit events match this search." : "No admin audit events yet."}
            </div>
          ) : (
            <div className="timeline">
              {auditEvents.map((item) => (
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
          )}
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
            <button type="button" onClick={handleDownloadBackupBundle}>
              Download backup bundle
            </button>
            <button type="button" onClick={handleLoadSampleBundle}>
              Paste sample
            </button>
            <label className="linkButton backupUploadButton">
              Load backup file
              <input type="file" accept="application/json,.json" onChange={handleBackupFileChange} />
            </label>
            <button type="button" onClick={handleClearBundle} disabled={!backupBundleText.trim()}>
              Clear bundle
            </button>
            <button
              type="button"
              data-testid="restore-dry-run-button"
              onClick={handleRunRestoreDryRun}
              disabled={restoreLoading || !backupBundleText.trim()}
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
              <div className="backupManifestGrid">
                {Object.entries(restoreDryRun.manifest.sections || {}).map(([name, count]) => (
                  <div key={name} className="backupManifestItem">
                    <span className="label">{name}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
              <div className="overviewAttentionList">
                {restoreDryRun.sections.map((section) => (
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
            hint="User search updates after a short pause."
            onReset={resetUserFilters}
            resetDisabled={!hasUserFilters}
            resetTestId="users-reset-filters-button"
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
                  disabled={updatingUserId === user.id || deletingUserId === user.id}
                >
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                </select>
                <select
                  value={user.plan}
                  onChange={(event) => handlePlanChange(user.id, event.target.value)}
                  disabled={updatingUserId === user.id || deletingUserId === user.id}
                >
                  <option value="trial">trial</option>
                  <option value="solo">solo</option>
                  <option value="team">team</option>
                </select>
                <button
                  type="button"
                  className="dangerButton"
                  onClick={() => handleDeleteUser(user.id)}
                  disabled={deletingUserId === user.id || updatingUserId === user.id}
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
