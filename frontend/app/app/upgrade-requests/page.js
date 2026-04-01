"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

function formatDate(value) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

async function readJsonOrError(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const detail =
      payload && typeof payload.detail === "string"
        ? payload.detail
        : fallbackMessage;
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }

  return payload;
}

export default function UpgradeRequestsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);

  async function loadRequests() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/upgrade-requests`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await readJsonOrError(response, "Failed to load upgrade requests.");
      setRequests(Array.isArray(data) ? data : []);
      setAccessDenied(false);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.status === 401) {
        router.replace("/login");
        return;
      }
      if (requestError instanceof Error && requestError.status === 403) {
        setAccessDenied(true);
        setRequests([]);
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load upgrade requests.",
      );
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function checkAuthAndLoad() {
      try {
        const response = await fetch(`${apiBaseUrl}/auth/me`, {
          cache: "no-store",
          credentials: "include",
        });
        const data = await readJsonOrError(response, "Authentication failed.");
        setCurrentUser(data);
        setAuthChecked(true);

        if (!data.is_admin) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        await loadRequests();
      } catch {
        router.replace("/login");
      }
    }

    checkAuthAndLoad();
  }, [router]);

  if (!authChecked) {
    return (
      <main className="page">
        <div className="container">
          <div className="empty">Checking authentication...</div>
        </div>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="page">
        <div className="container narrowContainer">
          <article className="card formCard">
            <h1>Access denied</h1>
            <div className="banner error">
              This page is available only for the admin user.
            </div>
            <div className="formActions">
              <Link href="/app" className="linkButton">
                Back to app
              </Link>
            </div>
          </article>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <div className="header">
          <div>
            <h1>Upgrade Requests</h1>
            <p>{currentUser ? `Admin inbox · ${currentUser.username}` : "Admin inbox"}</p>
          </div>
          <div className="buttonRow">
            <Link href="/app" className="linkButton">
              Back
            </Link>
            <button type="button" onClick={loadRequests} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {error ? <div className="banner error">{error}</div> : null}

        {loading && requests.length === 0 ? (
          <div className="empty">Loading upgrade requests...</div>
        ) : null}

        {!loading && requests.length === 0 ? (
          <div className="empty">No upgrade requests yet.</div>
        ) : null}

        <div className="list">
          {requests.map((item) => (
            <article className="card compactCard" key={item.id}>
              <div className="row">
                <span className="label">Name</span>
                <span>{item.name || "-"}</span>
              </div>
              <div className="row">
                <span className="label">Email</span>
                <span>{item.email || "-"}</span>
              </div>
              <div className="row">
                <span className="label">Company / team</span>
                <span>{item.company_or_team || "-"}</span>
              </div>
              <div className="row">
                <span className="label">Use case</span>
                <span>{item.use_case || "-"}</span>
              </div>
              <div className="row">
                <span className="label">Current plan</span>
                <span>{item.current_plan || "-"}</span>
              </div>
              <div className="row">
                <span className="label">Created</span>
                <span>{formatDate(item.created_at)}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
