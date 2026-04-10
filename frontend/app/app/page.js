"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminDisclosureSection } from "./admin-ui";
import {
  smokeMode,
  smokeOverviewDeployments,
  smokeOverviewNotifications,
  smokeOverviewOpsOverview,
  smokeOverviewServers,
  smokeOverviewTemplates,
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

export default function HomePage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(smokeMode);
  const [authFallbackVisible, setAuthFallbackVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState(smokeMode ? smokeUser : null);
  const [deployments, setDeployments] = useState(smokeMode ? smokeOverviewDeployments : []);
  const [servers, setServers] = useState(smokeMode ? smokeOverviewServers : []);
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
  const [opsOverview, setOpsOverview] = useState(smokeMode ? smokeOverviewOpsOverview : null);
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
  const primaryReason = overviewPrimaryPath.reason;
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
          headline: "Server target is managed by an admin",
          support:
            "Members do not manage saved server targets here. Ask an admin to confirm the remote target, then return to Deployment Workflow.",
          stepTitle: "Wait for the server target",
          stepDetail:
            "Deployment creation stays blocked until an admin confirms the saved server target for this workspace.",
          stepAction: "See what opens next",
        };
  const beginnerStatusSummary = canAccessServers
    ? servers.length === 0
      ? "No server connected yet. Start with Step 1."
      : deployments.length === 0
        ? `${servers.length} server target${servers.length === 1 ? "" : "s"} connected. No deployments yet.`
        : `${opsSnapshot.deployments.running} running · ${opsSnapshot.deployments.failed} failed · ${servers.length} server target${servers.length === 1 ? "" : "s"} saved.`
    : localDeploymentsEnabled
      ? "Server inventory is admin-managed. Use the deployment workflow to continue."
      : "Server target is admin-managed. Return to the deployment workflow once it is confirmed.";
  const beginnerNextStep = primaryReason === "server-setup"
    ? "Next best step: connect and verify one server."
    : primaryReason === "incident"
      ? "Next best step: open live deployments and review the problem first."
      : primaryReason === "admin-target-needed"
        ? "Next best step: ask an admin to confirm one server target, then return to the workflow."
      : memberServerCopy
        ? memberServerCopy.support
        : deployments.length === 0
          ? "Next best step: choose which app to run on that server."
          : "Next best step: open your app list and continue from one running service.";
  const serverStepState =
    primaryReason === "server-setup" || primaryReason === "admin-target-needed"
      ? "current"
      : "complete";
  const deployStepState =
    primaryReason === "first-deploy"
      ? "current"
      : primaryReason === "server-setup" || primaryReason === "admin-target-needed"
        ? "upcoming"
        : "complete";
  const healthStepState =
    primaryReason === "incident" || primaryReason === "steady-state"
      ? "current"
      : "upcoming";
  const heroSpotlight =
    primaryReason === "server-setup"
      ? {
          badge: "Do this now",
          title: "Connect one server first",
          detail:
            "This overview is still Step 1 until DeployMate knows which machine it should reach.",
          support:
            "Once one target is saved and checked, the main path moves straight into app setup instead of more overview browsing.",
          actionLabel: overviewPrimaryPath.label,
          actionHref: overviewPrimaryPath.href,
        }
      : primaryReason === "admin-target-needed"
        ? {
            badge: "Waiting on admin",
            title: "Wait for one confirmed server target",
            detail:
              "Members do not unblock the remote target here. The useful move is understanding when the rollout path will open.",
            support:
              "As soon as an admin confirms one saved target, this screen shifts into the same deploy-first story as the admin path.",
            actionLabel: overviewPrimaryPath.label,
            actionHref: overviewPrimaryPath.href,
          }
        : primaryReason === "incident"
          ? {
              badge: "Needs attention",
              title: "Review the live runtime before more changes",
              detail:
                "A deployment already needs attention, so the safest next move is runtime review before another rollout or admin detour.",
              support:
                "Treat creation, reports, and admin surfaces as secondary until the failing runtime is understood.",
              actionLabel: overviewPrimaryPath.label,
              actionHref: overviewPrimaryPath.href,
            }
          : primaryReason === "first-deploy"
            ? {
                badge: "Step 1 complete",
                title: "Choose the first app to run",
                detail:
                  "You already have a target. Keep the momentum and use one guided create path instead of exploring the whole workspace.",
                support:
                  "After the first deployment exists, this overview becomes more about live health and less about setup.",
                actionLabel: overviewPrimaryPath.label,
                actionHref: overviewPrimaryPath.href,
              }
            : {
                badge: "Keep momentum",
                title: "Use the deployment workspace for the next deliberate move",
                detail:
                  "The overview is no longer the work area. Confirm the situation here, then continue inside the dedicated rollout workspace.",
                support:
                  "Come back for the broad picture, not when you already know the next runtime action.",
                actionLabel: overviewPrimaryPath.label,
                actionHref: overviewPrimaryPath.href,
              };
  const heroHeadline =
    primaryReason === "server-setup"
      ? "Connect one server, choose one app, then check live health."
      : primaryReason === "admin-target-needed"
        ? "Wait for one confirmed target, then continue in the rollout flow."
        : primaryReason === "first-deploy"
          ? "Step 1 is done. The main path is now one first deployment."
          : primaryReason === "incident"
            ? "A live deployment needs review before anything else."
            : "The runtime path is already live. Keep the next change deliberate.";
  const heroSupportText =
    primaryReason === "server-setup"
      ? "You do not need the whole product at once. Save and verify one target first, then the rest of the path becomes much clearer."
      : primaryReason === "admin-target-needed"
        ? "Members do not unblock the saved target here. As soon as an admin confirms it, this overview shifts into the same deploy-first path."
        : primaryReason === "first-deploy"
          ? "Ignore the deeper admin surfaces for now and use Deployment Workflow as the single place to choose the first image, ports, env vars, or saved template."
          : primaryReason === "incident"
            ? "Treat new rollouts and admin tools as secondary until the current runtime problem is understood in the live deployment workspace."
            : "Use the overview to confirm the current state, then do the real work in the dedicated runtime surfaces instead of bouncing across every screen.";
  const explanationTitle =
    primaryReason === "server-setup"
      ? "What DeployMate means in plain language"
      : primaryReason === "admin-target-needed"
        ? "What happens after an admin confirms the target"
        : primaryReason === "first-deploy"
          ? "What changes after the server step"
          : primaryReason === "incident"
            ? "Why runtime review comes before more changes"
            : "What this overview is helping you decide";
  const explanationBody =
    primaryReason === "server-setup"
      ? "You do not need to learn the whole workspace first. Understand the order, take the current step, and let the next screen do the deeper work."
      : primaryReason === "admin-target-needed"
        ? "The saved target is the blocker. Once an admin clears it, Deployment Workflow becomes the obvious next stop."
        : primaryReason === "first-deploy"
          ? "This overview is already past the server step. The next decision is simply what app to run first and how to confirm it stays healthy."
          : primaryReason === "incident"
            ? "Right now the product should make review feel simpler than change. Understand the broken runtime first, then decide the fix."
            : "The overview is strongest when it confirms the current state quickly and sends you back into the dedicated rollout screens.";
  const overviewStepCards = [
    {
      id: "server",
      label: "1. Connect",
      title: canAccessServers
        ? "Connect one server"
        : localDeploymentsEnabled
          ? "Admin keeps targets"
          : "Wait for admin target",
      detail: canAccessServers
        ? "Give DeployMate one machine to reach."
        : localDeploymentsEnabled
          ? "Your path still continues in rollout."
          : "Remote rollout opens after one confirmed target.",
      state: serverStepState,
    },
    {
      id: "deploy",
      label: "2. Launch",
      title: "Choose one app",
      detail: "Use one guided create path instead of hopping between tools.",
      state: deployStepState,
    },
    {
      id: "health",
      label: "3. Review",
      title: primaryReason === "incident" ? "Review the live issue" : "Check live health",
      detail:
        primaryReason === "incident"
          ? "Fix what is already failing before another rollout."
          : "Confirm the runtime looks healthy before the next change.",
      state: healthStepState,
    },
  ];
  const beginnerSteps = [
    {
      key: "step-1",
      step: "Step 1",
      state: serverStepState,
      stateLabel: serverStepState === "current" ? "Current step" : "Ready",
      title: canAccessServers
        ? servers.length === 0
          ? "Connect a server"
          : "Server step is already covered"
        : localDeploymentsEnabled
          ? memberServerCopy?.stepTitle || "Continue in deployment workflow"
          : deployments.length === 0
            ? memberServerCopy?.stepTitle || "Wait for the server target"
            : "Target is already handled",
      detail: canAccessServers
        ? servers.length === 0
          ? "Add one machine and make sure DeployMate can sign in to it over SSH."
          : `${servers.length} server target${servers.length === 1 ? "" : "s"} already exist. Revisit this step only if you need another machine or a deeper check.`
        : localDeploymentsEnabled
          ? memberServerCopy?.stepDetail || "Use the deployment workflow for the next rollout step."
          : deployments.length === 0
            ? memberServerCopy?.stepDetail ||
              "Deployment creation stays blocked until an admin confirms the saved server target for this workspace."
            : "The remote target is already managed outside this screen, so your useful work continues in the rollout workspace.",
      href: canAccessServers ? "/app/server-review" : "/app/deployment-workflow",
      actionLabel: canAccessServers
        ? servers.length === 0
          ? "Open server review"
          : "Review server step"
        : deployments.length === 0
          ? memberServerCopy?.stepAction || "Open deployment workflow"
          : "Open deployment workflow",
      primary: serverStepState === "current",
    },
    {
      key: "step-2",
      step: "Step 2",
      state: deployStepState,
      stateLabel: deployStepState === "current" ? "Current step" : deployStepState === "complete" ? "Available" : "Later",
      title:
        deployments.length === 0
          ? "Choose the first app"
          : primaryReason === "incident"
            ? "Hold the next rollout for now"
            : "Choose the next app when ready",
      detail:
        deployments.length === 0
          ? "Use the guided create path for image, target, ports, env vars, and optional template save."
          : primaryReason === "incident"
            ? "Pause new rollout decisions until the current runtime is understood. The deploy workspace is still where that review happens."
            : "Deployment Workflow stays the shortest path for the next deliberate rollout or template reuse.",
      href: "/app/deployment-workflow",
      actionLabel: deployments.length === 0 ? "Start first deployment" : "Open deployment workflow",
      primary: deployStepState === "current",
    },
    {
      key: "step-3",
      step: "Step 3",
      state: healthStepState,
      stateLabel: healthStepState === "current" ? "Current step" : "Later",
      title:
        primaryReason === "incident"
          ? "Review the live issue"
          : deployments.length === 0
            ? "Check live health after deploy"
            : "Review live health",
      detail:
        primaryReason === "incident"
          ? "Start with the affected runtime, gather status, then decide whether to redeploy, edit, or wait."
          : deployments.length === 0
            ? "As soon as the first rollout starts, confirm it is healthy and reachable before adding more changes."
            : "Open the live runtime list or deployment detail and confirm the app stays healthy before the next change.",
      href: "/app/deployment-workflow",
      actionLabel:
        primaryReason === "incident"
          ? "Review deployments"
          : deployments.length === 0
            ? "See running apps"
            : "Review live runtime",
      primary: healthStepState === "current",
    },
  ];
  const overviewFollowThrough =
    primaryReason === "server-setup"
      ? {
          title: "One ready server unlocks the rest of the story",
          detail:
            "The overview only needs to push you through Step 1 once. After that, app setup becomes the clear main path.",
        }
      : primaryReason === "admin-target-needed"
        ? {
            title: "This path opens as soon as one target is confirmed",
            detail:
              "Until then, the saved-target blocker matters more than any export, report, or admin surface below.",
          }
        : primaryReason === "first-deploy"
          ? {
              title: "The first deployment changes what matters here",
              detail:
                "Once one app exists, the overview should point more toward live health and less toward initial setup.",
            }
          : primaryReason === "incident"
            ? {
                title: "Runtime clarity matters more than more controls",
                detail:
                  "Review first, understand the failure, then decide the safest fix instead of opening more tools.",
              }
            : {
                title: "Use the overview for orientation, not for doing the work",
                detail:
                  "The dedicated rollout screens remain the place for creation, live review, and deeper decisions.",
              };
  const overviewGlanceCards = [
    {
      label: "Current state",
      title: beginnerStatusSummary,
      detail: beginnerNextStep,
      elevated: true,
    },
    {
      label: "After this",
      title:
        primaryReason === "server-setup" || primaryReason === "admin-target-needed"
          ? "Deployment Workflow becomes Step 2"
          : primaryReason === "first-deploy"
            ? "Live health becomes Step 3"
            : primaryReason === "incident"
              ? "Choose the safest fix next"
              : "Keep the next change deliberate",
      detail:
        primaryReason === "server-setup" || primaryReason === "admin-target-needed"
          ? "As soon as one target is ready, move into app setup instead of staying in overview."
          : primaryReason === "first-deploy"
            ? "After the first rollout starts, confirm the runtime is healthy before you add more change."
            : primaryReason === "incident"
              ? "Use the runtime evidence to decide whether to redeploy, edit, or wait."
              : "Use the dedicated runtime surfaces for the next change and return here only for the broad picture.",
    },
    {
      label: "Ignore for now",
      title: canAccessServers
        ? "Reports and admin tools are secondary"
        : localDeploymentsEnabled
          ? "The saved server list is not your blocker"
          : "Deeper admin surfaces are not the blocker",
      detail: canAccessServers
        ? "Users, upgrade review, exports, and reports should stay quieter than the current rollout step."
        : localDeploymentsEnabled
          ? "Admins own the saved targets. Your useful work still happens inside Deployment Workflow."
          : "What matters first is one confirmed target, not a tour of every admin surface.",
    },
  ];
  const plainLanguageCards = [
    {
      title: "What “server” means here",
      detail: canAccessServers
        ? "It is simply the machine where your app will run. Step 1 only tells DeployMate how to reach that machine."
        : localDeploymentsEnabled
          ? "Admins keep the saved server list, but your rollout path still starts by choosing what to run."
          : "The remote machine is confirmed by an admin first, then you continue in the rollout workflow.",
    },
    {
      title: "What “choose your app” means",
      detail:
        "Usually this is a container image like `nginx:latest`, or one saved template that already remembers the image, ports, and env vars.",
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
    <main className="page">
      <div className="container">
        <section className="workspaceHero">
          <div className="workspaceHeroBackdrop" />
          <div className="header workspaceHeroHeader">
            <div>
              <div className="eyebrow">Begin here</div>
              <h1 data-testid="runtime-page-title">DeployMate</h1>
              <p>{heroHeadline}</p>
              <p className="formHint">{heroSupportText}</p>
            </div>
            <div className="buttonRow workspaceHeroActions">
              <button type="button" onClick={handleLogout} className="workspaceGhostAction">
                Logout
              </button>
            </div>
          </div>
          <div className="overviewHeroSummary">
            <article className="workspaceHeroBadge workspaceHeroSpotlight overviewHeroSpotlightCard">
              <span>{heroSpotlight.badge}</span>
              <strong>{heroSpotlight.title}</strong>
              <p>{heroSpotlight.detail}</p>
              <p className="workspaceHeroSpotlightNote">{heroSpotlight.support}</p>
              <div className="formActions">
                <Link
                  href={heroSpotlight.actionHref}
                  className="landingButton primaryButton"
                  data-testid="workspace-hero-primary-action"
                >
                  {heroSpotlight.actionLabel}
                </Link>
              </div>
            </article>
            <div className="overviewStepStrip" aria-label="Overview path">
              {overviewStepCards.map((step) => (
                <article
                  key={step.id}
                  className={`overviewStepCard is${step.state[0].toUpperCase()}${step.state.slice(1)}`}
                >
                  <span>{step.label}</span>
                  <strong>{step.title}</strong>
                  <p>{step.detail}</p>
                </article>
              ))}
            </div>
          </div>

          <article className="card formCard workspaceGuidePanel" data-testid="workspace-scenario-card">
            <div className="sectionHeader workspaceGuideHeader">
              <div>
                <h2 data-testid="workspace-scenario-title">Keep going in this order</h2>
                <p className="formHint">
                  One step should feel current. The rest should read like context, not like competing instructions.
                </p>
              </div>
            </div>
            <div className="workspaceGuideGrid" data-testid="workspace-scenario-grid">
              <div className="workspaceGuideSteps">
                <article className="workspaceGlancePanel workspacePriorityPanel" data-testid="workspace-primary-task-card">
                  <div className="workspaceGlanceHeader">
                    <span className="eyebrow">{heroSpotlight.badge}</span>
                    <strong>{overviewPrimaryPath.title}</strong>
                  </div>
                  <p className="formHint">{overviewPrimaryPath.detail}</p>
                  <p className="workspacePrioritySupport">{heroSpotlight.support}</p>
                  <div className="formActions">
                    <Link
                      href={overviewPrimaryPath.href}
                      className="landingButton primaryButton"
                      data-testid="workspace-primary-task-action"
                    >
                      {overviewPrimaryPath.label}
                    </Link>
                  </div>
                </article>

                <div className="stepsGrid">
                  {beginnerSteps.map((card) => (
                    <article
                      key={card.key}
                      className={`stepCard workspaceStepCard is${card.state[0].toUpperCase()}${card.state.slice(1)}`}
                      data-testid={`workspace-scenario-item-${card.key}`}
                    >
                      <span className="overviewStepStateLabel">{card.stateLabel}</span>
                      <span className="stepNumber">{card.step}</span>
                      <h3>{card.title}</h3>
                      <p>{card.detail}</p>
                      <Link
                        href={card.href}
                        className={card.primary ? "landingButton primaryButton" : "secondaryButton overviewStepAction"}
                        data-testid={`workspace-scenario-action-${card.key}`}
                      >
                        {card.actionLabel}
                      </Link>
                    </article>
                  ))}
                </div>
              </div>
              <aside className="workspaceGlancePanel">
                <div className="workspaceGlanceHeader">
                  <span className="eyebrow">What happens next</span>
                  <strong>{overviewFollowThrough.title}</strong>
                </div>
                <p className="formHint">{overviewFollowThrough.detail}</p>
                <div className="workspaceGlanceList">
                  {overviewGlanceCards.map((card) => (
                    <div
                      key={card.label}
                      className={`workspaceStatusCard workspaceGlanceItem ${
                        card.elevated ? "workspaceStatusCardElevated" : ""
                      }`.trim()}
                    >
                      <span>{card.label}</span>
                      <strong>{card.title}</strong>
                      <p>{card.detail}</p>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </article>
        </section>

        <article className="card formCard workspaceGuidePanel">
          <div className="sectionHeader workspaceGuideHeader">
            <div>
              <h2>{explanationTitle}</h2>
              <p className="formHint">{explanationBody}</p>
            </div>
          </div>
          <div className="workspaceReviewerGrid">
            {plainLanguageCards.map((card) => (
              <article key={card.title} className="workspaceReviewerCard">
                <span>Plain language</span>
                <strong>{card.title}</strong>
                <p>{card.detail}</p>
              </article>
            ))}
          </div>
        </article>

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
