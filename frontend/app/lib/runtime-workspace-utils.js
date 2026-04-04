export function formatDate(value) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).formatToParts(date);

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.day}.${lookup.month}.${lookup.year}, ${lookup.hour}:${lookup.minute}:${lookup.second} UTC`;
}

export function buildDeploymentUrl(deployment) {
  if (!deployment?.server_host || !deployment?.external_port) {
    return "";
  }

  return `http://${deployment.server_host}:${deployment.external_port}`;
}

export function formatSuggestedPorts(ports) {
  if (!Array.isArray(ports) || ports.length === 0) {
    return "";
  }

  return ports.join(", ");
}

export function formatServerLabel(serverName, serverHost) {
  return serverName ? `${serverName} (${serverHost})` : "Local";
}

export function formatPortMapping(internalPort, externalPort) {
  if (!internalPort || !externalPort) {
    return "No port mapping";
  }

  return `${externalPort}:${internalPort}`;
}

export function normalizeDraftValue(value) {
  return value === null || value === undefined || value === "" ? "" : String(value);
}

export function buildEnvRowsFromObject(env) {
  return Object.entries(env || {}).length > 0
    ? Object.entries(env || {}).map(([key, value]) => ({
        key,
        value: String(value ?? ""),
      }))
    : [{ key: "", value: "" }];
}

export function countFilledEnvRows(rows) {
  return rows.filter((row) => row.key.trim()).length;
}

