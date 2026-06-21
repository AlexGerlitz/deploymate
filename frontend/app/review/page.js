import Link from "next/link";

export const metadata = {
  title: "DeployMate Review Console",
  description:
    "A stable reviewer entrypoint for DeployMate product routes, release evidence, and local review packet artifacts.",
};

const evidenceCards = [
  {
    key: "ci",
    label: "CI",
    title: "Code and release gates",
    detail:
      "The main CI run covers tests, production contract checks, and the release gate for the reviewed commit.",
    href: "https://github.com/AlexGerlitz/deploymate/actions/workflows/ci.yml?query=branch%3Adevelop",
  },
  {
    key: "public-evidence",
    label: "Evidence",
    title: "Public Evidence Bundle",
    detail:
      "Single artifact set with release status, incident state, repair workflow, and reviewer index.",
    href: "https://github.com/AlexGerlitz/deploymate/actions/workflows/public-evidence-bundle.yml?query=branch%3Adevelop",
  },
  {
    key: "maintenance",
    label: "Status",
    title: "Release maintenance",
    detail:
      "Scheduled/manual snapshot for release pauses, incidents, public target checks, and next operator action.",
    href: "https://github.com/AlexGerlitz/deploymate/actions/workflows/release-maintenance-status.yml?query=branch%3Adevelop",
  },
];

const reviewSequence = [
  {
    step: "01",
    title: "Confirm the reviewed commit",
    detail: "Open CI first and verify the checks are green for the commit under review.",
  },
  {
    step: "02",
    title: "Open the evidence bundle",
    detail: "Read the Markdown evidence report and the review index before judging live target state.",
  },
  {
    step: "03",
    title: "Walk the product routes",
    detail: "Use the live app surfaces for workspace, runtime detail, server review, admin, and requests.",
  },
  {
    step: "04",
    title: "Compare recovery posture",
    detail: "Check release maintenance, repair workflow, backup dry-run, and restore handoff coverage.",
  },
];

const productRoutes = [
  {
    href: "/login",
    title: "Access",
    detail: "Login and trial entry path.",
  },
  {
    href: "/app",
    title: "Workspace",
    detail: "Operations overview, release maintenance, exports, and next action.",
  },
  {
    href: "/app/deployment-workflow",
    title: "Deployments",
    detail: "Runtime queue, templates, deployment creation, and live review.",
  },
  {
    href: "/deployments/smoke-deployment",
    title: "Runtime detail",
    detail: "Health, logs, activity, handoff, and redeploy review.",
  },
  {
    href: "/app/server-review",
    title: "Server review",
    detail: "Saved targets, connectivity, diagnostics, and server passport.",
  },
  {
    href: "/app/users",
    title: "Admin recovery",
    detail: "Users, audit views, backup bundle, restore dry-run, and import review handoff.",
  },
];

const artifacts = [
  {
    name: "PROJECT_STATUS.md",
    detail: "Compact engineering status, current blockers, and verification commands.",
  },
  {
    name: "deploymate-public-evidence.md",
    detail: "Human-readable release and review report.",
  },
  {
    name: "deploymate-review-index.json",
    detail: "Machine-readable reviewer sequence and entrypoints.",
  },
  {
    name: "deploymate-public-evidence.json",
    detail: "Full structured evidence snapshot for dashboards and automation.",
  },
  {
    name: "MANIFEST.json",
    detail: "Local packet file sizes and SHA-256 checksums.",
  },
];

export default function ReviewPage() {
  return (
    <main className="landingPage reviewPage" data-testid="public-review-page">
      <section className="landingTopbar">
        <div className="container landingTopbarInner">
          <Link href="/" className="landingBrand">
            <span className="landingBrandMark">DM</span>
            <span className="landingBrandText">
              <strong>DeployMate</strong>
              <span className="landingBrandSub">Review console</span>
            </span>
          </Link>
          <div className="buttonRow">
            <Link href="/" className="landingButton ghostButton">
              Product
            </Link>
            <Link href="/login" className="landingButton secondaryButton">
              Open app
            </Link>
          </div>
        </div>
      </section>

      <section className="landingHero reviewHero">
        <div className="container landingShell">
          <div className="reviewHeroGrid">
            <div className="landingHeroCopy">
              <div className="eyebrow">Product and release evidence</div>
              <h1 data-testid="public-review-title">DeployMate Review Console</h1>
              <p className="landingLead">
                One stable entrypoint for reviewing the product surface, release checks,
                public evidence bundle, and local handoff artifacts.
              </p>

              <div className="buttonRow reviewHeroActions">
                <a
                  href="https://github.com/AlexGerlitz/deploymate/actions/workflows/public-evidence-bundle.yml?query=branch%3Adevelop"
                  className="landingButton primaryButton"
                >
                  Open evidence workflow
                </a>
                <Link href="/app" className="landingButton secondaryButton">
                  Open workspace
                </Link>
              </div>
            </div>

            <aside className="reviewStatusPanel" aria-label="Review status summary">
              <span className="heroSummaryLabel">Local packet command</span>
              <code data-testid="public-review-local-packet-command">
                python3 scripts/export_review_packet.py --output dist/review
              </code>
              <p>
                Generates the same reviewer packet locally when GitHub artifact
                download is unavailable.
              </p>
            </aside>
          </div>

          <div className="reviewSummaryGrid" data-testid="public-review-summary-grid">
            {evidenceCards.map((card) => (
              <a
                key={card.key}
                href={card.href}
                className="reviewSummaryCard"
                data-testid={`public-review-evidence-card-${card.key}`}
              >
                <span>{card.label}</span>
                <strong>{card.title}</strong>
                <p>{card.detail}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="landingSection reviewSection">
        <div className="container">
          <div className="sectionIntro sectionIntroWide">
            <div className="eyebrow">Review order</div>
            <h2>Check release evidence before the live target.</h2>
            <p className="sectionLead">
              The live deployment is treated as an operational dependency. The
              evidence bundle is the source of truth for CI state, release pause
              state, public target status, and repair workflow.
            </p>
          </div>

          <div className="reviewSequence" data-testid="public-review-sequence">
            {reviewSequence.map((item) => (
              <article key={item.step} className="reviewSequenceCard">
                <span>{item.step}</span>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landingSection reviewSection">
        <div className="container">
          <div className="sectionIntro sectionIntroWide">
            <div className="eyebrow">Product route map</div>
            <h2>Use these screens to inspect the actual product depth.</h2>
          </div>

          <div className="reviewRouteGrid" data-testid="public-review-product-routes">
            {productRoutes.map((route) => (
              <Link key={route.href} href={route.href} className="reviewRouteCard">
                <span>{route.href}</span>
                <strong>{route.title}</strong>
                <p>{route.detail}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="landingSection reviewSection">
        <div className="container">
          <div className="sectionIntro sectionIntroWide">
            <div className="eyebrow">Portable artifacts</div>
            <h2>Evidence can be reviewed without relying on a live server.</h2>
          </div>

          <div className="reviewArtifactGrid" data-testid="public-review-artifacts">
            {artifacts.map((artifact) => (
              <article key={artifact.name} className="reviewArtifactCard">
                <code>{artifact.name}</code>
                <p>{artifact.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
