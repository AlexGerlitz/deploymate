"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { readJsonOrError } from "../../lib/admin-page-utils";
import { smokeMode, smokeServers, smokeUser } from "../../lib/smoke-fixtures";
import {
  AdminFeedbackBanners,
  AdminSurfaceQueue,
  AdminSurfaceQueueCard,
} from "../admin-ui";
import {
  segmentFilterOptions,
  starterRuntimeMode,
  starterStrings,
} from "./starter-data";
import {
  createServerReviewServer,
  deleteServerReviewServer,
  fetchServerReviewStarterList,
  fetchServerReviewSuggestedPorts,
  runServerReviewStarterAction,
  updateServerReviewServer,
} from "./starter-api";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const localDeploymentsEnabled =
  process.env.NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED !== "0";
const smokeServerReviewScenario =
  process.env.NEXT_PUBLIC_SMOKE_SERVER_REVIEW_SCENARIO || "empty";
const smokeServerReviewFixture =
  smokeMode && smokeServerReviewScenario === "pending"
    ? {
        servers: [smokeServers[0]],
        successMessage:
          'Loaded 1 saved server target. Finish the check before adding another server.',
      }
    : {
        servers: [],
        successMessage: "Start here: save one server target, then run one check.",
      };

function buildServerMeta(server, diagnostics, suggestedPorts) {
  const target = `${server.username}@${server.host}:${server.port}`;
  const authLabel = server.auth_type === "ssh_key" ? "SSH key auth" : "Auth review";
  const portsLabel =
    Array.isArray(suggestedPorts) && suggestedPorts.length > 0
      ? `suggested ${suggestedPorts.join(", ")}`
      : "ports pending";
  const deploymentLabel =
    typeof diagnostics?.deployment_count === "number"
      ? `${diagnostics.deployment_count} deployment${diagnostics.deployment_count === 1 ? "" : "s"}`
      : "deployment count pending";

  return `${target} · ${authLabel} · ${deploymentLabel} · ${portsLabel}`;
}

function buildServerNote(server, testResult, diagnostics) {
  if (diagnostics) {
    const details = [
      diagnostics.hostname || diagnostics.target,
      diagnostics.operating_system || "OS pending",
      diagnostics.docker_version || "Docker version pending",
      Array.isArray(diagnostics.listening_ports) && diagnostics.listening_ports.length > 0
        ? `listening ${diagnostics.listening_ports.join(", ")}`
        : "listening ports pending",
    ];
    return details.filter(Boolean).join(" · ");
  }

  if (testResult?.message) {
    return testResult.message;
  }

  if (server.auth_type !== "ssh_key") {
    return "Server still needs auth review before diagnostics can be trusted.";
  }

  return "Run connection test or diagnostics to confirm server readiness before the next rollout.";
}

function buildServerSegment(server, testResult, diagnostics) {
  if (server.auth_type !== "ssh_key") {
    return "auth";
  }

  if (diagnostics?.overall_status === "ok") {
    return "ready";
  }

  if (testResult?.status === "success") {
    return "ready";
  }

  return "diagnostics";
}

function buildServerStatus(server, testResult, diagnostics) {
  if (diagnostics?.overall_status) {
    return diagnostics.overall_status;
  }

  if (testResult?.status === "success") {
    return "reachable";
  }

  if (testResult?.status === "error") {
    return "needs-check";
  }

  return server.auth_type === "ssh_key" ? "needs-check" : "auth-review";
}

function mapServerToItem(server, runtimeState) {
  const testResult = runtimeState.testResults[server.id] || null;
  const diagnostics = runtimeState.diagnostics[server.id] || null;
  const suggestedPorts = runtimeState.suggestedPorts[server.id] || [];

  return {
    id: server.id,
    label: server.name,
    status: buildServerStatus(server, testResult, diagnostics),
    segment: buildServerSegment(server, testResult, diagnostics),
    meta: buildServerMeta(server, diagnostics, suggestedPorts),
    note: buildServerNote(server, testResult, diagnostics),
    server,
    testResult,
    diagnostics,
    suggestedPorts,
  };
}

function InlineHelp({ id, label, text, testId, isOpen, onToggle }) {
  return (
    <div className="inlineHelp" data-help-id={id}>
      <button
        type="button"
        className="inlineHelpButton"
        data-testid={testId}
        aria-label={label}
        aria-expanded={isOpen}
        onClick={() => onToggle(id)}
      >
        ?
      </button>
      {isOpen ? <div className="inlineHelpBubble">{text}</div> : null}
    </div>
  );
}

