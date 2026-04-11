"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminDisclosureSection } from "./admin-ui";
import {
  smokeDeployments,
  smokeMode,
  smokeOverviewDeployments,
  smokeOverviewNotifications,
  smokeOverviewOpsOverview,
  smokeOverviewServers,
  smokeOverviewTemplates,
  smokeServers,
  smokeUser,
} from "../lib/smoke-fixtures";
import {
  buildOverviewPrimaryPath,
  buildOpsSnapshot,
  buildOpsSummaryText,
  downloadJsonFile,
  formatDate,
  readErrorMessageFromResponse,
  readJsonOrError,
  triggerFileDownload,
} from "../lib/runtime-workspace-utils";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const localDeploymentsEnabled =
  process.env.NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED !== "0";
const smokeOverviewScenario =
  process.env.NEXT_PUBLIC_SMOKE_OVERVIEW_SCENARIO || "default";
const smokeMemberOverviewDeployments = smokeDeployments.map(
  ({ server_id: _serverId, server_name: _serverName, server_host: _serverHost, ...deployment }) => ({
    ...deployment,
    server_managed_by_admin: true,
  }),
);
const smokeHomeDeployments =
  smokeMode && smokeOverviewScenario === "member-live-review"
    ? smokeMemberOverviewDeployments
    : smokeOverviewDeployments;
const smokeHomeServers =
  smokeMode && smokeOverviewScenario === "admin-server-ready-first-deploy"
    ? smokeServers.slice(0, 1)
    : smokeOverviewServers;
const smokeHomeOpsOverview =
  smokeMode &&
  (smokeOverviewScenario === "member-live-review" ||
    smokeOverviewScenario === "admin-server-ready-first-deploy")
    ? null
    : smokeOverviewOpsOverview;

