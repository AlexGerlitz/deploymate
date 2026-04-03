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
const commercialUseCases = [
  "Internal company rollout tooling",
  "Client project or agency delivery",
  "Commercial SaaS or managed service",
  "Redistribution, white-label, or resale",
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
            <h1>Plans and commercial licensing</h1>
            <p>
              {loadingUser
                ? "Loading plan..."
                : currentUser
                  ? `Current plan: ${currentUser.plan}`
                  : "Request trial, team, or commercial-use access"}
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
            <p className="formHint">
              Trial and paid plans cover normal product access. Commercial use of the public codebase
              still requires a separate license.
            </p>
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

        <article className="card formCard onboardingCard">
          <div className="sectionHeader">
            <div>
              <h2>Commercial use policy</h2>
              <p className="formHint">
                DeployMate is source-available under a noncommercial public license. Business use,
                internal company use, client work, SaaS use, resale, and redistribution require a
                separate commercial license.
              </p>
            </div>
            <a
              href="https://github.com/AlexGerlitz/deploymate/blob/main/COMMERCIAL-LICENSE.md"
              className="linkButton"
              target="_blank"
              rel="noreferrer"
            >
              Read policy
            </a>
            <Link href="/commercial-license" className="linkButton">
              Commercial license page
            </Link>
          </div>

          <div className="overviewGrid">
            <article className="overviewCard">
              <span className="overviewLabel">Use the public license when</span>
              <div className="overviewMeta">
                <span>Personal evaluation or hobby use</span>
                <span>Research, learning, or noncommercial experimentation</span>
                <span>Educational or internal noncommercial review</span>
              </div>
            </article>
            <article className="overviewCard">
              <span className="overviewLabel">Request a commercial license when</span>
              <div className="overviewMeta">
                {commercialUseCases.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </article>
          </div>
        </article>

        <article className="card formCard">
          <div className="sectionHeader">
            <div>
              <h2>Request plan or commercial access</h2>
              <p className="formHint">
                Use this form for paid plans, team onboarding, or a separate commercial license request.
              </p>
            </div>
          </div>
          <div className="banner subtle">
            Prefer a direct explanation first? Start on{" "}
            <Link href="/commercial-license" className="inlineLink">
              the commercial licensing page
            </Link>
            {" "}for the policy, contact channels, and what happens next.
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
                placeholder="What are you deploying, how many apps or servers do you need, and are you asking for a paid plan or a commercial license?"
              />
            </label>

            <div className="formActions">
              <button type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Send request"}
              </button>
            </div>
          </form>

          {error ? <div className="banner error">{error}</div> : null}
          {success ? <div className="banner success">{success}</div> : null}
          {success ? (
            <div className="banner subtle">
              Next step: review scope, support needs, and whether your request is for a paid plan or a separate commercial license. If needed, you can also follow up through{" "}
              <a
                href="https://github.com/AlexGerlitz"
                className="inlineLink"
                target="_blank"
                rel="noreferrer"
              >
                the repository owner profile
              </a>
              .
            </div>
          ) : null}
        </article>
      </div>
    </main>
  );
}
