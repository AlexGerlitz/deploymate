import Link from "next/link";

import TrackedLink from "./tracked-link";
import { FUNNEL_EVENT_NAMES } from "./lib/funnel-telemetry";

const publicSignupEnabled =
  process.env.NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED === "1";
const landingOperatingPrinciples = [
  {
    label: "Own the infra",
    title: "Deploy on infrastructure your team or client already owns instead of reshaping the whole stack around a platform vendor.",
  },
  {
    label: "Keep the handoff visible",
    title: "The next operator should understand what is live, what changed, and what to do next without a shell handoff ritual.",
  },
  {
    label: "Stay out of Kubernetes",
    title: "The core path stays centered on Docker services, clear runtime review, and safe next actions without platform sprawl.",
  },
];
const landingProofPoints = [
  "A live app already connects server review, guided deploy flow, reusable handoff assets, and runtime detail",
  "Deployment detail already leads with a deployment passport: runtime identity, health proof, recent activity, and the next safe action",
  "Commercial path and onboarding already exist without pretending the product is a generic cloud platform",
];
const landingQuickWins = [
  {
    label: "Bring one server under control",
    title: "Save the target once, verify access, and keep the deployment destination explicit instead of tribal.",
  },
  {
    label: "Deploy without SSH folklore",
    title: "Use guided deploy flow, saved targets, and runtime review instead of rebuilding the rollout process from notes and shell history.",
  },
  {
    label: "Hand off the next action",
    title: "Keep the next safe step visible so another operator can pick up the service without a long verbal walkthrough.",
  },
];
const landingAudienceCards = [
  {
    label: "For agencies and integrators",
    title: "A clearer control layer for services running on client-owned infrastructure.",
    detail:
      "DeployMate is being shaped for ongoing-support teams that need repeatable deploy and handoff without becoming a Kubernetes team for every client.",
  },
  {
    label: "For internal product teams",
    title: "Still useful when your own team runs Docker services on its own VPS or private cloud.",
    detail:
      "The same path works when the infrastructure is yours: connect a server, deploy a service, review runtime state, and keep the next action obvious.",
  },
  {
    label: "For operator handoff",
    title: "Readable enough for the next engineer, not only the one who shipped it.",
    detail:
      "The runtime story is being pushed toward state, health, and next-step clarity before deeper admin and recovery tooling takes over the screen.",
  },
];
const landingBuyerProofCards = [
  {
    label: "Deployment passport",
    title: "One readable runtime handoff block instead of scattered status hunting.",
    detail:
      "The product already groups runtime identity, health proof, recent activity, and the next safe action so a fresh rollout can be reviewed without reconstructing context from chat or shell history.",
  },
  {
    label: "Reusable handoff assets",
    title: "Templates are framed as reusable delivery assets, not loose presets.",
    detail:
      "A repeatable setup can be saved with image, ports, env vars, and server selection so client or team handoffs start from a known shape instead of tribal memory.",
  },
  {
    label: "Business path",
    title: "The buyer conversation already starts from infrastructure and support model.",
    detail:
      "Evaluation, internal-team use, agency delivery, and custom commercial paths are already separated so packaging can match the real delivery model.",
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
              <span className="landingBrandSub">Client infra deploy clarity</span>
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
              <div className="eyebrow">Client infrastructure, minus SSH chaos</div>
              <h1>Deploy Docker services on client-owned or self-owned infrastructure without Kubernetes overhead or shell folklore.</h1>
              <p className="landingLead">
                DeployMate is being shaped for agencies, integrators, and small teams that
                need one readable path to connect a server, deploy a service, see what is
                healthy, and hand the next step to another operator without bouncing
                between shell commands, notes, and ad-hoc internal rituals.
              </p>

              <div className="landingHeroSummary">
                <div className="heroSummaryCard">
                  <span className="heroSummaryLabel">What it does</span>
                  <strong>Turns deploy, runtime review, and handoff into one readable product surface</strong>
                </div>
                <div className="heroSummaryCard">
                  <span className="heroSummaryLabel">What it removes</span>
                  <strong>Provider lock-in pressure, scattered shell steps, and “who knows this service?” operational drift</strong>
                </div>
              </div>

              <div className="landingPathGrid">
                <article className="landingPathCard">
                  <span className="heroSummaryLabel">The first deploy path</span>
                  <strong>Connect one server, choose what to run, and make the destination explicit.</strong>
                  <p>The first pass is meant to feel like one clear story instead of a toolbox that assumes an operator already knows the system.</p>
                </article>
                <article className="landingPathCard">
                  <span className="heroSummaryLabel">Then keep the runtime readable</span>
                  <strong>Open the deployment passport, review what is healthy, and understand the next safe action without reconstructing context from shell notes.</strong>
                  <p>Reusable handoff assets, diagnostics, activity, and the commercial path stay inside the same product, but they stop competing with the main deploy story on first pass.</p>
                </article>
              </div>

              <div className="buttonRow">
                <TrackedLink
                  href="/login"
                  className="landingButton primaryButton"
                  eventName={FUNNEL_EVENT_NAMES.LANDING_CTA}
                  eventProps={{ surface: "hero", cta: "open_live_product" }}
                >
                  Open live product
                </TrackedLink>
                {publicSignupEnabled ? (
                  <TrackedLink
                    href="/register"
                    className="landingButton secondaryButton landingSecondaryCta"
                    eventName={FUNNEL_EVENT_NAMES.LANDING_CTA}
                    eventProps={{ surface: "hero", cta: "start_evaluation" }}
                  >
                    Start evaluation
                  </TrackedLink>
                ) : (
                  <TrackedLink
                    href="/upgrade"
                    className="landingButton secondaryButton landingSecondaryCta"
                    eventName={FUNNEL_EVENT_NAMES.LANDING_CTA}
                    eventProps={{ surface: "hero", cta: "request_access" }}
                  >
                    Start evaluation / Request access
                  </TrackedLink>
                )}
              </div>

              <div className="landingHeroNote" data-testid="landing-hero-note">
                <strong>Best first pass:</strong> connect one server, deploy one service, then open runtime detail and decide whether the next step is finally obvious.
              </div>

              <div className="landingMetaRow">
                <span className="landingMetaBadge">Live app</span>
                <span className="landingMetaBadge">Client-owned infra</span>
                <span className="landingMetaBadge">Provider-agnostic</span>
                <span className="landingMetaBadge">Guided deploy path</span>
                <span className="landingMetaBadge">Deployment passport</span>
                <span className="landingMetaBadge">Runtime handoff</span>
                <span className="landingMetaBadge">Public evaluation</span>
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
                  <p>The app leads with current state and next action, not with infrastructure trivia. You should understand why it exists before you understand its internals.</p>
                </div>

                <div className="showcaseScoreboard">
                  <div className="showcaseMetric">
                    <span>First look</span>
                    <strong>Server to runtime story</strong>
                    <small>the workspace leads with connection, deploy, and review instead of a flat toolbox</small>
                  </div>
                  <div className="showcaseMetric">
                    <span>Deployments</span>
                    <strong>Health + next action</strong>
                    <small>status, endpoints, diagnostics, activity, and safer runtime review stay together</small>
                  </div>
                  <div className="showcaseMetric">
                    <span>Commercial path</span>
                    <strong>Evaluation to business use</strong>
                    <small>trial, team packaging, and commercial access already have explicit paths</small>
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
                      <li>Client-owned and self-owned infrastructure stay explicit</li>
                      <li>Runtime review is readable before deeper tooling opens</li>
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
                        <p>Login, workspace, server review, deployment workflow, and runtime detail are already live.</p>
                      </div>
                      <div>
                        <span className="timelineLabel">Operational depth</span>
                        <p>Templates, diagnostics, release discipline, and packaging path already make the product feel like more than a demo shell.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="showcaseCommandDeck">
                  <div className="showcaseCommandHeader">
                    <div>
                      <span className="heroSummaryLabel">Operating posture</span>
                      <strong>Built to feel like a clearer deploy and handoff layer, not a generic infrastructure dashboard.</strong>
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
                <span>Built for teams supporting client or self-owned infrastructure, not for teams looking to become a Kubernetes platform group.</span>
              </div>
              <div className="floatingProofCard floatingProofCardSecondary">
                <span>More than a brochure: the login flow, server review, deployment workflow, runtime detail, and commercial path already exist.</span>
              </div>
            </div>
          </div>

          <div className="landingGrid">
            <article className="landingCard landingCardAccent">
              <span className="cardKicker">What you notice first</span>
              <h2>It answers “what is running and what do I do next?” before it asks you to learn the tool.</h2>
              <p>
                The value is not only that something can deploy. The value is that
                deployment and runtime review become easier to understand, easier to
                repeat, and easier to hand off across operators.
              </p>
            </article>
            <article className="landingCard">
              <span className="cardKicker">Who it is for</span>
              <h2>Ongoing-support teams that need clarity on infrastructure they or their clients already own.</h2>
              <p>
                The first wedge is agencies, integrators, and outsourced teams that keep
                several services alive without wanting provider lock-in or Kubernetes overhead.
              </p>
            </article>
            <article className="landingCard">
              <span className="cardKicker">Why it matters</span>
              <h2>Because client infra deploys often fail in the gap between one operator’s memory and the next person’s context.</h2>
              <p>
                DeployMate is trying to shrink that gap by keeping server, deployment,
                health, and next-step review in one product story.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="landingSection">
        <div className="container">
          <div className="sectionIntro sectionIntroWide">
            <div className="eyebrow">What the first wedge wants</div>
            <h2>Three practical outcomes, visible on the first pass.</h2>
            <p className="sectionLead">
              This is the shortest way to understand why an agency, integrator, or
              internal operator would care about this product at all.
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

      <section className="landingSection">
        <div className="container">
          <div className="sectionIntro sectionIntroWide">
            <div className="eyebrow">Why the buyer story is credible</div>
            <h2>The public story now points to handoff surfaces that already exist in the product.</h2>
            <p className="sectionLead">
              This is not only generic deploy language. The current product already exposes a
              runtime passport, reusable handoff assets, and an explicit business path.
            </p>
          </div>

          <div className="capabilityGrid">
            {landingBuyerProofCards.map((item) => (
              <article key={item.label} className="capabilityCard">
                <span className="capabilityLabel">{item.label}</span>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landingSection" id="product">
        <div className="container">
          <div className="sectionIntro sectionIntroWide">
            <div className="eyebrow">What the product covers today</div>
            <h2>A calmer interface for server setup, deploy, runtime review, and handoff.</h2>
            <p className="sectionLead">
              The strongest tools reduce cognitive noise. DeployMate is being pushed in
              that direction first: explicit target, guided deploy path, readable runtime
              detail, and a clearer commercial path for real teams.
            </p>
          </div>

          <div className="capabilityGrid">
            <article className="capabilityCard">
              <span className="capabilityLabel">Deployments</span>
              <h3>Launch, redeploy, inspect logs, health, and review the current runtime from one place.</h3>
              <p>
                Deployment detail is being shaped to help someone make a runtime decision,
                not just confirm that a record exists.
              </p>
            </article>
            <article className="capabilityCard">
              <span className="capabilityLabel">Templates</span>
              <h3>Turn repeated setup into reusable handoff assets instead of loose notes.</h3>
              <p>
                Save common image, server, and port combinations once, then apply them
                back into the deploy flow or launch straight from preview.
              </p>
            </article>
            <article className="capabilityCard">
              <span className="capabilityLabel">Servers</span>
              <h3>Keep target hosts visible with diagnostics, connection tests, and suggested ports.</h3>
              <p>
                Instead of relying on shell knowledge alone, teams get a clearer way to
                validate client or self-owned targets before deploying to them.
              </p>
            </article>
            <article className="capabilityCard">
              <span className="capabilityLabel">Runtime review</span>
              <h3>Keep the deployment passport, diagnostics, activity, and safer next actions close together.</h3>
              <p>
                The product is being pushed toward readable runtime handoff before it opens
                into denser operational surfaces.
              </p>
            </article>
            <article className="capabilityCard">
              <span className="capabilityLabel">Operational safety</span>
              <h3>Release checks, smoke flows, and remote discipline already exist around the app.</h3>
              <p>
                This is not only a UI layer. The product is already being treated like
                something that needs to survive real rollout and maintenance.
              </p>
            </article>
            <article className="capabilityCard">
              <span className="capabilityLabel">Business path</span>
              <h3>Evaluation, internal team packaging, and agency/commercial access already have explicit paths.</h3>
              <p>
                The goal is to make the buyer path easier to understand before the product
                widens into broader packaging.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="landingSection">
        <div className="container">
          <div className="sectionIntro">
            <div className="eyebrow">Simple first-run model</div>
            <h2>From first target to clearer runtime in three steps</h2>
          </div>
          <div className="stepsGrid">
            <article className="stepCard">
              <span className="stepNumber">1</span>
              <h3>Connect the target</h3>
              <p>Save the server once, verify access, and make the deployment destination explicit.</p>
            </article>
            <article className="stepCard">
              <span className="stepNumber">2</span>
              <h3>Deploy with less guesswork</h3>
              <p>Use guided deploy flow, templates, previews, and suggested ports instead of rebuilding the process by memory.</p>
            </article>
            <article className="stepCard">
              <span className="stepNumber">3</span>
              <h3>Review and hand off</h3>
              <p>Track runtime state, inspect issues, and keep the next safe action visible for the next operator.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="landingSection">
        <div className="container">
          <div className="sectionIntro">
            <div className="eyebrow">Who the first pass is for</div>
            <h2>Clear enough for buyers, still useful for the people who have to keep services alive.</h2>
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
            <h2>It is not a brochure pretending to solve deploy and handoff.</h2>
            <p className="sectionLead">
              There is a real login flow, a real application shell, server review,
              deployment workflow, runtime detail, and release rigor around the product.
              That is what gives the interface weight before broader packaging lands.
            </p>
          </div>

          <div className="proofGrid">
            <article className="proofCard">
              <strong>Visible workflows</strong>
              <p>People can actually move from target setup to deploy and runtime review instead of clicking through static mock content.</p>
            </article>
            <article className="proofCard">
              <strong>Operational credibility</strong>
              <p>The product exposes runtime, diagnostics, and release discipline in a way that still feels readable.</p>
            </article>
            <article className="proofCard">
              <strong>Buyer clarity</strong>
              <p>The public path now pushes toward “what problem is this solving for my team or clients?” before deeper evaluator concerns.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="landingSection pricingSection" id="pricing">
        <div className="container">
          <div className="sectionIntro">
            <div className="eyebrow">Packaging</div>
            <h2>Three buyer-facing paths for the first wedge</h2>
          </div>

          <div className="landingCommercialStrip">
            <div>
              <div className="eyebrow">Evaluation first</div>
              <strong>Start with a live evaluation, then choose the path that matches your infrastructure and support model.</strong>
              <p className="sectionLead">
                The public product stays open for evaluation. Business use, client delivery,
                and redistribution still need an explicit paid or commercial path, but the
                packaging is now framed around who is actually buying.
              </p>
            </div>
            <div className="landingCommercialActions">
              <TrackedLink
                href={publicSignupEnabled ? "/register" : "/login"}
                className="landingButton primaryButton"
                eventName={FUNNEL_EVENT_NAMES.LANDING_CTA}
                eventProps={{ surface: "packaging_strip", cta: publicSignupEnabled ? "start_evaluation" : "open_live_product" }}
              >
                {publicSignupEnabled ? "Start evaluation" : "Open live product"}
              </TrackedLink>
              <TrackedLink
                href="/commercial-license"
                className="landingButton secondaryButton"
                eventName={FUNNEL_EVENT_NAMES.LANDING_CTA}
                eventProps={{ surface: "packaging_strip", cta: "view_business_path" }}
              >
                See business path
              </TrackedLink>
            </div>
            <div className="landingCommercialMeta">
              <span>Evaluation stays self-serve.</span>
              <span>Business use still goes through an explicit request path.</span>
            </div>
          </div>

          <div className="pricingGrid">
            <article className="pricingCard">
              <h3>Internal Team</h3>
              <div className="priceLine">Paid workspace</div>
              <p>For teams running Docker services on company-owned VPS, dedicated servers, or private cloud.</p>
              <ul className="featureList">
                <li>Path from evaluation to paid access</li>
                <li>Focused on self-owned infrastructure</li>
                <li>Guided onboarding and clearer runtime review</li>
                <li>Commercial use handled explicitly</li>
              </ul>
              <TrackedLink
                href="/upgrade"
                className="landingButton secondaryButton"
                eventName={FUNNEL_EVENT_NAMES.LANDING_CTA}
                eventProps={{ surface: "pricing", cta: "internal_team_path" }}
              >
                Review team path
              </TrackedLink>
            </article>

            <article className="pricingCard pricingCardFeatured">
              <div className="pricingBadge">Primary wedge</div>
              <h3>Agency / Multi-client</h3>
              <div className="priceLine">Commercial package</div>
              <p>For agencies, integrators, and outsourced teams supporting multiple services on client-owned infrastructure.</p>
              <ul className="featureList">
                <li>Client-owned infrastructure story</li>
                <li>Ongoing support and handoff focus</li>
                <li>Packaging aimed at multi-client work</li>
                <li>Onboarding path shaped around support teams</li>
              </ul>
              <TrackedLink
                href="/upgrade"
                className="landingButton primaryButton"
                eventName={FUNNEL_EVENT_NAMES.LANDING_CTA}
                eventProps={{ surface: "pricing", cta: "agency_path" }}
              >
                Talk through agency fit
              </TrackedLink>
            </article>

            <article className="pricingCard">
              <h3>Custom / Redistribution</h3>
              <div className="priceLine">Separate agreement</div>
              <p>For SaaS embedding, managed service resale, redistribution, or white-label style commercial use.</p>
              <ul className="featureList">
                <li>Redistribution and resale review</li>
                <li>Managed service and SaaS path</li>
                <li>Support and customization discussion</li>
                <li>Explicit commercial licensing process</li>
              </ul>
              <TrackedLink
                href="/commercial-license"
                className="landingButton secondaryButton"
                eventName={FUNNEL_EVENT_NAMES.LANDING_CTA}
                eventProps={{ surface: "pricing", cta: "custom_path" }}
              >
                Review custom path
              </TrackedLink>
            </article>
          </div>

          <div className="landingClosingCta">
            <div>
              <div className="eyebrow">Ready to explore</div>
              <h2>Open the product and decide quickly whether this feels clearer than raw Docker plus SSH for your team or clients.</h2>
              <p className="sectionLead">
                The fastest route is evaluation, one server target, one deploy flow, and one runtime detail review.
              </p>
            </div>
            <div className="buttonRow">
              <TrackedLink
                href="/login"
                className="landingButton primaryButton"
                eventName={FUNNEL_EVENT_NAMES.LANDING_CTA}
                eventProps={{ surface: "closing", cta: "open_live_product" }}
              >
                Open live product
              </TrackedLink>
              {publicSignupEnabled ? (
                <TrackedLink
                  href="/register"
                  className="landingButton secondaryButton"
                  eventName={FUNNEL_EVENT_NAMES.LANDING_CTA}
                  eventProps={{ surface: "closing", cta: "start_evaluation" }}
                >
                  Start evaluation
                </TrackedLink>
              ) : (
                <TrackedLink
                  href="/upgrade"
                  className="landingButton secondaryButton"
                  eventName={FUNNEL_EVENT_NAMES.LANDING_CTA}
                  eventProps={{ surface: "closing", cta: "request_access" }}
                >
                  Request access
                </TrackedLink>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
