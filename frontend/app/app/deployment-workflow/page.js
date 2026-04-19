"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  smokeDeployments,
  smokeInternalRuntimeDeployment,
  smokeMode,
  smokeServers,
  smokeTemplates,
  smokeUser,
  smokeWorkflowDiskPressureOpsOverview,
} from "../../lib/smoke-fixtures";
import {
  copyTextToClipboard,
} from "../../lib/admin-page-utils";
import {
  buildCustomDomainIssues,
  buildDeploymentReviewTarget,
  buildDeploymentUrl,
  buildHostDiskPressureGuardrail,
  buildDeploymentWorkflowNextStep,
  buildDeploymentWorkflowState,
  buildEnvRowsFromObject,
  buildSecretRowsFromObject,
  buildEnvIssues,
  buildRolloutDraftSummary,
  buildTemplateDiff,
  formatAccessibleServerLabel,
  formatDate,
  formatPortMapping,
  formatServerLabel,
  formatSuggestedPorts,
  isRecentDate,
  normalizeCustomDomainValue,
  normalizeCreateDeploymentError,
  normalizeDeploymentActionError,
  readJsonOrError,
} from "../../lib/runtime-workspace-utils";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const localDeploymentsEnabled =
  process.env.NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED !== "0";
const smokeWorkflowScenario =
  process.env.NEXT_PUBLIC_SMOKE_DEPLOYMENT_WORKFLOW_SCENARIO || "default";
const smokeReviewWorkerDeployment =
  smokeDeployments.find((deployment) => deployment.id === "review-worker") || null;
const smokeRunningDeployments = smokeDeployments.filter((deployment) => deployment.status === "running");
const smokeInternalRuntimeShadowDeployment = {
  ...smokeInternalRuntimeDeployment,
  id: "internal-runtime-shadow",
  container_name: "internal-api-shadow",
  container_id: "container-internal-2",
  created_at: "2026-04-02T00:22:00Z",
};
const smokeTemplateCreatedDeployment = {
  ...smokeDeployments[0],
  id: "template-success-deployment",
  container_name: "template-success-runtime",
  container_id: "container-template-success-1",
  created_at: "2026-04-02T00:25:00Z",
};
const smokeCreatedDeployment = {
  ...smokeDeployments[0],
  id: "fresh-success-deployment",
  container_name: "fresh-success-runtime",
  container_id: "container-fresh-success-1",
  created_at: "2026-04-02T00:24:00Z",
};
const smokeFailedQueueReviewDeployments = smokeReviewWorkerDeployment
  ? [
      smokeReviewWorkerDeployment,
      {
        ...smokeReviewWorkerDeployment,
        id: "review-worker-shadow",
        container_name: "review-worker-shadow",
        container_id: "container-review-2",
        created_at: "2026-04-02T02:18:00Z",
        error: "Container restarted again before readiness recovered.",
      },
      ...smokeRunningDeployments,
    ]
  : smokeRunningDeployments;
const smokeWorkflowOpsOverview =
  smokeMode && smokeWorkflowScenario === "disk-pressure-blocked"
    ? smokeWorkflowDiskPressureOpsOverview
    : null;
const smokeWorkflowFixture =
  smokeMode && smokeWorkflowScenario === "first-deploy-after-server-review"
    ? {
        deployments: [],
        servers: smokeServers,
        templates: smokeTemplates,
        form: {
          image: "",
          name: "",
          internal_port: "",
          external_port: "",
          server_id: smokeServers[0]?.id || "",
        },
        workflowMessage: smokeServers[0]
          ? `Server "${smokeServers[0].name}" is already selected from Server Review. Continue with the first deployment while that target is still understood.`
          : "",
        workflowTab: "create",
        submitSuccess: "",
        createdDeployment: null,
        templateDeploySuccess: "",
        templateCreatedDeployment: null,
      }
    : smokeMode && smokeWorkflowScenario === "healthy-live-review"
      ? {
          deployments: smokeDeployments.filter((deployment) => deployment.status === "running"),
          servers: smokeServers,
          templates: smokeTemplates,
          form: {
            image: "",
            name: "",
            internal_port: "",
            external_port: "",
            server_id: "",
          },
          workflowMessage: "",
          workflowTab: "live",
          submitSuccess: "",
          createdDeployment: null,
          templateDeploySuccess: "",
          templateCreatedDeployment: null,
        }
    : smokeMode && smokeWorkflowScenario === "internal-only-live-review"
      ? {
          deployments: [
            smokeInternalRuntimeDeployment,
            smokeInternalRuntimeShadowDeployment,
            smokeDeployments[0],
          ],
          servers: smokeServers,
          templates: smokeTemplates,
          form: {
            image: "",
            name: "",
            internal_port: "",
            external_port: "",
            server_id: "",
          },
          workflowMessage: "",
          workflowTab: "live",
          submitSuccess: "",
          createdDeployment: null,
          templateDeploySuccess: "",
          templateCreatedDeployment: null,
        }
    : smokeMode && smokeWorkflowScenario === "failed-live-review"
      ? {
          deployments: smokeFailedQueueReviewDeployments,
          servers: smokeServers,
          templates: smokeTemplates,
          form: {
            image: "",
            name: "",
            internal_port: "",
            external_port: "",
            server_id: "",
          },
          workflowMessage: "",
          workflowTab: "live",
          submitSuccess: "",
          createdDeployment: null,
          templateDeploySuccess: "",
          templateCreatedDeployment: null,
        }
    : smokeMode && smokeWorkflowScenario === "disk-pressure-blocked"
      ? {
          deployments: smokeRunningDeployments,
          servers: smokeServers,
          templates: smokeTemplates,
          form: {
            image: "",
            name: "",
            internal_port: "",
            external_port: "",
            server_id: "",
          },
          workflowMessage: "",
          workflowTab: "create",
          submitSuccess: "",
          createdDeployment: null,
          templateDeploySuccess: "",
          templateCreatedDeployment: null,
        }
    : smokeMode && smokeWorkflowScenario === "template-deploy-success"
      ? {
          deployments: smokeDeployments,
          servers: smokeServers,
          templates: smokeTemplates,
          form: {
            image: "",
            name: "",
            internal_port: "",
            external_port: "",
            server_id: "",
          },
          workflowMessage: "",
          workflowTab: "templates",
          submitSuccess: "",
          createdDeployment: null,
          templateDeploySuccess:
            "Deployment created from template. Open deployment passport next while this rollout is still fresh.",
          templateCreatedDeployment: smokeTemplateCreatedDeployment,
        }
    : smokeMode && smokeWorkflowScenario === "create-deploy-success"
      ? {
          deployments: smokeDeployments,
          servers: smokeServers,
          templates: smokeTemplates,
          form: {
            image: "",
            name: "",
            internal_port: "",
            external_port: "",
            server_id: "",
          },
          workflowMessage: "",
          workflowTab: "create",
          submitSuccess:
            "Deployment created. Open deployment passport next while this rollout is still fresh.",
          createdDeployment: smokeCreatedDeployment,
          templateDeploySuccess: "",
          templateCreatedDeployment: null,
        }
    : smokeMode && smokeWorkflowScenario === "first-deploy-after-overview"
      ? {
          deployments: [],
          servers: smokeServers,
          templates: smokeTemplates,
          form: {
            image: "",
            name: "",
            internal_port: "",
            external_port: "",
            server_id: smokeServers[0]?.id || "",
          },
          workflowMessage: smokeServers[0]
            ? `Server "${smokeServers[0].name}" is already selected from Overview. Continue with the first deployment while that target is still understood.`
            : "",
          workflowTab: "create",
          submitSuccess: "",
          createdDeployment: null,
          templateDeploySuccess: "",
          templateCreatedDeployment: null,
        }
    : smokeMode && smokeWorkflowScenario === "member-waiting-for-admin-target"
      ? {
          deployments: [],
          servers: [],
          templates: [],
          form: {
            image: "",
            name: "",
            internal_port: "",
            external_port: "",
            server_id: "",
          },
          workflowMessage: "",
          workflowTab: "create",
          submitSuccess: "",
          createdDeployment: null,
          templateDeploySuccess: "",
          templateCreatedDeployment: null,
        }
      : smokeMode && !smokeUser.is_admin
        ? {
            deployments: smokeDeployments,
            servers: [],
            templates: [],
            form: {
              image: "",
              name: "",
              internal_port: "",
              external_port: "",
              server_id: "",
            },
            workflowMessage: "",
            workflowTab: "create",
            submitSuccess: "",
            createdDeployment: null,
            templateDeploySuccess: "",
            templateCreatedDeployment: null,
          }
    : {
        deployments: smokeDeployments,
        servers: smokeServers,
        templates: smokeTemplates,
        form: {
          image: "",
          name: "",
          internal_port: "",
          external_port: "",
          server_id: "",
        },
        workflowMessage: "",
        workflowTab: "create",
        submitSuccess: "",
        createdDeployment: null,
        templateDeploySuccess: "",
        templateCreatedDeployment: null,
      };

function buildRuntimeCardActionState(deployment) {
  const reviewTarget = buildDeploymentReviewTarget(deployment);
  const runtimeUrl = reviewTarget.href;
  const failed = deployment?.status === "failed";
  const stableWithoutPublicUrl = deployment?.status === "running" && !runtimeUrl;

  return {
    runtimeUrl,
    openActionLabel: reviewTarget.kind === "health" ? "Open health target" : "Open app",
    endpointLabel: reviewTarget.kind === "health" ? "Health target" : "Endpoint",
    emptyEndpointLabel: reviewTarget.kind === "health" ? "No health target" : "Internal only",
    detailsClassName: failed || !runtimeUrl ? "landingButton primaryButton" : "secondaryButton",
    detailsLabel: failed
      ? "Review runtime issues"
      : stableWithoutPublicUrl
        ? deployment?.runtime_shape === "stack"
          ? "Review stack runtime"
          : "Review stable runtime"
        : "View details",
    openAppClassName: failed ? "linkButton" : "landingButton primaryButton",
    showOpenAppPrimary: Boolean(runtimeUrl) && !failed,
    showOpenAppSecondary: Boolean(runtimeUrl) && failed,
  };
}

function buildRuntimeReviewState(deployment, visibleDeploymentsCount) {
  if (!deployment) {
    return {
      label: "Waiting",
      tone: "unknown",
      focus: "No live deployment is selected yet",
      nextStep: "Start one app first, then use this lane to check whether it is alive.",
      summary: "Step 3 stays quiet until there is something running or failing to review.",
      checks: [
        {
          label: "First check",
          value: "Start an app",
          detail: "A runtime review begins after the first deployment exists.",
        },
        {
          label: "Signal",
          value: "None yet",
          detail: "There is no health or endpoint signal to interpret yet.",
        },
        {
          label: "Then",
          value: "Return here",
          detail: "This lane becomes the place to verify the result.",
        },
      ],
    };
  }

  const reviewTarget = buildDeploymentReviewTarget(deployment);
  const runtimeUrl = reviewTarget.href;
  const deploymentName = deployment.container_name || deployment.image || "This deployment";

  if (deployment.status === "failed") {
    return {
      label: "Needs review",
      tone: "error",
      focus: `${deploymentName} failed before it became a safe next step`,
      nextStep: "Open runtime detail and read the failure context before deleting or redeploying.",
      summary: "Keep the queue calm: understand the failed runtime before starting another app.",
      checks: [
        {
          label: "First check",
          value: "Runtime detail",
          detail: "Use diagnostics and recent activity before taking a destructive action.",
        },
        {
          label: "Signal",
          value: "Failed",
          detail: deployment.error || "Deployment is currently failed.",
        },
        {
          label: "Then",
          value: "Decide safely",
          detail: "Redeploy or delete only after the cause is concrete enough to explain.",
        },
      ],
    };
  }

  if (deployment.status === "running" && runtimeUrl) {
    if (reviewTarget.kind === "health") {
      return {
        label: "Ready to verify",
        tone: "healthy",
        focus: `${deploymentName} is running with a saved health target`,
        nextStep: "Open the health target once, then return to runtime detail before deciding whether this runtime should stay or be replaced.",
        summary: `${visibleDeploymentsCount} live deployment${visibleDeploymentsCount === 1 ? "" : "s"} are visible. Start with the focused one and keep the rest secondary.`,
        checks: [
          {
            label: "First check",
            value: "Open health target",
            detail: "Confirm the saved health target responds before treating the runtime as settled.",
          },
          {
            label: "Signal",
            value: "Health target",
            detail: runtimeUrl,
          },
          {
            label: "Then",
            value: "Review detail",
            detail:
              deployment.runtime_shape === "stack"
                ? "Use runtime detail for health, activity, and guarded stack-change limits."
                : "Use runtime detail for health, activity, and deliberate changes.",
          },
        ],
      };
    }

    return {
      label: "Ready to verify",
      tone: "healthy",
      focus: `${deploymentName} is running with a public endpoint`,
      nextStep: "Open the app once, then return to runtime detail if anything looks off.",
      summary: `${visibleDeploymentsCount} live deployment${visibleDeploymentsCount === 1 ? "" : "s"} are visible. Start with the focused one and keep the rest secondary.`,
      checks: [
        {
          label: "First check",
          value: "Open app",
          detail: "Confirm the user-facing path works before preparing another rollout.",
        },
        {
          label: "Signal",
          value: "Public URL",
          detail: runtimeUrl,
        },
        {
          label: "Then",
          value: "Review detail",
          detail: "Use runtime detail for health, activity, and deliberate changes.",
        },
      ],
    };
  }

  if (deployment.status === "running") {
    if (deployment.runtime_shape === "stack") {
      return {
        label: "Review stack",
        tone: "warn",
        focus: `${deploymentName} is running without a saved health target`,
        nextStep: "Open runtime detail and confirm the stack summary, health, and activity before deciding whether a full replacement is necessary.",
        summary: "Step 3 should stay in runtime review until one health target is recorded for the whole stack.",
        checks: [
          {
            label: "First check",
            value: "Review detail",
            detail: "Confirm the stack summary, health signal, and recent activity from the runtime page.",
          },
          {
            label: "Signal",
            value: "Health target missing",
            detail: "This stack still lacks the one URL DeployMate should probe for runtime health.",
          },
          {
            label: "Then",
            value: "Stabilize first",
            detail: "Do not treat stack replacement as the default move until the runtime story is believable.",
          },
        ],
      };
    }

    return {
      label: "Stable private",
      tone: "healthy",
      focus: `${deploymentName} is running without a public endpoint`,
      nextStep: "Open runtime detail and confirm the private service signals before changing it.",
      summary: "There is no public app link here, so Step 3 should lead to runtime review instead of pretending the service can be clicked.",
      checks: [
        {
          label: "First check",
          value: "Review detail",
          detail: "Confirm ports, health, and activity from the runtime page.",
        },
        {
          label: "Signal",
          value: "Internal only",
          detail: "No public URL is assigned to this deployment.",
        },
        {
          label: "Then",
          value: "Keep or change",
          detail: "Prepare a rollout change only after the stable state is believable.",
        },
      ],
    };
  }

  return {
    label: "Check state",
    tone: "warn",
    focus: `${deploymentName} is ${deployment.status || "in an unknown state"}`,
    nextStep: "Open runtime detail and confirm what DeployMate knows before taking action.",
    summary: "This deployment is not clearly running or failed, so the safest action is a detail review.",
    checks: [
      {
        label: "First check",
        value: "Runtime detail",
        detail: "Use the detail page to avoid guessing from a compact queue card.",
      },
      {
        label: "Signal",
        value: deployment.status || "Unknown",
        detail: "The queue view is intentionally brief.",
      },
      {
        label: "Then",
        value: "Decide",
        detail: "Change or clean up only after the state is clear.",
      },
    ],
  };
}

