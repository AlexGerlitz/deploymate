import { escapeCsvCell } from "./admin-page-utils.js";

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
  if (deployment?.custom_domain) {
    return `${deployment.tls_enabled ? "https" : "http"}://${deployment.custom_domain}`;
  }

  if (!deployment?.server_host || !deployment?.external_port) {
    return "";
  }

  return `http://${deployment.server_host}:${deployment.external_port}`;
}

export function buildDeploymentReviewTarget(deployment) {
  const publicUrl = buildDeploymentUrl(deployment);

  if (!publicUrl && deployment?.health_target) {
    return {
      href: deployment.health_target,
      kind: "health",
    };
  }

  if (publicUrl) {
    return {
      href: publicUrl,
      kind: "app",
    };
  }

  return {
    href: "",
    kind: "runtime",
  };
}

export function normalizeCustomDomainValue(value) {
  return String(value || "").trim().toLowerCase().replace(/\.$/, "");
}

export function buildCustomDomainIssues(domain, tlsEnabled) {
  const normalizedDomain = normalizeCustomDomainValue(domain);
  const issues = [];

  if (tlsEnabled && !normalizedDomain) {
    issues.push("Enable HTTPS only after setting a custom domain.");
  }

  if (!normalizedDomain) {
    return issues;
  }

  if (normalizedDomain.includes("://") || normalizedDomain.includes("/") || /\s/.test(normalizedDomain)) {
    issues.push("Custom domain must be a hostname like app.example.com.");
    return issues;
  }

  const hostnamePattern =
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

  if (!hostnamePattern.test(normalizedDomain)) {
    issues.push("Custom domain must contain only valid hostname labels.");
  }

  return issues;
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
  serverManagedByAdmin = false,
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

  return serverId || serverManagedByAdmin ? managedLabel : localLabel;
}

export function formatReleaseSourceLabel(source) {
  if (!source) {
    return "manual";
  }
  return source.replaceAll("_", " ");
}

export function formatCommitShort(commit) {
  if (!commit) {
    return "-";
  }
  return String(commit).slice(0, 12);
}

export function buildReleaseTraceLine(deployment) {
  if (!deployment) {
    return "Release trace: n/a";
  }

  const parts = [`source ${formatReleaseSourceLabel(deployment.release_source)}`];
  if (deployment.release_ref) {
    parts.push(`ref ${deployment.release_ref}`);
  }
  if (deployment.release_commit_sha) {
    parts.push(`commit ${formatCommitShort(deployment.release_commit_sha)}`);
  }
  if (deployment.release_image_tag) {
    parts.push(`tag ${deployment.release_image_tag}`);
  }
  if (deployment.release_triggered_by) {
    parts.push(`by ${deployment.release_triggered_by}`);
  }
  return `Release trace: ${parts.join(", ")}`;
}

export function buildRuntimeOwnershipExportRecord(ownershipSummary) {
  const value = String(ownershipSummary?.value || "").trim() || "Unknown";
  const detail =
    String(ownershipSummary?.detail || "").trim() || "Ownership is not available yet.";

  return {
    value,
    detail,
  };
}

export function buildRuntimeReviewTargetExportRecord(reviewTarget) {
  const kind = reviewTarget?.kind === "health" ? "health" : reviewTarget?.kind === "app" ? "app" : "runtime";
  const href = String(reviewTarget?.href || "").trim();

  if (kind === "health") {
    return {
      kind,
      value: href ? "Saved health target" : "Health target missing",
      href,
      detail: href
        ? "Open the saved health target first, then confirm health and recent activity."
        : "No health target is saved yet. Review runtime signals on the detail page first.",
    };
  }

  if (kind === "app") {
    return {
      kind,
      value: href ? "Live endpoint" : "Private runtime",
      href,
      detail: href
        ? "Open the live endpoint first, then confirm health and recent activity."
        : "No public URL is assigned yet. Review runtime signals on the detail page first.",
    };
  }

  return {
    kind: "runtime",
    value: "Runtime detail only",
    href: "",
    detail: "No external review target is available yet. Review runtime signals on the detail page first.",
  };
}

