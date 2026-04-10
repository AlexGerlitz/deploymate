import Link from "next/link";

const publicSignupEnabled =
  process.env.NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED === "1";

export default async function RegisterPage({ searchParams }) {
  const params = await searchParams;
  const error = typeof params?.error === "string" ? params.error : "";
  const username = typeof params?.username === "string" ? params.username : "";

  if (!publicSignupEnabled) {
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
              <span className="eyebrow">Trial access</span>
              <h1>DeployMate</h1>
              <p className="authLoginLead">Trial signup is currently closed.</p>
            </div>

            <article className="card formCard authCard authLoginCard authFlowCard" data-testid="auth-register-card">
              <div className="authLoginCardTop">
                <div className="authCardHeader authLoginCardHeader">
                  <div>
                    <div className="eyebrow">Create account</div>
                    <h2 data-testid="auth-register-title">Create Trial Account</h2>
                    <p className="formHint">
                      Public trial signup is not enabled in this environment.
                    </p>
                  </div>
                  <div className="authCardBadge">Closed</div>
                </div>
              </div>

              <div className="banner subtle authBanner" data-testid="auth-register-disabled-banner">
                Ask an admin for access, or return to login if you already have an account.
              </div>

              <div className="authCardFooter authLoginFooter">
                <Link href="/login" className="linkButton" data-testid="auth-register-back-link">
                  Back to login
                </Link>
                <span className="authFooterNote">One calm entry point, no extra noise.</span>
              </div>
            </article>
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
            <span className="eyebrow">Trial onboarding</span>
            <h1>DeployMate</h1>
            <p className="authLoginLead">Create a safe trial account, try the product, then request a paid or commercial upgrade only if you need one.</p>
          </div>

          <article className="card formCard authCard authLoginCard authFlowCard" data-testid="auth-register-card">
            <div className="authLoginCardTop">
              <div className="authCardHeader authLoginCardHeader">
                  <div>
                    <div className="eyebrow">Start with trial</div>
                    <h2 data-testid="auth-register-title">Create Trial Account</h2>
                    <p className="formHint">
                      This creates a `member` account on the `trial` plan.
                    </p>
                  </div>
                  <div className="authCardBadge">Public trial</div>
                </div>

              <div className="banner subtle authBanner" data-testid="auth-register-help-banner">
                Trial signup is the public entry point. Paid plans and commercial access are handled later through an upgrade request.
              </div>

              <form className="form" method="post" action="/register/submit" data-testid="auth-register-form">
                <label className="field">
                  <span>Username</span>
                  <input
                    name="username"
                    autoComplete="username"
                    defaultValue={username}
                    required
                    minLength={3}
                    maxLength={32}
                    pattern="[a-zA-Z0-9_.-]+"
                    data-testid="auth-register-username-input"
                  />
                  <span className="fieldHint">
                    3-32 characters: letters, numbers, dots, dashes, underscores.
                  </span>
                </label>

                <label className="field">
                  <span>Password</span>
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    data-testid="auth-register-password-input"
                  />
                  <span className="fieldHint">At least 8 characters.</span>
                </label>

                <label className="field">
                  <span>Confirm password</span>
                  <input
                    name="confirm_password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    data-testid="auth-register-confirm-password-input"
                  />
                </label>

                <div className="formActions authActions authLoginActions">
                  <button
                    type="submit"
                    className="landingButton primaryButton authPrimaryAction authLoginPrimaryAction"
                    data-testid="auth-register-submit-button"
                  >
                    Create trial account
                  </button>
                </div>
              </form>
            </div>

            {error ? <div className="banner error" data-testid="auth-register-error-banner">{error}</div> : null}

            <div className="authCardFooter authLoginFooter">
              <Link href="/login" className="linkButton" data-testid="auth-register-back-link">
                Back to login
              </Link>
              <span className="authFooterNote">Fast trial signup, then directly into the app.</span>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
