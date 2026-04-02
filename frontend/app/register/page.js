"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const publicSignupEnabled =
  process.env.NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED === "1";

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

export default function RegisterPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    username: "",
    password: "",
    confirm_password: "",
  });

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

    if (form.password !== form.confirm_password) {
      setError("Password and confirmation must match.");
      setSubmitting(false);
      return;
    }

    try {
      await readJsonOrError(
        await fetch(`${apiBaseUrl}/auth/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            username: form.username,
            password: form.password,
          }),
        }),
        "Failed to create account.",
      );
      router.replace("/app");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to create account.",
      );
    } finally {
      setSubmitting(false);
    }
  }

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

          <form className="form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Username</span>
              <input
                name="username"
                autoComplete="username"
                value={form.username}
                onChange={updateFormField}
                disabled={submitting}
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
                value={form.password}
                onChange={updateFormField}
                disabled={submitting}
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
                value={form.confirm_password}
                onChange={updateFormField}
                disabled={submitting}
                required
                minLength={8}
              />
            </label>

            <div className="formActions">
              <button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create account"}
              </button>
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
