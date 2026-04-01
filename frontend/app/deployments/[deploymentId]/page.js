"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

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

function buildDeploymentUrl(deployment) {
  if (!deployment?.server_host || !deployment?.external_port) {
    return "";
  }
  return `http://${deployment.server_host}:${deployment.external_port}`;
}

function normalizeRedeployError(message) {
  if (!message) {
    return "Failed to redeploy deployment.";
  }

  if (message.includes("is already in use on server")) {
    return `${message} Recommended free ports on main-vps: 8080, 8081, 8082.`;
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

export default function DeploymentDetailsPage({ params }) {
  const { deploymentId } = use(params);
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [deployment, setDeployment] = useState(null);
  const [logs, setLogs] = useState("");
  const [health, setHealth] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [redeploying, setRedeploying] = useState(false);
  const [redeployError, setRedeployError] = useState("");
  const [redeploySuccess, setRedeploySuccess] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [envExpanded, setEnvExpanded] = useState(false);
  const [form, setForm] = useState({
    image: "",
    name: "",
    internal_port: "",
    external_port: "",
  });
  const [envRows, setEnvRows] = useState([{ key: "", value: "" }]);

  async function loadDeploymentDetails(silent = false) {
    if (!silent) {
      setLoading(true);
      setError("");
    }

    try {
      const deploymentResponse = await fetch(
        `${apiBaseUrl}/deployments/${deploymentId}`,
        {
          cache: "no-store",
          credentials: "include",
        },
      );
      const deploymentData = await readJsonOrError(
        deploymentResponse,
        "Failed to load deployment.",
      );
      setDeployment(deploymentData);
      setForm({
        image: deploymentData.image || "",
        name: deploymentData.container_name || "",
        internal_port:
          deploymentData.internal_port === null ||
          deploymentData.internal_port === undefined
            ? ""
            : String(deploymentData.internal_port),
        external_port:
          deploymentData.external_port === null ||
          deploymentData.external_port === undefined
            ? ""
            : String(deploymentData.external_port),
      });
      setEnvRows(
        Object.entries(deploymentData.env || {}).length > 0
          ? Object.entries(deploymentData.env || {}).map(([key, value]) => ({
              key,
              value: String(value ?? ""),
            }))
          : [{ key: "", value: "" }],
      );

      const [logsResult, healthResult, activityResult] = await Promise.allSettled([
        fetch(`${apiBaseUrl}/deployments/${deploymentId}/logs`, {
          cache: "no-store",
          credentials: "include",
        }).then((response) =>
          readJsonOrError(response, "Failed to load deployment logs."),
        ),
        fetch(`${apiBaseUrl}/deployments/${deploymentId}/health`, {
          cache: "no-store",
          credentials: "include",
        }).then((response) =>
          readJsonOrError(response, "Failed to load deployment health."),
        ),
        fetch(`${apiBaseUrl}/deployments/${deploymentId}/activity`, {
          cache: "no-store",
          credentials: "include",
        }).then((response) =>
          readJsonOrError(response, "Failed to load deployment activity."),
        ),
      ]);

      if (logsResult.status === "fulfilled") {
        setLogs(logsResult.value?.logs || "");
      } else {
        setLogs(logsResult.reason?.message || "Failed to load deployment logs.");
      }

      if (healthResult.status === "fulfilled") {
        setHealth(healthResult.value);
      } else {
        setHealth({
          status: "unavailable",
          error: healthResult.reason?.message || "Failed to load deployment health.",
        });
      }

      if (activityResult.status === "fulfilled") {
        setActivity(Array.isArray(activityResult.value) ? activityResult.value : []);
      } else {
        setActivity([]);
      }
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load deployment details.",
      );
      if (!silent) {
        setDeployment(null);
        setLogs("");
        setHealth(null);
        setActivity([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
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
        await loadDeploymentDetails();
      } catch {
        router.replace("/login");
      }
    }

    checkAuthAndLoad();
  }, [deploymentId, router]);

  useEffect(() => {
    if (!authChecked) {
      return;
    }

    const intervalId = window.setInterval(() => {
      loadDeploymentDetails(true);
    }, 8000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [authChecked, deploymentId]);

  function updateFormField(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function useSuggestedPort(port) {
    setForm((currentForm) => ({
      ...currentForm,
      external_port: String(port),
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

  async function copyText(value, label) {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied.`);
      window.setTimeout(() => {
        setCopyMessage("");
      }, 2000);
    } catch {
      setCopyMessage(`Failed to copy ${label.toLowerCase()}.`);
    }
  }

  async function handleRedeploy(event) {
    event.preventDefault();
    setRedeploying(true);
    setRedeployError("");
    setRedeploySuccess("");

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

    try {
      const response = await fetch(
        `${apiBaseUrl}/deployments/${deploymentId}/redeploy`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );
      await readJsonOrError(response, "Failed to redeploy deployment.");
      setRedeploySuccess("Deployment redeployed successfully.");
      await loadDeploymentDetails();
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }

      setRedeployError(
        requestError instanceof Error
          ? normalizeRedeployError(requestError.message)
          : "Failed to redeploy deployment.",
      );
    } finally {
      setRedeploying(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "Delete this deployment? This will also try to remove its Docker container.",
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const response = await fetch(`${apiBaseUrl}/deployments/${deploymentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      await readJsonOrError(response, "Failed to delete deployment.");
      router.push("/app");
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to delete deployment.",
      );
    } finally {
      setDeleting(false);
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
            <h1>Deployment Details</h1>
            <p>
              {currentUser
                ? `${deploymentId} · ${currentUser.username}`
                : deploymentId}
            </p>
          </div>
          <div className="buttonRow">
            <Link href="/app" className="linkButton">
              Back
            </Link>
            {buildDeploymentUrl(deployment) ? (
              <a
                href={buildDeploymentUrl(deployment)}
                target="_blank"
                rel="noreferrer"
                className="linkButton"
              >
                Open app
              </a>
            ) : null}
            <button type="button" onClick={() => loadDeploymentDetails()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button type="button" onClick={handleLogout}>
              Logout
            </button>
            <button
              type="button"
              className="dangerButton"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>

        {error ? <div className="banner error">{error}</div> : null}
        {copyMessage ? <div className="banner subtle">{copyMessage}</div> : null}
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

        <div className="banner subtle">
          Deployment, health, and activity refresh automatically every 8 seconds.
        </div>

        <article className="card formCard">
          <h2>Redeploy</h2>
          <form className="form" onSubmit={handleRedeploy}>
            <label className="field">
              <span>Image</span>
              <input
                name="image"
                value={form.image}
                onChange={updateFormField}
                placeholder="nginx:latest"
                disabled={redeploying}
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
                disabled={redeploying}
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
                disabled={redeploying}
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
                disabled={redeploying}
              />
              <span className="fieldHint">
                On main-vps, port 80 is reserved by DeployMate. Recommended: 8080, 8081, 8082.
              </span>
              <div className="portSuggestions">
                <button
                  type="button"
                  onClick={() => useSuggestedPort(8080)}
                  disabled={redeploying}
                >
                  Use 8080
                </button>
                <button
                  type="button"
                  onClick={() => useSuggestedPort(8081)}
                  disabled={redeploying}
                >
                  Use 8081
                </button>
                <button
                  type="button"
                  onClick={() => useSuggestedPort(8082)}
                  disabled={redeploying}
                >
                  Use 8082
                </button>
              </div>
            </label>

            <div className="field">
              <span>Env vars</span>
              <div className="list">
                {envRows.map((row, index) => (
                  <div className="envRow" key={`redeploy-env-${index}`}>
                    <input
                      value={row.key}
                      onChange={(event) => updateEnvRow(index, "key", event.target.value)}
                      placeholder="KEY"
                      disabled={redeploying}
                    />
                    <input
                      value={row.value}
                      onChange={(event) => updateEnvRow(index, "value", event.target.value)}
                      placeholder="value"
                      disabled={redeploying}
                    />
                    <button
                      type="button"
                      onClick={() => removeEnvRow(index)}
                      disabled={redeploying}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="formActions">
                <button type="button" onClick={addEnvRow} disabled={redeploying}>
                  Add env var
                </button>
              </div>
            </div>

            <div className="formActions">
              <button type="submit" disabled={redeploying}>
                {redeploying ? "Redeploying..." : "Redeploy"}
              </button>
              {redeploying ? <span className="formHint">Redeploying container...</span> : null}
            </div>
          </form>

          {redeployError ? <div className="banner error">{redeployError}</div> : null}
          {redeploySuccess ? <div className="banner success">{redeploySuccess}</div> : null}
        </article>

        {loading && !deployment ? <div className="empty">Loading deployment...</div> : null}

        {deployment ? (
          <>
            <article className="card">
              <div className="row">
                <span className="label">Status</span>
                <span className={`status ${deployment.status || "unknown"}`}>
                  {deployment.status || "unknown"}
                </span>
              </div>
              <div className="row">
                <span className="label">Image</span>
                <span className="valueWithActions">
                  <span>{deployment.image || "N/A"}</span>
                  {deployment.image ? (
                    <button
                      type="button"
                      className="smallButton"
                      onClick={() => copyText(deployment.image, "Image")}
                    >
                      Copy
                    </button>
                  ) : null}
                </span>
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
              <div className="row">
                <span className="label">URL</span>
                <span className="valueWithActions">
                  {buildDeploymentUrl(deployment) ? (
                    <>
                      <a
                        href={buildDeploymentUrl(deployment)}
                        target="_blank"
                        rel="noreferrer"
                        className="inlineLink"
                      >
                        {buildDeploymentUrl(deployment)}
                      </a>
                      <button
                        type="button"
                        className="smallButton"
                        onClick={() => copyText(buildDeploymentUrl(deployment), "URL")}
                      >
                        Copy
                      </button>
                    </>
                  ) : (
                    "-"
                  )}
                </span>
              </div>
              <div className="row">
                <span className="label">Env vars</span>
                <span>
                  {Object.keys(deployment.env || {}).length > 0 ? (
                    <div className="stackedValue">
                      <div className="inlineActions">
                        <button
                          type="button"
                          className="smallButton"
                          onClick={() => copyText(JSON.stringify(deployment.env, null, 2), "Env")}
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          className="smallButton"
                          onClick={() => setEnvExpanded((current) => !current)}
                        >
                          {envExpanded ? "Show less" : "Show more"}
                        </button>
                      </div>
                      <pre className={`logs ${envExpanded ? "expandedBlock" : "collapsedBlock"}`}>
                        {JSON.stringify(deployment.env, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    "-"
                  )}
                </span>
              </div>
            </article>

            <article className="card">
              <div className="row">
                <span className="label">Health status</span>
                <span className={`status ${health?.status || "unknown"}`}>
                  {health?.status || "unknown"}
                </span>
              </div>
              <div className="row">
                <span className="label">Health URL</span>
                <span className="valueWithActions">
                  {health?.url ? (
                    <>
                      <a href={health.url} target="_blank" rel="noreferrer" className="inlineLink">
                        {health.url}
                      </a>
                      <button
                        type="button"
                        className="smallButton"
                        onClick={() => copyText(health.url, "Health URL")}
                      >
                        Copy
                      </button>
                    </>
                  ) : (
                    "-"
                  )}
                </span>
              </div>
              <div className="row">
                <span className="label">Health error</span>
                <span>{health?.error || "-"}</span>
              </div>
            </article>

            <article className="card">
              <div className="row">
                <span className="label">Logs</span>
                <div className="stackedValue">
                  <div className="inlineActions">
                    <button
                      type="button"
                      className="smallButton"
                      onClick={() => copyText(logs || "No logs available.", "Logs")}
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      className="smallButton"
                      onClick={() => setLogsExpanded((current) => !current)}
                    >
                      {logsExpanded ? "Show less" : "Show more"}
                    </button>
                  </div>
                  <pre className={`logs ${logsExpanded ? "expandedBlock" : "collapsedBlock"}`}>
                    {logs || "No logs available."}
                  </pre>
                </div>
              </div>
            </article>

            <article className="card">
              <div className="sectionHeader">
                <h2>Activity</h2>
              </div>

              {activity.length === 0 ? (
                <div className="empty">No activity yet.</div>
              ) : (
                <div className="timeline">
                  {activity.map((item) => (
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
                    </div>
                  ))}
                </div>
              )}
            </article>
          </>
        ) : null}
      </div>
    </main>
  );
}
