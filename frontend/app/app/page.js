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

function buildDeploymentUrl(deployment) {
  if (!deployment?.server_host || !deployment?.external_port) {
    return "";
  }
  return `http://${deployment.server_host}:${deployment.external_port}`;
}

function formatSuggestedPorts(ports) {
  if (!Array.isArray(ports) || ports.length === 0) {
    return "";
  }
  return ports.join(", ");
}

function formatServerLabel(serverName, serverHost) {
  return serverName ? `${serverName} (${serverHost})` : "Local";
}

function formatPortMapping(internalPort, externalPort) {
  if (!internalPort || !externalPort) {
    return "No port mapping";
  }
  return `${externalPort}:${internalPort}`;
}

function normalizeDraftValue(value) {
  return value === null || value === undefined || value === "" ? "" : String(value);
}

function buildEnvRowsFromObject(env) {
  return Object.entries(env || {}).length > 0
    ? Object.entries(env || {}).map(([key, value]) => ({
        key,
        value: String(value ?? ""),
      }))
    : [{ key: "", value: "" }];
}

function countFilledEnvRows(rows) {
  return rows.filter((row) => row.key.trim()).length;
}

function normalizeCreateDeploymentError(message) {
  return normalizeDeploymentActionError(
    message,
    "Failed to create deployment. Please try again.",
  );
}

