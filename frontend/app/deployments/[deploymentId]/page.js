"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useState } from "react";
import { AdminDisclosureSection } from "../../app/admin-ui";
import { escapeCsvCell, triggerFileDownload } from "../../lib/admin-page-utils";
import {
  buildDeploymentUrl,
  buildEnvIssues,
  buildReviewConfirmationPhrase,
  buildReviewIntroText,
  buildRolloutDraftSummary,
  buildAccessControlledRuntimeExportPayload,
  formatAccessibleServerLabel,
  formatDate,
  formatSuggestedPorts,
  normalizeDeploymentActionError,
  readJsonOrError,
} from "../../lib/runtime-workspace-utils";
import {
  smokeActivity,
  smokeDeployment,
  smokeDeployments,
  smokeDiagnostics,
  smokeHealth,
  smokeInternalRuntimeDeployment,
  smokeMode,
  smokeUser,
} from "../../lib/smoke-fixtures";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

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

function buildRuntimeSummaryText(deployment, health, diagnostics, activity, canAccessServers) {
  if (!deployment) {
    return "";
  }

  const lines = [
    `Deployment ${deployment.id}`,
    `Status: ${deployment.status || "unknown"}`,
    `Image: ${deployment.image || "n/a"}`,
    `Container: ${deployment.container_name || "n/a"}`,
    `Server: ${
      canAccessServers && deployment.server_name && deployment.server_host
        ? `${deployment.server_name} (${deployment.server_host})`
        : deployment.server_id || deployment.server_managed_by_admin
          ? "Managed by an admin"
          : "Local"
    }`,
    `URL: ${buildDeploymentUrl(deployment) || "n/a"}`,
    `Ports: ${deployment.internal_port || "-"} -> ${deployment.external_port || "-"}`,
    `Health: ${health?.status || "unknown"}${
      health?.response_time_ms || health?.response_time_ms === 0
        ? ` in ${health.response_time_ms} ms`
        : ""
    }`,
    `Diagnostics target: ${
      canAccessServers
        ? diagnostics?.server_target || "n/a"
        : deployment.server_id || deployment.server_managed_by_admin
          ? "Managed by an admin"
          : "n/a"
    }`,
    `Activity events: ${Array.isArray(activity) ? activity.length : 0}`,
  ];

  if (diagnostics?.activity?.last_event_title) {
    lines.push(`Last event: ${diagnostics.activity.last_event_title}`);
  }

  return lines.join("\n");
}

function buildRecommendedNextStep(deployment, health, diagnostics, attentionItems) {
  if (deployment?.status === "failed") {
    return "Review diagnostics and recent failures first, then redeploy only after the root cause is clear.";
  }

  if (health?.status && health.status !== "healthy") {
    return "Check health, logs, and recent activity before making another rollout change.";
  }

  if (diagnostics?.activity?.recent_failure_count > 0) {
    return "Review the recent failure history and confirm the runtime is stable before the next rollout.";
  }

  if (attentionItems.length > 0) {
    return "Work through the current attention items before changing this deployment.";
  }

  return "Keep the current rollout stable, and only redeploy when you are ready to change image, ports, or env vars deliberately.";
}

function buildPlainLanguageSummary(deployment, health, diagnostics, attentionItems, activity, canAccessServers) {
  if (!deployment) {
    return "";
  }

  const deploymentName = deployment.container_name || deployment.image || deployment.id;
  const endpoint = buildDeploymentUrl(deployment);
  const latestEvent = Array.isArray(activity) && activity.length > 0 ? activity[0] : null;
  const nextStep = buildRecommendedNextStep(deployment, health, diagnostics, attentionItems);

  const lines = [
    `What changed: the deployment "${deploymentName}" is currently ${deployment.status || "in an unknown state"}.`,
    endpoint
      ? `People can currently reach it at ${endpoint}.`
      : "This deployment does not currently have a public URL.",
    health?.status === "healthy"
      ? `The latest health check passed${health?.response_time_ms || health?.response_time_ms === 0 ? ` in ${health.response_time_ms} ms` : ""}.`
      : `The latest health check needs review${health?.status ? ` because the status is ${health.status}` : ""}${health?.error ? `: ${health.error}` : "."}`,
    attentionItems.length > 0
      ? `${attentionItems.length} issue${attentionItems.length === 1 ? "" : "s"} still need attention before the next rollout: ${attentionItems
          .slice(0, 3)
          .map((item) => item.label)
          .join(", ")}.`
      : "There are no active runtime warnings right now.",
    canAccessServers
      ? diagnostics?.server_target
        ? `The deployment is tied to ${diagnostics.server_target} for diagnostics and runtime review.`
        : "No diagnostics target is available yet."
      : deployment.server_id || deployment.server_managed_by_admin
        ? "The deployment runs on an admin-managed server target."
        : "No diagnostics target is available yet.",
    latestEvent?.title
      ? `The most recent recorded activity was "${latestEvent.title}" at ${formatDate(latestEvent.created_at)}.`
      : "No recent activity has been recorded for this deployment yet.",
    `What to do next: ${nextStep}`,
  ];

  return lines.join("\n");
}

