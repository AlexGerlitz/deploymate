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

export function formatAccessibleServerLabel({
  canAccessServers,
  serverName,
  serverHost,
  serverId,
  localLabel = "Local",
  managedLabel = "Managed by an admin",
}) {
  if (canAccessServers) {
    if (serverName) {
      return formatServerLabel(serverName, serverHost);
    }

    if (serverId) {
      return serverId;
    }
  }

  return serverId ? managedLabel : localLabel;
}

function redactRuntimeInventoryText(value, sensitiveValues) {
  if (typeof value !== "string" || sensitiveValues.length === 0) {
    return value;
  }

  return sensitiveValues.reduce(
    (current, sensitiveValue) => current.split(sensitiveValue).join("admin-managed target"),
    value,
  );
}

function redactRuntimeInventoryObject(value, sensitiveValues) {
  if (Array.isArray(value)) {
    return value.map((item) => redactRuntimeInventoryObject(item, sensitiveValues));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        redactRuntimeInventoryObject(item, sensitiveValues),
      ]),
    );
  }

  return redactRuntimeInventoryText(value, sensitiveValues);
}

function buildRuntimeInventorySensitiveValues(deployment, diagnostics) {
  return [
    deployment?.server_name,
    deployment?.server_id,
    diagnostics?.server_target,
  ]
    .filter(Boolean)
    .map((value) => String(value))
    .sort((left, right) => right.length - left.length);
}

function sanitizeRuntimeDeploymentForExport(deployment, sensitiveValues) {
  if (!deployment) {
    return null;
  }

  const { server_id: serverId, server_name: _serverName, server_host: _serverHost, ...safeDeployment } = deployment;
  return {
    ...redactRuntimeInventoryObject(safeDeployment, sensitiveValues),
    target: serverId ? "Managed by an admin" : "Local",
  };
}

function sanitizeRuntimeDiagnosticsForExport(diagnostics, deployment, sensitiveValues) {
  if (!diagnostics) {
    return null;
  }

  return {
    ...redactRuntimeInventoryObject(diagnostics, sensitiveValues),
    server_target: deployment?.server_id ? "Managed by an admin" : null,
  };
}