export function buildRuntimeIdentityExportRecord(
  deployment,
  { locationSummary = "" } = {},
) {
  if (!deployment) {
    return {
      value: "Deployment pending",
      detail: "Runtime identity is not available yet.",
      runtime_shape: "",
      image: "",
      container_name: "",
      stack_name: "",
      primary_service: "",
      location: "",
    };
  }

  const isStack = deployment.runtime_shape === "stack";
  const value = isStack
    ? deployment.stack_name || deployment.container_name || deployment.id || "Stack pending"
    : deployment.container_name || deployment.image || deployment.id || "Deployment pending";
  const detailBase = isStack
    ? `Primary service ${deployment.primary_service || deployment.container_name || "unknown"}. Compose-backed stack runtime.`
    : `${deployment.image || "Image pending"} is the current runtime source.`;

  return {
    value: String(value),
    detail: [detailBase, String(locationSummary || "").trim()].filter(Boolean).join(" "),
    runtime_shape: String(deployment.runtime_shape || "single"),
    image: String(deployment.image || ""),
    container_name: String(deployment.container_name || ""),
    stack_name: String(deployment.stack_name || ""),
    primary_service: String(deployment.primary_service || ""),
    location: String(locationSummary || "").trim(),
  };
}

export function buildRuntimeRecentActivityExportRecord(activityItems) {
  const latestEvent =
    Array.isArray(activityItems) && activityItems.length > 0 ? activityItems[0] : null;

  if (!latestEvent) {
    return {
      value: "No activity yet",
      detail: "No runtime activity has been recorded yet.",
      created_at: "",
      level: "",
      category: "",
      title: "",
      message: "",
    };
  }

  return {
    value: String(latestEvent.title || "Recent runtime event"),
    detail: [
      latestEvent.message || "Most recent runtime event recorded.",
      latestEvent.created_at ? `Logged ${formatDate(latestEvent.created_at)}.` : null,
    ]
      .filter(Boolean)
      .join(" "),
    created_at: String(latestEvent.created_at || ""),
    level: String(latestEvent.level || ""),
    category: String(latestEvent.category || ""),
    title: String(latestEvent.title || ""),
    message: String(latestEvent.message || ""),
  };
}

export function buildRuntimeActivityTrailExportRecord(activityItems) {
  const items = Array.isArray(activityItems) ? activityItems : [];
  const latestEvent = items[0] || null;
  const latestProblem =
    latestEvent?.level === "error" || latestEvent?.level === "warn"
      ? latestEvent
      : items.find((item) => item?.level === "error" || item?.level === "warn") || null;
  const latestSuccess =
    latestEvent?.level === "success"
      ? null
      : items.find((item) => item?.level === "success") || null;
  const errorCount = items.filter((item) => item?.level === "error").length;
  const warnCount = items.filter((item) => item?.level === "warn").length;
  const successCount = items.filter((item) => item?.level === "success").length;
  const totalCount = items.length;

  if (totalCount === 0) {
    return {
      value: "No activity trail yet",
      detail: "No runtime activity has been recorded yet.",
      total_count: "0",
      error_count: "0",
      warn_count: "0",
      success_count: "0",
      latest_title: "",
      latest_level: "",
      latest_created_at: "",
      latest_problem_title: "",
      latest_problem_created_at: "",
      latest_success_title: "",
      latest_success_created_at: "",
    };
  }

  const counts = [];
  if (errorCount > 0) {
    counts.push(`${errorCount} error${errorCount === 1 ? "" : "s"}`);
  }
  if (warnCount > 0) {
    counts.push(`${warnCount} warning${warnCount === 1 ? "" : "s"}`);
  }
  if (successCount > 0) {
    counts.push(`${successCount} success${successCount === 1 ? "" : "es"}`);
  }

  const detailParts = [
    latestEvent?.title
      ? `Latest: ${latestEvent.title}${latestEvent.created_at ? ` at ${formatDate(latestEvent.created_at)}` : ""}.`
      : null,
    latestProblem && latestProblem.id !== latestEvent?.id
      ? `Last problem: ${latestProblem.title || "Runtime warning"}${
          latestProblem.created_at ? ` at ${formatDate(latestProblem.created_at)}` : ""
        }.`
      : null,
    latestSuccess
      ? `Last success: ${latestSuccess.title || "Runtime success"}${
          latestSuccess.created_at ? ` at ${formatDate(latestSuccess.created_at)}` : ""
        }.`
      : null,
  ].filter(Boolean);

  return {
    value: `${totalCount} event${totalCount === 1 ? "" : "s"}${
      counts.length > 0 ? `, ${counts.join(", ")}` : ""
    }`,
    detail: detailParts.join(" "),
    total_count: String(totalCount),
    error_count: String(errorCount),
    warn_count: String(warnCount),
    success_count: String(successCount),
    latest_title: String(latestEvent?.title || ""),
    latest_level: String(latestEvent?.level || ""),
    latest_created_at: String(latestEvent?.created_at || ""),
    latest_problem_title: String(latestProblem?.title || ""),
    latest_problem_created_at: String(latestProblem?.created_at || ""),
    latest_success_title: String(latestSuccess?.title || ""),
    latest_success_created_at: String(latestSuccess?.created_at || ""),
  };
}