export function buildEnvIssues(rows) {
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

export function buildRolloutDraftSummary({
  envRows,
  serverSelected,
  localDeploymentsEnabled,
  internalPort,
  externalPort,
}) {
  const envCount = countFilledEnvRows(envRows);
  const targetText = serverSelected
    ? "remote server selected"
    : localDeploymentsEnabled
      ? "local target"
      : "remote target required";
  const portText =
    internalPort.trim() && externalPort.trim()
      ? `ports ${externalPort}:${internalPort}`
      : "no port mapping";

  return `Current form snapshot: ${envCount} env vars, ${targetText}, ${portText}.`;
}

export function buildReviewConfirmationPhrase(actionLabel, target) {
  if (!actionLabel || !target) {
    return "";
  }

  return `${actionLabel} ${target}`;
}

export function buildReviewIntroText(actionLabel, confirmationPhrase) {
  if (!actionLabel || !confirmationPhrase) {
    return "";
  }

  return `Review the impact below, then type ${confirmationPhrase} to confirm.`;
}

export const rolloutReviewerCopy = {
  shared: {
    obviousPathTitle: "Start with one obvious path",
    obviousPathBody:
      "Pick the main thing you need right now. Go deeper only after the next safe step is already clear.",
    reviewerRouteTitle: "See the strongest product path in one short pass",
    reviewerRouteBadge: "60-second route",
  },
  overview: {
    heroBody:
      "Choose the next rollout path here, then open the dedicated workspace for deeper runtime, template, server, or recovery work.",
    spotlightBody:
      "Use the overview to choose the right path. Do the deeper rollout work inside the dedicated screen for that job.",
    guideTitle: "Use the product in three clear moves",
    guideBody:
      "Read the current state, open the right workspace, then go into admin or recovery only when the main rollout path is already clear.",
    stepOneTitle: "Open the rollout workspace",
    stepOneBody:
      "Creation, template reuse, and live deployment review now live together instead of being mixed into the overview page.",
    stepTwoTitle: "Review the live runtime",
    stepTwoBody:
      "Open the same rollout workspace to review live deployments, then enter one deployment detail page when you need evidence and decisions together.",
    stepThreeTitle: "Open admin or recovery later",
    stepThreeBody:
      "Team access, recovery, and governance still matter, but they no longer compete with the main rollout path on first pass.",
  },
  workflow: {
    heroBody:
      "Use one workspace for create, live review, and template reuse so the rollout path stays readable from start to finish.",
    spotlightBody:
      "This screen keeps rollout creation, live runtime review, and template reuse together so the next practical action stays obvious.",
    mainNextStepTitle: "Follow one rollout path",
    mainNextStepBody:
      "Review the live list first if something is broken. Otherwise create the next deployment or reuse a saved template from the same workspace.",
    stepOneTitle: "Review the current runtime queue",
    stepOneBody:
      "Open a live deployment card when you need status, endpoint, error, and a fast jump into detailed runtime review.",
    stepTwoTitle: "Start the next rollout",
    stepTwoBody:
      "Use the guided create form when you want one obvious path for image, target, ports, env vars, and optional template save.",
    stepThreeTitle: "Reuse or edit rollout defaults",
    stepThreeBody:
      "Saved templates stay in the same workspace so repeat deploys, previews, edits, duplication, and reuse all stay close to the main path.",
  },
  detail: {
    heroBody:
      "Use this page to understand the current runtime, decide on the next safe change, and only then go deeper into handoff or history.",
    spotlightBody:
      "Review the live runtime first, then decide whether to stabilize it, change it, hand it off, or remove it.",
    guideTitle: "Use this runtime page in three clear moves",
    guideBody:
      "Review the live state first, make one deliberate decision next, then open deeper tools only when incident or handoff work needs them.",
    mainNextStepTitle: "Main next safe step",
    mainNextStepBody:
      "This page is strongest when it makes the next safe action obvious before you open diagnostics, logs, exports, or destructive tools.",
  },
};

export function normalizeDeploymentActionError(message, fallbackMessage) {
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

export function normalizeCreateDeploymentError(message) {
  return normalizeDeploymentActionError(
    message,
    "Failed to create deployment. Please try again.",
  );
}

export async function readJsonOrError(response, fallbackMessage) {
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

export async function readErrorMessageFromResponse(response, fallbackMessage) {
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

export function buildTemplateDiff(template, currentDraft, servers) {
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

export function isRecentDate(value, days = 7) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
}

export function buildOpsSnapshot({ currentUser, deployments, servers, notifications, templates }) {
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
      title: `${errorNotifications.length} recent error notification${errorNotifications.length === 1 ? "" : "s"}`,
      detail: recentError?.title || "Review recent runtime errors before more changes.",
    });
  }

  if (servers.length === 0) {
    attentionItems.push({
      level: "info",
      title: "No saved server targets yet",
      detail: currentUser?.is_admin
        ? "Open server review before the next remote rollout."
        : "Ask an admin to add a rollout target before the next remote deployment.",
    });
  }

  if (unusedTemplates.length > 0) {
    attentionItems.push({
      level: "info",
      title: `${unusedTemplates.length} template${unusedTemplates.length === 1 ? "" : "s"} never used`,
      detail: "Review templates to keep the next rollout path intentional.",
    });
  }

  if (
    runningDeployments.some(
      (deployment) =>
        deployment.external_port === null || deployment.external_port === undefined,
    )
  ) {
    attentionItems.push({
      level: "warn",
      title: "Some running deployments have no external port",
      detail: "Review runtime detail if one of them should be publicly reachable.",
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
    capabilities: {
      local_docker_enabled: process.env.NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED !== "0",
      ssh_host_key_checking: process.env.NEXT_PUBLIC_SSH_HOST_KEY_CHECKING || "accept-new",
      server_credentials_key_configured: Boolean(
        process.env.NEXT_PUBLIC_SERVER_CREDENTIALS_KEY_CONFIGURED,
      ),
    },
    attention_items: attentionItems,
  };
}

export function buildOpsSummaryText(snapshot) {
  const lines = [
    `Generated: ${snapshot.generated_at || "N/A"}`,
    snapshot.user
      ? `User: ${snapshot.user.username} (${snapshot.user.role}, ${snapshot.user.plan})`
      : "User: unavailable",
    `Deployments: ${snapshot.deployments.total} total, ${snapshot.deployments.running} running, ${snapshot.deployments.failed} failed, ${snapshot.deployments.pending} pending`,
    `Targets: ${snapshot.deployments.local} local, ${snapshot.deployments.remote} remote, ${snapshot.deployments.exposed} exposed, ${snapshot.deployments.public_urls} public URLs`,
    `Servers: ${snapshot.servers.total} total, ${snapshot.servers.ssh_key_auth} SSH key, ${snapshot.servers.password_auth} password, ${snapshot.servers.unused} unused`,
    `Notifications: ${snapshot.notifications.total} total, ${snapshot.notifications.error} errors, ${snapshot.notifications.success} success`,
    `Templates: ${snapshot.templates.total} total, ${snapshot.templates.unused} unused, ${snapshot.templates.recently_used} used in last 7 days`,
  ];

  if (snapshot.templates.top_template_name) {
    lines.push(
      `Top template: ${snapshot.templates.top_template_name} (${snapshot.templates.top_template_use_count} uses)`,
    );
  }

  if (Array.isArray(snapshot.attention_items) && snapshot.attention_items.length > 0) {
    lines.push("");
    lines.push("Attention:");
    snapshot.attention_items.forEach((item) => {
      lines.push(`- [${item.level}] ${item.title}: ${item.detail}`);
    });
  }

  return lines.join("\n");
}

export function triggerFileDownload(filename, blob) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export function downloadJsonFile(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  triggerFileDownload(filename, blob);
}
