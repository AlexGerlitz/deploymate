"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  smokeDeployments,
  smokeMode,
  smokeServers,
  smokeTemplates,
  smokeUser,
} from "../../lib/smoke-fixtures";
import {
  buildDeploymentUrl,
  buildEnvRowsFromObject,
  buildEnvIssues,
  buildRolloutDraftSummary,
  buildTemplateDiff,
  formatDate,
  formatPortMapping,
  formatServerLabel,
  formatSuggestedPorts,
  isRecentDate,
  normalizeCreateDeploymentError,
  normalizeDeploymentActionError,
  readJsonOrError,
  rolloutReviewerCopy,
} from "../../lib/runtime-workspace-utils";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const localDeploymentsEnabled =
  process.env.NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED !== "0";

function DeploymentWorkflowPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [authChecked, setAuthChecked] = useState(smokeMode);
  const [authFallbackVisible, setAuthFallbackVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState(smokeMode ? smokeUser : null);
  const [deployments, setDeployments] = useState(smokeMode ? smokeDeployments : []);
  const [servers, setServers] = useState(smokeMode ? smokeServers : []);
  const [templates, setTemplates] = useState(smokeMode ? smokeTemplates : []);
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
  const [workflowMessage, setWorkflowMessage] = useState("");
  const [suggestedPorts, setSuggestedPorts] = useState([]);
  const [suggestedPortsLoading, setSuggestedPortsLoading] = useState(false);
  const [workflowTab, setWorkflowTab] = useState("create");
  const [createAdvancedOpen, setCreateAdvancedOpen] = useState(false);
  const [form, setForm] = useState({
    image: "",
    name: "",
    internal_port: "",
    external_port: "",
    server_id: "",
  });
  const [templateName, setTemplateName] = useState("");
  const [envRows, setEnvRows] = useState([{ key: "", value: "" }]);

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
      deployment.server_name,
      deployment.server_host,
      deployment.status,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedDeploymentQuery));
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
  const workflowPriority =
    deployments.some((deployment) => deployment.status === "failed")
      ? "Failed rollout needs review before the next deploy."
      : templates.length > 0
        ? "Template-driven rollout path is ready."
        : "Create the next deployment from one guided workspace.";
  const workflowPrimaryMode = deployments.some((deployment) => deployment.status === "failed")
    ? "live"
    : "create";
  const workflowPrimaryAction = workflowPrimaryMode === "live"
    ? {
        title: "Review the failed rollout first",
        detail:
          "One deployment already needs attention, so the clearest next step is opening the live queue and drilling into the affected runtime before making more changes.",
        href: "#runtime-deployments",
        actionLabel: "Open live deployments",
      }
    : {
        title: "Start the next rollout",
        detail:
          "If you came here to make something work, the main path is the guided create form below. It keeps image, target, ports, env vars, and template save in one place.",
        href: "#create-deployment",
        actionLabel: "Create deployment",
      };
  const primaryRuntimeDeployment =
    filteredDeployments.find((deployment) => deployment.status === "failed") ||
    filteredDeployments[0] ||
    null;
  const secondaryRuntimeDeployments = primaryRuntimeDeployment
    ? filteredDeployments.filter((deployment) => deployment.id !== primaryRuntimeDeployment.id)
    : [];
  const requestedTemplateId = searchParams.get("template") || "";
  const requestedTemplateAction = searchParams.get("template_action") || "preview";
  const requestedTemplateSource = searchParams.get("template_source") || "";

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
    if (requestedTemplateSource !== "deployment-detail") {
      return;
    }

    setWorkflowMessage("Template opened from deployment detail. Review, reuse, or edit it here in the main rollout workspace.");
  }, [requestedTemplateSource]);

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

  const currentDraft = buildCurrentDraft();
  const templateFormPreflight = validateTemplateDraft(currentDraft, {
    ignoreTemplateId: editingTemplateId,
  });
  const createDeploymentBlocked =
    submitting ||
    deploymentLimitReached ||
    (!localDeploymentsEnabled && !form.server_id);
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
        <section className="workspaceHero">
          <div className="workspaceHeroBackdrop" />
          <div className="header workspaceHeroHeader">
            <div>
              <div className="eyebrow">Deployment workspace</div>
              <h1 data-testid="deployment-workflow-title">Deployment workflow</h1>
              <p>
                {currentUser
                  ? `Logged in as ${currentUser.username}. ${workflowPriority}`
                  : rolloutReviewerCopy.workflow.heroBody}
              </p>
            </div>
            <div className="buttonRow workspaceHeroActions">
              <Link href="#create-deployment" className="landingButton primaryButton workspacePrimaryAction">
                Create deployment
              </Link>
              <Link href="#runtime-deployments" className="workspaceGhostAction">
                Live deployments
              </Link>
              <Link href="#templates" className="workspaceGhostAction">
                Templates
              </Link>
              <Link href="/app" className="workspaceGhostAction">
                Back to overview
              </Link>
              {currentUser?.is_admin ? (
                <Link href="/app/server-review" className="workspaceGhostAction">
                  Server review
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => refreshWorkspace()}
                disabled={loading || serversLoading || templatesLoading}
                className="linkButton workspaceSecondaryAction"
              >
                {loading || serversLoading || templatesLoading ? "Refreshing..." : "Refresh"}
              </button>
              <button type="button" onClick={handleLogout} className="workspaceGhostAction">
                Logout
              </button>
            </div>
          </div>

          <div className="workspaceHeroSummary">
            <div className="workspaceHeroMetric">
              <span>Deployments</span>
              <strong>{deployments.filter((deployment) => deployment.status === "running").length}</strong>
              <p>
                Running now · {deployments.length} total ·{" "}
                {deployments.filter((deployment) => deployment.status === "failed").length} failed
              </p>
            </div>
            <div className="workspaceHeroMetric">
              <span>Templates</span>
              <strong>{templates.length}</strong>
              <p>
                Saved rollout presets · {templates.filter((template) => (template.use_count || 0) > 0).length} used ·{" "}
                {templates.filter((template) => (template.use_count || 0) === 0).length} unused
              </p>
            </div>
            <div className="workspaceHeroMetric">
              <span>Targets</span>
              <strong>{servers.length}</strong>
              <p>
                Saved server targets · {localDeploymentsEnabled ? "local and remote" : "remote only"} rollout mode
              </p>
            </div>
            <div className="workspaceHeroBadge workspaceHeroSpotlight">
              <span>Main next step</span>
              <strong>{workflowPriority}</strong>
              <p>
                {rolloutReviewerCopy.workflow.spotlightBody}
              </p>
            </div>
          </div>
        </section>

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

        <article className="card formCard workspaceGuidePanel" data-testid="deployment-workflow-primary-action-card">
          <div className="sectionHeader workspaceGuideHeader">
            <div>
              <h2 data-testid="deployment-workflow-primary-action-title">{workflowPrimaryAction.title}</h2>
              <p className="formHint">
                {workflowPrimaryAction.detail} Pick one lane below and ignore the rest until this job is done.
              </p>
            </div>
          </div>
          <div className="workspaceReviewerGrid">
            <article className="workspaceReviewerCard">
              <span>Do this now</span>
              <strong>{workflowPrimaryAction.actionLabel}</strong>
              <p>
                {workflowPrimaryMode === "live"
                  ? "A failed rollout already exists, so review the live queue before creating anything new."
                  : "Start the next deployment from one guided form instead of scanning the whole workspace."}
              </p>
              <Link href={workflowPrimaryAction.href} className="landingButton primaryButton">
                {workflowPrimaryAction.actionLabel}
              </Link>
            </article>
            <article className="workspaceReviewerCard">
              <span>Or switch lane</span>
              <strong>Keep only one lane open</strong>
              <p>
                Live review, create, and templates are still here, but only one should stay open on screen at a time.
              </p>
              <div
                className="filterTabs"
                role="tablist"
                aria-label="Deployment workflow tabs"
                data-testid="deployment-workflow-tabs-card"
              >
                <button
                  type="button"
                  className={workflowTab === "live" ? "active" : ""}
                  onClick={() => setWorkflowTab("live")}
                  data-testid="deployment-workflow-tab-live"
                >
                  Live
                </button>
                <button
                  type="button"
                  className={workflowTab === "create" ? "active" : ""}
                  onClick={() => setWorkflowTab("create")}
                  data-testid="deployment-workflow-tab-create"
                >
                  Create
                </button>
                <button
                  type="button"
                  className={workflowTab === "templates" ? "active" : ""}
                  onClick={() => setWorkflowTab("templates")}
                  data-testid="deployment-workflow-tab-templates"
                >
                  Templates
                </button>
              </div>
            </article>
          </div>
        </article>

        <section hidden={workflowTab !== "live"}>
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
                  <p>
                    {primaryRuntimeDeployment.server_name
                      ? `${primaryRuntimeDeployment.server_name} (${primaryRuntimeDeployment.server_host})`
                      : "Local target"}
                  </p>
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
                <Link
                  href={`/deployments/${primaryRuntimeDeployment.id}`}
                  className="linkButton"
                  data-testid={`runtime-deployment-details-link-${primaryRuntimeDeployment.id}`}
                >
                  View details
                </Link>
                {buildDeploymentUrl(primaryRuntimeDeployment) ? (
                  <a
                    href={buildDeploymentUrl(primaryRuntimeDeployment)}
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
                  onClick={() => handleDelete(primaryRuntimeDeployment.id)}
                  disabled={deletingDeploymentId === primaryRuntimeDeployment.id}
                >
                  {deletingDeploymentId === primaryRuntimeDeployment.id ? "Deleting..." : "Delete"}
                </button>
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
                {secondaryRuntimeDeployments.map((deployment) => (
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
                      <span>{buildDeploymentUrl(deployment) || "Internal only"}</span>
                    </div>
                    <div className="row">
                      <span className="label">Created</span>
                      <span>{formatDate(deployment.created_at)}</span>
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
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </div>
        </section>

        <section hidden={workflowTab !== "create"}>
        <article className="card formCard" data-testid="create-deployment-card" id="create-deployment">
          <h2 data-testid="create-deployment-title">Create deployment</h2>
          <p className="formHint">
            Start with the smallest possible rollout: image first, then open advanced setup only if you need naming, ports, env vars, server targeting, or template save.
          </p>
          {!localDeploymentsEnabled ? (
            <div className="banner subtle">
              This environment is running in remote-only mode. Local host deployments are disabled.
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
                ? "Image is set. Create now if defaults are enough, or open advanced setup for ports, env vars, server target, and template save."
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
          {templateFormPreflight.errors.length > 0 ? (
            <div className="banner error">{templateFormPreflight.errors[0]}</div>
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
              {createdDeployment?.id || buildDeploymentUrl(createdDeployment) ? (
                <div className="successActions">
                  {createdDeployment?.id ? (
                    <Link href={`/deployments/${createdDeployment.id}`} className="linkButton">
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
        </section>

        <section hidden={workflowTab !== "templates"}>
        <article className="card formCard" data-testid="templates-card" id="templates">
          <div className="sectionHeader" data-testid="templates-section-header">
            <div>
              <h2 data-testid="templates-section-title">Deployment templates</h2>
              <p className="formHint">
                Preview, deploy, edit, duplicate, or delete rollout presets without leaving the deployment workflow.
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
