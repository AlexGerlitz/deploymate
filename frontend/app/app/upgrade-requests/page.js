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
const smokeRequests = [
  {
    id: "smoke-request-1",
    status: "in_review",
    name: "Smoke Team",
    email: "ops@example.com",
    company_or_team: "Smoke Team",
    use_case: "Smoke validation",
    current_plan: "trial",
    handled_by_username: "smoke-admin",
    target_username: "smoke-admin",
    target_user_id: "smoke-admin",
    reviewed_at: "2026-04-02T00:05:00Z",
    updated_at: "2026-04-02T00:05:00Z",
    created_at: "2026-04-02T00:00:00Z",
    internal_note: "Smoke test note",
  },
];
const smokeOverview = {
  upgrade_requests: {
    total: 1,
    new: 0,
    in_review: 1,
    approved: 0,
    rejected: 0,
    closed: 0,
    linked_users: 1,
  },
  attention_items: [],
};
const smokeAuditEvents = [
  {
    id: "smoke-upgrade-audit-1",
    action_type: "upgrade_request.updated",
    actor_username: "smoke-admin",
    target_label: "Smoke Team",
    details: "Smoke test event",
    created_at: "2026-04-02T00:06:00Z",
  },
];
const smokeUsers = [
  { id: "smoke-admin", username: "smoke-admin", plan: "team" },
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
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") || "all");
  const [linkedOnly, setLinkedOnly] = useState(() => searchParams.get("linked_only") === "true");
  const [auditQuery, setAuditQuery] = useState(() => searchParams.get("audit_q") || "");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [debouncedAuditQuery, setDebouncedAuditQuery] = useState("");
  const [savingId, setSavingId] = useState("");
  const [saveFeedback, setSaveFeedback] = useState("");
  const [drafts, setDrafts] = useState({});
  const filteredRequests = requests;
  const hasRequestFilters =
    query.trim() !== "" ||
    planFilter !== "all" ||
    statusFilter !== "all" ||
    linkedOnly;

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

        await Promise.all([loadUsers(), loadRequests(), loadAdminOverview(), loadAuditEvents()]);
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
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set("q", query.trim());
    }
    if (planFilter !== "all") {
      params.set("plan", planFilter);
    }
    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }
    if (linkedOnly) {
      params.set("linked_only", "true");
    }
    if (auditQuery.trim()) {
      params.set("audit_q", auditQuery.trim());
    }
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    const currentUrl = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
    if (nextUrl !== currentUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [smokeMode, pathname, router, searchParams, query, planFilter, statusFilter, linkedOnly, auditQuery]);

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

  function resetRequestFilters() {
    setQuery("");
    setPlanFilter("all");
    setStatusFilter("all");
    setLinkedOnly(false);
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
          onRefresh={() => Promise.all([loadUsers(), loadRequests(), loadAdminOverview(), loadAuditEvents()])}
          refreshTestId="upgrade-refresh-button"
          actions={[
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

        <article className="card formCard">
          <div className="sectionHeader">
            <div>
              <h2>Upgrade audit trail</h2>
              <p className="formHint">Recent admin actions taken on upgrade requests.</p>
            </div>
          </div>
          <label className="field deploymentSearch">
            <span>Search audit</span>
            <input
              value={auditQuery}
              onChange={(event) => setAuditQuery(event.target.value)}
              placeholder="approved, in_review, target user"
            />
          </label>
          <p className="formHint">Recent audit events shown: {auditEvents.length}</p>
          <p className="formHint">Audit search updates after a short pause.</p>
          {auditEvents.length === 0 ? (
            <div className="empty" data-testid="upgrade-audit-empty-state">
              {auditQuery.trim() ? "No upgrade audit events match this search." : "No upgrade audit events yet."}
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
          )}
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
            hint="Request search updates after a short pause."
            onReset={resetRequestFilters}
            resetDisabled={!hasRequestFilters}
            resetTestId="upgrade-reset-filters-button"
          />
        </article>

        {loading && requests.length === 0 ? (
          <div className="empty">Loading upgrade requests...</div>
        ) : null}

        {!loading && requests.length === 0 ? (
          <div className="empty" data-testid="upgrade-empty-state">No upgrade requests found for the current filters.</div>
        ) : null}

        <div className="list">
          {!loading && requests.length > 0 && filteredRequests.length === 0 ? (
            <div className="empty" data-testid="upgrade-filter-empty-state">No upgrade requests match this filter or search.</div>
          ) : null}

          {filteredRequests.map((item) => (
            <article className="card compactCard" key={item.id}>
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
                  disabled={savingId === item.id}
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
                  disabled={savingId === item.id}
                  placeholder="Next step, pricing context, follow-up owner"
                />
              </label>
              <p className="formHint">Use internal notes for follow-up context visible to admins only.</p>
              <label className="field">
                <span>Target user</span>
                <select
                  value={drafts[item.id]?.target_user_id || ""}
                  onChange={(event) => updateDraft(item.id, "target_user_id", event.target.value)}
                  disabled={savingId === item.id}
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
                  disabled={savingId === item.id}
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
                  disabled={savingId === item.id}
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
                  disabled={savingId === item.id}
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
                  disabled={savingId === item.id || !drafts[item.id]?.target_user_id}
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
                  disabled={savingId === item.id}
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
                  disabled={savingId === item.id}
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