export function buildRuntimeAttentionExportRecord(attentionItems) {
  const items = Array.isArray(attentionItems) ? attentionItems : [];
  const primaryItem = items[0] || null;
  const errorCount = items.filter((item) => item?.status === "error").length;
  const warnCount = items.filter((item) => item?.status === "warn").length;
  const totalCount = items.length;

  if (totalCount === 0) {
    return {
      value: "0 active warnings",
      detail: "No active runtime warnings right now.",
      total_count: "0",
      error_count: "0",
      warn_count: "0",
      primary_label: "",
      primary_message: "",
    };
  }

  let value = `${totalCount} attention item${totalCount === 1 ? "" : "s"}`;
  if (errorCount > 0 && warnCount > 0) {
    value = `${errorCount} error${errorCount === 1 ? "" : "s"}, ${warnCount} warning${warnCount === 1 ? "" : "s"}`;
  } else if (errorCount > 0) {
    value = `${errorCount} error${errorCount === 1 ? "" : "s"}`;
  } else if (warnCount > 0) {
    value = `${warnCount} warning${warnCount === 1 ? "" : "s"}`;
  }

  return {
    value,
    detail: primaryItem
      ? `${primaryItem.label || "Runtime attention"}: ${primaryItem.message || "Attention is needed."}`
      : `${totalCount} runtime attention item${totalCount === 1 ? "" : "s"} need review.`,
    total_count: String(totalCount),
    error_count: String(errorCount),
    warn_count: String(warnCount),
    primary_label: String(primaryItem?.label || ""),
    primary_message: String(primaryItem?.message || ""),
  };
}

export function buildRuntimeNextStepExportRecord(primaryAction, nextStep) {
  const value = String(primaryAction || "").trim() || "Review runtime";
  const detail = String(nextStep || "").trim() || "Review the runtime before making the next change.";

  return {
    value,
    detail,
  };
}

export function buildRuntimeHealthProofExportRecord(health, reviewTarget = null) {
  const value = String(health?.status || "").trim() || "unknown";
  const checkedAt = String(health?.checked_at || "").trim();
  const reviewTargetHref = String(reviewTarget?.href || "").trim();
  const error = String(health?.error || "").trim();
  const hasStatusCode = health?.status_code || health?.status_code === 0;
  const hasResponseTime = health?.response_time_ms || health?.response_time_ms === 0;

  if (checkedAt) {
    const clauses = [`Checked ${formatDate(checkedAt)}`];
    if (hasStatusCode) {
      clauses.push(`with HTTP ${health.status_code}`);
    }
    if (hasResponseTime) {
      clauses.push(`in ${health.response_time_ms} ms`);
    }

    return {
      value,
      detail: `${clauses.join(" ")}.${error ? ` Latest error: ${error}.` : ""}`,
      checked_at: checkedAt,
      status_code: hasStatusCode ? String(health.status_code) : "",
      response_time_ms: hasResponseTime ? String(health.response_time_ms) : "",
      error,
    };
  }

  return {
    value,
    detail: reviewTargetHref
      ? `Saved review target: ${reviewTargetHref}. No completed health check yet.`
      : "No completed health check has been recorded yet.",
    checked_at: "",
    status_code: hasStatusCode ? String(health.status_code) : "",
    response_time_ms: hasResponseTime ? String(health.response_time_ms) : "",
    error,
  };
}