function buildTemplateAssetState(template) {
  const useCount = Number(template?.use_count || 0);
  const lastUsedAt = template?.last_used_at || "";

  if (useCount === 0) {
    return {
      label: "Draft asset",
      detail: "Saved once, but not reused yet.",
    };
  }

  if (lastUsedAt && isRecentDate(lastUsedAt, 7)) {
    return {
      label: "Active handoff",
      detail: `Reused ${useCount} time${useCount === 1 ? "" : "s"} and still active in the last 7 days.`,
    };
  }

  return {
    label: "Stable baseline",
    detail: `Reused ${useCount} time${useCount === 1 ? "" : "s"} as a deliberate rollout baseline.`,
  };
}

function normalizeTemplateOwnerId(template) {
  return String(template?.owner_user_id || "").trim();
}

function templateOwnedByCurrentUser(template, currentUser) {
  const ownerUserId = normalizeTemplateOwnerId(template);
  const currentUserId = String(currentUser?.id || "").trim();
  return Boolean(ownerUserId && currentUserId && ownerUserId === currentUserId);
}

function templateHasForeignOwner(template, currentUser) {
  const ownerUserId = normalizeTemplateOwnerId(template);
  const currentUserId = String(currentUser?.id || "").trim();
  return Boolean(ownerUserId && currentUserId && ownerUserId !== currentUserId);
}

function buildTemplateOwnershipSummary(template, currentUser) {
  if (templateHasForeignOwner(template, currentUser)) {
    return {
      label: "Another operator's asset",
      detail:
        "Duplicate this baseline into your own handoff before deploying it directly or turning it into your working variant.",
      foreign: true,
      owned: false,
      legacy: false,
    };
  }

  if (templateOwnedByCurrentUser(template, currentUser)) {
    return {
      label: "Your asset",
      detail: "This saved baseline belongs to your current operator account.",
      foreign: false,
      owned: true,
      legacy: false,
    };
  }

  return {
    label: "Legacy asset",
    detail:
      "Owner is not recorded on this baseline yet. Review carefully and duplicate before repurposing it for another operator or client.",
    foreign: false,
    owned: false,
    legacy: true,
  };
}

function normalizeTemplateContextLabel(value) {
  return String(value || "").trim();
}

function buildTemplateContextSummary(template) {
  const contextLabel = normalizeTemplateContextLabel(template?.context_label);

  if (contextLabel) {
    return {
      label: contextLabel,
      detail: `This asset is labeled for ${contextLabel}.`,
      missing: false,
    };
  }

  return {
    label: "Needs context label",
    detail:
      "Add the client, environment, or operator context before this asset is treated as a trusted reusable baseline.",
    missing: true,
  };
}

function buildTemplateContextQueue(primaryTemplate, secondaryTemplates) {
  const focusContext = normalizeTemplateContextLabel(primaryTemplate?.context_label);

  if (secondaryTemplates.length === 0) {
    return {
      detail: focusContext
        ? `No additional saved assets currently sit outside ${focusContext}.`
        : "No additional saved assets are waiting behind this unlabeled baseline.",
      sections: [],
    };
  }

  if (focusContext) {
    const matchingTemplates = secondaryTemplates.filter(
      (template) => normalizeTemplateContextLabel(template?.context_label) === focusContext,
    );
    const outsideTemplates = secondaryTemplates.filter(
      (template) => normalizeTemplateContextLabel(template?.context_label) !== focusContext,
    );
    const sections = [];
    const detailParts = [];

    if (matchingTemplates.length > 0) {
      detailParts.push(
        `${matchingTemplates.length} more saved asset${matchingTemplates.length === 1 ? "" : "s"} match ${focusContext}.`,
      );
      sections.push({
        id: "same-context",
        title: "Same context",
        detail: `These saved assets already belong to ${focusContext}.`,
        templates: matchingTemplates,
      });
    } else {
      detailParts.push(`No other saved assets currently match ${focusContext}.`);
    }

    if (outsideTemplates.length > 0) {
      detailParts.push(
        `${outsideTemplates.length} saved asset${outsideTemplates.length === 1 ? "" : "s"} stay outside this context and remain in a separate queue below.`,
      );
      sections.push({
        id: "outside-context",
        title: "Outside this context",
        detail: `Keep these assets separate until you deliberately switch away from ${focusContext} or duplicate and relabel for a new handoff.`,
        templates: outsideTemplates,
      });
    }

    return {
      detail: detailParts.join(" "),
      sections,
    };
  }

  const unlabeledTemplates = secondaryTemplates.filter(
    (template) => !normalizeTemplateContextLabel(template?.context_label),
  );
  const labeledTemplates = secondaryTemplates.filter((template) =>
    normalizeTemplateContextLabel(template?.context_label),
  );
  const sections = [];

  if (unlabeledTemplates.length > 0) {
    sections.push({
      id: "missing-context",
      title: "Also missing context",
      detail: "These saved assets still need the same client or operating label before they become trusted baselines.",
      templates: unlabeledTemplates,
    });
  }

  if (labeledTemplates.length > 0) {
    sections.push({
      id: "labeled-contexts",
      title: "Labeled contexts",
      detail: "These assets already declare their client or operating context and stay separate from the unlabeled baseline.",
      templates: labeledTemplates,
    });
  }

  return {
    detail:
      labeledTemplates.length > 0
        ? `This focused asset still needs a context label. ${labeledTemplates.length} saved asset${labeledTemplates.length === 1 ? "" : "s"} are already labeled and stay separate below.`
        : "This focused asset still needs a context label before it becomes the trusted boundary for this queue.",
    sections,
  };
}

function templateCanDeployDirectly(template, currentUser) {
  return Boolean(normalizeTemplateContextLabel(template?.context_label)) && !templateHasForeignOwner(template, currentUser);
}

function buildFocusedTemplateDeployGuardrail(template, currentUser) {
  if (!normalizeTemplateContextLabel(template?.context_label)) {
    return "Add a client or operating context label before this asset becomes a direct deploy baseline again.";
  }

  if (templateHasForeignOwner(template, currentUser)) {
    return "Duplicate this baseline into your own handoff before deploying directly from another operator's asset.";
  }

  return "";
}

function buildTemplateQueueGuardrail(template, queueSectionId, currentUser) {
  const contextLabel = normalizeTemplateContextLabel(template?.context_label);

  if (!contextLabel) {
    return "Direct deploy stays off until this asset has a client or operating context label.";
  }

  if (templateHasForeignOwner(template, currentUser)) {
    if (queueSectionId === "outside-context") {
      return `Direct deploy stays off here. This baseline belongs to another operator, so duplicate it into your own handoff before switching away from ${contextLabel}.`;
    }

    return "Direct deploy stays off here. Duplicate this baseline into your own handoff before bringing it back into focus.";
  }

  if (queueSectionId === "outside-context") {
    return `Direct deploy stays off here. Switch focus to ${contextLabel} or duplicate and relabel it for the current handoff first.`;
  }

  return "Direct deploy opens only after you bring this asset into focus first.";
}

function extractComposeServiceNames(composeYaml) {
  if (!composeYaml) {
    return [];
  }

  const lines = String(composeYaml).split(/\r?\n/);
  const serviceNames = [];
  let inServicesBlock = false;
  let serviceIndent = null;

  for (const line of lines) {
    if (!inServicesBlock) {
      if (/^\s*services:\s*$/.test(line)) {
        inServicesBlock = true;
      }
      continue;
    }

    if (!line.trim()) {
      continue;
    }

    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;

    if (indent === 0) {
      break;
    }

    const serviceMatch = line.match(/^(\s+)([A-Za-z0-9._-]+):\s*$/);
    if (!serviceMatch) {
      continue;
    }

    const currentIndent = serviceMatch[1].length;
    if (serviceIndent === null) {
      serviceIndent = currentIndent;
    }

    if (currentIndent === serviceIndent) {
      serviceNames.push(serviceMatch[2]);
    }
  }

  return serviceNames;
}

function buildComposeIntakeValidation(draft, options = {}) {
  const {
    localDeploymentsEnabled = true,
    canAccessServers = true,
  } = options;
  const errors = [];
  const warnings = [];
  const composeYaml = draft.compose_yaml.trim();
  const stackName = draft.stack_name.trim();
  const primaryService = draft.primary_service.trim();
  const healthTarget = draft.health_target.trim();

  if (!stackName) {
    errors.push("Stack name is required.");
  }

  if (!primaryService) {
    errors.push("Primary service is required.");
  }

  if (!healthTarget) {
    errors.push("Health target is required.");
  }

  if (!composeYaml) {
    errors.push("Compose file is required.");
  }

  if (!localDeploymentsEnabled && !draft.server_id) {
    errors.push(
      canAccessServers
        ? "This environment is remote-only. Choose a saved server target."
        : "Server targets are managed by an admin for this workspace.",
    );
  }

  if (composeYaml && !/^\s*services:\s*$/m.test(composeYaml)) {
    errors.push("Compose file must include a top-level services: block.");
  }

  const serviceNames = extractComposeServiceNames(composeYaml);

  if (composeYaml && serviceNames.length === 0) {
    errors.push("Compose file must declare at least one service under services:.");
  }

  if (primaryService && serviceNames.length > 0 && !serviceNames.includes(primaryService)) {
    errors.push(`Primary service "${primaryService}" was not found in the compose services list.`);
  }

  if (healthTarget && !/^https?:\/\/\S+$/i.test(healthTarget)) {
    errors.push("Health target must be a full http(s) URL for stack deploy v0.");
  }

  if (composeYaml && !/\bimage:\s*\S+/m.test(composeYaml)) {
    warnings.push("This v0 intake is designed around image-based services first. Build-only stacks still need follow-up.");
  }

  if (/\$\{[^}]+\}/.test(composeYaml)) {
    warnings.push("Compose env interpolation is noted, but this v0 intake does not review the external env contract yet.");
  }

  return { errors, warnings, serviceNames };
}

function buildComposeIntakeState(draft, validation) {
  const draftStarted =
    draft.stack_name.trim() ||
    draft.primary_service.trim() ||
    draft.health_target.trim() ||
    draft.compose_yaml.trim();

  if (!draftStarted) {
    return {
      tone: "info",
      label: "Waiting",
      focus: "Compose stack intake stays secondary until you really need a multi-service rollout",
      why: "Single-app deploy is still the shortest path. Open this lane only when one workload needs to be owned as one stack runtime.",
      nextStep: "Start with stack name, primary service, health target, and one compose file when the workload is truly multi-service.",
    };
  }

  if (validation.errors.length > 0) {
    return {
      tone: "error",
      label: "Blocked",
      focus: "The compose intake draft is still incomplete",
      why: validation.errors[0],
      nextStep: "Fix the first blocking field, then confirm the primary service and health target for the whole stack.",
    };
  }

  if (validation.warnings.length > 0) {
    return {
      tone: "warn",
      label: "Review",
      focus: `${validation.serviceNames.length} service${validation.serviceNames.length === 1 ? "" : "s"} are detected for stack intake`,
      why: validation.warnings[0],
      nextStep: "Keep the stack narrow: one compose file, one primary service, one health target, and one rollback unit.",
    };
  }

  return {
    tone: "healthy",
      label: "Ready",
      focus: `${draft.stack_name.trim()} is ready for compose intake review`,
      why: `${draft.primary_service.trim()} can act as the primary service and ${draft.health_target.trim()} can act as the health target for one stack runtime.`,
      nextStep: "Deploy the stack now, then open runtime detail to review the primary service as one runtime unit.",
    };
  }

function buildComposeIntakeSummary(draft, validation) {
  if (validation.errors.length > 0) {
    return "";
  }

  return [
    `Stack name: ${draft.stack_name.trim()}`,
    "Runtime shape: stack",
    "Release source: compose",
    `Primary service: ${draft.primary_service.trim()}`,
    `Health target: ${draft.health_target.trim()}`,
    `Target: ${draft.server_id || "Local Docker target"}`,
    `Detected services: ${validation.serviceNames.join(", ")}`,
    "Rollback unit: whole stack",
    "Supported v0 subset: one compose file, image-based services first, one primary service, one health target.",
  ].join("\n");
}

function buildRequestedWorkflowQuery(search = "") {
  const params = new URLSearchParams(search);

  return {
    templateId: params.get("template") || "",
    templateAction: params.get("template_action") || "preview",
    templateSource: params.get("template_source") || "",
    serverId: params.get("server") || "",
    source: params.get("source") || "",
  };
}

