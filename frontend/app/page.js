import Link from "next/link";

const publicSignupEnabled =
  process.env.NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED === "1";
const landingOperatingPrinciples = [
  {
    label: "See the state",
    title: "One screen should show what is live, what needs attention, and what to do next.",
  },
  {
    label: "Move with confidence",
    title: "Guided deploy and review paths reduce guesswork without hiding the deeper tools.",
  },
  {
    label: "Keep the whole workflow visible",
    title: "Runtime, admin review, exports, diagnostics, and recovery stay in the same product.",
  },
];
const landingProofPoints = [
  "A live workspace with real deployment, server, and activity surfaces",
  "Templates, diagnostics, team access, and upgrade review in the same app",
  "Recovery prep and release checks around the product, not outside it",
];
const landingQuickWins = [
  {
    label: "Understand the current state",
    title: "Open the workspace and immediately see live services, recent issues, and the next recommended action.",
  },
  {
    label: "Ship without loose shell rituals",
    title: "Use saved targets, templates, diagnostics, and guided deploy forms instead of remembering every step manually.",
  },
  {
    label: "Review team and customer operations",
    title: "Handle user access, upgrade requests, exports, and recovery prep from the same product surface.",
  },
];
const landingAudienceCards = [
  {
    label: "For small product teams",
    title: "A clearer control surface for the apps you already ship.",
    detail:
      "DeployMate is for teams that want less operational drift and fewer hidden steps between “ready to ship” and “it is live”.",
  },
  {
    label: "For founders and reviewers",
    title: "Easy to understand without a long technical walkthrough.",
    detail:
      "The first pass already shows a real product: live app, deployment views, admin workflows, and release discipline.",
  },
  {
    label: "For operators",
    title: "Still deep enough when you need diagnostics, exports, and recovery prep.",
    detail:
      "The product stays approachable first, then opens into the deeper operational surfaces only when you need them.",
  },
];