export function buildAccessControlledRuntimeExportPayload({
  deployment,
  health,
  diagnostics,
  activity,
  attentionItems,
  suggestedPorts,
  canAccessServers,
}) {
  if (canAccessServers) {
    return {
      deployment,
      health,
      diagnostics,
      activity: Array.isArray(activity) ? activity : [],
      attentionItems: Array.isArray(attentionItems) ? attentionItems : [],
      suggestedPorts: Array.isArray(suggestedPorts) ? suggestedPorts : [],
    };
  }

  const sensitiveValues = buildRuntimeInventorySensitiveValues(deployment, diagnostics);

  return {
    deployment: sanitizeRuntimeDeploymentForExport(deployment, sensitiveValues),
    health: redactRuntimeInventoryObject(health || null, sensitiveValues),
    diagnostics: sanitizeRuntimeDiagnosticsForExport(diagnostics, deployment, sensitiveValues),
    activity: redactRuntimeInventoryObject(Array.isArray(activity) ? activity : [], sensitiveValues),
    attentionItems: redactRuntimeInventoryObject(
      Array.isArray(attentionItems) ? attentionItems : [],
      sensitiveValues,
    ),
    suggestedPorts: [],
  };
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

export function buildOverviewPrimaryPath({
  isAdmin,
  localDeploymentsEnabled,
  deploymentsTotal,
  failedDeployments,
  serversTotal,
}) {
  if (failedDeployments > 0) {
    return {
      href: "/app/deployment-workflow",
      label: "Review deployments",
      title: "Review the live runtime first",
      detail:
        "A rollout already needs attention, so the main path is the deployment workspace and one focused runtime review before more changes.",
      reason: "incident",
    };
  }

  if (isAdmin && serversTotal === 0) {
    return {
      href: "/app/server-review",
      label: "Add first server target",
      title: "Connect the first server",
      detail:
        "Start in Server Review so DeployMate can confirm one saved target before the first remote rollout path becomes the main story.",
      reason: "server-setup",
    };
  }

  if (!isAdmin && !localDeploymentsEnabled && deploymentsTotal === 0) {
    return {
      href: "/app/deployment-workflow",
      label: "See what opens next",
      title: "Wait for the server target",
      detail:
        "An admin still needs to confirm one saved server target before the first remote deployment can start here.",
      reason: "admin-target-needed",
    };
  }

  if (deploymentsTotal === 0) {
    return {
      href: "/app/deployment-workflow",
      label: "Launch first deployment",
      title: "Start the first deployment",
      detail:
        "Open the deployment workspace and use the guided create path so image, target, ports, and env vars stay in one obvious lane.",
      reason: "first-deploy",
    };
  }

  return {
    href: "/app/deployment-workflow",
    label: "Open deployment workflow",
    title: "Start the next rollout",
    detail:
      "The deployment workspace remains the shortest path for live review, template reuse, and the next deliberate rollout.",
    reason: "steady-state",
  };
}

export function buildDeploymentWorkflowState({
  isAdmin,
  localDeploymentsEnabled,
  deploymentsTotal,
  failedDeployments,
  serversTotal,
}) {
  if (failedDeployments > 0) {
    return {
      mode: "live",
      title: "Review the failed rollout first",
      detail:
        "One deployment already needs attention, so the clearest next step is opening the live queue and drilling into the affected runtime before making more changes.",
      href: "#runtime-deployments",
      actionLabel: "Open live deployments",
      bannerTone: "warning",
      blocker: false,
    };
  }

  if (!localDeploymentsEnabled && isAdmin && serversTotal === 0) {
    return {
      mode: "prerequisite",
      title: "Connect a server before the first rollout",
      detail:
        "This environment is remote-only, so the first useful step is saving one server target in Server Review before opening the guided deploy form.",
      href: "/app/server-review",
      actionLabel: "Open server review",
      bannerTone: "blocking",
      blocker: true,
    };
  }

  if (deploymentsTotal === 0) {
    return {
      mode: "create",
      title: "Start the first deployment",
      detail:
        "If you came here to make something work, the main path is the guided create form below. It keeps image, target, ports, env vars, and template save in one place.",
      href: "#create-deployment",
      actionLabel: "Create deployment",
      bannerTone: "first-run",
      blocker: false,
    };
  }

  return {
    mode: "create",
    title: "Start the next rollout",
    detail:
      "Use the guided create form for the next deliberate rollout, and keep live review nearby when you need to verify current runtime first.",
    href: "#create-deployment",
    actionLabel: "Create deployment",
    bannerTone: "steady-state",
    blocker: false,
  };
}

export function buildServerReviewNextStep({
  hasServers,
  selectedItem,
  readyCount,
  authCount,
  diagnosticsCount,
  filteredCount,
}) {
  if (!hasServers) {
    return {
      focus: "First server target is still missing",
      nextStep:
        "Add one SSH server target, then run a connection test or diagnostics pass so DeployMate can tell you whether remote rollout is actually ready.",
      primaryAction: "Jump to add server form",
      secondaryAction: "",
      tone: "warn",
    };
  }

  if (!selectedItem) {
    return {
      focus: "Choose one saved target",
      nextStep:
        "Focus one server from the live queue and remove uncertainty there before using bulk tools, exports, or edits.",
      primaryAction: "Focus live server queue",
      secondaryAction: "",
      tone: "info",
    };
  }

  if (selectedItem.segment === "ready") {
    return {
      focus: `${selectedItem.label} is ready for rollout work`,
      nextStep:
        "Open Deployment Workflow while this server is already understood, and use it as the target for the next deliberate rollout.",
      primaryAction: "Open deployment workflow",
      secondaryAction: "Copy next step",
      tone: "healthy",
    };
  }

  if (selectedItem.segment === "auth") {
    return {
      focus: `${selectedItem.label} still needs auth review`,
      nextStep:
        "Fix the SSH credential path or replace the key before trusting diagnostics or using this target for a rollout.",
      primaryAction: "Edit selected server",
      secondaryAction: "Copy next step",
      tone: "error",
    };
  }

  if (selectedItem.testResult?.status === "error") {
    return {
      focus: `${selectedItem.label} failed the latest connectivity check`,
      nextStep:
        "Run diagnostics to get a fuller picture, then decide whether the target is recoverable or should stay out of the rollout path for now.",
      primaryAction: "Run diagnostics",
      secondaryAction: "Copy next step",
      tone: "error",
    };
  }

  return {
    focus:
      filteredCount === 1
        ? `${selectedItem.label} is the current review target`
        : `${selectedItem.label} is the current review focus`,
    nextStep:
      readyCount > 0
        ? `At least ${readyCount} server target${readyCount === 1 ? " is" : "s are"} already ready. Remove uncertainty on this one next, then move into Deployment Workflow.`
        : authCount > 0
          ? `There ${authCount === 1 ? "is" : "are"} ${authCount} auth-review target${authCount === 1 ? "" : "s"} visible. Use diagnostics or a connection test here before deciding what is actually ready.`
          : `Use diagnostics or a connection test on this target now. ${diagnosticsCount} visible server target${diagnosticsCount === 1 ? " is" : "s are"} still waiting on deeper review.`,
    primaryAction: selectedItem.segment === "diagnostics" ? "Run diagnostics" : "Test connection",
    secondaryAction: "Copy next step",
    tone: "warn",
  };
}

export function buildDeploymentWorkflowNextStep({
  workflowState,
  localDeploymentsEnabled,
  deploymentLimitReached,
  filteredDeployments,
  templatesCount,
  serversCount,
  form,
  templateName,
  templateFormPreflight,
}) {
  if (workflowState.mode === "prerequisite") {
    return {
      focus: "Remote rollout is blocked on server setup",
      nextStep:
        "Open Server Review, save one target, and run one connectivity check there before treating deployment creation as the main path.",
      primaryAction: "Open server review",
      secondaryAction: "Copy next step",
      tone: "error",
    };
  }

  const failedDeployment =
    filteredDeployments.find((deployment) => deployment.status === "failed") ||
    null;
  const rolloutDraftStarted =
    form.image.trim() ||
    form.name.trim() ||
    form.internal_port.trim() ||
    form.external_port.trim() ||
    templateName.trim();

  if (failedDeployment) {
    return {
      focus: `${failedDeployment.container_name || failedDeployment.image || "Failed deployment"} needs review`,
      nextStep:
        "Open the focused runtime card or deployment detail first, understand the failure, and only then decide whether another rollout is actually safe.",
      primaryAction: "Open live deployments",
      secondaryAction: "Copy next step",
      tone: "error",
    };
  }

  if (deploymentLimitReached) {
    return {
      focus: "Deployment limit reached",
      nextStep:
        "Free capacity or upgrade the current plan before trying to create another deployment from this workspace.",
      primaryAction: "Review live deployments",
      secondaryAction: "Copy next step",
      tone: "error",
    };
  }

  if (form.server_id && filteredDeployments.length === 0 && !rolloutDraftStarted) {
    return {
      focus: "Start the first deployment",
      nextStep:
        "Step 1 is already done for the selected server. Set the image first and keep saved setups or live review secondary until the first deployment exists.",
      primaryAction: "Create deployment",
      secondaryAction: "Copy next step",
      tone: "info",
    };
  }

  if (templateFormPreflight.errors.length > 0) {
    return {
      focus: "Current rollout draft is blocked",
      nextStep: templateFormPreflight.errors[0],
      primaryAction: "Fix the create form",
      secondaryAction: "Copy next step",
      tone: "warn",
    };
  }

  if (form.image.trim()) {
    return {
      focus: "Current rollout draft is ready for a deliberate check",
      nextStep:
        !localDeploymentsEnabled && !form.server_id
          ? "Choose a saved remote server target, then create the deployment or save the draft as a reusable template."
          : templateName.trim()
            ? `Image is set and template name "${templateName.trim()}" is ready. Create the deployment now or save this exact draft as a reusable template.`
            : "Image is set. Create the deployment now if defaults are enough, or open advanced setup only for ports, env vars, target selection, or template save.",
      primaryAction: "Create deployment",
      secondaryAction: templatesCount > 0 ? "Review templates" : "Copy next step",
      tone: "healthy",
    };
  }

  if (templatesCount > 0) {
    return {
      focus: "Template reuse is ready",
      nextStep:
        "Open the templates lane if you want a faster repeat rollout, or set a fresh image in the create form when this deploy should start from scratch.",
      primaryAction: "Open templates",
      secondaryAction: "Copy next step",
      tone: "info",
    };
  }

  return {
    focus:
      serversCount > 0
        ? "First rollout path is open"
        : localDeploymentsEnabled
          ? "Local rollout path is open"
          : "Start with one clear rollout draft",
    nextStep:
      serversCount > 0
        ? "Set the image first, then use the guided form to choose target, ports, env vars, and optional template save without leaving this workspace."
        : "Set the image first so the main rollout path becomes concrete. Everything else can stay closed until the deployment idea is real.",
    primaryAction: "Create deployment",
    secondaryAction: "Copy next step",
    tone: "info",
  };
}

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
      ssh_host_key_checking: process.env.NEXT_PUBLIC_SSH_HOST_KEY_CHECKING || "yes",
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