export function buildRuntimeReleaseTraceExportRecord(deployment) {
  if (!deployment) {
    return {
      value: "n/a",
      detail: "Release source and rollout metadata are not available yet.",
      source: "",
      ref: "",
      commit_sha: "",
      image_tag: "",
      triggered_at: "",
      triggered_by: "",
    };
  }

  const hasExtraTrace =
    Boolean(deployment.release_ref) ||
    Boolean(deployment.release_commit_sha) ||
    Boolean(deployment.release_image_tag) ||
    Boolean(deployment.release_triggered_by) ||
    Boolean(deployment.release_triggered_at);

  return {
    value: buildReleaseTraceLine(deployment).replace("Release trace: ", ""),
    detail: deployment.release_triggered_at
      ? `Triggered ${formatDate(deployment.release_triggered_at)}.`
      : hasExtraTrace
        ? "The current runtime has partial release metadata but no recorded trigger time."
        : "No saved ref, commit, image tag, or trigger time for the current runtime yet.",
    source: String(deployment.release_source || "manual"),
    ref: String(deployment.release_ref || ""),
    commit_sha: String(deployment.release_commit_sha || ""),
    image_tag: String(deployment.release_image_tag || ""),
    triggered_at: String(deployment.release_triggered_at || ""),
    triggered_by: String(deployment.release_triggered_by || ""),
  };
}

export function buildActivityExportCsv(
  items,
  {
    deploymentId = "",
    deployment = null,
    identityRecord = null,
    recentActivityRecord = null,
    activityTrailRecord = null,
    attentionRecord = null,
    nextStepRecord = null,
    health = null,
    ownershipSummary = null,
    reviewTarget = null,
  } = {},
) {
  const runtimeIdentity = identityRecord || buildRuntimeIdentityExportRecord(deployment);
  const recentActivity = recentActivityRecord || buildRuntimeRecentActivityExportRecord(items);
  const activityTrail = activityTrailRecord || buildRuntimeActivityTrailExportRecord(items);
  const attentionCue = attentionRecord || buildRuntimeAttentionExportRecord(items);
  const nextStepCue = nextStepRecord || buildRuntimeNextStepExportRecord("", "");
  const ownership = buildRuntimeOwnershipExportRecord(ownershipSummary);
  const normalizedReviewTarget = buildRuntimeReviewTargetExportRecord(reviewTarget);
  const healthProof = buildRuntimeHealthProofExportRecord(health, reviewTarget);
  const releaseTrace = buildRuntimeReleaseTraceExportRecord(deployment);
  const rows = [
    [
      "deployment_id",
      "runtime_identity_value",
      "runtime_identity_detail",
      "runtime_shape",
      "runtime_image",
      "runtime_container_name",
      "runtime_stack_name",
      "runtime_primary_service",
      "runtime_location",
      "recent_activity_value",
      "recent_activity_detail",
      "recent_activity_created_at",
      "recent_activity_level",
      "recent_activity_category",
      "recent_activity_title",
      "recent_activity_message",
      "activity_trail_value",
      "activity_trail_detail",
      "activity_trail_total_count",
      "activity_trail_error_count",
      "activity_trail_warn_count",
      "activity_trail_success_count",
      "activity_trail_latest_title",
      "activity_trail_latest_level",
      "activity_trail_latest_created_at",
      "activity_trail_latest_problem_title",
      "activity_trail_latest_problem_created_at",
      "activity_trail_latest_success_title",
      "activity_trail_latest_success_created_at",
      "attention_cue_value",
      "attention_cue_detail",
      "attention_total_count",
      "attention_error_count",
      "attention_warn_count",
      "attention_primary_label",
      "attention_primary_message",
      "next_step_value",
      "next_step_detail",
      "ownership_status",
      "ownership_detail",
      "review_target_kind",
      "review_target_status",
      "review_target_href",
      "review_target_detail",
      "health_proof_status",
      "health_proof_detail",
      "health_checked_at",
      "health_status_code",
      "health_response_time_ms",
      "health_error",
      "release_trace_summary",
      "release_trace_detail",
      "release_source",
      "release_ref",
      "release_commit_sha",
      "release_image_tag",
      "release_triggered_at",
      "release_triggered_by",
      "created_at",
      "level",
      "category",
      "title",
      "message",
    ],
    ...(Array.isArray(items) ? items : []).map((item) => [
      item.deployment_id || deploymentId || "",
      runtimeIdentity.value,
      runtimeIdentity.detail,
      runtimeIdentity.runtime_shape,
      runtimeIdentity.image,
      runtimeIdentity.container_name,
      runtimeIdentity.stack_name,
      runtimeIdentity.primary_service,
      runtimeIdentity.location,
      recentActivity.value,
      recentActivity.detail,
      recentActivity.created_at,
      recentActivity.level,
      recentActivity.category,
      recentActivity.title,
      recentActivity.message,
      activityTrail.value,
      activityTrail.detail,
      activityTrail.total_count,
      activityTrail.error_count,
      activityTrail.warn_count,
      activityTrail.success_count,
      activityTrail.latest_title,
      activityTrail.latest_level,
      activityTrail.latest_created_at,
      activityTrail.latest_problem_title,
      activityTrail.latest_problem_created_at,
      activityTrail.latest_success_title,
      activityTrail.latest_success_created_at,
      attentionCue.value,
      attentionCue.detail,
      attentionCue.total_count,
      attentionCue.error_count,
      attentionCue.warn_count,
      attentionCue.primary_label,
      attentionCue.primary_message,
      nextStepCue.value,
      nextStepCue.detail,
      ownership.value,
      ownership.detail,
      normalizedReviewTarget.kind,
      normalizedReviewTarget.value,
      normalizedReviewTarget.href,
      normalizedReviewTarget.detail,
      healthProof.value,
      healthProof.detail,
      healthProof.checked_at,
      healthProof.status_code,
      healthProof.response_time_ms,
      healthProof.error,
      releaseTrace.value,
      releaseTrace.detail,
      releaseTrace.source,
      releaseTrace.ref,
      releaseTrace.commit_sha,
      releaseTrace.image_tag,
      releaseTrace.triggered_at,
      releaseTrace.triggered_by,
      item.created_at || "",
      item.level || "",
      item.category || "",
      item.title || "",
      item.message || "",
    ]),
  ];

  return rows
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n");
}

