export default function AppHomePage() {
  return (
    <main className="starterShell">
      <div className="starterWrap">
        <section className="starterHero">
          <p className="starterEyebrow">App Shell</p>
          <h1 className="starterTitle">{{PROJECT_NAME}} Workspace</h1>
          <p className="starterLead">
            Replace this dashboard shell with the first real workflow that proves the product is useful.
          </p>
        </section>

        <section className="starterGrid">
          <article className="starterGridCard">
            <h2>Primary workflow</h2>
            <p>Define the one core action the first real user needs to complete.</p>
          </article>
          <article className="starterGridCard">
            <h2>Admin surface</h2>
            <p>Add only the admin controls you need for support, billing, or operator visibility.</p>
          </article>
          <article className="starterGridCard">
            <h2>Data model</h2>
            <p>Start with one resource and one list/detail flow before building secondary surfaces.</p>
          </article>
        </section>
      </div>
    </main>
  );
}
