import Link from "next/link";
const publicSignupEnabled =
  process.env.NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED === "1";

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const error = typeof params?.error === "string" ? params.error : "";
  const username = typeof params?.username === "string" ? params.username : "";

  return (
    <main className="page">
      <div className="container narrowContainer">
        <article className="card formCard" data-testid="auth-login-card">
          <h1 data-testid="auth-login-title">Login</h1>
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

            <div className="formActions">
              <button type="submit" data-testid="auth-login-submit-button">Login</button>
            </div>
          </form>

          {error ? <div className="banner error" data-testid="auth-login-error-banner">{error}</div> : null}
          <div className="banner subtle" data-testid="auth-login-help-banner">
            If this is the first run with the default admin account, you will be asked to
            change the password after login.
          </div>
          {publicSignupEnabled ? (
            <div className="banner subtle" data-testid="auth-login-signup-banner">
              New here?{" "}
              <Link href="/register" className="inlineLink" data-testid="auth-login-register-link">
                Create a trial account
              </Link>
              .
            </div>
          ) : null}
        </article>
      </div>
    </main>
  );
}