export default function HomePage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(smokeMode);
  const [authFallbackVisible, setAuthFallbackVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState(smokeMode ? smokeUser : null);
  const [deployments, setDeployments] = useState(smokeMode ? smokeHomeDeployments : []);
  const [servers, setServers] = useState(smokeMode ? smokeHomeServers : []);
  const [notifications, setNotifications] = useState(smokeMode ? smokeOverviewNotifications : []);
  const [templates, setTemplates] = useState(smokeMode ? smokeOverviewTemplates : []);
  const [loading, setLoading] = useState(!smokeMode);
  const [serversLoading, setServersLoading] = useState(!smokeMode);
  const [notificationsLoading, setNotificationsLoading] = useState(!smokeMode);
  const [templatesLoading, setTemplatesLoading] = useState(!smokeMode);
  const [opsOverviewLoading, setOpsOverviewLoading] = useState(!smokeMode);
  const [error, setError] = useState("");
  const [serversError, setServersError] = useState("");
  const [notificationsError, setNotificationsError] = useState("");
  const [templatesError, setTemplatesError] = useState("");
  const [opsOverview, setOpsOverview] = useState(smokeMode ? smokeHomeOpsOverview : null);
  const [opsActionMessage, setOpsActionMessage] = useState("");
  const [opsActionError, setOpsActionError] = useState("");

  const opsSnapshot =
    opsOverview ||
    buildOpsSnapshot({
      currentUser,
      deployments,
      servers,
      notifications,
      templates,
    });
  const canAccessServers = Boolean(currentUser?.is_admin);
  const memberRemoteOnly = !canAccessServers && !localDeploymentsEnabled;
  const memberHasLiveDeployments = memberRemoteOnly && opsSnapshot.deployments.total > 0;
  const degradedOpsAttentionItems = opsSnapshot.attention_items.filter((item) =>
    item.title.includes("temporarily unavailable"),
  );
  const overviewPrimaryPath = buildOverviewPrimaryPath({
    isAdmin: canAccessServers,
    localDeploymentsEnabled,
    deploymentsTotal: opsSnapshot.deployments.total,
    failedDeployments: opsSnapshot.deployments.failed,
    serversTotal: opsSnapshot.servers.total,
  });
  const singleServerFirstDeployTarget =
    canAccessServers &&
    !localDeploymentsEnabled &&
    opsSnapshot.deployments.total === 0 &&
    servers.length === 1
      ? servers[0]
      : null;
  const firstDeployWorkflowHref = singleServerFirstDeployTarget
    ? `/app/deployment-workflow?${new URLSearchParams({
        server: singleServerFirstDeployTarget.id,
        source: "overview-first-deploy",
      }).toString()}`
    : "/app/deployment-workflow";
  const overviewPrimaryHref =
    overviewPrimaryPath.reason === "first-deploy" && singleServerFirstDeployTarget
      ? firstDeployWorkflowHref
      : overviewPrimaryPath.href;
  const memberServerCopy = canAccessServers
    ? null
    : localDeploymentsEnabled
      ? {
          headline: "Server inventory stays with admins",
          support:
            "Members can keep working in the deployment workflow without touching saved server targets.",
          stepTitle: "Continue in the deployment workflow",
          stepDetail:
            "Use the rollout workspace for local deployments and template reuse while admins handle the saved server list.",
          stepAction: "Open deployment workflow",
        }
      : {
          headline: memberHasLiveDeployments
            ? "Server target stays admin-managed"
            : "Server target is managed by an admin",
          support: memberHasLiveDeployments
            ? "Review the deployments that already exist. Ask an admin before a new remote rollout or target change."
            : "Members do not manage saved server targets here. Ask an admin to confirm the remote target, then return to Deployment Workflow.",
          stepTitle: memberHasLiveDeployments ? "Server target stays with admins" : "Wait for the server target",
          stepDetail: memberHasLiveDeployments
            ? "You can review existing deployments, but target control and new remote deploys stay admin-managed."
            : "Deployment creation stays blocked until an admin confirms the saved server target for this workspace.",
          stepAction: memberHasLiveDeployments ? "Open live review" : "Review rollout status",
        };
  const beginnerStatusSummary = canAccessServers
    ? servers.length === 0
      ? "No server connected yet. Start with Step 1."
      : deployments.length === 0
        ? `${servers.length} server target${servers.length === 1 ? "" : "s"} connected. No deployments yet.`
        : `${opsSnapshot.deployments.running} running · ${opsSnapshot.deployments.failed} failed · ${servers.length} server target${servers.length === 1 ? "" : "s"} saved.`
    : localDeploymentsEnabled
      ? "Server inventory is admin-managed. Use the deployment workflow to continue."
      : memberHasLiveDeployments
        ? `${opsSnapshot.deployments.total} deployment${opsSnapshot.deployments.total === 1 ? "" : "s"} available for live review. Server target stays admin-managed.`
      : "Server target is admin-managed. Return to the deployment workflow once it is confirmed.";
  const beginnerNextStep = overviewPrimaryPath.reason === "server-setup"
    ? "Next best step: connect and verify one server."
    : overviewPrimaryPath.reason === "incident"
      ? "Next best step: open live deployments and review the problem first."
      : overviewPrimaryPath.reason === "admin-target-needed"
        ? "Next best step: ask an admin to confirm one server target, then return to the workflow."
      : memberServerCopy
        ? memberServerCopy.support
        : deployments.length === 0
          ? "Next best step: choose which app to run on that server."
          : "Next best step: open your app list and continue from one running service.";
  const waitingForAdminTarget = overviewPrimaryPath.reason === "admin-target-needed";
  const waitingForServerSetup = overviewPrimaryPath.reason === "server-setup";
  const memberNewDeploymentBlocked = memberHasLiveDeployments;
  const stepTwoBlocked =
    waitingForServerSetup || waitingForAdminTarget || memberNewDeploymentBlocked;
  const stepThreeBlocked =
    waitingForServerSetup || waitingForAdminTarget || opsSnapshot.deployments.total === 0;
  const stepThreeIsPrimary = memberHasLiveDeployments && !stepThreeBlocked;
  const stepOneIsPrimary =
    overviewPrimaryPath.reason === "server-setup" ||
    overviewPrimaryPath.reason === "admin-target-needed";
  const heroHeadline = canAccessServers
    ? servers.length === 0
      ? "DeployMate helps you run one app on one server in three simple steps."
      : deployments.length === 0
        ? "Step 1 is done. Now choose one app to run on that server."
        : "Your app is already running. Check health first, then make the next change."
    : localDeploymentsEnabled
      ? "DeployMate still gives you a simple path even when admins manage saved servers."
      : memberHasLiveDeployments
        ? "You can review existing deployments while admins manage the server target."
      : "Your deployment target is admin-managed. Confirm it with an admin, then continue.";
  const heroSupportText = canAccessServers
    ? servers.length === 0
      ? "In plain language: tell DeployMate which machine to use, choose the app image to start, and then check whether the app stays healthy."
      : deployments.length === 0
        ? "You already connected the machine. Stay on the main path now: choose one app image or one saved setup and start it."
        : "Stay on the main path: open the app workspace, review what is healthy, and only then decide what to change next."
    : localDeploymentsEnabled
      ? "Members can still choose what to run and review health while admins keep the saved server list up to date."
      : memberHasLiveDeployments
        ? "Use Deployment Workflow to inspect live apps. Ask an admin before a new remote rollout or target change."
      : "Members do not manage saved server targets here. Ask an admin to confirm the target, then return to the workflow.";
  const explanationTitle = canAccessServers
    ? servers.length === 0
      ? "What DeployMate means in plain language"
      : "What this app is helping you do"
    : localDeploymentsEnabled
      ? "What changes when admins manage saved servers"
      : memberHasLiveDeployments
        ? "What you can review without server access"
      : "What happens after an admin confirms the target";
  const explanationBody = canAccessServers
    ? servers.length === 0
      ? "You do not need to learn the whole workspace first. Just understand the three-step path and take the next step."
      : deployments.length === 0
        ? "This workspace is already past the server step. The next decision is simply what app to run first."
        : "You already have a running runtime story. Open the workflow to review status and keep the next action deliberate."
    : localDeploymentsEnabled
      ? "Admins keep the saved server list, but you can still understand the path: choose what to run, start it, and check health."
      : memberHasLiveDeployments
        ? "Server inventory stays controlled, but the live runtime review path is open for deployments that already exist."
      : "Once an admin confirms the saved server target, use Deployment Workflow to create or review the rollout.";
  const beginnerSteps = [
    {
      key: "step-1",
      step: "Step 1",
      title: canAccessServers ? "Connect a server" : memberServerCopy?.stepTitle || "Continue in deployment workflow",
      detail: canAccessServers
        ? "Add one machine and make sure DeployMate can sign in to it over SSH."
        : memberServerCopy?.stepDetail || "Use the deployment workflow for the next rollout step.",
      href: canAccessServers ? "/app/server-review" : "/app/deployment-workflow",
      actionLabel: canAccessServers ? "Open server setup" : memberServerCopy?.stepAction || "Open deployment workflow",
      primary: stepOneIsPrimary,
      disabled: false,
    },
    {
      key: "step-2",
      step: "Step 2",
      title: "Choose your app",
      detail: stepTwoBlocked
        ? waitingForAdminTarget
          ? "This step opens after an admin confirms one saved server target for the workspace."
          : memberNewDeploymentBlocked
            ? "New remote deployments need an admin-managed target. Review the live apps that already exist instead."
            : "This step opens after Step 1 is done and one server is already connected."
        : "Paste the app image you want to run, or pick a saved setup if you already have one.",
      href: singleServerFirstDeployTarget ? firstDeployWorkflowHref : "/app/deployment-workflow",
      actionLabel: stepTwoBlocked
        ? memberNewDeploymentBlocked
          ? "Ask admin for new deploy"
          : "Opens after Step 1"
        : "Choose app to run",
      primary: !stepOneIsPrimary && !stepThreeIsPrimary,
      disabled: stepTwoBlocked,
    },
    {
      key: "step-3",
      step: "Step 3",
      title: memberHasLiveDeployments ? "Review live apps" : "Start it and check status",
      detail: stepThreeBlocked
        ? "This step opens after the first deployment exists and DeployMate has live runtime state to review."
        : memberHasLiveDeployments
          ? "Open live status and runtime detail without exposing saved server inventory or target controls."
        : "Start the app, then open live status to confirm it is running, healthy, and reachable.",
      href: "/app/deployment-workflow",
      actionLabel: stepThreeBlocked
        ? "Opens after deploy"
        : memberHasLiveDeployments
          ? "Review live apps"
          : "See running apps",
      primary: stepThreeIsPrimary,
      disabled: stepThreeBlocked,
    },
  ];
  const productQuickActions = beginnerSteps.map((card) => {
    const quickLabelByStep = {
      "step-1": "Connect server",
      "step-2": "Deploy app",
      "step-3": "Review health",
    };
    const disabledLabelByStep = {
      "step-1": "Needs admin",
      "step-2": memberNewDeploymentBlocked ? "Needs admin" : "After server",
      "step-3": "After deploy",
    };

    return {
      ...card,
      quickLabel: quickLabelByStep[card.key],
      quickState: card.primary ? "Current" : card.disabled ? disabledLabelByStep[card.key] : "Open",
    };
  });
  const plainLanguageCards = [
    {
      title: "What “server” means here",
      detail: canAccessServers
        ? "It is simply the machine where your app will run. Step 1 only tells DeployMate how to reach that machine."
        : localDeploymentsEnabled
          ? "Admins keep the saved server list, but your rollout path still starts by choosing what to run."
          : memberHasLiveDeployments
            ? "The server target stays admin-managed. Your current job is reviewing existing live apps without changing target controls."
          : "The remote machine is confirmed by an admin first, then you continue in the rollout workflow.",
    },
    {
      title: "What “choose your app” means",
      detail: memberNewDeploymentBlocked
        ? "For a new remote deployment, ask an admin to confirm the target and rollout change. Existing deployments stay available for review."
        : "Usually this is a container image like `nginx:latest`, or one saved template that already remembers the image, ports, and env vars.",
    },
    {
      title: "What “healthy” means",
      detail:
        "After the app starts, DeployMate shows whether it is running and whether the health checks and runtime details look good enough to keep going.",
    },
  ];
  const workspaceSignalsBadge = `${opsSnapshot.attention_items.length} attention item${
    opsSnapshot.attention_items.length === 1 ? "" : "s"
  }`;
  const productSignalCards = [
    {
      label: "Server",
      value: canAccessServers
        ? servers.length === 0
          ? "Not connected"
          : "Ready"
        : "Admin-managed",
      detail: canAccessServers
        ? servers.length === 0
          ? "Step 1 is the only setup that matters right now."
          : `${servers.length} target${servers.length === 1 ? "" : "s"} saved.`
        : "Server details stay with admins.",
    },
    {
      label: "Apps",
      value: opsSnapshot.deployments.total === 0 ? "None yet" : `${opsSnapshot.deployments.total}`,
      detail:
        opsSnapshot.deployments.total === 0
          ? "Create the first deployment before runtime review opens."
          : `${opsSnapshot.deployments.running} running, ${opsSnapshot.deployments.failed} failed.`,
    },
    {
      label: "Next action",
      value: overviewPrimaryPath.label,
      detail: overviewPrimaryPath.title,
    },
  ];

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
      const response = await fetch(`${apiBaseUrl}/deployments`, {
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

  async function loadNotifications(silent = false) {
    if (!silent) {
      setNotificationsLoading(true);
      setNotificationsError("");
    }

    try {
      const response = await fetch(`${apiBaseUrl}/notifications?limit=100`, {
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
      const response = await fetch(`${apiBaseUrl}/deployment-templates`, {
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

    const user = await fetchCurrentUser();
    await Promise.all([
      loadDeployments(silent),
      loadServers(user, silent),
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
        await refreshPage();
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
      refreshPage(true);
    }, 8000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [authChecked]);

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
    <main className="page workspaceProductPage">
      <div className="container workspaceProductContainer">
        <section className="overviewProductHero" data-testid="workspace-product-hero">
          <div className="overviewProductHeroCopy">
            <span className="overviewProductEyebrow">DeployMate</span>
            <h1 data-testid="runtime-page-title">Deploy Docker apps on your own server.</h1>
            <p className="overviewProductLead">{heroHeadline}</p>
            <p className="overviewProductSupport">{heroSupportText}</p>
            <div
              className="overviewProductQuickRail"
              data-testid="workspace-quick-actions"
              aria-label="How to use DeployMate"
            >
              {productQuickActions.map((card) => {
                const quickActionClassName = `overviewProductQuickAction ${
                  card.primary ? "isPrimary" : card.disabled ? "isLocked" : "isReady"
                }`;
                const quickActionContent = (
                  <>
                    <span className="overviewProductQuickIndex">{card.step.replace("Step ", "")}</span>
                    <span className="overviewProductQuickText">
                      <strong>{card.quickLabel}</strong>
                      <span>{card.quickState}</span>
                    </span>
                  </>
                );

                return card.disabled ? (
                  <button
                    key={card.key}
                    type="button"
                    disabled
                    className={quickActionClassName}
                    data-testid={`workspace-quick-action-${card.key}`}
                  >
                    {quickActionContent}
                  </button>
                ) : (
                  <Link
                    key={card.key}
                    href={card.href}
                    className={quickActionClassName}
                    data-testid={`workspace-quick-action-${card.key}`}
                  >
                    {quickActionContent}
                  </Link>
                );
              })}
            </div>
            <div className="overviewProductActions">
              <Link
                href={overviewPrimaryHref}
                className="landingButton primaryButton overviewProductPrimaryButton"
                data-testid="workspace-hero-primary-action"
              >
                {overviewPrimaryPath.label}
              </Link>
              <button type="button" onClick={handleLogout} className="overviewProductTextButton">
                Logout
              </button>
            </div>
          </div>

          <aside className="overviewProductNextPanel" data-testid="workspace-primary-task-card">
            <span>Next</span>
            <strong>{overviewPrimaryPath.title}</strong>
            <p>{overviewPrimaryPath.detail}</p>
            <Link
              href={overviewPrimaryHref}
              className="landingButton primaryButton overviewProductPrimaryButton"
              data-testid="workspace-primary-task-action"
            >
              {overviewPrimaryPath.label}
            </Link>
          </aside>
        </section>

        <section className="overviewProductSignals" data-testid="workspace-product-signals">
          {productSignalCards.map((signal) => (
            <article key={signal.label} className="overviewProductSignal">
              <span>{signal.label}</span>
              <strong>{signal.value}</strong>
              <p>{signal.detail}</p>
            </article>
          ))}
        </section>

        <details className="overviewProductDetails overviewProductPathSection" data-testid="workspace-scenario-card">
          <summary className="overviewProductSectionHeader overviewProductSummary">
            <span>First pass</span>
            <h2 data-testid="workspace-scenario-title">One path, three steps</h2>
            <p>{beginnerNextStep}</p>
          </summary>
          <div className="overviewProductPath" data-testid="workspace-scenario-grid">
            {beginnerSteps.map((card) => (
              <article
                key={card.key}
                className={`overviewProductStep ${card.primary ? "isPrimary" : card.disabled ? "isLocked" : "isReady"}`}
                data-testid={`workspace-scenario-item-${card.key}`}
              >
                <div className="overviewProductStepMeta">
                  <span className="overviewProductStepNumber">{card.step}</span>
                  <span className="overviewProductStepState">
                    {card.primary
                      ? "Current"
                      : card.disabled
                        ? card.key === "step-2" && waitingForAdminTarget
                          ? "Blocked until Step 1"
                          : card.actionLabel
                        : "Ready"}
                  </span>
                </div>
                <div className="overviewProductStepCopy">
                  <h3>{card.title}</h3>
                  <p>{card.detail}</p>
                </div>
                {card.disabled ? (
                  <button
                    type="button"
                    disabled
                    className={card.primary ? "landingButton primaryButton" : "landingButton secondaryButton"}
                    data-testid={`workspace-scenario-action-${card.key}`}
                  >
                    {card.actionLabel}
                  </button>
                ) : (
                  <Link
                    href={card.href}
                    className={card.primary ? "landingButton primaryButton" : "landingButton secondaryButton"}
                    data-testid={`workspace-scenario-action-${card.key}`}
                  >
                    {card.actionLabel}
                  </Link>
                )}
              </article>
            ))}
          </div>
        </details>

        <details className="overviewProductDetails overviewProductExplainer">
          <summary className="overviewProductSectionHeader overviewProductSummary">
            <span>Plain language</span>
            <h2>{explanationTitle}</h2>
            <p>{explanationBody}</p>
          </summary>
          <div className="overviewProductExplainerGrid">
            {plainLanguageCards.map((card) => (
              <article key={card.title} className="overviewProductExplainerCard">
                <span>{card.title}</span>
                <p>{card.detail}</p>
              </article>
            ))}
          </div>
        </details>

        <div className="workspaceBannerStack">
          {error ? <div className="banner error">{error}</div> : null}
          {serversError ? <div className="banner error">{serversError}</div> : null}
          {notificationsError ? <div className="banner error">{notificationsError}</div> : null}
          {templatesError ? <div className="banner error">{templatesError}</div> : null}
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
          {smokeMode ? (
            <div className="banner subtle" data-testid="runtime-smoke-banner">
              Smoke mode uses fixture data for overview and deployment entry surfaces.
            </div>
          ) : (
            <div className="banner subtle" data-testid="runtime-smoke-banner">
              Overview signals and reports refresh automatically every 8 seconds.
            </div>
          )}

        </div>

        {currentUser?.is_admin ? (
          <AdminDisclosureSection
            title="Advanced admin surfaces"
            subtitle="Keep these paths available without letting them interrupt the main rollout story on first pass."
            badge="Advanced"
            testId="overview-advanced-admin-disclosure"
          >
            <div className="workspaceReviewerGrid">
              <article className="workspaceReviewerCard">
                <span>Users</span>
                <strong>Manage team access later</strong>
                <p>
                  Open the users surface when access review, password recovery, exports, or restore planning is the real task.
                </p>
                <Link href="/app/users" className="landingButton secondaryButton">
                  Open users
                </Link>
              </article>
              <article className="workspaceReviewerCard">
                <span>Upgrade inbox</span>
                <strong>Handle commercial or queue review separately</strong>
                <p>
                  Keep upgrade triage and queue handling in its own workspace after the runtime story is already understood.
                </p>
                <Link href="/app/upgrade-requests" className="landingButton secondaryButton">
                  Open upgrade inbox
                </Link>
              </article>
            </div>
          </AdminDisclosureSection>
        ) : null}

        <AdminDisclosureSection
          title="Workspace signals and reports"
          subtitle={
            canAccessServers
              ? "Operational totals, attention items, and exportable summaries stay here when you want the broad picture without leaving the overview."
              : "Operational totals and attention items stay here while server inventory remains admin-managed."
          }
          badge={workspaceSignalsBadge}
          testId="ops-overview-disclosure"
        >
          <article className="card formCard" data-testid="ops-overview-card">
            <div className="sectionHeader" data-testid="ops-overview-header">
              <div>
                <h2 data-testid="ops-overview-title">Operations overview</h2>
                <p className="formHint">
                  High-signal summary, attention items, and export actions built from the current workspace state.
                </p>
              </div>
            </div>

            <AdminDisclosureSection
              title="Exports and reports"
              subtitle={
                canAccessServers
                  ? "Copy the current summary or export deployment, server, template, and activity data when you need a handoff or audit artifact."
                  : "Copy the current summary or export deployment, template, and activity data when you need a handoff or audit artifact."
              }
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
                {canAccessServers ? (
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
                ) : null}
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
              <div className="banner subtle" data-testid="ops-overview-loading-banner">
                Refreshing server-side operations overview...
              </div>
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
                <strong className="overviewValue">{canAccessServers ? opsSnapshot.servers.total : "Managed"}</strong>
                <div className="overviewMeta">
                  {canAccessServers ? (
                    <>
                      <span>Password auth {opsSnapshot.servers.password_auth}</span>
                      <span>SSH key auth {opsSnapshot.servers.ssh_key_auth}</span>
                      <span>Unused {opsSnapshot.servers.unused}</span>
                    </>
                  ) : (
                    <span>Server inventory stays with admins.</span>
                  )}
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
                  <span>Top {opsSnapshot.templates.top_template_name || "No popular template yet"}</span>
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
                    SSH trust {opsSnapshot.capabilities?.ssh_host_key_checking || "yes"}
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
                  <div
                    key={`${item.title}-${index}`}
                    className="overviewAttentionItem"
                    data-testid={`ops-attention-item-${index}`}
                  >
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
              <div className="banner subtle" data-testid="ops-attention-empty-banner">
                No immediate attention items from the current data.
              </div>
            )}
          </article>
        </AdminDisclosureSection>
      </div>
    </main>
  );
}
