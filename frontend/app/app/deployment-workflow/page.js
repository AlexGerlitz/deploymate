"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  smokeDeployments,
  smokeInternalRuntimeDeployment,
  smokeMode,
  smokeServers,
  smokeTemplates,
  smokeUser,
} from "../../lib/smoke-fixtures";
import {
  copyTextToClipboard,
} from "../../lib/admin-page-utils";
import {
  buildDeploymentUrl,
  buildDeploymentWorkflowNextStep,
  buildDeploymentWorkflowState,
  buildEnvRowsFromObject,
  buildEnvIssues,
  buildRolloutDraftSummary,
  buildTemplateDiff,
  formatAccessibleServerLabel,
  formatDate,
  formatPortMapping,
  formatServerLabel,
  formatSuggestedPorts,
  isRecentDate,
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
      };

function buildRuntimeCardActionState(deployment) {
  const runtimeUrl = buildDeploymentUrl(deployment);
  const failed = deployment?.status === "failed";
  const stableWithoutPublicUrl = deployment?.status === "running" && !runtimeUrl;

  return {
    runtimeUrl,
    detailsClassName: failed || !runtimeUrl ? "landingButton primaryButton" : "secondaryButton",
    detailsLabel: failed
      ? "Review runtime issues"
      : stableWithoutPublicUrl
        ? "Review stable runtime"
        : "View details",
    openAppClassName: failed ? "linkButton" : "landingButton primaryButton",
    showOpenAppPrimary: Boolean(runtimeUrl) && !failed,
    showOpenAppSecondary: Boolean(runtimeUrl) && failed,
  };
}

function DeploymentWorkflowPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [authChecked, setAuthChecked] = useState(smokeMode);
  const [authFallbackVisible, setAuthFallbackVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState(smokeMode ? smokeUser : null);
  const [deployments, setDeployments] = useState(smokeMode ? smokeWorkflowFixture.deployments : []);
  const [servers, setServers] = useState(smokeMode ? smokeWorkflowFixture.servers : []);
  const [templates, setTemplates] = useState(smokeMode ? smokeWorkflowFixture.templates : []);
  const [loading, setLoading] = useState(!smokeMode);
  const [serversLoading, setServersLoading] = useState(!smokeMode);
  const [templatesLoading, setTemplatesLoading] = useState(!smokeMode);
  const [error, setError] = useState("");
  const [serversError, setServersError] = useState("");
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
  const [templateQuery, setTemplateQuery] = useState("");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [templatePreviewId, setTemplatePreviewId] = useState(smokeMode ? "smoke-template" : "");
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [workflowMessage, setWorkflowMessage] = useState(smokeMode ? smokeWorkflowFixture.workflowMessage : "");
  const [suggestedPorts, setSuggestedPorts] = useState([]);
  const [suggestedPortsLoading, setSuggestedPortsLoading] = useState(false);
  const [workflowTab, setWorkflowTab] = useState("create");
  const [createAdvancedOpen, setCreateAdvancedOpen] = useState(false);
  const [form, setForm] = useState({
    image: smokeMode ? smokeWorkflowFixture.form.image : "",
    name: smokeMode ? smokeWorkflowFixture.form.name : "",
    internal_port: smokeMode ? smokeWorkflowFixture.form.internal_port : "",
    external_port: smokeMode ? smokeWorkflowFixture.form.external_port : "",
    server_id: smokeMode ? smokeWorkflowFixture.form.server_id : "",
  });
  const [templateName, setTemplateName] = useState("");
  const [envRows, setEnvRows] = useState([{ key: "", value: "" }]);
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
        template.image,
        template.name,
        template.server_name,
        template.server_host,
        Object.keys(template.env || {}).join(" "),
        Object.values(template.env || {}).join(" "),
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
  const workflowState = buildDeploymentWorkflowState({
    isAdmin: canAccessServers,
    localDeploymentsEnabled,
    deploymentsTotal: deployments.length,
    failedDeployments: failedDeploymentCount,
    serversTotal: servers.length,
  });
  const workflowPriority =
    serverAccessBlocked
      ? "Admins manage the saved server target here. Your job on this page is still choosing what app should run next."
      : workflowState.mode === "prerequisite"
      ? "Before Step 2 can start for a remote rollout, Step 1 needs one saved server target."
      : workflowState.mode === "live"
        ? "One rollout needs attention. Review what is already running before you start another one."
        : templates.length > 0
          ? "You can start from a blank form or reuse one saved setup."
          : "This page is where you choose one app image and start it.";
  const workflowPrimaryMode = workflowState.mode === "live" ? "live" : "create";
  const primaryRuntimeDeployment =
    filteredDeployments.find((deployment) => deployment.status === "failed") ||
    filteredDeployments[0] ||
    null;
  const primaryRuntimeActionState = primaryRuntimeDeployment
    ? buildRuntimeCardActionState(primaryRuntimeDeployment)
    : null;
  const secondaryRuntimeDeployments = primaryRuntimeDeployment
    ? filteredDeployments.filter((deployment) => deployment.id !== primaryRuntimeDeployment.id)
    : [];
  const requestedTemplateId = searchParams.get("template") || "";
  const requestedTemplateAction = searchParams.get("template_action") || "preview";
  const requestedTemplateSource = searchParams.get("template_source") || "";
  const requestedServerId = searchParams.get("server") || "";
  const requestedSource = searchParams.get("source") || "";
  const requestedFromOverview = requestedSource === "overview-first-deploy";
  const requestedFromServerReview = requestedSource === "server-review";
  const requestedWithServerContext = requestedFromServerReview || requestedFromOverview;
  const selectedCreateServer =
    servers.find((server) => server.id === form.server_id) || null;
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
      : workflowPrimaryMode === "live"
        ? "Because something already needs review, start by checking the live queue before you create another deployment."
        : "Keep Step 2 simple: choose an app image or a saved setup first, then open advanced fields only if the rollout really needs them.";
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

  async function refreshWorkspace(silent = false) {
    if (smokeMode) {
      return;
    }

    const user = await fetchCurrentUser();
    await Promise.all([
      loadDeployments(silent),
      loadServers(user, silent),
      loadTemplates(silent),
    ]);
  }

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
      form.external_port.trim() ||
      form.server_id ||
      templateName.trim() ||
      envRows.some((row) => row.key.trim() || row.value.trim()) ||
      editingTemplateId
    ) {
      setCreateAdvancedOpen(true);
    }
  }, [
    editingTemplateId,
    envRows,
    form.external_port,
    form.internal_port,
    form.name,
    form.server_id,
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

    setWorkflowMessage("Template opened from deployment detail. Review, reuse, or edit it here in the main rollout workspace.");
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
    }

    if (requestedTemplateSource === "deployment-detail") {
      setWorkflowMessage(
        requestedTemplateAction === "edit"
          ? `Template "${targetTemplate.template_name}" opened from deployment detail and loaded into the form for editing.`
          : `Template "${targetTemplate.template_name}" opened from deployment detail. Review, reuse, or edit it here.`,
      );
    }
  }, [requestedTemplateAction, requestedTemplateId, requestedTemplateSource, templates]);

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
      setWorkflowTab("live");
      setSubmitSuccess("Deployment created. Open runtime detail next while this rollout is still fresh.");
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

  const currentDraft = buildCurrentDraft();
  const templateFormPreflight = validateTemplateDraft(currentDraft, {
    ignoreTemplateId: editingTemplateId,
    canAccessServers,
  });
  const rolloutDraftStarted = Boolean(
    form.image.trim() ||
      form.name.trim() ||
      form.internal_port.trim() ||
      form.external_port.trim() ||
      templateName.trim() ||
      editingTemplateId ||
      envRows.some((row) => row.key.trim() || row.value.trim()),
  );
  const firstDeployCreatePriority =
    Boolean(form.server_id) &&
    deployments.length === 0 &&
    !rolloutDraftStarted &&
    !editingTemplateId;
  const showLiveTab = deployments.length > 0;
  const createDeploymentBlocked =
    submitting ||
    deploymentLimitReached ||
    (!localDeploymentsEnabled && !form.server_id);
  const workflowNextStep = buildDeploymentWorkflowNextStep({
    workflowState,
    localDeploymentsEnabled,
    deploymentLimitReached,
    filteredDeployments,
    templatesCount: templates.length,
    serversCount: servers.length,
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
          primaryAction: "Open live deployments",
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
        ? { kind: "button", tab: "live", label: "Open live deployments" }
        : workflowState.mode === "prerequisite"
          ? { kind: "link", href: "/app/server-review", label: "Open server review" }
          : failedDeploymentCount > 0
            ? { kind: "button", tab: "live", label: "Open live deployments" }
            : memberWorkflowNextStep.primaryAction === "Open templates"
              ? { kind: "button", tab: "templates", label: "Open saved setups" }
              : memberWorkflowNextStep.primaryAction === "Fix the create form"
                ? { kind: "button", tab: "create", label: "Fix the create form" }
                : { kind: "button", tab: "create", label: "Create deployment" };
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
              <h1 data-testid="deployment-workflow-title">Step 2: Choose what to run and deploy it</h1>
              <p className="formHint">{stepTwoLead}</p>
              <p className="formHint">{stepTwoSupport}</p>
              <p className="formHint">
                Right now: <strong>{memberWorkflowNextStep.focus}</strong>
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
                disabled={loading || serversLoading || templatesLoading}
                className="secondaryButton"
              >
                {loading || serversLoading || templatesLoading ? "Refreshing..." : "Refresh"}
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
        {requestedWithServerContext && selectedCreateServer ? (
          <article className="card formCard">
            <div className="sectionHeader">
              <div>
                <h2>Server ready</h2>
                <p className="formHint">
                  Step 1 is complete for <strong>{selectedCreateServer.name}</strong>. Stay on this server and choose what to run next.
                </p>
              </div>
              <span className="status healthy">ready</span>
            </div>
            <div className="backupSummaryBadges">
              <span className="status info">{selectedServerLabel}</span>
              <span className="status healthy">Step 1 done</span>
              <span className="status unknown">Now: choose what to run</span>
            </div>
          </article>
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
              <Link href="/app/server-review" className="landingButton primaryButton">
                Open server review
              </Link>
              <Link href="/app" className="landingButton secondaryButton">
                Back to overview
              </Link>
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
                className="landingButton primaryButton"
                onClick={() => setWorkflowTab("live")}
              >
                Open live deployments
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
                  Members cannot access saved server inventory here. Ask an admin to confirm the remote target first, then come back when Step 2 is actually open.
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
              <Link href="/app" className="landingButton primaryButton">
                Back to overview
              </Link>
              {filteredDeployments.length > 0 ? (
                <button
                  type="button"
                  className="landingButton secondaryButton"
                  onClick={() => setWorkflowTab("live")}
                >
                  Open live deployments
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
                Use one lane at a time on this page. Finish the current job before you open the others.
              </p>
            </div>
          </div>
          <div className="row">
            <span className="label">Current focus</span>
            <span data-testid="deployment-workflow-main-next-step-focus">{memberWorkflowNextStep.focus}</span>
          </div>
          <div className="row">
            <span className="label">What to do</span>
            <span data-testid="deployment-workflow-main-next-step-copy">{memberWorkflowNextStep.nextStep}</span>
          </div>
          <div className="backupSummaryBadges">
            <span className={`status ${memberWorkflowNextStep.tone}`}>filtered {filteredDeployments.length}</span>
            <span className="status healthy">running {runningDeploymentCount}</span>
            <span className="status error">failed {failedDeploymentCount}</span>
            <span className="status info">templates {templates.length}</span>
          </div>
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
                className={workflowTab === "templates" ? "active" : ""}
                onClick={() => setWorkflowTab("templates")}
                data-testid="deployment-workflow-tab-templates"
              >
                {firstDeployCreatePriority ? "Use saved setup instead" : "Use saved setup"}
              </button>
            </div>
          ) : null}
          <div className="actionCluster">
            {pagePrimaryAction.kind === "link" ? (
              <Link
                href={pagePrimaryAction.href}
                className="landingButton primaryButton"
                data-testid="deployment-workflow-main-next-step-button"
              >
                {pagePrimaryAction.label}
              </Link>
            ) : (
              <button
                type="button"
                className="landingButton primaryButton"
                data-testid="deployment-workflow-main-next-step-button"
                onClick={() => setWorkflowTab(pagePrimaryAction.tab)}
              >
                {pagePrimaryAction.label}
              </button>
            )}
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
          className="sectionHeader deploymentsHeader"
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
                  <span>Endpoint</span>
                  <strong>{buildDeploymentUrl(primaryRuntimeDeployment) || "Internal only"}</strong>
                </div>
                <div className="deploymentMetric">
                  <span>Ports</span>
                  <strong>
                    {primaryRuntimeDeployment.internal_port || "-"} {"->"} {primaryRuntimeDeployment.external_port || "-"}
                  </strong>
                </div>
              </div>
              <div className="row">
                <span className="label">Created</span>
                <span>{formatDate(primaryRuntimeDeployment.created_at)}</span>
              </div>
              <div className="row">
                <span className="label">Error</span>
                <span>{primaryRuntimeDeployment.error || "-"}</span>
              </div>
              <div className="row">
                <span className="label">URL</span>
                <span>{buildDeploymentUrl(primaryRuntimeDeployment) || "-"}</span>
              </div>
              <div className="actions">
                {primaryRuntimeActionState?.showOpenAppPrimary ? (
                  <a
                    href={primaryRuntimeActionState.runtimeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={primaryRuntimeActionState.openAppClassName}
                    data-testid={`runtime-deployment-open-app-link-${primaryRuntimeDeployment.id}`}
                  >
                    Open app
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
                    Open app
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
                        <span className="label">Endpoint</span>
                        <span>{runtimeActionState.runtimeUrl || "Internal only"}</span>
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
                            Open app
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
                            Open app
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
        <section hidden={workflowTab !== "create"}>
        <article className="card formCard" data-testid="create-deployment-card" id="create-deployment">
          <h2 data-testid="create-deployment-title">Step 2A: Start one app</h2>
          <p className="formHint">
            {serverAccessBlocked
              ? "Members cannot choose saved servers here. Ask an admin to confirm the target, then keep this form focused on the app itself."
              : workflowState.mode === "prerequisite"
                ? "This becomes the main path as soon as Step 1 has one saved server target. When that is done, start with the image first and open advanced setup only if needed."
                : "For a first pass, start with the image first. Leave advanced setup closed unless you need custom ports, env vars, server targeting, or a saved setup."}
          </p>
          {!localDeploymentsEnabled ? (
            <div className="banner subtle">
              {serverAccessBlocked
                ? "This workspace is remote-only and the saved server target is managed by an admin."
                : "This environment is running in remote-only mode. Local host deployments are disabled."}
            </div>
          ) : null}
          {serverAccessBlocked ? (
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
                name="image"
                value={form.image}
                onChange={updateFormField}
                placeholder="nginx:latest"
                disabled={submitting}
                required
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
                    ? `Overview already handed you "${selectedCreateServer.name}". Set the image next and keep the rest closed unless the rollout really needs more.`
                    : `Server "${selectedCreateServer.name}" is already selected from Step 1. Set the image next and keep the rest closed unless the rollout really needs more.`
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
                  Save the current image, name, ports, server, and env vars as a reusable preset.
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
            <div className="banner success">
              <div>{submitSuccess}</div>
              {createdDeployment?.container_name || createdDeployment?.image ? (
                <div className="formHint">
                  New rollout: {createdDeployment.container_name || createdDeployment.image}
                </div>
              ) : null}
              {createdDeployment?.id || buildDeploymentUrl(createdDeployment) ? (
                <div className="successActions">
                  {createdDeployment?.id ? (
                    <Link href={`/deployments/${createdDeployment.id}`} className="landingButton primaryButton">
                      Open runtime detail
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
              <h2 data-testid="templates-section-title">Step 2B: Reuse a saved setup</h2>
              <p className="formHint">
                A template is just a saved rollout setup. Reuse one when you do not want to fill the whole form again.
              </p>
            </div>
          </div>

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
              placeholder="template name, image, server, env key"
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
                    Keep one template in focus while the rest stay in a compact queue below.
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
                  {templatePreviewId === primaryTemplate.id ? "Hide preview" : "Focus"}
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplateToForm(primaryTemplate)}
                  data-testid="template-preview-apply-button"
                >
                  Apply to form
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplateToForm(primaryTemplate, { startEditing: true })}
                  data-testid="template-preview-edit-button"
                >
                  Edit in form
                </button>
                <button
                  type="button"
                  onClick={() => handleDeployTemplate(primaryTemplate.id)}
                  disabled={deployingTemplateId === primaryTemplate.id || deploymentLimitReached}
                  data-testid="template-preview-deploy-button"
                >
                  {deployingTemplateId === primaryTemplate.id ? "Deploying..." : "Deploy from preview"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeployTemplate(primaryTemplate.id)}
                  disabled={deployingTemplateId === primaryTemplate.id || deploymentLimitReached}
                  data-testid={`template-deploy-button-${primaryTemplate.id}`}
                >
                  {deployingTemplateId === primaryTemplate.id ? "Deploying..." : "Deploy now"}
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplateToForm(primaryTemplate, { startEditing: true })}
                  data-testid={`template-edit-button-${primaryTemplate.id}`}
                >
                  Edit in form
                </button>
                <button
                  type="button"
                  onClick={() => handleDuplicateTemplate(primaryTemplate)}
                  disabled={duplicatingTemplateId === primaryTemplate.id}
                  data-testid={`template-duplicate-button-${primaryTemplate.id}`}
                >
                  {duplicatingTemplateId === primaryTemplate.id ? "Duplicating..." : "Duplicate"}
                </button>
                <button
                  type="button"
                  className="dangerButton"
                  onClick={() => handleDeleteTemplate(primaryTemplate.id)}
                  disabled={deletingTemplateId === primaryTemplate.id}
                  data-testid={`template-delete-button-${primaryTemplate.id}`}
                >
                  {deletingTemplateId === primaryTemplate.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          ) : null}

          {!templatesLoading ? (
            <div className="list compactList" data-testid="templates-list">
              {secondaryTemplates.length > 0 ? secondaryTemplates.map((template) => (
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
                    <span className="label">Server</span>
                    <span>{formatServerLabel(template.server_name, template.server_host)}</span>
                  </div>
                  <div className="row">
                    <span className="label">Used</span>
                    <span>{template.use_count || 0}</span>
                  </div>
                  <div className="actions">
                    <button
                      type="button"
                      onClick={() => setTemplatePreviewId(template.id)}
                      data-testid={`template-preview-button-${template.id}`}
                    >
                      Focus
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
              )) : (
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
                    <Link href={`/deployments/${templateCreatedDeployment.id}`} className="linkButton">
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
