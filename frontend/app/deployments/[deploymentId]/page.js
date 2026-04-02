"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import {
  smokeActivity,
  smokeDeployment,
  smokeDiagnostics,
  smokeHealth,
  smokeMode,
  smokeUser,
} from "../../lib/smoke-fixtures";

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

function buildAttentionItems(deployment, health, diagnostics) {
  const items = [];

  if (deployment?.error) {
    items.push({
      key: "deployment-error",
      label: "Deployment error",
      status: "error",
      message: deployment.error,
    });
  }

  if (health?.status && health.status !== "healthy") {
    items.push({
      key: "health-status",
      label: "Health check",
      status: health.status === "unavailable" ? "warn" : "error",
      message: health.error || `Current health status is ${health.status}.`,
    });
  }

  if (diagnostics?.activity?.recent_failure_titles?.length > 0) {
    items.push({
      key: "recent-failures",
      label: "Recent failures",
      status: "error",
      message: diagnostics.activity.recent_failure_titles.join(" | "),
    });
  }

  for (const item of diagnostics?.items || []) {
    if (item.status && item.status !== "ok") {
      items.push({
        key: `diagnostic-${item.key}`,
        label: item.label,
        status: item.status === "warn" ? "warn" : "error",
        message: item.summary || item.details || "Diagnostics attention needed.",
      });
    }
  }

  return items;
}

function buildRuntimeSummaryText(deployment, health, diagnostics, activity) {
  if (!deployment) {
    return "";
  }

  const lines = [
    `Deployment ${deployment.id}`,
    `Status: ${deployment.status || "unknown"}`,
    `Image: ${deployment.image || "n/a"}`,
    `Container: ${deployment.container_name || "n/a"}`,
    `Server: ${
      deployment.server_name && deployment.server_host
        ? `${deployment.server_name} (${deployment.server_host})`
        : "Local"
    }`,
    `URL: ${buildDeploymentUrl(deployment) || "n/a"}`,
    `Ports: ${deployment.internal_port || "-"} -> ${deployment.external_port || "-"}`,
    `Health: ${health?.status || "unknown"}${
      health?.response_time_ms || health?.response_time_ms === 0
        ? ` in ${health.response_time_ms} ms`
        : ""
    }`,
    `Diagnostics target: ${diagnostics?.server_target || "n/a"}`,
    `Activity events: ${Array.isArray(activity) ? activity.length : 0}`,
  ];

  if (diagnostics?.activity?.last_event_title) {
    lines.push(`Last event: ${diagnostics.activity.last_event_title}`);
  }

  return lines.join("\n");
}

function formatSuggestedPorts(ports) {
  if (!Array.isArray(ports) || ports.length === 0) {
    return "";
  }
  return ports.join(", ");
}

function normalizeRedeployError(message) {
  return normalizeDeploymentActionError(message, "Failed to redeploy deployment.");
}

