import Link from "next/link";
import { buildBusinessMailto, businessContactEmail } from "../lib/public-contact";

const commercialUseCases = [
  "Internal company deployment operations",
  "Agency or client delivery",
  "Commercial SaaS or managed hosting",
  "Resale, redistribution, or white-label use",
];

const requestChecklist = [
  "Company or project name",
  "Whether use is internal, client-facing, SaaS, or resale",
  "Expected number of apps, servers, or environments",
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
          <div className="eyebrow">Commercial licensing</div>
          <h1>Use the product publicly for evaluation. Use the code commercially only with a separate license.</h1>
          <p className="landingLead authLead">
            DeployMate is source-available under a noncommercial public license. If you want to use
            the code in a business, paid service, internal company workflow, client project, or resale
            context, request a separate commercial license first.
          </p>

          <div className="authChecklist">
            <div className="authChecklistItem">
              <strong>Public evaluation stays easy</strong>
              <p>The live app, trial flow, and repository documentation remain available for product review.</p>
            </div>
            <div className="authChecklistItem">
              <strong>Commercial rights are explicit</strong>
              <p>Business use is not granted by the public license and must be handled through a separate agreement.</p>
            </div>
            <div className="authChecklistItem">
              <strong>The request path is already open</strong>
              <p>Use the request flow below to start a licensing conversation with enough context to evaluate scope.</p>
            </div>
          </div>
        </section>

        <article className="card formCard authCard">
          <div className="authCardHeader">
            <div>
              <div className="eyebrow">Business use</div>
              <h1>When you need a commercial license</h1>
              <p className="formHint">
                Request a commercial license before using DeployMate code for business operations, client delivery,
                paid hosting, redistribution, or resale.
              </p>
            </div>
            <div className="authCardBadge">Commercial path</div>
          </div>

          <div className="overviewGrid">
            <article className="overviewCard">
              <span className="overviewLabel">Typical use cases</span>
              <div className="overviewMeta">
                {commercialUseCases.map((item) => (
                  <span key={item}>{item}</span>
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
              <strong>Need commercial rights?</strong>
              <p>Go to the request page and describe your business use, deployment scale, and whether you need support or redistribution rights.</p>
            </div>
            <div className="authDecisionCard">
              <strong>Just evaluating the product?</strong>
              <p>You can keep using the live app, the public docs, and the trial flow without starting a licensing request.</p>
            </div>
          </div>

          <div className="authDecisionRow">
            <div className="authDecisionCard">
              <strong>What happens next?</strong>
              <p>After you submit the request, the next step is a short scope review: intended use, deployment scale, support needs, and whether redistribution rights are required. The first reply usually comes within 2 business days.</p>
            </div>
            <div className="authDecisionCard">
              <strong>What to prepare</strong>
              <p>Have your company/project name, commercial use case, estimated footprint, and any support or customization requirements ready before the conversation.</p>
            </div>
          </div>

          <div className="formActions authActions">
            <Link href="/upgrade" className="landingButton primaryButton authPrimaryAction">
              Request commercial license
            </Link>
            <a
              href={buildBusinessMailto("DeployMate commercial license")}
              className="linkButton"
            >
              Email licensing request
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
            <span className="authFooterNote">Commercial use is handled through explicit permission, not implied by public repository access.</span>
          </div>
        </article>
      </div>
    </main>
  );
}
