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
        <article className="card formCard">
          <h1>Login</h1>
          <form className="form" method="post" action="/login/submit">
            <label className="field">
              <span>Username</span>
              <input
                name="username"
                autoComplete="username"
                defaultValue={username}
                required
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>

            <div className="formActions">
              <button type="submit">Login</button>
            </div>
          </form>

          {error ? <div className="banner error">{error}</div> : null}
          <div className="banner subtle">
            If this is the first run with the default admin account, you will be asked to
            change the password after login.
          </div>
          {publicSignupEnabled ? (
            <div className="banner subtle">
              New here?{" "}
              <Link href="/register" className="inlineLink">
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
