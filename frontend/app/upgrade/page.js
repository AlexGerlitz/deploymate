"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buildBusinessMailto, businessContactEmail } from "../lib/public-contact";

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

const packageCards = [
  {
    id: "internal-team",
    title: "Internal Team",
    price: "Paid workspace",
    detail: "For teams running Docker services on company-owned VPS, dedicated servers, or private cloud.",
    features: [
      "Path from evaluation to paid access",
      "Guided onboarding on self-owned infrastructure",
      "Deployment passport for readable runtime review",
      "Commercial use covered explicitly",
    ],
  },
  {
    id: "agency",
    title: "Agency / Multi-client",
    price: "Commercial package",
    detail: "For agencies, integrators, and outsourced teams supporting services on client-owned infrastructure.",
    features: [
      "Client infrastructure support path",
      "Packaging shaped around ongoing support and handoff",
      "Reusable handoff assets for repeat client delivery",
      "Conversation starts from delivery model, not from generic seat count",
    ],
  },
  {
    id: "custom",
    title: "Custom / Redistribution",
    price: "Separate agreement",
    detail: "For managed service, SaaS embedding, redistribution, resale, or white-label style use.",
    features: [
      "Redistribution and resale review",
      "Support and customization discussion",
      "Rights review anchored to the live product path",
      "Explicit commercial licensing path",
    ],
  },
];
const commercialUseCases = [
  "Internal company deployment operations",
  "Agency or client delivery on customer infrastructure",
  "Commercial SaaS or managed service",
  "Redistribution, white-label, or resale",
];
const buyerProofItems = [
  "Deployment passport keeps runtime identity, health proof, recent activity, and the next safe action in one block",
  "Templates now read as reusable handoff assets for repeat services, clients, or operator swaps",
  "The public business path already separates evaluation, internal-team use, agency delivery, and custom licensing",
];
const russianMaterials = [
  {
    label: "Russian install quickstart",
    detail: "Self-hosted setup on one VPS or dedicated host: env, known_hosts, compose up, and first live checks.",
    href: "https://github.com/AlexGerlitz/deploymate/blob/main/docs/ru-install-quickstart.md",
  },
  {
    label: "Russian operator quickstart",
    detail: "First operator path from server review to deployment passport and handoff in plain Russian.",
    href: "https://github.com/AlexGerlitz/deploymate/blob/main/docs/ru-operator-quickstart.md",
  },
  {
    label: "Russian pilot onboarding checklist",
    detail: "First-week commercial path: scope review, install, first deploy, handoff check, and support rhythm.",
    href: "https://github.com/AlexGerlitz/deploymate/blob/main/docs/ru-pilot-onboarding-checklist.md",
  },
  {
    label: "Russian design-partner demo packet",
    detail: "The 10-15 minute buyer path: public story, live product, deployment passport, handoff proof, and next pilot step.",
    href: "https://github.com/AlexGerlitz/deploymate/blob/main/docs/ru-design-partner-demo-packet.md",
  },
];
const pilotSupportMotion = [
  "Short scope review before the pilot becomes active delivery",
  "One concrete self-hosted install path",
  "One first deploy plus deployment-passport handoff check",
  "One explicit week-one support rhythm around review, health, and ownership",
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
            <h1>Packaging for teams running services on their own or client infrastructure</h1>
            <p>
              {loadingUser
                ? "Loading account state..."
                : currentUser
                  ? `Current account: ${currentUser.plan}. Use this page to move from evaluation into the paid or commercial path that matches your support model.`
                  : "Start with the live product or trial first, then use this page to move into the paid or commercial path that matches your team."}
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
            <h2>Business paths</h2>
            <p className="formHint">
              Trial stays the public evaluation entry point. This page is for the next step: internal team use, agency delivery, or custom commercial rights.
            </p>
          </div>
          <div className="banner subtle">
            We are framing packaging around the real buyer first: the team that supports Docker services on company-owned or client-owned infrastructure and needs a clearer deploy + handoff path.
          </div>
          <div className="pricingGrid">
            {packageCards.map((plan) => (
              <article
                key={plan.id}
                className={`pricingCard ${plan.id === "agency" ? "pricingCardFeatured" : ""}`}
              >
                {plan.id === "agency" ? <div className="pricingBadge">Primary wedge</div> : null}
                <h3>{plan.title}</h3>
                <div className="priceLine">{plan.price}</div>
                <p>{plan.detail}</p>
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
              <h2>How the path works</h2>
              <p className="formHint">
                The public product stays open for evaluation. Business use, internal company use, client work, SaaS use, resale, and redistribution still require an explicit paid or commercial agreement.
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
            <Link href="/habr" className="linkButton">
              Habr reader path
            </Link>
            <Link href="/commercial-license" className="linkButton">
              Commercial license page
            </Link>
          </div>

          <div className="overviewGrid">
            <article className="overviewCard">
              <span className="overviewLabel">Stay on the public path when</span>
              <div className="overviewMeta">
                <span>You are still evaluating the workflow</span>
                <span>You want to see whether the product fits your infrastructure model</span>
                <span>You are not yet using the code for business or client operations</span>
              </div>
            </article>
            <article className="overviewCard">
              <span className="overviewLabel">Move into a paid or commercial path when</span>
              <div className="overviewMeta">
                {commercialUseCases.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </article>
            <article className="overviewCard">
              <span className="overviewLabel">What is already real in the product</span>
              <div className="overviewMeta">
                {buyerProofItems.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </article>
            <article className="overviewCard">
              <span className="overviewLabel">Russian operator materials</span>
              <div className="overviewMeta">
                {russianMaterials.map((item) => (
                  <span key={item.label}>
                    <strong>{item.label}</strong>:{" "}
                    <a href={item.href} className="inlineLink" target="_blank" rel="noreferrer">
                      {item.detail}
                    </a>
                  </span>
                ))}
              </div>
            </article>
            <article className="overviewCard">
              <span className="overviewLabel">Pilot onboarding and support motion</span>
              <div className="overviewMeta">
                {pilotSupportMotion.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </article>
          </div>
        </article>

        <article className="card formCard">
          <div className="sectionHeader">
            <div>
              <h2>Start the access conversation</h2>
              <p className="formHint">
                Use this form after evaluation when you want the right business path for your internal team, agency workflow, or custom commercial use.
              </p>
            </div>
          </div>
          <div className="banner subtle">
            This is not instant checkout. We use the request to understand infrastructure type, number of services, support model, handoff expectations, and whether this should become a paid workspace or a separate commercial license.
          </div>
          <div className="banner subtle">
            Prefer the legal summary first? Start on{" "}
            <Link href="/commercial-license" className="inlineLink">
              the commercial licensing page
            </Link>
            {" "}for the policy, package framing, contact channels, and what happens next.
          </div>
          <div className="banner subtle">
            Prefer email? Write to{" "}
            <a
              href={buildBusinessMailto("DeployMate commercial license")}
              className="inlineLink"
            >
              {businessContactEmail}
            </a>
            . The first reply usually comes within 2 business days.
          </div>
          <div className="banner subtle">
            Need a Russian-first proof pack before the conversation? Start with the{" "}
            <a
              href="https://github.com/AlexGerlitz/deploymate/blob/main/docs/ru-install-quickstart.md"
              className="inlineLink"
              target="_blank"
              rel="noreferrer"
            >
              self-hosted install quickstart
            </a>
            {" "}and then open the{" "}
            <a
              href="https://github.com/AlexGerlitz/deploymate/blob/main/docs/ru-operator-quickstart.md"
              className="inlineLink"
              target="_blank"
              rel="noreferrer"
            >
              operator handoff quickstart
            </a>
            {" "}and then use the{" "}
            <a
              href="https://github.com/AlexGerlitz/deploymate/blob/main/docs/ru-pilot-onboarding-checklist.md"
              className="inlineLink"
              target="_blank"
              rel="noreferrer"
            >
              pilot onboarding checklist
            </a>
            {" "}and the{" "}
            <a
              href="https://github.com/AlexGerlitz/deploymate/blob/main/docs/ru-design-partner-demo-packet.md"
              className="inlineLink"
              target="_blank"
              rel="noreferrer"
            >
              design-partner demo packet
            </a>
            . If this request came from a Russian Habr article, keep the dedicated{" "}
            <Link href="/habr" className="inlineLink">
              Habr reader path
            </Link>
            {" "}as the main public entry instead of dropping people straight into the form.
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
                placeholder="Describe your infrastructure, how many services or servers you support, whether this is internal team use or client delivery, what runtime handoff shape you need, and what kind of commercial path you need."
              />
            </label>

            <div className="formActions">
              <button type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Start packaging conversation"}
              </button>
            </div>
          </form>

          {error ? <div className="banner error">{error}</div> : null}
          {success ? <div className="banner success">{success}</div> : null}
          {success ? (
            <div className="banner subtle">
              Next step: we review infrastructure scope, runtime handoff needs, support model, and whether this should become an internal-team path, an agency package, or a separate commercial license. If needed, you can also follow up through{" "}
              <a
                href={buildBusinessMailto("DeployMate commercial license follow-up")}
                className="inlineLink"
              >
                {businessContactEmail}
              </a>
              . The first reply usually comes within 2 business days.
            </div>
          ) : null}
        </article>
      </div>
    </main>
  );
}
