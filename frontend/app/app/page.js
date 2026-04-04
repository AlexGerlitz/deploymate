"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminDisclosureSection } from "./admin-ui";
import {
  smokeDeployments,
  smokeMode,
  smokeNotifications,
  smokeOpsOverview,
  smokeServers,
  smokeTemplates,
  smokeUser,
} from "../lib/smoke-fixtures";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const localDeploymentsEnabled =
  process.env.NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED !== "0";

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

async function readErrorMessageFromResponse(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const payload = await response.json();
      if (payload && typeof payload.detail === "string" && payload.detail.trim()) {
        return payload.detail;
      }
    } catch {
      return fallbackMessage;
    }
  }

  return fallbackMessage;
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
      detail: localDeploymentsEnabled
        ? "Only local deploys are available until a VPS target is added."
        : "This environment is remote-only, so add a VPS target before the next deployment.",
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
  const [authChecked, setAuthChecked] = useState(smokeMode);
  const [authFallbackVisible, setAuthFallbackVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState(smokeMode ? smokeUser : null);

  const [deployments, setDeployments] = useState(smokeMode ? smokeDeployments : []);
  const [servers, setServers] = useState(smokeMode ? smokeServers : []);
  const [notifications, setNotifications] = useState(smokeMode ? smokeNotifications : []);
  const [templates, setTemplates] = useState(smokeMode ? smokeTemplates : []);
  const [loading, setLoading] = useState(!smokeMode);
  const [serversLoading, setServersLoading] = useState(!smokeMode);
  const [notificationsLoading, setNotificationsLoading] = useState(!smokeMode);
  const [templatesLoading, setTemplatesLoading] = useState(!smokeMode);
  const [error, setError] = useState("");
  const [serversError, setServersError] = useState("");
  const [notificationsError, setNotificationsError] = useState("");
  const [templatesError, setTemplatesError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [createdDeployment, setCreatedDeployment] = useState(null);

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
  const [templateDeleteError, setTemplateDeleteError] = useState("");
  const [deletingTemplateId, setDeletingTemplateId] = useState("");
  const [deployingTemplateId, setDeployingTemplateId] = useState("");
  const [duplicatingTemplateId, setDuplicatingTemplateId] = useState("");
  const [deploymentFilter, setDeploymentFilter] = useState("all");
  const [deploymentQuery, setDeploymentQuery] = useState("");
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [notificationQuery, setNotificationQuery] = useState("");
  const [templateQuery, setTemplateQuery] = useState("");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [templatePreviewId, setTemplatePreviewId] = useState(smokeMode ? "smoke-template" : "");
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [suggestedPorts, setSuggestedPorts] = useState([]);
  const [suggestedPortsLoading, setSuggestedPortsLoading] = useState(false);
  const [opsOverview, setOpsOverview] = useState(smokeMode ? smokeOpsOverview : null);
  const [opsOverviewLoading, setOpsOverviewLoading] = useState(!smokeMode);
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
  const degradedOpsAttentionItems = opsSnapshot.attention_items.filter((item) =>
    item.title.includes("temporarily unavailable"),
  );
  const workspacePriority =
    opsSnapshot.attention_items[0]?.title ||
    (opsSnapshot.deployments.failed > 0
      ? "Failed deployments need review before the next rollout."
      : "Workspace is clear enough for the next deployment batch.");
  const workspaceStatusItems = [
    {
      label: "Environment",
      value: opsSnapshot.capabilities?.local_docker_enabled ? "Hybrid runtime" : "Remote runtime",
      detail: `${opsSnapshot.deployments.remote} remote deploys · ${opsSnapshot.deployments.public_urls} public URLs`,
    },
    {
      label: "Plan",
      value: currentUser ? `${currentUser.plan} workspace` : "Signed-in workspace",
      detail: currentUser
        ? `${currentUser.usage?.deployments ?? 0}/${currentUser.limits?.max_deployments ?? 0} deploy slots in use`
        : "Deployments, servers, exports, and activity history",
    },
    {
      label: "Cadence",
      value: "8-second sync loop",
      detail: smokeMode
        ? "Fixture-backed smoke mode is active for runtime surfaces"
        : "Deployments and activity cards keep refreshing automatically",
    },
  ];
  const workspaceGuideCards = [
    {
      step: "01",
      title: "Review current health",
      detail:
        opsSnapshot.deployments.failed > 0
          ? `${opsSnapshot.deployments.failed} deployment${opsSnapshot.deployments.failed === 1 ? "" : "s"} need attention before the next rollout.`
          : `${opsSnapshot.deployments.running} deployment${opsSnapshot.deployments.running === 1 ? "" : "s"} are running cleanly right now.`,
      href: "#runtime-deployments",
      actionLabel:
        opsSnapshot.deployments.failed > 0 ? "Review deployments" : "Open live deployments",
    },
    {
      step: "02",
      title: "Start the next rollout",
      detail:
        templates.length > 0
          ? `${templates.length} saved template${templates.length === 1 ? "" : "s"} can accelerate the next deployment.`
          : "Use the guided form to pick an image, ports, and env vars for the next deployment.",
      href: "#create-deployment",
      actionLabel: "Create deployment",
    },
    {
      step: "03",
      title: currentUser?.is_admin ? "Keep the workspace aligned" : "Explore the workspace safely",
      detail: currentUser?.is_admin
        ? "Open user access or upgrade review when you need to change shared workspace settings."
        : "Trial access keeps admin controls separate while you review the core runtime flow.",
      href: currentUser?.is_admin ? "/app/users" : "/upgrade",
      actionLabel: currentUser?.is_admin ? "Open admin surface" : "View upgrade options",
    },
  ];
  const workspaceScenarioCards = [
    {
      key: "deploy",
      label: "Deploy",
      title: deployments.length > 0 ? "Start the next rollout" : "Launch the first deployment",
      detail:
        templates.length > 0
          ? "Use the guided deployment form and available templates to ship the next container quickly."
          : "Open the deployment form first, then pick image, ports, and env vars in one obvious path.",
      href: "#create-deployment",
      actionLabel: "Create deployment",
      primary: true,
    },
    {
      key: "runtime",
      label: "Runtime",
      title: opsSnapshot.deployments.failed > 0 ? "Review live incidents" : "Review live deployments",
      detail:
        opsSnapshot.deployments.failed > 0
          ? "Failed rollouts already need attention, so go straight to the live deployment list and open one detail page."
          : "Open the current deployment list when you want to check health, activity, and runtime status first.",
      href: "#runtime-deployments",
      actionLabel: opsSnapshot.deployments.failed > 0 ? "Review deployments" : "Open live deployments",
      primary: false,
    },
    ...(currentUser?.is_admin
      ? [
          {
            key: "servers",
            label: "Servers",
            title: "Review server targets",
            detail: "Open the dedicated server workspace when you need to add, test, diagnose, or clean up rollout targets.",
            href: "/app/server-review",
            actionLabel: "Open server review",
            primary: false,
          },
          {
            key: "recovery",
            label: "Recovery",
            title: "Review backup and recovery",
            detail: "Open the admin recovery path when you need restore validation, import review, or controlled preparation handoff.",
            href: "/app/users",
            actionLabel: "Open recovery path",
            primary: false,
          },
        ]
      : [
          {
            key: "upgrade",
            label: "Upgrade",
            title: "Unlock more workspace depth",
            detail: "Commercial and team workflows stay separate from the runtime path until you need them.",
            href: "/upgrade",
            actionLabel: "View upgrade options",
            primary: false,
          },
        ]),
  ];
  const reviewerPathItems = [
    {
      label: "Start here",
      title:
        opsSnapshot.deployments.total > 0
          ? "Read the live runtime surface"
          : "Read the live workspace surface",
      detail:
        opsSnapshot.deployments.total > 0
          ? "Open the deployment list first, then step into one live deployment detail to see health, logs, diagnostics, and activity together."
          : "The workspace hero and status strip explain what this environment can do before any deployment exists.",
      href:
        deployments[0]?.id
          ? `/deployments/${deployments[0].id}`
          : "#runtime-deployments",
      actionLabel:
        deployments[0]?.id ? "Open deployment detail" : "Open deployment list",
    },
    {
      label: "Then show depth",
      title: currentUser?.is_admin ? "Open team access review" : "Open upgrade path",
      detail: currentUser?.is_admin
        ? "The users surface shows saved views, exports, restore validation, and audit-oriented access review."
        : "The upgrade path keeps commercial next steps separate from the runtime workspace.",
      href: currentUser?.is_admin ? "/app/users" : "/upgrade",
      actionLabel: currentUser?.is_admin ? "Open users" : "Open upgrade",
    },
    {
      label: "Finish with governance",
      title: currentUser?.is_admin ? "Open the upgrade inbox" : "Return to runtime state",
      detail: currentUser?.is_admin
        ? "The upgrade inbox makes queue review, bulk status changes, and audit history easy to discover."
        : "Stay on the main workspace when you only need runtime proof and rollout clarity.",
      href: currentUser?.is_admin ? "/app/upgrade-requests" : "#runtime-deployments",
      actionLabel: currentUser?.is_admin ? "Open upgrade inbox" : "Back to deployments",
    },
  ];
  const firstRunContext = deployments.length > 0
    ? "Start with the live service list and the priority card below. Open one deployment detail next, then open team/admin review only after the runtime story is clear."
    : "Start with the workspace summary below. This environment has no live deployments yet, so the next useful step is either creating one or reviewing saved targets and templates.";
  const workspaceGlanceItems = [
    ...workspaceStatusItems,
    {
      label: "Next step",
      value:
        opsSnapshot.deployments.failed > 0
          ? "Resolve failed rollout"
          : deployments.length === 0
            ? "Launch first deployment"
            : "Prepare next rollout",
      detail:
        opsSnapshot.attention_items[0]?.detail ||
        "Use the deployment list first, then open advanced workspace tools only when needed.",
    },
  ];
  const serverReviewPreviewItems = servers.slice(0, 3);
  const workspaceSignalsBadge = `${opsSnapshot.attention_items.length} attention item${
    opsSnapshot.attention_items.length === 1 ? "" : "s"
  }`;
  const workspaceFocusItems = [
    {
      label: "Priority",
      value:
        opsSnapshot.attention_items[0]?.title ||
        (deployments.length === 0 ? "Start first rollout" : "Workspace is stable"),
      detail:
        opsSnapshot.attention_items[0]?.detail ||
        "No blocking signal is leading the workspace right now.",
    },
    {
      label: "Security",
      value: currentUser?.must_change_password ? "Password update required" : "Session posture normal",
      detail: currentUser?.must_change_password
        ? "Default admin password is still active and should be changed before further rollout work."
        : "Account access can stay in flow while admin controls remain separate.",
    },
    {
      label: "Readiness",
      value:
        templates.length > 0
          ? `${templates.length} template${templates.length === 1 ? "" : "s"} ready`
          : "Guided form ready",
      detail:
        servers.length > 0
          ? `${servers.length} target${servers.length === 1 ? "" : "s"} saved for remote rollout and diagnostics.`
          : "Add a target when you want repeatable remote rollout paths.",
    },
  ];

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
    if (!currentUser?.is_admin) {
      setServers([]);
      setServersError("");
      setServersLoading(false);
      return;
    }

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
    if (smokeMode) {
      return;
    }
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
    if (smokeMode) {
      return;
    }

    async function checkAuthAndLoad() {
      try {
        await loadCurrentUser();
        setAuthChecked(true);
        setAuthFallbackVisible(false);
        await refreshPage();
      } catch {
        router.replace("/login");
      }
    }

    checkAuthAndLoad();
  }, [router]);

  useEffect(() => {
    if (smokeMode || authChecked) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAuthFallbackVisible(true);
    }, 3500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [authChecked]);

  useEffect(() => {
    if (smokeMode || !authChecked) {
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
    if (smokeMode || !authChecked) {
      return;
    }
    loadDeployments();
  }, [authChecked, deploymentFilter, deploymentQuery]);

  useEffect(() => {
    if (smokeMode || !authChecked) {
      return;
    }
    loadNotifications();
  }, [authChecked, notificationFilter, notificationQuery]);

  useEffect(() => {
    if (smokeMode || !authChecked) {
      return;
    }
    loadTemplates();
  }, [authChecked, templateFilter, templateQuery]);

  useEffect(() => {
    async function loadSuggestedPorts() {
      if (smokeMode) {
        setSuggestedPorts([38080, 38081, 38082]);
        setSuggestedPortsLoading(false);
        return;
      }

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

    if (!localDeploymentsEnabled && !draft.server_id) {
      errors.push("This environment is remote-only. Choose a saved server target.");
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

    if (localDeploymentsEnabled && !draft.server_id && externalPort) {
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
        const detail = await readErrorMessageFromResponse(
          response,
          `Failed to download ${filename}.`,
        );
        const error = new Error(detail);
        error.status = response.status;
        throw error;
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
  const createDeploymentBlocked =
    submitting ||
    deploymentLimitReached ||
    (!localDeploymentsEnabled && !form.server_id);
  const previewDiffRows = buildTemplateDiff(previewTemplate, currentDraft, servers);

  if (!authChecked) {
    return (
      <main className="page">
        <div className="container">
          {authFallbackVisible ? (
            <div className="card formCard">
              <h1>Checking authentication</h1>
              <div className="banner subtle">
                This app usually redirects into the authenticated workspace automatically.
                If your browser or webview blocks that bootstrap flow, use the direct
                public entry points below.
              </div>
              <div className="formActions">
                <Link href="/login" className="linkButton">
                  Open login
                </Link>
                <Link href="/register" className="linkButton">
                  Create trial account
                </Link>
                <Link href="/" className="linkButton">
                  Back to homepage
                </Link>
              </div>
            </div>
          ) : (
            <div className="empty">Checking authentication...</div>
          )}
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
              <div className="eyebrow">Live workspace</div>
              <h1 data-testid="runtime-page-title">DeployMate</h1>
              <p>
                {currentUser
                  ? `Logged in as ${currentUser.username}. ${workspacePriority}`
                  : "Deployments, review flows, diagnostics, and clearer runtime visibility."}
              </p>
            </div>
            <div className="buttonRow workspaceHeroActions">
              <Link href="#create-deployment" className="landingButton primaryButton workspacePrimaryAction">
                Create deployment
              </Link>
              {currentUser?.is_admin ? (
                <Link href="/app/users" className="workspaceGhostAction">
                  Users
                </Link>
              ) : null}
              {currentUser?.is_admin ? (
                <Link href="/app/server-review" className="workspaceGhostAction">
                  Server review
                </Link>
              ) : null}
              {currentUser?.is_admin ? (
                <Link href="/app/upgrade-requests" className="workspaceGhostAction">
                  Upgrade inbox
                </Link>
              ) : null}
              <button
                type="button"
                onClick={refreshPage}
                disabled={loading || serversLoading || notificationsLoading || templatesLoading}
                className="linkButton workspaceSecondaryAction"
              >
                {loading || serversLoading || notificationsLoading || templatesLoading
                  ? "Refreshing..."
                  : "Refresh"}
              </button>
              <button type="button" onClick={handleLogout} className="workspaceGhostAction">
                Logout
              </button>
            </div>
          </div>

          <div className="workspaceHeroSummary">
            <div className="workspaceHeroMetric">
              <span>Deployments</span>
              <strong>{opsSnapshot.deployments.running}</strong>
              <p>
                Running now · {opsSnapshot.deployments.total} total ·{" "}
                {opsSnapshot.deployments.failed} failed
              </p>
            </div>
            <div className="workspaceHeroMetric">
              <span>Targets</span>
              <strong>{opsSnapshot.servers.total}</strong>
              <p>
                Server targets · {opsSnapshot.servers.ssh_key_auth} SSH key ·{" "}
                {opsSnapshot.servers.unused} idle
              </p>
            </div>
            <div className="workspaceHeroMetric">
              <span>Activity</span>
              <strong>{opsSnapshot.notifications.error}</strong>
              <p>
                Error events · {opsSnapshot.notifications.success} success · latest{" "}
                {opsSnapshot.notifications.latest_error_at
                  ? formatDate(opsSnapshot.notifications.latest_error_at)
                  : "clean"}
              </p>
            </div>
            <div className="workspaceHeroBadge workspaceHeroSpotlight">
              <span>What matters now</span>
              <strong>{workspacePriority}</strong>
              <p>
                Start with deployment status and the next rollout. Advanced workspace tools stay available below when needed.
              </p>
            </div>
          </div>
        </section>

        <section className="workspaceStatusStrip" data-testid="workspace-status-strip">
          {workspaceFocusItems.map((item) => (
            <article key={item.label} className="workspaceStatusCard workspaceStatusCardElevated">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </section>

        <article className="card formCard workspaceGuidePanel" data-testid="workspace-scenario-card">
          <div className="sectionHeader workspaceGuideHeader">
            <div>
              <h2 data-testid="workspace-scenario-title">Start with one obvious path</h2>
              <p className="formHint">
                Pick the thing you want to do first. The rest of the workspace stays available below once the main path is clear.
              </p>
            </div>
          </div>
          <div className="workspaceReviewerGrid" data-testid="workspace-scenario-grid">
            {workspaceScenarioCards.map((card) => (
              <article key={card.key} className="workspaceReviewerCard" data-testid={`workspace-scenario-item-${card.key}`}>
                <span>{card.label}</span>
                <strong>{card.title}</strong>
                <p>{card.detail}</p>
                <Link
                  href={card.href}
                  className={card.primary ? "landingButton primaryButton" : "landingButton secondaryButton"}
                  data-testid={`workspace-scenario-action-${card.key}`}
                >
                  {card.actionLabel}
                </Link>
              </article>
            ))}
          </div>
        </article>

        <div className="workspaceBannerStack">
          {error ? <div className="banner error">{error}</div> : null}
          {serversError ? <div className="banner error">{serversError}</div> : null}
          {deleteError ? <div className="banner error">{deleteError}</div> : null}
          {templatesError ? <div className="banner error">{templatesError}</div> : null}
          {templateDeleteError ? <div className="banner error">{templateDeleteError}</div> : null}
          {templateDeployError ? <div className="banner error">{templateDeployError}</div> : null}
          {opsActionError ? <div className="banner error">{opsActionError}</div> : null}
          {opsActionMessage ? <div className="banner success">{opsActionMessage}</div> : null}
          {degradedOpsAttentionItems.length > 0 ? (
            <div className="banner subtle" data-testid="ops-degraded-banner">
              Some workspace signals are in degraded mode right now:{" "}
              {degradedOpsAttentionItems.map((item) => item.title).join(" · ")}.
            </div>
          ) : null}
          {currentUser?.must_change_password ? (
            <div className="banner error">
              You are still using the default admin password.{" "}
              <Link href="/change-password" className="inlineLink">
                Change it now
              </Link>
              .
            </div>
          ) : null}
          <div className="banner subtle" data-testid="workspace-first-pass-banner">
            <strong>New here?</strong> {firstRunContext}
          </div>

          <article className="card formCard workspaceGuidePanel" data-testid="workspace-guide-card">
            <div className="sectionHeader workspaceGuideHeader">
              <div>
                <h2 data-testid="workspace-guide-title">Use the workspace in three simple moves</h2>
                <p className="formHint">
                  Start with the current state, take the next practical action, then open deeper controls only when they are needed.
                </p>
              </div>
            </div>

            <div className="workspaceGuideGrid">
              <div className="stepsGrid workspaceGuideSteps">
                {workspaceGuideCards.map((card) => {
                  const linkClass =
                    card.actionLabel === "Create deployment"
                      ? "landingButton primaryButton"
                      : "landingButton secondaryButton";

                  return (
                    <article key={card.step} className="stepCard workspaceStepCard">
                      <span className="stepNumber">{card.step}</span>
                      <h3>{card.title}</h3>
                      <p>{card.detail}</p>
                      <Link href={card.href} className={linkClass}>
                        {card.actionLabel}
                      </Link>
                    </article>
                  );
                })}
              </div>

              <aside className="workspaceGlancePanel">
                <div className="workspaceGlanceHeader">
                  <span className="eyebrow">At a glance</span>
                  <strong>Current workspace</strong>
                </div>
                <div className="workspaceGlanceList">
                  {workspaceGlanceItems.map((item) => (
                    <div key={item.label} className="workspaceStatusCard workspaceGlanceItem">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                      <p>{item.detail}</p>
                    </div>
                  ))}
                </div>
                <div className="workspaceMetaLine">
                  <span>
                    Backend: <code>{apiBaseUrl}</code>
                  </span>
                  {currentUser ? (
                    <span>
                      Usage {currentUser.usage?.servers ?? 0}/{currentUser.limits?.max_servers ?? 0} servers ·{" "}
                      {currentUser.usage?.deployments ?? 0}/{currentUser.limits?.max_deployments ?? 0} deployments ·{" "}
                      <Link href="/upgrade" className="inlineLink">
                        Upgrade
                      </Link>
                    </span>
                  ) : null}
                  {smokeMode ? (
                    <span data-testid="runtime-smoke-banner">
                      Smoke mode uses fixture data for runtime surfaces.
                    </span>
                  ) : (
                    <span>Deployments and notifications refresh automatically every 8 seconds.</span>
                  )}
                </div>
              </aside>
            </div>

            <div className="workspaceReviewerPanel" data-testid="workspace-reviewer-panel">
              <div className="workspaceReviewerHeader">
                <div>
                  <span className="eyebrow">Reviewer path</span>
                  <strong>See the strongest parts of the product in one short pass</strong>
                </div>
                <span className="workspaceReviewerBadge">60-second route</span>
              </div>
              <div className="workspaceReviewerGrid">
                {reviewerPathItems.map((item) => (
                  <article key={item.label} className="workspaceReviewerCard">
                    <span>{item.label}</span>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                    <Link href={item.href} className="landingButton secondaryButton">
                      {item.actionLabel}
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          </article>
        </div>

        <AdminDisclosureSection
          title="Workspace signals and reports"
          subtitle="Operational totals, attention items, and exportable summaries stay here when you want the full picture."
          badge={workspaceSignalsBadge}
          testId="ops-overview-disclosure"
        >
        <article className="card formCard" data-testid="ops-overview-card">
          <div className="sectionHeader" data-testid="ops-overview-header">
            <div>
              <h2 data-testid="ops-overview-title">Operations overview</h2>
              <p className="formHint">
                High-signal summary, attention items, and export actions built from the current dashboard state.
              </p>
            </div>
          </div>

          <AdminDisclosureSection
            title="Exports and reports"
            subtitle="Copy the current summary or export deployment, server, template, and activity data when you need a handoff or audit artifact."
            badge="Reports"
            testId="ops-overview-exports-disclosure"
          >
            <div className="actions overviewActionRail" data-testid="ops-overview-actions">
              <button type="button" onClick={handleCopyOpsSummary} data-testid="ops-copy-summary-button">
                Copy summary
              </button>
              <button type="button" onClick={handleDownloadSnapshot} data-testid="ops-download-overview-button">
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
                data-testid="ops-export-deployments-button"
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
                data-testid="ops-export-servers-button"
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
                data-testid="ops-export-templates-button"
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
                data-testid="ops-export-activity-button"
              >
                Export activity CSV
              </button>
            </div>
          </AdminDisclosureSection>

          {opsOverviewLoading ? (
            <div className="banner subtle" data-testid="ops-overview-loading-banner">Refreshing server-side operations overview...</div>
          ) : null}

          <div className="overviewGrid" data-testid="ops-overview-grid">
            <div className="overviewCard" data-testid="ops-overview-deployments-card">
              <span className="overviewLabel">Deployments</span>
              <strong className="overviewValue">{opsSnapshot.deployments.total}</strong>
              <div className="overviewMeta">
                <span>Running {opsSnapshot.deployments.running}</span>
                <span>Failed {opsSnapshot.deployments.failed}</span>
                <span>Pending {opsSnapshot.deployments.pending}</span>
                <span>Public URLs {opsSnapshot.deployments.public_urls}</span>
              </div>
            </div>
            <div className="overviewCard" data-testid="ops-overview-servers-card">
              <span className="overviewLabel">Servers</span>
              <strong className="overviewValue">{opsSnapshot.servers.total}</strong>
              <div className="overviewMeta">
                <span>Password auth {opsSnapshot.servers.password_auth}</span>
                <span>SSH key auth {opsSnapshot.servers.ssh_key_auth}</span>
                <span>Unused {opsSnapshot.servers.unused}</span>
              </div>
            </div>
            <div className="overviewCard" data-testid="ops-overview-activity-card">
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
            <div className="overviewCard" data-testid="ops-overview-templates-card">
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
            <div className="overviewCard" data-testid="ops-overview-capabilities-card">
              <span className="overviewLabel">Runtime posture</span>
              <strong className="overviewValue">
                {opsSnapshot.capabilities?.local_docker_enabled ? "mixed" : "remote-only"}
              </strong>
              <div className="overviewMeta">
                <span>
                  Local Docker {opsSnapshot.capabilities?.local_docker_enabled ? "enabled" : "disabled"}
                </span>
                <span>
                  SSH trust {opsSnapshot.capabilities?.ssh_host_key_checking || "accept-new"}
                </span>
                <span>
                  Cred key {opsSnapshot.capabilities?.server_credentials_key_configured ? "configured" : "missing"}
                </span>
              </div>
            </div>
          </div>

          {opsSnapshot.attention_items.length > 0 ? (
            <div className="overviewAttentionList" data-testid="ops-attention-list">
              {opsSnapshot.attention_items.map((item, index) => (
                <div key={`${item.title}-${index}`} className="overviewAttentionItem" data-testid={`ops-attention-item-${index}`}>
                  <div className="overviewAttentionHeader">
                    <span className={`status ${item.level === "info" ? "unknown" : item.level}`}>
                      {item.level}
                    </span>
                    <strong>{item.title}</strong>
                  </div>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="banner subtle" data-testid="ops-attention-empty-banner">No immediate attention items from the current data.</div>
          )}
        </article>
        </AdminDisclosureSection>

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

        {currentUser?.is_admin ? (
        <AdminDisclosureSection
          title="Servers"
          subtitle="Workspace keeps only the overview now. Full server review, diagnostics, and follow-up live in the dedicated surface."
          badge={`${servers.length} targets`}
          testId="servers-disclosure"
        >
        <article className="card formCard" data-testid="servers-card">
          <div className="sectionHeader" data-testid="servers-header">
            <div>
              <h2 data-testid="servers-title">Servers</h2>
              <p className="formHint">
                Keep this block short: use it to understand current server posture, then step into the dedicated review page for real work.
              </p>
            </div>
            <Link href="/app/server-review" className="landingButton secondaryButton">
              Open server review
            </Link>
          </div>
          <div className="list compactList" data-testid="servers-list">
            {serversLoading && servers.length === 0 ? (
              <div className="empty" data-testid="servers-loading-state">Loading servers...</div>
            ) : null}

            {!serversLoading && servers.length === 0 ? (
              <div className="empty" data-testid="servers-empty-state">
                {localDeploymentsEnabled
                  ? "No servers yet. Local deploy is still available."
                  : "No servers yet. This environment is remote-only, so add a server target first."}
              </div>
            ) : null}

            {serverReviewPreviewItems.map((server) => (
              <article className="card compactCard" key={server.id} data-testid={`server-card-${server.id}`}>
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
                <div className="row">
                  <span className="label">Usage</span>
                  <span>
                    {deployments.filter((deployment) => deployment.server_id === server.id).length} linked deployment
                    {deployments.filter((deployment) => deployment.server_id === server.id).length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="actions">
                  <Link href="/app/server-review" className="secondaryButton">
                    Review in dedicated surface
                  </Link>
                </div>
              </article>
            ))}
            {!serversLoading && servers.length > serverReviewPreviewItems.length ? (
              <div className="banner subtle" data-testid="servers-preview-more-banner">
                Showing {serverReviewPreviewItems.length} of {servers.length} targets here. Open Server review for the full queue, diagnostics, and follow-up actions.
              </div>
            ) : null}
          </div>
        </article>
        </AdminDisclosureSection>
        ) : (
          <article className="card formCard" data-testid="servers-card">
            <h2 data-testid="servers-title">Servers</h2>
            <div className="banner subtle" data-testid="servers-restricted-banner">
              Server management is restricted to admin users. Trial accounts can explore
              the dashboard, admin workspaces, saved views, exports, and restore dry-run
              flows without touching shared infrastructure.
            </div>
          </article>
        )}

        <AdminDisclosureSection
          title="Activity history"
          subtitle="Past deploy events and operational messages stay available here without dominating the main workspace."
          badge={`${filteredNotifications.length} items`}
          testId="activity-history-disclosure"
        >
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
        </AdminDisclosureSection>

        <AdminDisclosureSection
          title="Deployment templates"
          subtitle="Reusable presets and previews stay close at hand without competing with the create flow."
          badge={`${templates.length} templates`}
          testId="templates-disclosure"
        >
        <article className="card formCard" data-testid="templates-card">
          <div className="sectionHeader" data-testid="templates-section-header">
            <div>
              <h2 data-testid="templates-section-title">Deployment templates</h2>
              <p className="formHint">
                Save common image, ports, server, and env settings once, then deploy directly or apply them back to the create form.
              </p>
            </div>
          </div>
          <div className="filterTabs historyFilters" role="tablist" aria-label="Template filters" data-testid="templates-filter-tabs">
            <button
              type="button"
              className={templateFilter === "all" ? "active" : ""}
              onClick={() => setTemplateFilter("all")}
              data-testid="templates-filter-all"
            >
              All
            </button>
            <button
              type="button"
              className={templateFilter === "unused" ? "active" : ""}
              onClick={() => setTemplateFilter("unused")}
              data-testid="templates-filter-unused"
            >
              Unused
            </button>
            <button
              type="button"
              className={templateFilter === "recent" ? "active" : ""}
              onClick={() => setTemplateFilter("recent")}
              data-testid="templates-filter-recent"
            >
              Used in 7d
            </button>
            <button
              type="button"
              className={templateFilter === "popular" ? "active" : ""}
              onClick={() => setTemplateFilter("popular")}
              data-testid="templates-filter-popular"
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
              data-testid="templates-search-input"
            />
          </label>

          {templatesLoading ? (
            <div className="empty" data-testid="templates-loading-state">Loading templates...</div>
          ) : filteredTemplates.length === 0 ? (
            <div className="empty" data-testid="templates-empty-state">No templates yet. Save the current create form as your first template.</div>
          ) : (
            <div className="list compactList" data-testid="templates-list">
              {filteredTemplates.map((template) => (
                <div key={template.id} className="card compactCard" data-testid={`template-card-${template.id}`}>
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
                      data-testid={`template-preview-button-${template.id}`}
                    >
                      {templatePreviewId === template.id ? "Hide preview" : "Preview"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeployTemplate(template.id)}
                      disabled={deployingTemplateId === template.id || deploymentLimitReached}
                      data-testid={`template-deploy-button-${template.id}`}
                    >
                      {deployingTemplateId === template.id ? "Deploying..." : "Deploy now"}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyTemplateToForm(template, { startEditing: true })}
                      data-testid={`template-edit-button-${template.id}`}
                    >
                      Edit in form
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateTemplate(template)}
                      disabled={duplicatingTemplateId === template.id}
                      data-testid={`template-duplicate-button-${template.id}`}
                    >
                      {duplicatingTemplateId === template.id ? "Duplicating..." : "Duplicate"}
                    </button>
                    <button
                      type="button"
                      className="dangerButton"
                      onClick={() => handleDeleteTemplate(template.id)}
                      disabled={deletingTemplateId === template.id}
                      data-testid={`template-delete-button-${template.id}`}
                    >
                      {deletingTemplateId === template.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {previewTemplate ? (
            <div className="card compactCard previewCard" data-testid="template-preview-card">
              <div className="sectionHeader" data-testid="template-preview-header">
                <div>
                  <h3 data-testid="template-preview-title">Template preview</h3>
                  <p className="formHint">
                    Review the selected template against the current create form before apply or deploy.
                  </p>
                </div>
              </div>
              {previewDiffRows.length === 0 ? (
                <div className="banner subtle" data-testid="template-preview-match-banner">
                  Current create form already matches "{previewTemplate.template_name}".
                </div>
              ) : (
                <div className="list compactList" data-testid="template-preview-diff-list">
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
              <div className="actions" data-testid="template-preview-actions">
                <button type="button" onClick={() => applyTemplate(previewTemplate)} data-testid="template-preview-apply-button">
                  Apply to form
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplateToForm(previewTemplate, { startEditing: true })}
                  data-testid="template-preview-edit-button"
                >
                  Edit in form
                </button>
                <button
                  type="button"
                  onClick={() => handleDeployTemplate(previewTemplate.id)}
                  disabled={deployingTemplateId === previewTemplate.id || deploymentLimitReached}
                  data-testid="template-preview-deploy-button"
                >
                  {deployingTemplateId === previewTemplate.id ? "Deploying..." : "Deploy from preview"}
                </button>
              </div>
            </div>
          ) : null}

          {templateDeploySuccess ? (
            <div className="banner success inlineBanner" data-testid="template-deploy-success-banner">
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
          {templateDuplicateError ? <div className="banner error" data-testid="template-duplicate-error-banner">{templateDuplicateError}</div> : null}
          {templateDuplicateSuccess ? <div className="banner success" data-testid="template-duplicate-success-banner">{templateDuplicateSuccess}</div> : null}
        </article>
        </AdminDisclosureSection>

        <div
            className="sectionHeader deploymentsHeader"
            data-testid="runtime-deployments-section"
            id="runtime-deployments"
        >
          <div>
            <h2 data-testid="runtime-deployments-title">Deployments</h2>
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

        <div className="list" data-testid="runtime-deployments-list">
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
            <article
              className="card compactCard deploymentCard"
              key={deployment.id}
              data-testid={`runtime-deployment-card-${deployment.id}`}
            >
              <div className="deploymentCardHeader">
                <div>
                  <span className="deploymentCardEyebrow">Deployment</span>
                  <h3>{deployment.container_name || deployment.image || "Unnamed deployment"}</h3>
                  <p>{deployment.server_name ? `${deployment.server_name} (${deployment.server_host})` : "Local target"}</p>
                </div>
                <span className={`status ${deployment.status || "unknown"}`}>
                  {deployment.status || "unknown"}
                </span>
              </div>
              <div className="deploymentCardMetrics">
                <div className="deploymentMetric">
                  <span>Image</span>
                  <strong>{deployment.image || "N/A"}</strong>
                </div>
                <div className="deploymentMetric">
                  <span>Endpoint</span>
                  <strong>{buildDeploymentUrl(deployment) || "Internal only"}</strong>
                </div>
                <div className="deploymentMetric">
                  <span>Ports</span>
                  <strong>
                    {deployment.internal_port || "-"} {"->"} {deployment.external_port || "-"}
                  </strong>
                </div>
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
                <Link
                  href={`/deployments/${deployment.id}`}
                  className="linkButton"
                  data-testid={`runtime-deployment-details-link-${deployment.id}`}
                >
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

        <article className="card formCard" data-testid="create-deployment-card" id="create-deployment">
          <h2 data-testid="create-deployment-title">Create deployment</h2>
          {!localDeploymentsEnabled ? (
            <div className="banner subtle">
              This environment is running in remote-only mode. Local host deployments are disabled.
            </div>
          ) : null}
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
                  : localDeploymentsEnabled
                    ? "For local deploys, choose a free external port if you want direct access."
                    : "Choose a remote server to receive server-specific port suggestions."}
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
                <option value="">
                  {localDeploymentsEnabled ? "Local" : "Choose remote server"}
                </option>
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
                data-testid="create-template-name-input"
              />
              <span className="fieldHint">
                Save the current image, name, ports, server, and env vars as a reusable preset.
              </span>
            </label>

            <div className="formActions">
              <button type="submit" disabled={createDeploymentBlocked} data-testid="create-deployment-submit-button">
                {submitting ? "Creating..." : "Create deployment"}
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={
                  submitting ||
                  templateSubmitting ||
                  !templateName.trim() ||
                  !form.image.trim() ||
                  (!localDeploymentsEnabled && !form.server_id)
                }
                data-testid="create-save-template-button"
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
                <button type="button" className="linkButton" onClick={cancelTemplateEditing} data-testid="create-cancel-template-editing-button">
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
            {form.server_id
              ? "remote server selected"
              : localDeploymentsEnabled
                ? "local target"
                : "remote target required"},{" "}
            {form.internal_port.trim() && form.external_port.trim()
              ? `ports ${form.external_port}:${form.internal_port}`
              : "no port mapping"}.
          </div>
          {templateSubmitError ? <div className="banner error" data-testid="create-template-submit-error-banner">{templateSubmitError}</div> : null}
          {templateSubmitSuccess ? <div className="banner success" data-testid="create-template-submit-success-banner">{templateSubmitSuccess}</div> : null}
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
      </div>
    </main>
  );
}