export function buildIncidentSnapshotPayload({
  deployment,
  health,
  exportPayload,
  identityRecord,
  recentActivityRecord,
  activityTrailRecord,
  attentionRecord,
  nextStepRecord,
  ownershipSummary,
  reviewTarget,
  runtimeSummaryText,
  plainLanguageSummary,
  nextStep,
  status,
}) {
  if (!deployment) {
    return null;
  }

  return {
    generated_at: new Date().toISOString(),
    deployment_id: deployment.id,
    status,
    runtime_identity: identityRecord || buildRuntimeIdentityExportRecord(deployment),
    recent_activity: recentActivityRecord || buildRuntimeRecentActivityExportRecord(exportPayload.activity),
    activity_trail: activityTrailRecord || buildRuntimeActivityTrailExportRecord(exportPayload.activity),
    attention_cue: attentionRecord || buildRuntimeAttentionExportRecord(exportPayload.attentionItems),
    next_step_cue: nextStepRecord || buildRuntimeNextStepExportRecord("", nextStep),
    ownership: buildRuntimeOwnershipExportRecord(ownershipSummary),
    review_target: buildRuntimeReviewTargetExportRecord(reviewTarget),
    health_proof: buildRuntimeHealthProofExportRecord(health, reviewTarget),
    release_trace: buildRuntimeReleaseTraceExportRecord(deployment),
    next_step: nextStep,
    human_summary: plainLanguageSummary,
    runtime_summary: runtimeSummaryText,
    attention_items: exportPayload.attentionItems,
    suggested_ports: exportPayload.suggestedPorts,
    deployment: exportPayload.deployment,
    health: exportPayload.health,
    diagnostics: exportPayload.diagnostics,
    activity: exportPayload.activity,
  };
}

