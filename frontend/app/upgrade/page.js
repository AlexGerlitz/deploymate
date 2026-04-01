"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

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

const planCards = [
  {
    id: "trial",
    title: "Trial",
    price: "Free",
    features: ["Up to 1 server", "Up to 3 deployments", "Email onboarding"],
  },
  {
    id: "solo",
    title: "Solo",
    price: "$29/mo",
    features: ["Up to 3 servers", "Up to 15 deployments", "Priority setup help"],
  },
  {
    id: "team",
    title: "Team",
    price: "Custom",
    features: ["Up to 10 servers", "Up to 100 deployments", "Custom onboarding"],
  },
];

export default function UpgradePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    company_or_team: "",
    use_case: "",
  });

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await fetch(`${apiBaseUrl}/auth/me`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!response.ok) {
          return;
        }
        const data = await readJsonOrError(response, "Failed to load user.");
        setCurrentUser(data);
      } finally {
        setLoadingUser(false);
      }
    }

    loadUser();
  }, []);

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
    setSuccess("");

    try {
      await readJsonOrError(
        await fetch(`${apiBaseUrl}/upgrade-requests`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            ...form,
            current_plan: currentUser?.plan || null,
          }),
        }),
        "Failed to submit upgrade request.",
      );
      setSuccess("Request submitted. We will get back to you soon.");
      setForm({
        name: "",
        email: "",
        company_or_team: "",
        use_case: "",
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to submit upgrade request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <div className="container">
        <div className="header">
          <div>
            <h1>Upgrade DeployMate</h1>
            <p>
              {loadingUser
                ? "Loading plan..."
                : currentUser
                  ? `Current plan: ${currentUser.plan}`
                  : "Request trial or upgrade access"}
            </p>
          </div>
          <div className="buttonRow">
            <Link href={currentUser ? "/app" : "/"} className="linkButton">
              Back
            </Link>
            {!currentUser ? (
              <button type="button" onClick={() => router.push("/login")}>
                Login
              </button>
            ) : null}
          </div>
        </div>

        <article className="card formCard">
          <div className="sectionHeader">
            <h2>Plans</h2>
          </div>
          <div className="pricingGrid">
            {planCards.map((plan) => (
              <article
                key={plan.id}
                className={`pricingCard ${plan.id === "solo" ? "pricingCardFeatured" : ""}`}
              >
                {currentUser?.plan === plan.id ? (
                  <div className="pricingBadge">Current plan</div>
                ) : null}
                <h3>{plan.title}</h3>
                <div className="priceLine">{plan.price}</div>
                <ul className="featureList">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </article>

        {currentUser ? (
          <div className="banner">
            Current usage: Servers {currentUser.usage?.servers ?? 0}/
            {currentUser.limits?.max_servers ?? 0}
            {" · "}
            Deployments {currentUser.usage?.deployments ?? 0}/
            {currentUser.limits?.max_deployments ?? 0}
          </div>
        ) : null}

        <article className="card formCard">
          <div className="sectionHeader">
            <h2>Request upgrade</h2>
          </div>
          <form className="form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Name</span>
              <input
                name="name"
                value={form.name}
                onChange={updateFormField}
                disabled={submitting}
                required
              />
            </label>

            <label className="field">
              <span>Email</span>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={updateFormField}
                disabled={submitting}
                required
              />
            </label>

            <label className="field">
              <span>Company or team</span>
              <input
                name="company_or_team"
                value={form.company_or_team}
                onChange={updateFormField}
                disabled={submitting}
              />
            </label>

            <label className="field">
              <span>Use case</span>
              <textarea
                name="use_case"
                value={form.use_case}
                onChange={updateFormField}
                disabled={submitting}
                placeholder="What are you deploying, how many apps or servers do you need, and what plan are you interested in?"
              />
            </label>

            <div className="formActions">
              <button type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Request upgrade"}
              </button>
            </div>
          </form>

          {error ? <div className="banner error">{error}</div> : null}
          {success ? <div className="banner success">{success}</div> : null}
        </article>
      </div>
    </main>
  );
}
