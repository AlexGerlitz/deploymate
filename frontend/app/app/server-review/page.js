"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  AdminFeedbackBanners,
  AdminSurfaceQueue,
  AdminSurfaceQueueCard,
} from "../admin-ui";
import {
  segmentFilterOptions,
  starterRuntimeMode,
  starterStrings,
} from "./starter-data";
import {
  createServerReviewServer,
  deleteServerReviewServer,
  fetchServerReviewStarterList,
  fetchServerReviewSuggestedPorts,
  runServerReviewStarterAction,
  updateServerReviewServer,
} from "./starter-api";

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

function ServerReviewPageContent() {
  const router = useRouter();

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("Step 1 is ready. Save one server and then test the connection.");
  const [servers, setServers] = useState([]);
  const [serverTestResults, setServerTestResults] = useState({});
  const [serverDiagnostics, setServerDiagnostics] = useState({});
  const [serverSuggestedPorts, setServerSuggestedPorts] = useState({});
  const [selectedItemId, setSelectedItemId] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverSubmitting, setServerSubmitting] = useState(false);
  const [serverUpdating, setServerUpdating] = useState(false);
  const [deletingServerId, setDeletingServerId] = useState("");
  const [query, setQuery] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("all");
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
    const normalized = query.trim().toLowerCase();
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
        segmentFilter === "all" || item.segment === segmentFilter;
      return matchesQuery && matchesSegment;
    });
  }, [items, query, segmentFilter]);

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
      }
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
      return {
        successMessage: `Diagnostics loaded for ${actionResult.target}.`,
      };
    }

    setServerTestResults((current) => ({
      ...current,
      [serverId]: actionResult,
    }));
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
    setSuccess("Focused the server action panel on the selected target.");
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
      setSelectedItemId((currentId) => (currentId === serverId ? "" : currentId));
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

  useEffect(() => {
    loadServers();
  }, []);

  return (
    <main className="workspaceShell">
      <section className="workspaceHero">
        <div className="workspaceHeroBackdrop" />
        <div className="header workspaceHeroHeader">
          <div>
            <div className="eyebrow">Step 1</div>
            <h1 data-testid="server-review-page-title">Connect your server</h1>
            <p>Add one server, test the connection, and get it ready before you choose which app to run.</p>
          </div>
          <div className="buttonRow workspaceHeroActions">
            <Link href="/app" className="linkButton workspaceSecondaryAction">
              Back to overview
            </Link>
            <button
              type="button"
              className="secondaryButton"
              data-testid="server-review-refresh"
              onClick={() => loadServers()}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </section>

      <AdminFeedbackBanners
        smokeMode={starterRuntimeMode !== "api"}
        error={error}
        success={success}
        errorTestId="server-review-error"
        successTestId="server-review-success"
      />

      <article className="card formCard workspaceGuidePanel" data-testid="server-review-create-card">
        <div id="server-review-create-server-section" className="workspaceGlancePanel">
          <div className="workspaceGlanceHeader">
            <span className="eyebrow">Start here</span>
            <strong>Add your server</strong>
          </div>
          <p className="formHint">
            Enter one server below. After you save it, run a connection test or full check before moving on.
          </p>
          <form className="form" onSubmit={handleCreateServer} data-testid="server-review-create-server">
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
                {serverSubmitting ? "Adding..." : "Save server"}
              </button>
            </div>
          </form>
        </div>
      </article>

      <div id="server-review-live-queue">
        <AdminSurfaceQueue
          title="Your servers"
          description="Keep all server actions here: check it, edit it, or continue to app setup."
          searchLabel="Search saved servers"
          searchValue={query}
          onSearchChange={(event) => setQuery(event.target.value)}
          searchPlaceholder={starterStrings.searchPlaceholder}
          searchTestId="server-review-search"
          emptyTestId="server-review-empty"
          emptyText="No saved servers match the current filters."
          items={filteredItems}
        >
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
                  data-testid={`${item.id}-focus`}
                  onClick={() => handleSelectItem(item.id)}
                >
                  {item.id === selectedItemId ? "Focused" : "Focus server"}
                </button>
                {item.id === selectedItemId ? null : (
                  <button
                    type="button"
                    className="secondaryButton"
                    onClick={() => handleSelectItem(item.id)}
                  >
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  className="secondaryButton"
                  data-testid={`${item.id}-primary-action`}
                  onClick={() => handleRunStarterAction("primary", item.id)}
                  disabled={actionLoadingId === item.id}
                >
                  Run full check
                </button>
                <button
                  type="button"
                  className="secondaryButton"
                  data-testid={`${item.id}-secondary-action`}
                  onClick={() => handleRunStarterAction("secondary", item.id)}
                  disabled={actionLoadingId === item.id}
                >
                  Check connection
                </button>
                {item.segment === "ready" ? (
                  <Link
                    href={`/app/deployment-workflow?server=${item.id}&source=server-review`}
                    className="landingButton secondaryButton"
                  >
                    Choose app
                  </Link>
                ) : null}
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
              {item.id === selectedItemId ? (
                <>
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
                        {serverUpdating ? "Saving..." : "Save changes"}
                      </button>
                    </div>
                  </form>
                  <label className="field">
                    <span>Add note for the next check</span>
                    <textarea
                      rows={3}
                      value={actionNote}
                      onChange={(event) => setActionNote(event.target.value)}
                      placeholder={starterStrings.actionNotePlaceholder}
                    />
                  </label>
                </>
              ) : null}
            </AdminSurfaceQueueCard>
          ))}
        </AdminSurfaceQueue>
      </div>
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
