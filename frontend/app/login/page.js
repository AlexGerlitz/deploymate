import Link from "next/link";

const publicSignupEnabled =
  process.env.NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED === "1";
const reviewerChecklist = [
  {
    label: "01",
    title: "Open the live workspace first",
    detail:
      "Use demo access to land inside the product immediately, without needing account setup or verbal guidance.",
  },
  {
    label: "02",
    title: "Read runtime state before clicking around",
    detail:
      "Start with deployments, health, and the current priority signal so the product story is visible in one pass.",
  },
  {
    label: "03",
    title: "Then open admin review surfaces",
    detail:
      "Users and upgrade review show that the product goes beyond runtime CRUD into operational governance.",
  },
];

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const error = typeof params?.error === "string" ? params.error : "";
  const username = typeof params?.username === "string" ? params.username : "";

  return (
    <main className="page authPage">
      <div className="container authShell">
        <section className="authMarketingPanel">
          <div className="eyebrow">Operator entry</div>
          <h1>Log into the product, not just another admin form.</h1>
          <p className="landingLead authLead">
            DeployMate is positioned as a B2B control surface for teams that want visible
            operations, cleaner release workflows, and a product they can actually show.
          </p>

          <div className="authProofGrid">
            <article className="authProofCard">
              <span className="cardKicker">Runtime</span>
              <strong>Deployments, logs, health, diagnostics, and activity in one place.</strong>
            </article>
            <article className="authProofCard">
              <span className="cardKicker">Admin</span>
              <strong>Saved views, exports, bulk actions, backup dry-runs, and audit workflows.</strong>
            </article>
            <article className="authProofCard">
              <span className="cardKicker">Release</span>
              <strong>Smoke-tested rollout discipline around the product instead of manual guesswork.</strong>
            </article>
          </div>

          <div className="authChecklist" data-testid="auth-reviewer-checklist">
            {reviewerChecklist.map((item) => (
              <article key={item.label} className="authChecklistItem">
                <span className="cardKicker">Reviewer path {item.label}</span>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>

          <div className="authAsideNote">
            <span className="landingMetaBadge">Live app</span>
            <span className="landingMetaBadge">B2B product framing</span>
            <span className="landingMetaBadge">Operational visibility</span>
          </div>
        </section>

        <article className="card formCard authCard" data-testid="auth-login-card">
          <div className="authCardHeader">
            <div>
              <div className="eyebrow">Secure access</div>
              <h1 data-testid="auth-login-title">Login</h1>
              <p className="formHint">
                Enter your account to access the live workspace and admin surfaces.
              </p>
            </div>
            <div className="authCardBadge">Live product access</div>
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

            <div className="formActions authActions">
              <button
                type="submit"
                className="landingButton primaryButton authPrimaryAction"
                data-testid="auth-login-submit-button"
              >
                Open workspace
              </button>
            </div>
          </form>

          <form method="post" action="/login/demo" className="authDemoForm">
            <button
              type="submit"
              className="linkButton authDemoAction"
              data-testid="auth-demo-submit-button"
            >
              Explore live demo without registration
            </button>
            <p className="formHint">
              Opens the current demo workspace immediately, so a reviewer can see the product
              before creating an account.
            </p>
            <div className="authDemoGuide" data-testid="auth-demo-guide">
              <strong>What to open after demo login</strong>
              <div className="authDemoGuideList">
                <span>Workspace overview</span>
                <span>Deployment detail</span>
                <span>Users</span>
                <span>Upgrade inbox</span>
              </div>
            </div>
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

          <div className="authCardFooter">
            <Link href="/" className="linkButton">
              Back to homepage
            </Link>
            <span className="authFooterNote">Built for B2B demos, operator workflows, and admin visibility.</span>
          </div>
        </article>
      </div>
    </main>
  );
}
