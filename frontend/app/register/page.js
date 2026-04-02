import Link from "next/link";

const publicSignupEnabled =
  process.env.NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED === "1";

export default async function RegisterPage({ searchParams }) {
  const params = await searchParams;
  const error = typeof params?.error === "string" ? params.error : "";
  const username = typeof params?.username === "string" ? params.username : "";

  if (!publicSignupEnabled) {
    return (
      <main className="page authPage">
        <div className="container authShell authShellSingle">
          <article className="card formCard authCard" data-testid="auth-register-card">
            <div className="authCardHeader">
              <div>
                <div className="eyebrow">Trial access</div>
                <h1 data-testid="auth-register-title">Create Trial Account</h1>
              </div>
            </div>
            <div className="banner subtle authBanner" data-testid="auth-register-disabled-banner">
              Public signup is not enabled in this environment.
            </div>
            <div className="formActions">
              <Link href="/login" className="linkButton" data-testid="auth-register-back-link">
                Back to login
              </Link>
            </div>
          </article>
        </div>
      </main>
    );
  }

  return (
    <main className="page authPage">
      <div className="container authShell">
        <section className="authMarketingPanel">
          <div className="eyebrow">Trial onboarding</div>
          <h1>Spin up a trial account and inspect the product from the inside.</h1>
          <p className="landingLead authLead">
            Public signup creates a safe `member` account on the `trial` plan so the
            live product can be explored without exposing the full admin surface.
          </p>

          <div className="authChecklist">
            <div className="authChecklistItem">
              <strong>Immediate app access</strong>
              <p>Land directly in the workspace after registration and review the product flow end to end.</p>
            </div>
            <div className="authChecklistItem">
              <strong>Controlled limits</strong>
              <p>Trial usage stays constrained while still communicating the shape of the product.</p>
            </div>
            <div className="authChecklistItem">
              <strong>B2B-first framing</strong>
              <p>The trial is meant to demonstrate a serious operations product, not a toy demo page.</p>
            </div>
          </div>
        </section>

        <article className="card formCard authCard" data-testid="auth-register-card">
          <div className="authCardHeader">
            <div>
              <div className="eyebrow">Create account</div>
              <h1 data-testid="auth-register-title">Create Trial Account</h1>
              <p className="formHint">
                Use a simple account name and get into the live workspace immediately.
              </p>
            </div>
            <div className="authCardBadge">Public trial</div>
          </div>

          <div className="banner subtle authBanner" data-testid="auth-register-help-banner">
            Public signup creates a `member` account on the `trial` plan so you can
            explore the product safely.
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
                Use 3-32 characters: letters, numbers, dots, dashes, or underscores.
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
              <span className="fieldHint">Use at least 8 characters.</span>
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

            <div className="formActions authActions">
              <button
                type="submit"
                className="landingButton primaryButton authPrimaryAction"
                data-testid="auth-register-submit-button"
              >
                Create account
              </button>
              <Link href="/login" className="linkButton" data-testid="auth-register-back-link">
                Back to login
              </Link>
            </div>
          </form>

          {error ? <div className="banner error" data-testid="auth-register-error-banner">{error}</div> : null}

          <div className="authCardFooter">
            <Link href="/" className="linkButton">
              Back to homepage
            </Link>
            <span className="authFooterNote">Trial accounts are scoped for safe product exploration.</span>
          </div>
        </article>
      </div>
    </main>
  );
}
