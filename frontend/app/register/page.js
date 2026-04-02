import Link from "next/link";
const publicSignupEnabled =
  process.env.NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED === "1";

export default async function RegisterPage({ searchParams }) {
  const params = await searchParams;
  const error = typeof params?.error === "string" ? params.error : "";
  const username = typeof params?.username === "string" ? params.username : "";

  if (!publicSignupEnabled) {
    return (
      <main className="page">
        <div className="container narrowContainer">
          <article className="card formCard">
            <h1>Create Trial Account</h1>
            <div className="banner subtle">
              Public signup is not enabled in this environment.
            </div>
            <div className="formActions">
              <Link href="/login" className="linkButton">
                Back to login
              </Link>
            </div>
          </article>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container narrowContainer">
        <article className="card formCard">
          <h1>Create Trial Account</h1>
          <div className="banner subtle">
            Public signup creates a `member` account on the `trial` plan so you can
            explore the product safely.
          </div>

          <form className="form" method="post" action="/register/submit">
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
              />
            </label>

            <div className="formActions">
              <button type="submit">Create account</button>
              <Link href="/login" className="linkButton">
                Back to login
              </Link>
            </div>
          </form>

          {error ? <div className="banner error">{error}</div> : null}
        </article>
      </div>
    </main>
  );
}
