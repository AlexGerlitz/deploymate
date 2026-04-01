import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="landingPage">
      <section className="landingHero">
        <div className="container landingShell">
          <div className="landingHeader">
            <div>
              <div className="eyebrow">DeployMate</div>
              <h1>Deploy Docker apps to VPS without DevOps overhead</h1>
              <p className="landingLead">
                DeployMate helps teams ship containerized apps to VPS servers with less
                operational drag. Connect a server, test Docker access, deploy an image,
                and monitor the rollout from one place.
              </p>
            </div>
            <div className="buttonRow">
              <Link href="/login" className="landingButton primaryButton">
                Login
              </Link>
              <Link href="/upgrade" className="landingButton secondaryButton">
                Start trial / Request access
              </Link>
            </div>
          </div>

          <div className="landingGrid">
            <article className="landingCard">
              <h2>Simple VPS deploys</h2>
              <p>
                Replace scattered shell scripts with one UI for deploy, redeploy, logs,
                health checks, and activity history.
              </p>
            </article>
            <article className="landingCard">
              <h2>Built for small teams</h2>
              <p>
                Ship Docker apps without standing up Kubernetes, CI/CD platform work, or
                dedicated DevOps overhead.
              </p>
            </article>
            <article className="landingCard">
              <h2>Ready for demos</h2>
              <p>
                Show a clean deployment flow to early customers, internal teams, or trial
                users before investing in deeper infrastructure.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="landingSection">
        <div className="container">
          <div className="sectionIntro">
            <div className="eyebrow">Onboarding</div>
            <h2>From VPS access to first deploy in three steps</h2>
          </div>
          <div className="stepsGrid">
            <article className="stepCard">
              <span className="stepNumber">1</span>
              <h3>Add your server</h3>
              <p>Save SSH access once and keep your target ready for the next release.</p>
            </article>
            <article className="stepCard">
              <span className="stepNumber">2</span>
              <h3>Test connection</h3>
              <p>Verify SSH and Docker access before you send a production deployment.</p>
            </article>
            <article className="stepCard">
              <span className="stepNumber">3</span>
              <h3>Deploy the image</h3>
              <p>Launch, inspect logs, review health, and redeploy when you need a change.</p>
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
              <p>For early evaluation and product demos.</p>
              <ul className="featureList">
                <li>Up to 1 server</li>
                <li>Up to 3 deployments</li>
                <li>Email onboarding</li>
              </ul>
              <Link href="/upgrade" className="landingButton secondaryButton">
                Request access
              </Link>
            </article>
            <article className="pricingCard pricingCardFeatured">
              <div className="pricingBadge">Recommended</div>
              <h3>Solo</h3>
              <div className="priceLine">$29/mo</div>
              <p>For teams that want repeatable VPS deploys without platform engineering.</p>
              <ul className="featureList">
                <li>Up to 3 servers</li>
                <li>Up to 15 deployments</li>
                <li>Priority setup help</li>
              </ul>
              <Link href="/upgrade" className="landingButton primaryButton">
                Start trial
              </Link>
            </article>
            <article className="pricingCard">
              <h3>Team</h3>
              <div className="priceLine">Custom</div>
              <p>For agencies or product teams managing multiple apps and environments.</p>
              <ul className="featureList">
                <li>Up to 10 servers</li>
                <li>Up to 100 deployments</li>
                <li>Custom onboarding</li>
              </ul>
              <Link href="/upgrade" className="landingButton secondaryButton">
                Talk to sales
              </Link>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
