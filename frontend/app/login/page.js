"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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

export default function LoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    username: "",
    password: "",
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

    try {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const user = await readJsonOrError(response, "Failed to log in.");
      router.replace(user.must_change_password ? "/change-password" : "/app");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to log in.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <div className="container narrowContainer">
        <article className="card formCard">
          <h1>Login</h1>
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
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={updateFormField}
                disabled={submitting}
                required
              />
            </label>

            <div className="formActions">
              <button type="submit" disabled={submitting}>
                {submitting ? "Logging in..." : "Login"}
              </button>
            </div>
          </form>

          {error ? <div className="banner error">{error}</div> : null}
          <div className="banner subtle">
            If this is the first run with the default admin account, you will be asked to
            change the password after login.
          </div>
        </article>
      </div>
    </main>
  );
}
