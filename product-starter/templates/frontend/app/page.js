export default function HomePage() {
  return (
    <main className="starterShell">
      <div className="starterWrap">
        <section className="starterHero">
          <p className="starterEyebrow">Product Starter</p>
          <h1 className="starterTitle">{{PROJECT_NAME}}</h1>
          <p className="starterLead">
            This starter gives you a landing page, auth shell, app shell, backend API shell,
            docs baseline, and reusable automation so you can start building the product
            instead of rebuilding the same project scaffolding.
          </p>
          <div className="starterActions">
            <a className="starterButton starterButtonPrimary" href="/register">Create account</a>
            <a className="starterButton starterButtonSecondary" href="/login">Login</a>
            <a className="starterButton starterButtonSecondary" href="/app">Open app shell</a>
          </div>
        </section>

        <section className="starterGrid">
          <article className="starterGridCard">
            <h2>Ship sooner</h2>
            <p>Use the starter for auth, app shell, backend routes, and docs instead of starting from zero.</p>
          </article>
          <article className="starterGridCard">
            <h2>Keep focus</h2>
            <p>Automation core already handles local checks, PR flow, release gates, and adoption checks.</p>
          </article>
          <article className="starterGridCard">
            <h2>Adapt fast</h2>
            <p>Replace the placeholders, define your first real resource, and start shipping the actual product.</p>
          </article>
        </section>
      </div>
    </main>
  );
}
