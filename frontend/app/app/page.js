"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminDisclosureSection } from "./admin-ui";
import {
  smokeDeployments,
  smokeMode,
  smokeNotifications,
  smokeOpsOverview,
  smokeServers,
  smokeTemplates,
  smokeUser,
} from "../lib/smoke-fixtures";
import {
  buildOpsSnapshot,
  buildOpsSummaryText,
  downloadJsonFile,
  formatDate,
  readErrorMessageFromResponse,
  readJsonOrError,
  rolloutReviewerCopy,
  triggerFileDownload,
} from "../lib/runtime-workspace-utils";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export default function HomePage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(smokeMode);
  const [authFallbackVisible, setAuthFallbackVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState(smokeMode ? smokeUser : null);
  const [deployments, setDeployments] = useState(smokeMode ? smokeDeployments : []);
  const [servers, setServers] = useState(smokeMode ? smokeServers : []);
  const [notifications, setNotifications] = useState(smokeMode ? smokeNotifications : []);
  const [templates, setTemplates] = useState(smokeMode ? smokeTemplates : []);
  const [loading, setLoading] = useState(!smokeMode);
  const [serversLoading, setServersLoading] = useState(!smokeMode);
  const [notificationsLoading, setNotificationsLoading] = useState(!smokeMode);
  const [templatesLoading, setTemplatesLoading] = useState(!smokeMode);
  const [opsOverviewLoading, setOpsOverviewLoading] = useState(!smokeMode);
  const [error, setError] = useState("");
  const [serversError, setServersError] = useState("");
  const [notificationsError, setNotificationsError] = useState("");
  const [templatesError, setTemplatesError] = useState("");
  const [opsOverview, setOpsOverview] = useState(smokeMode ? smokeOpsOverview : null);
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
  const workspacePriority =
    opsSnapshot.attention_items[0]?.title ||
    (opsSnapshot.deployments.failed > 0
      ? "Failed deployments need review before the next rollout."
      : "Workspace is clear enough for the next rollout.");
  const degradedOpsAttentionItems = opsSnapshot.attention_items.filter((item) =>
    item.title.includes("temporarily unavailable"),
  );
  const workspaceFocusItems = [
    {
      label: "Priority",
      value:
        opsSnapshot.attention_items[0]?.title ||
        (deployments.length === 0 ? "Start first rollout" : "Workspace is stable"),
      detail:
        opsSnapshot.attention_items[0]?.detail ||
        "No blocking signal is leading the workspace right now.",
    },
    {
      label: "Runtime",
      value:
        opsSnapshot.deployments.failed > 0
          ? "Incident review first"
          : deployments.length === 0
            ? "Ready for first deployment"
            : "Ready for next rollout",
      detail:
        deployments.length > 0
          ? `${opsSnapshot.deployments.running} running · ${opsSnapshot.deployments.failed} failed · ${opsSnapshot.deployments.public_urls} public URLs`
          : "Use the dedicated deployment workspace to launch the first service or save a reusable template.",
    },
    {
      label: "Readiness",
      value:
        templates.length > 0
          ? `${templates.length} template${templates.length === 1 ? "" : "s"} ready`
          : "Guided deploy path ready",
      detail:
        servers.length > 0
          ? `${servers.length} target${servers.length === 1 ? "" : "s"} saved for repeatable rollout.`
          : "Add server targets in server review when you want remote-only rollout paths.",
    },
  ];
  const workspaceScenarioCards = [
    {
      key: "deploy",
      label: "Deploy",
      title: deployments.length > 0 ? "Start the next rollout" : "Launch the first deployment",
      detail:
        templates.length > 0
          ? "Open the dedicated deployment workspace for guided create flow, template preview, and rollout actions in one place."
          : "Start in the deployment workspace, then pick image, ports, env vars, and saved target without hunting through the whole app.",
      href: "/app/deployment-workflow",
      actionLabel: "Open deployment workflow",
      primary: true,
    },
    {
      key: "runtime",
      label: "Runtime",
      title: opsSnapshot.deployments.failed > 0 ? "Review live incidents" : "Review live deployments",
      detail:
        opsSnapshot.deployments.failed > 0
          ? "Go straight to the deployment workspace and open a live runtime card before more rollout changes."
          : "Use the deployment workspace when you want the current list, health context, and a fast path into deployment detail.",
      href: "/app/deployment-workflow",
      actionLabel: opsSnapshot.deployments.failed > 0 ? "Review deployments" : "Open live deployments",
      primary: false,
    },
    ...(currentUser?.is_admin
      ? [
          {
            key: "servers",
            label: "Servers",
            title: "Review server targets",
            detail: "Use the dedicated server workspace when you need to add, test, diagnose, or clean up rollout targets.",
            href: "/app/server-review",
            actionLabel: "Open server review",
            primary: false,
          },
          {
            key: "recovery",
            label: "Recovery",
            title: "Review backup and recovery",
            detail: "Open the admin recovery path when you need restore validation, import review, or controlled preparation handoff.",
            href: "/app/users",
            actionLabel: "Open recovery path",
            primary: false,
          },
        ]
      : [
          {
            key: "upgrade",
            label: "Upgrade",
            title: "Unlock more workspace depth",
            detail: "Commercial and team workflows stay separate from the core rollout path until you need them.",
            href: "/upgrade",
            actionLabel: "View upgrade options",
            primary: false,
          },
        ]),
  ];
  const reviewerPathItems = [
    {
      label: "Start here",
      title:
        opsSnapshot.deployments.total > 0
          ? "Read the live deployment workspace"
          : "Open the guided rollout workspace",
      detail:
        opsSnapshot.deployments.total > 0
          ? "Open the deployment workspace first, then step into one live deployment detail when you want health, logs, diagnostics, and activity together."
          : "The deployment workspace now keeps the first rollout path, templates, and live list together instead of scattering them through the overview page.",
      href: "/app/deployment-workflow",
      actionLabel: "Open deployment workflow",
    },
    {
      label: "Then show depth",
      title: currentUser?.is_admin ? "Open team access review" : "Open upgrade path",
      detail: currentUser?.is_admin
        ? "The users surface keeps access review, restore validation, and audit-oriented recovery flow separate from day-to-day rollout work."
        : "The upgrade path keeps commercial next steps separate from the runtime workspace.",
      href: currentUser?.is_admin ? "/app/users" : "/upgrade",
      actionLabel: currentUser?.is_admin ? "Open users" : "Open upgrade",
    },
    {
      label: "Finish with governance",
      title: currentUser?.is_admin ? "Open the upgrade inbox" : "Return to runtime state",
      detail: currentUser?.is_admin
        ? "The upgrade inbox stays available when you need queue review, bulk status changes, and audit history after the product path is already clear."
        : "Stay on the main workspace when you only need rollout proof and runtime clarity.",
      href: currentUser?.is_admin ? "/app/upgrade-requests" : "/app/deployment-workflow",
      actionLabel: currentUser?.is_admin ? "Open upgrade inbox" : "Back to deployments",
    },
  ];
  const firstRunContext = deployments.length > 0
    ? "Start with the deployment workspace and one live runtime card. Open team/admin review only after the rollout story is already clear."
    : "This environment has no live deployments yet, so the next useful step is opening the dedicated deployment workspace and following the guided create path.";
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
              <div className="eyebrow">Live workspace</div>
              <h1 data-testid="runtime-page-title">DeployMate</h1>
              <p>
                {currentUser
                  ? `Logged in as ${currentUser.username}. ${workspacePriority}`
                  : rolloutReviewerCopy.overview.heroBody}
              </p>
            </div>
            <div className="buttonRow workspaceHeroActions">
              <Link
                href="/app/deployment-workflow"
                className="landingButton primaryButton workspacePrimaryAction"
              >
                Open deployment workflow
              </Link>
              {currentUser?.is_admin ? (
                <Link href="/app/server-review" className="workspaceGhostAction">
                  Server review
                </Link>
              ) : null}
              {currentUser?.is_admin ? (
                <Link href="/app/users" className="workspaceGhostAction">
                  Users
                </Link>
              ) : null}
              {currentUser?.is_admin ? (
                <Link href="/app/upgrade-requests" className="workspaceGhostAction">
                  Upgrade inbox
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => refreshPage()}
                disabled={
                  loading ||
                  serversLoading ||
                  notificationsLoading ||
                  templatesLoading ||
                  opsOverviewLoading
                }
                className="linkButton workspaceSecondaryAction"
              >
                {loading || serversLoading || notificationsLoading || templatesLoading || opsOverviewLoading
                  ? "Refreshing..."
                  : "Refresh"}
              </button>
              <button type="button" onClick={handleLogout} className="workspaceGhostAction">
                Logout
              </button>
            </div>
          </div>

          <div className="workspaceHeroSummary">
            <div className="workspaceHeroMetric">
              <span>Deployments</span>
              <strong>{opsSnapshot.deployments.running}</strong>
              <p>
                Running now · {opsSnapshot.deployments.total} total ·{" "}
                {opsSnapshot.deployments.failed} failed
              </p>
            </div>
            <div className="workspaceHeroMetric">
              <span>Targets</span>
              <strong>{opsSnapshot.servers.total}</strong>
              <p>
                Server targets · {opsSnapshot.servers.ssh_key_auth} SSH key ·{" "}
                {opsSnapshot.servers.unused} idle
              </p>
            </div>
            <div className="workspaceHeroMetric">
              <span>Templates</span>
              <strong>{opsSnapshot.templates.total}</strong>
              <p>
                Saved rollout presets · {opsSnapshot.templates.recently_used} used in 7 days ·{" "}
                {opsSnapshot.templates.unused} unused
              </p>
            </div>
            <div className="workspaceHeroBadge workspaceHeroSpotlight">
              <span>What matters now</span>
              <strong>{workspacePriority}</strong>
              <p>
                {rolloutReviewerCopy.overview.spotlightBody}
              </p>
            </div>
          </div>
        </section>

        <article className="card formCard workspaceGuidePanel" data-testid="workspace-scenario-card">
            <div className="sectionHeader workspaceGuideHeader">
              <div>
              <h2 data-testid="workspace-scenario-title">{rolloutReviewerCopy.shared.obviousPathTitle}</h2>
              <p className="formHint">
                {rolloutReviewerCopy.shared.obviousPathBody}
              </p>
            </div>
          </div>
          <div className="workspaceGuideGrid" data-testid="workspace-scenario-grid">
            <div className="stepsGrid workspaceGuideSteps">
              {workspaceScenarioCards.slice(0, 2).map((card) => (
                <article
                  key={card.key}
                  className="stepCard workspaceStepCard"
                  data-testid={`workspace-scenario-item-${card.key}`}
                >
                  <span className="stepNumber">{card.label}</span>
                  <h3>{card.title}</h3>
                  <p>{card.detail}</p>
                  <Link
                    href={card.href}
                    className={card.primary ? "landingButton primaryButton" : "landingButton secondaryButton"}
                    data-testid={`workspace-scenario-action-${card.key}`}
                  >
                    {card.actionLabel}
                  </Link>
                </article>
              ))}
            </div>
            <aside className="workspaceGlancePanel">
              <div className="workspaceGlanceHeader">
                <span className="eyebrow">Current focus</span>
                <strong>Choose one path and ignore the rest</strong>
              </div>
              <div className="workspaceGlanceList">
                {workspaceFocusItems.map((item) => (
                  <div key={item.label} className="workspaceStatusCard workspaceGlanceItem">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <p>{item.detail}</p>
                  </div>
                ))}
              </div>
              <div className="workspaceMetaLine">
                <span>{firstRunContext}</span>
              </div>
            </aside>
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
          <div className="banner subtle" data-testid="workspace-first-pass-banner">
            <strong>New here?</strong> {firstRunContext}
          </div>
          {smokeMode ? (
            <div className="banner subtle" data-testid="runtime-smoke-banner">
              Smoke mode uses fixture data for overview and deployment entry surfaces.
            </div>
          ) : (
            <div className="banner subtle" data-testid="runtime-smoke-banner">
              Overview signals and reports refresh automatically every 8 seconds.
            </div>
          )}

          <article className="card formCard workspaceGuidePanel" data-testid="workspace-guide-card">
            <div className="sectionHeader workspaceGuideHeader">
              <div>
                <h2 data-testid="workspace-guide-title">Secondary paths stay below the main route</h2>
                <p className="formHint">
                  Admin, recovery, and reviewer flows still matter, but they should not compete with the first deployment decision on page load.
                </p>
              </div>
            </div>
            <div className="workspaceReviewerGrid" data-testid="workspace-reviewer-panel">
              {reviewerPathItems.map((item) => (
                <article key={item.label} className="workspaceReviewerCard">
                  <span>{item.label}</span>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                  <Link href={item.href} className="landingButton secondaryButton">
                    {item.actionLabel}
                  </Link>
                </article>
              ))}
            </div>
          </article>
        </div>

        <AdminDisclosureSection
          title="Workspace signals and reports"
          subtitle="Operational totals, attention items, and exportable summaries stay here when you want the broad picture without leaving the overview."
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
              subtitle="Copy the current summary or export deployment, server, template, and activity data when you need a handoff or audit artifact."
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
                <strong className="overviewValue">{opsSnapshot.servers.total}</strong>
                <div className="overviewMeta">
                  <span>Password auth {opsSnapshot.servers.password_auth}</span>
                  <span>SSH key auth {opsSnapshot.servers.ssh_key_auth}</span>
                  <span>Unused {opsSnapshot.servers.unused}</span>
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
