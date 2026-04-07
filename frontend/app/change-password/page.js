"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { smokeChangePasswordUser, smokeMode } from "../lib/admin-smoke-fixtures";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

async function readJsonOrError(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const error = new Error(
      payload && typeof payload.detail === "string"
        ? payload.detail
        : fallbackMessage,
    );
    error.status = response.status;
    throw error;
  }

  return payload;
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(!smokeMode);
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(
    smokeMode ? smokeChangePasswordUser : null,
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  useEffect(() => {
    if (smokeMode) {
      return;
    }

    async function checkAuth() {
      try {
        const response = await fetch(`${apiBaseUrl}/auth/me`, {
          cache: "no-store",
          credentials: "include",
        });
        const user = await readJsonOrError(response, "Authentication failed.");
        setCurrentUser(user);
      } catch {
        router.replace("/login");
        return;
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router]);

  function updateFormField(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    if (form.new_password !== form.confirm_password) {
      setError("New password and confirmation must match.");
      setSubmitting(false);
      return;
    }

    if (smokeMode) {
      setSuccess("Password updated successfully. Redirecting to DeployMate...");
      setForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      setSubmitting(false);
      return;
    }

    try {
      await readJsonOrError(
        await fetch(`${apiBaseUrl}/auth/change-password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            current_password: form.current_password,
            new_password: form.new_password,
          }),
        }),
        "Failed to change password.",
      );

      setSuccess("Password updated successfully. Redirecting to DeployMate...");
      setForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      window.setTimeout(() => {
        router.replace("/app");
      }, 800);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to change password.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    if (smokeMode) {
      router.replace("/login");
      return;
    }

    try {
      await fetch(`${apiBaseUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.replace("/login");
    }
  }

  if (loading) {
    return (
      <main className="page authPage authLoginScene">
        <div className="container authLoginShell">
          <section className="authLoginStage authFlowStage authFlowStageCompact">
            <div className="authLoginBackdrop">
              <div className="authLoginGlow authLoginGlowPrimary" />
              <div className="authLoginGlow authLoginGlowSecondary" />
              <div className="authLoginSpinner" aria-hidden="true" />
            </div>

            <div className="authLoginIntro authFlowIntro authFlowLoadingIntro">
              <span className="eyebrow">Account security</span>
              <h1>DeployMate</h1>
              <p className="authLoginLead">Checking authentication...</p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="page authPage authLoginScene">
      <div className="container authLoginShell">
        <section className="authLoginStage authFlowStage">
          <div className="authLoginBackdrop">
            <div className="authLoginGlow authLoginGlowPrimary" />
            <div className="authLoginGlow authLoginGlowSecondary" />
            <div className="authLoginSpinner" aria-hidden="true" />
          </div>

          <div className="authLoginIntro authFlowIntro">
            <span className="eyebrow">Account security</span>
            <h1>DeployMate</h1>
            <p className="authLoginLead">
              {currentUser?.must_change_password
                ? "Set a new password before entering the workspace."
                : "Update your password without leaving the current session."}
            </p>
          </div>

          <article className="card formCard authCard authLoginCard authFlowCard" data-testid="auth-change-password-card">
            <div className="authLoginCardTop">
              <div className="authCardHeader authLoginCardHeader">
                <div>
                  <div className="eyebrow">Secure access</div>
                  <h2 data-testid="auth-change-password-title">Change Password</h2>
                  <p className="formHint" data-testid="auth-change-password-user">
                    {currentUser ? `Logged in as ${currentUser.username}` : "DeployMate"}
                  </p>
                </div>
                <div className="authCardBadge">
                  {currentUser?.must_change_password ? "Required" : "Live app"}
                </div>
              </div>

              {currentUser?.must_change_password ? (
                <div className="banner error authBanner" data-testid="auth-change-password-required-banner">
                  You are still using the default admin password. Change it before continuing.
                </div>
              ) : (
                <div className="banner subtle authBanner" data-testid="auth-change-password-help-banner">
                  Update your password. The current session will keep working.
                </div>
              )}

              <form className="form" onSubmit={handleSubmit} data-testid="auth-change-password-form">
                <label className="field">
                  <span>Current password</span>
                  <input
                    name="current_password"
                    type="password"
                    value={form.current_password}
                    onChange={updateFormField}
                    disabled={submitting}
                    required
                    data-testid="auth-change-password-current-input"
                  />
                </label>

                <label className="field">
                  <span>New password</span>
                  <input
                    name="new_password"
                    type="password"
                    value={form.new_password}
                    onChange={updateFormField}
                    disabled={submitting}
                    required
                    data-testid="auth-change-password-new-input"
                  />
                </label>

                <label className="field">
                  <span>Confirm new password</span>
                  <input
                    name="confirm_password"
                    type="password"
                    value={form.confirm_password}
                    onChange={updateFormField}
                    disabled={submitting}
                    required
                    data-testid="auth-change-password-confirm-input"
                  />
                </label>

                <div className="formActions authActions authLoginActions">
                  <button
                    type="submit"
                    className="landingButton primaryButton authPrimaryAction authLoginPrimaryAction"
                    disabled={submitting}
                    data-testid="auth-change-password-submit-button"
                  >
                    {submitting ? "Saving..." : "Change password"}
                  </button>
                </div>
              </form>

              {error ? <div className="banner error" data-testid="auth-change-password-error-banner">{error}</div> : null}
              {success ? <div className="banner success" data-testid="auth-change-password-success-banner">{success}</div> : null}
            </div>

            <div className="authCardFooter authLoginFooter authFlowFooter">
              <div className="authFlowFooterActions">
                {!currentUser?.must_change_password ? (
                  <Link href="/app" className="linkButton" data-testid="auth-change-password-back-link">
                    Back
                  </Link>
                ) : null}
                <button type="button" className="linkButton" onClick={handleLogout} data-testid="auth-change-password-logout-button">
                  Logout
                </button>
              </div>
              <span className="authFooterNote">One quiet security step, then back into the product.</span>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