function normalizeDeploymentActionError(message, fallbackMessage) {
  if (!message) {
    return fallbackMessage;
  }

  if (message.includes("Port ") && message.includes("is already in use on server")) {
    return `${message} Use one of the suggested free ports for this server.`;
  }

  if (message.includes("Container name ") && message.includes("is already in use on server")) {
    return `${message} Choose another deployment name or keep the current one.`;
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
  const [authChecked, setAuthChecked] = useState(smokeMode);
  const [currentUser, setCurrentUser] = useState(smokeMode ? smokeUser : null);
  const [deployment, setDeployment] = useState(smokeMode ? smokeDeployment : null);
  const [logs, setLogs] = useState(smokeMode ? "nginx entered RUNNING state" : "");
  const [health, setHealth] = useState(smokeMode ? smokeHealth : null);
  const [diagnostics, setDiagnostics] = useState(smokeMode ? smokeDiagnostics : null);
  const [activity, setActivity] = useState(smokeMode ? smokeActivity : []);
  const [loading, setLoading] = useState(!smokeMode);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [redeploying, setRedeploying] = useState(false);
  const [redeployError, setRedeployError] = useState("");
  const [redeploySuccess, setRedeploySuccess] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const [templateSuccess, setTemplateSuccess] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [diagnosticsError, setDiagnosticsError] = useState("");
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [diagnosticsLogsExpanded, setDiagnosticsLogsExpanded] = useState(false);
  const [envExpanded, setEnvExpanded] = useState(false);
  const [suggestedPorts, setSuggestedPorts] = useState([]);
  const [suggestedPortsLoading, setSuggestedPortsLoading] = useState(false);
  const [form, setForm] = useState({
    image: "",
    name: "",
    internal_port: "",
    external_port: "",
  });
  const [envRows, setEnvRows] = useState([{ key: "", value: "" }]);
  const deploymentUrl = buildDeploymentUrl(deployment);
  const attentionItems = buildAttentionItems(deployment, health, diagnostics);
  const runtimeSummaryText = buildRuntimeSummaryText(
    deployment,
    health,
    diagnostics,
    activity,
  );
  const detailPriority =
    attentionItems[0]?.message ||
    (deployment?.status === "failed"
      ? "Deployment is failed and needs a deliberate redeploy."
      : health?.status && health.status !== "healthy"
        ? `Health is currently ${health.status}.`
        : "Runtime surface is stable enough for review.");

  async function loadDeploymentDiagnostics() {
    setDiagnosticsLoading(true);
    setDiagnosticsError("");
    try {
      const response = await fetch(`${apiBaseUrl}/deployments/${deploymentId}/diagnostics`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await readJsonOrError(response, "Failed to load deployment diagnostics.");
      setDiagnostics(data);
      return data;
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return null;
      }
      setDiagnosticsError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load deployment diagnostics.",
      );
      return null;
    } finally {
      setDiagnosticsLoading(false);
    }
  }

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

      const [logsResult, healthResult, activityResult, diagnosticsResult] = await Promise.allSettled([
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
        fetch(`${apiBaseUrl}/deployments/${deploymentId}/diagnostics`, {
          cache: "no-store",
          credentials: "include",
        }).then((response) =>
          readJsonOrError(response, "Failed to load deployment diagnostics."),
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

      if (diagnosticsResult.status === "fulfilled") {
        setDiagnostics(diagnosticsResult.value);
        setDiagnosticsError("");
      } else {
        setDiagnostics(null);
        setDiagnosticsError(
          diagnosticsResult.reason?.message || "Failed to load deployment diagnostics.",
        );
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
        setDiagnostics(null);
        setActivity([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
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
        await loadDeploymentDetails();
      } catch {
        router.replace("/login");
      }
    }

    checkAuthAndLoad();
  }, [deploymentId, router]);

  useEffect(() => {
    if (smokeMode || !authChecked) {
      return;
    }

    const intervalId = window.setInterval(() => {
      loadDeploymentDetails(true);
    }, 8000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [authChecked, deploymentId]);

  useEffect(() => {
    async function loadSuggestedPorts() {
      if (smokeMode) {
        setSuggestedPorts([38080, 38081, 38082]);
        setSuggestedPortsLoading(false);
        return;
      }

      if (!deployment?.server_id) {
        setSuggestedPorts([]);
        setSuggestedPortsLoading(false);
        return;
      }

      setSuggestedPortsLoading(true);
      try {
        const response = await fetch(
          `${apiBaseUrl}/servers/${deployment.server_id}/suggested-ports`,
          {
            cache: "no-store",
            credentials: "include",
          },
        );
        const data = await readJsonOrError(response, "Failed to load suggested ports.");
        setSuggestedPorts(Array.isArray(data?.ports) ? data.ports : []);
      } catch {
        setSuggestedPorts([]);
      } finally {
        setSuggestedPortsLoading(false);
      }
    }

    loadSuggestedPorts();
  }, [deployment?.server_id]);

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

  function buildTemplatePayload() {
    const payload = {
      template_name: templateName.trim(),
      image: form.image.trim(),
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

    if (deployment?.server_id) {
      payload.server_id = deployment.server_id;
    }

    return payload;
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
          ? normalizeDeploymentActionError(
              requestError.message,
              "Failed to delete deployment.",
            )
          : "Failed to delete deployment.",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaveTemplate() {
    setTemplateSaving(true);
    setTemplateError("");
    setTemplateSuccess("");

    try {
      const response = await fetch(`${apiBaseUrl}/deployment-templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(buildTemplatePayload()),
      });
      await readJsonOrError(response, "Failed to save deployment template.");
      setTemplateName("");
      setTemplateSuccess("Deployment template saved.");
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }

      setTemplateError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to save deployment template.",
      );
    } finally {
      setTemplateSaving(false);
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
        <section className="workspaceHero">
          <div className="workspaceHeroBackdrop" />
          <div className="header workspaceHeroHeader">
            <div>
              <div className="eyebrow">Runtime detail</div>
              <h1 data-testid="runtime-detail-page-title">Deployment details</h1>
              <p>
                {currentUser
                  ? `${deploymentId} · ${currentUser.username}. ${detailPriority}`
                  : deploymentId}
              </p>
            </div>
            <div className="buttonRow workspaceHeroActions" data-testid="runtime-detail-header-actions">
              <Link href="/app" className="linkButton workspaceSecondaryAction">
                Back
              </Link>
              {deploymentUrl ? (
                <a
                  href={deploymentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="linkButton workspaceSecondaryAction"
                  data-testid="runtime-detail-open-app-button"
                >
                  Open app
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => copyText(runtimeSummaryText, "Runtime summary")}
                disabled={!runtimeSummaryText}
                className="landingButton primaryButton workspacePrimaryAction"
                data-testid="runtime-detail-copy-summary-button"
              >
                Copy summary
              </button>
              <button type="button" onClick={() => loadDeploymentDetails()} disabled={loading} className="workspaceGhostAction" data-testid="runtime-detail-refresh-button">
                {loading ? "Refreshing..." : "Refresh"}
              </button>
              <button type="button" onClick={handleLogout} className="workspaceGhostAction">
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

          <div className="workspaceHeroSummary">
            <div className="workspaceHeroMetric">
              <span>Status</span>
              <strong>{deployment?.status || "unknown"}</strong>
              <p>{deployment?.container_name || "Container name pending"}</p>
            </div>
            <div className="workspaceHeroMetric">
              <span>Endpoint</span>
              <strong>{deploymentUrl ? "Live" : "Private"}</strong>
              <p>{deploymentUrl || "No public URL assigned yet"}</p>
            </div>
            <div className="workspaceHeroMetric">
              <span>Health</span>
              <strong>{health?.status || "unknown"}</strong>
              <p>
                {health?.response_time_ms || health?.response_time_ms === 0
                  ? `${health.response_time_ms} ms`
                  : "No recent latency sample"}
              </p>
            </div>
            <div className="workspaceHeroBadge workspaceHeroSpotlight">
              <span>What matters now</span>
              <strong>{detailPriority}</strong>
              <p>Use this page for redeploy, diagnostics, health review, logs, and incident handoff.</p>
            </div>
          </div>
        </section>

        <div className="workspaceBannerStack">
          {error ? <div className="banner error">{error}</div> : null}
          {copyMessage ? <div className="banner subtle">{copyMessage}</div> : null}
          {templateError ? <div className="banner error">{templateError}</div> : null}
          {templateSuccess ? <div className="banner success">{templateSuccess}</div> : null}
          {currentUser?.must_change_password ? (
            <div className="banner error">
              You are still using the default admin password.{" "}
              <Link href="/change-password" className="inlineLink">
                Change it now
              </Link>
              .
            </div>
          ) : null}
          {diagnosticsError ? <div className="banner error">{diagnosticsError}</div> : null}

          <div className="workspaceStatusStrip">
            <div className="workspaceStatusCard">
              <span>Backend</span>
              <strong>{apiBaseUrl}</strong>
              <p>Authenticated deployment controls and runtime data flow through this API surface.</p>
            </div>
            <div className="workspaceStatusCard">
              <span>Cadence</span>
              <strong>8-second refresh</strong>
              <p>Deployment, health, and activity keep refreshing automatically.</p>
            </div>
            <div className="workspaceStatusCard">
              <span>Attention</span>
              <strong>{attentionItems.length}</strong>
              <p data-testid="runtime-detail-attention-banner">
                {attentionItems.length > 0
                  ? `${attentionItems.length} runtime attention item${attentionItems.length === 1 ? "" : "s"} need review.`
                  : "No active runtime warnings right now."}
              </p>
            </div>
          </div>

          {smokeMode ? (
            <div className="workspaceMetaLine">
              <span data-testid="runtime-detail-smoke-banner">
                Runtime detail smoke mode uses fixture deployment data.
              </span>
            </div>
          ) : null}
        </div>

        <article className="card formCard">
          <h2>Save as template</h2>
          <div className="form">
            <label className="field">
              <span>Template name</span>
              <input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="nginx baseline"
                disabled={templateSaving}
              />
              <span className="fieldHint">
                Save the current deployment settings as a reusable preset for future deploys.
              </span>
            </label>
            <div className="formActions">
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={templateSaving || !templateName.trim() || !form.image.trim()}
              >
                {templateSaving ? "Saving template..." : "Save as template"}
              </button>
            </div>
          </div>
        </article>

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
              <span className="fieldHint">
                Keep the current name or choose a new unique container name for this redeploy.
              </span>
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
                {deployment?.server_id
                  ? suggestedPortsLoading
                    ? "Checking suggested free ports on this server..."
                    : suggestedPorts.length > 0
                      ? `Suggested free ports on this server: ${formatSuggestedPorts(suggestedPorts)}.`
                      : "No suggested ports available right now. Try a free port above 8080."
                  : "For local deploys, choose a free external port if you want direct access."}
              </span>
              <div className="portSuggestions">
                {suggestedPorts.map((port) => (
                  <button
                    key={`redeploy-port-${port}`}
                    type="button"
                    onClick={() => useSuggestedPort(port)}
                    disabled={redeploying}
                  >
                    Use {port}
                  </button>
                ))}
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
            <div className="overviewGrid" data-testid="runtime-detail-overview-grid">
              <div className="overviewCard" data-testid="runtime-detail-endpoint-card">
                <span className="overviewLabel">Endpoint</span>
                <strong className="overviewValue">{deploymentUrl || "No public URL"}</strong>
                <div className="overviewMeta">
                  <span>Internal {deployment.internal_port || "-"}</span>
                  <span>External {deployment.external_port || "-"}</span>
                </div>
              </div>
              <div className="overviewCard" data-testid="runtime-detail-runtime-card">
                <span className="overviewLabel">Runtime</span>
                <strong className="overviewValue">{deployment.container_name || "Container pending"}</strong>
                <div className="overviewMeta">
                  <span>Status {deployment.status || "unknown"}</span>
                  <span>Server {deployment.server_name || "Local"}</span>
                </div>
              </div>
              <div className="overviewCard" data-testid="runtime-detail-health-overview-card">
                <span className="overviewLabel">Health</span>
                <strong className="overviewValue">{health?.status || "unknown"}</strong>
                <div className="overviewMeta">
                  <span>Checked {formatDate(health?.checked_at)}</span>
                  <span>
                    {health?.response_time_ms || health?.response_time_ms === 0
                      ? `${health.response_time_ms} ms`
                      : "No latency yet"}
                  </span>
                </div>
              </div>
              <div className="overviewCard" data-testid="runtime-detail-attention-card">
                <span className="overviewLabel">Attention</span>
                <strong className="overviewValue">{attentionItems.length}</strong>
                <div className="overviewMeta">
                  <span>Errors {attentionItems.filter((item) => item.status === "error").length}</span>
                  <span>Warnings {attentionItems.filter((item) => item.status === "warn").length}</span>
                </div>
              </div>
            </div>

            <article className="card compactCard" data-testid="runtime-detail-summary-card">
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
                <span className="label">Container ID</span>
                <span className="valueWithActions">
                  <span>{deployment.container_id || "N/A"}</span>
                  {deployment.container_id ? (
                    <button
                      type="button"
                      className="smallButton"
                      onClick={() => copyText(deployment.container_id, "Container ID")}
                    >
                      Copy
                    </button>
                  ) : null}
                </span>
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
                <span className="label">Ports</span>
                <span>{deployment.internal_port || "-"} {"->"} {deployment.external_port || "-"}</span>
              </div>
              <div className="row">
                <span className="label">URL</span>
                <span className="valueWithActions">
                  {deploymentUrl ? (
                    <>
                      <a
                        href={deploymentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inlineLink"
                      >
                        {deploymentUrl}
                      </a>
                      <button
                        type="button"
                        className="smallButton"
                        onClick={() => copyText(deploymentUrl, "URL")}
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

            <article className="card compactCard" data-testid="runtime-detail-quick-reference-card">
              <div className="sectionHeader">
                <h2 data-testid="runtime-detail-quick-reference-title">Quick reference</h2>
              </div>
              <div className="row">
                <span className="label">Runtime summary</span>
                <span className="valueWithActions">
                  <span>Copyable deployment snapshot for incidents and handoff.</span>
                  <button
                    type="button"
                    className="smallButton"
                    onClick={() => copyText(runtimeSummaryText, "Runtime summary")}
                  >
                    Copy
                  </button>
                </span>
              </div>
              <div className="row">
                <span className="label">Diagnostics target</span>
                <span className="valueWithActions">
                  <span>{diagnostics?.server_target || "N/A"}</span>
                  {diagnostics?.server_target ? (
                    <button
                      type="button"
                      className="smallButton"
                      onClick={() => copyText(diagnostics.server_target, "Diagnostics target")}
                    >
                      Copy
                    </button>
                  ) : null}
                </span>
              </div>
              <div className="row">
                <span className="label">Suggested ports</span>
                <span>{suggestedPorts.length > 0 ? formatSuggestedPorts(suggestedPorts) : "-"}</span>
              </div>
              <div className="row">
                <span className="label">Activity heartbeat</span>
                <span>
                  {diagnostics?.activity?.last_event_title
                    ? `${diagnostics.activity.last_event_title} · ${formatDate(diagnostics.activity.last_event_at)}`
                    : "No activity heartbeat yet."}
                </span>
              </div>
            </article>

            <article className="card compactCard" data-testid="runtime-detail-attention-list-card">
              <div className="sectionHeader">
                <h2 data-testid="runtime-detail-attention-list-title">Attention items</h2>
              </div>
              {attentionItems.length === 0 ? (
                <div className="empty" data-testid="runtime-detail-attention-empty-state">
                  No runtime warnings or failures are active.
                </div>
              ) : (
                <div className="overviewAttentionList" data-testid="runtime-detail-attention-list">
                  {attentionItems.map((item) => (
                    <div className="overviewAttentionItem" key={item.key}>
                      <div className="row">
                        <span className="label">Area</span>
                        <span>{item.label}</span>
                      </div>
                      <div className="row">
                        <span className="label">Severity</span>
                        <span className={`status ${item.status}`}>{item.status}</span>
                      </div>
                      <div className="row">
                        <span className="label">Message</span>
                        <span>{item.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="card compactCard" data-testid="runtime-detail-diagnostics-card">
              <div className="sectionHeader">
                <h2 data-testid="runtime-detail-diagnostics-title">Diagnostics</h2>
                <div className="actions">
                  <button
                    type="button"
                    onClick={loadDeploymentDiagnostics}
                    disabled={diagnosticsLoading}
                  >
                    {diagnosticsLoading ? "Refreshing diagnostics..." : "Refresh diagnostics"}
                  </button>
                </div>
              </div>
              {diagnostics ? (
                <>
                  <div className="row">
                    <span className="label">Checked</span>
                    <span>{formatDate(diagnostics.checked_at)}</span>
                  </div>
                  <div className="row">
                    <span className="label">Server target</span>
                    <span>{diagnostics.server_target || "N/A"}</span>
                  </div>
                  <div className="row">
                    <span className="label">Activity summary</span>
                    <span>
                      {diagnostics.activity.total_events} events,{" "}
                      {diagnostics.activity.error_events} errors,{" "}
                      {diagnostics.activity.success_events} successes
                    </span>
                  </div>
                  <div className="backupSummaryBadges" data-testid="runtime-detail-diagnostics-badges">
                    <span className="status healthy">
                      success {diagnostics.activity.success_events}
                    </span>
                    <span className="status warn">
                      recent failures {diagnostics.activity.recent_failure_count}
                    </span>
                    <span className="status unknown">
                      total {diagnostics.activity.total_events}
                    </span>
                  </div>
                  <div className="diagnosticsGrid">
                    {Array.isArray(diagnostics.items) &&
                      diagnostics.items.map((item) => (
                        <div className="diagnosticItem" key={item.key}>
                          <div className="row">
                            <span className="label">{item.label}</span>
                            <span className={`status ${item.status || "unknown"}`}>
                              {item.status || "unknown"}
                            </span>
                          </div>
                          <p>{item.summary || "-"}</p>
                          {item.details ? <div className="diagnosticDetails">{item.details}</div> : null}
                        </div>
                      ))}
                  </div>
                  {diagnostics.activity.recent_failure_titles?.length > 0 ? (
                    <div className="row">
                      <span className="label">Recent failures</span>
                      <div className="stackedValue">
                        {diagnostics.activity.recent_failure_titles.map((title) => (
                          <span key={title}>{title}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="row">
                    <span className="label">Recent logs excerpt</span>
                    <div className="stackedValue">
                      <div className="inlineActions">
                        <button
                          type="button"
                          className="smallButton"
                          onClick={() =>
                            copyText(
                              diagnostics.log_excerpt || "No log excerpt available.",
                              "Diagnostics logs",
                            )
                          }
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          className="smallButton"
                          onClick={() => setDiagnosticsLogsExpanded((current) => !current)}
                        >
                          {diagnosticsLogsExpanded ? "Show less" : "Show more"}
                        </button>
                      </div>
                      <pre
                        className={`logs ${
                          diagnosticsLogsExpanded ? "expandedBlock" : "collapsedBlock"
                        }`}
                      >
                        {diagnostics.log_excerpt || "No log excerpt available."}
                      </pre>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty">Diagnostics are not available yet.</div>
              )}
            </article>

            <article className="card compactCard" data-testid="runtime-detail-health-card">
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
              <div className="row">
                <span className="label">Checked</span>
                <span>{formatDate(health?.checked_at)}</span>
              </div>
              <div className="row">
                <span className="label">Latency</span>
                <span>
                  {health?.response_time_ms || health?.response_time_ms === 0
                    ? `${health.response_time_ms} ms`
                    : "-"}
                </span>
              </div>
            </article>

            <article className="card compactCard" data-testid="runtime-detail-logs-card">
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

            <article className="card compactCard" data-testid="runtime-detail-activity-card">
              <div className="sectionHeader">
                <h2 data-testid="runtime-detail-activity-title">Activity</h2>
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
                        <span className="label">Category</span>
                        <span>{item.category || "-"}</span>
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