function DeploymentWorkflowPageContent() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(smokeMode);
  const [authFallbackVisible, setAuthFallbackVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState(smokeMode ? smokeUser : null);
  const [deployments, setDeployments] = useState(smokeMode ? smokeWorkflowFixture.deployments : []);
  const [servers, setServers] = useState(smokeMode ? smokeWorkflowFixture.servers : []);
  const [templates, setTemplates] = useState(smokeMode ? smokeWorkflowFixture.templates : []);
  const [loading, setLoading] = useState(!smokeMode);
  const [serversLoading, setServersLoading] = useState(!smokeMode);
  const [templatesLoading, setTemplatesLoading] = useState(!smokeMode);
  const [opsOverviewLoading, setOpsOverviewLoading] = useState(!smokeMode);
  const [opsOverview, setOpsOverview] = useState(smokeMode ? smokeWorkflowOpsOverview : null);
  const [error, setError] = useState("");
  const [serversError, setServersError] = useState("");
  const [templatesError, setTemplatesError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(
    smokeMode ? smokeWorkflowFixture.submitSuccess : "",
  );
  const [createdDeployment, setCreatedDeployment] = useState(
    smokeMode ? smokeWorkflowFixture.createdDeployment : null,
  );
  const [templateSubmitting, setTemplateSubmitting] = useState(false);
  const [templateSubmitError, setTemplateSubmitError] = useState("");
  const [templateSubmitSuccess, setTemplateSubmitSuccess] = useState("");
  const [templateDeployError, setTemplateDeployError] = useState("");
  const [templateDeploySuccess, setTemplateDeploySuccess] = useState(
    smokeMode ? smokeWorkflowFixture.templateDeploySuccess : "",
  );
  const [templateCreatedDeployment, setTemplateCreatedDeployment] = useState(
    smokeMode ? smokeWorkflowFixture.templateCreatedDeployment : null,
  );
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
  const [templateQuery, setTemplateQuery] = useState("");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [templatePreviewId, setTemplatePreviewId] = useState(smokeMode ? "smoke-template" : "");
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [workflowMessage, setWorkflowMessage] = useState(smokeMode ? smokeWorkflowFixture.workflowMessage : "");
  const [suggestedPorts, setSuggestedPorts] = useState([]);
  const [suggestedPortsLoading, setSuggestedPortsLoading] = useState(false);
  const [workflowTab, setWorkflowTab] = useState(
    smokeMode ? smokeWorkflowFixture.workflowTab : "create",
  );
  const [createAdvancedOpen, setCreateAdvancedOpen] = useState(false);
  const [stackDraft, setStackDraft] = useState({
    stack_name: "",
    primary_service: "",
    health_target: "",
    compose_yaml: "",
    server_id: smokeMode ? smokeWorkflowFixture.form.server_id : "",
  });
  const [stackIntakeError, setStackIntakeError] = useState("");
  const [stackIntakeSuccess, setStackIntakeSuccess] = useState("");
  const [stackSubmitting, setStackSubmitting] = useState(false);
  const createSectionRef = useRef(null);
  const createImageInputRef = useRef(null);
  const handoffImageFocusAppliedRef = useRef(false);
  const [form, setForm] = useState({
    image: smokeMode ? smokeWorkflowFixture.form.image : "",
    name: smokeMode ? smokeWorkflowFixture.form.name : "",
    internal_port: smokeMode ? smokeWorkflowFixture.form.internal_port : "",
    external_port: smokeMode ? smokeWorkflowFixture.form.external_port : "",
    server_id: smokeMode ? smokeWorkflowFixture.form.server_id : "",
    custom_domain: smokeMode ? smokeWorkflowFixture.form.custom_domain || "" : "",
    tls_enabled: smokeMode ? Boolean(smokeWorkflowFixture.form.tls_enabled) : false,
  });
  const [templateName, setTemplateName] = useState("");
  const [templateContextLabel, setTemplateContextLabel] = useState("");
  const [envRows, setEnvRows] = useState([{ key: "", value: "" }]);
  const [secretRows, setSecretRows] = useState([{ key: "", value: "" }]);
  const [requestedWorkflowQuery, setRequestedWorkflowQuery] = useState(() =>
    smokeMode
      ? buildRequestedWorkflowQuery(process.env.NEXT_PUBLIC_SMOKE_WORKFLOW_QUERY || "")
      : buildRequestedWorkflowQuery(),
  );
  const canAccessServers = Boolean(currentUser?.is_admin);
  const serverAccessBlocked = !canAccessServers && !localDeploymentsEnabled;
  const memberHasLiveDeployments = serverAccessBlocked && deployments.length > 0;
  const waitingForAdminTarget = serverAccessBlocked && !memberHasLiveDeployments;

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

    return [
      deployment.image,
      deployment.container_name,
      canAccessServers ? deployment.server_name : null,
      canAccessServers ? deployment.server_host : null,
      deployment.status,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedDeploymentQuery));
  });
  const runningDeploymentCount = deployments.filter((deployment) => deployment.status === "running").length;
  const failedDeploymentCount = deployments.filter((deployment) => deployment.status === "failed").length;
  const deployBlocker = buildHostDiskPressureGuardrail(opsOverview, {
    deploymentsTotal: deployments.length,
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

      return [
        template.template_name,
        template.context_label,
        template.image,
        template.name,
        template.server_name,
        template.server_host,
        Object.keys(template.env || {}).join(" "),
        Object.keys(template.secrets || {}).join(" "),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedTemplateQuery));
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
  const primaryTemplate = previewTemplate || filteredTemplates[0] || null;
  const secondaryTemplates = primaryTemplate
    ? filteredTemplates.filter((template) => template.id !== primaryTemplate.id)
    : [];
  const templateAssetMode = currentUser?.plan === "team" ? "team asset" : "workspace asset";
  const templateLaneTitle =
    currentUser?.plan === "team"
      ? "Step 2B: Review team handoff assets"
      : "Step 2B: Review reusable rollout setups";
  const primaryTemplateAssetState = primaryTemplate
    ? buildTemplateAssetState(primaryTemplate)
    : null;
  const primaryTemplateOwnership = primaryTemplate
    ? buildTemplateOwnershipSummary(primaryTemplate, currentUser)
    : null;
  const primaryTemplateContext = buildTemplateContextSummary(primaryTemplate);
  const templateContextQueue = buildTemplateContextQueue(primaryTemplate, secondaryTemplates);
  const primaryTemplateDeployGuardrail = buildFocusedTemplateDeployGuardrail(primaryTemplate, currentUser);
  const primaryTemplateCanDeployDirectly = templateCanDeployDirectly(primaryTemplate, currentUser);
  const primaryTemplateCanEditDirectly = !primaryTemplateOwnership?.foreign;
  const primaryTemplateCanDeleteDirectly = !primaryTemplateOwnership?.foreign;
  const templateLaneGuideItems = [
    {
      label: "1. Review asset",
      value: primaryTemplate?.template_name || "Choose one template",
      detail:
        "Keep one saved setup in focus first so the next operator can verify server, ports, and reuse history before deploying it again.",
    },
    {
      label: "2. Reuse stable setup",
      value: primaryTemplateAssetState?.label || "No asset yet",
      detail:
        "Deploy directly from the focused template only when it still looks like the right baseline for this rollout.",
    },
    {
      label: "3. Edit or duplicate",
      value: currentUser?.plan === "team" ? "Protect the baseline" : "Keep changes deliberate",
      detail:
        "Edit when the focused baseline is still yours and should change for future runs. Duplicate first when another operator, one client, or one handoff needs a variant.",
    },
    {
      label: "4. Delete last",
      value: templates.length > 0 ? `${templates.length} saved` : "None saved",
      detail:
        "Delete only after you are sure the setup is no longer part of the current handoff path.",
    },
  ];
  const workflowState = buildDeploymentWorkflowState({
    isAdmin: canAccessServers,
    localDeploymentsEnabled,
    deploymentsTotal: deployments.length,
    failedDeployments: failedDeploymentCount,
    serversTotal: servers.length,
    deployBlocker,
  });
  const workflowPriority =
    serverAccessBlocked
      ? "Admins manage the saved server target here. Your job on this page is still choosing what app should run next."
      : workflowState.mode === "prerequisite"
      ? "Before Step 2 can start for a remote rollout, Step 1 needs one saved server target."
      : workflowState.mode === "guardrail"
        ? "The DeployMate host needs disk cleanup before another rollout starts from this workspace."
      : workflowState.mode === "live"
        ? "One rollout needs attention. Review what is already running before you start another one."
        : templates.length > 0
          ? "You can start from one app image, one compose stack intake, or one saved setup."
          : "This page is where you choose one app image or bring one compose stack.";
  const workflowPrimaryMode = workflowState.mode === "live" ? "live" : "create";
  const primaryRuntimeDeployment =
    filteredDeployments.find((deployment) => deployment.status === "failed") ||
    filteredDeployments[0] ||
    null;
  const primaryRuntimeActionState = primaryRuntimeDeployment
    ? buildRuntimeCardActionState(primaryRuntimeDeployment)
    : null;
  const primaryRuntimeReviewState = buildRuntimeReviewState(
    primaryRuntimeDeployment,
    filteredDeployments.length,
  );
  const secondaryRuntimeDeployments = primaryRuntimeDeployment
    ? filteredDeployments.filter((deployment) => deployment.id !== primaryRuntimeDeployment.id)
    : [];
  const requestedTemplateId = requestedWorkflowQuery.templateId;
  const requestedTemplateAction = requestedWorkflowQuery.templateAction;
  const requestedTemplateSource = requestedWorkflowQuery.templateSource;
  const requestedServerId = requestedWorkflowQuery.serverId;
  const requestedSource = requestedWorkflowQuery.source;
  const requestedFromOverview = requestedSource === "overview-first-deploy";
  const requestedFromServerReview = requestedSource === "server-review";
  const requestedWithServerContext = requestedFromServerReview || requestedFromOverview;
  const shouldAutoFocusEntryImage = requestedWithServerContext && !serverAccessBlocked;
  const rolloutDraftHasEnvRows = envRows.some((row) => row.key.trim() || row.value.trim());
  const selectedCreateServer =
    servers.find((server) => server.id === form.server_id) || null;
  const selectedStackServer =
    servers.find((server) => server.id === stackDraft.server_id) || null;
  const selectedServerLabel = selectedCreateServer
    ? formatServerLabel(selectedCreateServer.name, selectedCreateServer.host)
    : "";
  const stepTwoLead = waitingForAdminTarget
    ? "Step 1 still needs an admin to confirm one server target before this page becomes the main path."
    : selectedCreateServer
      ? `Step 1 is done on ${selectedServerLabel}. Now choose one app to run on that server.`
      : workflowPriority;
  const stepTwoSupport = waitingForAdminTarget
      ? "This page should not make you guess. Until the target is confirmed, the only real next step is asking an admin to finish Step 1."
    : serverAccessBlocked
      ? "Keep this page focused on the rollout itself. The saved server target stays with admins until they confirm it."
      : workflowState.mode === "prerequisite"
        ? "Do not overthink this page yet. Save one server in Step 1 first, then come back and keep Step 2 focused on the app you want to start."
      : workflowState.mode === "guardrail"
        ? "Do not start another rollout from here until the DeployMate host has enough free space again."
      : workflowPrimaryMode === "live"
        ? "Because something already needs review, start by checking the live queue before you create another deployment."
        : "Keep Step 2 simple: choose one app image, a compose stack intake, or a saved setup first, then open advanced fields only if the rollout really needs them.";
  const deploymentWorkflowHeroTitle = waitingForAdminTarget
    ? "Wait for one admin-managed target."
    : workflowState.mode === "prerequisite"
      ? "Finish Step 1 before rollout setup."
      : workflowState.mode === "guardrail"
        ? "Clear host disk pressure before another rollout."
        : workflowPrimaryMode === "live"
          ? "Review live apps before another rollout."
          : selectedCreateServer
            ? `Choose what to run on ${selectedCreateServer.name || selectedServerLabel}.`
            : templates.length > 0
              ? "Choose one app or one saved setup."
              : "Choose one app to run first.";
  const firstDeployHandoffSummary =
    selectedCreateServer && requestedWithServerContext
      ? requestedFromOverview
        ? `Overview already handed you "${selectedCreateServer.name}". Set the image next and leave everything else closed unless the rollout really needs more.`
        : `Step 1 already handed you "${selectedCreateServer.name}". Set the image next and leave everything else closed unless the rollout really needs more.`
      : "";
  const primaryRuntimeTargetLabel = primaryRuntimeDeployment
    ? formatAccessibleServerLabel({
        canAccessServers,
        serverName: primaryRuntimeDeployment.server_name,
        serverHost: primaryRuntimeDeployment.server_host,
        serverId: primaryRuntimeDeployment.server_id,
        localLabel: "Local target",
        managedLabel: "Admin-managed target",
      })
    : "";

  function getSuggestedExternalPort() {
    return suggestedPorts.length > 0 ? String(suggestedPorts[0]) : "";
  }

  async function fetchCurrentUser() {
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

  async function loadServers(user, silent = false) {
    if (!user?.is_admin) {
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
      const data = await readJsonOrError(response, "Failed to load workspace overview.");
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

  async function refreshWorkspace(silent = false) {
    if (smokeMode) {
      return;
    }

    const user = await fetchCurrentUser();
    await Promise.all([
      loadDeployments(silent),
      loadServers(user, silent),
      loadTemplates(silent),
      loadOpsOverview(silent),
    ]);
  }

  useEffect(() => {
    if (smokeMode || typeof window === "undefined") {
      return;
    }

    setRequestedWorkflowQuery(buildRequestedWorkflowQuery(window.location.search));
  }, []);

  useEffect(() => {
    if (smokeMode) {
      return;
    }

    async function checkAuthAndLoad() {
      try {
        await refreshWorkspace();
        setAuthChecked(true);
        setAuthFallbackVisible(false);
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
      refreshWorkspace(true);
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

  useEffect(() => {
    if (
      form.name.trim() ||
      form.internal_port.trim() ||
      form.custom_domain.trim() ||
      form.tls_enabled ||
      templateName.trim() ||
      rolloutDraftHasEnvRows ||
      editingTemplateId
    ) {
      setCreateAdvancedOpen(true);
    }
  }, [
    editingTemplateId,
    form.custom_domain,
    form.internal_port,
    form.name,
    form.tls_enabled,
    rolloutDraftHasEnvRows,
    templateName,
  ]);

  useEffect(() => {
    if (serverAccessBlocked) {
      if (memberHasLiveDeployments && workflowTab !== "live") {
        setWorkflowTab("live");
      }
      return;
    }

    if (workflowState.mode === "live") {
      setWorkflowTab("live");
      return;
    }

    if ((workflowState.mode === "prerequisite" || deployments.length === 0) && workflowTab === "live") {
      setWorkflowTab("create");
    }
  }, [deployments.length, memberHasLiveDeployments, serverAccessBlocked, workflowState.mode, workflowTab]);

  useEffect(() => {
    if (requestedTemplateSource !== "deployment-detail") {
      return;
    }

    setWorkflowMessage(
      "Template opened from deployment detail as a reusable handoff asset. Review it here, reuse it as-is, or edit a deliberate variant in the main rollout workspace.",
    );
  }, [requestedTemplateSource]);

  useEffect(() => {
    if (!requestedServerId || servers.length === 0) {
      return;
    }

    const targetServer = servers.find((server) => server.id === requestedServerId);
    if (!targetServer) {
      return;
    }

    setForm((currentForm) => {
      if (currentForm.server_id === targetServer.id) {
        return currentForm;
      }

      return {
        ...currentForm,
        server_id: targetServer.id,
      };
    });
    setWorkflowTab("create");

    if (requestedFromServerReview) {
      setWorkflowMessage(
        `Server "${targetServer.name}" is already selected from Server Review. Continue with the first deployment while that target is still understood.`,
      );
      return;
    }

    if (requestedFromOverview) {
      setWorkflowMessage(
        `Server "${targetServer.name}" is already selected from Overview. Continue with the first deployment while that target is still understood.`,
      );
    }
  }, [requestedFromOverview, requestedFromServerReview, requestedServerId, servers]);

  useEffect(() => {
    if (!requestedTemplateId || templates.length === 0) {
      return;
    }

    const targetTemplate = templates.find((template) => template.id === requestedTemplateId);
    if (!targetTemplate) {
      return;
    }

    setTemplatePreviewId(targetTemplate.id);

    if (requestedTemplateAction === "edit") {
      applyTemplateToForm(targetTemplate, { startEditing: true });
    } else {
      setEditingTemplateId("");
      setTemplateName(targetTemplate.template_name || "");
      setTemplateContextLabel(targetTemplate.context_label || "");
    }

    if (requestedTemplateSource === "deployment-detail") {
      setWorkflowMessage(
        requestedTemplateAction === "edit"
          ? `Template "${targetTemplate.template_name}" opened from deployment detail and loaded as a handoff asset for editing.`
          : `Template "${targetTemplate.template_name}" opened from deployment detail as a handoff asset. Review it, reuse it, or edit a deliberate variant here.`,
      );
    }
  }, [requestedTemplateAction, requestedTemplateId, requestedTemplateSource, templates]);

  useEffect(() => {
    if (!shouldAutoFocusEntryImage || handoffImageFocusAppliedRef.current) {
      return;
    }

    handoffImageFocusAppliedRef.current = true;
    window.setTimeout(() => {
      const imageInput = createImageInputRef.current;
      if (imageInput instanceof HTMLInputElement) {
        imageInput.focus({ preventScroll: true });
      }
    }, 0);
  }, [shouldAutoFocusEntryImage]);

  function updateFormField(event) {
    const { name, type, value, checked } = event.target;
    setForm((currentForm) => {
      const nextForm = {
        ...currentForm,
        [name]: type === "checkbox" ? checked : value,
      };

      if (name === "server_id" && !currentForm.external_port.trim()) {
        nextForm.external_port = "";
      }

      return nextForm;
    });
  }

  function updateStackDraftField(event) {
    const { name, value } = event.target;
    setStackDraft((currentDraft) => ({
      ...currentDraft,
      [name]: value,
    }));
    setStackIntakeError("");
    setStackIntakeSuccess("");
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

  function updateSecretRow(index, field, value) {
    setSecretRows((currentRows) =>
      currentRows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    );
  }

  function addSecretRow() {
    setSecretRows((currentRows) => [...currentRows, { key: "", value: "" }]);
  }

  function focusCreateForm(options = {}) {
    const { scrollBehavior = "smooth", focusImage = true } = options;

    const scrollAndFocus = () => {
      const createSection = createSectionRef.current;
      if (createSection instanceof HTMLElement) {
        createSection.scrollIntoView({ behavior: scrollBehavior, block: "start" });
      }

      if (!focusImage) {
        return;
      }

      window.setTimeout(() => {
        const imageInput = createImageInputRef.current;
        if (imageInput instanceof HTMLInputElement) {
          imageInput.focus();
        }
      }, scrollBehavior === "smooth" ? 180 : 0);
    };

    if (workflowTab !== "create") {
      setWorkflowTab("create");
      window.setTimeout(scrollAndFocus, 80);
      return;
    }

    scrollAndFocus();
  }

  function removeEnvRow(index) {
    setEnvRows((currentRows) => {
      if (currentRows.length === 1) {
        return [{ key: "", value: "" }];
      }

      return currentRows.filter((_, rowIndex) => rowIndex !== index);
    });
  }

  function removeSecretRow(index) {
    setSecretRows((currentRows) => {
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

  function buildSecretPayload(rows) {
    const secrets = {};
    for (const row of rows) {
      const key = row.key.trim();
      const value = row.value;
      if (!key || !value.trim()) {
        continue;
      }
      secrets[key] = value;
    }
    return secrets;
  }

  function buildCurrentDraft() {
    return {
      id: editingTemplateId || "",
      template_name: templateName.trim(),
      context_label: templateContextLabel.trim(),
      image: form.image.trim(),
      name: form.name.trim(),
      internal_port: form.internal_port.trim(),
      external_port: form.external_port.trim(),
      server_id: form.server_id,
      custom_domain: normalizeCustomDomainValue(form.custom_domain),
      tls_enabled: form.tls_enabled,
      env: buildEnvPayload(envRows),
      secrets: buildSecretPayload(secretRows),
      envRows,
      secretRows,
    };
  }

  function buildTemplateDraftFromTemplate(template) {
    return {
      id: template.id,
      template_name: template.template_name || "",
      context_label: template.context_label || "",
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
      custom_domain: "",
      tls_enabled: false,
      env: template.env || {},
      secrets: template.secrets || {},
      envRows: buildEnvRowsFromObject(template.env || {}),
      secretRows: buildSecretRowsFromObject(template.secrets || {}),
    };
  }

  function validateTemplateDraft(draft, options = {}) {
    const {
      forDeployment = false,
      ignoreTemplateId = "",
      canAccessServers: hasServerAccess = true,
    } = options;
    const errors = [];
    const warnings = [];
    const internalPort = draft.internal_port.trim();
    const externalPort = draft.external_port.trim();
    const envIssues = buildEnvIssues(draft.envRows || []);
    const secretIssues = buildEnvIssues(draft.secretRows || []).map((issue) =>
      issue.replaceAll("Env var", "Secret"),
    );
    const customDomainIssues = buildCustomDomainIssues(draft.custom_domain, draft.tls_enabled);

    if (!draft.image.trim()) {
      errors.push("Image is required.");
    }

    if ((internalPort && !externalPort) || (!internalPort && externalPort)) {
      errors.push("Internal port and external port must be provided together.");
    }

    if (!localDeploymentsEnabled && !draft.server_id) {
      errors.push(
        hasServerAccess
          ? "This environment is remote-only. Choose a saved server target."
          : "Server targets are managed by an admin for this workspace.",
      );
    }

    errors.push(...envIssues);
    errors.push(...secretIssues);
    errors.push(...customDomainIssues);

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
      custom_domain: "",
      tls_enabled: false,
    });
    setEnvRows(buildEnvRowsFromObject(template.env || {}));
    setSecretRows(buildSecretRowsFromObject(template.secrets || {}));
    setTemplateName(template.template_name || "");
    setTemplateContextLabel(template.context_label || "");
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
    setTemplateContextLabel("");
    setTemplateSubmitError("");
    setTemplateSubmitSuccess("");
  }

  function renderTemplateQueueCard(template, queueSectionId) {
    const ownership = buildTemplateOwnershipSummary(template, currentUser);
    const templateContext = buildTemplateContextSummary(template);
    const queueGuardrail = buildTemplateQueueGuardrail(template, queueSectionId, currentUser);
    const canEditDirectly = !ownership.foreign;
    const canDeleteDirectly = !ownership.foreign;

    return (
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
          <span className="label">Context</span>
          <span>{templateContext.label}</span>
        </div>
        <div className="row">
          <span className="label">Owner</span>
          <span data-testid={`template-queue-owner-${template.id}`}>{ownership.label}</span>
        </div>
        <div className="row">
          <span className="label">Server</span>
          <span>{formatServerLabel(template.server_name, template.server_host)}</span>
        </div>
        <div className="row">
          <span className="label">Used</span>
          <span>{template.use_count || 0}</span>
        </div>
        <div className="row">
          <span className="label">Last used</span>
          <span>{template.last_used_at ? formatDate(template.last_used_at) : "Not reused yet"}</span>
        </div>
        <div className="banner subtle" data-testid={`template-queue-guardrail-${template.id}`}>
          {queueGuardrail}
        </div>
        <div className="actions">
          <button
            type="button"
            onClick={() => setTemplatePreviewId(template.id)}
            data-testid={`template-preview-button-${template.id}`}
          >
            Review asset
          </button>
          <button
            type="button"
            onClick={() => applyTemplateToForm(template, { startEditing: true })}
            disabled={!canEditDirectly}
            data-testid={`template-edit-button-${template.id}`}
          >
            {canEditDirectly ? "Edit baseline" : "Duplicate to edit"}
          </button>
          <button
            type="button"
            onClick={() => handleDuplicateTemplate(template)}
            disabled={duplicatingTemplateId === template.id}
            data-testid={`template-duplicate-button-${template.id}`}
          >
            {duplicatingTemplateId === template.id ? "Duplicating..." : "Duplicate for variant"}
          </button>
          <button
            type="button"
            className="dangerButton"
            onClick={() => handleDeleteTemplate(template.id)}
            disabled={deletingTemplateId === template.id || !canDeleteDirectly}
            data-testid={`template-delete-button-${template.id}`}
          >
            {deletingTemplateId === template.id
              ? "Deleting..."
              : canDeleteDirectly
                ? "Delete"
                : "Owner keeps delete"}
          </button>
        </div>
      </div>
    );
  }

  function buildTemplatePayload() {
    const draft = buildCurrentDraft();
    const payload = {
      template_name: draft.template_name,
      context_label: draft.context_label,
      image: draft.image,
      env: draft.env,
      secrets: draft.secrets,
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

    if (draft.custom_domain) {
      payload.custom_domain = draft.custom_domain;
    }

    payload.tls_enabled = draft.tls_enabled;

    return payload;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");
    setCreatedDeployment(null);

    if (deployBlocker?.blocker) {
      setSubmitError(deployBlocker.nextStep);
      setSubmitting(false);
      return;
    }

    const draft = buildCurrentDraft();
    const preflight = validateTemplateDraft(draft, { forDeployment: true, canAccessServers });

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
      secrets: draft.secrets,
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

    if (draft.custom_domain) {
      payload.custom_domain = draft.custom_domain;
    }

    payload.tls_enabled = draft.tls_enabled;

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
        custom_domain: "",
        tls_enabled: false,
      });
      setEnvRows([{ key: "", value: "" }]);
      setWorkflowTab("live");
      setSubmitSuccess(
        "Deployment created. Open deployment passport next while this rollout is still fresh.",
      );
      await refreshWorkspace();
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
      canAccessServers,
    });
    const saveWarnings = [...preflight.warnings];

    if (!draft.template_name) {
      setTemplateSubmitError("Template name is required.");
      setTemplateSubmitting(false);
      return;
    }

    if (!draft.context_label) {
      saveWarnings.push(
        "Context label is empty. The next operator will not see which client or environment this asset belongs to.",
      );
    }

    if (preflight.errors.length > 0) {
      setTemplateSubmitError(preflight.errors[0]);
      setTemplateSubmitting(false);
      return;
    }

    if (
      saveWarnings.length > 0 &&
      !window.confirm(`${saveWarnings.join("\n")}\n\nSave template anyway?`)
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
      setTemplateContextLabel(savedTemplate.context_label || "");
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
      setTemplateDuplicateSuccess(
        `Template duplicated as "${duplicatedTemplate.template_name}". Add the new client or operating context before reuse.`,
      );
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

      await refreshWorkspace();
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

  async function handleDeleteTemplate(templateId) {
    const confirmed = window.confirm("Delete this deployment template?");

    if (!confirmed) {
      return;
    }

    setTemplateDeleteError("");
    setDeletingTemplateId(templateId);

    try {
      const response = await fetch(`${apiBaseUrl}/deployment-templates/${templateId}`, {
        method: "DELETE",
        credentials: "include",
      });
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
          canAccessServers,
        })
      : { errors: [], warnings: [] };

    setTemplateDeployError("");
    setTemplateDeploySuccess("");
    setTemplateCreatedDeployment(null);
    setDeployingTemplateId(templateId);

    if (deployBlocker?.blocker) {
      setTemplateDeployError(deployBlocker.nextStep);
      setDeployingTemplateId("");
      return;
    }

    if (template && !templateCanDeployDirectly(template)) {
      setTemplateDeployError(
        "Add a client or operating context label before deploying directly from this template.",
      );
      setDeployingTemplateId("");
      return;
    }

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
      setTemplateDeploySuccess(
        "Deployment created from template. Open deployment passport next while this rollout is still fresh.",
      );
      await refreshWorkspace();
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

  async function handleCopyNextStep() {
    try {
      await copyTextToClipboard(memberWorkflowNextStep.nextStep);
      setWorkflowMessage("Deployment workflow next-step summary copied.");
    } catch {
      setTemplateDeployError("Failed to copy the deployment workflow next step.");
    }
  }

  async function handleCopyStackIntakeSummary() {
    if (!composeIntakeSummary) {
      return;
    }

    try {
      await copyTextToClipboard(composeIntakeSummary);
      setStackIntakeSuccess("Compose stack intake summary copied.");
      setStackIntakeError("");
    } catch {
      setStackIntakeError("Failed to copy compose stack intake summary.");
      setStackIntakeSuccess("");
    }
  }

  async function handleStackDeploy() {
    setStackSubmitting(true);
    setStackIntakeError("");
    setStackIntakeSuccess("");
    setSubmitError("");
    setSubmitSuccess("");
    setCreatedDeployment(null);

    if (deployBlocker?.blocker) {
      setStackIntakeError(deployBlocker.nextStep);
      setStackSubmitting(false);
      return;
    }

    const validation = buildComposeIntakeValidation(stackDraft, {
      localDeploymentsEnabled,
      canAccessServers,
    });

    if (validation.errors.length > 0) {
      setStackIntakeError(validation.errors[0]);
      setStackSubmitting(false);
      return;
    }

    if (
      validation.warnings.length > 0 &&
      !window.confirm(`${validation.warnings.join("\n")}\n\nDeploy stack anyway?`)
    ) {
      setStackSubmitting(false);
      return;
    }

    const payload = {
      stack_name: stackDraft.stack_name.trim(),
      primary_service: stackDraft.primary_service.trim(),
      health_target: stackDraft.health_target.trim(),
      compose_yaml: stackDraft.compose_yaml,
    };

    if (stackDraft.server_id) {
      payload.server_id = stackDraft.server_id;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/deployments/stack`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await readJsonOrError(response, "Failed to deploy stack.");

      setCreatedDeployment(data);
      setSubmitSuccess(
        "Stack deployment created. Open deployment passport next while the primary service is still fresh.",
      );
      setStackIntakeSuccess("Compose stack deployed as one runtime unit.");
      setStackDraft({
        stack_name: "",
        primary_service: "",
        health_target: "",
        compose_yaml: "",
        server_id: stackDraft.server_id,
      });
      await refreshWorkspace();
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }

      setStackIntakeError(
        requestError instanceof Error
          ? normalizeCreateDeploymentError(requestError.message)
          : "Failed to deploy stack. Please try again.",
      );
    } finally {
      setStackSubmitting(false);
    }
  }

  const currentDraft = buildCurrentDraft();
  const templateFormPreflight = validateTemplateDraft(currentDraft, {
    ignoreTemplateId: editingTemplateId,
    canAccessServers,
  });
  const composeDraftStarted = Boolean(
    stackDraft.stack_name.trim() ||
      stackDraft.primary_service.trim() ||
      stackDraft.health_target.trim() ||
      stackDraft.compose_yaml.trim(),
  );
  const composeIntakeValidation = buildComposeIntakeValidation(stackDraft, {
    localDeploymentsEnabled,
    canAccessServers,
  });
  const composeIntakeState = buildComposeIntakeState(stackDraft, composeIntakeValidation);
  const composeIntakeSummary = buildComposeIntakeSummary(stackDraft, composeIntakeValidation);
  const rolloutDraftStarted = Boolean(
    form.image.trim() ||
      form.name.trim() ||
      form.internal_port.trim() ||
      form.external_port.trim() ||
      form.custom_domain.trim() ||
      form.tls_enabled ||
      templateName.trim() ||
      editingTemplateId ||
      rolloutDraftHasEnvRows,
  );
  const firstDeployImageDraftPending =
    Boolean(form.server_id) &&
    deployments.length === 0 &&
    !form.image.trim() &&
    !form.name.trim() &&
    !form.internal_port.trim() &&
    !form.custom_domain.trim() &&
    !form.tls_enabled &&
    !templateName.trim() &&
    !editingTemplateId &&
    !rolloutDraftHasEnvRows;
  const firstDeployCreatePriority = firstDeployImageDraftPending;
  const firstDeployHandoffFocusMode =
    requestedWithServerContext &&
    Boolean(selectedCreateServer) &&
    firstDeployImageDraftPending;
  const firstDeployHandoffCompact = firstDeployHandoffFocusMode && !form.image.trim();
  const imageFirstCompactMode = firstDeployHandoffCompact && !deployBlocker?.blocker;
  const showLiveTab = deployments.length > 0;
  const createDeploymentBlocked =
    submitting ||
    deploymentLimitReached ||
    Boolean(deployBlocker?.blocker) ||
    (!localDeploymentsEnabled && !form.server_id);
  const stackDeploymentBlocked =
    stackSubmitting ||
    deploymentLimitReached ||
    Boolean(deployBlocker?.blocker) ||
    composeIntakeValidation.errors.length > 0;
  const workflowNextStep = buildDeploymentWorkflowNextStep({
    workflowState,
    localDeploymentsEnabled,
    deploymentLimitReached,
    filteredDeployments,
    templatesCount: templates.length,
    serversCount: servers.length,
    deployBlocker,
    form,
    templateName,
    templateFormPreflight,
  });
  const memberWorkflowNextStep = serverAccessBlocked
    ? memberHasLiveDeployments
      ? {
          focus: "Live apps are available for review",
          nextStep:
            "Review the deployments that already exist. Creating new remote deployments and choosing saved server targets stay with admins.",
          primaryAction: "Review live apps instead",
          secondaryAction: "Copy next step",
          tone: "info",
        }
      : {
          focus: "Server target is admin-managed",
          nextStep:
            "Ask an admin to confirm the saved server target before you create a remote deployment here.",
          primaryAction: "Back to overview",
          secondaryAction: "Copy next step",
          tone: "warn",
        }
    : workflowNextStep;
  const pagePrimaryAction =
    serverAccessBlocked && !memberHasLiveDeployments
      ? { kind: "link", href: "/app", label: "Back to overview" }
      : serverAccessBlocked
        ? { kind: "button", tab: "live", label: "Review live apps instead" }
        : workflowState.mode === "prerequisite"
          ? { kind: "link", href: "/app/server-review", label: "Open server review" }
          : memberWorkflowNextStep.primaryAction === "Back to overview"
            ? { kind: "link", href: "/app", label: "Back to overview" }
            : memberWorkflowNextStep.primaryAction === "Review live deployments"
              ? { kind: "button", tab: "live", label: "Review live apps instead" }
              : firstDeployHandoffFocusMode
                ? { kind: "focus-create", label: "Set image for first deploy" }
          : failedDeploymentCount > 0
            ? { kind: "button", tab: "live", label: "Review live apps instead" }
            : memberWorkflowNextStep.primaryAction === "Open templates"
              ? { kind: "button", tab: "templates", label: "Open saved setups" }
              : memberWorkflowNextStep.primaryAction === "Fix the create form"
                ? { kind: "button", tab: "create", label: "Fix the create form" }
                : { kind: "button", tab: "create", label: "Create deployment" };
  const workflowHeroOwnsPrimaryAction =
    serverAccessBlocked ||
    workflowState.mode === "prerequisite" ||
    workflowState.mode === "guardrail" ||
    workflowPrimaryMode === "live";
  const showMainNextStepPrimaryAction =
    !firstDeployHandoffFocusMode && !workflowHeroOwnsPrimaryAction;
  const primaryTemplateDeployLabel = deployBlocker?.blocker
    ? "Blocked by low disk"
    : deployingTemplateId === primaryTemplate?.id
      ? "Deploying..."
      : primaryTemplateCanDeployDirectly
        ? "Deploy saved setup"
        : primaryTemplateOwnership?.foreign
          ? "Duplicate before deploy"
          : "Add context before deploy";
  const previewDiffRows = buildTemplateDiff(primaryTemplate, currentDraft, servers);

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
        <article className="card formCard">
          <div className="header">
            <div>
              <div className="eyebrow">Step 2</div>
              <h1 data-testid="deployment-workflow-title">{deploymentWorkflowHeroTitle}</h1>
              <p className="formHint">{stepTwoLead}</p>
              {!imageFirstCompactMode ? <p className="formHint">{stepTwoSupport}</p> : null}
              <p className="formHint">
                Right now:{" "}
                <strong>
                  {imageFirstCompactMode
                    ? "Set the image for the first deploy."
                    : memberWorkflowNextStep.focus}
                </strong>
                {imageFirstCompactMode
                  ? " Save templates and advanced setup for later if the rollout really needs them."
                  : null}
              </p>
            </div>
            <div className="buttonRow">
              {pagePrimaryAction.kind === "link" ? (
                <Link
                  href={pagePrimaryAction.href}
                  className="landingButton primaryButton"
                  data-testid="deployment-workflow-hero-primary-action"
                >
                  {pagePrimaryAction.label}
                </Link>
              ) : pagePrimaryAction.kind === "focus-create" ? (
                <button
                  type="button"
                  className="landingButton primaryButton"
                  data-testid="deployment-workflow-hero-primary-action"
                  onClick={() => focusCreateForm()}
                >
                  {pagePrimaryAction.label}
                </button>
              ) : (
                <button
                  type="button"
                  className="landingButton primaryButton"
                  data-testid="deployment-workflow-hero-primary-action"
                  onClick={() => setWorkflowTab(pagePrimaryAction.tab)}
                >
                  {pagePrimaryAction.label}
                </button>
              )}
              {canAccessServers ? (
                <Link href="/app/server-review" className="linkButton">
                  Back to server step
                </Link>
              ) : (
                <Link href="/app" className="linkButton">
                  Overview
                </Link>
              )}
              <button
                type="button"
                onClick={() => refreshWorkspace()}
                disabled={loading || serversLoading || templatesLoading || opsOverviewLoading}
                className="secondaryButton"
              >
                {loading || serversLoading || templatesLoading || opsOverviewLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
        </article>

        {error ? <div className="banner error">{error}</div> : null}
        {serversError ? <div className="banner error">{serversError}</div> : null}
        {deleteError ? <div className="banner error">{deleteError}</div> : null}
        {templatesError ? <div className="banner error">{templatesError}</div> : null}
        {templateDeleteError ? <div className="banner error">{templateDeleteError}</div> : null}
        {templateDeployError ? <div className="banner error">{templateDeployError}</div> : null}
        {workflowMessage ? (
          <div className="banner success" data-testid="deployment-workflow-template-bridge-banner">
            {workflowMessage}
          </div>
        ) : null}
        {smokeMode ? (
          <div className="banner subtle">
            Smoke mode uses fixture data for deployment workflow surfaces.
          </div>
        ) : null}
        {workflowState.mode === "prerequisite" && canAccessServers ? (
          <article className="card formCard workspaceGuidePanel" data-testid="deployment-workflow-prerequisite-card">
            <div className="sectionHeader workspaceGuideHeader">
              <div>
                <h2 data-testid="deployment-workflow-prerequisite-title">{workflowState.title}</h2>
                <p className="formHint">
                  {workflowState.detail} Save one target there first, then return here for the guided deploy form.
                </p>
              </div>
            </div>
            <div className="workspaceReviewerGrid">
              <article className="workspaceReviewerCard">
                <span>1. Connect target</span>
                <strong>Open Server Review</strong>
                <p>Add one SSH server target so remote rollout has a real destination.</p>
              </article>
              <article className="workspaceReviewerCard">
                <span>2. Remove uncertainty</span>
                <strong>Run one check</strong>
                <p>Test connectivity or diagnostics on that target before rollout creation becomes the main path.</p>
              </article>
              <article className="workspaceReviewerCard">
                <span>3. Return here</span>
                <strong>Create first deployment</strong>
                <p>Come back to this workspace after one target is clear and use the guided form below.</p>
              </article>
            </div>
            <div className="formActions">
              <Link
                href="/app/server-review"
                className="landingButton secondaryButton"
                data-testid="deployment-workflow-prerequisite-panel-action"
              >
                Open server review
              </Link>
              <Link href="/app" className="landingButton secondaryButton">
                Back to overview
              </Link>
            </div>
          </article>
        ) : workflowState.mode === "guardrail" ? (
          <article className="card formCard workspaceGuidePanel" data-testid="deployment-workflow-disk-guardrail-card">
            <div className="sectionHeader workspaceGuideHeader">
              <div>
                <h2 data-testid="deployment-workflow-disk-guardrail-title">{workflowState.title}</h2>
                <p className="formHint">
                  {workflowState.detail} Clear space on the DeployMate host first, then return here when overview no longer flags low disk.
                </p>
              </div>
            </div>
            <div className="workspaceReviewerGrid">
              <article className="workspaceReviewerCard">
                <span>1. Free space</span>
                <strong>Clear builder cache and logs</strong>
                <p>Do not treat another rollout as safe while the DeployMate host is already close to full.</p>
              </article>
              <article className="workspaceReviewerCard">
                <span>2. Confirm signal</span>
                <strong>Refresh overview</strong>
                <p>Use the main workspace attention surface to confirm the low-disk warning has actually disappeared.</p>
              </article>
              <article className="workspaceReviewerCard">
                <span>3. Return here</span>
                <strong>Resume rollout work</strong>
                <p>Only after the host has headroom again should this page become the place for another deliberate rollout.</p>
              </article>
            </div>
            <div className="formActions">
              <Link href="/app" className="landingButton primaryButton">
                Back to overview
              </Link>
              {filteredDeployments.length > 0 ? (
                <button
                  type="button"
                  className="landingButton secondaryButton"
                  onClick={() => setWorkflowTab("live")}
                >
                  Review live apps instead
                </button>
              ) : null}
            </div>
          </article>
        ) : memberHasLiveDeployments ? (
          <article className="card formCard workspaceGuidePanel" data-testid="deployment-workflow-member-live-card">
            <div className="sectionHeader workspaceGuideHeader">
              <div>
                <h2 data-testid="deployment-workflow-member-live-title">
                  Review live deployments with admin-managed targets
                </h2>
                <p className="formHint">
                  Existing deployments can be reviewed here. Creating new remote deployments and choosing saved server targets stay with admins.
                </p>
              </div>
            </div>
            <div className="workspaceReviewerGrid">
              <article className="workspaceReviewerCard">
                <span>1. Review live apps</span>
                <strong>Open one deployment</strong>
                <p>Start from the live queue and open detail before asking for a rollout change.</p>
              </article>
              <article className="workspaceReviewerCard">
                <span>2. Keep targets hidden</span>
                <strong>Admin-managed target</strong>
                <p>Server inventory names, hosts, and target selection stay outside the member workflow.</p>
              </article>
              <article className="workspaceReviewerCard">
                <span>3. Ask for changes</span>
                <strong>Bring a clear review note</strong>
                <p>Use runtime detail and handoff tools to explain what needs an admin decision.</p>
              </article>
            </div>
            <div className="formActions">
              <button
                type="button"
                className="landingButton secondaryButton"
                data-testid="deployment-workflow-member-live-panel-action"
                onClick={() => setWorkflowTab("live")}
              >
                Review live apps instead
              </button>
              <Link href="/app" className="landingButton secondaryButton">
                Back to overview
              </Link>
            </div>
          </article>
        ) : serverAccessBlocked ? (
          <article className="card formCard workspaceGuidePanel" data-testid="deployment-workflow-member-blocked-card">
            <div className="sectionHeader workspaceGuideHeader">
              <div>
                <h2>Server target is admin-managed</h2>
                <p className="formHint">
                  Members cannot access saved server inventory here. Ask an admin to confirm the remote target first, then return when a new deployment is actually needed.
                </p>
              </div>
            </div>
            <div className="workspaceReviewerGrid">
              <article className="workspaceReviewerCard">
                <span>1. Ask an admin</span>
                <strong>Confirm the target</strong>
                <p>Saved server targets stay with admins for this workspace.</p>
              </article>
              <article className="workspaceReviewerCard">
                <span>2. Keep the path clear</span>
                <strong>Do not fill a blocked form early</strong>
                <p>Until Step 1 is done, this page should stay simple instead of pretending rollout setup is already available.</p>
              </article>
              <article className="workspaceReviewerCard">
                <span>3. Return here</span>
                <strong>Create the deployment</strong>
                <p>Come back once the target is available and continue with the guided form below.</p>
              </article>
            </div>
            <div className="formActions">
              <Link
                href="/app"
                className="landingButton secondaryButton"
                data-testid="deployment-workflow-member-blocked-panel-action"
              >
                Back to overview
              </Link>
              {filteredDeployments.length > 0 ? (
                <button
                  type="button"
                  className="landingButton secondaryButton"
                  onClick={() => setWorkflowTab("live")}
                >
                  Review live apps instead
                </button>
              ) : null}
            </div>
          </article>
        ) : null}

        <article className="card formCard" data-testid="deployment-workflow-main-next-step-card">
          <div className="sectionHeader">
            <div>
              <h2 data-testid="deployment-workflow-main-next-step-title">Do this now</h2>
              <p className="formHint">
                {imageFirstCompactMode
                  ? "Set one app image first. Keep everything else secondary until that draft exists."
                  : "Use one lane at a time on this page. Finish the current job before you open the others."}
              </p>
            </div>
          </div>
          <div className="row">
            <span className="label">Current focus</span>
            <span data-testid="deployment-workflow-main-next-step-focus">
              {imageFirstCompactMode
                ? "Set the image for the first deploy"
                : memberWorkflowNextStep.focus}
            </span>
          </div>
          <div className="row">
            <span className="label">What to do</span>
            <span data-testid="deployment-workflow-main-next-step-copy">
              {imageFirstCompactMode
                ? firstDeployHandoffSummary || memberWorkflowNextStep.nextStep
                : memberWorkflowNextStep.nextStep}
            </span>
          </div>
          <div className="backupSummaryBadges">
            {requestedWithServerContext && selectedCreateServer ? (
              <span className="status info">{selectedServerLabel}</span>
            ) : null}
            {!imageFirstCompactMode ? (
              <>
                <span className={`status ${memberWorkflowNextStep.tone}`}>filtered {filteredDeployments.length}</span>
                <span className="status healthy">running {runningDeploymentCount}</span>
                <span className="status error">failed {failedDeploymentCount}</span>
              </>
            ) : null}
            {templates.length > 0 ? <span className="status info">templates {templates.length}</span> : null}
          </div>
          {deployBlocker?.blocker ? (
            <div
              className="banner error inlineBanner"
              data-testid="deployment-workflow-disk-guardrail-banner"
            >
              {deployBlocker.nextStep}
            </div>
          ) : null}
          {firstDeployCreatePriority && templates.length > 0 ? (
            <div
              className="banner subtle inlineBanner"
              data-testid="deployment-workflow-first-deploy-templates-note"
            >
              Saved setups stay here as a fallback. For this first deploy, start with the image unless you already know one template should win.
            </div>
          ) : null}
          {!serverAccessBlocked ? (
            <div
              className="banner subtle inlineBanner"
              data-testid="deployment-workflow-stack-intake-note"
            >
              Need more than one container? Open the compose stack tab and define one primary service, one health target, and one rollback unit before stack deploy work begins.
            </div>
          ) : null}
          {!serverAccessBlocked ? (
            <div
              className="filterTabs"
              role="tablist"
              aria-label="Deployment workflow tabs"
              data-testid="deployment-workflow-tabs-card"
            >
              {showLiveTab ? (
                <button
                  type="button"
                  className={workflowTab === "live" ? "active" : ""}
                  onClick={() => setWorkflowTab("live")}
                  data-testid="deployment-workflow-tab-live"
                >
                  Check live apps
                </button>
              ) : null}
              <button
                type="button"
                className={workflowTab === "create" ? "active" : ""}
                onClick={() => setWorkflowTab("create")}
                data-testid="deployment-workflow-tab-create"
              >
                Start with image
              </button>
              <button
                type="button"
                className={workflowTab === "stack" ? "active" : ""}
                onClick={() => setWorkflowTab("stack")}
                data-testid="deployment-workflow-tab-stack"
              >
                Bring compose stack
              </button>
              <button
                type="button"
                className={workflowTab === "templates" ? "active" : ""}
                onClick={() => setWorkflowTab("templates")}
                data-testid="deployment-workflow-tab-templates"
              >
                {firstDeployCreatePriority ? "Use saved setup instead" : "Use saved setup"}
              </button>
            </div>
          ) : null}
          <div className="actionCluster">
            {showMainNextStepPrimaryAction
              ? pagePrimaryAction.kind === "link" ? (
                <Link
                  href={pagePrimaryAction.href}
                  className="landingButton primaryButton"
                  data-testid="deployment-workflow-main-next-step-button"
                >
                  {pagePrimaryAction.label}
                </Link>
              ) : pagePrimaryAction.kind === "focus-create" ? (
                <button
                  type="button"
                  className="landingButton primaryButton"
                  data-testid="deployment-workflow-main-next-step-button"
                  onClick={() => focusCreateForm()}
                >
                  {pagePrimaryAction.label}
                </button>
              ) : (
                <button
                  type="button"
                  className="landingButton primaryButton"
                  data-testid="deployment-workflow-main-next-step-button"
                  onClick={() => setWorkflowTab(pagePrimaryAction.tab)}
                >
                  {pagePrimaryAction.label}
                </button>
              )
              : null}
            <button
              type="button"
              className="secondaryButton"
              data-testid="deployment-workflow-main-next-step-copy-button"
              onClick={handleCopyNextStep}
            >
              Copy next step
            </button>
          </div>
        </article>

        <section hidden={workflowTab !== "live"}>
        <div
          className="sectionHeader deploymentsHeader runtimeDeploymentsHeader"
          data-testid="runtime-deployments-section"
          id="runtime-deployments"
        >
          <div>
            <h2 data-testid="runtime-deployments-title">Step 3: check what is running</h2>
            <p className="formHint">
              After you start an app, this lane is where you confirm whether it is running, healthy, and worth keeping.
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

        <article
          className="card formCard workspaceGuidePanel runtimeReviewPanel"
          data-testid="runtime-deployments-review-panel"
        >
          <div className="sectionHeader workspaceGuideHeader">
            <div>
              <span className={`status ${primaryRuntimeReviewState.tone}`}>
                {primaryRuntimeReviewState.label}
              </span>
              <h3>{primaryRuntimeReviewState.focus}</h3>
              <p className="formHint">{primaryRuntimeReviewState.nextStep}</p>
            </div>
            <div className="workspaceMetaLine">
              <span>{primaryRuntimeReviewState.summary}</span>
            </div>
          </div>
          <div className="workspaceReviewerGrid runtimeReviewGrid">
            {primaryRuntimeReviewState.checks.map((item) => (
              <article className="workspaceReviewerCard" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </article>

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

          {primaryRuntimeDeployment ? (
            <article
              className="card compactCard deploymentCard"
              key={primaryRuntimeDeployment.id}
              data-testid={`runtime-deployment-card-${primaryRuntimeDeployment.id}`}
            >
              <div className="deploymentCardHeader">
                <div>
                  <span className="deploymentCardEyebrow">Focus deployment</span>
                  <h3>{primaryRuntimeDeployment.container_name || primaryRuntimeDeployment.image || "Unnamed deployment"}</h3>
                  <p>{primaryRuntimeTargetLabel}</p>
                </div>
                <span className={`status ${primaryRuntimeDeployment.status || "unknown"}`}>
                  {primaryRuntimeDeployment.status || "unknown"}
                </span>
              </div>
              <div className="deploymentCardMetrics">
                <div className="deploymentMetric">
                  <span>Image</span>
                  <strong>{primaryRuntimeDeployment.image || "N/A"}</strong>
                </div>
                <div className="deploymentMetric">
                  <span>{primaryRuntimeActionState?.endpointLabel || "Endpoint"}</span>
                  <strong>{primaryRuntimeActionState?.runtimeUrl || primaryRuntimeActionState?.emptyEndpointLabel || "Internal only"}</strong>
                </div>
                <div className="deploymentMetric">
                  <span>Ports</span>
                  <strong>
                    {primaryRuntimeDeployment.internal_port || "-"} {"->"} {primaryRuntimeDeployment.external_port || "-"}
                  </strong>
                </div>
              </div>
              <div className="runtimeDecisionNote">
                <span className={`status ${primaryRuntimeReviewState.tone}`}>
                  {primaryRuntimeReviewState.label}
                </span>
                <strong>{primaryRuntimeReviewState.nextStep}</strong>
                <p>
                  Created {formatDate(primaryRuntimeDeployment.created_at)}
                  {primaryRuntimeDeployment.error ? ` · ${primaryRuntimeDeployment.error}` : ""}
                </p>
              </div>
              <div className="actions runtimeCardActions">
                {primaryRuntimeActionState?.showOpenAppPrimary ? (
                  <a
                    href={primaryRuntimeActionState.runtimeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={primaryRuntimeActionState.openAppClassName}
                    data-testid={`runtime-deployment-open-app-link-${primaryRuntimeDeployment.id}`}
                  >
                    {primaryRuntimeActionState.openActionLabel}
                  </a>
                ) : null}
                <Link
                  href={`/deployments/${primaryRuntimeDeployment.id}`}
                  className={primaryRuntimeActionState?.detailsClassName || "linkButton"}
                  data-testid={`runtime-deployment-details-link-${primaryRuntimeDeployment.id}`}
                >
                  {primaryRuntimeActionState?.detailsLabel || "View details"}
                </Link>
                {primaryRuntimeActionState?.showOpenAppSecondary ? (
                  <a
                    href={primaryRuntimeActionState.runtimeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={primaryRuntimeActionState.openAppClassName}
                    data-testid={`runtime-deployment-open-app-link-${primaryRuntimeDeployment.id}`}
                  >
                    {primaryRuntimeActionState.openActionLabel}
                  </a>
                ) : null}
                {primaryRuntimeDeployment.status === "failed" ? (
                  <div className="banner subtle inlineBanner">
                    Review runtime issues before deleting this failed runtime.
                  </div>
                ) : (
                  <button
                    type="button"
                    className="dangerButton"
                    data-testid={`runtime-deployment-delete-button-${primaryRuntimeDeployment.id}`}
                    onClick={() => handleDelete(primaryRuntimeDeployment.id)}
                    disabled={deletingDeploymentId === primaryRuntimeDeployment.id}
                  >
                    {deletingDeploymentId === primaryRuntimeDeployment.id ? "Deleting..." : "Delete"}
                  </button>
                )}
              </div>
            </article>
          ) : null}

          {secondaryRuntimeDeployments.length > 0 ? (
            <article className="card compactCard">
              <div className="sectionHeader">
                <div>
                  <h3>Remaining live queue</h3>
                  <p className="formHint">
                    {secondaryRuntimeDeployments.length} more deployment{secondaryRuntimeDeployments.length === 1 ? "" : "s"} stay here without taking over the whole first screen.
                  </p>
                </div>
              </div>
              <div className="timeline">
                {secondaryRuntimeDeployments.map((deployment) => {
                  const runtimeActionState = buildRuntimeCardActionState(deployment);

                  return (
                    <div className="timelineItem" key={deployment.id}>
                      <div className="row">
                        <span className="label">Deployment</span>
                        <span>{deployment.container_name || deployment.image || "Unnamed deployment"}</span>
                      </div>
                      <div className="row">
                        <span className="label">Status</span>
                        <span className={`status ${deployment.status || "unknown"}`}>
                          {deployment.status || "unknown"}
                        </span>
                      </div>
                      <div className="row">
                        <span className="label">{runtimeActionState.endpointLabel}</span>
                        <span>{runtimeActionState.runtimeUrl || runtimeActionState.emptyEndpointLabel}</span>
                      </div>
                      <div className="row">
                        <span className="label">Created</span>
                        <span>{formatDate(deployment.created_at)}</span>
                      </div>
                      <div className="actions">
                        {runtimeActionState.showOpenAppPrimary ? (
                          <a
                            href={runtimeActionState.runtimeUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={runtimeActionState.openAppClassName}
                            data-testid={`runtime-deployment-open-app-link-${deployment.id}`}
                          >
                            {runtimeActionState.openActionLabel}
                          </a>
                        ) : null}
                        <Link
                          href={`/deployments/${deployment.id}`}
                          className={runtimeActionState.detailsClassName}
                          data-testid={`runtime-deployment-details-link-${deployment.id}`}
                        >
                          {runtimeActionState.detailsLabel}
                        </Link>
                        {runtimeActionState.showOpenAppSecondary ? (
                          <a
                            href={runtimeActionState.runtimeUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={runtimeActionState.openAppClassName}
                            data-testid={`runtime-deployment-open-app-link-${deployment.id}`}
                          >
                            {runtimeActionState.openActionLabel}
                          </a>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ) : null}
        </div>
        </section>

        {!serverAccessBlocked ? (
        <section hidden={workflowTab !== "stack"}>
        <article className="card formCard" data-testid="stack-intake-card" id="stack-intake">
          <div className="sectionHeader">
            <div>
              <h2 data-testid="stack-intake-title">Step 2C: Bring a compose stack</h2>
              <p className="formHint">
                Use this lane when one workload is no longer a single container. This v0 path deploys one compose stack as one runtime with one primary service and one health target.
              </p>
            </div>
          </div>
          {workflowState.mode === "prerequisite" ? (
            <div className="banner subtle" data-testid="stack-intake-prerequisite-banner">
              Save one server target in Step 1 first if this stack needs a remote host. Then return here and keep the stack intake as one clear runtime shape.
            </div>
          ) : null}
          <div className="workspaceReviewerGrid" data-testid="stack-intake-subset-grid">
            <article className="workspaceReviewerCard">
              <span>Supported v0 subset</span>
              <strong>One compose file</strong>
              <p>Start from one pasted compose YAML file instead of multiple overrides or generated fragments.</p>
            </article>
            <article className="workspaceReviewerCard">
              <span>Primary service</span>
              <strong>One user-facing owner</strong>
              <p>Pick the service that should represent the stack in health, rollout review, and the future runtime detail.</p>
            </article>
            <article className="workspaceReviewerCard">
              <span>Health + rollback</span>
              <strong>One stack unit</strong>
              <p>Choose one health target now so the whole stack can later behave like one runtime and one rollback decision.</p>
            </article>
          </div>

          <form className="form" onSubmit={(event) => event.preventDefault()}>
            {canAccessServers ? (
              <label className="field">
                <span>Server</span>
                <select
                  name="server_id"
                  value={stackDraft.server_id}
                  onChange={updateStackDraftField}
                  disabled={stackSubmitting}
                  data-testid="stack-intake-server-select"
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
                <span className="fieldHint">
                  {selectedStackServer
                    ? `Stack deploy will target ${selectedStackServer.name} (${selectedStackServer.host}).`
                    : localDeploymentsEnabled
                      ? "Leave this empty only when the stack should run on the local Docker host."
                      : "Choose the remote server that should own this stack runtime."}
                </span>
              </label>
            ) : null}

            <label className="field">
              <span>Stack name</span>
              <input
                name="stack_name"
                value={stackDraft.stack_name}
                onChange={updateStackDraftField}
                placeholder="customer-portal"
                disabled={stackSubmitting}
                data-testid="stack-intake-name-input"
              />
            </label>

            <label className="field">
              <span>Primary service</span>
              <input
                name="primary_service"
                value={stackDraft.primary_service}
                onChange={updateStackDraftField}
                placeholder="web"
                disabled={stackSubmitting}
                data-testid="stack-intake-primary-service-input"
              />
              <span className="fieldHint">
                This should be the service operators think about first when the stack needs review, health checks, or rollback.
              </span>
            </label>

            <label className="field">
              <span>Health target</span>
              <input
                name="health_target"
                value={stackDraft.health_target}
                onChange={updateStackDraftField}
                placeholder="https://app.example.com/health"
                disabled={stackSubmitting}
                data-testid="stack-intake-health-target-input"
              />
              <span className="fieldHint">
                Use one full http(s) URL that should answer whether the primary service is healthy enough for the whole stack.
              </span>
            </label>

            <label className="field">
              <span>Compose file</span>
              <textarea
                name="compose_yaml"
                value={stackDraft.compose_yaml}
                onChange={updateStackDraftField}
                placeholder={"services:\n  web:\n    image: ghcr.io/acme/web:latest\n  worker:\n    image: ghcr.io/acme/worker:latest"}
                rows={12}
                disabled={stackSubmitting}
                data-testid="stack-intake-compose-input"
              />
              <span className="fieldHint">
                Paste one compose YAML file. This v0 intake is strongest with image-based services and one obvious primary service.
              </span>
            </label>
          </form>

          <article className="card compactCard" data-testid="stack-intake-readiness-card">
            <div className="sectionHeader">
              <div>
                <h3 data-testid="stack-intake-readiness-title">Current stack intake review</h3>
                <p className="formHint">
                  Keep this review narrow: does DeployMate understand the stack as one runtime with one primary service and one health target?
                </p>
              </div>
            </div>
            <div className="row">
              <span className="label">State</span>
              <span className={`status ${composeIntakeState.tone}`} data-testid="stack-intake-readiness-state">
                {composeIntakeState.label}
              </span>
            </div>
            <div className="row">
              <span className="label">Focus</span>
              <span data-testid="stack-intake-readiness-focus">{composeIntakeState.focus}</span>
            </div>
            <div className="row">
              <span className="label">Why</span>
              <span data-testid="stack-intake-readiness-why">{composeIntakeState.why}</span>
            </div>
            <div className="row">
              <span className="label">What to do</span>
              <span data-testid="stack-intake-readiness-next-step">{composeIntakeState.nextStep}</span>
            </div>
            <div className="backupSummaryBadges">
              <span className={`status ${composeIntakeState.tone}`}>services {composeIntakeValidation.serviceNames.length}</span>
              <span className="status error">errors {composeDraftStarted ? composeIntakeValidation.errors.length : 0}</span>
              <span className="status warn">warnings {composeIntakeValidation.warnings.length}</span>
            </div>
          </article>

          {composeDraftStarted && composeIntakeValidation.errors.length > 0 ? (
            <div className="banner error" data-testid="stack-intake-error-banner">
              {composeIntakeValidation.errors[0]}
            </div>
          ) : null}
          {composeIntakeValidation.warnings.length > 0 ? (
            <div className="banner subtle" data-testid="stack-intake-warning-banner">
              {composeIntakeValidation.warnings.join(" ")}
            </div>
          ) : null}
          {deployBlocker?.blocker ? (
            <div className="banner error" data-testid="stack-intake-disk-guardrail-banner">
              {deployBlocker.nextStep}
            </div>
          ) : null}
          {composeIntakeSummary ? (
            <pre className="logs expandedBlock" data-testid="stack-intake-summary">
              {composeIntakeSummary}
            </pre>
          ) : null}
          <div className="formActions">
            <button
              type="button"
              className="landingButton primaryButton"
              onClick={handleStackDeploy}
              disabled={stackDeploymentBlocked}
              data-testid="stack-intake-deploy-button"
            >
              {stackSubmitting ? "Deploying stack..." : "Deploy stack"}
            </button>
            <button
              type="button"
              className="secondaryButton"
              onClick={handleCopyStackIntakeSummary}
              disabled={!composeIntakeSummary || stackSubmitting}
              data-testid="stack-intake-copy-button"
            >
              Copy stack intake summary
            </button>
            <button
              type="button"
              className="secondaryButton"
              onClick={() => setWorkflowTab("create")}
              disabled={stackSubmitting}
              data-testid="stack-intake-switch-create-button"
            >
              Use single-app form instead
            </button>
          </div>
          {stackIntakeError ? (
            <div className="banner error" data-testid="stack-intake-submit-error-banner">
              {stackIntakeError}
            </div>
          ) : null}
          {stackIntakeSuccess ? (
            <div className="banner success" data-testid="stack-intake-submit-success-banner">
              <div>{stackIntakeSuccess}</div>
              {submitSuccess ? <div className="formHint">{submitSuccess}</div> : null}
              {createdDeployment?.id ? (
                <div className="successActions">
                  <Link
                    href={`/deployments/${createdDeployment.id}?source=workflow-success#runtime-detail-passport`}
                    className="landingButton primaryButton"
                    data-testid="stack-intake-success-open-detail-link"
                  >
                    Open deployment passport
                  </Link>
                  <button
                    type="button"
                    className="secondaryButton"
                    onClick={() => setWorkflowTab("live")}
                    data-testid="stack-intake-success-open-live-button"
                  >
                    Review live queue
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </article>
        </section>
        ) : null}

        {!serverAccessBlocked ? (
        <section hidden={workflowTab !== "create"}>
        <article
          ref={createSectionRef}
          className="card formCard"
          data-testid="create-deployment-card"
          id="create-deployment"
        >
          <h2 data-testid="create-deployment-title">Step 2A: Start one app</h2>
          <p className="formHint">
            {serverAccessBlocked
              ? "Members cannot choose saved servers here. Ask an admin to confirm the target, then keep this form focused on the app itself."
              : workflowState.mode === "prerequisite"
                ? "This becomes the main path as soon as Step 1 has one saved server target. When that is done, start with the image first and open advanced setup only if needed."
                : imageFirstCompactMode
                  ? "Set one image first. Leave advanced setup closed unless this rollout really needs more."
                : "For a first pass, start with the image first. Leave advanced setup closed unless you need custom ports, env vars, server targeting, or a saved setup."}
          </p>
          {!localDeploymentsEnabled ? (
            <div className="banner subtle">
              {serverAccessBlocked
                ? "This workspace is remote-only and the saved server target is managed by an admin."
                : "This environment is running in remote-only mode. Local host deployments are disabled."}
            </div>
          ) : null}
          {deployBlocker?.blocker ? (
            <div className="banner error" data-testid="create-deployment-disk-guardrail-banner">
              {deployBlocker.nextStep}
            </div>
          ) : serverAccessBlocked ? (
            <div className="banner subtle" data-testid="create-deployment-prerequisite-banner">
              Server selection is managed by an admin for this workspace. Ask an admin to confirm the target before creating a remote deployment.
            </div>
          ) : workflowState.mode === "prerequisite" ? (
            <div className="banner subtle" data-testid="create-deployment-prerequisite-banner">
              Remote-only rollout is enabled and no saved server targets are available yet. Open Server Review first, then return here.
            </div>
          ) : null}
          {editingTemplateId ? (
            <div className="banner subtle">
              <div>
                Editing template in the deploy form. Saving will update the selected template instead of creating a new one.
              </div>
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
                ref={createImageInputRef}
                name="image"
                value={form.image}
                onChange={updateFormField}
                placeholder="nginx:latest"
                disabled={submitting}
                required
                data-testid="create-deployment-image-input"
                data-handoff-focus-source={shouldAutoFocusEntryImage ? requestedSource : undefined}
              />
            </label>

            <div className="banner subtle" data-testid="create-deployment-quickstart-banner">
              {form.image.trim()
                ? serverAccessBlocked
                  ? "The app image is set. Keep the rest of the form focused on the rollout while an admin confirms the remote target."
                  : selectedCreateServer
                    ? `The app image is set and "${selectedCreateServer.name}" is already selected. Create now if the defaults are enough, or only open advanced setup for ports, env vars, or template save.`
                    : "The app image is set. Create now if the defaults are enough, or open advanced setup only for ports, env vars, server target, and template save."
                : selectedCreateServer && requestedWithServerContext
                  ? requestedFromOverview
                    ? `Overview already handed you "${selectedCreateServer.name}". Set the image next.`
                    : `Step 1 already handed you "${selectedCreateServer.name}". Set the image next.`
                  : serverAccessBlocked
                    ? "Set the image first. Members cannot choose a saved server target here, so keep everything else focused on the rollout itself."
                    : "Set the image first. Everything else is optional and can stay closed until you actually need it."}
            </div>

            <div className="formActions">
              <button
                type="button"
                className="secondaryButton"
                onClick={() => setCreateAdvancedOpen((current) => !current)}
                data-testid="create-advanced-toggle-button"
              >
                  {createAdvancedOpen ? "Hide advanced setup" : "Open advanced setup"}
                </button>
              </div>

            <section hidden={!createAdvancedOpen} data-testid="create-advanced-section">
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
                    : serverAccessBlocked
                      ? "Server-specific port suggestions are only available after an admin confirms the target."
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

              <label className="field">
                <span>Custom domain</span>
                <input
                  name="custom_domain"
                  value={form.custom_domain}
                  onChange={updateFormField}
                  placeholder="app.example.com"
                  disabled={submitting}
                />
                <span className="fieldHint">
                  Store the primary domain here when DNS or a reverse proxy should point users at this service. This v1 does not edit DNS or proxy config automatically.
                </span>
              </label>

              <label className="field checkboxField">
                <span className="checkboxRow">
                  <input
                    name="tls_enabled"
                    type="checkbox"
                    checked={form.tls_enabled}
                    onChange={updateFormField}
                    disabled={submitting}
                  />
                  <span>Treat this domain as HTTPS</span>
                </span>
                <span className="fieldHint">
                  Enable this only after the custom domain is expected to terminate TLS at your edge or proxy.
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

              <div className="field">
                <span>Secrets</span>
                <div className="list">
                  {secretRows.map((row, index) => (
                    <div className="envRow" key={`create-secret-${index}`}>
                      <input
                        value={row.key}
                        onChange={(event) => updateSecretRow(index, "key", event.target.value)}
                        placeholder="SECRET_KEY"
                        disabled={submitting}
                      />
                      <input
                        value={row.value}
                        onChange={(event) => updateSecretRow(index, "value", event.target.value)}
                        placeholder="new value"
                        type="password"
                        disabled={submitting}
                      />
                      <button
                        type="button"
                        onClick={() => removeSecretRow(index)}
                        disabled={submitting}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <div className="formActions">
                  <button type="button" onClick={addSecretRow} disabled={submitting}>
                    Add secret
                  </button>
                </div>
                <span className="fieldHint">
                  Secret values are masked after save and excluded from export payloads.
                </span>
              </div>

              {canAccessServers ? (
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
              ) : (
                <div className="banner subtle">
                  {localDeploymentsEnabled
                    ? "Members can keep the server field empty for local deployments while admins manage the saved server list."
                    : "Members cannot choose a saved server target here. Ask an admin to confirm the target before creating a remote deployment."}
                </div>
              )}

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
                  Save the current image, name, ports, server, env vars, and secret keys as a reusable handoff asset.
                </span>
              </label>

              <label className="field">
                <span>Client or operating context</span>
                <input
                  value={templateContextLabel}
                  onChange={(event) => setTemplateContextLabel(event.target.value)}
                  placeholder="Acme support / production"
                  disabled={submitting || templateSubmitting}
                  data-testid="create-template-context-input"
                />
                <span className="fieldHint">
                  Label who or what this asset is for so the next operator can tell whether it belongs to a client, environment, or internal workflow.
                </span>
              </label>
            </section>

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
                <button
                  type="button"
                  className="linkButton"
                  onClick={cancelTemplateEditing}
                  data-testid="create-cancel-template-editing-button"
                >
                  Cancel template editing
                </button>
              ) : null}
              {submitting ? <span className="formHint">Sending request to backend...</span> : null}
            </div>
          </form>

          {submitError ? <div className="banner error">{submitError}</div> : null}
          {rolloutDraftStarted && templateFormPreflight.errors.length > 0 ? (
            <div className="banner error" data-testid="create-preflight-error-banner">
              {templateFormPreflight.errors[0]}
            </div>
          ) : null}
          {templateFormPreflight.warnings.length > 0 ? (
            <div className="banner subtle">
              {templateFormPreflight.warnings.join(" ")}
            </div>
          ) : null}
          <div className="banner subtle">
            {buildRolloutDraftSummary({
              envRows,
              serverSelected: Boolean(form.server_id),
              localDeploymentsEnabled,
              internalPort: form.internal_port,
              externalPort: form.external_port,
            })}
          </div>
          {templateSubmitError ? (
            <div className="banner error" data-testid="create-template-submit-error-banner">
              {templateSubmitError}
            </div>
          ) : null}
          {templateSubmitSuccess ? (
            <div className="banner success" data-testid="create-template-submit-success-banner">
              {templateSubmitSuccess}
            </div>
          ) : null}
          {submitSuccess ? (
            <div className="banner success" data-testid="create-deployment-success-banner">
              <div>{submitSuccess}</div>
              {createdDeployment?.container_name || createdDeployment?.image ? (
                <div className="formHint">
                  New rollout: {createdDeployment.container_name || createdDeployment.image}
                </div>
              ) : null}
              {createdDeployment?.id || buildDeploymentUrl(createdDeployment) ? (
                <div className="successActions">
                  {createdDeployment?.id ? (
                    <Link
                      href={`/deployments/${createdDeployment.id}?source=workflow-success#runtime-detail-passport`}
                      className="landingButton primaryButton"
                      data-testid="create-deployment-success-open-detail-link"
                    >
                      Open deployment passport
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
                  <button
                    type="button"
                    className="secondaryButton"
                    onClick={() => setWorkflowTab("live")}
                    data-testid="create-deployment-success-open-live-button"
                  >
                    Review live queue
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </article>
        </section>
        ) : null}

        {waitingForAdminTarget ? (
          <article className="card formCard workspaceGuidePanel" data-testid="deployment-workflow-member-waiting-card">
            <div className="sectionHeader workspaceGuideHeader">
              <div>
                <h2>What opens after the target is confirmed</h2>
                <p className="formHint">
                  This page should stay calm until Step 1 is done. After one admin confirms the target, Step 2 becomes a short path again.
                </p>
              </div>
            </div>
            <div className="workspaceReviewerGrid">
              <article className="workspaceReviewerCard">
                <span>Then</span>
                <strong>Choose one app</strong>
                <p>Set the image you want to run and leave advanced setup closed unless the rollout really needs it.</p>
              </article>
              <article className="workspaceReviewerCard">
                <span>After that</span>
                <strong>Start it</strong>
                <p>Create the deployment once the target is confirmed instead of filling a blocked form early.</p>
              </article>
              <article className="workspaceReviewerCard">
                <span>Finally</span>
                <strong>Check health</strong>
                <p>Use the live lane only after the app starts so the next decision stays obvious.</p>
              </article>
            </div>
          </article>
        ) : null}

        {!serverAccessBlocked ? (
        <section hidden={workflowTab !== "templates"}>
        <article className="card formCard" data-testid="templates-card" id="templates">
          <div className="sectionHeader" data-testid="templates-section-header">
            <div>
              <h2 data-testid="templates-section-title">{templateLaneTitle}</h2>
              <p className="formHint">
                Templates are reusable {templateAssetMode}s for this workflow. Review one, confirm which client or operating context it belongs to, reuse it as-is, edit the baseline deliberately, or duplicate it before client-specific changes.
              </p>
            </div>
          </div>
          {deployBlocker?.blocker ? (
            <div className="banner error" data-testid="templates-disk-guardrail-banner">
              {deployBlocker.nextStep}
            </div>
          ) : null}

          <article className="card compactCard runtimeReviewPanel" data-testid="templates-team-asset-card">
            <div className="sectionHeader">
              <div>
                <h3 data-testid="templates-team-asset-title">Treat templates as reusable handoff assets</h3>
                <p className="formHint">
                  The goal here is not just faster form fill. The next operator should be able to see which setup is still trusted, which client or operating context it belongs to, how recently it was reused, and whether a change belongs in the baseline or in a duplicate.
                </p>
              </div>
            </div>
            <div className="workspaceReviewerGrid runtimeReviewGrid">
              {templateLaneGuideItems.map((item) => (
                <article key={item.label} className="workspaceReviewerCard">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </article>

          <div
            className="filterTabs historyFilters"
            role="tablist"
            aria-label="Template filters"
            data-testid="templates-filter-tabs"
          >
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
              Recent
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
              placeholder="template name, context, image, server, env key"
              disabled={templatesLoading}
              data-testid="templates-search-input"
            />
          </label>

          {templatesLoading ? (
            <div className="empty" data-testid="templates-loading-state">Loading templates...</div>
          ) : filteredTemplates.length === 0 ? (
            <div className="empty" data-testid="templates-empty-state">
              No templates yet. Save the current create form as your first template.
            </div>
          ) : null}

          {primaryTemplate ? (
            <div className="card compactCard previewCard" data-testid="template-preview-card">
              <div data-testid={`template-card-${primaryTemplate.id}`} />
              <div className="sectionHeader" data-testid="template-preview-header">
                <div>
                  <h3 data-testid="template-preview-title">Focus template</h3>
                  <p className="formHint">
                    Keep one {templateAssetMode} in focus while the rest stay in a compact queue below.
                  </p>
                </div>
              </div>
              <div className="row">
                <span className="label">Template</span>
                <span>{primaryTemplate.template_name}</span>
              </div>
              <div className="row">
                <span className="label">Image</span>
                <span>{primaryTemplate.image}</span>
              </div>
              <div className="row">
                <span className="label">Context</span>
                <span data-testid="template-preview-context">{primaryTemplateContext.label}</span>
              </div>
              <div className="row">
                <span className="label">Owner</span>
                <span data-testid="template-preview-owner">{primaryTemplateOwnership?.label || "Legacy asset"}</span>
              </div>
              <div className="row">
                <span className="label">Server</span>
                <span>{formatServerLabel(primaryTemplate.server_name, primaryTemplate.server_host)}</span>
              </div>
              <div className="row">
                <span className="label">Ports</span>
                <span>{formatPortMapping(primaryTemplate.internal_port, primaryTemplate.external_port)}</span>
              </div>
              <div className="row">
                <span className="label">Used</span>
                <span>{primaryTemplate.use_count || 0}</span>
              </div>
              <div className="row">
                <span className="label">State</span>
                <span data-testid="template-preview-asset-state">{buildTemplateAssetState(primaryTemplate).label}</span>
              </div>
              <div className="row">
                <span className="label">Last used</span>
                <span>{primaryTemplate.last_used_at ? formatDate(primaryTemplate.last_used_at) : "Not reused yet"}</span>
              </div>
              <div className="row">
                <span className="label">Created</span>
                <span>{formatDate(primaryTemplate.created_at)}</span>
              </div>
              <div className="banner subtle" data-testid="template-preview-asset-banner">
                {buildTemplateAssetState(primaryTemplate).detail}
              </div>
              {!primaryTemplateOwnership?.owned ? (
                <div className="banner subtle" data-testid="template-preview-ownership-banner">
                  {primaryTemplateOwnership?.detail}
                </div>
              ) : null}
              {primaryTemplateContext.missing ? (
                <div className="banner subtle" data-testid="template-preview-context-banner">
                  {primaryTemplateContext.detail}
                </div>
              ) : null}
              {primaryTemplateDeployGuardrail ? (
                <div className="banner subtle" data-testid="template-preview-deploy-guardrail">
                  {primaryTemplateDeployGuardrail}
                </div>
              ) : null}
              <div className="banner subtle" data-testid="template-context-boundary-banner">
                {templateContextQueue.detail}
              </div>
              {previewDiffRows.length === 0 ? (
                <div className="banner subtle" data-testid="template-preview-match-banner">
                  Current create form already matches "{primaryTemplate.template_name}".
                </div>
              ) : (
                <div className="list compactList" data-testid="template-preview-diff-list">
                  {previewDiffRows.map((row) => (
                    <div key={`${primaryTemplate.id}-${row.label}`} className="card compactCard diffCard">
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
                <button
                  type="button"
                  onClick={() =>
                    setTemplatePreviewId((currentId) => (currentId === primaryTemplate.id ? "" : primaryTemplate.id))
                  }
                  data-testid={`template-preview-button-${primaryTemplate.id}`}
                >
                  {templatePreviewId === primaryTemplate.id ? "Hide review" : "Review asset"}
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplateToForm(primaryTemplate)}
                  data-testid="template-preview-apply-button"
                >
                  Load into create form
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplateToForm(primaryTemplate, { startEditing: true })}
                  disabled={!primaryTemplateCanEditDirectly}
                  data-testid="template-preview-edit-button"
                >
                  {primaryTemplateCanEditDirectly ? "Edit baseline in form" : "Duplicate to edit"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeployTemplate(primaryTemplate.id)}
                  disabled={
                    deployingTemplateId === primaryTemplate.id ||
                    deploymentLimitReached ||
                    Boolean(deployBlocker?.blocker) ||
                    !primaryTemplateCanDeployDirectly
                  }
                  data-testid="template-preview-deploy-button"
                >
                  {primaryTemplateDeployLabel}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeployTemplate(primaryTemplate.id)}
                  disabled={
                    deployingTemplateId === primaryTemplate.id ||
                    deploymentLimitReached ||
                    Boolean(deployBlocker?.blocker) ||
                    !primaryTemplateCanDeployDirectly
                  }
                  data-testid={`template-deploy-button-${primaryTemplate.id}`}
                >
                  {primaryTemplateDeployLabel}
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplateToForm(primaryTemplate, { startEditing: true })}
                  disabled={!primaryTemplateCanEditDirectly}
                  data-testid={`template-edit-button-${primaryTemplate.id}`}
                >
                  {primaryTemplateCanEditDirectly ? "Edit baseline" : "Duplicate to edit"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDuplicateTemplate(primaryTemplate)}
                  disabled={duplicatingTemplateId === primaryTemplate.id}
                  data-testid={`template-duplicate-button-${primaryTemplate.id}`}
                >
                  {duplicatingTemplateId === primaryTemplate.id ? "Duplicating..." : "Duplicate for variant"}
                </button>
                <button
                  type="button"
                  className="dangerButton"
                  onClick={() => handleDeleteTemplate(primaryTemplate.id)}
                  disabled={deletingTemplateId === primaryTemplate.id || !primaryTemplateCanDeleteDirectly}
                  data-testid={`template-delete-button-${primaryTemplate.id}`}
                >
                  {deletingTemplateId === primaryTemplate.id
                    ? "Deleting..."
                    : primaryTemplateCanDeleteDirectly
                      ? "Delete"
                      : "Owner keeps delete"}
                </button>
              </div>
            </div>
          ) : null}

          {!templatesLoading ? (
            <div className="list compactList" data-testid="templates-list">
              {templateContextQueue.sections.length > 0 ? (
                templateContextQueue.sections.map((section) => (
                  <div key={section.id}>
                    <div className="sectionHeader" data-testid={`template-queue-section-${section.id}`}>
                      <div>
                        <h3 data-testid={`template-queue-title-${section.id}`}>{section.title}</h3>
                        <p className="formHint">{section.detail}</p>
                      </div>
                    </div>
                    {section.templates.map((template) => renderTemplateQueueCard(template, section.id))}
                  </div>
                ))
              ) : (
                <div className="empty">No additional templates beyond the focused preset.</div>
              )}
            </div>
          ) : null}

          {templateDeploySuccess ? (
            <div className="banner success inlineBanner" data-testid="template-deploy-success-banner">
              <div>{templateDeploySuccess}</div>
              {templateCreatedDeployment?.id || buildDeploymentUrl(templateCreatedDeployment) ? (
                <div className="successActions">
                  {templateCreatedDeployment?.id ? (
                    <Link
                      href={`/deployments/${templateCreatedDeployment.id}?source=workflow-success#runtime-detail-passport`}
                      className="landingButton primaryButton"
                      data-testid="template-deploy-success-open-detail-link"
                    >
                      Open deployment passport
                    </Link>
                  ) : null}
                  {buildDeploymentUrl(templateCreatedDeployment) ? (
                    <a
                      href={buildDeploymentUrl(templateCreatedDeployment)}
                      target="_blank"
                      rel="noreferrer"
                      className="linkButton"
                      data-testid="template-deploy-success-open-app-link"
                    >
                      Open app
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="secondaryButton"
                    onClick={() => setWorkflowTab("live")}
                    data-testid="template-deploy-success-open-live-button"
                  >
                    Review live queue
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {templateDuplicateError ? (
            <div className="banner error" data-testid="template-duplicate-error-banner">
              {templateDuplicateError}
            </div>
          ) : null}
          {templateDuplicateSuccess ? (
            <div className="banner success" data-testid="template-duplicate-success-banner">
              {templateDuplicateSuccess}
            </div>
          ) : null}
        </article>
        </section>
        ) : null}
      </div>
    </main>
  );
}

export default function DeploymentWorkflowPage() {
  return (
    <Suspense fallback={<main className="workspaceShell"><div className="card formCard">Loading...</div></main>}>
      <DeploymentWorkflowPageContent />
    </Suspense>
  );
}
