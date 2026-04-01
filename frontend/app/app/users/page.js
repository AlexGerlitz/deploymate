"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

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

export default function UsersPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [adminOverview, setAdminOverview] = useState(null);
  const [auditEvents, setAuditEvents] = useState([]);
  const [backupBundleText, setBackupBundleText] = useState("");
  const [restoreDryRun, setRestoreDryRun] = useState(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState("");
  const [deletingUserId, setDeletingUserId] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [mustChangeFilter, setMustChangeFilter] = useState("all");
  const [auditQuery, setAuditQuery] = useState("");
  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "member",
  });
  const filteredUsers = users;

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
    if (auditQuery.trim()) {
      params.set("q", auditQuery.trim());
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
      if (query.trim()) {
        params.set("q", query.trim());
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

  useEffect(() => {
    if (!authChecked || accessDenied) {
      return;
    }
    loadUsers();
  }, [authChecked, accessDenied, query, roleFilter, planFilter, mustChangeFilter]);

  useEffect(() => {
    if (!authChecked || accessDenied) {
      return;
    }
    loadAuditEvents();
  }, [authChecked, accessDenied, auditQuery]);

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
        <div className="header">
          <div>
            <h1>Users</h1>
            <p>{currentUser ? `Admin users management · ${currentUser.username}` : "Users"}</p>
          </div>
          <div className="buttonRow">
            <Link href="/app" className="linkButton">
              Back
            </Link>
            <button type="button" onClick={() => Promise.all([loadUsers(), loadAdminOverview()])} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button type="button" onClick={handleDownloadUsersExport}>
              Export CSV
            </button>
            <button type="button" onClick={handleDownloadAuditExport}>
              Audit CSV
            </button>
          </div>
        </div>

        {error ? <div className="banner error">{error}</div> : null}
        {success ? <div className="banner success">{success}</div> : null}

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
          {auditEvents.length === 0 ? (
            <div className="empty">No admin audit events yet.</div>
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
              <h2>Backup and restore dry run</h2>
              <p className="formHint">
                Export a full admin backup bundle, then validate a restore bundle without applying any changes.
              </p>
            </div>
          </div>
          <div className="backupActions">
            <button type="button" onClick={handleDownloadBackupBundle}>
              Download backup bundle
            </button>
            <label className="linkButton backupUploadButton">
              Load backup file
              <input type="file" accept="application/json,.json" onChange={handleBackupFileChange} />
            </label>
            <button type="button" onClick={handleRunRestoreDryRun} disabled={restoreLoading}>
              {restoreLoading ? "Validating..." : "Run restore dry-run"}
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
          </form>
        </article>

        {loading && users.length === 0 ? (
          <div className="empty">Loading users...</div>
        ) : null}

        {!loading && users.length === 0 ? (
          <div className="empty">No users yet.</div>
        ) : null}

        <div className="list">
          {!loading && users.length > 0 && filteredUsers.length === 0 ? (
            <div className="empty">No users match this filter.</div>
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
                    disabled={updatingUserId === user.id}
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