export function buildIncidentMarkdown(snapshot) {
  if (!snapshot) {
    return "";
  }

  const ownershipValue = snapshot.ownership?.value || "Unknown";
  const ownershipDetail = snapshot.ownership?.detail || "Ownership is not available yet.";
  const runtimeIdentityValue = snapshot.runtime_identity?.value || "Deployment pending";
  const runtimeIdentityDetail =
    snapshot.runtime_identity?.detail || "Runtime identity is not available yet.";
  const recentActivityValue = snapshot.recent_activity?.value || "No activity yet";
  const recentActivityDetail =
    snapshot.recent_activity?.detail || "No runtime activity has been recorded yet.";
  const activityTrailValue = snapshot.activity_trail?.value || "No activity trail yet";
  const activityTrailDetail =
    snapshot.activity_trail?.detail || "No runtime activity has been recorded yet.";
  const attentionCueValue = snapshot.attention_cue?.value || "0 active warnings";
  const attentionCueDetail =
    snapshot.attention_cue?.detail || "No active runtime warnings right now.";
  const nextStepCueValue = snapshot.next_step_cue?.value || "Review runtime";
  const nextStepCueDetail =
    snapshot.next_step_cue?.detail || snapshot.next_step || "Review the runtime before making the next change.";
  const reviewTargetValue = snapshot.review_target?.value || "Unknown";
  const reviewTargetHref = snapshot.review_target?.href || "";
  const reviewTargetDetail =
    snapshot.review_target?.detail || "Review target is not available yet.";
  const healthProofValue = snapshot.health_proof?.value || "unknown";
  const healthProofDetail =
    snapshot.health_proof?.detail || "Health proof is not available yet.";
  const releaseTraceValue = snapshot.release_trace?.value || "n/a";
  const releaseTraceDetail =
    snapshot.release_trace?.detail || "Release trace is not available yet.";

  const lines = [
    `# Deployment Incident Handoff`,
    ``,
    `Generated: ${formatDate(snapshot.generated_at)}`,
    `Deployment ID: ${snapshot.deployment_id}`,
    `Status: ${snapshot.status}`,
    ``,
    `## Plain-Language Summary`,
    ``,
    ...snapshot.human_summary.split("\n"),
    ``,
    `## Ownership`,
    ``,
    `Status: ${ownershipValue}`,
    `Detail: ${ownershipDetail}`,
    ``,
    `## Runtime Identity`,
    ``,
    `Value: ${runtimeIdentityValue}`,
    `Detail: ${runtimeIdentityDetail}`,
    `Runtime shape: ${snapshot.runtime_identity?.runtime_shape || "n/a"}`,
    `Image: ${snapshot.runtime_identity?.image || "n/a"}`,
    `Container: ${snapshot.runtime_identity?.container_name || "n/a"}`,
    `Stack: ${snapshot.runtime_identity?.stack_name || "n/a"}`,
    `Primary service: ${snapshot.runtime_identity?.primary_service || "n/a"}`,
    `Location: ${snapshot.runtime_identity?.location || "n/a"}`,
    ``,
    `## Recent Activity Cue`,
    ``,
    `Value: ${recentActivityValue}`,
    `Detail: ${recentActivityDetail}`,
    `Logged at: ${
      snapshot.recent_activity?.created_at ? formatDate(snapshot.recent_activity.created_at) : "n/a"
    }`,
    `Level: ${snapshot.recent_activity?.level || "n/a"}`,
    `Category: ${snapshot.recent_activity?.category || "n/a"}`,
    `Title: ${snapshot.recent_activity?.title || "n/a"}`,
    `Message: ${snapshot.recent_activity?.message || "n/a"}`,
    ``,
    `## Activity Trail`,
    ``,
    `Value: ${activityTrailValue}`,
    `Detail: ${activityTrailDetail}`,
    `Total count: ${snapshot.activity_trail?.total_count || "0"}`,
    `Error count: ${snapshot.activity_trail?.error_count || "0"}`,
    `Warn count: ${snapshot.activity_trail?.warn_count || "0"}`,
    `Success count: ${snapshot.activity_trail?.success_count || "0"}`,
    `Latest event: ${snapshot.activity_trail?.latest_title || "n/a"}`,
    `Latest level: ${snapshot.activity_trail?.latest_level || "n/a"}`,
    `Latest at: ${
      snapshot.activity_trail?.latest_created_at ? formatDate(snapshot.activity_trail.latest_created_at) : "n/a"
    }`,
    `Latest problem: ${snapshot.activity_trail?.latest_problem_title || "n/a"}`,
    `Latest problem at: ${
      snapshot.activity_trail?.latest_problem_created_at
        ? formatDate(snapshot.activity_trail.latest_problem_created_at)
        : "n/a"
    }`,
    `Latest success: ${snapshot.activity_trail?.latest_success_title || "n/a"}`,
    `Latest success at: ${
      snapshot.activity_trail?.latest_success_created_at
        ? formatDate(snapshot.activity_trail.latest_success_created_at)
        : "n/a"
    }`,
    ``,
    `## Attention Cue`,
    ``,
    `Value: ${attentionCueValue}`,
    `Detail: ${attentionCueDetail}`,
    `Total count: ${snapshot.attention_cue?.total_count || "0"}`,
    `Error count: ${snapshot.attention_cue?.error_count || "0"}`,
    `Warn count: ${snapshot.attention_cue?.warn_count || "0"}`,
    `Primary label: ${snapshot.attention_cue?.primary_label || "n/a"}`,
    `Primary message: ${snapshot.attention_cue?.primary_message || "n/a"}`,
    ``,
    `## Next Safe Action Cue`,
    ``,
    `Value: ${nextStepCueValue}`,
    `Detail: ${nextStepCueDetail}`,
    ``,
    `## Review Target`,
    ``,
    `Status: ${reviewTargetValue}`,
    `Href: ${reviewTargetHref || "n/a"}`,
    `Detail: ${reviewTargetDetail}`,
    ``,
    `## Health Proof`,
    ``,
    `Status: ${healthProofValue}`,
    `Detail: ${healthProofDetail}`,
    `Checked at: ${
      snapshot.health_proof?.checked_at ? formatDate(snapshot.health_proof.checked_at) : "n/a"
    }`,
    `HTTP status: ${snapshot.health_proof?.status_code || "n/a"}`,
    `Response time: ${
      snapshot.health_proof?.response_time_ms || snapshot.health_proof?.response_time_ms === 0
        ? `${snapshot.health_proof.response_time_ms} ms`
        : "n/a"
    }`,
    `Error: ${snapshot.health_proof?.error || "n/a"}`,
    ``,
    `## Release Trace`,
    ``,
    `Summary: ${releaseTraceValue}`,
    `Detail: ${releaseTraceDetail}`,
    `Source: ${snapshot.release_trace?.source || "manual"}`,
    `Ref: ${snapshot.release_trace?.ref || "n/a"}`,
    `Commit: ${snapshot.release_trace?.commit_sha || "n/a"}`,
    `Image tag: ${snapshot.release_trace?.image_tag || "n/a"}`,
    `Triggered at: ${
      snapshot.release_trace?.triggered_at ? formatDate(snapshot.release_trace.triggered_at) : "n/a"
    }`,
    `Triggered by: ${snapshot.release_trace?.triggered_by || "n/a"}`,
    ``,
    `## Next Step`,
    ``,
    snapshot.next_step,
    ``,
    `## Runtime Snapshot`,
    ``,
    ...snapshot.runtime_summary.split("\n"),
    ``,
    `## Attention Items`,
    ``,
  ];

  if (snapshot.attention_items.length === 0) {
    lines.push(`- No active runtime warnings.`);
  } else {
    snapshot.attention_items.forEach((item) => {
      lines.push(`- ${item.label}: ${item.message}`);
    });
  }

  lines.push(``, `## Recent Activity`, ``);

  if (!Array.isArray(snapshot.activity) || snapshot.activity.length === 0) {
    lines.push(`- No activity recorded yet.`);
  } else {
    snapshot.activity.slice(0, 10).forEach((item) => {
      lines.push(
        `- ${formatDate(item.created_at)} · ${item.level || "unknown"} · ${item.title || "-"} · ${item.message || "-"}`,
      );
    });
  }

  return lines.join("\n");
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

  const {
    server_id: serverId,
    server_name: _serverName,
    server_host: _serverHost,
    ...safeDeployment
  } = deployment;
  return {
    ...redactRuntimeInventoryObject(safeDeployment, sensitiveValues),
    target: serverId || deployment.server_managed_by_admin ? "Managed by an admin" : "Local",
  };
}