function ServerReviewPageContent() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(smokeMode);
  const [authFallbackVisible, setAuthFallbackVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState(smokeMode ? smokeUser : null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(smokeMode ? smokeServerReviewFixture.successMessage : "Start here: save one server target, then run one check.");
  const [servers, setServers] = useState(smokeMode ? smokeServerReviewFixture.servers : []);
  const [serverTestResults, setServerTestResults] = useState({});
  const [serverDiagnostics, setServerDiagnostics] = useState({});
  const [serverSuggestedPorts, setServerSuggestedPorts] = useState({});
  const [selectedItemId, setSelectedItemId] = useState(
    smokeMode ? smokeServerReviewFixture.servers[0]?.id || "" : "",
  );
  const [actionNote, setActionNote] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverSubmitting, setServerSubmitting] = useState(false);
  const [serverUpdating, setServerUpdating] = useState(false);
  const [deletingServerId, setDeletingServerId] = useState("");
  const [openHelpId, setOpenHelpId] = useState("");
  const [query, setQuery] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [serverForm, setServerForm] = useState({
    name: "",
    host: "",
    port: "22",
    username: "",
    ssh_key: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    host: "",
    port: "22",
    username: "",
    ssh_key: "",
  });

  const runtimeState = useMemo(
    () => ({
      testResults: serverTestResults,
      diagnostics: serverDiagnostics,
      suggestedPorts: serverSuggestedPorts,
    }),
    [serverDiagnostics, serverSuggestedPorts, serverTestResults],
  );
  const canAccessServers = Boolean(currentUser?.is_admin);
  const blockedLead = localDeploymentsEnabled
    ? "Saved server targets stay with admins. Your next step is choosing what to run in Deployment Workflow."
    : "Step 1 is admin-only in this remote-only workspace. Ask an admin to save and confirm one server target first.";
  const blockedSupport = localDeploymentsEnabled
    ? "This page should not distract you with server-edit controls you cannot use."
    : "Until an admin confirms the target, this page should not pretend you can finish server setup here.";

  const items = useMemo(
    () => servers.map((server) => mapServerToItem(server, runtimeState)),
    [runtimeState, servers],
  );

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery =
        !normalized ||
        [
          item.label,
          item.status,
          item.note,
          item.meta,
          item.segment,
          item.server.host,
          item.server.username,
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalized));
      const matchesSegment = segmentFilter === "all" || item.segment === segmentFilter;
      return matchesQuery && matchesSegment;
    });
  }, [items, query, segmentFilter]);

  const selectedItem =
    filteredItems.find((item) => item.id === selectedItemId) ||
    items.find((item) => item.id === selectedItemId) ||
    filteredItems[0] ||
    items[0] ||
    null;

  const noServers = items.length === 0;
  const readyCount = items.filter((item) => item.segment === "ready").length;
  const reviewCount = items.filter((item) => item.segment !== "ready").length;
  const selectedReadyItem =
    selectedItem?.segment === "ready"
      ? selectedItem
      : items.find((item) => item.segment === "ready") || null;
  const selectedNeedsReviewItem =
    selectedItem && selectedItem.segment !== "ready"
      ? selectedItem
      : items.find((item) => item.segment !== "ready") || null;
  const heroSpotlight = noServers
    ? {
        badge: "Do this now",
        title: "Save one server for Step 1",
        detail: "Start narrow: save one SSH target first, then run one check on that same machine.",
        support: "You do not need a server list yet. One good target is enough to move the main path forward.",
        actionLabel: "Save first server",
        actionKind: "create",
      }
    : selectedReadyItem
      ? {
          badge: "Step 1 complete",
          title: `${selectedReadyItem.label} is ready for Step 2`,
          detail: "You already have one confirmed server. Keep the momentum and choose what to run next.",
          support: "You can always come back later, but the main path has already moved on from this screen.",
          actionLabel: "Go to Step 2",
          actionKind: "continue",
          actionHref: `/app/deployment-workflow?server=${selectedReadyItem.id}&source=server-review`,
        }
      : {
          badge: "Do this now",
          title: `Check ${selectedNeedsReviewItem?.label || "your saved server"}`,
          detail: "You already saved a server. The next useful move is one readiness check, not another form.",
          support: selectedNeedsReviewItem
            ? `${selectedNeedsReviewItem.label} is the best next target to confirm before you continue.`
            : "Pick one saved server and finish the check before you add more targets.",
          actionLabel:
            selectedItem && selectedItem.segment !== "ready"
              ? "Open this server check"
              : "Open next server check",
          actionKind: "queue",
        };
  const stepCards = [
    {
      id: "save",
      label: "1. Save",
      title: "Save one server",
      detail: "Give DeployMate one SSH target first.",
      state: noServers ? "current" : "complete",
    },
    {
      id: "check",
      label: "2. Check",
      title: "Run one check",
      detail: "Confirm the server is reachable and ready.",
      state: noServers ? "upcoming" : selectedReadyItem ? "complete" : "current",
    },
    {
      id: "continue",
      label: "3. Continue",
      title: "Move to app setup",
      detail: "Choose what to run only after one server looks ready.",
      state: selectedReadyItem ? "current" : "upcoming",
    },
  ];
  const createSectionEyebrow = noServers ? "Step 1: save one server" : "Only if needed";
  const createSectionTitle = noServers
    ? "Save one server target"
    : "Add another server only if this one is not the right target";
  const createSectionCopy = noServers
    ? "Fill this in once, save one machine, then run one check. Stop here as soon as one server is ready."
    : selectedReadyItem
      ? "You already have a server that is ready for Step 2. This form is secondary now."
      : "A saved server already exists. Finish its check before adding another target unless you picked the wrong machine.";
  const createSubmitLabel = noServers ? "Save first server" : "Save another server";
  const nextPanelLabel = noServers
    ? "What happens next"
    : selectedReadyItem
      ? "You can leave this page"
      : "You are almost done here";
  const nextPanelTitle = noServers
    ? "One good server is enough for this step"
    : selectedReadyItem
      ? `${selectedReadyItem.label} is ready for Step 2`
      : "One saved server still needs a quick check";
  const nextPanelCopy = noServers
    ? "You do not need a list of servers yet. Save one, confirm it, and only then move into app setup."
    : selectedReadyItem
      ? "Use the ready server in Step 2. Come back only if you need to fix or replace the saved connection details."
      : "Stay focused on one saved server until DeployMate can confirm that it is safe to use for the first rollout.";
  const queueTitle = noServers
    ? "Your saved servers will appear here"
    : selectedReadyItem
      ? "One server is already ready"
      : "Choose one saved server to confirm";
  const queueDescription = noServers
    ? "After you save the first target above, come here to run the first check."
    : selectedReadyItem
      ? "You can review other servers here, but the clearest next step is already app setup."
      : "Open one server, run the readiness check, and move on as soon as it looks safe.";
  const emptyQueueText = noServers
    ? "No server saved yet. Start with the form above, save one server, then come back here for the first check."
    : "No saved servers match the current filters.";
  const createServerCard = (
    <article
      className={`card formCard workspaceGuidePanel serverReviewCreateCard serverReviewReveal ${noServers ? "" : "isSecondary"}`.trim()}
      data-testid="server-review-create-card"
    >
      <div className="serverReviewCreateLayout">
        <div
          id="server-review-create-server-section"
          className={`workspaceGlancePanel serverReviewCreatePanel ${noServers ? "" : "isSecondary"}`.trim()}
        >
          <div className="workspaceGlanceHeader">
            <span className="eyebrow">{createSectionEyebrow}</span>
            <strong>{createSectionTitle}</strong>
          </div>
          <p className="formHint serverReviewSubtleCopy">
            {createSectionCopy}
          </p>
          <form className="form" onSubmit={handleCreateServer} data-testid="server-review-create-server">
            <label className="field">
              <span>Name</span>
              <input
                name="name"
                value={serverForm.name}
                onChange={updateServerFormField}
                placeholder="prod-vps"
                disabled={serverSubmitting}
                required
                data-testid="server-review-create-name"
              />
              <span className="fieldHint">
                Pick a label you will recognize later, like `production-vps` or `main-server`.
              </span>
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
                data-testid="server-review-create-host"
              />
              <span className="fieldHint">
                Use the IP address or hostname DeployMate should dial over SSH.
              </span>
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
                data-testid="server-review-create-port"
              />
              <span className="fieldHint">
                Leave this at `22` unless your server uses a different SSH port.
              </span>
            </label>
            <label className="field">
              <span>Username</span>
              <input
                name="username"
                value={serverForm.username}
                onChange={updateServerFormField}
                placeholder="deploy"
                disabled={serverSubmitting}
                required
                data-testid="server-review-create-username"
              />
              <span className="fieldHint">
                This is the SSH user DeployMate should sign in as on that machine.
              </span>
            </label>
            <label className="field">
              <span>SSH key</span>
              <textarea
                name="ssh_key"
                rows={6}
                value={serverForm.ssh_key}
                onChange={updateServerFormField}
                placeholder="Paste your SSH private key content here"
                disabled={serverSubmitting}
                required
                data-testid="server-review-create-ssh-key"
              />
              <span className="fieldHint">
                Paste the private SSH key DeployMate should use for this server.
              </span>
            </label>
            <div className="formActions">
              <button
                type="submit"
                className={noServers ? "landingButton primaryButton" : "secondaryButton serverReviewCreateSecondaryAction"}
                disabled={serverSubmitting}
                data-testid="server-review-create-submit"
              >
                {serverSubmitting ? "Saving..." : createSubmitLabel}
              </button>
            </div>
          </form>
        </div>

        <aside className="serverReviewSoftPanel serverReviewNextPanel">
          <span className="serverReviewPanelLabel">{nextPanelLabel}</span>
          <h2>{nextPanelTitle}</h2>
          <p className="formHint">{nextPanelCopy}</p>
          <div className="serverReviewMiniSteps">
            <div className="serverReviewMiniStep">
              <strong>1. Save one server target</strong>
              <p>Add one SSH machine DeployMate can reach.</p>
            </div>
            <div className="serverReviewMiniStep">
              <strong>2. Run one check</strong>
              <p>Use sign-in check or the full readiness check.</p>
            </div>
            <div className="serverReviewMiniStep">
              <strong>3. Go to Step 2</strong>
              <p>Only then choose what app to run on that server.</p>
            </div>
          </div>
        </aside>
      </div>
    </article>
  );

  function focusCreateServer() {
    const createSection = document.getElementById("server-review-create-server-section");
    createSection?.scrollIntoView({ behavior: "smooth", block: "start" });

    window.setTimeout(() => {
      const nameInput = document.querySelector('[data-testid="server-review-create-name"]');
      if (nameInput instanceof HTMLElement) {
        nameInput.focus();
      }
    }, 180);
  }

  function focusServerQueue(itemId = "") {
    const nextItemId = itemId || selectedNeedsReviewItem?.id || selectedReadyItem?.id || "";
    if (nextItemId) {
      setSelectedItemId(nextItemId);
    }

    window.setTimeout(() => {
      const taskPanel = nextItemId
        ? document.querySelector(`[data-testid="server-review-tasks-${nextItemId}"]`)
        : null;
      if (taskPanel instanceof HTMLElement) {
        taskPanel.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      const queueRoot = document.getElementById("server-review-live-queue");
      queueRoot?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }

  function handleHeroPrimaryAction() {
    if (heroSpotlight.actionKind === "create") {
      focusCreateServer();
      return;
    }

    if (heroSpotlight.actionKind === "continue" && heroSpotlight.actionHref) {
      router.push(heroSpotlight.actionHref);
      return;
    }

    focusServerQueue();
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

  useEffect(() => {
    if (!selectedItem) {
      setEditForm({
        name: "",
        host: "",
        port: "22",
        username: "",
        ssh_key: "",
      });
      return;
    }

    setEditForm({
      name: selectedItem.server.name || "",
      host: selectedItem.server.host || "",
      port: String(selectedItem.server.port || 22),
      username: selectedItem.server.username || "",
      ssh_key: "",
    });
  }, [selectedItemId, selectedItem]);

  async function loadServers(silent = false, user = currentUser) {
    if (!user?.is_admin) {
      setServers([]);
      setLoading(false);
      return;
    }

    if (!silent) {
      setLoading(true);
      setError("");
    }

    try {
      const data = await fetchServerReviewStarterList();
      const nextServers = Array.isArray(data) ? data : [];
      setServers(nextServers);

      if (nextServers[0] && !selectedItemId) {
        setSelectedItemId(nextServers[0].id);
      }
      setSuccess(
        nextServers.length === 0
          ? "Start here: save one server target, then run one check."
          : `Loaded ${nextServers.length} live server target${nextServers.length === 1 ? "" : "s"}.`,
      );
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }
      setError(requestError instanceof Error ? requestError.message : "Failed to load server review data.");
      if (!silent) {
        setServers([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  async function enrichServerRuntime(serverId, actionKind) {
    const [actionResult, portsResult] = await Promise.all([
      runServerReviewStarterAction(serverId, {
        action: actionKind,
        note: actionNote.trim(),
      }),
      fetchServerReviewSuggestedPorts(serverId).catch(() => ({ ports: [] })),
    ]);

    const suggestedPorts = Array.isArray(portsResult?.ports) ? portsResult.ports : [];
    setServerSuggestedPorts((current) => ({
      ...current,
      [serverId]: suggestedPorts,
    }));

    if (actionKind === "primary" && actionResult?.server_id) {
      setServerDiagnostics((current) => ({
        ...current,
        [serverId]: actionResult,
      }));
      return {
        successMessage: `Diagnostics loaded for ${actionResult.target}.`,
      };
    }

    setServerTestResults((current) => ({
      ...current,
      [serverId]: actionResult,
    }));
    return {
      successMessage: `Connection test finished: ${actionResult.message}`,
    };
  }

  function updateServerFormField(event) {
    const { name, value } = event.target;
    setServerForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function updateEditFormField(event) {
    const { name, value } = event.target;
    setEditForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function handleSelectItem(itemId) {
    setSelectedItemId(itemId);
    setActionNote("");
    setSuccess("Opened this server. Follow the next task below.");
    setError("");
  }

  async function handleCreateServer(event) {
    event.preventDefault();
    setServerSubmitting(true);
    setError("");

    try {
      const createdServer = await createServerReviewServer({
        name: serverForm.name,
        host: serverForm.host,
        port: Number(serverForm.port || 22),
        username: serverForm.username,
        auth_type: "ssh_key",
        ssh_key: serverForm.ssh_key,
      });
      setServerForm({
        name: "",
        host: "",
        port: "22",
        username: "",
        ssh_key: "",
      });
      await loadServers(true);
      setSelectedItemId(createdServer.id);
      setSuccess(`Server target "${createdServer.name}" created. Open it and run one check.`);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }
      setError(requestError instanceof Error ? requestError.message : "Failed to create server.");
      setSuccess("");
    } finally {
      setServerSubmitting(false);
    }
  }

  async function handleDeleteServer(serverId) {
    const server = servers.find((item) => item.id === serverId);
    const confirmed = window.confirm(
      `Delete server "${server?.name || serverId}"? This is blocked if deployments still use it.`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingServerId(serverId);
    setError("");
    try {
      await deleteServerReviewServer(serverId);
      setServers((currentServers) => currentServers.filter((item) => item.id !== serverId));
      setServerTestResults((current) => {
        const next = { ...current };
        delete next[serverId];
        return next;
      });
      setServerDiagnostics((current) => {
        const next = { ...current };
        delete next[serverId];
        return next;
      });
      setServerSuggestedPorts((current) => {
        const next = { ...current };
        delete next[serverId];
        return next;
      });
      setSelectedItemId((currentId) => (currentId === serverId ? "" : currentId));
      setSuccess(`Server target "${server?.name || serverId}" deleted.`);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }
      setError(requestError instanceof Error ? requestError.message : "Failed to delete server.");
      setSuccess("");
    } finally {
      setDeletingServerId("");
    }
  }

  async function handleUpdateServer(event) {
    event.preventDefault();
    if (!selectedItem) {
      setError("Choose a server before saving edits.");
      setSuccess("");
      return;
    }

    setServerUpdating(true);
    setError("");
    try {
      const updatedServer = await updateServerReviewServer(selectedItem.id, {
        name: editForm.name,
        host: editForm.host,
        port: Number(editForm.port || 22),
        username: editForm.username,
        auth_type: "ssh_key",
        ssh_key: editForm.ssh_key,
      });
      setServers((currentServers) =>
        currentServers.map((server) => (server.id === selectedItem.id ? updatedServer : server)),
      );
      setSuccess(
        `Server target "${updatedServer.name}" updated. Run a fresh check if the connection details changed.`,
      );
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }
      setError(requestError instanceof Error ? requestError.message : "Failed to update server.");
      setSuccess("");
    } finally {
      setServerUpdating(false);
    }
  }

  async function handleRunStarterAction(actionKind, itemId = selectedItem?.id || "") {
    if (!itemId) {
      setError("Choose a server before running the review action.");
      setSuccess("");
      return;
    }

    setActionLoadingId(itemId);
    setError("");
    try {
      const { successMessage } = await enrichServerRuntime(itemId, actionKind);
      setSelectedItemId(itemId);
      setActionNote("");
      setSuccess(successMessage);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }
      setError(
        requestError instanceof Error ? requestError.message : "Failed to run server review action.",
      );
      setSuccess("");
    } finally {
      setActionLoadingId("");
    }
  }

  useEffect(() => {
    if (smokeMode) {
      return;
    }

    async function checkAuthAndLoad() {
      try {
        const user = await fetchCurrentUser();
        setAuthChecked(true);
        setAuthFallbackVisible(false);
        if (user?.is_admin) {
          await loadServers(false, user);
        }
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
    function handlePointerDown(event) {
      const helpRoot = event.target instanceof Element ? event.target.closest(".inlineHelp") : null;
      if (!helpRoot) {
        setOpenHelpId("");
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpenHelpId("");
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!authChecked) {
    return (
      <main className="page">
        <div className="container">
          {authFallbackVisible ? (
            <div className="card formCard">
              <h1>Checking authentication</h1>
              <div className="banner subtle">
                This page usually redirects into the authenticated workspace automatically. If that
                bootstrap flow stalls, use the direct entry points below.
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

  if (!canAccessServers) {
    return (
      <main className="workspaceShell serverReviewPage">
        <article className="card formCard workspaceGuidePanel" data-testid="server-review-blocked-card">
          <div className="workspaceGlanceHeader">
            <span className="eyebrow">Server setup stays with admins</span>
            <strong data-testid="server-review-blocked-title">Ask an admin to finish Step 1</strong>
          </div>
          <p className="serverReviewLead">{blockedLead}</p>
          <p className="formHint">{blockedSupport}</p>
          <div className="banner subtle" data-testid="server-review-blocked-banner">
            {localDeploymentsEnabled
              ? "The real next step for you is Deployment Workflow, not saved server management."
              : "The real next step is waiting for one admin-managed target, then returning to Deployment Workflow."}
          </div>
          <div className="serverReviewMiniSteps">
            <div className="serverReviewMiniStep">
              <strong>1. Ask an admin</strong>
              <p>One saved server target has to be confirmed before this path opens for remote rollout.</p>
            </div>
            <div className="serverReviewMiniStep">
              <strong>{localDeploymentsEnabled ? "2. Return to Step 2" : "2. Wait for the target"}</strong>
              <p>
                {localDeploymentsEnabled
                  ? "Once the target is ready, use Deployment Workflow to choose what app should run."
                  : "Do not jump ahead to rollout setup before one admin-managed target is actually confirmed."}
              </p>
            </div>
            <div className="serverReviewMiniStep">
              <strong>3. Keep the next click obvious</strong>
              <p>Do not stay on a blocked page when the real next move lives somewhere else.</p>
            </div>
          </div>
          <div className="formActions">
            <Link
              href="/app"
              className={localDeploymentsEnabled ? "linkButton" : "landingButton primaryButton"}
              data-testid="server-review-blocked-overview-link"
            >
              Back to overview
            </Link>
            {localDeploymentsEnabled ? (
              <Link
                href="/app/deployment-workflow"
                className="landingButton primaryButton"
                data-testid="server-review-blocked-workflow-link"
              >
                Open deployment workflow
              </Link>
            ) : null}
          </div>
        </article>
      </main>
    );
  }

  return (
    <main className="workspaceShell serverReviewPage">
      <article className="card formCard serverReviewHero serverReviewReveal">
        <div className="serverReviewHeroLayout">
          <div className="serverReviewHeroCopy">
            <div className="eyebrow">Step 1</div>
            <h1 data-testid="server-review-page-title">Step 1: Connect and verify one server</h1>
            <p className="serverReviewLead">
              This page has one job: save one machine, run one check, and only then move to Step 2.
            </p>
            <p className="formHint serverReviewSubtleCopy">
              Keep this step simple. Do not branch into rollout settings, templates, or runtime review yet.
            </p>
            <div className="serverReviewStepStrip" aria-label="Server review path">
              {stepCards.map((step) => (
                <article
                  key={step.id}
                  className={`serverReviewStepCard is${step.state[0].toUpperCase()}${step.state.slice(1)}`}
                >
                  <span>{step.label}</span>
                  <strong>{step.title}</strong>
                  <p>{step.detail}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="serverReviewHeroRail">
            <div className="buttonRow serverReviewHeroActions">
              <Link href="/app" className="linkButton">
                Back
              </Link>
              <button
                type="button"
                className="secondaryButton"
                data-testid="server-review-refresh"
                onClick={() => loadServers()}
                disabled={loading}
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            <div className="serverReviewHeroPanel">
              <span className="serverReviewPanelLabel">{heroSpotlight.badge}</span>
              <strong>{heroSpotlight.title}</strong>
              <p>{heroSpotlight.detail}</p>
              <p className="serverReviewHeroSpotlightNote">{heroSpotlight.support}</p>
              <button
                type="button"
                className="landingButton primaryButton serverReviewHeroPrimaryAction"
                onClick={handleHeroPrimaryAction}
              >
                {heroSpotlight.actionLabel}
              </button>
              <div className="serverReviewHeroStats" aria-label="Server review summary">
                <div className="serverReviewHeroStat">
                  <span>Saved</span>
                  <strong>{items.length}</strong>
                </div>
                <div className="serverReviewHeroStat">
                  <span>Ready</span>
                  <strong>{readyCount}</strong>
                </div>
                <div className="serverReviewHeroStat">
                  <span>Need review</span>
                  <strong>{reviewCount}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>

      <AdminFeedbackBanners
        smokeMode={starterRuntimeMode !== "api"}
        error={error}
        success={success}
        errorTestId="server-review-error"
        successTestId="server-review-success"
      />

      {noServers ? createServerCard : null}

      <div id="server-review-live-queue" className="serverReviewQueueStack" data-testid="server-review-live-queue">
        <article className="card formCard serverReviewToolbarCard serverReviewReveal">
          <div className="serverReviewToolbarHeader">
            <div>
              <span className="serverReviewPanelLabel">Saved servers</span>
              <h2>{queueTitle}</h2>
            </div>
            <p className="formHint">{queueDescription}</p>
          </div>
          <label className="field serverReviewFilterField">
            <span>Show</span>
            <select
              data-testid="server-review-segment-filter"
              value={segmentFilter}
              onChange={(event) => setSegmentFilter(event.target.value)}
            >
              {segmentFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </article>

        <AdminSurfaceQueue
          className="serverReviewQueueShell serverReviewReveal"
          title="Your servers"
          description={queueDescription}
          searchLabel="Search saved servers"
          searchValue={query}
          onSearchChange={(event) => setQuery(event.target.value)}
          searchPlaceholder={starterStrings.searchPlaceholder}
          searchTestId="server-review-search"
          emptyTestId="server-review-empty"
          emptyText={emptyQueueText}
          items={filteredItems}
        >
          {filteredItems.map((item) => (
            <AdminSurfaceQueueCard
              className={`serverReviewServerCard serverReviewReveal ${item.id === selectedItemId ? "isSelected" : ""}`.trim()}
              key={item.id}
              title={item.label}
              body={item.note}
              status={item.id === selectedItemId ? `${item.status} · open` : item.status}
            >
              {item.segment === "ready" ? (
                <div className="banner success">
                  Step 1 is complete for this server. Next: go to Step 2 and choose what to run.
                </div>
              ) : null}

              <div className="serverReviewMetaStack">
                <p className="formHint">
                  <strong>{starterStrings.cardMetaLabel}:</strong> {item.meta}
                </p>
                <p className="formHint">
                  <strong>{starterStrings.segmentFilterLabel}:</strong> {item.segment}
                </p>
              </div>

              {item.id === selectedItemId ? (
                <>
                  <section className="serverReviewTaskPanel" data-testid={`server-review-tasks-${item.id}`}>
                    <div className="serverReviewTaskHeader">
                      <span className="serverReviewPanelLabel">Tasks for this server</span>
                      <strong>
                        {item.segment === "ready"
                          ? "This server is ready. Use it for Step 2."
                          : "Finish the check here, then move on."}
                      </strong>
                      <p>
                        {item.segment === "ready"
                          ? "You can still rerun a check if something changed, but the main path is choosing what to run next."
                          : "Stay on this server, run the readiness check, and only then continue to the app step."}
                      </p>
                    </div>

                    <div className="workspaceReviewerGrid serverReviewTaskGrid">
                      <article className="workspaceReviewerCard serverReviewTaskCard">
                        <span>Do this now</span>
                        <strong>Check whether this server is ready</strong>
                        <p>
                          {item.diagnostics
                            ? "Run the readiness check again if you changed the server details or want a fresh answer."
                            : "This is the main action on this screen. It checks that the server is reachable and looks safe for Step 2."}
                        </p>
                        <button
                          type="button"
                          className="landingButton primaryButton"
                          data-testid={`${item.id}-primary-action`}
                          onClick={() => handleRunStarterAction("primary", item.id)}
                          disabled={actionLoadingId === item.id}
                        >
                          {actionLoadingId === item.id ? "Checking..." : "Check server readiness"}
                        </button>
                      </article>

                      <article className="workspaceReviewerCard serverReviewTaskCard">
                        <span>If you only need a quick test</span>
                        <strong>Only test sign-in</strong>
                        <p>
                          Use this shorter check when you only want to confirm that DeployMate can log in before a fuller review.
                        </p>
                        <button
                          type="button"
                          className="secondaryButton"
                          data-testid={`${item.id}-secondary-action`}
                          onClick={() => handleRunStarterAction("secondary", item.id)}
                          disabled={actionLoadingId === item.id}
                        >
                          {actionLoadingId === item.id ? "Checking..." : "Only test sign-in"}
                        </button>
                      </article>

                      <article className="workspaceReviewerCard serverReviewTaskCard">
                        <span>Then do this</span>
                        <strong>
                          {item.segment === "ready"
                            ? "Choose what to run on this server"
                            : "Move to Step 2 after this server looks ready"}
                        </strong>
                        <p>
                          {item.segment === "ready"
                            ? "Step 1 is done for this machine. Keep the momentum and pick one app or one saved setup next."
                            : "Once the readiness result looks good, use the same server in Step 2 and keep the rollout path simple."}
                        </p>
                        {item.segment === "ready" ? (
                          <Link
                            href={`/app/deployment-workflow?server=${item.id}&source=server-review`}
                            className="landingButton primaryButton"
                          >
                            Go to Step 2
                          </Link>
                        ) : (
                          <div className="banner subtle inlineBanner">
                            Waiting for a ready result before Step 2 becomes the main path.
                          </div>
                        )}
                      </article>
                    </div>

                    <div className="workspaceGlancePanel serverReviewTaskNotePanel">
                      <div className="workspaceGlanceHeader">
                        <span className="eyebrow">Optional</span>
                        <strong>Add a note before the next check</strong>
                      </div>
                      <p className="formHint">
                        This is only for context you want to keep in mind while you run the next check.
                      </p>
                      <label className="field">
                        <span>Note for the next check</span>
                        <textarea
                          rows={3}
                          value={actionNote}
                          onChange={(event) => setActionNote(event.target.value)}
                          placeholder={starterStrings.actionNotePlaceholder}
                        />
                      </label>
                    </div>
                  </section>

                  <details className="serverReviewSecondaryDetails">
                    <summary className="serverReviewSecondarySummary">
                      <div>
                        <strong>Need to fix this server or remove it?</strong>
                        <p>Open the advanced details only if the saved name, host, port, user, or SSH key is wrong.</p>
                      </div>
                    </summary>
                    <div className="serverReviewSecondaryBody">
                      <form className="form serverReviewEditForm" onSubmit={handleUpdateServer}>
                        <label className="field">
                          <span>Name</span>
                          <input
                            name="name"
                            value={editForm.name}
                            onChange={updateEditFormField}
                            disabled={serverUpdating}
                            required
                            data-testid="server-review-edit-name"
                          />
                        </label>
                        <label className="field">
                          <span>Host</span>
                          <input
                            name="host"
                            value={editForm.host}
                            onChange={updateEditFormField}
                            disabled={serverUpdating}
                            required
                            data-testid="server-review-edit-host"
                          />
                        </label>
                        <label className="field">
                          <span>Port</span>
                          <input
                            name="port"
                            type="number"
                            min="1"
                            max="65535"
                            value={editForm.port}
                            onChange={updateEditFormField}
                            disabled={serverUpdating}
                            required
                            data-testid="server-review-edit-port"
                          />
                        </label>
                        <label className="field">
                          <span>Username</span>
                          <input
                            name="username"
                            value={editForm.username}
                            onChange={updateEditFormField}
                            disabled={serverUpdating}
                            required
                            data-testid="server-review-edit-username"
                          />
                        </label>
                        <label className="field">
                          <span className="fieldLabelWithHelp">
                            <span>SSH key</span>
                            <InlineHelp
                              id={`ssh-key-${item.id}`}
                              testId={`${item.id}-ssh-key-help`}
                              label="What SSH key means"
                              text="Paste the private key DeployMate should use to connect to this server."
                              isOpen={openHelpId === `ssh-key-${item.id}`}
                              onToggle={(nextId) => setOpenHelpId((currentId) => (currentId === nextId ? "" : nextId))}
                            />
                          </span>
                          <textarea
                            name="ssh_key"
                            rows={6}
                            value={editForm.ssh_key}
                            onChange={updateEditFormField}
                            placeholder="Leave empty to keep the current key, or paste a replacement private key."
                            disabled={serverUpdating}
                            data-testid="server-review-edit-ssh-key"
                          />
                        </label>
                        <div className="formActions">
                          <button
                            type="submit"
                            className="landingButton primaryButton"
                            disabled={serverUpdating}
                            data-testid="server-review-edit-submit"
                          >
                            {serverUpdating ? "Saving..." : "Save changes"}
                          </button>
                        </div>
                      </form>

                      <div className="formActions">
                        <button
                          type="button"
                          className="dangerButton"
                          data-testid={`${item.id}-delete`}
                          onClick={() => handleDeleteServer(item.id)}
                          disabled={deletingServerId === item.id}
                        >
                          {deletingServerId === item.id ? "Deleting..." : "Delete server target"}
                        </button>
                      </div>
                    </div>
                  </details>
                </>
              ) : (
                <div className="formActions">
                  <button
                    type="button"
                    className="secondaryButton"
                    onClick={() => handleSelectItem(item.id)}
                  >
                    Open tasks
                  </button>
                </div>
              )}
            </AdminSurfaceQueueCard>
          ))}
        </AdminSurfaceQueue>
      </div>

      {!noServers ? createServerCard : null}
    </main>
  );
}

export default function ServerReviewPage() {
  return (
    <Suspense
      fallback={
        <main className="workspaceShell serverReviewPage">
          <div className="card formCard serverReviewHero">Loading...</div>
        </main>
      }
    >
      <ServerReviewPageContent />
    </Suspense>
  );
}
