import Link from "next/link";

const publicSignupEnabled =
  process.env.NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED === "1";

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
              <div className="eyebrow">Live B2B product surface</div>
              <h1>Give small teams a deployment experience that actually feels like software.</h1>
              <p className="landingLead">
                DeployMate turns scattered VPS operations into a productized control
                surface: deployments, templates, server diagnostics, admin workflows,
                exports, backup dry-runs, and rollout visibility in one place.
              </p>

              <div className="landingHeroSummary">
                <div className="heroSummaryCard">
                  <span className="heroSummaryLabel">Best fit</span>
                  <strong>Agencies, SaaS teams, internal product ops</strong>
                </div>
                <div className="heroSummaryCard">
                  <span className="heroSummaryLabel">What it replaces</span>
                  <strong>Manual SSH routines, ad-hoc deploy notes, brittle handoffs</strong>
                </div>
              </div>

              <div className="buttonRow">
                <Link href="/login" className="landingButton primaryButton">
                  Open live product
                </Link>
                {publicSignupEnabled ? (
                  <Link href="/register" className="landingButton secondaryButton">
                    Create trial account
                  </Link>
                ) : (
                  <Link href="/upgrade" className="landingButton secondaryButton">
                    Start trial / Request access
                  </Link>
                )}
              </div>

              <div className="landingMetaRow">
                <span className="landingMetaBadge">Live app</span>
                <span className="landingMetaBadge">Admin workflows</span>
                <span className="landingMetaBadge">Export + audit tooling</span>
                <span className="landingMetaBadge">Release-safe delivery</span>
              </div>
            </div>

            <div className="landingShowcase">
              <article className="showcaseFrame">
                <div className="showcaseTopline">
                  <span className="showcaseChip">Operations overview</span>
                  <span className="showcaseLive">Live</span>
                </div>

                <div className="showcaseScoreboard">
                  <div className="showcaseMetric">
                    <span>Deployments</span>
                    <strong>03</strong>
                    <small>tracked from one dashboard</small>
                  </div>
                  <div className="showcaseMetric">
                    <span>Servers</span>
                    <strong>01</strong>
                    <small>diagnostics and suggested ports</small>
                  </div>
                  <div className="showcaseMetric">
                    <span>Admin surface</span>
                    <strong>Users + inbox</strong>
                    <small>saved views, exports, audit history</small>
                  </div>
                </div>

                <div className="showcasePanels">
                  <div className="showcasePanel">
                    <div className="showcasePanelHeader">
                      <strong>Runtime posture</strong>
                      <span className="status warn">remote-only</span>
                    </div>
                    <ul className="showcaseList">
                      <li>Backend and frontend capability boundaries aligned</li>
                      <li>Release checks and post-deploy smoke in place</li>
                      <li>Operator-first visibility into logs, health, and activity</li>
                    </ul>
                  </div>

                  <div className="showcasePanel">
                    <div className="showcasePanelHeader">
                      <strong>Admin workflows</strong>
                      <span className="status ok">ready</span>
                    </div>
                    <div className="showcaseTimeline">
                      <div>
                        <span className="timelineLabel">Users</span>
                        <p>Filter by role, plan, and password state. Save and share filtered views.</p>
                      </div>
                      <div>
                        <span className="timelineLabel">Upgrade inbox</span>
                        <p>Review requests, export snapshots, and keep an audit trail of admin actions.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              <div className="floatingProofCard floatingProofCardPrimary">
                <span>Designed to look product-grade in front of clients, founders, and internal teams.</span>
              </div>
              <div className="floatingProofCard floatingProofCardSecondary">
                <span>More than a brochure: login, app shell, admin surfaces, and release workflow already exist.</span>
              </div>
            </div>
          </div>

          <div className="landingGrid">
            <article className="landingCard landingCardAccent">
              <span className="cardKicker">Positioning</span>
              <h2>Built like a real software product, not a throwaway internal panel.</h2>
              <p>
                The value is not just deployment. It is the productization of operational
                work into a cleaner customer-facing and operator-facing experience.
              </p>
            </article>
            <article className="landingCard">
              <span className="cardKicker">For B2B teams</span>
              <h2>One place for deployments, templates, targets, and admin control.</h2>
              <p>
                Teams can onboard a server, launch services, inspect runtime state, and
                keep operational workflows visible instead of tribal.
              </p>
            </article>
            <article className="landingCard">
              <span className="cardKicker">For sales demos</span>
              <h2>Strong enough to show to stakeholders without explaining infrastructure first.</h2>
              <p>
                The interface leads with clarity, state, and workflow depth, so the product
                feels tangible before technical details even come up.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="landingSection" id="product">
        <div className="container">
          <div className="sectionIntro sectionIntroWide">
            <div className="eyebrow">What buyers notice</div>
            <h2>A surface that communicates control, clarity, and repeatability.</h2>
            <p className="sectionLead">
              The strongest B2B tools make operational work feel structured. DeployMate is
              built around that idea: visible state, understandable actions, and fewer
              hidden steps between “we should ship” and “it is live”.
            </p>
          </div>

          <div className="capabilityGrid">
            <article className="capabilityCard">
              <span className="capabilityLabel">Deployments</span>
              <h3>Launch, redeploy, inspect logs, health, and runtime details.</h3>
              <p>
                The deployment detail surface is designed for fast operational decisions,
                not just CRUD screens and status badges.
              </p>
            </article>
            <article className="capabilityCard">
              <span className="capabilityLabel">Templates</span>
              <h3>Turn repeated setup into reusable rollout presets.</h3>
              <p>
                Save common image, server, and port combinations once, then apply them
                back into the deploy flow or launch from preview.
              </p>
            </article>
            <article className="capabilityCard">
              <span className="capabilityLabel">Servers</span>
              <h3>Keep target hosts visible with diagnostics and suggested ports.</h3>
              <p>
                Instead of relying on shell knowledge alone, operators get a cleaner,
                safer way to validate deployment targets before rollout.
              </p>
            </article>
            <article className="capabilityCard">
              <span className="capabilityLabel">Admin operations</span>
              <h3>Saved views, exports, bulk actions, and audit-friendly workflows.</h3>
              <p>
                The admin side already feels like a serious internal product, not an
                afterthought hanging off the side of the main app.
              </p>
            </article>
            <article className="capabilityCard">
              <span className="capabilityLabel">Recovery</span>
              <h3>Backup bundles and restore dry-runs before real recovery paths.</h3>
              <p>
                That gives the product more gravity in front of teams that care about
                operational risk and future readiness.
              </p>
            </article>
            <article className="capabilityCard">
              <span className="capabilityLabel">Release discipline</span>
              <h3>Checks, smokes, and remote release flows already exist around the app.</h3>
              <p>
                The product is not only styled well. It is being treated like something
                that needs to survive real rollout and maintenance.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="landingSection">
        <div className="container">
          <div className="sectionIntro">
            <div className="eyebrow">Onboarding</div>
            <h2>From first target to managed rollout in three clear steps</h2>
          </div>
          <div className="stepsGrid">
            <article className="stepCard">
              <span className="stepNumber">1</span>
              <h3>Connect the target</h3>
              <p>Save the server once, verify access, and make the deployment target explicit.</p>
            </article>
            <article className="stepCard">
              <span className="stepNumber">2</span>
              <h3>Standardize the setup</h3>
              <p>Use templates, previews, and suggested ports to remove guesswork from repeat deploys.</p>
            </article>
            <article className="stepCard">
              <span className="stepNumber">3</span>
              <h3>Operate from one surface</h3>
              <p>Track runtime state, inspect issues, and keep admin actions and recovery tooling visible.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="landingSection darkBand">
        <div className="container">
          <div className="sectionIntro sectionIntroWide">
            <div className="eyebrow">Why it feels substantial</div>
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
              <p>Users can actually move through app states instead of clicking static mock content.</p>
            </article>
            <article className="proofCard">
              <strong>Operational credibility</strong>
              <p>The product exposes runtime, diagnostics, and recovery concepts in a business-friendly way.</p>
            </article>
            <article className="proofCard">
              <strong>Presentation value</strong>
              <p>Someone non-technical can still feel that the product is real because the UI has scope and structure.</p>
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
              <p>For evaluation, demos, and early operational validation.</p>
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
              <p>For teams that want a productized deploy and ops workflow without overbuilding infrastructure.</p>
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
              </ul>
              <Link href="/upgrade" className="landingButton secondaryButton">
                Talk to sales
              </Link>
            </article>
          </div>

          <div className="landingClosingCta">
            <div>
              <div className="eyebrow">Ready to explore</div>
              <h2>Open the product and judge it by the surface, not by promises.</h2>
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
