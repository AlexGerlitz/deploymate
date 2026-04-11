"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { smokeMode, smokeUser } from "./lib/smoke-fixtures";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

function isWorkspacePath(pathname) {
  return (
    pathname === "/change-password" ||
    pathname.startsWith("/app") ||
    pathname.startsWith("/deployments/")
  );
}

export default function WorkspaceChrome({ children, footer }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(smokeMode ? smokeUser : null);
  const showChrome = useMemo(() => isWorkspacePath(pathname), [pathname]);

  useEffect(() => {
    setHelpOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!showChrome || smokeMode) {
      return;
    }

    let active = true;

    async function loadCurrentUser() {
      try {
        const response = await fetch(`${apiBaseUrl}/auth/me`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (active) {
          setCurrentUser(data);
        }
      } catch {
        // Pages already handle auth redirects. The shell can stay quiet here.
      }
    }

    loadCurrentUser();

    return () => {
      active = false;
    };
  }, [showChrome]);

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

  if (!showChrome) {
    return (
      <>
        {children}
        {footer}
      </>
    );
  }

  return (
    <div className="workspaceAppShell">
      <header className="workspaceTopBar" data-testid="workspace-topbar">
        <div className="workspaceTopBarInner">
          <div className="workspaceTopBarSpacer" />

          <Link href="/app" className="workspaceTopBarBadge" data-testid="workspace-topbar-badge">
            <span className="workspaceTopBarBadgeMark" aria-hidden="true">
              DM
            </span>
            <span className="workspaceTopBarBadgeLabel">DeployMate</span>
          </Link>

          <div className="workspaceTopBarActions">
            <div className="workspaceTopBarActionGroup">
              <button
                type="button"
                className="workspaceTopBarButton"
                data-testid="workspace-topbar-help-button"
                aria-expanded={helpOpen}
                onClick={() => {
                  setHelpOpen((value) => !value);
                  setProfileOpen(false);
                }}
              >
                Help
              </button>
              {helpOpen ? (
                <div className="workspaceTopBarPanel" data-testid="workspace-topbar-help-panel">
                  <div className="workspaceTopBarPanelSection">
                    <strong>About DeployMate</strong>
                    <p>One path stays in focus: connect one server, deploy one app, then review runtime health before the next change.</p>
                  </div>
                  <div className="workspaceTopBarPanelSection">
                    <strong>Open the right screen</strong>
                    <div className="workspaceTopBarMiniList">
                      <Link href="/app/server-review">Step 1 opens Server review</Link>
                      <Link href="/app/deployment-workflow">Step 2 opens Deployment workflow</Link>
                      <Link href="/app/deployment-workflow">Step 3 opens Live review</Link>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="workspaceTopBarActionGroup">
              <button
                type="button"
                className="workspaceTopBarButton workspaceTopBarProfileButton"
                data-testid="workspace-topbar-profile-button"
                aria-expanded={profileOpen}
                onClick={() => {
                  setProfileOpen((value) => !value);
                  setHelpOpen(false);
                }}
              >
                <span className="workspaceTopBarProfileAvatar" aria-hidden="true">
                  {(currentUser?.username || "D").slice(0, 1).toUpperCase()}
                </span>
                <span className="workspaceTopBarProfileText">
                  <strong>{currentUser?.username || "Profile"}</strong>
                  <span>{currentUser?.role || "workspace"}</span>
                </span>
              </button>
              {profileOpen ? (
                <div className="workspaceTopBarPanel workspaceTopBarPanelRight" data-testid="workspace-topbar-profile-panel">
                  <div className="workspaceTopBarPanelSection">
                    <strong>{currentUser?.username || "DeployMate"}</strong>
                    <p>
                      {currentUser?.role || "workspace"}
                      {currentUser?.plan ? ` · ${currentUser.plan}` : ""}
                    </p>
                  </div>
                  <div className="workspaceTopBarMiniList">
                    <Link href="/change-password">Change password</Link>
                    <Link href="/app">Open workspace</Link>
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="workspaceTopBarButton"
              data-testid="workspace-topbar-logout-button"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="workspaceAppContent">{children}</div>
    </div>
  );
}
