import Link from "next/link";

const publicSignupEnabled =
  process.env.NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED === "1";

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const error = typeof params?.error === "string" ? params.error : "";
  const username = typeof params?.username === "string" ? params.username : "";

  return (
    <main className="page authPage authLoginScene">
      <div className="container authLoginShell">
        <section className="authLoginStage">
          <div className="authLoginBackdrop">
            <div className="authLoginGlow authLoginGlowPrimary" />
            <div className="authLoginGlow authLoginGlowSecondary" />
            <div className="authLoginSpinner" aria-hidden="true" />
          </div>

          <div className="authLoginIntro">
            <span className="eyebrow">Live product access</span>
            <h1>DeployMate</h1>
            <p className="authLoginLead">
              Sign in to open the workspace.
            </p>
          </div>

          <article className="card formCard authCard authLoginCard" data-testid="auth-login-card">
            <div className="authLoginCardTop">
              <div className="authCardHeader authLoginCardHeader">
                <div>
                  <div className="eyebrow">Secure access</div>
                  <h2 data-testid="auth-login-title">Login</h2>
                  <p className="formHint">
                    Enter your username and password.
                  </p>
                </div>
                <div className="authCardBadge">Live app</div>
              </div>

              <form className="form" method="post" action="/login/submit" data-testid="auth-login-form">
                <label className="field">
                  <span>Username</span>
                  <input
                    name="username"
                    autoComplete="username"
                    defaultValue={username}
                    required
                    data-testid="auth-login-username-input"
                  />
                </label>

                <label className="field">
                  <span>Password</span>
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    data-testid="auth-login-password-input"
                  />
                </label>

                <div className="formActions authActions authLoginActions">
                  <button
                    type="submit"
                    className="landingButton primaryButton authPrimaryAction authLoginPrimaryAction"
                    data-testid="auth-login-submit-button"
                  >
                    Open workspace
                  </button>
                </div>
              </form>
            </div>

            <div className="authLoginDivider" aria-hidden="true">
              <span />
              <small>or</small>
              <span />
            </div>

            <form method="post" action="/login/demo" className="authDemoForm authLoginDemoForm">
              <button
                type="submit"
                className="linkButton authDemoAction authLoginDemoAction"
                data-testid="auth-demo-submit-button"
              >
                Open live demo
              </button>
              <p className="formHint">
                Fastest way to look around before creating an account.
              </p>
            </form>

            {error ? <div className="banner error" data-testid="auth-login-error-banner">{error}</div> : null}

            <div className="banner subtle authBanner" data-testid="auth-login-help-banner">
              If this is the first run with the default admin account, you will be asked to
              change the password after login.
            </div>

            {publicSignupEnabled ? (
              <div className="banner subtle authBanner" data-testid="auth-login-signup-banner">
                Need a trial account?{" "}
                <Link href="/register" className="inlineLink" data-testid="auth-login-register-link">
                  Create one here
                </Link>
                .
              </div>
            ) : null}

            <div className="authCardFooter authLoginFooter">
              <Link href="/" className="linkButton">
                Back to homepage
              </Link>
              <span className="authFooterNote">Quiet login, then straight into the product.</span>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
