import Link from "next/link";

const defaultError = {
  invalid: "Wrong login or password.",
  missing: "Enter login and password first.",
  server: "Web Terminal auth is not configured on the server."
};

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const nextPath = typeof params?.next === "string" ? params.next : "/terminal";
  const errorCode = typeof params?.error === "string" ? params.error : "";
  const errorMessage = defaultError[errorCode] || "";

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Web Terminal</p>
        <h1>Sign in once</h1>
        <p>
          This is the new mobile-first terminal shell. After sign-in, the goal
          is one obvious path: reconnect and resume Codex work.
        </p>

        <form action="/login/submit" className="auth-form" method="post">
          <input name="next" type="hidden" value={nextPath} />
          <div className="field-block">
            <label htmlFor="username">Login</label>
            <input
              autoCapitalize="none"
              autoComplete="username"
              autoCorrect="off"
              id="username"
              name="username"
              placeholder="Enter login"
              required
              type="text"
            />
          </div>
          <div className="field-block">
            <label htmlFor="password">Terminal Password</label>
            <input
              autoCapitalize="none"
              autoComplete="current-password"
              autoCorrect="off"
              id="password"
              name="password"
              placeholder="Enter password"
              required
              type="password"
            />
          </div>

          <label className="remember-row" htmlFor="remember">
            <input defaultChecked id="remember" name="remember" type="checkbox" value="yes" />
            <span>Remember me on this iPhone</span>
          </label>

          {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}

          <button className="submit-button" type="submit">
            Open Console
          </button>
        </form>

        <p className="helper-note">
          This password protects the terminal entry. Codex auth stays separate
          inside the terminal session itself.
        </p>

        <p className="helper-note">
          <Link href="/">Back to project overview</Link>
        </p>
      </section>
    </main>
  );
}
