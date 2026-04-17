import Link from "next/link";

import { buildBusinessMailto, businessContactEmail } from "../lib/public-contact";

const businessPaths = [
  {
    label: "Internal Team",
    detail: "For teams deploying Docker services on company-owned infrastructure and moving from evaluation to explicit business use.",
  },
  {
    label: "Agency / Multi-client",
    detail: "For agencies, integrators, and outsourced teams supporting services on client-owned infrastructure.",
  },
  {
    label: "Custom / Redistribution",
    detail: "For SaaS embedding, managed service, resale, redistribution, or white-label use.",
  },
];

const requestChecklist = [
  "Company or project name",
  "Whether the infrastructure is company-owned, client-owned, or mixed",
  "Expected number of services, servers, or environments",
  "Whether you need support, customization, or redistribution rights",
];
const contactChannels = [
  {
    label: "Business email",
    value: businessContactEmail,
    href: buildBusinessMailto("DeployMate commercial license"),
  },
  {
    label: "Request form",
    value: "Use the in-product request flow",
    href: "/upgrade",
  },
  {
    label: "Project site",
    value: "https://deploymatecloud.ru",
    href: "https://deploymatecloud.ru",
  },
  {
    label: "GitHub owner profile",
    value: "https://github.com/AlexGerlitz",
    href: "https://github.com/AlexGerlitz",
  },
];

export default function CommercialLicensePage() {
  return (
    <main className="page authPage">
      <div className="container authShell authShellSingle">
        <section className="authMarketingPanel">
          <div className="eyebrow">Business path</div>
          <h1>Choose the right path for internal teams, agency delivery, or commercial redistribution.</h1>
          <p className="landingLead authLead">
            DeployMate stays open for public evaluation, but business use of the code still
            requires an explicit paid or commercial agreement. This page explains the buyer-facing
            paths before you start that conversation.
          </p>

          <div className="authChecklist">
            <div className="authChecklistItem">
              <strong>Evaluation stays self-serve</strong>
              <p>The live app and trial path stay available when you are still deciding whether the workflow fits your team or clients.</p>
            </div>
            <div className="authChecklistItem">
              <strong>Business use stays explicit</strong>
              <p>Internal company operations, client delivery, SaaS embedding, resale, and redistribution are handled through a paid or commercial path.</p>
            </div>
            <div className="authChecklistItem">
              <strong>The buyer path should feel clearer</strong>
              <p>We frame the conversation around infrastructure type, support model, and rights needed instead of sending everyone through the same vague review wording.</p>
            </div>
          </div>
        </section>

        <article className="card formCard authCard">
          <div className="authCardHeader">
            <div>
              <div className="eyebrow">Business use</div>
              <h1>Pick the path that matches how you support services</h1>
              <p className="formHint">
                Use the public product to evaluate. Use one of the paths below when DeployMate becomes part of real business operations.
              </p>
            </div>
            <div className="authCardBadge">Buyer-facing path</div>
          </div>

          <div className="overviewGrid">
            <article className="overviewCard">
              <span className="overviewLabel">Business paths</span>
              <div className="overviewMeta">
                {businessPaths.map((item) => (
                  <span key={item.label}>
                    <strong>{item.label}</strong>: {item.detail}
                  </span>
                ))}
              </div>
            </article>
            <article className="overviewCard">
              <span className="overviewLabel">What to include in the request</span>
              <div className="overviewMeta">
                {requestChecklist.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </article>
            <article className="overviewCard">
              <span className="overviewLabel">Contact channels</span>
              <div className="overviewMeta">
                {contactChannels.map((item) => (
                  <span key={item.label}>
                    {item.label}:{" "}
                    <a href={item.href} className="inlineLink" target={item.href.startsWith("http") ? "_blank" : undefined} rel={item.href.startsWith("http") ? "noreferrer" : undefined}>
                      {item.value}
                    </a>
                  </span>
                ))}
              </div>
            </article>
          </div>

          <div className="authDecisionRow">
            <div className="authDecisionCard">
              <strong>Running services for your own company?</strong>
              <p>Use the upgrade path to move from evaluation into an explicit Internal Team agreement instead of keeping business use implicit.</p>
            </div>
            <div className="authDecisionCard">
              <strong>Supporting client infrastructure?</strong>
              <p>The first wedge is the agency and integrator path: describe your delivery model, number of services, and what handoff/support shape you need.</p>
            </div>
          </div>

          <div className="authDecisionRow">
            <div className="authDecisionCard">
              <strong>What happens next?</strong>
              <p>After you submit the request, the next step is a short scope review: infrastructure type, deployment scale, support needs, and whether redistribution rights are required. The first reply usually comes within 2 business days.</p>
            </div>
            <div className="authDecisionCard">
              <strong>What to prepare</strong>
              <p>Have your company/project name, infrastructure model, estimated footprint, and any support or customization requirements ready before the conversation.</p>
            </div>
          </div>

          <div className="formActions authActions">
            <Link href="/upgrade" className="landingButton primaryButton authPrimaryAction">
              Start business path conversation
            </Link>
            <a
              href={buildBusinessMailto("DeployMate commercial license")}
              className="linkButton"
            >
              Email business use request
            </a>
            <a
              href="https://github.com/AlexGerlitz/deploymate/blob/main/COMMERCIAL-LICENSE.md"
              className="linkButton"
              target="_blank"
              rel="noreferrer"
            >
              Read full policy
            </a>
            <Link href="/login" className="linkButton">
              Open live product
            </Link>
          </div>

          <div className="authCardFooter">
            <Link href="/" className="linkButton">
              Back to homepage
            </Link>
            <span className="authFooterNote">Evaluation stays easy. Business use stays explicit.</span>
          </div>
        </article>
      </div>
    </main>
  );
}
