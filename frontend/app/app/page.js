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

function normalizeCreateDeploymentError(message) {
  if (!message) {
    return "Failed to create deployment. Please try again.";
  }

  if (message.includes("is already in use on server")) {
    return `${message} Choose a different external port like 8080 or 8081.`;
  }

  return message;
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

export default function HomePage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const [deployments, setDeployments] = useState([]);
  const [servers, setServers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serversLoading, setServersLoading] = useState(true);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [error, setError] = useState("");
  const [serversError, setServersError] = useState("");
  const [notificationsError, setNotificationsError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [createdDeployment, setCreatedDeployment] = useState(null);

  const [serverSubmitting, setServerSubmitting] = useState(false);
  const [serverSubmitError, setServerSubmitError] = useState("");
  const [serverSubmitSuccess, setServerSubmitSuccess] = useState("");

  const [deleteError, setDeleteError] = useState("");
  const [deletingDeploymentId, setDeletingDeploymentId] = useState("");
  const [serverDeleteError, setServerDeleteError] = useState("");
  const [deletingServerId, setDeletingServerId] = useState("");
  const [testingServerId, setTestingServerId] = useState("");
  const [serverTestResults, setServerTestResults] = useState({});

  const [form, setForm] = useState({
    image: "",
    name: "",
    internal_port: "",
    external_port: "",
    server_id: "",
  });
  const [envRows, setEnvRows] = useState([{ key: "", value: "" }]);
  const [serverForm, setServerForm] = useState({
    name: "",
    host: "",
    port: "22",
    username: "",
    auth_type: "password",
    password: "",
    ssh_key: "",
  });

  const serverLimitReached =
    currentUser &&
    typeof currentUser.limits?.max_servers === "number" &&
    typeof currentUser.usage?.servers === "number" &&
    currentUser.usage.servers >= currentUser.limits.max_servers;
  const deploymentLimitReached =
    currentUser &&
    typeof currentUser.limits?.max_deployments === "number" &&
    typeof currentUser.usage?.deployments === "number" &&
    currentUser.usage.deployments >= currentUser.limits.max_deployments;

  function getSuggestedExternalPort(serverId) {
    const selectedServer = servers.find((server) => server.id === serverId);
    if (selectedServer?.name === "main-vps") {
      return "8080";
    }
    return "";
  }

  async function loadCurrentUser() {
    const response = await fetch(`${apiBaseUrl}/auth/me`, {
      cache: "no-store",
      credentials: "include",
    });
    const data = await readJsonOrError(response, "Authentication failed.");
    setCurrentUser(data);
    return data;
  }

  async function loadDeployments(silent = false) {
    if (!silent) {
      setLoading(true);
      setError("");
    }

    try {
      const response = await fetch(`${apiBaseUrl}/deployments`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await readJsonOrError(response, "Failed to load deployments.");
      setDeployments(Array.isArray(data) ? data : []);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load deployments.",
      );
      if (!silent) {
        setDeployments([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  async function loadServers(silent = false) {
    if (!silent) {
      setServersLoading(true);
      setServersError("");
    }

    try {
      const response = await fetch(`${apiBaseUrl}/servers`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await readJsonOrError(response, "Failed to load servers.");
      setServers(Array.isArray(data) ? data : []);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }

      setServersError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load servers.",
      );
      if (!silent) {
        setServers([]);
      }
    } finally {
      if (!silent) {
        setServersLoading(false);
      }
    }
  }

  async function loadNotifications(silent = false) {
    if (!silent) {
      setNotificationsLoading(true);
      setNotificationsError("");
    }

    try {
      const response = await fetch(`${apiBaseUrl}/notifications`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await readJsonOrError(response, "Failed to load notifications.");
      setNotifications(Array.isArray(data) ? data : []);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }

      setNotificationsError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load notifications.",
      );
      if (!silent) {
        setNotifications([]);
      }
    } finally {
      if (!silent) {
        setNotificationsLoading(false);
      }
    }
  }

  async function refreshPage(silent = false) {
    await Promise.all([
      loadCurrentUser(),
      loadDeployments(silent),
      loadServers(silent),
      loadNotifications(silent),
    ]);
  }

  useEffect(() => {
    async function checkAuthAndLoad() {
      try {
        await loadCurrentUser();
        setAuthChecked(true);
        await refreshPage();
      } catch {
        router.replace("/login");
      }
    }

    checkAuthAndLoad();
  }, [router]);

  useEffect(() => {
    if (!authChecked) {
      return;
    }

    const intervalId = window.setInterval(() => {
      refreshPage(true);
    }, 8000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [authChecked]);

  function updateFormField(event) {
    const { name, value } = event.target;
    setForm((currentForm) => {
      const nextForm = {
        ...currentForm,
        [name]: value,
      };

      if (name === "server_id" && !currentForm.external_port.trim()) {
        nextForm.external_port = getSuggestedExternalPort(value);
      }

      return nextForm;
    });
  }

  function updateServerFormField(event) {
    const { name, value } = event.target;
    setServerForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function updateEnvRow(index, field, value) {
    setEnvRows((currentRows) =>
      currentRows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    );
  }

  function addEnvRow() {
    setEnvRows((currentRows) => [...currentRows, { key: "", value: "" }]);
  }

  function removeEnvRow(index) {
    setEnvRows((currentRows) => {
      if (currentRows.length === 1) {
        return [{ key: "", value: "" }];
      }
      return currentRows.filter((_, rowIndex) => rowIndex !== index);
    });
  }

  function buildEnvPayload(rows) {
    const env = {};
    for (const row of rows) {
      const key = row.key.trim();
      if (!key) {
        continue;
      }
      env[key] = row.value;
    }
    return env;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");
    setCreatedDeployment(null);

    if (deploymentLimitReached) {
      setSubmitError("Deployment limit reached for your current plan. Upgrade to continue.");
      setSubmitting(false);
      return;
    }

    const payload = {
      image: form.image,
      env: buildEnvPayload(envRows),
    };

    if (form.name.trim()) {
      payload.name = form.name.trim();
    }

    if (form.internal_port.trim()) {
      payload.internal_port = Number(form.internal_port);
    }

    if (form.external_port.trim()) {
      payload.external_port = Number(form.external_port);
    }

    if (form.server_id) {
      payload.server_id = form.server_id;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/deployments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await readJsonOrError(response, "Failed to create deployment.");

      setCreatedDeployment(data);
      setForm({
        image: "",
        name: "",
        internal_port: "",
        external_port: getSuggestedExternalPort(form.server_id),
        server_id: form.server_id,
      });
      setEnvRows([{ key: "", value: "" }]);
      setSubmitSuccess("Deployment created successfully.");
      await refreshPage();
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }

      setSubmitError(
        requestError instanceof Error
          ? normalizeCreateDeploymentError(requestError.message)
          : "Failed to create deployment. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateServer(event) {
    event.preventDefault();
    setServerSubmitting(true);
    setServerSubmitError("");
    setServerSubmitSuccess("");

    if (serverLimitReached) {
      setServerSubmitError("Server limit reached for your current plan. Upgrade to continue.");
      setServerSubmitting(false);
      return;
    }

    const payload = {
      name: serverForm.name,
      host: serverForm.host,
      port: Number(serverForm.port || 22),
      username: serverForm.username,
      auth_type: serverForm.auth_type,
    };

    if (serverForm.auth_type === "password" && serverForm.password) {
      payload.password = serverForm.password;
    }

    if (serverForm.auth_type === "ssh_key" && serverForm.ssh_key) {
      payload.ssh_key = serverForm.ssh_key;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/servers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      await readJsonOrError(response, "Failed to create server.");

      setServerForm({
        name: "",
        host: "",
        port: "22",
        username: "",
        auth_type: "password",
        password: "",
        ssh_key: "",
      });
      setServerSubmitSuccess("Server added successfully.");
      await refreshPage();
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }

      setServerSubmitError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to create server.",
      );
    } finally {
      setServerSubmitting(false);
    }
  }

  async function handleDelete(deploymentId) {
    const confirmed = window.confirm(
      "Delete this deployment? This will also try to remove its Docker container.",
    );

    if (!confirmed) {
      return;
    }

    setDeleteError("");
    setDeletingDeploymentId(deploymentId);

    try {
      const response = await fetch(`${apiBaseUrl}/deployments/${deploymentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      await readJsonOrError(response, "Failed to delete deployment.");

      if (createdDeployment?.id === deploymentId) {
        setCreatedDeployment(null);
        setSubmitSuccess("");
      }

      await refreshPage();
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }

      setDeleteError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to delete deployment.",
      );
    } finally {
      setDeletingDeploymentId("");
    }
  }

  async function handleDeleteServer(serverId) {
    const confirmed = window.confirm(
      "Delete this server? Deletion is blocked while deployments still use it.",
    );

    if (!confirmed) {
      return;
    }

    setServerDeleteError("");
    setDeletingServerId(serverId);

    try {
      const response = await fetch(`${apiBaseUrl}/servers/${serverId}`, {
        method: "DELETE",
        credentials: "include",
      });
      await readJsonOrError(response, "Failed to delete server.");

      if (form.server_id === serverId) {
        setForm((currentForm) => ({
          ...currentForm,
          server_id: "",
        }));
      }

      await refreshPage();
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }

      setServerDeleteError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to delete server.",
      );
    } finally {
      setDeletingServerId("");
    }
  }

  async function handleTestServer(serverId) {
    setServerTestResults((currentResults) => ({
      ...currentResults,
      [serverId]: null,
    }));
    setTestingServerId(serverId);

    try {
      const response = await fetch(`${apiBaseUrl}/servers/${serverId}/test`, {
        method: "POST",
        credentials: "include",
      });
      const data = await readJsonOrError(response, "Failed to test server connection.");
      setServerTestResults((currentResults) => ({
        ...currentResults,
        [serverId]: data,
      }));
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }

      setServerTestResults((currentResults) => ({
        ...currentResults,
        [serverId]: {
          status: "error",
          message:
            requestError instanceof Error
              ? requestError.message
              : "Failed to test server connection.",
        },
      }));
    } finally {
      setTestingServerId("");
    }
  }

  async function handleLogout() {
    try {
      await fetch(`${apiBaseUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.replace("/login");
    }
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

  return (
    <main className="page">
      <div className="container">
        <div className="header">
          <div>
            <h1>DeployMate</h1>
            <p>{currentUser ? `Logged in as ${currentUser.username}` : "Deployments"}</p>
          </div>
          <div className="buttonRow">
            {currentUser?.is_admin ? (
              <Link href="/app/users" className="linkButton">
                Users
              </Link>
            ) : null}
            {currentUser?.is_admin ? (
              <Link href="/app/upgrade-requests" className="linkButton">
                Upgrade inbox
              </Link>
            ) : null}
            <button
              type="button"
              onClick={refreshPage}
              disabled={loading || serversLoading || notificationsLoading}
            >
              {loading || serversLoading || notificationsLoading ? "Refreshing..." : "Refresh"}
            </button>
            <button type="button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        {error ? <div className="banner error">{error}</div> : null}
        {serversError ? <div className="banner error">{serversError}</div> : null}
        {deleteError ? <div className="banner error">{deleteError}</div> : null}
        {serverDeleteError ? <div className="banner error">{serverDeleteError}</div> : null}
        {currentUser?.must_change_password ? (
          <div className="banner error">
            You are still using the default admin password.{" "}
            <Link href="/change-password" className="inlineLink">
              Change it now
            </Link>
            .
          </div>
        ) : null}

        <div className="banner">
          Backend: <code>{apiBaseUrl}</code>
        </div>

        {currentUser ? (
          <div className="banner">
            Plan: <strong>{currentUser.plan}</strong>
            {" · "}
            Servers {currentUser.usage?.servers ?? 0}/{currentUser.limits?.max_servers ?? 0}
            {" · "}
            Deployments {currentUser.usage?.deployments ?? 0}/
            {currentUser.limits?.max_deployments ?? 0}
            {" · "}
            <Link href="/upgrade" className="inlineLink">
              Upgrade
            </Link>
          </div>
        ) : null}

        <div className="banner subtle">
          Deployments and notifications refresh automatically every 8 seconds.
        </div>

        <article className="card formCard onboardingCard">
          <h2>Getting Started</h2>
          <div className="onboardingList">
            <div className="onboardingItem">
              <strong>Add server</strong>
              <p>Save your VPS target with SSH access so DeployMate can reach it.</p>
            </div>
            <div className="onboardingItem">
              <strong>Test connection</strong>
              <p>Run the built-in SSH and Docker check before the first deploy.</p>
            </div>
            <div className="onboardingItem">
              <strong>Create deployment</strong>
              <p>Pick an image, set ports and env vars, then launch your app.</p>
            </div>
          </div>
        </article>

        {serverLimitReached ? (
          <div className="banner error">
            You reached the server limit for the <strong>{currentUser.plan}</strong> plan.{" "}
            <Link href="/upgrade" className="inlineLink">
              Upgrade
            </Link>
            .
          </div>
        ) : null}

        {deploymentLimitReached ? (
          <div className="banner error">
            You reached the deployment limit for the <strong>{currentUser.plan}</strong> plan.{" "}
            <Link href="/upgrade" className="inlineLink">
              Upgrade
            </Link>
            .
          </div>
        ) : null}

        <article className="card formCard">
          <h2>Servers</h2>
          <form className="form" onSubmit={handleCreateServer}>
            <label className="field">
              <span>Name</span>
              <input
                name="name"
                value={serverForm.name}
                onChange={updateServerFormField}
                placeholder="demo-vps"
                disabled={serverSubmitting}
                required
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
              />
            </label>

            <label className="field">
              <span>Username</span>
              <input
                name="username"
                value={serverForm.username}
                onChange={updateServerFormField}
                placeholder="root"
                disabled={serverSubmitting}
                required
              />
            </label>

            <label className="field">
              <span>Auth type</span>
              <select
                name="auth_type"
                value={serverForm.auth_type}
                onChange={updateServerFormField}
                disabled={serverSubmitting}
              >
                <option value="password">password</option>
                <option value="ssh_key">ssh_key</option>
              </select>
            </label>

            {serverForm.auth_type === "password" ? (
              <label className="field">
                <span>Password</span>
                <input
                  name="password"
                  type="password"
                  value={serverForm.password}
                  onChange={updateServerFormField}
                  disabled={serverSubmitting}
                  required
                />
              </label>
            ) : null}

            {serverForm.auth_type === "ssh_key" ? (
              <label className="field">
                <span>SSH key</span>
                <textarea
                  name="ssh_key"
                  value={serverForm.ssh_key}
                  onChange={updateServerFormField}
                  disabled={serverSubmitting}
                  required
                />
              </label>
            ) : null}

            <div className="formActions">
              <button type="submit" disabled={serverSubmitting || serverLimitReached}>
                {serverSubmitting ? "Adding..." : "Add server"}
              </button>
            </div>
          </form>

          {serverSubmitError ? <div className="banner error">{serverSubmitError}</div> : null}
          {serverSubmitSuccess ? <div className="banner success">{serverSubmitSuccess}</div> : null}

          <div className="list compactList">
            {serversLoading && servers.length === 0 ? (
              <div className="empty">Loading servers...</div>
            ) : null}

            {!serversLoading && servers.length === 0 ? (
              <div className="empty">No servers yet. Local deploy is still available.</div>
            ) : null}

            {servers.map((server) => (
              <article className="card compactCard" key={server.id}>
                <div className="row">
                  <span className="label">Name</span>
                  <span>{server.name}</span>
                </div>
                <div className="row">
                  <span className="label">Host</span>
                  <span>
                    {server.username}@{server.host}:{server.port}
                  </span>
                </div>
                <div className="row">
                  <span className="label">Auth</span>
                  <span>{server.auth_type}</span>
                </div>
                <div className="actions">
                  <button
                    type="button"
                    onClick={() => handleTestServer(server.id)}
                    disabled={testingServerId === server.id}
                  >
                    {testingServerId === server.id ? "Testing..." : "Test connection"}
                  </button>
                  <button
                    type="button"
                    className="dangerButton"
                    onClick={() => handleDeleteServer(server.id)}
                    disabled={deletingServerId === server.id}
                  >
                    {deletingServerId === server.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
                {serverTestResults[server.id]?.message ? (
                  <div
                    className={`banner ${
                      serverTestResults[server.id].status === "success" ? "success" : "error"
                    } inlineBanner`}
                  >
                    {serverTestResults[server.id].message}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </article>

        <article className="card formCard">
          <div className="sectionHeader">
            <h2>Activity history</h2>
            <p className="formHint">Past deploy events stay here even after a deployment is deleted.</p>
          </div>

          {notificationsError ? <div className="banner error">{notificationsError}</div> : null}

          {notificationsLoading && notifications.length === 0 ? (
            <div className="empty">Loading notifications...</div>
          ) : null}

          {!notificationsLoading && notifications.length === 0 ? (
            <div className="empty">No notifications yet.</div>
          ) : null}

          {notifications.length > 0 ? (
            <div className="timeline">
              {notifications.map((item) => (
                <div className="timelineItem" key={item.id}>
                  <div className="row">
                    <span className="label">Level</span>
                    <span className={`status ${item.level || "unknown"}`}>
                      {item.level || "unknown"}
                    </span>
                  </div>
                  <div className="row">
                    <span className="label">Title</span>
                    <span>{item.title || "-"}</span>
                  </div>
                  <div className="row">
                    <span className="label">Message</span>
                    <span>{item.message || "-"}</span>
                  </div>
                  <div className="row">
                    <span className="label">Created</span>
                    <span>{formatDate(item.created_at)}</span>
                  </div>
                  <div className="row">
                    <span className="label">Deployment</span>
                    <span>
                      {item.deployment_id ? (
                        <Link href={`/deployments/${item.deployment_id}`} className="inlineLink">
                          {item.deployment_id}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </article>

        <article className="card formCard">
          <h2>Create deployment</h2>
          <form className="form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Image</span>
              <input
                name="image"
                value={form.image}
                onChange={updateFormField}
                placeholder="nginx:latest"
                disabled={submitting}
                required
              />
            </label>

            <label className="field">
              <span>Name</span>
              <input
                name="name"
                value={form.name}
                onChange={updateFormField}
                placeholder="optional"
                disabled={submitting}
              />
            </label>

            <label className="field">
              <span>Internal port</span>
              <input
                name="internal_port"
                type="number"
                min="1"
                max="65535"
                value={form.internal_port}
                onChange={updateFormField}
                placeholder="optional"
                disabled={submitting}
              />
            </label>

            <label className="field">
              <span>External port</span>
              <input
                name="external_port"
                type="number"
                min="1"
                max="65535"
                value={form.external_port}
                onChange={updateFormField}
                placeholder="optional"
                disabled={submitting}
              />
              <span className="fieldHint">
                On main-vps, port 80 is already used by DeployMate itself. Prefer 8080 or 8081.
              </span>
            </label>

            <div className="field">
              <span>Env vars</span>
              <div className="list">
                {envRows.map((row, index) => (
                  <div className="envRow" key={`create-env-${index}`}>
                    <input
                      value={row.key}
                      onChange={(event) => updateEnvRow(index, "key", event.target.value)}
                      placeholder="KEY"
                      disabled={submitting}
                    />
                    <input
                      value={row.value}
                      onChange={(event) => updateEnvRow(index, "value", event.target.value)}
                      placeholder="value"
                      disabled={submitting}
                    />
                    <button
                      type="button"
                      onClick={() => removeEnvRow(index)}
                      disabled={submitting}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="formActions">
                <button type="button" onClick={addEnvRow} disabled={submitting}>
                  Add env var
                </button>
              </div>
            </div>

            <label className="field">
              <span>Server</span>
              <select
                name="server_id"
                value={form.server_id}
                onChange={updateFormField}
                disabled={submitting}
              >
                <option value="">Local</option>
                {servers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.name} ({server.host})
                  </option>
                ))}
              </select>
            </label>

            <div className="formActions">
              <button type="submit" disabled={submitting || deploymentLimitReached}>
                {submitting ? "Creating..." : "Create deployment"}
              </button>
              {submitting ? <span className="formHint">Sending request to backend...</span> : null}
            </div>
          </form>

          {submitError ? <div className="banner error">{submitError}</div> : null}
          {submitSuccess ? (
            <div className="banner success">
              <div>{submitSuccess}</div>
              {createdDeployment?.id ? (
                <div className="successActions">
                  <Link
                    href={`/deployments/${createdDeployment.id}`}
                    className="linkButton"
                  >
                    View details
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}
        </article>

        <div className="list">
          {loading && deployments.length === 0 ? (
            <div className="empty">Loading deployments...</div>
          ) : null}

          {!loading && deployments.length === 0 ? (
            <div className="empty">No deployments found.</div>
          ) : null}

          {deployments.map((deployment) => (
            <article className="card" key={deployment.id}>
              <div className="row">
                <span className="label">Status</span>
                <span className={`status ${deployment.status || "unknown"}`}>
                  {deployment.status || "unknown"}
                </span>
              </div>
              <div className="row">
                <span className="label">Image</span>
                <span>{deployment.image || "N/A"}</span>
              </div>
              <div className="row">
                <span className="label">Container</span>
                <span>{deployment.container_name || "N/A"}</span>
              </div>
              <div className="row">
                <span className="label">Server</span>
                <span>
                  {deployment.server_name
                    ? `${deployment.server_name} (${deployment.server_host})`
                    : "Local"}
                </span>
              </div>
              <div className="row">
                <span className="label">Created</span>
                <span>{formatDate(deployment.created_at)}</span>
              </div>
              <div className="row">
                <span className="label">Error</span>
                <span>{deployment.error || "-"}</span>
              </div>
              <div className="actions">
                <Link href={`/deployments/${deployment.id}`} className="linkButton">
                  View details
                </Link>
                <button
                  type="button"
                  className="dangerButton"
                  onClick={() => handleDelete(deployment.id)}
                  disabled={deletingDeploymentId === deployment.id}
                >
                  {deletingDeploymentId === deployment.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