function sanitizeRuntimeDiagnosticsForExport(diagnostics, deployment, sensitiveValues) {
  if (!diagnostics) {
    return null;
  }

  return {
    ...redactRuntimeInventoryObject(diagnostics, sensitiveValues),
    server_target:
      deployment?.server_id || deployment?.server_managed_by_admin ? "Managed by an admin" : null,
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
    suggestedPorts:
      deployment?.server_id || deployment?.server_managed_by_admin
        ? []
        : Array.isArray(suggestedPorts)
          ? suggestedPorts
          : [],
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

export function buildSecretRowsFromObject(secrets) {
  return Object.keys(secrets || {}).length > 0
    ? Object.keys(secrets || {}).map((key) => ({
        key,
        value: "",
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
      label: "Review rollout status",
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

export function buildHostDiskPressureGuardrail(opsOverview, options = {}) {
  const hostRuntime = opsOverview?.host_runtime || null;
  const rootDiskStatus = hostRuntime?.root_disk_status;

  if (rootDiskStatus !== "warn" && rootDiskStatus !== "error") {
    return null;
  }

  const usagePercent = Number.isFinite(Number(hostRuntime?.root_disk_usage_percent))
    ? Number(hostRuntime.root_disk_usage_percent)
    : null;
  const freeSpace = String(hostRuntime?.root_disk_free || "").trim();
  const title = usagePercent
    ? `DeployMate host root disk is ${usagePercent}% full`
    : rootDiskStatus === "error"
      ? "DeployMate host root disk is critically full"
      : "DeployMate host root disk needs cleanup";
  const detail =
    String(hostRuntime?.root_disk_detail || "").trim() ||
    (freeSpace
      ? `${freeSpace} free on /. Clear space before the next rollout.`
      : "Clear space on the DeployMate host before the next rollout.");
  const hasLiveDeployments = Number(options.deploymentsTotal || 0) > 0;

  return {
    key: "host-disk-pressure",
    title,
    detail,
    nextStep: `${detail} Free space on the DeployMate host, refresh overview, and only then start another rollout from this workspace.`,
    tone: rootDiskStatus === "error" ? "error" : "warn",
    actionLabel: hasLiveDeployments ? "Review live deployments" : "Back to overview",
    href: hasLiveDeployments ? "#runtime-deployments" : "/app",
    blocker: true,
  };
}

export function buildHostDiskPressureRunbook(guardrail, options = {}) {
  if (!guardrail?.blocker) {
    return null;
  }

  const hasLiveDeployments = Number(options.deploymentsTotal || 0) > 0;
  const resumeReason = String(options.resumeReason || "").trim();
  const resumeStep =
    resumeReason === "server-setup"
      ? {
          title: "Return to server review",
          detail:
            "After cleanup, keep Step 1 moving and verify one saved server target before rollout work becomes the main path again.",
        }
      : hasLiveDeployments
        ? {
            title: "Return to live review",
            detail:
              "After cleanup, review the current runtime again and only then decide whether another rollout is actually necessary.",
          }
        : {
            title: "Return to deployment workflow",
            detail:
              "After cleanup, reopen the guided rollout path only when overview no longer warns about low disk on the DeployMate host.",
          };
  const commands = [
    "docker builder prune --all --force",
    "journalctl --vacuum-size=100M",
    "df -h /",
  ];
  const warningNote =
    "If / still stays above the warning threshold after these safe commands, inspect container/image usage manually before deleting anything broader.";

  return {
    title: "Low disk cleanup runbook",
    focus: guardrail.title,
    summary: guardrail.nextStep,
    commands,
    warningNote,
    steps: [
      {
        label: "1. Stabilize the path",
        title: hasLiveDeployments ? "Review live apps before another rollout" : "Pause rollout work",
        detail: hasLiveDeployments
          ? "Keep live review available while low disk is active, but treat new rollout work as blocked until cleanup is complete."
          : "Do not start the first rollout while the DeployMate host is already low on free space.",
      },
      {
        label: "2. Run the safe cleanup set",
        title: "Clear builder cache and trim old logs",
        detail:
          "Start with safe cleanup on the DeployMate host itself: old Docker builder cache, old systemd journal data, then check root disk again.",
      },
      {
        label: "3. Confirm headroom",
        title: resumeStep.title,
        detail: `${resumeStep.detail} ${warningNote}`,
      },
    ],
    copyText: [
      guardrail.title,
      guardrail.nextStep,
      "",
      "Safe cleanup commands:",
      ...commands,
      "",
      warningNote,
    ].join("\n"),
  };
}

export function buildDeploymentWorkflowState({
  isAdmin,
  localDeploymentsEnabled,
  deploymentsTotal,
  failedDeployments,
  serversTotal,
  deployBlocker,
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

  if (deployBlocker?.blocker) {
    return {
      mode: "guardrail",
      title: deployBlocker.title,
      detail: deployBlocker.detail,
      href: deployBlocker.href,
      actionLabel: deployBlocker.actionLabel,
      bannerTone: deployBlocker.tone,
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
  deployBlocker,
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

  if (deployBlocker?.blocker) {
    return {
      focus: deployBlocker.title,
      nextStep: deployBlocker.nextStep,
      primaryAction: deployBlocker.actionLabel,
      secondaryAction: "Copy next step",
      tone: deployBlocker.tone,
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
  const templateSecretCount = Object.keys(template.secrets || {}).length;
  const currentSecretCount = Object.keys(currentDraft.secrets || {}).length;
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
      label: "Context",
      templateValue: normalizeDraftValue(template.context_label || "Needs context label"),
      currentValue: normalizeDraftValue(currentDraft.context_label || "Needs context label"),
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
    {
      label: "Secrets",
      templateValue: templateSecretCount === 0 ? "No secrets" : `${templateSecretCount} saved`,
      currentValue: currentSecretCount === 0 ? "No secrets" : `${currentSecretCount} attached`,
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