export default function LandingPage() {
  return (
    <main className="landingPage">
      <section className="landingTopbar">
        <div className="container landingTopbarInner">
          <Link href="/" className="landingBrand">
            <span className="landingBrandMark">DM</span>
            <span className="landingBrandText">
              <strong>DeployMate</strong>
              <span className="landingBrandSub">B2B deployment control</span>
            </span>
          </Link>
          <div className="buttonRow">
            <a href="#product" className="landingButton ghostButton">
              Product
            </a>
            <a href="#pricing" className="landingButton ghostButton">
              Pricing
            </a>
            <Link href="/login" className="landingButton secondaryButton">
              Login
            </Link>
          </div>
        </div>
      </section>

      <section className="landingHero">
        <div className="container landingShell">
          <div className="landingHeroGrid">
            <div className="landingHeroCopy">
              <div className="eyebrow">Live product for small teams</div>
              <h1>A simpler way to launch, monitor, and review Docker apps without living in the terminal.</h1>
              <p className="landingLead">
                DeployMate gives small teams one place to deploy services, see what is
                healthy, review what needs attention, and handle team/admin follow-up
                without bouncing between shell commands, notes, and separate internal tools.
              </p>

              <div className="landingHeroSummary">
                <div className="heroSummaryCard">
                  <span className="heroSummaryLabel">What it does</span>
                  <strong>Turns deployment, monitoring, and review work into one readable product surface</strong>
                </div>
                <div className="heroSummaryCard">
                  <span className="heroSummaryLabel">What it removes</span>
                  <strong>Scattered shell steps, unclear ownership, and “where do I look first?” operational drift</strong>
                </div>
              </div>

              <div className="landingPathGrid">
                <article className="landingPathCard">
                  <span className="heroSummaryLabel">In the first minute</span>
                  <strong>See what is running, what is broken, and what the next action should be.</strong>
                  <p>The workspace is built to answer the basic “what is going on?” question before anything else.</p>
                </article>
                <article className="landingPathCard">
                  <span className="heroSummaryLabel">Then go deeper</span>
                  <strong>Deploy again, inspect details, and review team/admin work without changing tools.</strong>
                  <p>Templates, diagnostics, access review, exports, and recovery prep all stay inside the same app.</p>
                </article>
              </div>

              <div className="buttonRow">
                <Link href="/login" className="landingButton primaryButton">
                  Open live product
                </Link>
                {publicSignupEnabled ? (
                  <Link href="/register" className="landingButton secondaryButton landingSecondaryCta">
                    Create trial account
                  </Link>
                ) : (
                  <Link href="/upgrade" className="landingButton secondaryButton landingSecondaryCta">
                    Start trial / Request access
                  </Link>
                )}
              </div>

              <div className="landingHeroNote" data-testid="landing-hero-note">
                <strong>Best first pass:</strong> open the live product, read the workspace, then inspect one deployment detail and one admin screen.
              </div>

              <div className="landingMetaRow">
                <span className="landingMetaBadge">Live app</span>
                <span className="landingMetaBadge">Public trial</span>
                <span className="landingMetaBadge">Guided workspace</span>
                <span className="landingMetaBadge">Admin review flows</span>
                <span className="landingMetaBadge">Runtime visibility</span>
              </div>

              <div className="landingSignalRail" data-testid="landing-signal-rail">
                {landingOperatingPrinciples.map((item) => (
                  <article key={item.label} className="landingSignalCard">
                    <span>{item.label}</span>
                    <strong>{item.title}</strong>
                  </article>
                ))}
              </div>
            </div>

            <div className="landingShowcase">
              <article className="showcaseFrame">
                <div className="showcaseTopline">
                  <span className="showcaseChip">Product preview</span>
                  <span className="showcaseLive">Live</span>
                </div>
                <div className="showcaseQuickTake">
                  <strong>What you should notice first</strong>
                  <p>The app leads with current state, not setup complexity. You can understand the product before you understand its internals.</p>
                </div>

                <div className="showcaseScoreboard">
                  <div className="showcaseMetric">
                    <span>First look</span>
                    <strong>Current state first</strong>
                    <small>the workspace leads with live counts, priority, and the next obvious move</small>
                  </div>
                  <div className="showcaseMetric">
                    <span>Deployments</span>
                    <strong>Health + details</strong>
                    <small>status, endpoints, logs, diagnostics, and activity stay together</small>
                  </div>
                  <div className="showcaseMetric">
                    <span>Admin</span>
                    <strong>Access + requests</strong>
                    <small>saved views, exports, audit trails, and review work feel productized</small>
                  </div>
                </div>

                <div className="showcasePanels">
                  <div className="showcasePanel">
                    <div className="showcasePanelHeader">
                      <strong>What the interface optimizes for</strong>
                      <span className="status ok">clarity</span>
                    </div>
                    <ul className="showcaseList">
                      <li>One obvious next action on each important screen</li>
                      <li>Important state is visible before deeper tooling</li>
                      <li>Runtime and admin work stay in the same mental model</li>
                    </ul>
                  </div>

                  <div className="showcasePanel">
                    <div className="showcasePanelHeader">
                      <strong>What makes it feel substantial</strong>
                      <span className="status ok">ready</span>
                    </div>
                    <div className="showcaseTimeline">
                      <div>
                        <span className="timelineLabel">Real product flow</span>
                        <p>Login, workspace, deployment detail, admin review, and release-aware surfaces are already live.</p>
                      </div>
                      <div>
                        <span className="timelineLabel">Operational depth</span>
                        <p>Templates, diagnostics, exports, recovery prep, and audit views make the product feel substantial.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="showcaseCommandDeck">
                  <div className="showcaseCommandHeader">
                    <div>
                      <span className="heroSummaryLabel">Operating posture</span>
                      <strong>Built to read like a real product, not a loose collection of internal tools.</strong>
                    </div>
                    <span className="showcaseCommandStatus">Surface ready</span>
                  </div>
                  <div className="showcaseCommandList">
                    {landingProofPoints.map((item) => (
                      <div key={item} className="showcaseCommandItem">
                        <span className="showcaseCommandDot" aria-hidden="true" />
                        <p>{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </article>

              <div className="floatingProofCard floatingProofCardPrimary">
                <span>Designed to make sense to a founder, reviewer, or operator without a long explanation first.</span>
              </div>
              <div className="floatingProofCard floatingProofCardSecondary">
                <span>More than a brochure: the login flow, app shell, admin surfaces, and release workflow already exist.</span>
              </div>
            </div>
          </div>

          <div className="landingGrid">
            <article className="landingCard landingCardAccent">
              <span className="cardKicker">What you notice first</span>
              <h2>It answers “what is happening?” before it asks you to learn the tool.</h2>
              <p>
                The value is not only that something can deploy. The value is that
                deployment and review work become easier to understand, easier to repeat,
                and easier to hand off.
              </p>
            </article>
            <article className="landingCard">
              <span className="cardKicker">Who it is for</span>
              <h2>Small teams that want product-grade deployment tooling without platform sprawl.</h2>
              <p>
                Teams can onboard a target, launch services, inspect runtime state, and
                keep access/review workflows explicit instead of tribal.
              </p>
            </article>
            <article className="landingCard">
              <span className="cardKicker">Why it demos well</span>
              <h2>Strong enough to show before you explain architecture, ops policy, or release mechanics.</h2>
              <p>
                The interface leads with visible state and clear actions, so the product
                feels tangible before deeper technical context enters the conversation.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="landingSection">
        <div className="container">
          <div className="sectionIntro sectionIntroWide">
            <div className="eyebrow">What you understand quickly</div>
            <h2>Three practical outcomes, visible on the first pass.</h2>
            <p className="sectionLead">
              This is the shortest way to understand what the product is trying to improve
              for a real team.
            </p>
          </div>

          <div className="proofGrid">
            {landingQuickWins.map((item) => (
              <article key={item.label} className="proofCard">
                <strong>{item.label}</strong>
                <p>{item.title}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landingSection" id="product">
        <div className="container">
          <div className="sectionIntro sectionIntroWide">
            <div className="eyebrow">What the product covers</div>
            <h2>A calmer interface for deploy, review, and recovery work.</h2>
            <p className="sectionLead">
              The strongest tools reduce cognitive noise. DeployMate is built around that
              idea: visible state, understandable actions, and fewer hidden steps between
              “we should ship” and “it is live”.
            </p>
          </div>

          <div className="capabilityGrid">
            <article className="capabilityCard">
              <span className="capabilityLabel">Deployments</span>
              <h3>Launch, redeploy, inspect logs, health, and the details behind each service.</h3>
              <p>
                The deployment detail surface is designed to help someone make a decision,
                not just confirm that a record exists.
              </p>
            </article>
            <article className="capabilityCard">
              <span className="capabilityLabel">Templates</span>
              <h3>Turn repeated setup into reusable deploy presets.</h3>
              <p>
                Save common image, server, and port combinations once, then apply them
                back into the deploy flow or launch straight from preview.
              </p>
            </article>
            <article className="capabilityCard">
              <span className="capabilityLabel">Servers</span>
              <h3>Keep target hosts visible with diagnostics, connection tests, and suggested ports.</h3>
              <p>
                Instead of relying on shell knowledge alone, teams get a cleaner way to
                validate targets before deploying to them.
              </p>
            </article>
            <article className="capabilityCard">
              <span className="capabilityLabel">Admin review</span>
              <h3>Saved views, exports, bulk actions, and audit-friendly review workflows.</h3>
              <p>
                Team access and upgrade demand stay in the same product instead of becoming
                side spreadsheets or ad-hoc internal routines.
              </p>
            </article>
            <article className="capabilityCard">
              <span className="capabilityLabel">Recovery</span>
              <h3>Backup bundles and restore dry-runs before any destructive recovery path.</h3>
              <p>
                That gives the product more weight for teams that care about operational
                risk, auditability, and future readiness.
              </p>
            </article>
            <article className="capabilityCard">
              <span className="capabilityLabel">Release discipline</span>
              <h3>Checks, smoke tests, and remote release flows already exist around the app.</h3>
              <p>
                The product is not only presented well. It is being treated like something
                that needs to survive real rollout and maintenance.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="landingSection">
        <div className="container">
          <div className="sectionIntro">
            <div className="eyebrow">Simple first-run model</div>
            <h2>From first target to managed deployment in three clear steps</h2>
          </div>
          <div className="stepsGrid">
            <article className="stepCard">
              <span className="stepNumber">1</span>
              <h3>Connect the target</h3>
              <p>Save the server once, verify access, and make the deployment destination explicit.</p>
            </article>
            <article className="stepCard">
              <span className="stepNumber">2</span>
              <h3>Standardize the setup</h3>
              <p>Use templates, previews, and suggested ports to remove guesswork from repeat deploys.</p>
            </article>
            <article className="stepCard">
              <span className="stepNumber">3</span>
              <h3>Operate from one place</h3>
              <p>Track runtime state, inspect issues, and keep admin/recovery tooling visible in the same app.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="landingSection">
        <div className="container">
          <div className="sectionIntro">
            <div className="eyebrow">Who the first pass is for</div>
            <h2>Clear enough for non-technical reviewers, still useful for operators.</h2>
          </div>
          <div className="capabilityGrid">
            {landingAudienceCards.map((item) => (
              <article key={item.label} className="capabilityCard">
                <span className="capabilityLabel">{item.label}</span>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landingSection darkBand">
        <div className="container">
          <div className="sectionIntro sectionIntroWide">
            <div className="eyebrow">Why it feels real</div>
            <h2>It is not a brochure site pretending to be software.</h2>
            <p className="sectionLead">
              There is a real login flow, a real application shell, richer admin surfaces,
              export and audit tooling, recovery preparation, and release rigor around the product.
              That is what gives the interface weight.
            </p>
          </div>

          <div className="proofGrid">
            <article className="proofCard">
              <strong>Visible workflows</strong>
              <p>People can actually move through app states instead of clicking through static mock content.</p>
            </article>
            <article className="proofCard">
              <strong>Operational credibility</strong>
              <p>The product exposes runtime, diagnostics, and recovery concepts in a way that still feels readable.</p>
            </article>
            <article className="proofCard">
              <strong>Presentation value</strong>
              <p>Someone non-technical can still feel that the product is real because the UI has scope, order, and a clear path.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="landingSection pricingSection" id="pricing">
        <div className="container">
          <div className="sectionIntro">
            <div className="eyebrow">Pricing</div>
            <h2>Simple packaging for first customers</h2>
          </div>

          <div className="pricingGrid">
            <article className="pricingCard">
              <h3>Trial</h3>
              <div className="priceLine">Free</div>
              <p>For evaluation, demos, and first-pass validation of the product.</p>
              <ul className="featureList">
                <li>Up to 1 server</li>
                <li>Up to 3 deployments</li>
                <li>Core admin surface</li>
                <li>Backup dry-run preview</li>
              </ul>
              {publicSignupEnabled ? (
                <Link href="/register" className="landingButton secondaryButton">
                  Create account
                </Link>
              ) : (
                <Link href="/upgrade" className="landingButton secondaryButton">
                  Request access
                </Link>
              )}
            </article>

            <article className="pricingCard pricingCardFeatured">
              <div className="pricingBadge">Most practical</div>
              <h3>Solo</h3>
              <div className="priceLine">$29/mo</div>
              <p>For teams that want a simpler deploy-and-review workflow without overbuilding infrastructure.</p>
              <ul className="featureList">
                <li>Up to 3 servers</li>
                <li>Up to 15 deployments</li>
                <li>Admin saved views and exports</li>
                <li>Operational visibility surfaces</li>
              </ul>
              {publicSignupEnabled ? (
                <Link href="/register" className="landingButton primaryButton">
                  Start free trial
                </Link>
              ) : (
                <Link href="/upgrade" className="landingButton primaryButton">
                  Start trial
                </Link>
              )}
            </article>

            <article className="pricingCard">
              <h3>Team</h3>
              <div className="priceLine">Custom</div>
              <p>For agencies and product teams managing multiple apps, environments, and internal operators.</p>
              <ul className="featureList">
                <li>Up to 10 servers</li>
                <li>Up to 100 deployments</li>
                <li>Workflow tuning for internal teams</li>
                <li>Custom onboarding</li>
                <li>Commercial licensing path</li>
              </ul>
              <Link href="/upgrade" className="landingButton secondaryButton">
                Talk to sales / licensing
              </Link>
              <Link href="/commercial-license" className="linkButton">
                Commercial license info
              </Link>
            </article>
          </div>

          <div className="landingClosingCta">
            <div>
              <div className="eyebrow">Ready to explore</div>
              <h2>Open the product and decide quickly whether the workflow feels clearer.</h2>
              <p className="sectionLead">
                The fastest route is login, workspace, one deployment detail, then one admin review surface.
              </p>
            </div>
            <div className="buttonRow">
              <Link href="/login" className="landingButton primaryButton">
                View live app
              </Link>
              {publicSignupEnabled ? (
                <Link href="/register" className="landingButton secondaryButton">
                  Start trial
                </Link>
              ) : (
                <Link href="/upgrade" className="landingButton secondaryButton">
                  Request access
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