function normalizeDeploymentActionError(message, fallbackMessage) {
  if (!message) {
    return fallbackMessage;
  }

  if (message.includes("Port ") && message.includes("is already in use on server")) {
    return `${message} Use one of the suggested free ports for this server.`;
  }

  if (message.includes("Container name ") && message.includes("is already in use on server")) {
    return `${message} Choose another deployment name or leave Name empty to let DeployMate generate one.`;
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

function buildTemplateDiff(template, currentDraft, servers) {
  if (!template) {
    return [];
  }

  const currentServer =
    servers.find((server) => server.id === currentDraft.server_id) || null;
  const envText = JSON.stringify(template.env || {}, null, 2);
  const currentEnvText = JSON.stringify(currentDraft.env || {}, null, 2);
  const rows = [
    {
      label: "Image",
      templateValue: normalizeDraftValue(template.image),
      currentValue: normalizeDraftValue(currentDraft.image),
    },
    {
      label: "Deploy name",
      templateValue: normalizeDraftValue(template.name || "Auto-generate"),
      currentValue: normalizeDraftValue(currentDraft.name || "Auto-generate"),
    },
    {
      label: "Server",
      templateValue: formatServerLabel(template.server_name, template.server_host),
      currentValue: formatServerLabel(currentServer?.name, currentServer?.host),
    },
    {
      label: "Ports",
      templateValue: formatPortMapping(template.internal_port, template.external_port),
      currentValue: formatPortMapping(
        currentDraft.internal_port ? Number(currentDraft.internal_port) : null,
        currentDraft.external_port ? Number(currentDraft.external_port) : null,
      ),
    },
    {
      label: "Env",
      templateValue: envText === "{}" ? "No env vars" : envText,
      currentValue: currentEnvText === "{}" ? "No env vars" : currentEnvText,
    },
  ];

  return rows.filter((row) => row.templateValue !== row.currentValue);
}

function inferActivityCategory(title, message) {
  const haystack = [title, message].filter(Boolean).join(" ").toLowerCase();
  if (!haystack) {
    return "general";
  }
  if (haystack.includes("redeploy")) {
    return "redeploy";
  }
  if (haystack.includes("delete")) {
    return "delete";
  }
  if (haystack.includes("health")) {
    return "health";
  }
  if (haystack.includes("deploy")) {
    return "deploy";
  }
  return "general";
}

function isRecentDate(value, days = 7) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
}

function buildOpsSnapshot({ currentUser, deployments, servers, notifications, templates }) {
  const activeServerIds = new Set(
    deployments.map((deployment) => deployment.server_id).filter(Boolean),
  );
  const failedDeployments = deployments.filter((deployment) => deployment.status === "failed");
  const runningDeployments = deployments.filter((deployment) => deployment.status === "running");
  const pendingDeployments = deployments.filter((deployment) => deployment.status === "pending");
  const localDeployments = deployments.filter((deployment) => !deployment.server_id);
  const remoteDeployments = deployments.filter((deployment) => deployment.server_id);
  const exposedDeployments = deployments.filter(
    (deployment) => deployment.external_port !== null && deployment.external_port !== undefined,
  );
  const publicUrlDeployments = deployments.filter(
    (deployment) => deployment.server_host && deployment.external_port,
  );
  const passwordServers = servers.filter((server) => server.auth_type === "password");
  const sshKeyServers = servers.filter((server) => server.auth_type === "ssh_key");
  const unusedServers = servers.filter((server) => !activeServerIds.has(server.id));
  const errorNotifications = notifications.filter((item) => item.level === "error");
  const successNotifications = notifications.filter((item) => item.level === "success");
  const recentError = errorNotifications[0] || null;
  const unusedTemplates = templates.filter((template) => (template.use_count || 0) === 0);
  const recentTemplates = templates.filter((template) => isRecentDate(template.last_used_at, 7));
  const popularTemplates = [...templates]
    .filter((template) => (template.use_count || 0) > 0)
    .sort((left, right) => (right.use_count || 0) - (left.use_count || 0));
  const topTemplate = popularTemplates[0] || null;

  const attentionItems = [];

  if (currentUser?.must_change_password) {
    attentionItems.push({
      level: "warn",
      title: "Default admin password is still active",
      detail: "Change it before making more production changes.",
    });
  }

  if (failedDeployments.length > 0) {
    attentionItems.push({
      level: "error",
      title: `${failedDeployments.length} failed deployment${failedDeployments.length === 1 ? "" : "s"}`,
      detail: "Open deployment details and activity history before the next rollout.",
    });
  }

  if (errorNotifications.length > 0) {
    attentionItems.push({
      level: "warn",
      title: `${errorNotifications.length} recent error event${errorNotifications.length === 1 ? "" : "s"}`,
      detail: recentError?.title || "Review recent activity history.",
    });
  }

  if (servers.length === 0) {
    attentionItems.push({
      level: "info",
      title: "No saved servers",
      detail: "Only local deploys are available until a VPS target is added.",
    });
  }

  if (unusedTemplates.length > 0) {
    attentionItems.push({
      level: "info",
      title: `${unusedTemplates.length} template${unusedTemplates.length === 1 ? "" : "s"} never used`,
      detail: "Review whether they are still useful or should be cleaned up later.",
    });
  }

  if (
    runningDeployments.some(
      (deployment) =>
        deployment.external_port === null || deployment.external_port === undefined,
    )
  ) {
    attentionItems.push({
      level: "info",
      title: "Some running deployments have no external port",
      detail: "They may be internal-only or require proxy access.",
    });
  }

  return {
    generated_at: new Date().toISOString(),
    user: currentUser
      ? {
          username: currentUser.username,
          plan: currentUser.plan,
          role: currentUser.role,
        }
      : null,
    deployments: {
      total: deployments.length,
      running: runningDeployments.length,
      failed: failedDeployments.length,
      pending: pendingDeployments.length,
      local: localDeployments.length,
      remote: remoteDeployments.length,
      exposed: exposedDeployments.length,
      public_urls: publicUrlDeployments.length,
    },
    servers: {
      total: servers.length,
      password_auth: passwordServers.length,
      ssh_key_auth: sshKeyServers.length,
      unused: unusedServers.length,
    },
    notifications: {
      total: notifications.length,
      success: successNotifications.length,
      error: errorNotifications.length,
      latest_error_title: recentError?.title || null,
      latest_error_at: recentError?.created_at || null,
    },
    templates: {
      total: templates.length,
      unused: unusedTemplates.length,
      recently_used: recentTemplates.length,
      top_template_name: topTemplate?.template_name || null,
      top_template_use_count: topTemplate?.use_count || 0,
    },
    attention_items: attentionItems,
  };
}

function buildOpsSummaryText(snapshot) {
  const lines = [
    "DeployMate operations summary",
    `Generated: ${formatDate(snapshot.generated_at)}`,
    snapshot.user
      ? `User: ${snapshot.user.username} (${snapshot.user.role}, ${snapshot.user.plan})`
      : "User: n/a",
    `Deployments: ${snapshot.deployments.total} total, ${snapshot.deployments.running} running, ${snapshot.deployments.failed} failed, ${snapshot.deployments.pending} pending`,
    `Targets: ${snapshot.deployments.local} local, ${snapshot.deployments.remote} remote, ${snapshot.deployments.exposed} exposed, ${snapshot.deployments.public_urls} public URLs`,
    `Servers: ${snapshot.servers.total} total, ${snapshot.servers.password_auth} password auth, ${snapshot.servers.ssh_key_auth} ssh key auth, ${snapshot.servers.unused} unused`,
    `Activity: ${snapshot.notifications.total} events, ${snapshot.notifications.success} success, ${snapshot.notifications.error} error`,
    `Templates: ${snapshot.templates.total} total, ${snapshot.templates.unused} unused, ${snapshot.templates.recently_used} used in last 7 days`,
  ];

  if (snapshot.templates.top_template_name) {
    lines.push(
      `Top template: ${snapshot.templates.top_template_name} (${snapshot.templates.top_template_use_count} uses)`,
    );
  }

  if (snapshot.attention_items.length > 0) {
    lines.push("Attention:");
    snapshot.attention_items.forEach((item) => {
      lines.push(`- [${item.level}] ${item.title}: ${item.detail}`);
    });
  } else {
    lines.push("Attention: no immediate issues detected from current dashboard data.");
  }

  return lines.join("\n");
}

function downloadJsonFile(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
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

export default function HomePage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const [deployments, setDeployments] = useState([]);
  const [servers, setServers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serversLoading, setServersLoading] = useState(true);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [error, setError] = useState("");
  const [serversError, setServersError] = useState("");
  const [notificationsError, setNotificationsError] = useState("");
  const [templatesError, setTemplatesError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [createdDeployment, setCreatedDeployment] = useState(null);

  const [serverSubmitting, setServerSubmitting] = useState(false);
  const [serverSubmitError, setServerSubmitError] = useState("");
  const [serverSubmitSuccess, setServerSubmitSuccess] = useState("");
  const [templateSubmitting, setTemplateSubmitting] = useState(false);
  const [templateSubmitError, setTemplateSubmitError] = useState("");
  const [templateSubmitSuccess, setTemplateSubmitSuccess] = useState("");
  const [templateDeployError, setTemplateDeployError] = useState("");
  const [templateDeploySuccess, setTemplateDeploySuccess] = useState("");
  const [templateCreatedDeployment, setTemplateCreatedDeployment] = useState(null);
  const [templateDuplicateError, setTemplateDuplicateError] = useState("");
  const [templateDuplicateSuccess, setTemplateDuplicateSuccess] = useState("");

  const [deleteError, setDeleteError] = useState("");
  const [deletingDeploymentId, setDeletingDeploymentId] = useState("");
  const [serverDeleteError, setServerDeleteError] = useState("");
  const [deletingServerId, setDeletingServerId] = useState("");
  const [templateDeleteError, setTemplateDeleteError] = useState("");
  const [deletingTemplateId, setDeletingTemplateId] = useState("");
  const [deployingTemplateId, setDeployingTemplateId] = useState("");
  const [duplicatingTemplateId, setDuplicatingTemplateId] = useState("");
  const [testingServerId, setTestingServerId] = useState("");
  const [serverTestResults, setServerTestResults] = useState({});
  const [serverDiagnostics, setServerDiagnostics] = useState({});
  const [serverDiagnosticsError, setServerDiagnosticsError] = useState({});
  const [diagnosingServerId, setDiagnosingServerId] = useState("");
  const [deploymentFilter, setDeploymentFilter] = useState("all");
  const [deploymentQuery, setDeploymentQuery] = useState("");
  const [serverQuery, setServerQuery] = useState("");
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [notificationQuery, setNotificationQuery] = useState("");
  const [templateQuery, setTemplateQuery] = useState("");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [templatePreviewId, setTemplatePreviewId] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [suggestedPorts, setSuggestedPorts] = useState([]);
  const [suggestedPortsLoading, setSuggestedPortsLoading] = useState(false);
  const [opsOverview, setOpsOverview] = useState(null);
  const [opsOverviewLoading, setOpsOverviewLoading] = useState(true);
  const [opsActionMessage, setOpsActionMessage] = useState("");
  const [opsActionError, setOpsActionError] = useState("");

  const [form, setForm] = useState({
    image: "",
    name: "",
    internal_port: "",
    external_port: "",
    server_id: "",
  });
  const [templateName, setTemplateName] = useState("");
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
  const normalizedDeploymentQuery = deploymentQuery.trim().toLowerCase();
  const filteredDeployments = deployments.filter((deployment) => {
    if (deploymentFilter === "running" && deployment.status !== "running") {
      return false;
    }

    if (deploymentFilter === "failed" && deployment.status !== "failed") {
      return false;
    }

    if (!normalizedDeploymentQuery) {
      return true;
    }

    const haystack = [
      deployment.image,
      deployment.container_name,
      deployment.server_name,
      deployment.server_host,
      deployment.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedDeploymentQuery);
  });
  const normalizedServerQuery = serverQuery.trim().toLowerCase();
  const filteredServers = servers.filter((server) => {
    if (!normalizedServerQuery) {
      return true;
    }

    const haystack = [
      server.name,
      server.host,
      server.username,
      server.auth_type,
      `${server.username}@${server.host}:${server.port}`,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedServerQuery);
  });
  const normalizedNotificationQuery = notificationQuery.trim().toLowerCase();
  const filteredNotifications = notifications.filter((item) => {
    if (notificationFilter === "success") {
      if (item.level !== "success") {
        return false;
      }
    }

    if (notificationFilter === "error") {
      if (item.level !== "error") {
        return false;
      }
    }

    if (!normalizedNotificationQuery) {
      return true;
    }

    const haystack = [
      item.title,
      item.message,
      item.deployment_id,
      inferActivityCategory(item.title, item.message),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedNotificationQuery);
  });
  const normalizedTemplateQuery = templateQuery.trim().toLowerCase();
  const filteredTemplates = [...templates]
    .filter((template) => {
      if (templateFilter === "unused" && (template.use_count || 0) > 0) {
        return false;
      }

      if (templateFilter === "recent" && !isRecentDate(template.last_used_at, 7)) {
        return false;
      }

      if (templateFilter === "popular" && (template.use_count || 0) === 0) {
        return false;
      }

      if (!normalizedTemplateQuery) {
        return true;
      }

      const haystack = [
        template.template_name,
        template.image,
        template.name,
        template.server_name,
        template.server_host,
        Object.keys(template.env || {}).join(" "),
        Object.values(template.env || {}).join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedTemplateQuery);
    })
    .sort((left, right) => {
      if (templateFilter === "popular") {
        return (right.use_count || 0) - (left.use_count || 0);
      }

      if (templateFilter === "recent") {
        return new Date(right.last_used_at || 0).getTime() - new Date(left.last_used_at || 0).getTime();
      }

      return 0;
    });
  const previewTemplate =
    filteredTemplates.find((template) => template.id === templatePreviewId) ||
    templates.find((template) => template.id === templatePreviewId) ||
    null;
  const derivedOpsSnapshot = buildOpsSnapshot({
    currentUser,
    deployments,
    servers,
    notifications,
    templates,
  });
  const opsSnapshot = opsOverview || derivedOpsSnapshot;

  function getSuggestedExternalPort() {
    return suggestedPorts.length > 0 ? String(suggestedPorts[0]) : "";
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
      const params = new URLSearchParams();
      if (deploymentFilter !== "all") {
        params.set("status", deploymentFilter);
      }
      if (deploymentQuery.trim()) {
        params.set("q", deploymentQuery.trim());
      }
      const response = await fetch(`${apiBaseUrl}/deployments?${params.toString()}`, {
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
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (notificationFilter !== "all") {
        params.set("level", notificationFilter);
      }
      if (notificationQuery.trim()) {
        params.set("q", notificationQuery.trim());
      }
      const response = await fetch(`${apiBaseUrl}/notifications?${params.toString()}`, {
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

  async function loadTemplates(silent = false) {
    if (!silent) {
      setTemplatesLoading(true);
      setTemplatesError("");
    }

    try {
      const params = new URLSearchParams();
      if (templateFilter !== "all") {
        params.set("state", templateFilter);
      }
      if (templateQuery.trim()) {
        params.set("q", templateQuery.trim());
      }
      const response = await fetch(`${apiBaseUrl}/deployment-templates?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await readJsonOrError(response, "Failed to load deployment templates.");
      setTemplates(Array.isArray(data) ? data : []);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }

      setTemplatesError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load deployment templates.",
      );
      if (!silent) {
        setTemplates([]);
      }
    } finally {
      if (!silent) {
        setTemplatesLoading(false);
      }
    }
  }

  async function loadOpsOverview(silent = false) {
    if (!silent) {
      setOpsOverviewLoading(true);
    }

    try {
      const response = await fetch(`${apiBaseUrl}/ops/overview?notifications_limit=100`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await readJsonOrError(response, "Failed to load operations overview.");
      setOpsOverview(data);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }

      if (!silent) {
        setOpsOverview(null);
      }
    } finally {
      if (!silent) {
        setOpsOverviewLoading(false);
      }
    }
  }

  async function refreshPage(silent = false) {
    await Promise.all([
      loadCurrentUser(),
      loadDeployments(silent),
      loadServers(silent),
      loadNotifications(silent),
      loadTemplates(silent),
      loadOpsOverview(silent),
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

  useEffect(() => {
    if (!authChecked) {
      return;
    }
    loadDeployments();
  }, [authChecked, deploymentFilter, deploymentQuery]);

  useEffect(() => {
    if (!authChecked) {
      return;
    }
    loadNotifications();
  }, [authChecked, notificationFilter, notificationQuery]);

  useEffect(() => {
    if (!authChecked) {
      return;
    }
    loadTemplates();
  }, [authChecked, templateFilter, templateQuery]);

  useEffect(() => {
    async function loadSuggestedPorts() {
      if (!form.server_id) {
        setSuggestedPorts([]);
        setSuggestedPortsLoading(false);
        return;
      }

      setSuggestedPortsLoading(true);
      try {
        const response = await fetch(
          `${apiBaseUrl}/servers/${form.server_id}/suggested-ports`,
          {
            cache: "no-store",
            credentials: "include",
          },
        );
        const data = await readJsonOrError(response, "Failed to load suggested ports.");
        const ports = Array.isArray(data?.ports) ? data.ports : [];
        setSuggestedPorts(ports);
        setForm((currentForm) => {
          if (currentForm.external_port.trim()) {
            return currentForm;
          }
          return {
            ...currentForm,
            external_port: ports.length > 0 ? String(ports[0]) : "",
          };
        });
      } catch {
        setSuggestedPorts([]);
      } finally {
        setSuggestedPortsLoading(false);
      }
    }

    loadSuggestedPorts();
  }, [form.server_id]);

  function updateFormField(event) {
    const { name, value } = event.target;
    setForm((currentForm) => {
      const nextForm = {
        ...currentForm,
        [name]: value,
      };

      if (name === "server_id" && !currentForm.external_port.trim()) {
        nextForm.external_port = "";
      }

      return nextForm;
    });
  }

  function useSuggestedPort(port) {
    setForm((currentForm) => ({
      ...currentForm,
      external_port: String(port),
    }));
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

  function buildEnvIssues(rows) {
    const seenKeys = new Set();
    const issues = [];

    rows.forEach((row, index) => {
      const key = row.key.trim();
      if (!key && row.value.trim()) {
        issues.push(`Env var row ${index + 1} has a value but no key.`);
        return;
      }

      if (!key) {
        return;
      }

      if (seenKeys.has(key)) {
        issues.push(`Env var key "${key}" is duplicated.`);
        return;
      }

      seenKeys.add(key);
    });

    return issues;
  }

  function buildCurrentDraft() {
    return {
      id: editingTemplateId || "",
      template_name: templateName.trim(),
      image: form.image.trim(),
      name: form.name.trim(),
      internal_port: form.internal_port.trim(),
      external_port: form.external_port.trim(),
      server_id: form.server_id,
      env: buildEnvPayload(envRows),
      envRows,
    };
  }

  function buildTemplateDraftFromTemplate(template) {
    return {
      id: template.id,
      template_name: template.template_name || "",
      image: template.image || "",
      name: template.name || "",
      internal_port:
        template.internal_port === null || template.internal_port === undefined
          ? ""
          : String(template.internal_port),
      external_port:
        template.external_port === null || template.external_port === undefined
          ? ""
          : String(template.external_port),
      server_id: template.server_id || "",
      env: template.env || {},
      envRows: buildEnvRowsFromObject(template.env || {}),
    };
  }

  function validateTemplateDraft(draft, options = {}) {
    const { forDeployment = false, ignoreTemplateId = "" } = options;
    const errors = [];
    const warnings = [];
    const internalPort = draft.internal_port.trim();
    const externalPort = draft.external_port.trim();
    const envIssues = buildEnvIssues(draft.envRows || []);

    if (!draft.image.trim()) {
      errors.push("Image is required.");
    }

    if ((internalPort && !externalPort) || (!internalPort && externalPort)) {
      errors.push("Internal port and external port must be provided together.");
    }

    errors.push(...envIssues);

    const matchingDeployment = deployments.find((deployment) => {
      if (!externalPort || !deployment.external_port) {
        return false;
      }

      return (
        String(deployment.external_port) === externalPort &&
        (deployment.server_id || "") === (draft.server_id || "")
      );
    });

    if (matchingDeployment) {
      errors.push(
        `Port ${externalPort} is already used by deployment ${matchingDeployment.container_name}.`,
      );
    }

    const matchingTemplate = templates.find((template) => {
      if (!externalPort || !template.external_port) {
        return false;
      }

      return (
        template.id !== ignoreTemplateId &&
        String(template.external_port) === externalPort &&
        (template.server_id || "") === (draft.server_id || "")
      );
    });

    if (matchingTemplate) {
      warnings.push(
        `Template "${matchingTemplate.template_name}" already reserves port ${externalPort}.`,
      );
    }

    if (!draft.server_id && externalPort) {
      warnings.push(
        "This deploy/template targets Local. Make sure the external port is free on the DeployMate host.",
      );
    }

    if (forDeployment && deploymentLimitReached) {
      errors.push("Deployment limit reached for your current plan. Upgrade to continue.");
    }

    return { errors, warnings };
  }

  function applyTemplateToForm(template, options = {}) {
    const { startEditing = false } = options;
    setForm({
      image: template.image || "",
      name: template.name || "",
      internal_port:
        template.internal_port === null || template.internal_port === undefined
          ? ""
          : String(template.internal_port),
      external_port:
        template.external_port === null || template.external_port === undefined
          ? ""
          : String(template.external_port),
      server_id: template.server_id || "",
    });
    setEnvRows(buildEnvRowsFromObject(template.env || {}));
    setTemplateName(template.template_name || "");
    setTemplatePreviewId(template.id);
    setCreatedDeployment(null);
    setTemplateCreatedDeployment(null);
    setTemplateDeployError("");
    setTemplateDuplicateError("");
    setTemplateDuplicateSuccess("");
    setSubmitError("");
    setTemplateSubmitError("");
    if (startEditing) {
      setEditingTemplateId(template.id);
      setTemplateSubmitSuccess(`Editing template "${template.template_name}". Save to update it.`);
      setSubmitSuccess("");
      return;
    }

    setEditingTemplateId("");
    setSubmitSuccess(`Template "${template.template_name}" applied to the deploy form.`);
  }

  function cancelTemplateEditing() {
    setEditingTemplateId("");
    setTemplateName("");
    setTemplateSubmitError("");
    setTemplateSubmitSuccess("");
  }

  function buildTemplatePayload() {
    const draft = buildCurrentDraft();
    const payload = {
      template_name: draft.template_name,
      image: draft.image,
      env: draft.env,
    };

    if (draft.name) {
      payload.name = draft.name;
    }

    if (draft.internal_port) {
      payload.internal_port = Number(draft.internal_port);
    }

    if (draft.external_port) {
      payload.external_port = Number(draft.external_port);
    }

    if (draft.server_id) {
      payload.server_id = draft.server_id;
    }

    return payload;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");
    setCreatedDeployment(null);

    const draft = buildCurrentDraft();
    const preflight = validateTemplateDraft(draft, { forDeployment: true });

    if (preflight.errors.length > 0) {
      setSubmitError(preflight.errors[0]);
      setSubmitting(false);
      return;
    }

    if (
      preflight.warnings.length > 0 &&
      !window.confirm(`${preflight.warnings.join("\n")}\n\nCreate deployment anyway?`)
    ) {
      setSubmitting(false);
      return;
    }

    const payload = {
      image: draft.image,
      env: draft.env,
    };

    if (draft.name) {
      payload.name = draft.name;
    }

    if (draft.internal_port) {
      payload.internal_port = Number(draft.internal_port);
    }

    if (draft.external_port) {
      payload.external_port = Number(draft.external_port);
    }

    if (draft.server_id) {
      payload.server_id = draft.server_id;
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
        external_port: getSuggestedExternalPort(),
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

  async function handleSaveTemplate() {
    setTemplateSubmitting(true);
    setTemplateSubmitError("");
    setTemplateSubmitSuccess("");
    setTemplateDeployError("");
    setTemplateDuplicateError("");
    setTemplateDuplicateSuccess("");

    const draft = buildCurrentDraft();
    const preflight = validateTemplateDraft(draft, {
      ignoreTemplateId: editingTemplateId,
    });

    if (!draft.template_name) {
      setTemplateSubmitError("Template name is required.");
      setTemplateSubmitting(false);
      return;
    }

    if (preflight.errors.length > 0) {
      setTemplateSubmitError(preflight.errors[0]);
      setTemplateSubmitting(false);
      return;
    }

    if (
      preflight.warnings.length > 0 &&
      !window.confirm(`${preflight.warnings.join("\n")}\n\nSave template anyway?`)
    ) {
      setTemplateSubmitting(false);
      return;
    }

    try {
      const response = await fetch(
        editingTemplateId
          ? `${apiBaseUrl}/deployment-templates/${editingTemplateId}`
          : `${apiBaseUrl}/deployment-templates`,
        {
          method: editingTemplateId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(buildTemplatePayload()),
        },
      );
      const savedTemplate = await readJsonOrError(
        response,
        editingTemplateId
          ? "Failed to update deployment template."
          : "Failed to save deployment template.",
      );

      setTemplateName(savedTemplate.template_name || "");
      setTemplatePreviewId(savedTemplate.id);
      setEditingTemplateId(savedTemplate.id);
      setTemplateSubmitSuccess(
        editingTemplateId
          ? "Deployment template updated."
          : "Deployment template saved.",
      );
      await loadTemplates();
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }

      setTemplateSubmitError(
        requestError instanceof Error
          ? requestError.message
          : editingTemplateId
            ? "Failed to update deployment template."
            : "Failed to save deployment template.",
      );
    } finally {
      setTemplateSubmitting(false);
    }
  }

  async function handleDuplicateTemplate(template) {
    const suggestedName = `${template.template_name} copy`;
    const nextName = window.prompt("Name for the duplicated template:", suggestedName);

    if (!nextName) {
      return;
    }

    setTemplateDuplicateError("");
    setTemplateDuplicateSuccess("");
    setDuplicatingTemplateId(template.id);

    try {
      const response = await fetch(
        `${apiBaseUrl}/deployment-templates/${template.id}/duplicate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ template_name: nextName }),
        },
      );
      const duplicatedTemplate = await readJsonOrError(
        response,
        "Failed to duplicate deployment template.",
      );
      setTemplatePreviewId(duplicatedTemplate.id);
      setTemplateDuplicateSuccess(`Template duplicated as "${duplicatedTemplate.template_name}".`);
      await loadTemplates();
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }

      setTemplateDuplicateError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to duplicate deployment template.",
      );
    } finally {
      setDuplicatingTemplateId("");
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
          ? normalizeDeploymentActionError(
              requestError.message,
              "Failed to delete deployment.",
            )
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
      [serverId]: {
        status: "loading",
        message: "Checking SSH and Docker on this server...",
        tested_at: new Date().toISOString(),
      },
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
        [serverId]: {
          ...data,
          tested_at: new Date().toISOString(),
        },
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
          tested_at: new Date().toISOString(),
        },
      }));
    } finally {
      setTestingServerId("");
    }
  }

  async function handleRunServerDiagnostics(serverId) {
    setDiagnosingServerId(serverId);
    setServerDiagnosticsError((current) => ({
      ...current,
      [serverId]: "",
    }));

    try {
      const response = await fetch(`${apiBaseUrl}/servers/${serverId}/diagnostics`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await readJsonOrError(response, "Failed to load server diagnostics.");
      setServerDiagnostics((current) => ({
        ...current,
        [serverId]: data,
      }));
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }

      setServerDiagnosticsError((current) => ({
        ...current,
        [serverId]:
          requestError instanceof Error
            ? requestError.message
            : "Failed to load server diagnostics.",
      }));
    } finally {
      setDiagnosingServerId("");
    }
  }

  function applyTemplate(template) {
    applyTemplateToForm(template);
  }

  async function handleDeleteTemplate(templateId) {
    const confirmed = window.confirm("Delete this deployment template?");

    if (!confirmed) {
      return;
    }

    setTemplateDeleteError("");
    setDeletingTemplateId(templateId);

    try {
      const response = await fetch(
        `${apiBaseUrl}/deployment-templates/${templateId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      await readJsonOrError(response, "Failed to delete deployment template.");
      if (templatePreviewId === templateId) {
        setTemplatePreviewId("");
      }
      if (editingTemplateId === templateId) {
        cancelTemplateEditing();
      }
      await loadTemplates();
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }

      setTemplateDeleteError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to delete deployment template.",
      );
    } finally {
      setDeletingTemplateId("");
    }
  }

  async function handleDeployTemplate(templateId) {
    const template = templates.find((item) => item.id === templateId);
    const draft = template ? buildTemplateDraftFromTemplate(template) : null;
    const preflight = draft
      ? validateTemplateDraft(draft, {
          forDeployment: true,
          ignoreTemplateId: templateId,
        })
      : { errors: [], warnings: [] };

    setTemplateDeployError("");
    setTemplateDeploySuccess("");
    setTemplateCreatedDeployment(null);
    setDeployingTemplateId(templateId);

    if (preflight.errors.length > 0) {
      setTemplateDeployError(preflight.errors[0]);
      setDeployingTemplateId("");
      return;
    }

    if (
      preflight.warnings.length > 0 &&
      !window.confirm(`${preflight.warnings.join("\n")}\n\nDeploy from template anyway?`)
    ) {
      setDeployingTemplateId("");
      return;
    }

    try {
      const response = await fetch(
        `${apiBaseUrl}/deployment-templates/${templateId}/deploy`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const data = await readJsonOrError(response, "Failed to deploy from template.");
      setTemplateCreatedDeployment(data);
      setTemplateDeploySuccess("Deployment created from template.");
      await refreshPage();
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }

      setTemplateDeployError(
        requestError instanceof Error
          ? normalizeCreateDeploymentError(requestError.message)
          : "Failed to deploy from template.",
      );
    } finally {
      setDeployingTemplateId("");
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

  function clearOpsMessages() {
    setOpsActionMessage("");
    setOpsActionError("");
  }

  async function handleCopyOpsSummary() {
    clearOpsMessages();

    try {
      await navigator.clipboard.writeText(buildOpsSummaryText(opsSnapshot));
      setOpsActionMessage("Operations summary copied to clipboard.");
    } catch {
      setOpsActionError("Failed to copy operations summary.");
    }
  }

  async function handleDownloadSnapshot() {
    clearOpsMessages();
    try {
      const response = await fetch(`${apiBaseUrl}/ops/overview?notifications_limit=100`, {
        credentials: "include",
      });
      const data = await readJsonOrError(response, "Failed to download operations snapshot.");
      downloadJsonFile("deploymate-ops-snapshot.json", data);
      setOpsActionMessage("Operations snapshot downloaded.");
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }
      setOpsActionError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to download operations snapshot.",
      );
    }
  }

  async function handleDownloadRemoteExport(filename, url) {
    clearOpsMessages();
    try {
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Export request failed.");
      }
      const blob = await response.blob();
      triggerFileDownload(filename, blob);
      setOpsActionMessage(`${filename} downloaded.`);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }
      setOpsActionError(
        requestError instanceof Error ? requestError.message : `Failed to download ${filename}.`,
      );
    }
  }

  const currentDraft = buildCurrentDraft();
  const templateFormPreflight = validateTemplateDraft(currentDraft, {
    ignoreTemplateId: editingTemplateId,
  });
  const previewDiffRows = buildTemplateDiff(previewTemplate, currentDraft, servers);

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
              disabled={loading || serversLoading || notificationsLoading || templatesLoading}
            >
              {loading || serversLoading || notificationsLoading || templatesLoading
                ? "Refreshing..."
                : "Refresh"}
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
        {templatesError ? <div className="banner error">{templatesError}</div> : null}
        {templateDeleteError ? <div className="banner error">{templateDeleteError}</div> : null}
        {templateDeployError ? <div className="banner error">{templateDeployError}</div> : null}
        {opsActionError ? <div className="banner error">{opsActionError}</div> : null}
        {opsActionMessage ? <div className="banner success">{opsActionMessage}</div> : null}
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

        <article className="card formCard">
          <div className="sectionHeader">
            <div>
              <h2>Operations overview</h2>
              <p className="formHint">
                High-signal summary, attention items, and export actions built from the current dashboard state.
              </p>
            </div>
            <div className="actions">
              <button type="button" onClick={handleCopyOpsSummary}>
                Copy summary
              </button>
              <button type="button" onClick={handleDownloadSnapshot}>
                Download overview JSON
              </button>
              <button
                type="button"
                onClick={() =>
                  handleDownloadRemoteExport(
                    "deploymate-deployments.csv",
                    `${apiBaseUrl}/ops/exports/deployments?format=csv`,
                  )
                }
              >
                Export deployments CSV
              </button>
              <button
                type="button"
                onClick={() =>
                  handleDownloadRemoteExport(
                    "deploymate-servers.csv",
                    `${apiBaseUrl}/ops/exports/servers?format=csv`,
                  )
                }
              >
                Export servers CSV
              </button>
              <button
                type="button"
                onClick={() =>
                  handleDownloadRemoteExport(
                    "deploymate-templates.csv",
                    `${apiBaseUrl}/ops/exports/templates?format=csv`,
                  )
                }
              >
                Export templates CSV
              </button>
              <button
                type="button"
                onClick={() =>
                  handleDownloadRemoteExport(
                    "deploymate-activity.csv",
                    `${apiBaseUrl}/ops/exports/activity?format=csv&limit=200`,
                  )
                }
              >
                Export activity CSV
              </button>
            </div>
          </div>

          {opsOverviewLoading ? (
            <div className="banner subtle">Refreshing server-side operations overview...</div>
          ) : null}

          <div className="overviewGrid">
            <div className="overviewCard">
              <span className="overviewLabel">Deployments</span>
              <strong className="overviewValue">{opsSnapshot.deployments.total}</strong>
              <div className="overviewMeta">
                <span>Running {opsSnapshot.deployments.running}</span>
                <span>Failed {opsSnapshot.deployments.failed}</span>
                <span>Pending {opsSnapshot.deployments.pending}</span>
                <span>Public URLs {opsSnapshot.deployments.public_urls}</span>
              </div>
            </div>
            <div className="overviewCard">
              <span className="overviewLabel">Servers</span>
              <strong className="overviewValue">{opsSnapshot.servers.total}</strong>
              <div className="overviewMeta">
                <span>Password auth {opsSnapshot.servers.password_auth}</span>
                <span>SSH key auth {opsSnapshot.servers.ssh_key_auth}</span>
                <span>Unused {opsSnapshot.servers.unused}</span>
              </div>
            </div>
            <div className="overviewCard">
              <span className="overviewLabel">Activity</span>
              <strong className="overviewValue">{opsSnapshot.notifications.total}</strong>
              <div className="overviewMeta">
                <span>Success {opsSnapshot.notifications.success}</span>
                <span>Errors {opsSnapshot.notifications.error}</span>
                <span>
                  Latest error{" "}
                  {opsSnapshot.notifications.latest_error_at
                    ? formatDate(opsSnapshot.notifications.latest_error_at)
                    : "N/A"}
                </span>
              </div>
            </div>
            <div className="overviewCard">
              <span className="overviewLabel">Templates</span>
              <strong className="overviewValue">{opsSnapshot.templates.total}</strong>
              <div className="overviewMeta">
                <span>Unused {opsSnapshot.templates.unused}</span>
                <span>Used in 7d {opsSnapshot.templates.recently_used}</span>
                <span>
                  Top {opsSnapshot.templates.top_template_name || "No popular template yet"}
                </span>
              </div>
            </div>
          </div>

          {opsSnapshot.attention_items.length > 0 ? (
            <div className="overviewAttentionList">
              {opsSnapshot.attention_items.map((item, index) => (
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
          ) : (
            <div className="banner subtle">No immediate attention items from the current data.</div>
          )}
        </article>

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
          <div className="sectionHeader">
            <div>
              <h2>Servers</h2>
              <p className="formHint">
                Search saved targets, run diagnostics, and watch for unused entries before the next rollout.
              </p>
            </div>
            <label className="field toolbarField">
              <span>Search servers</span>
              <input
                value={serverQuery}
                onChange={(event) => setServerQuery(event.target.value)}
                placeholder="demo-vps, 203.0.113.10, root"
                disabled={serversLoading}
              />
            </label>
          </div>
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

            {!serversLoading && servers.length > 0 && filteredServers.length === 0 ? (
              <div className="empty">No servers match this search.</div>
            ) : null}

            {filteredServers.map((server) => (
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
                {serverTestResults[server.id]?.tested_at ? (
                  <div className="row">
                    <span className="label">Last test</span>
                    <span>{formatDate(serverTestResults[server.id].tested_at)}</span>
                  </div>
                ) : null}
                {serverTestResults[server.id]?.target ? (
                  <div className="row">
                    <span className="label">Target</span>
                    <span>{serverTestResults[server.id].target}</span>
                  </div>
                ) : null}
                {serverTestResults[server.id]?.tested_at ? (
                  <>
                    <div className="row">
                      <span className="label">SSH</span>
                      <span
                        className={`status ${
                          serverTestResults[server.id].ssh_ok ? "success" : "error"
                        }`}
                      >
                        {serverTestResults[server.id].ssh_ok ? "ok" : "failed"}
                      </span>
                    </div>
                    <div className="row">
                      <span className="label">Docker</span>
                      <span
                        className={`status ${
                          serverTestResults[server.id].docker_ok ? "success" : "error"
                        }`}
                      >
                        {serverTestResults[server.id].docker_ok ? "ok" : "failed"}
                      </span>
                    </div>
                  </>
                ) : null}
                {serverTestResults[server.id]?.docker_version ? (
                  <div className="row">
                    <span className="label">Docker version</span>
                    <span>{serverTestResults[server.id].docker_version}</span>
                  </div>
                ) : null}
                {serverDiagnostics[server.id]?.checked_at ? (
                  <div className="row">
                    <span className="label">Diagnostics</span>
                    <span>{formatDate(serverDiagnostics[server.id].checked_at)}</span>
                  </div>
                ) : null}
                <div className="actions">
                  {serverTestResults[server.id]?.status ? (
                    <span
                      className={`status ${
                        serverTestResults[server.id].status === "loading"
                          ? "unknown"
                          : serverTestResults[server.id].status
                      }`}
                    >
                      Last test:{" "}
                      {serverTestResults[server.id].status === "loading"
                        ? "checking"
                        : serverTestResults[server.id].status}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleTestServer(server.id)}
                    disabled={testingServerId === server.id}
                  >
                    {testingServerId === server.id ? "Testing..." : "Test connection"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunServerDiagnostics(server.id)}
                    disabled={diagnosingServerId === server.id}
                  >
                    {diagnosingServerId === server.id
                      ? "Running diagnostics..."
                      : "Run diagnostics"}
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
                      serverTestResults[server.id].status === "success"
                        ? "success"
                        : serverTestResults[server.id].status === "loading"
                          ? "subtle"
                          : "error"
                    } inlineBanner`}
                  >
                    {serverTestResults[server.id].message}
                  </div>
                ) : null}
                {serverDiagnosticsError[server.id] ? (
                  <div className="banner error inlineBanner">
                    {serverDiagnosticsError[server.id]}
                  </div>
                ) : null}
                {serverDiagnostics[server.id] ? (
                  <div className="diagnosticsGrid">
                    <div className="diagnosticItem">
                      <div className="row">
                        <span className="label">Overall</span>
                        <span
                          className={`status ${
                            serverDiagnostics[server.id].overall_status || "unknown"
                          }`}
                        >
                          {serverDiagnostics[server.id].overall_status || "unknown"}
                        </span>
                      </div>
                      <p>{serverDiagnostics[server.id].target}</p>
                      <div className="diagnosticDetails">
                        Deployments on server: {serverDiagnostics[server.id].deployment_count}
                      </div>
                    </div>
                    {(serverDiagnostics[server.id].items || []).map((item) => (
                      <div className="diagnosticItem" key={`${server.id}-${item.key}`}>
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
                    <div className="diagnosticMeta">
                      <span>Hostname: {serverDiagnostics[server.id].hostname || "-"}</span>
                      <span>OS: {serverDiagnostics[server.id].operating_system || "-"}</span>
                      <span>Uptime: {serverDiagnostics[server.id].uptime || "-"}</span>
                      <span>Disk: {serverDiagnostics[server.id].disk_usage || "-"}</span>
                      <span>Memory: {serverDiagnostics[server.id].memory || "-"}</span>
                      <span>
                        Compose: {serverDiagnostics[server.id].docker_compose_version || "-"}
                      </span>
                      <span>
                        Ports:{" "}
                        {Array.isArray(serverDiagnostics[server.id].listening_ports) &&
                        serverDiagnostics[server.id].listening_ports.length > 0
                          ? serverDiagnostics[server.id].listening_ports.join(", ")
                          : "-"}
                      </span>
                    </div>
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

          <div className="filterTabs historyFilters" role="tablist" aria-label="Activity filters">
            <button
              type="button"
              className={notificationFilter === "all" ? "active" : ""}
              onClick={() => setNotificationFilter("all")}
            >
              All
            </button>
            <button
              type="button"
              className={notificationFilter === "success" ? "active" : ""}
              onClick={() => setNotificationFilter("success")}
            >
              Success
            </button>
            <button
              type="button"
              className={notificationFilter === "error" ? "active" : ""}
              onClick={() => setNotificationFilter("error")}
            >
              Errors
            </button>
          </div>

          <label className="field toolbarField">
            <span>Search activity</span>
            <input
              value={notificationQuery}
              onChange={(event) => setNotificationQuery(event.target.value)}
              placeholder="deployment failed, health, delete"
              disabled={notificationsLoading}
            />
          </label>

          {notificationsError ? <div className="banner error">{notificationsError}</div> : null}

          {notificationsLoading && notifications.length === 0 ? (
            <div className="empty">Loading notifications...</div>
          ) : null}

          {!notificationsLoading && notifications.length === 0 ? (
            <div className="empty">No notifications yet.</div>
          ) : null}

          {!notificationsLoading &&
          notifications.length > 0 &&
          filteredNotifications.length === 0 ? (
            <div className="empty">No activity matches this filter yet.</div>
          ) : null}

          {filteredNotifications.length > 0 ? (
            <div className="timeline">
              {filteredNotifications.map((item) => (
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
                    <span className="status unknown">
                      {inferActivityCategory(item.title, item.message)}
                    </span>
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
          <div className="sectionHeader">
            <div>
              <h2>Deployment templates</h2>
              <p className="formHint">
                Save common image, ports, server, and env settings once, then deploy directly or apply them back to the create form.
              </p>
            </div>
          </div>
          <div className="filterTabs historyFilters" role="tablist" aria-label="Template filters">
            <button
              type="button"
              className={templateFilter === "all" ? "active" : ""}
              onClick={() => setTemplateFilter("all")}
            >
              All
            </button>
            <button
              type="button"
              className={templateFilter === "unused" ? "active" : ""}
              onClick={() => setTemplateFilter("unused")}
            >
              Unused
            </button>
            <button
              type="button"
              className={templateFilter === "recent" ? "active" : ""}
              onClick={() => setTemplateFilter("recent")}
            >
              Used in 7d
            </button>
            <button
              type="button"
              className={templateFilter === "popular" ? "active" : ""}
              onClick={() => setTemplateFilter("popular")}
            >
              Popular
            </button>
          </div>
          <label className="field">
            <span>Search templates</span>
            <input
              value={templateQuery}
              onChange={(event) => setTemplateQuery(event.target.value)}
              placeholder="template name, image, server, env key"
              disabled={templatesLoading}
            />
          </label>

          {templatesLoading ? (
            <div className="empty">Loading templates...</div>
          ) : filteredTemplates.length === 0 ? (
            <div className="empty">No templates yet. Save the current create form as your first template.</div>
          ) : (
            <div className="list compactList">
              {filteredTemplates.map((template) => (
                <div key={template.id} className="card compactCard">
                  <div className="row">
                    <span className="label">Template</span>
                    <span>{template.template_name}</span>
                  </div>
                  <div className="row">
                    <span className="label">Image</span>
                    <span>{template.image}</span>
                  </div>
                  <div className="row">
                    <span className="label">Deploy name</span>
                    <span>{template.name || "Auto-generate"}</span>
                  </div>
                  <div className="row">
                    <span className="label">Server</span>
                    <span>{formatServerLabel(template.server_name, template.server_host)}</span>
                  </div>
                  <div className="row">
                    <span className="label">Ports</span>
                    <span>{formatPortMapping(template.internal_port, template.external_port)}</span>
                  </div>
                  <div className="row">
                    <span className="label">Env vars</span>
                    <span>{Object.keys(template.env || {}).length}</span>
                  </div>
                  <div className="row">
                    <span className="label">Used</span>
                    <span>{template.use_count || 0}</span>
                  </div>
                  <div className="row">
                    <span className="label">Created</span>
                    <span>{formatDate(template.created_at)}</span>
                  </div>
                  <div className="row">
                    <span className="label">Updated</span>
                    <span>{formatDate(template.updated_at || template.created_at)}</span>
                  </div>
                  <div className="row">
                    <span className="label">Last used</span>
                    <span>{template.last_used_at ? formatDate(template.last_used_at) : "Never"}</span>
                  </div>
                  <div className="actions">
                    <button
                      type="button"
                      onClick={() =>
                        setTemplatePreviewId((currentId) =>
                          currentId === template.id ? "" : template.id,
                        )
                      }
                    >
                      {templatePreviewId === template.id ? "Hide preview" : "Preview"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeployTemplate(template.id)}
                      disabled={deployingTemplateId === template.id || deploymentLimitReached}
                    >
                      {deployingTemplateId === template.id ? "Deploying..." : "Deploy now"}
                    </button>
                    <button type="button" onClick={() => applyTemplateToForm(template, { startEditing: true })}>
                      Edit in form
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateTemplate(template)}
                      disabled={duplicatingTemplateId === template.id}
                    >
                      {duplicatingTemplateId === template.id ? "Duplicating..." : "Duplicate"}
                    </button>
                    <button
                      type="button"
                      className="dangerButton"
                      onClick={() => handleDeleteTemplate(template.id)}
                      disabled={deletingTemplateId === template.id}
                    >
                      {deletingTemplateId === template.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {previewTemplate ? (
            <div className="card compactCard previewCard">
              <div className="sectionHeader">
                <div>
                  <h3>Template preview</h3>
                  <p className="formHint">
                    Review the selected template against the current create form before apply or deploy.
                  </p>
                </div>
              </div>
              {previewDiffRows.length === 0 ? (
                <div className="banner subtle">
                  Current create form already matches "{previewTemplate.template_name}".
                </div>
              ) : (
                <div className="list compactList">
                  {previewDiffRows.map((row) => (
                    <div key={`${previewTemplate.id}-${row.label}`} className="card compactCard diffCard">
                      <div className="row">
                        <span className="label">{row.label}</span>
                        <span className="stackedValue">
                          <span><strong>Template:</strong> {row.templateValue}</span>
                          <span><strong>Current form:</strong> {row.currentValue}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="actions">
                <button type="button" onClick={() => applyTemplate(previewTemplate)}>
                  Apply to form
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplateToForm(previewTemplate, { startEditing: true })}
                >
                  Edit in form
                </button>
                <button
                  type="button"
                  onClick={() => handleDeployTemplate(previewTemplate.id)}
                  disabled={deployingTemplateId === previewTemplate.id || deploymentLimitReached}
                >
                  {deployingTemplateId === previewTemplate.id ? "Deploying..." : "Deploy from preview"}
                </button>
              </div>
            </div>
          ) : null}

          {templateDeploySuccess ? (
            <div className="banner success inlineBanner">
              <div>{templateDeploySuccess}</div>
              {templateCreatedDeployment?.id || buildDeploymentUrl(templateCreatedDeployment) ? (
                <div className="successActions">
                  {templateCreatedDeployment?.id ? (
                    <Link
                      href={`/deployments/${templateCreatedDeployment.id}`}
                      className="linkButton"
                    >
                      View details
                    </Link>
                  ) : null}
                  {buildDeploymentUrl(templateCreatedDeployment) ? (
                    <a
                      href={buildDeploymentUrl(templateCreatedDeployment)}
                      target="_blank"
                      rel="noreferrer"
                      className="linkButton"
                    >
                      Open app
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {templateDuplicateError ? <div className="banner error">{templateDuplicateError}</div> : null}
          {templateDuplicateSuccess ? <div className="banner success">{templateDuplicateSuccess}</div> : null}
        </article>

        <article className="card formCard">
          <h2>Create deployment</h2>
          {editingTemplateId ? (
            <div className="banner subtle">
              <div>Editing template in the deploy form. Saving will update the selected template instead of creating a new one.</div>
              <div className="successActions">
                <button type="button" className="linkButton" onClick={cancelTemplateEditing}>
                  Cancel template editing
                </button>
              </div>
            </div>
          ) : null}
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
              <span className="fieldHint">
                Leave Name empty to let DeployMate generate a unique container name automatically.
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
                {form.server_id
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
                    key={`create-port-${port}`}
                    type="button"
                    onClick={() => useSuggestedPort(port)}
                    disabled={submitting}
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

            <label className="field">
              <span>Template name</span>
              <input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="Save current form as..."
                disabled={submitting || templateSubmitting}
              />
              <span className="fieldHint">
                Save the current image, name, ports, server, and env vars as a reusable preset.
              </span>
            </label>

            <div className="formActions">
              <button type="submit" disabled={submitting || deploymentLimitReached}>
                {submitting ? "Creating..." : "Create deployment"}
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={
                  submitting ||
                  templateSubmitting ||
                  !templateName.trim() ||
                  !form.image.trim()
                }
              >
                {templateSubmitting
                  ? editingTemplateId
                    ? "Updating template..."
                    : "Saving template..."
                  : editingTemplateId
                    ? "Update template"
                    : "Save as template"}
              </button>
              {editingTemplateId ? (
                <button type="button" className="linkButton" onClick={cancelTemplateEditing}>
                  Cancel template editing
                </button>
              ) : null}
              {submitting ? <span className="formHint">Sending request to backend...</span> : null}
            </div>
          </form>

          {submitError ? <div className="banner error">{submitError}</div> : null}
          {templateFormPreflight.errors.length > 0 ? (
            <div className="banner error">{templateFormPreflight.errors[0]}</div>
          ) : null}
          {templateFormPreflight.warnings.length > 0 ? (
            <div className="banner subtle">
              {templateFormPreflight.warnings.join(" ")}
            </div>
          ) : null}
          <div className="banner subtle">
            Current form snapshot: {countFilledEnvRows(envRows)} env vars,{" "}
            {form.server_id ? "remote server selected" : "local target"},{" "}
            {form.internal_port.trim() && form.external_port.trim()
              ? `ports ${form.external_port}:${form.internal_port}`
              : "no port mapping"}.
          </div>
          {templateSubmitError ? <div className="banner error">{templateSubmitError}</div> : null}
          {templateSubmitSuccess ? <div className="banner success">{templateSubmitSuccess}</div> : null}
          {submitSuccess ? (
            <div className="banner success">
              <div>{submitSuccess}</div>
              {createdDeployment?.id || buildDeploymentUrl(createdDeployment) ? (
                <div className="successActions">
                  {createdDeployment?.id ? (
                    <Link
                      href={`/deployments/${createdDeployment.id}`}
                      className="linkButton"
                    >
                      View details
                    </Link>
                  ) : null}
                  {buildDeploymentUrl(createdDeployment) ? (
                    <a
                      href={buildDeploymentUrl(createdDeployment)}
                      target="_blank"
                      rel="noreferrer"
                      className="linkButton"
                    >
                      Open app
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </article>

          <div className="sectionHeader deploymentsHeader">
          <div>
            <h2>Deployments</h2>
            <p className="formHint">
              Filter current deployments by status or search by image, container, or server.
            </p>
          </div>
          <div className="deploymentControls">
            <div className="filterTabs" role="tablist" aria-label="Deployment filters">
              <button
                type="button"
                className={deploymentFilter === "all" ? "active" : ""}
                onClick={() => setDeploymentFilter("all")}
              >
                All
              </button>
              <button
                type="button"
                className={deploymentFilter === "running" ? "active" : ""}
                onClick={() => setDeploymentFilter("running")}
              >
                Running
              </button>
              <button
                type="button"
                className={deploymentFilter === "failed" ? "active" : ""}
                onClick={() => setDeploymentFilter("failed")}
              >
                Failed
              </button>
            </div>
            <label className="field deploymentSearch">
              <span>Search</span>
              <input
                value={deploymentQuery}
                onChange={(event) => setDeploymentQuery(event.target.value)}
                placeholder="nginx, test-nginx, main-vps"
              />
            </label>
            <div className="banner subtle inlineBanner">
              Showing {filteredDeployments.length} of {deployments.length} deployments.
            </div>
          </div>
        </div>

        <div className="list">
          {loading && deployments.length === 0 ? (
            <div className="empty">Loading deployments...</div>
          ) : null}

          {!loading && deployments.length === 0 ? (
            <div className="empty">No deployments found.</div>
          ) : null}

          {!loading && deployments.length > 0 && filteredDeployments.length === 0 ? (
            <div className="empty">
              No deployments match this filter. Try another status or clear the search.
            </div>
          ) : null}

          {filteredDeployments.map((deployment) => (
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
              <div className="row">
                <span className="label">URL</span>
                <span>{buildDeploymentUrl(deployment) || "-"}</span>
              </div>
              <div className="actions">
                <Link href={`/deployments/${deployment.id}`} className="linkButton">
                  View details
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