function buildIncidentSnapshotPayload(
  deployment,
  health,
  exportPayload,
  runtimeSummaryText,
  plainLanguageSummary,
  nextStep,
  status,
) {
  if (!deployment) {
    return null;
  }

  return {
    generated_at: new Date().toISOString(),
    deployment_id: deployment.id,
    status,
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

function buildIncidentMarkdown(snapshot) {
  if (!snapshot) {
    return "";
  }

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

function buildActivityExportCsv(items) {
  const rows = [
    ["created_at", "level", "category", "title", "message"],
    ...items.map((item) => [
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

function normalizeRedeployError(message) {
  return normalizeDeploymentActionError(message, "Failed to redeploy deployment.");
}

function buildRedeployValidation(form, envRows) {
  const errors = [];
  const warnings = [];
  const internalPort = form.internal_port.trim();
  const externalPort = form.external_port.trim();
  const envIssues = buildEnvIssues(envRows);

  if (!form.image.trim()) {
    errors.push("Image is required.");
  }

  if ((internalPort && !externalPort) || (!internalPort && externalPort)) {
    errors.push("Internal port and external port must be provided together.");
  }

  errors.push(...envIssues);

  if (!externalPort && internalPort) {
    warnings.push("This rollout draft still has no public port mapping.");
  }

  return { errors, warnings };
}

function buildRedeployChangeRows(deployment, form, envRows) {
  if (!deployment) {
    return [];
  }

  const nextEnv = JSON.stringify(
    envRows.reduce((env, row) => {
      const key = row.key.trim();
      if (key) {
        env[key] = row.value;
      }
      return env;
    }, {}),
    null,
    2,
  );
  const currentEnv = JSON.stringify(deployment.env || {}, null, 2);
  const rows = [
    {
      label: "Image",
      currentValue: deployment.image || "N/A",
      nextValue: form.image.trim() || "N/A",
    },
    {
      label: "Container name",
      currentValue: deployment.container_name || "Auto-generated",
      nextValue: form.name.trim() || "Keep current / auto-generated",
    },
    {
      label: "Ports",
      currentValue: `${deployment.external_port || "-"}:${deployment.internal_port || "-"}`,
      nextValue: `${form.external_port.trim() || "-"}:${form.internal_port.trim() || "-"}`,
    },
    {
      label: "Env",
      currentValue: currentEnv === "{}" ? "No env vars" : currentEnv,
      nextValue: nextEnv === "{}" ? "No env vars" : nextEnv,
    },
  ];

  return rows.filter((row) => row.currentValue !== row.nextValue);
}

function buildRedeployImpactSummary({
  deployment,
  diagnostics,
  deploymentUrl,
  changeRows,
  canAccessServers,
}) {
  if (!deployment) {
    return "";
  }

  const lines = [
    `Deployment record: ${deployment.id}`,
    `Current container: ${deployment.container_name || "N/A"}`,
    `Current status: ${deployment.status || "unknown"}`,
    `Target: ${
      canAccessServers
        ? diagnostics?.server_target ||
          (deployment.server_name ? `${deployment.server_name} (${deployment.server_host})` : "Local Docker target")
        : deployment.server_id || deployment.server_managed_by_admin
          ? "Managed by an admin"
          : "Local Docker target"
    }`,
    deploymentUrl ? `Public URL: ${deploymentUrl}` : "Public URL: none",
    "",
    "This action will ask DeployMate to redeploy this runtime with the draft shown above.",
  ];

  if (changeRows.length === 0) {
    lines.push("No config changes were detected. This will re-run the current rollout with the same visible settings.");
  } else {
    lines.push("", "Detected rollout changes:");
    changeRows.forEach((row) => {
      lines.push(`- ${row.label}`);
      lines.push(`  current: ${row.currentValue}`);
      lines.push(`  next: ${row.nextValue}`);
    });
  }

  return lines.join("\n");
}

function buildRuntimeDecisionState(
  deployment,
  health,
  diagnostics,
  attentionItems,
  activity,
  options = {},
) {
  const { canMutateRuntime = true, freshRolloutReview = false } = options;
  const latestEvent = Array.isArray(activity) && activity.length > 0 ? activity[0] : null;
  const recentFailureCount = diagnostics?.activity?.recent_failure_count || 0;
  const errorCount = attentionItems.filter((item) => item.status === "error").length;
  const warnCount = attentionItems.filter((item) => item.status === "warn").length;

  if (deployment?.status === "failed") {
    return {
      tone: "error",
      label: "Blocked",
      focus: `${deployment.container_name || deployment.image || "This deployment"} is currently failed`,
      why:
        "The runtime is already in a failed state, so the first job is understanding the failure before another rollout change competes for attention.",
      nextStep:
        "Read the attention items, diagnostics, and recent activity first. Only redeploy after the root cause is concrete enough to explain.",
      primaryHref: "#runtime-detail-attention-list",
      primaryAction: "Review runtime issues",
      secondaryHref: "#runtime-detail-activity-tools",
      secondaryAction: "Open deeper runtime tools",
      badges: [
        { label: "errors", value: `${errorCount}`, tone: "error" },
        { label: "warnings", value: `${warnCount}`, tone: "warn" },
        { label: "recent failures", value: `${recentFailureCount}`, tone: "error" },
      ],
    };
  }

  if (health?.status && health.status !== "healthy") {
    return {
      tone: health.status === "unavailable" ? "warn" : "error",
      label: "Review",
      focus: `Health is ${health.status}`,
      why:
        health?.error ||
        "Health is degraded, so this page should act as a runtime review surface before it becomes a rollout-change surface.",
      nextStep:
        "Confirm whether the runtime is actually alive, read the health error or latency signal, and inspect activity before deciding on a redeploy.",
      primaryHref: "#runtime-detail-attention-list",
      primaryAction: "Review health and warnings",
      secondaryHref: "#runtime-detail-activity-tools",
      secondaryAction: "Open activity and diagnostics",
      badges: [
        { label: "health", value: health.status, tone: health.status === "unavailable" ? "warn" : "error" },
        { label: "errors", value: `${errorCount}`, tone: errorCount > 0 ? "error" : "unknown" },
        { label: "warnings", value: `${warnCount}`, tone: warnCount > 0 ? "warn" : "unknown" },
      ],
    };
  }

  if (recentFailureCount > 0 || attentionItems.length > 0) {
    return {
      tone: "warn",
      label: "Review",
      focus: `${attentionItems.length} active runtime warning${attentionItems.length === 1 ? "" : "s"} still need explanation`,
      why:
        recentFailureCount > 0
          ? `${recentFailureCount} recent failure event${recentFailureCount === 1 ? "" : "s"} still sit in diagnostics history.`
          : "The runtime is not clean yet, so the warnings should be understood before a new rollout becomes the main story.",
      nextStep:
        "Work through the attention list and confirm the runtime is believable. Then decide whether the next safe move is stability, handoff, or a deliberate redeploy.",
      primaryHref: "#runtime-detail-attention-list",
      primaryAction: "Review attention items",
      secondaryHref: "#runtime-detail-handoff-tools",
      secondaryAction: "Open handoff tools",
      badges: [
        { label: "errors", value: `${errorCount}`, tone: errorCount > 0 ? "error" : "unknown" },
        { label: "warnings", value: `${warnCount}`, tone: warnCount > 0 ? "warn" : "unknown" },
        { label: "last event", value: latestEvent?.level || "none", tone: latestEvent?.level === "error" ? "error" : latestEvent?.level === "warn" ? "warn" : "healthy" },
      ],
    };
  }

  const deploymentUrl = buildDeploymentUrl(deployment);
  const freshRolloutWithPublicUrl = freshRolloutReview && Boolean(deploymentUrl);

  return {
    tone: "healthy",
    label: freshRolloutReview ? "Verify" : "Ready",
    focus: deploymentUrl
      ? freshRolloutReview
        ? "Fresh rollout is live. Check it before treating this deploy as done"
        : "Runtime is healthy. Open the app once before changing it"
      : freshRolloutReview
        ? "Fresh rollout is private. Review the stable service before treating this change as done"
        : "Runtime is private. Review the stable service before changing it",
    why:
      deploymentUrl
        ? freshRolloutReview
          ? "This rollout was just created from Deployment Workflow. Verify the user-facing path and runtime signals now, while the change context is still fresh."
          : "No active runtime warnings are leading the page right now. The safest next step is verifying the live app before opening change tools."
        : freshRolloutReview
          ? "This rollout was just created without a public URL. Review the stable runtime signals now, while the rollout context is still fresh."
          : "No active runtime warnings are leading the page right now. Because there is no public URL to click from here, the safest next step is reviewing the stable runtime before opening change tools.",
    nextStep:
      deploymentUrl
        ? freshRolloutReview
          ? "Open the running app, then return here and confirm health and recent activity before preparing another rollout change."
          : "Open the running app and confirm the user-facing path works. Only prepare a rollout change after that check is intentional."
        : freshRolloutReview
          ? "Review the current runtime overview, port mapping, health, and recent activity before preparing another rollout change."
          : "Review the current runtime overview, port mapping, health, and recent activity first. Prepare a rollout change only after that review is intentional.",
    primaryHref: deploymentUrl || "#runtime-detail-overview",
    primaryExternal: Boolean(deploymentUrl),
    primaryAction: deploymentUrl ? "Open running app" : "Review stable runtime",
    secondaryHref: freshRolloutWithPublicUrl
      ? "#runtime-detail-overview"
      : canMutateRuntime
        ? "#runtime-detail-redeploy"
        : "#runtime-detail-handoff-tools",
    secondaryAction: freshRolloutWithPublicUrl
      ? "Review runtime overview"
      : canMutateRuntime
        ? "Prepare rollout change"
        : "Open handoff tools",
    badges: [
      { label: "health", value: health?.status || "unknown", tone: "healthy" },
      { label: "attention", value: `${attentionItems.length}`, tone: "healthy" },
      { label: "recent failures", value: `${recentFailureCount}`, tone: recentFailureCount > 0 ? "warn" : "healthy" },
    ],
  };
}

function buildChangeReadinessState(redeployPreflight, redeployChangeRows, form, suggestedPorts) {
  if (redeployPreflight.errors.length > 0) {
    return {
      tone: "error",
      label: "Blocked",
      focus: "The current redeploy draft cannot be applied yet",
      why: redeployPreflight.errors[0],
      nextStep: "Fix the draft error first. After that, reopen review and confirm the rollout change explicitly.",
    };
  }

  if (!form.image.trim()) {
    return {
      tone: "warn",
      label: "Waiting",
      focus: "The redeploy draft is still missing the image",
      why: "A deliberate rollout change starts with a valid image reference.",
      nextStep: "Set the image first, then adjust ports, env vars, or the container name only if the runtime really needs those changes.",
    };
  }

  if (redeployChangeRows.length === 0) {
    return {
      tone: "warn",
      label: "Review",
      focus: "No visible config changes are queued",
      why: "Submitting now would simply re-run the current rollout with the same visible settings.",
      nextStep: "Either keep the runtime stable as-is, or make a specific image, port, env, or name change before confirming redeploy.",
    };
  }

  if (redeployPreflight.warnings.length > 0) {
    return {
      tone: "warn",
      label: "Review",
      focus: "The draft is valid but still needs operator judgment",
      why: redeployPreflight.warnings[0],
      nextStep: "Read the impact summary, check the suggested ports if needed, and only then confirm redeploy.",
    };
  }

  return {
    tone: "healthy",
    label: "Ready",
    focus: `${redeployChangeRows.length} rollout change${redeployChangeRows.length === 1 ? "" : "s"} are ready for review`,
    why:
      suggestedPorts.length > 0 && !form.external_port.trim()
        ? "Suggested ports are available if you want a safer external port choice before redeploy."
        : "The draft currently passes validation and is ready for explicit review.",
    nextStep: "Open redeploy review, inspect the impact summary, and confirm only if this is the intended runtime change.",
  };
}

export default function DeploymentDetailsPage({ params }) {
  const { deploymentId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const smokeDetailDeployment = smokeMode
    ? deploymentId === "internal-runtime"
      ? smokeInternalRuntimeDeployment
      : deploymentId === "admin-managed-runtime"
      ? {
          ...smokeDeployment,
          id: "admin-managed-runtime",
          server_id: null,
          server_name: null,
          server_host: null,
          server_managed_by_admin: true,
        }
      : smokeDeployments.find((item) => item.id === deploymentId) || smokeDeployment
    : null;
  const smokeDetailIsFailed = smokeDetailDeployment?.status === "failed";
  const smokeDetailIsAdminManaged = Boolean(smokeDetailDeployment?.server_managed_by_admin);
  const smokeDetailIsInternalOnly = smokeDetailDeployment?.id === smokeInternalRuntimeDeployment.id;
  const smokeDetailHealth =
    smokeMode && smokeDetailIsAdminManaged
      ? {
          deployment_id: smokeDetailDeployment.id,
          container_name: smokeDetailDeployment.container_name,
          url: null,
          status: "unavailable",
          status_code: null,
          error:
            "Live health checks stay with admins for this admin-managed remote runtime.",
          checked_at: smokeDetailDeployment.created_at,
          response_time_ms: null,
        }
      : smokeMode && smokeDetailIsInternalOnly
      ? {
          deployment_id: smokeDetailDeployment.id,
          container_name: smokeDetailDeployment.container_name,
          url: null,
          status: "healthy",
          status_code: 200,
          error: null,
          checked_at: smokeDetailDeployment.created_at,
          response_time_ms: 31,
        }
      : smokeMode && smokeDetailIsFailed
      ? {
          deployment_id: smokeDetailDeployment.id,
          container_name: smokeDetailDeployment.container_name,
          url: buildDeploymentUrl(smokeDetailDeployment),
          status: "unhealthy",
          status_code: null,
          error: smokeDetailDeployment.error || "Deployment failed before health checks completed.",
          checked_at: smokeDetailDeployment.created_at,
          response_time_ms: null,
        }
      : smokeHealth;
  const smokeDetailDiagnostics =
    smokeMode && smokeDetailIsAdminManaged
      ? null
      : smokeMode && smokeDetailIsFailed
      ? {
          deployment_id: smokeDetailDeployment.id,
          container_name: smokeDetailDeployment.container_name,
          current_status: smokeDetailDeployment.status,
          server_target: smokeDetailDeployment.server_host
            ? `deploy@${smokeDetailDeployment.server_host}:22`
            : "Managed by an admin",
          checked_at: smokeDetailDeployment.created_at,
          url: buildDeploymentUrl(smokeDetailDeployment),
          health: smokeDetailHealth,
          activity: {
            total_events: 2,
            success_events: 1,
            error_events: 1,
            recent_failure_count: 1,
            recent_failure_titles: ["Review worker readiness failed"],
            last_event_title: "Review worker readiness failed",
            last_event_level: "error",
            last_event_at: smokeDetailDeployment.created_at,
          },
          log_excerpt: smokeDetailDeployment.error || "Readiness failed before the worker stayed online.",
          items: [
            {
              key: "deployment_status",
              label: "Deployment status",
              status: "error",
              summary: "Current status is failed.",
              details: smokeDetailDeployment.error || null,
            },
            {
              key: "health",
              label: "HTTP health",
              status: "error",
              summary: smokeDetailDeployment.error || "Health checks did not complete.",
              details: buildDeploymentUrl(smokeDetailDeployment) || null,
            },
          ],
        }
      : smokeMode && smokeDetailIsInternalOnly
      ? {
          deployment_id: smokeDetailDeployment.id,
          container_name: smokeDetailDeployment.container_name,
          current_status: smokeDetailDeployment.status,
          server_target: `deploy@${smokeDetailDeployment.server_host}:22`,
          checked_at: smokeDetailDeployment.created_at,
          url: null,
          health: smokeDetailHealth,
          activity: {
            total_events: 2,
            success_events: 2,
            error_events: 0,
            recent_failure_count: 0,
            recent_failure_titles: [],
            last_event_title: "Internal health check passed",
            last_event_level: "success",
            last_event_at: smokeDetailDeployment.created_at,
          },
          log_excerpt: "internal-api entered RUNNING state without a public endpoint.",
          items: [
            {
              key: "deployment_status",
              label: "Deployment status",
              status: "ok",
              summary: "Current status is running.",
              details: null,
            },
            {
              key: "health",
              label: "Internal health",
              status: "ok",
              summary: "Internal health checks are stable even though no public URL is assigned yet.",
              details: "Service is reachable through the runtime target and mapped internal port.",
            },
          ],
        }
      : smokeDiagnostics;
  const smokeDetailActivity =
    smokeMode && smokeDetailIsFailed
      ? [
          {
            id: "review-worker-activity-2",
            deployment_id: smokeDetailDeployment.id,
            level: "error",
            title: "Review worker readiness failed",
            message: smokeDetailDeployment.error || "The worker failed before health checks passed.",
            created_at: smokeDetailDeployment.created_at,
            category: "health",
          },
          {
            id: "review-worker-activity-1",
            deployment_id: smokeDetailDeployment.id,
            level: "success",
            title: "Deployment request accepted",
            message: "DeployMate started the review-worker rollout before readiness failed.",
            created_at: "2026-04-02T02:09:30Z",
            category: "deploy",
          },
        ]
      : smokeMode && smokeDetailIsInternalOnly
      ? [
          {
            id: "internal-runtime-activity-2",
            deployment_id: smokeDetailDeployment.id,
            level: "success",
            title: "Internal health check passed",
            message: "internal-api responded on the mapped internal port without exposing a public URL.",
            created_at: smokeDetailDeployment.created_at,
            category: "health",
          },
          {
            id: "internal-runtime-activity-1",
            deployment_id: smokeDetailDeployment.id,
            level: "success",
            title: "Deployment succeeded",
            message: "Deployment internal-runtime is running as an internal-only service.",
            created_at: "2026-04-02T00:18:00Z",
            category: "deploy",
          },
        ]
      : smokeActivity;
  const [authChecked, setAuthChecked] = useState(smokeMode);
  const [currentUser, setCurrentUser] = useState(smokeMode ? smokeUser : null);
  const [deployment, setDeployment] = useState(smokeMode ? smokeDetailDeployment : null);
  const [logs, setLogs] = useState(
    smokeMode
      ? smokeDetailIsAdminManaged
        ? "Live logs stay with admins for this admin-managed remote runtime."
        : smokeDetailIsInternalOnly
        ? "internal-api entered RUNNING state without exposing a public URL."
        : smokeDetailIsFailed
        ? smokeDetailDeployment.error || "Readiness failed before the worker stayed online."
        : "nginx entered RUNNING state"
      : "",
  );
  const [health, setHealth] = useState(smokeMode ? smokeDetailHealth : null);
  const [diagnostics, setDiagnostics] = useState(smokeMode ? smokeDetailDiagnostics : null);
  const [activity, setActivity] = useState(smokeMode ? smokeDetailActivity : []);
  const [loading, setLoading] = useState(!smokeMode);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [redeploying, setRedeploying] = useState(false);
  const [redeployError, setRedeployError] = useState("");
  const [redeploySuccess, setRedeploySuccess] = useState("");
  const [redeployReviewOpen, setRedeployReviewOpen] = useState(false);
  const [redeployConfirmationText, setRedeployConfirmationText] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const [templateSuccess, setTemplateSuccess] = useState("");
  const [savedTemplate, setSavedTemplate] = useState(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [diagnosticsError, setDiagnosticsError] = useState("");
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [detailTab, setDetailTab] = useState("overview");
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [diagnosticsLogsExpanded, setDiagnosticsLogsExpanded] = useState(false);
  const [envExpanded, setEnvExpanded] = useState(false);
  const [suggestedPorts, setSuggestedPorts] = useState([]);
  const [suggestedPortsLoading, setSuggestedPortsLoading] = useState(false);
  const [deleteReviewOpen, setDeleteReviewOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [activityQuery, setActivityQuery] = useState("");
  const [activityLevelFilter, setActivityLevelFilter] = useState("all");
  const [activitySort, setActivitySort] = useState("newest");
  const [form, setForm] = useState({
    image: "",
    name: "",
    internal_port: "",
    external_port: "",
  });
  const [envRows, setEnvRows] = useState([{ key: "", value: "" }]);
  const canAccessServers = Boolean(currentUser?.is_admin);
  const runtimeServerAccessBlocked = Boolean(deployment?.server_managed_by_admin) && !canAccessServers;
  const canMutateRuntime =
    canAccessServers || (!deployment?.server_id && !runtimeServerAccessBlocked);
  const deploymentUrl = buildDeploymentUrl(deployment);
  const runtimeServerLabel = formatAccessibleServerLabel({
    canAccessServers,
    serverName: deployment?.server_name,
    serverHost: deployment?.server_host,
    serverId: deployment?.server_id,
    serverManagedByAdmin: runtimeServerAccessBlocked,
  });
  const runtimeOverviewMetaText = deployment?.server_id
    ? canAccessServers
      ? `Server ${runtimeServerLabel}`
      : "Target admin-managed"
    : runtimeServerAccessBlocked
      ? "Target admin-managed"
      : "Target local";
  const adminManagedRuntimeMessage =
    "Live server checks for this runtime are admin-managed. You can review safe handoff context here, but diagnostics, logs, health checks, redeploy, and delete stay with admins.";
  const rawAttentionItems = buildAttentionItems(deployment, health, diagnostics);
  const runtimeExportPayload = buildAccessControlledRuntimeExportPayload({
    deployment,
    health,
    diagnostics,
    activity,
    attentionItems: rawAttentionItems,
    suggestedPorts,
    canAccessServers,
  });
  const exportDiagnostics = runtimeExportPayload.diagnostics;
  const exportActivity = runtimeExportPayload.activity;
  const attentionItems = runtimeExportPayload.attentionItems;
  const requestedSource = searchParams.get("source") || "";
  const freshRolloutLatestEvent =
    Array.isArray(exportActivity) && exportActivity.length > 0 ? exportActivity[0] : null;
  const freshRolloutReview =
    requestedSource === "workflow-success" &&
    deployment?.status === "running" &&
    (!health?.status || health.status === "healthy") &&
    attentionItems.length === 0;
  const runtimeSummaryText = buildRuntimeSummaryText(
    deployment,
    health,
    exportDiagnostics,
    exportActivity,
    canAccessServers,
  );
  const plainLanguageSummary = buildPlainLanguageSummary(
    deployment,
    health,
    exportDiagnostics,
    attentionItems,
    exportActivity,
    canAccessServers,
  );
  const recommendedNextStep = buildRecommendedNextStep(
    deployment,
    health,
    exportDiagnostics,
    attentionItems,
  );
  const incidentSnapshot = buildIncidentSnapshotPayload(
    deployment,
    health,
    runtimeExportPayload,
    runtimeSummaryText,
    plainLanguageSummary,
    recommendedNextStep,
    deployment?.status || "unknown",
  );
  const filteredActivity = [...exportActivity]
    .filter((item) => {
      if (activityLevelFilter !== "all" && (item.level || "unknown") !== activityLevelFilter) {
        return false;
      }

      const query = activityQuery.trim().toLowerCase();
      if (!query) {
        return true;
      }

      const haystack = [
        item.level,
        item.category,
        item.title,
        item.message,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    })
    .sort((left, right) => {
      const leftTime = new Date(left.created_at || 0).getTime();
      const rightTime = new Date(right.created_at || 0).getTime();

      if (activitySort === "oldest") {
        return leftTime - rightTime;
      }

      if (activitySort === "errors-first") {
        const leftWeight = left.level === "error" ? 0 : left.level === "warn" ? 1 : 2;
        const rightWeight = right.level === "error" ? 0 : right.level === "warn" ? 1 : 2;
        if (leftWeight !== rightWeight) {
          return leftWeight - rightWeight;
        }
      }

      return rightTime - leftTime;
    });
  const deleteConfirmationTarget = deployment?.container_name || deployment?.id || "";
  const deleteConfirmationPhrase = buildReviewConfirmationPhrase(
    "delete",
    deleteConfirmationTarget,
  );
  const deleteImpactSummary = deployment
    ? [
        `Deployment record: ${deployment.id}`,
        `Container: ${deployment.container_name || "N/A"}`,
        `Target: ${
          canAccessServers
            ? diagnostics?.server_target ||
              (deployment.server_name ? `${deployment.server_name} (${deployment.server_host})` : "Local Docker target")
        : deployment.server_id || deployment.server_managed_by_admin
          ? "Managed by an admin"
          : "Local Docker target"
        }`,
        deploymentUrl ? `Public URL: ${deploymentUrl}` : "Public URL: none",
        "",
        "This action will try to remove the running container and then delete the saved deployment record.",
      ].join("\n")
    : "";
  const detailPriority =
    attentionItems[0]?.message ||
    (deployment?.status === "failed"
      ? "Deployment is failed and needs a deliberate redeploy."
      : health?.status && health.status !== "healthy"
        ? `Health is currently ${health.status}.`
        : freshRolloutReview
          ? "Fresh rollout is ready for first verification."
          : "Runtime surface is stable enough for review.");
  const runtimeDecisionState = buildRuntimeDecisionState(
    deployment,
    health,
    exportDiagnostics,
    attentionItems,
    exportActivity,
    { canMutateRuntime, freshRolloutReview },
  );
  const runtimeHeroLead = deployment
    ? `${deployment.container_name || deployment.image || deploymentId}. ${detailPriority}`
    : "Review what is running, whether it is healthy, and what should happen next.";
  const runtimeOverviewTitle =
    freshRolloutReview
      ? "What to confirm before this rollout counts as done"
      : deployment?.status === "failed" ||
      (health?.status && health.status !== "healthy") ||
      attentionItems.length > 0
      ? "Why this runtime still needs review"
      : "Why this runtime looks stable enough";
  const runtimeOverviewBody =
    freshRolloutReview
      ? "A successful deploy is not finished yet. Use the app, health, and activity signals below to verify this rollout before another change competes for attention."
      : deployment?.status === "failed" ||
      (health?.status && health.status !== "healthy") ||
      attentionItems.length > 0
      ? "These signals explain why runtime review still comes before the next rollout change."
      : "These signals explain why the runtime currently looks stable enough for a deliberate change instead of reactive cleanup.";
  const freshRolloutHealthSummary =
    health?.status === "healthy"
      ? `Latest health check passed${health?.response_time_ms || health?.response_time_ms === 0 ? ` in ${health.response_time_ms} ms` : ""}.`
      : health?.status
        ? `Current health status is ${health.status}.`
        : "Health status has not been recorded yet.";
  const freshRolloutActivitySummary = freshRolloutLatestEvent?.title
    ? `Latest recorded event: "${freshRolloutLatestEvent.title}" at ${formatDate(freshRolloutLatestEvent.created_at)}.`
    : "No runtime activity has been recorded yet.";
  const detailGlanceItems = [
    {
      label: "Endpoint",
      value: deploymentUrl ? "Live" : "Private",
      detail: deploymentUrl || "No public URL assigned yet.",
    },
    {
      label: "Cadence",
      value: "8-second refresh",
      detail: "Deployment, health, and activity refresh automatically while you stay on this page.",
    },
    {
      label: "Attention",
      value: `${attentionItems.length}`,
      detail:
        attentionItems.length > 0
          ? `${attentionItems.length} runtime attention item${attentionItems.length === 1 ? "" : "s"} need review.`
          : "No active runtime warnings right now.",
    },
    {
      label: "Next step",
      value:
        attentionItems.length > 0
          ? "Review runtime issues"
          : deployment?.status === "failed"
            ? "Redeploy deliberately"
            : freshRolloutReview
              ? deploymentUrl
                ? "Verify fresh rollout"
                : "Review fresh runtime"
            : deploymentUrl
              ? "Open running app"
              : "Review stable runtime",
      detail: freshRolloutReview
        ? deploymentUrl
          ? "This rollout was just created. Verify the live app and runtime signals before queuing another change."
          : "This rollout was just created. Verify the stable runtime signals before queuing another change."
        : detailPriority,
    },
  ];
  const renderRuntimeDecisionPrimaryAction = (className, testId) =>
    runtimeDecisionState.primaryExternal ? (
      <a
        href={runtimeDecisionState.primaryHref}
        target="_blank"
        rel="noreferrer"
        className={className}
        data-testid={testId}
      >
        {runtimeDecisionState.primaryAction}
      </a>
    ) : (
      <Link
        href={runtimeDecisionState.primaryHref}
        className={className}
        data-testid={testId}
      >
        {runtimeDecisionState.primaryAction}
      </Link>
    );
  const redeployPreflight = buildRedeployValidation(form, envRows);
  const redeployChangeRows = buildRedeployChangeRows(deployment, form, envRows);
  const changeReadinessState = buildChangeReadinessState(
    redeployPreflight,
    redeployChangeRows,
    form,
    suggestedPorts,
  );
  const redeployConfirmationTarget = deployment?.container_name || deployment?.id || "";
  const redeployConfirmationPhrase = buildReviewConfirmationPhrase(
    "redeploy",
    redeployConfirmationTarget,
  );
  const redeployImpactSummary = buildRedeployImpactSummary({
    deployment,
    diagnostics,
    deploymentUrl,
    changeRows: redeployChangeRows,
    canAccessServers,
  });

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

      if (deploymentData.server_managed_by_admin) {
        setLogs("Live logs stay with admins for this admin-managed remote runtime.");
        setHealth({
          deployment_id: deploymentData.id,
          container_name: deploymentData.container_name,
          url: null,
          status: "unavailable",
          status_code: null,
          error: "Live health checks stay with admins for this admin-managed remote runtime.",
          checked_at: null,
          response_time_ms: null,
        });
        setDiagnostics(null);
        setDiagnosticsError("");

        const activityResponse = await fetch(`${apiBaseUrl}/deployments/${deploymentId}/activity`, {
          cache: "no-store",
          credentials: "include",
        });
        const activityData = await readJsonOrError(
          activityResponse,
          "Failed to load deployment activity.",
        );
        setActivity(Array.isArray(activityData) ? activityData : []);
        return;
      }

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

      if (!deployment?.server_id || runtimeServerAccessBlocked) {
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
  }, [deployment?.server_id, runtimeServerAccessBlocked]);

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

  function showTransientMessage(message) {
    setCopyMessage(message);
    window.setTimeout(() => {
      setCopyMessage("");
    }, 2000);
  }

  async function copyText(value, label) {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      showTransientMessage(`${label} copied.`);
    } catch {
      showTransientMessage(`Failed to copy ${label.toLowerCase()}.`);
    }
  }

  async function handleCopyRuntimeNextStep() {
    await copyText(runtimeDecisionState.nextStep, "Runtime next step");
  }

  function handleDownloadIncidentSnapshot() {
    if (!incidentSnapshot) {
      return;
    }

    triggerFileDownload(
      `deploymate-deployment-${deploymentId}-incident-snapshot.json`,
      new Blob([JSON.stringify(incidentSnapshot, null, 2)], {
        type: "application/json;charset=utf-8",
      }),
    );
    showTransientMessage("Incident snapshot downloaded.");
  }

  function handleDownloadIncidentMarkdown() {
    if (!incidentSnapshot) {
      return;
    }

    triggerFileDownload(
      `deploymate-deployment-${deploymentId}-handoff.md`,
      new Blob([buildIncidentMarkdown(incidentSnapshot)], {
        type: "text/markdown;charset=utf-8",
      }),
    );
    showTransientMessage("Incident handoff markdown downloaded.");
  }

  function handleDownloadFilteredActivityCsv() {
    triggerFileDownload(
      `deploymate-deployment-${deploymentId}-activity.csv`,
      new Blob([buildActivityExportCsv(filteredActivity)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    showTransientMessage("Current activity view exported.");
  }

  async function handleRedeploy(event) {
    event.preventDefault();
    setRedeployError("");
    setRedeploySuccess("");

    if (redeployPreflight.errors.length > 0) {
      setRedeployError(redeployPreflight.errors[0]);
      return;
    }

    setRedeployReviewOpen(true);
  }

  async function handleRedeployConfirm() {
    setRedeploying(true);
    setRedeployError("");
    setRedeploySuccess("");

    if (
      !redeployConfirmationPhrase ||
      redeployConfirmationText.trim() !== redeployConfirmationPhrase
    ) {
      setRedeploying(false);
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
      setRedeployReviewOpen(false);
      setRedeployConfirmationText("");
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
    if (!deleteConfirmationPhrase || deleteConfirmationText.trim() !== deleteConfirmationPhrase) {
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
      setDeleteReviewOpen(false);
      setDeleteConfirmationText("");
      router.push("/app/deployment-workflow");
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
    setSavedTemplate(null);

    try {
      const response = await fetch(`${apiBaseUrl}/deployment-templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(buildTemplatePayload()),
      });
      const savedTemplateResponse = await readJsonOrError(
        response,
        "Failed to save deployment template.",
      );
      setSavedTemplate(savedTemplateResponse);
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
              <div className="eyebrow">Step 3</div>
              <h1 data-testid="runtime-detail-page-title">Step 3: Review runtime health and decide the next action</h1>
              <p>{runtimeHeroLead}</p>
              <p className="formHint">
                This page should answer three things fast: what is running, is it healthy, and what should you do next.
              </p>
            </div>
            <div className="buttonRow workspaceHeroActions" data-testid="runtime-detail-header-actions">
              {renderRuntimeDecisionPrimaryAction(
                "landingButton primaryButton workspacePrimaryAction",
                runtimeDecisionState.primaryAction === "Prepare rollout change"
                  ? "runtime-detail-open-redeploy-button"
                  : "runtime-detail-hero-primary-action",
              )}
              <Link href="/app/deployment-workflow" className="linkButton workspaceSecondaryAction">
                Back to deployment workflow
              </Link>
              {deploymentUrl && !runtimeDecisionState.primaryExternal ? (
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
                onClick={() => loadDeploymentDetails()}
                disabled={loading}
                className="workspaceGhostAction"
                data-testid="runtime-detail-refresh-button"
              >
                {loading ? "Refreshing..." : "Refresh"}
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
              <span>Right now</span>
              <strong>{runtimeDecisionState.focus}</strong>
              <p>{runtimeDecisionState.nextStep}</p>
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
          {runtimeServerAccessBlocked ? (
            <div
              className="banner subtle"
              data-testid="runtime-detail-admin-managed-live-checks-banner"
            >
              {adminManagedRuntimeMessage}
            </div>
          ) : null}
          {freshRolloutReview ? (
            <div
              className="banner subtle"
              data-testid="runtime-detail-fresh-rollout-banner"
            >
              {deploymentUrl
                ? "Fresh rollout: open the app once, then confirm health and recent activity before preparing another change."
                : "Fresh rollout: review overview, health, and recent activity before preparing another change."}
            </div>
          ) : null}
          {diagnosticsError ? <div className="banner error">{diagnosticsError}</div> : null}

          <article
            className="card formCard workspaceGuidePanel"
            data-testid="runtime-detail-main-next-step-card"
            id="runtime-detail-main-next-step"
          >
            <div className="sectionHeader workspaceGuideHeader">
              <div>
                <h2 data-testid="runtime-detail-main-next-step-title">Do this now</h2>
                <p className="formHint">
                  Start with one obvious action. Review first when the runtime is noisy. Change it only when the current state is believable.
                </p>
              </div>
            </div>

            <div className="workspaceGuideGrid">
              <div className="workspaceReviewerGrid">
                <article
                  className="workspaceReviewerCard"
                  data-testid="runtime-detail-main-next-step-item-focus"
                >
                  <span>{runtimeDecisionState.label}</span>
                  <strong>{runtimeDecisionState.focus}</strong>
                  <p>{runtimeDecisionState.why}</p>
                  <div className="actionCluster">
                    {renderRuntimeDecisionPrimaryAction(
                      "landingButton primaryButton",
                      "runtime-detail-main-next-step-action-focus",
                    )}
                    <Link
                      href={runtimeDecisionState.secondaryHref}
                      className="secondaryButton"
                      data-testid="runtime-detail-main-next-step-action-secondary"
                    >
                      {runtimeDecisionState.secondaryAction}
                    </Link>
                  </div>
                </article>
              </div>

              <aside className="workspaceGlancePanel">
                <div className="workspaceGlanceHeader">
                  <span className="eyebrow">What this page answers</span>
                  <strong>Current runtime</strong>
                </div>
                <div className="workspaceGlanceList">
                  {detailGlanceItems.map((item) => (
                    <div key={item.label} className="workspaceStatusCard workspaceGlanceItem">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                      <p data-testid={item.label === "Attention" ? "runtime-detail-attention-banner" : undefined}>
                        {item.detail}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="overviewAttentionItem" data-testid="runtime-detail-main-next-step-focus">
                  <div className="overviewAttentionHeader">
                    <span className={`status ${runtimeDecisionState.tone}`}>
                      {runtimeDecisionState.label.toLowerCase()}
                    </span>
                    <strong>{runtimeDecisionState.nextStep}</strong>
                  </div>
                  <p>
                    {runtimeDecisionState.why}
                  </p>
                </div>
                <div className="workspaceMetaLine">
                  {smokeMode ? (
                    <span data-testid="runtime-detail-smoke-banner">
                      Runtime detail smoke mode uses fixture deployment data.
                    </span>
                  ) : (
                    <span>Deployment, health, diagnostics, and activity keep refreshing while you review this runtime.</span>
                  )}
                </div>
              </aside>
            </div>
            <div
              className="filterTabs"
              role="tablist"
              aria-label="Deployment detail tabs"
              data-testid="runtime-detail-tabs-card"
            >
              <button
                type="button"
                className={detailTab === "overview" ? "active" : ""}
                onClick={() => setDetailTab("overview")}
                data-testid="runtime-detail-tab-overview"
              >
                Review runtime
              </button>
              {canMutateRuntime ? (
                <button
                  type="button"
                  className={detailTab === "change" ? "active" : ""}
                  onClick={() => setDetailTab("change")}
                  data-testid="runtime-detail-tab-change"
                >
                  Prepare change
                </button>
              ) : null}
              <button
                type="button"
                className={detailTab === "share" ? "active" : ""}
                onClick={() => setDetailTab("share")}
                data-testid="runtime-detail-tab-share"
              >
                Share and save
              </button>
              <button
                type="button"
                className={detailTab === "tools" ? "active" : ""}
                onClick={() => setDetailTab("tools")}
                data-testid="runtime-detail-tab-tools"
              >
                Logs and diagnostics
              </button>
            </div>
          </article>
        </div>

        {loading && !deployment ? <div className="empty">Loading deployment...</div> : null}

        {deployment ? (
          <>
            <section hidden={detailTab !== "overview"}>
            <div
              className="overviewGrid"
              data-testid="runtime-detail-overview-grid"
              id="runtime-detail-overview"
            >
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
                  <span>{runtimeOverviewMetaText}</span>
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

            {freshRolloutReview ? (
              <article className="card compactCard" data-testid="runtime-detail-fresh-rollout-checklist-card">
                <div className="sectionHeader">
                  <div>
                    <h2 data-testid="runtime-detail-fresh-rollout-checklist-title">
                      Verify this rollout before you move on
                    </h2>
                    <p className="formHint">
                      Treat the first review as part of deployment completion. Check the app, health, and latest activity once while the rollout context is still fresh.
                    </p>
                  </div>
                </div>
                <div className="workspaceReviewerGrid">
                  <article
                    className="workspaceReviewerCard"
                    data-testid="runtime-detail-fresh-rollout-checklist-app"
                  >
                    <span>1. App</span>
                    <strong>{deploymentUrl ? "Open the live app" : "Stay in runtime review"}</strong>
                    <p>
                      {deploymentUrl
                        ? "Use the primary action once, then come back here before opening change tools."
                        : "There is no public URL for this rollout, so the first verification stays on this page."}
                    </p>
                  </article>
                  <article
                    className="workspaceReviewerCard"
                    data-testid="runtime-detail-fresh-rollout-checklist-health"
                  >
                    <span>2. Health</span>
                    <strong>{health?.status || "unknown"}</strong>
                    <p>{freshRolloutHealthSummary}</p>
                  </article>
                  <article
                    className="workspaceReviewerCard"
                    data-testid="runtime-detail-fresh-rollout-checklist-activity"
                  >
                    <span>3. Activity</span>
                    <strong>{freshRolloutLatestEvent?.title || "No activity yet"}</strong>
                    <p>
                      {freshRolloutLatestEvent
                        ? `${freshRolloutActivitySummary} If that event looks wrong, open diagnostics before another rollout change.`
                        : "Wait for one meaningful runtime event before assuming this rollout is settled."}
                    </p>
                  </article>
                </div>
              </article>
            ) : null}

            <article className="card compactCard" data-testid="runtime-detail-risk-breakdown-card">
              <div className="sectionHeader">
                <div>
                  <h2 data-testid="runtime-detail-risk-breakdown-title">{runtimeOverviewTitle}</h2>
                  <p className="formHint">
                    {runtimeOverviewBody}
                  </p>
                </div>
              </div>
              <div className="workspaceReviewerGrid">
                <article className="workspaceReviewerCard">
                  <span>Runtime</span>
                  <strong>{deployment?.status || "unknown"}</strong>
                  <p>
                    {deployment?.status === "failed"
                      ? "A failed deployment keeps the page in incident mode until the cause is understood."
                      : "Deployment status alone is not currently forcing an incident path."}
                  </p>
                </article>
                <article className="workspaceReviewerCard">
                  <span>Health</span>
                  <strong>{health?.status || "unknown"}</strong>
                  <p>
                    {health?.status && health.status !== "healthy"
                      ? health?.error || "Health is degraded, so the runtime still needs review."
                      : "Health is not currently the main blocker."}
                  </p>
                </article>
                <article className="workspaceReviewerCard">
                  <span>Diagnostics</span>
                  <strong>{diagnostics?.activity?.recent_failure_count || 0} recent failures</strong>
                  <p>
                    {diagnostics?.activity?.recent_failure_count > 0
                      ? "Recent failures in diagnostics history still need explanation before the next rollout."
                      : "Diagnostics history is not currently adding new failure pressure."}
                  </p>
                </article>
              </div>
            </article>
            </section>

        {canMutateRuntime ? (
        <section hidden={detailTab !== "change"}>
        <article className="card formCard" data-testid="runtime-detail-change-readiness-card">
          <div className="sectionHeader">
            <div>
              <h2 data-testid="runtime-detail-change-readiness-title">Prepare the next rollout change</h2>
              <p className="formHint">
                Treat the redeploy form as a deliberate change surface. It should tell you first whether the draft is blocked, still needs judgment, or is ready for explicit review.
              </p>
            </div>
          </div>
          <div className="row">
            <span className="label">Current state</span>
            <span className={`status ${changeReadinessState.tone}`} data-testid="runtime-detail-change-readiness-state">
              {changeReadinessState.label}
            </span>
          </div>
          <div className="row">
            <span className="label">Focus</span>
            <span data-testid="runtime-detail-change-readiness-focus">{changeReadinessState.focus}</span>
          </div>
          <div className="row">
            <span className="label">Why</span>
            <span data-testid="runtime-detail-change-readiness-why">{changeReadinessState.why}</span>
          </div>
          <div className="row">
            <span className="label">What to do</span>
            <span data-testid="runtime-detail-change-readiness-next-step">{changeReadinessState.nextStep}</span>
          </div>
          <div className="backupSummaryBadges">
            <span className={`status ${changeReadinessState.tone}`}>changes {redeployChangeRows.length}</span>
            <span className="status error">errors {redeployPreflight.errors.length}</span>
            <span className="status warn">warnings {redeployPreflight.warnings.length}</span>
            <span className="status info">ports {suggestedPorts.length}</span>
          </div>
        </article>

        <article className="card formCard adminToolCard" id="runtime-detail-redeploy">
          <div className="adminToolHeader">
            <span className="adminToolEyebrow">Next step</span>
            <h2>Prepare the next rollout change</h2>
            <p>
              Adjust image, ports, or env vars here, then redeploy deliberately once this runtime is ready for an update. This follows the same guided rollout logic as the main deployment workflow.
            </p>
          </div>
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

            <div className="formActions runtimePrimaryActions">
              <button
                type="submit"
                className="landingButton primaryButton"
                disabled={redeploying || redeployPreflight.errors.length > 0}
                data-testid="runtime-detail-redeploy-review-button"
              >
                {redeploying ? "Redeploying..." : "Review redeploy"}
              </button>
              {redeploying ? <span className="formHint">Redeploying container...</span> : null}
              {!redeploying ? (
                <span className="formHint">
                  Open review first, then confirm the rollout change explicitly.
                </span>
              ) : null}
            </div>
          </form>

          {redeployPreflight.errors.length > 0 ? (
            <div className="banner error" data-testid="runtime-detail-redeploy-preflight-error">
              {redeployPreflight.errors[0]}
            </div>
          ) : null}
          {redeployPreflight.warnings.length > 0 ? (
            <div className="banner subtle" data-testid="runtime-detail-redeploy-preflight-warning">
              {redeployPreflight.warnings.join(" ")}
            </div>
          ) : null}
          <div className="banner subtle" data-testid="runtime-detail-redeploy-draft-summary">
            {buildRolloutDraftSummary({
              envRows,
              serverSelected: Boolean(deployment?.server_id),
              localDeploymentsEnabled: true,
              internalPort: form.internal_port,
              externalPort: form.external_port,
            })}
          </div>
          {redeployReviewOpen ? (
            <div className="stackedValue" data-testid="runtime-detail-redeploy-review-panel">
              <div className="banner subtle">
                {buildReviewIntroText("redeploy", redeployConfirmationPhrase).split(redeployConfirmationPhrase)[0]}
                <strong>{redeployConfirmationPhrase}</strong>
                {buildReviewIntroText("redeploy", redeployConfirmationPhrase).split(redeployConfirmationPhrase)[1]}
              </div>
              {redeployPreflight.warnings.length > 0 ? (
                <div className="banner subtle" data-testid="runtime-detail-redeploy-review-warning">
                  {redeployPreflight.warnings.join(" ")}
                </div>
              ) : null}
              <pre className="logs expandedBlock" data-testid="runtime-detail-redeploy-impact-summary">
                {redeployImpactSummary}
              </pre>
              <label className="field">
                <span>Type the confirmation phrase to continue</span>
                <input
                  value={redeployConfirmationText}
                  onChange={(event) => setRedeployConfirmationText(event.target.value)}
                  placeholder={redeployConfirmationPhrase}
                  data-testid="runtime-detail-redeploy-confirmation-input"
                />
              </label>
              <div className="actionCluster">
                <button
                  type="button"
                  className="landingButton primaryButton"
                  onClick={handleRedeployConfirm}
                  disabled={
                    redeploying ||
                    redeployConfirmationText.trim() !== redeployConfirmationPhrase
                  }
                  data-testid="runtime-detail-redeploy-confirm-button"
                >
                  {redeploying ? "Redeploying..." : "Confirm redeploy"}
                </button>
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={() => {
                    setRedeployReviewOpen(false);
                    setRedeployConfirmationText("");
                  }}
                  disabled={redeploying}
                  data-testid="runtime-detail-redeploy-cancel-button"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
          <div className="banner subtle">
            Current next-step guidance: {recommendedNextStep}
          </div>
          {redeployError ? <div className="banner error">{redeployError}</div> : null}
          {redeploySuccess ? <div className="banner success">{redeploySuccess}</div> : null}
        </article>
        </section>
        ) : null}

            <section hidden={detailTab !== "share"}>
            <AdminDisclosureSection
              title="Share, handoff, and save this setup"
              subtitle="Use this layer when you need to explain the current runtime, save it as a template, or open utility controls without crowding the main review path."
              badge={`${attentionItems.length} attention`}
              testId="runtime-detail-secondary-tools"
            >
            <div id="runtime-detail-handoff-tools" />
            <AdminDisclosureSection
              title="Share and safety controls"
              subtitle={
                canMutateRuntime
                  ? "Handoff actions, refresh, session exit, and deletion stay here so the main runtime path stays focused on review and rollout."
                  : "Handoff actions, refresh, and session controls stay here while destructive runtime actions remain admin-managed."
              }
              badge={deployment?.status || "unknown"}
              testId="runtime-detail-utility-disclosure"
            >
            <article className="card compactCard adminToolCard" data-testid="runtime-detail-handoff-card">
              <div className="adminToolHeader">
                <span className="adminToolEyebrow">Incident handoff</span>
                <h3>Explain the current runtime in plain language</h3>
                <p>Use this when you need to hand the situation to a teammate, reviewer, or operator who does not want to reconstruct it from raw diagnostics.</p>
              </div>
              <div className="row">
                <span className="label">What this means</span>
                <div className="stackedValue">
                  <pre className="logs expandedBlock" data-testid="runtime-detail-plain-language-summary">
                    {plainLanguageSummary || "Runtime summary is not available yet."}
                  </pre>
                </div>
              </div>
              <div className="row">
                <span className="label">Recommended next step</span>
                <span data-testid="runtime-detail-next-step">{incidentSnapshot?.next_step || detailPriority}</span>
              </div>
              <div className="actionCluster">
                <button
                  type="button"
                  className="landingButton secondaryButton"
                  onClick={() => copyText(plainLanguageSummary, "Plain-language summary")}
                  disabled={!plainLanguageSummary}
                  data-testid="runtime-detail-copy-plain-summary-button"
                >
                  Copy plain summary
                </button>
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={handleDownloadIncidentSnapshot}
                  disabled={!incidentSnapshot}
                  data-testid="runtime-detail-download-snapshot-button"
                >
                  Download JSON snapshot
                </button>
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={handleDownloadIncidentMarkdown}
                  disabled={!incidentSnapshot}
                  data-testid="runtime-detail-download-handoff-button"
                >
                  Download handoff markdown
                </button>
              </div>
            </article>

            <article className="card compactCard adminToolCard" data-testid="runtime-detail-summary-card">
              <div className="adminToolHeader">
                <span className="adminToolEyebrow">Utility layer</span>
                <h3>Share the current runtime or use account-level controls</h3>
                <p>Use these controls for handoff, quick copy actions, or final destructive steps after review.</p>
              </div>
              <div className="actionCluster">
                <button
                  type="button"
                  className="landingButton secondaryButton"
                  onClick={() => copyText(runtimeSummaryText, "Runtime summary")}
                  disabled={!runtimeSummaryText}
                  data-testid="runtime-detail-copy-summary-button"
                >
                  Copy summary
                </button>
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={() => loadDeploymentDetails()}
                  disabled={loading}
                >
                  {loading ? "Refreshing..." : "Refresh runtime"}
                </button>
                <button type="button" className="secondaryButton" onClick={handleLogout}>
                  Logout
                </button>
                {canMutateRuntime ? (
                  <button
                    type="button"
                    className="dangerButton"
                    onClick={() => setDeleteReviewOpen((current) => !current)}
                    disabled={deleting}
                    data-testid="runtime-detail-delete-review-button"
                    id="runtime-detail-delete-controls"
                  >
                    {deleteReviewOpen ? "Hide delete review" : "Review delete"}
                  </button>
                ) : null}
              </div>
              {canMutateRuntime && deleteReviewOpen ? (
                <div className="stackedValue" data-testid="runtime-detail-delete-review-panel">
                  <div className="banner error">
                    {buildReviewIntroText("delete", deleteConfirmationPhrase).split(deleteConfirmationPhrase)[0]}
                    <strong>{deleteConfirmationPhrase}</strong>
                    {buildReviewIntroText("delete", deleteConfirmationPhrase).split(deleteConfirmationPhrase)[1]}
                  </div>
                  <pre className="logs expandedBlock" data-testid="runtime-detail-delete-impact-summary">
                    {deleteImpactSummary}
                  </pre>
                  <label className="field">
                    <span>Type the confirmation phrase to continue</span>
                    <input
                      value={deleteConfirmationText}
                      onChange={(event) => setDeleteConfirmationText(event.target.value)}
                      placeholder={deleteConfirmationPhrase}
                      data-testid="runtime-detail-delete-confirmation-input"
                    />
                  </label>
                  <div className="actionCluster">
                    <button
                      type="button"
                      className="dangerButton"
                      onClick={handleDelete}
                      disabled={deleting || deleteConfirmationText.trim() !== deleteConfirmationPhrase}
                      data-testid="runtime-detail-delete-confirm-button"
                    >
                      {deleting ? "Deleting..." : "Delete deployment now"}
                    </button>
                    <button
                      type="button"
                      className="secondaryButton"
                      onClick={() => {
                        setDeleteReviewOpen(false);
                        setDeleteConfirmationText("");
                      }}
                      disabled={deleting}
                      data-testid="runtime-detail-delete-cancel-button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
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
                <span>{runtimeServerLabel}</span>
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
            </AdminDisclosureSection>

            <article className="card compactCard" data-testid="runtime-detail-template-card">
              <div className="sectionHeader">
                <div>
                  <h2>
                    {runtimeServerAccessBlocked
                      ? "Template handoff is admin-managed"
                      : "Save as template"}
                  </h2>
                  <p className="formHint">
                    {runtimeServerAccessBlocked
                      ? "This runtime belongs to an admin-managed remote target, so reusable rollout setup stays with admins until server sharing rules exist."
                      : "Turn the current deployment settings into a reusable preset, then continue template review and reuse inside the deployment workflow."}
                  </p>
                </div>
              </div>
              {runtimeServerAccessBlocked ? (
                <div
                  className="banner subtle"
                  data-testid="runtime-detail-template-admin-managed-banner"
                >
                  Ask an admin to create or share a reusable setup for this remote target. This keeps hidden server inventory from becoming a local template by mistake.
                </div>
              ) : (
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
                    Save image, ports, env vars, and server selection as a reusable handoff.
                  </span>
                </label>
                <div className="formActions">
	                  <button
	                    type="button"
	                    onClick={handleSaveTemplate}
	                    disabled={templateSaving || !templateName.trim() || !form.image.trim()}
	                    data-testid="runtime-detail-save-template-button"
	                  >
	                    {templateSaving ? "Saving template..." : "Save as template"}
	                  </button>
                  {savedTemplate?.id ? (
                    <Link
                      href={`/app/deployment-workflow?template=${savedTemplate.id}&template_action=preview&template_source=deployment-detail#templates`}
                      className="linkButton"
                    >
                      Open in workflow
                    </Link>
                  ) : null}
	                </div>
	              </div>
              )}
		              {savedTemplate?.id ? (
	                <div className="banner subtle" data-testid="runtime-detail-template-bridge-banner">
	                  Template "{savedTemplate.template_name}" is now part of the deployment workflow. Open it there to preview, reuse, or edit it in the main rollout screen.
	                </div>
	              ) : null}
	            </article>
	            </AdminDisclosureSection>
	            </section>

            <section hidden={detailTab !== "tools"}>
            <AdminDisclosureSection
              title="Logs, diagnostics, and activity"
              subtitle="Deeper runtime evidence stays here after the first-pass review is already clear."
              badge={`${attentionItems.length} attention`}
              testId="runtime-detail-tools-disclosure"
            >
            <div id="runtime-detail-activity-tools" />
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
                <span className="label">Plain-language summary</span>
                <span className="valueWithActions">
                  <span>Human-readable explanation of the current runtime state.</span>
                  <button
                    type="button"
                    className="smallButton"
                    onClick={() => copyText(plainLanguageSummary, "Plain-language summary")}
                    disabled={!plainLanguageSummary}
                  >
                    Copy
                  </button>
                </span>
              </div>
              <div className="row">
                <span className="label">Diagnostics target</span>
                <span className="valueWithActions">
                  <span>
                    {canAccessServers
                      ? diagnostics?.server_target || "N/A"
                    : deployment.server_id || runtimeServerAccessBlocked
                      ? "Managed by an admin"
                      : "N/A"}
                  </span>
                  {canAccessServers && diagnostics?.server_target ? (
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
                    <span>
                      {canAccessServers
                        ? diagnostics.server_target || "N/A"
                        : deployment.server_id || runtimeServerAccessBlocked
                          ? "Managed by an admin"
                          : "N/A"}
                    </span>
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
              <div className="form">
                <label className="field">
                  <span>Search activity</span>
                  <input
                    value={activityQuery}
                    onChange={(event) => setActivityQuery(event.target.value)}
                    placeholder="redeploy failed, health, delete"
                    data-testid="runtime-detail-activity-search"
                  />
                </label>
                <label className="field">
                  <span>Level</span>
                  <select
                    value={activityLevelFilter}
                    onChange={(event) => setActivityLevelFilter(event.target.value)}
                    data-testid="runtime-detail-activity-level-filter"
                  >
                    <option value="all">All levels</option>
                    <option value="error">Errors</option>
                    <option value="warn">Warnings</option>
                    <option value="success">Successes</option>
                    <option value="info">Info</option>
                  </select>
                </label>
                <label className="field">
                  <span>Sort</span>
                  <select
                    value={activitySort}
                    onChange={(event) => setActivitySort(event.target.value)}
                    data-testid="runtime-detail-activity-sort"
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="errors-first">Errors first</option>
                  </select>
                </label>
                <div className="formActions">
                  <button
                    type="button"
                    className="secondaryButton"
                    onClick={handleDownloadFilteredActivityCsv}
                    disabled={filteredActivity.length === 0}
                    data-testid="runtime-detail-activity-export-button"
                  >
                    Export current CSV
                  </button>
                </div>
              </div>
              <p className="formHint" data-testid="runtime-detail-activity-summary">
                Showing {filteredActivity.length} of {activity.length} activity event{activity.length === 1 ? "" : "s"}.
              </p>

              {filteredActivity.length === 0 ? (
                <div className="empty">No activity yet.</div>
              ) : (
                <div className="timeline">
                  {filteredActivity.map((item) => (
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
	            </AdminDisclosureSection>
	            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
